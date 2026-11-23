import { useRef, useState } from "react";

const SPEEDS = [1, 1.5, 2];

/** Voice message player with 1x / 1.5x / 2x speed toggle. */
export function VoicePlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [i, setI] = useState(0);
  const next = () => {
    const n = (i + 1) % SPEEDS.length;
    setI(n);
    if (ref.current) ref.current.playbackRate = SPEEDS[n] ?? 1;
  };
  return (
    <span className="flex items-center gap-1.5 my-1">
      <audio ref={ref} src={src} controls className="w-48 max-w-full" onPlay={(e) => (e.currentTarget.playbackRate = SPEEDS[i] ?? 1)} />
      <button type="button" onClick={next} className="shrink-0 min-w-9 h-7 px-2 rounded-full bg-black/10 text-xs font-bold">
        {SPEEDS[i]}x
      </button>
    </span>
  );
}
