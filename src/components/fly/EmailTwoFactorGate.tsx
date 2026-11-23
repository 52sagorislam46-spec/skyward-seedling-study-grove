/** Blocks the app until the e-mail code is entered, for accounts with e-mail two-step on. */
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { sendEmailCode, verifyEmailCode } from "./emailOtp";

const KEY = "fly-email-2fa-ok";

export function emailGatePassed(email: string) {
  try {
    return sessionStorage.getItem(KEY) === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

export function EmailTwoFactorGate({ email, onCancel }: { email: string; onCancel: () => void }) {
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, force] = useState(0);

  const send = async () => {
    setBusy(true); setError("");
    try {
      const r = await sendEmailCode(email, "login");
      if (!r.configured) throw new Error("ইমেইল কোড এখন পাঠানো যাচ্ছে না।");
      setToken(r.token);
    } catch (e) { setError(e instanceof Error ? e.message : "কোড পাঠানো যায়নি"); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError("");
    try {
      await verifyEmailCode(email, code.trim(), token);
      sessionStorage.setItem(KEY, email.trim().toLowerCase());
      force((n) => n + 1);
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "ভুল কোড"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-sky-50">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 p-6 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck size={20} className="text-sky-500" /><p className="font-semibold text-gray-900">টু-স্টেপ ভেরিফিকেশন</p></div>
        <p className="text-xs text-gray-500">{email} ঠিকানায় ৬ সংখ্যার কোড পাঠানো হবে।</p>
        {token ? (
          <>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-full h-11 px-3 rounded-2xl border border-gray-200 text-center tracking-[0.4em] font-semibold outline-none" />
            <button onClick={() => void verify()} disabled={busy || code.length < 6} className="w-full h-11 rounded-2xl bg-sky-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />}কোড মিলিয়ে দেখুন</button>
            <button onClick={() => void send()} disabled={busy} className="w-full text-xs text-sky-500">নতুন কোড পাঠান</button>
          </>
        ) : (
          <button onClick={() => void send()} disabled={busy} className="w-full h-11 rounded-2xl bg-sky-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />}কোড পাঠান</button>
        )}
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button onClick={onCancel} className="w-full text-xs text-gray-500">লগ-আউট</button>
      </div>
    </div>
  );
}
