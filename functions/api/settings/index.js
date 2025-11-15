import { requireAuth, getSetting, setSetting } from "../_utils.js";

export async function onRequestGet(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  try {
    const gemini = await getSetting(env, "gemini_api_key");
    const python = await getSetting(env, "python_anywhere_key");
    return Response.json({ geminiApiKeySet: !!gemini, pythonAnywhereKeySet: !!python });
  } catch (err) {
    console.error("settings GET error", err);
    return new Response("Failed to load settings", { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim())
      await setSetting(env, "gemini_api_key", body.geminiApiKey.trim());
    if (typeof body.pythonAnywhereKey === "string" && body.pythonAnywhereKey.trim())
      await setSetting(env, "python_anywhere_key", body.pythonAnywhereKey.trim());
    return Response.json({ ok: true });
  } catch (err) {
    console.error("settings POST error", err);
    return new Response("Failed to save settings", { status: 500 });
  }
}
