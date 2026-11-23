import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { Bookmark } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";
import type { Post } from "./types";

export const FEELINGS: { emoji: string; label: string }[] = [
  { emoji: "😊", label: "feeling happy" },
  { emoji: "🥰", label: "feeling loved" },
  { emoji: "😢", label: "feeling sad" },
  { emoji: "🤩", label: "feeling excited" },
  { emoji: "😎", label: "feeling cool" },
  { emoji: "😴", label: "feeling sleepy" },
  { emoji: "🙏", label: "feeling blessed" },
  { emoji: "🥳", label: "celebrating" },
  { emoji: "🎬", label: "watching a movie" },
  { emoji: "🎵", label: "listening to music" },
  { emoji: "✈️", label: "travelling" },
  { emoji: "🍽️", label: "eating" },
];

/** Bookmark toggle stored on the viewer's user document. */
export function SaveButton({ postId, size = 19, className = "" }: { postId: string; size?: number; className?: string }) {
  const { user, profile } = useAuth();
  const saved = !!profile?.savedPosts?.includes(postId);
  const toggle = () => {
    if (!user) return;
    void updateDoc(doc(db, "users", user.uid), {
      savedPosts: saved ? arrayRemove(postId) : arrayUnion(postId),
    });
  };
  return (
    <button onClick={toggle} aria-label={saved ? "Unsave" : "Save"} className={`active:scale-90 transition-transform ${className}`}>
      <Bookmark size={size} className={saved ? "fill-current" : ""} />
    </button>
  );
}

export function PollView({ post }: { post: Post }) {
  const { user } = useAuth();
  const poll = post.poll;
  if (!poll || !poll.options?.length) return null;
  const total = poll.options.reduce((s, o) => s + (o.votes?.length ?? 0), 0);
  const myIdx = user ? poll.options.findIndex((o) => o.votes?.includes(user.uid)) : -1;
  const vote = (i: number) => {
    if (!user) return;
    const options = poll.options.map((o, j) => {
      const votes = (o.votes ?? []).filter((v) => v !== user.uid);
      if (j === i && myIdx !== i) votes.push(user.uid);
      return { ...o, votes };
    });
    void updateDoc(doc(db, "posts", post.id), { poll: { ...poll, options } });
  };
  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-gray-100 p-3">
      {poll.question && <p className="text-sm font-semibold text-gray-900">📊 {poll.question}</p>}
      {poll.options.map((o, i) => {
        const n = o.votes?.length ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <button key={i} onClick={() => vote(i)} className={`relative w-full h-10 rounded-xl overflow-hidden border text-left text-sm ${myIdx === i ? "border-sky-400" : "border-gray-200"}`}>
            {myIdx >= 0 && <span className="absolute inset-y-0 left-0 bg-sky-100" style={{ width: `${pct}%` }} />}
            <span className="relative px-3 flex items-center justify-between h-full">
              <span className="font-medium text-gray-800 truncate">{o.text}</span>
              {myIdx >= 0 && <span className="text-xs font-semibold text-gray-600">{pct}%</span>}
            </span>
          </button>
        );
      })}
      <p className="text-xs text-gray-400">{total} vote{total === 1 ? "" : "s"}</p>
    </div>
  );
}
