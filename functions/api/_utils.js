export async function requireAuth(env, request) {
  const authHeader = request.headers.get("Authorization") || "";
  const parts = authHeader.split(" ");
  const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;

  if (!token) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const session = await env.DB.prepare(
      "SELECT token, created_at, expires_at FROM sessions WHERE token=? AND expires_at > ?"
    ).bind(token, now).first();

    if (!session) {
      return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
    }
    return { ok: true, session };
  } catch (err) {
    console.error("requireAuth error", err);
    return { ok: false, response: new Response("Internal error", { status: 500 }) };
  }
}

export async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  return row ? row.value : null;
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, strftime('%s','now'), strftime('%s','now')) " +
    "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=strftime('%s','now')"
  ).bind(key, value).run();
}

export async function getAttachmentsMeta(env, chatId) {
  const { results } = await env.DB.prepare(
    "SELECT id, chat_id, name, mime_type, r2_key, created_at FROM attachments WHERE chat_id=? ORDER BY created_at ASC"
  ).bind(chatId).all();
  return results || [];
}

export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
