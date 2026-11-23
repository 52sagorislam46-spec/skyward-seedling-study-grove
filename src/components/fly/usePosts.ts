import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Post } from "./types";

function toMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in (value as object)) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "number" ? value : Date.now();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPost(id: string, data: any): Post {
  return {
    id,
    authorId: data.authorId ?? "",
    authorName: data.authorName ?? "Anonymous",
    authorUsername: data.authorUsername ?? "user",
    authorPhoto: data.authorPhoto ?? "",
    text: data.text ?? "",
    mediaUrl: data.mediaUrl ?? "",
    mediaType: data.mediaType ?? "",
    media: Array.isArray(data.media) ? data.media : [],
    taggedUsers: Array.isArray(data.taggedUsers) ? data.taggedUsers : [],
    likes: data.likes ?? [],
    comments: data.comments ?? [],
    tags: (data.tags as string[] | undefined) ?? [],
    views: typeof data.views === "number" ? data.views : 0,
    exclusive: data.exclusive === true,
    feeling: typeof data.feeling === "string" ? data.feeling : "",
    poll: data.poll && Array.isArray(data.poll.options) ? data.poll : null,
    bgStyle: typeof data.bgStyle === "string" ? data.bgStyle : "",
    product:
      data.product && typeof data.product === "object" && data.product.title
        ? {
            title: String(data.product.title ?? ""),
            price: String(data.product.price ?? ""),
            imageUrl: String(data.product.imageUrl ?? ""),
            link: String(data.product.link ?? ""),
          }
        : null,
    createdAt: toMillis(data.createdAt),
  };
}

// Hide leftover demo/test posts (e.g. "Judge Bot" checks) from the feed.
const isDemoPost = (p: Post) => /^judge\b/i.test(p.authorName) || /^JUDGE-/.test(p.text);

// ---- Deletion bus ----
// The live listener only watches the newest page of posts, so a post deleted
// while it sits on an older, already-loaded page would otherwise stay on screen
// in the timeline, in reels and on the profile until a full reload. Every
// mounted feed subscribes here and drops the id the moment the delete succeeds.
const deletedIds = new Set<string>();
const deleteListeners = new Set<(id: string) => void>();

/** Tell every mounted feed that this post is gone, so it vanishes at once. */
export function notifyPostDeleted(id: string) {
  deletedIds.add(id);
  deleteListeners.forEach((l) => l(id));
}

export function subscribeToDeletions(fn: (id: string) => void) {
  deleteListeners.add(fn);
  return () => void deleteListeners.delete(fn);
}

function pruneDeleted<T extends { id: string }>(list: T[]): T[] {
  if (!deletedIds.size) return list;
  return list.filter((p) => !deletedIds.has(p.id));
}

/**
 * Drop one post from a list that may contain both the live window and older,
 * already-loaded pages — the rule a deleted post must follow everywhere.
 */
export function dropPost<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((p) => p.id !== id);
}

/**
 * Merges the live first page with previously loaded older pages and drops any
 * post that disappeared from the watched window — so a deleted post vanishes
 * immediately from the feed, reels and profile grids, no refresh needed.
 */
export function mergePostPages<T extends { id: string; createdAt: number }>(
  previous: T[],
  fresh: T[],
  prevWindowIds: ReadonlySet<string>,
): { list: T[]; windowIds: Set<string> } {
  const freshIds = new Set(fresh.map((p) => p.id));
  const removed = new Set<string>();
  prevWindowIds.forEach((id) => {
    if (!freshIds.has(id)) removed.add(id);
  });
  const list = [
    ...fresh,
    ...previous.filter((p) => !freshIds.has(p.id) && !removed.has(p.id)),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return { list, windowIds: freshIds };
}

export function usePosts(pageSize = 40) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const loadingMoreRef = useRef(false);
  // Ids from the live-listened first page, used to detect deletions.
  const windowIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(pageSize),
    );
    return onSnapshot(
      q,
      (snap) => {
        const fresh = snap.docs.map((d) => toPost(d.id, d.data()));
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
        const prevWindowIds = windowIdsRef.current;
        windowIdsRef.current = new Set(fresh.map((post) => post.id));
        setPosts((previous) => pruneDeleted(mergePostPages(previous, fresh, prevWindowIds).list));
        setHasMore(snap.docs.length === pageSize);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [pageSize]);

  // Drop a deleted post from this feed instantly, even when it was loaded from
  // an older page that the live listener does not watch.
  useEffect(
    () => subscribeToDeletions((id) => setPosts((previous) => dropPost(previous, id))),
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const lastDoc = lastDocRef.current;
    if (!lastDoc) {
      setHasMore(false);
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(pageSize),
        ),
      );
      const older = snap.docs.map((d) => toPost(d.id, d.data()));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDoc;
      setPosts((previous) => {
        const ids = new Set(previous.map((post) => post.id));
        return pruneDeleted(
          [...previous, ...older.filter((post) => !ids.has(post.id))].sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
        );
      });
      setHasMore(snap.docs.length === pageSize);
    } catch {
      /* Keep the currently loaded feed available if pagination is offline. */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, pageSize]);

  // Pulls the newest page straight from the server so newly uploaded posts
  // appear even if the live listener is backed by cache.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const snap = await getDocsFromServer(
        query(
          collection(db, "posts"),
          orderBy("createdAt", "desc"),
          limit(pageSize),
        ),
      );
      const fresh = snap.docs.map((d) => toPost(d.id, d.data()));
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      const prevWindowIds = windowIdsRef.current;
      windowIdsRef.current = new Set(fresh.map((post) => post.id));
      setPosts((previous) => mergePostPages(previous, fresh, prevWindowIds).list);
      setHasMore(snap.docs.length === pageSize);
    } catch {
      /* Keep the currently loaded feed available if refresh is offline. */
    } finally {
      setRefreshing(false);
    }
  }, [pageSize]);

  return { posts: posts.filter((p) => !isDemoPost(p)), loading, loadingMore, hasMore, loadMore, refresh, refreshing };
}

/**
 * Paginated reels feed: listens live to the newest page of video posts and
 * loads older pages on demand (infinite scroll). New reels appear instantly
 * via the snapshot listener; `loadMore` appends the next batch.
 */
// A post counts as a reel when it is marked as a video, or when its media URL
// clearly points at a video file (older posts sometimes miss mediaType).
export function isVideoPost(post: Pick<Post, "mediaType" | "mediaUrl">): boolean {
  const type = (post.mediaType ?? "").toLowerCase();
  if (type.startsWith("video")) return true;
  if (type.startsWith("image")) return false;
  const url = (post.mediaUrl ?? "").toLowerCase();
  if (!url) return false;
  return (
    /\.(mp4|mov|m4v|webm|avi|mkv|3gp|ogv|m3u8)(\?|#|$)/.test(url) ||
    url.includes("/video/upload/")
  );
}

export function useReels(pageSize = 5) {
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Cursor for the live first page (reset on every snapshot).
  const firstPageLastRef = useRef<DocumentSnapshot | null>(null);
  // Cursor for pagination: only ever advances as older pages are loaded, so a
  // new snapshot of the first page can't rewind the feed back to 5 videos.
  const cursorRef = useRef<DocumentSnapshot | null>(null);
  const pagedRef = useRef(false);
  const loadingMoreRef = useRef(false);
  // Ids from the live-listened first page, used to detect deletions.
  const windowIdsRef = useRef<Set<string>>(new Set());

  // Videos are picked out on the client so a missing/odd mediaType value can
  // never hide an uploaded reel. Fetch a wider window to compensate.
  const fetchSize = Math.max(pageSize * 4, 20);

  const baseQuery = useCallback(
    () => query(collection(db, "posts"), orderBy("createdAt", "desc")),
    [],
  );

  useEffect(() => {
    const q = query(baseQuery(), limit(fetchSize));
    return onSnapshot(
      q,
      (snap) => {
        const fresh = snap.docs
          .map((d) => toPost(d.id, d.data()))
          .filter(isVideoPost);
        const prevWindowIds = windowIdsRef.current;
        windowIdsRef.current = new Set(fresh.map((p) => p.id));
        setReels((prev) => pruneDeleted(mergePostPages(prev, fresh, prevWindowIds).list));
        if (snap.docs.length > 0) {
          firstPageLastRef.current = snap.docs[snap.docs.length - 1] ?? null;
        }
        // Only the very first page decides "hasMore" until we start paginating.
        if (!pagedRef.current) setHasMore(snap.docs.length === fetchSize);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [baseQuery, fetchSize]);


  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const lastDoc = cursorRef.current ?? firstPageLastRef.current;
    if (!lastDoc) {
      setHasMore(false);
      return;
    }
    loadingMoreRef.current = true;
    pagedRef.current = true;
    setLoadingMore(true);
    try {
      const q = query(baseQuery(), startAfter(lastDoc), limit(fetchSize));
      const snap = await getDocs(q);
      const batch = snap.docs.map((d) => toPost(d.id, d.data())).filter(isVideoPost);
      if (snap.docs.length > 0) {
        cursorRef.current = snap.docs[snap.docs.length - 1] ?? lastDoc;
      }
      if (batch.length > 0) {
        setReels((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return pruneDeleted(
            [...prev, ...batch.filter((p) => !ids.has(p.id))].sort(
              (a, b) => b.createdAt - a.createdAt,
            ),
          );
        });
      }
      setHasMore(snap.docs.length === fetchSize);
    } catch {
      /* best effort */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [baseQuery, hasMore, fetchSize]);

  // Pull-to-refresh: fetch the newest page of reels straight from the server
  // and reset pagination so the feed starts fresh from the top.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const snap = await getDocsFromServer(query(baseQuery(), limit(fetchSize)));
      const fresh = snap.docs.map((d) => toPost(d.id, d.data())).filter(isVideoPost);
      firstPageLastRef.current = snap.docs[snap.docs.length - 1] ?? null;
      cursorRef.current = null;
      pagedRef.current = false;
      const prevWindowIds = windowIdsRef.current;
      windowIdsRef.current = new Set(fresh.map((p) => p.id));
      setReels((prev) => mergePostPages(prev, fresh, prevWindowIds).list);
      setHasMore(snap.docs.length === fetchSize);
    } catch {
      /* Keep the currently loaded feed available if refresh is offline. */
    } finally {
      setRefreshing(false);
    }
  }, [baseQuery, fetchSize]);

  // Drop a deleted reel from this list instantly, even when it came from an
  // older page that the live listener does not watch.
  useEffect(
    () => subscribeToDeletions((id) => setReels((prev) => dropPost(prev, id))),
    [],
  );

  return { reels, loading, loadingMore, hasMore, loadMore, refresh, refreshing };
}


