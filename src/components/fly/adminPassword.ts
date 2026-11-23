import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, firebaseConfig } from "../../lib/firebase";

export type AdminPasswordResult =
  | { status: "applied" }
  | { status: "queued"; reason: string };

let swapCount = 0;

/**
 * Sign in as the member in a separate, throwaway Firebase app instance and
 * change their Firebase Auth password there. The admin's own session lives in
 * the main app instance and is never touched, and nothing is read while signed
 * out — so the Firestore rules that block logged-out reads stay as they are.
 */
async function swapInThrowawaySession(email: string, current: string, next: string) {
  const name = `fly-admin-password-${Date.now()}-${swapCount++}`;
  let secondary: FirebaseApp | null = null;
  try {
    secondary = initializeApp(firebaseConfig, name);
    const secondaryAuth = getAuth(secondary);
    const cred = await signInWithEmailAndPassword(secondaryAuth, email, current);
    await updatePassword(cred.user, next);
    await signOut(secondaryAuth);
  } finally {
    if (secondary) await deleteApp(secondary).catch(() => {});
  }
}

/**
 * Admin sets a new password for a member.
 *
 * When the member's current password is known it is changed inside Firebase
 * Auth straight away, so the new password works on the member's very first
 * login attempt. When it is not known (never stored, or changed by the member
 * through a reset link before the app could sync it), the new password is
 * queued instead and activates automatically the next time the member logs in
 * with their old one.
 */
export async function adminSetPassword(
  uid: string,
  email: string,
  newPassword: string,
  currentPassword: string,
): Promise<AdminPasswordResult> {
  const next = newPassword.trim();
  if (next.length < 6) throw new Error("Password must be at least 6 characters.");
  const current = currentPassword.trim();
  const mail = email.trim();

  if (!mail) {
    await updateDoc(doc(db, "users", uid), { pendingPassword: next });
    return { status: "queued", reason: "this member has no email address on file." };
  }
  if (!current) {
    await updateDoc(doc(db, "users", uid), { pendingPassword: next });
    return { status: "queued", reason: "their current password is not saved yet." };
  }

  try {
    await swapInThrowawaySession(mail, current, next);
    await updateDoc(doc(db, "users", uid), {
      adminPassword: next,
      pendingPassword: deleteField(),
    });
    return { status: "applied" };
  } catch (err) {
    // The saved current password no longer matches this account (or the
    // network refused). Fall back to the queue so nothing is lost.
    const code = (err as { code?: string } | null)?.code ?? "";
    await updateDoc(doc(db, "users", uid), { pendingPassword: next }).catch(() => {});
    return {
      status: "queued",
      reason: code
        ? `their saved current password was refused (${code}).`
        : "the password change could not be sent.",
    };
  }
}

/**
 * After a successful login (with any password), activate the admin-set
 * password when one is pending. The member is signed in at this point, so
 * reading their own document is allowed by the Firestore rules.
 */
export async function applyPendingPasswordAfterLogin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = snap.data();
    const pending = typeof data?.pendingPassword === "string" ? data.pendingPassword : "";
    if (!pending || !auth.currentUser) return false;
    await updatePassword(auth.currentUser, pending);
    await updateDoc(snap.ref, { adminPassword: pending, pendingPassword: deleteField() });
    return true;
  } catch {
    return false;
  }
}
