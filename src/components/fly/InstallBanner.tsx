import { useEffect, useState } from "react";
import flyLogo from "@/assets/fly-logo-cropped.png.asset.json";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallBanner() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem("fly-install-dismissed")) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setShow(true); }
    const h = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); setShow(true); };
    const done = () => setShow(false);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);

  if (!show) return null;
  const close = () => { localStorage.setItem("fly-install-dismissed", "1"); setShow(false); };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setEvt(null); setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-20 z-[100] flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl">
      <img src={(flyLogo as { url: string }).url} alt="Fly" className="h-12 w-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Fly অ্যাপ ইনস্টল করুন</p>
        <p className="text-xs text-muted-foreground">
          {ios ? "শেয়ার বোতাম চাপুন → \"Add to Home Screen\"" : "এক ক্লিকে ফোনের হোম স্ক্রিনে রাখুন"}
        </p>
      </div>
      {!ios && (
        <button onClick={install} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          ইনস্টল
        </button>
      )}
      <button onClick={close} aria-label="বন্ধ করুন" className="px-1 text-lg text-muted-foreground">×</button>
    </div>
  );
}
