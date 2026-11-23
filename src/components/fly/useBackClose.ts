import { useBackClose as useLayer } from "@/hooks/useBackClose";

/** Legacy signature kept for older screens; uses the shared back-button stack. */
export function useBackClose(open: boolean, close: () => void) {
  useLayer(close, open);
}
