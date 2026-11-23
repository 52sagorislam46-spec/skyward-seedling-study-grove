import { describe, expect, it } from "vitest";
import {
  dropPost,
  mergePostPages,
  notifyPostDeleted,
  subscribeToDeletions,
} from "../components/fly/usePosts";

type Item = { id: string; createdAt: number };

const live = (id: string, createdAt: number): Item => ({ id, createdAt });

describe("Deleted posts vanish immediately", () => {
  it("drops a post that was loaded from an older page, not just the live window", () => {
    // Older, already-loaded pages: the live listener never watches these, so
    // without the deletion bus a deleted post would stay on screen here.
    const loaded = [live("new-1", 30), live("old-1", 20), live("old-2", 10)];
    expect(dropPost(loaded, "old-1").map((p) => p.id)).toEqual(["new-1", "old-2"]);
  });

  it("tells every mounted feed the moment a post is deleted", () => {
    const seen: string[] = [];
    const unsub = subscribeToDeletions((id) => seen.push(id));
    notifyPostDeleted("post-7");
    unsub();
    notifyPostDeleted("post-8");
    // Only the id sent while subscribed is delivered, and unsubscribing works.
    expect(seen).toEqual(["post-7"]);
  });

  it("removes a post that disappeared from the watched window when merging pages", () => {
    const previous = [live("a", 30), live("b", 20)];
    const fresh = [live("a", 30)]; // "b" was deleted server-side
    const windowIds = new Set(["a", "b"]);
    const merged = mergePostPages(previous, fresh, windowIds);
    expect(merged.list.map((p) => p.id)).toEqual(["a"]);
    expect(merged.windowIds).toEqual(new Set(["a"]));
  });
});
