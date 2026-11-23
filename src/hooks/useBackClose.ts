import { useEffect, useRef } from "react";

/**
 * Makes the phone/browser back button close the most recently opened
 * popup or inner screen first, one step at a time (like Facebook/WhatsApp).
 * Each open layer pushes a history entry that keeps the current app snapshot,
 * so the main screen stays the same while the layer closes.
 */
type Layer = { id: number; close: () => void };
const stack: Layer[] = [];
let seq = 0;
let ignorePops = 0;
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const cur = (window.history.state as { flyLayer?: number } | null)?.flyLayer;
    // Close every layer opened after the entry we landed on.
    while (stack.length && stack[stack.length - 1]!.id !== cur) {
      const top = stack.pop()!;
      if (cur !== undefined && top.id < cur) {
        stack.push(top);
        break;
      }
      top.close();
    }
  });
}

export function useBackClose(onClose: () => void, active: boolean = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    listen();
    const id = ++seq;
    const layer: Layer = { id, close: () => ref.current() };
    stack.push(layer);
    const prev = (window.history.state as Record<string, unknown> | null) ?? {};
    window.history.pushState({ ...prev, flyLayer: id }, "");
    return () => {
      const i = stack.indexOf(layer);
      if (i < 0) return; // already closed by the back button
      stack.splice(i, 1);
      // Closed from an on-screen button: drop our history entry too.
      if ((window.history.state as { flyLayer?: number } | null)?.flyLayer === id) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [active]);
}
