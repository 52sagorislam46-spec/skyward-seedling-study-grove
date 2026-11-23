import { useBackClose } from "@/hooks/useBackClose";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where,
} from "firebase/firestore";
import { db, secureUrl } from "../../lib/firebase";

export interface HighlightItem { mediaUrl: string; mediaType: string; storyId?: string }
export interface Highlight { id: string; ownerId: string; title: string; cover: string; items: HighlightItem[]; createdAt: number }

export function subscribeHighlights(uid: string, cb: (h: Highlight[]) => void) {
  const q = query(collection(db, "highlights"), where("ownerId", "==", uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Highlight, "id">) }));
    list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    cb(list);
  }, () => cb([]));
}

/** Sheet used from the story menu: pick an existing highlight or create a new one. */
export function AddToHighlightSheet({ uid, item, onClose }: { uid: string; item: HighlightItem; onClose: () => void }) {
  useBackClose(onClose);
  const [list, setList] = useState<Highlight[]>([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => subscribeHighlights(uid, setList), [uid]);

  const addTo = async (h: Highlight) => {
    if (h.items.some((i) => i.mediaUrl === item.mediaUrl)) { setMsg("Already in this highlight"); return; }
    await updateDoc(doc(db, "highlights", h.id), { items: arrayUnion(item) });
    setMsg(`Added to ${h.title}`);
    setTimeout(onClose, 700);
  };
  const create = async () => {
    const t = title.trim();
    if (!t) return;
    await addDoc(collection(db, "highlights"), {
      ownerId: uid, title: t.slice(0, 20), cover: item.mediaType === "image" ? item.mediaUrl : "",
      items: [item], createdAt: Date.now(),
    });
    setMsg(`Added to ${t}`);
    setTimeout(onClose, 700);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900 mb-3">Add to highlight</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {list.map((h) => (
            <button key={h.id} onClick={() => void addTo(h)} className="flex flex-col items-center gap-1 shrink-0 w-16">
              <HighlightCover h={h} />
              <span className="text-[11px] text-gray-800 truncate w-full text-center">{h.title}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={20} placeholder="New highlight name"
            className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900" />
          <button onClick={() => void create()} disabled={!title.trim()}
            className="h-11 px-4 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1">
            <Plus size={16} /> New
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
      </div>
    </div>
  );
}

function HighlightCover({ h }: { h: Highlight }) {
  const src = h.cover || h.items.find((i) => i.mediaType === "image")?.mediaUrl || "";
  return (
    <span className="w-16 h-16 rounded-full p-[2px] bg-gray-200 block">
      {src ? (
        <img src={secureUrl(src)} alt="" className="w-full h-full rounded-full object-cover border-2 border-white" />
      ) : (
        <span className="w-full h-full rounded-full bg-gray-800 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
          {h.title.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

/** Round highlight circles shown under the bio on a profile. */
export function HighlightsBar({ uid, isMe }: { uid: string; isMe: boolean }) {
  const [list, setList] = useState<Highlight[]>([]);
  const [open, setOpen] = useState<Highlight | null>(null);
  useEffect(() => subscribeHighlights(uid, setList), [uid]);
  if (!list.length) return null;
  return (
    <>
      <div className="flex gap-4 overflow-x-auto mt-3 pb-1">
        {list.map((h) => (
          <button key={h.id} onClick={() => setOpen(h)} className="flex flex-col items-center gap-1 shrink-0 w-16">
            <HighlightCover h={h} />
            <span className="text-[11px] text-gray-800 truncate w-full text-center">{h.title}</span>
          </button>
        ))}
      </div>
      {open && <HighlightViewer h={list.find((x) => x.id === open.id) ?? open} isMe={isMe} onClose={() => setOpen(null)} />}
    </>
  );
}

function HighlightViewer({ h, isMe, onClose }: { h: Highlight; isMe: boolean; onClose: () => void }) {
  useBackClose(onClose);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const item = h.items[i];
  const next = () => (i < h.items.length - 1 ? setI(i + 1) : onClose());
  useEffect(() => {
    if (!item || item.mediaType === "video" || paused) return;
    const t = setTimeout(next, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, item, paused]);
  if (!item) return null;

  const removeItem = async () => {
    const items = h.items.filter((_, k) => k !== i);
    if (!items.length) { await deleteDoc(doc(db, "highlights", h.id)); onClose(); return; }
    await updateDoc(doc(db, "highlights", h.id), { items });
    setI(Math.max(0, Math.min(i, items.length - 1)));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <div className="flex gap-1 px-2 pt-2">
        {h.items.map((_, k) => (
          <span key={k} className={`h-0.5 flex-1 rounded-full ${k <= i ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-white">
        <span className="font-semibold text-sm">{h.title}</span>
        <div className="flex items-center gap-4">
          {isMe && (
            <button onClick={() => void removeItem()} aria-label="Remove from highlight"><Trash2 size={20} /></button>
          )}
          <button onClick={onClose} aria-label="Close"><X size={24} /></button>
        </div>
      </div>
      <div className="relative flex-1 flex items-center justify-center"
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}>
        {item.mediaType === "video" ? (
          <video key={item.mediaUrl} src={secureUrl(item.mediaUrl)} autoPlay playsInline onEnded={next} className="max-h-full max-w-full" />
        ) : (
          <img src={secureUrl(item.mediaUrl)} alt="" className="max-h-full max-w-full object-contain" />
        )}
        <button aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI(Math.max(0, i - 1))} />
        <button aria-label="Next" className="absolute inset-y-0 right-0 w-1/3" onClick={next} />
      </div>
    </div>
  );
}
