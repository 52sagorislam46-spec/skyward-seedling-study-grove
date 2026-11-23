import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Play, Search, X } from "lucide-react";
import { usePosts } from "./usePosts";
import { PostCard } from "./PostCard";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Avatar } from "./Avatar";
import { toMillis } from "./chat";
import type { Post, UserProfile } from "./types";

export function SearchPage({
  onOpenProfile,
  onBack,
}: {
  onOpenProfile: (uid: string) => void;
  onBack?: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [term, setTerm] = useState("");
  const { posts } = usePosts(60);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const explore = useMemo(
    () => posts.filter((p) => p.mediaUrl && !p.exclusive && (p.mediaType === "image" || p.mediaType === "video")),
    [posts],
  );

  useEffect(() => {
    return onSnapshot(query(collection(db, "users"), limit(100)), (snap) => {
      setUsers(
        snap.docs.map((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any = d.data();
          return {
            uid: d.id,
            username: data.username ?? "user",
            displayName: data.displayName ?? "Anonymous",
            bio: data.bio ?? "",
            photoURL: data.photoURL ?? "",
            followers: data.followers ?? [],
            following: data.following ?? [],
            createdAt: toMillis(data.createdAt),
          };
        }),
      );
    });
  }, []);

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    );
  }, [users, term]);

  return (
    <div className="pb-20">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 h-16 flex items-center gap-2 z-10">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="relative w-full">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search people"
            className="w-full h-10 pl-10 pr-4 rounded-2xl bg-gray-50 border border-gray-100 text-sm outline-none focus:border-sky-300"
          />
        </div>
      </header>
      {!term.trim() && explore.length > 0 && (
        <section className="mb-2">
          <h2 className="px-4 pt-3 pb-2 text-sm font-semibold text-gray-900">Explore</h2>
          <div className="grid grid-cols-3 gap-0.5">
            {explore.map((p) => (
              <button key={p.id} onClick={() => setOpenPost(p)} className="relative aspect-square bg-gray-100 overflow-hidden" aria-label="Open post">
                {p.mediaType === "video" ? (
                  <video src={p.mediaUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <img src={p.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
                {p.mediaType === "video" && <Play size={16} className="absolute top-1.5 right-1.5 text-white drop-shadow fill-current" />}
                {p.media && p.media.length > 1 && <Copy size={15} className="absolute top-1.5 right-1.5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <h2 className="px-4 pt-4 pb-1 text-sm font-semibold text-gray-900">People</h2>
        </section>
      )}
      {openPost && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto" onClick={() => setOpenPost(null)}>
          <div className="w-full max-w-md bg-white min-h-full sm:min-h-0 sm:my-8 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <button onClick={() => setOpenPost(null)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600"><X size={20} /></button>
            </div>
            <PostCard
              post={posts.find((x) => x.id === openPost.id) ?? openPost}
              onOpenProfile={(uid) => { setOpenPost(null); onOpenProfile(uid); }}
            />
          </div>
        </div>
      )}
      <ul>
        {results.map((u) => (
          <li key={u.uid}>
            <button
              onClick={() => onOpenProfile(u.uid)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left active:bg-gray-50"
            >
              <Avatar src={u.photoURL} alt={u.displayName} size={44} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {u.displayName}
                </p>
                <p className="text-xs text-gray-400 truncate">@{u.username}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
