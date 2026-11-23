/** Free e-mail two-step verification toggle (Edit profile). */
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";
import { sendEmailCode, verifyEmailCode } from "./emailOtp";

export function EmailTwoFactorSection() {
  const { profile, user, refreshProfile } = useAuth();
  const email = profile?.email || user?.email || "";
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  if (!profile) return null;
  const on = Boolean(profile.emailTwoFactor);

  const setFlag = async (v: boolean) => {
    await updateDoc(doc(db, "users", profile.uid), { emailTwoFactor: v });
    await refreshProfile();
  };

  const send = async () => {
    setBusy(true); setError(""); setInfo("");
    try {
      const r = await sendEmailCode(email, "login");
      if (!r.configured) throw new Error("ইমেইল কোড এখন পাঠানো যাচ্ছে না।");
      setToken(r.token);
      setInfo(`${email} ঠিকানায় কোড পাঠানো হয়েছে।`);
    } catch (e) { setError(e instanceof Error ? e.message : "কোড পাঠানো যায়নি"); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError("");
    try {
      await verifyEmailCode(email, code.trim(), token);
      await setFlag(true);
      try { sessionStorage.setItem("fly-email-2fa-ok", email.trim().toLowerCase()); } catch { /* noop */ }
      setToken(""); setCode("");
      setInfo("ইমেইল টু-স্টেপ ভেরিফিকেশন চালু হয়েছে।");
    } catch (e) { setError(e instanceof Error ? e.message : "ভুল কোড"); }
    finally { setBusy(false); }
  };

  const off = async () => {
    setBusy(true); setError("");
    try { await setFlag(false); setInfo("ইমেইল টু-স্টেপ বন্ধ করা হয়েছে।"); }
    catch (e) { setError(e instanceof Error ? e.message : "ব্যর্থ হয়েছে"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
      <div className="flex items-center gap-2"><Mail size={18} className="text-sky-500" /><p className="text-sm font-semibold text-gray-900">Two-step verification (Email)</p></div>
      <p className="text-xs text-gray-500">প্রতিবার লগ-ইনের সময় আপনার ইমেইলে ({email || "—"}) একটি কোড যাবে। এটি ফ্রি।</p>
      {on ? (
        <div className="flex items-center justify-between text-xs text-gray-700">
          <span>On · Email</span>
          <button onClick={() => void off()} disabled={busy} className="px-3 h-8 rounded-xl border border-gray-200 bg-white font-medium text-rose-500 disabled:opacity-60">Turn off</button>
        </div>
      ) : token ? (
        <div className="space-y-2">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-full h-10 px-3 rounded-2xl bg-white border border-gray-200 text-sm outline-none focus:border-sky-300" />
          <button onClick={() => void confirm()} disabled={busy || code.length < 6} className="w-full h-10 rounded-2xl bg-sky-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />}Confirm code</button>
        </div>
      ) : (
        <button onClick={() => void send()} disabled={busy || !email} className="w-full h-10 rounded-2xl bg-sky-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />}Send code to email</button>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {info && !error && <p className="text-xs text-emerald-600">{info}</p>}
    </div>
  );
}
