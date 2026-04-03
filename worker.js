// GaryLand API Proxy — Cloudflare Worker (v5: + KV favourites sync)
// Secrets: OPENCLAW_TOKEN, OPENCLAW_URL, ANTHROPIC_KEY (set via wrangler secret put)
// KV: FAVS namespace bound in wrangler.toml
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // ── Favourites API ──
    if (path === "/favourites") {
      if (request.method === "GET") return handleKvGet(url, env, "fav");
      if (request.method === "PUT") return handleKvPut(request, env, "fav");
      return corsJson({ error: "Method not allowed" }, 405);
    }

    // ── Benches API ──
    if (path === "/benches") {
      if (request.method === "GET") return handleKvGet(url, env, "bench");
      if (request.method === "PUT") return handleKvPut(request, env, "bench");
      return corsJson({ error: "Method not allowed" }, 405);
    }

    // ── Sync: create link code ──
    if (path === "/sync/create" && request.method === "POST") {
      return handleSyncCreate(request, env);
    }

    // ── Sync: link device ──
    if (path === "/sync/link" && request.method === "POST") {
      return handleSyncLink(request, env);
    }

    // ── Existing chat API (POST only) ──
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();

    if (body.sessionId && body.sessionId.startsWith("venue-")) {
      return handleVenueDirect(body, env);
    }

    return handleOpenClaw(body, env);
  },
};

// ═══════════════════════════════════════
// Generic KV storage (favourites + benches)
// ═══════════════════════════════════════
async function handleKvGet(url, env, prefix) {
  const token = url.searchParams.get("token");
  if (!token) return corsJson({ error: "Missing token" }, 400);
  const data = await env.FAVS.get(prefix + ":" + token);
  return corsJson({ data: data ? JSON.parse(data) : [] });
}

async function handleKvPut(request, env, prefix) {
  const body = await request.json();
  if (!body.token) return corsJson({ error: "Missing token" }, 400);
  await env.FAVS.put(prefix + ":" + body.token, JSON.stringify(body.data || []));
  return corsJson({ ok: true });
}

// ═══════════════════════════════════════
// Sync — link devices
// ═══════════════════════════════════════
async function handleSyncCreate(request, env) {
  const body = await request.json();
  if (!body.token) return corsJson({ error: "Missing token" }, 400);
  // Generate 6-char alphanumeric code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  // Store code → token mapping, expires in 10 minutes
  await env.FAVS.put("sync:" + code, body.token, { expirationTtl: 600 });
  return corsJson({ code });
}

async function handleSyncLink(request, env) {
  const body = await request.json();
  if (!body.code) return corsJson({ error: "Missing code" }, 400);
  const code = body.code.toUpperCase().trim();
  const token = await env.FAVS.get("sync:" + code);
  if (!token) return corsJson({ error: "Invalid or expired code" }, 404);
  // Clean up used code
  await env.FAVS.delete("sync:" + code);
  return corsJson({ token });
}

// ═══════════════════════════════════════
// Venue chat: direct Anthropic
// ═══════════════════════════════════════
async function handleVenueDirect(body, env) {
  const messages = body.messages || [];
  const system = body.system || "";

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: system,
        messages: messages,
      }),
    });
  } catch (err) {
    return corsJson({
      content: [{ type: "text", text: "Venue fetch error: " + String(err) }],
      role: "assistant",
    });
  }

  const data = await resp.json();

  if (data.error) {
    return corsJson({
      content: [{ type: "text", text: "Error: " + (data.error.message || JSON.stringify(data.error)) }],
      role: "assistant",
    });
  }

  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
  return corsJson({ content: [{ type: "text", text }], role: "assistant" });
}

// ═══════════════════════════════════════
// Freeform chat: OpenClaw
// ═══════════════════════════════════════
async function handleOpenClaw(body, env) {
  const input = [];

  if (body.system) {
    input.push({ type: "message", role: "developer", content: body.system });
  }

  if (body.messages) {
    for (const msg of body.messages) {
      input.push({ type: "message", role: msg.role, content: msg.content });
    }
  }

  const sessionUser = body.sessionId || "garyland";

  const ocBody = {
    model: "openclaw",
    input: input,
    user: sessionUser,
  };

  let resp;
  try {
    resp = await fetch(`${env.OPENCLAW_URL}/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENCLAW_TOKEN}`,
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify(ocBody),
    });
  } catch (err) {
    return corsJson({
      content: [{ type: "text", text: "Spud fetch error: " + String(err) }],
      role: "assistant",
    });
  }

  const ocData = await resp.json();

  if (ocData.error) {
    return corsJson({
      content: [{ type: "text", text: "Spud error: " + (ocData.error.message || JSON.stringify(ocData.error)) }],
      role: "assistant",
    });
  }

  let text = "";
  if (ocData.output) {
    for (const item of ocData.output) {
      if (item.type === "message" && item.content) {
        for (const block of item.content) {
          if (block.type === "output_text") {
            text += block.text;
          }
        }
      }
    }
  }

  return corsJson({
    content: [{ type: "text", text }],
    model: "openclaw",
    role: "assistant",
  });
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
