// GaryLand API Proxy — Cloudflare Worker (v4: direct Anthropic for venue chat)
// Secrets: OPENCLAW_TOKEN, OPENCLAW_URL, ANTHROPIC_KEY (set via wrangler secret put)
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();

    // Venue chat: bypass OpenClaw entirely, call Anthropic direct
    // Keeps venue Q&A clean — no GBVFX bootstrap, no stale session history
    if (body.sessionId && body.sessionId.startsWith("venue-")) {
      return handleVenueDirect(body, env);
    }

    return handleOpenClaw(body, env);
  },
};

// ── Venue chat: direct Anthropic (Sonnet), stateless, no bootstrap ──
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

// ── Freeform chat / place search: OpenClaw (Spud does web search etc.) ──
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

function corsJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}