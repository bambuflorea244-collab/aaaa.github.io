export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const password = (body.password || "").toString();
  const master = env.MASTER_PASSWORD;

  if (!master) {
    return new Response(JSON.stringify({ error: "MASTER_PASSWORD missing in environment." }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  if (password !== master) {
    return new Response(JSON.stringify({ error: "Invalid password." }), {
      status: 401, headers: { "Content-Type": "application/json" }
    });
  }

  const token = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24 * 90; // 90 days

  await env.DB.prepare(
    "INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
  ).bind(token, now, expires).run();

  return new Response(JSON.stringify({ token }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}
