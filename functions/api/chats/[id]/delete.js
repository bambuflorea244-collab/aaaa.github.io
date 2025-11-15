import { requireAuth, getAttachmentsMeta } from "../../_utils.js";

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const auth = await requireAuth(env, request);
  if (!auth.ok) return auth.response;

  const chatId = params.id;
  try {
    const attachments = await getAttachmentsMeta(env, chatId);
    for (const a of attachments) {
      try { await env.FILES.delete(a.r2_key); } catch (e) { console.warn("R2 delete failed", a.r2_key, e); }
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM attachments WHERE chat_id=?").bind(chatId),
      env.DB.prepare("DELETE FROM messages WHERE chat_id=?").bind(chatId),
      env.DB.prepare("DELETE FROM chats WHERE id=?").bind(chatId)
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE chat error", err);
    return new Response("Failed to delete chat", { status: 500 });
  }
}
