import { requireAuth } from "../../_utils.js";

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, chat_id, name, mime_type, created_at FROM attachments WHERE chat_id=? ORDER BY created_at ASC"
    ).bind(chatId).all();
    return Response.json(results || []);
  } catch (err) {
    console.error("GET attachments error", err);
    return new Response("Failed to load attachments", { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return new Response("No file", { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const key = `${chatId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
    await env.FILES.put(key, arrayBuffer);

    await env.DB.prepare(
      "INSERT INTO attachments (chat_id, name, mime_type, r2_key, created_at) VALUES (?, ?, ?, ?, strftime('%s','now'))"
    ).bind(chatId, file.name, file.type || "application/octet-stream", key).run();

    const row = await env.DB.prepare(
      "SELECT id, chat_id, name, mime_type, created_at FROM attachments WHERE chat_id=? AND r2_key=?"
    ).bind(chatId, key).first();

    return Response.json(row);
  } catch (err) {
    console.error("POST attachments error", err);
    return new Response("Failed to upload attachment", { status: 500 });
  }
}
