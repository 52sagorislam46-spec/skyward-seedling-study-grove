// Shared answer for "the API key this feature needs has not been saved yet".
//
// Plain text, not JSON, because the streaming chat/diagnosis callers read the
// body with res.text() and would otherwise show raw JSON to the user.
// 503 (Service Unavailable), not 500, because nothing crashed: the feature is
// deliberately switched off until its key exists, and a 500 is what the
// preview's error pipeline reports as a server failure that blanks the screen.

export const AI_NOT_CONFIGURED =
  "AI এখন চলছে না — দয়া করে একটু পরে আবার চেষ্টা করুন। (AI is not configured yet.)";

export const aiNotConfigured = () =>
  new Response(AI_NOT_CONFIGURED, { status: 503 });

export const aiNotConfiguredJson = () =>
  Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });
