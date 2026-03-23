// GaryLand API Proxy — Cloudflare Worker (v2: Spud backend)
// All requests go to OpenClaw (real Spud with memory, context, web search).
// Response is translated back to Anthropic format so the frontend barely changes.
//
// Secrets needed (set via `npx wrangler secret put`):
//   OPENCLAW_TOKEN  — gateway bearer token
//   OPENCLAW_URL    — e.g. https://srv1400772.tail2f9653.ts.net
//
// Deploy: npx wrangler deploy

export default {
  async fetch(request, env) {
    // ── CORS preflight ──
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

    // ── Build OpenResponses request ──
    const input = [];

    // System prompt → developer message (appended to Spud's bootstrap context)
    if (body.system) {
      input.push({ type: "message", role: "developer", content: body.system });
    }

    // Chat messages
    if (body.messages) {
      for (const msg of body.messages) {
        input.push({ type: "message", role: msg.role, content: msg.content });
      }
    }

    const ocBody = {
      model: "openclaw",
      input: input,
      user: "garyland",
    };

    let resp;
    try {
      resp = await fetch("https://srv1400772.tail2f9653.ts.net/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer be488a5eec63eb481f31ad491c7dd94d5e254441aac9d1fa",
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

    // Handle OpenClaw errors
    if (ocData.error) {
      return corsJson({
        content: [{ type: "text", text: "Spud error: " + (ocData.error.message || JSON.stringify(ocData.error)) }],
        role: "assistant",
      });
    }

    // Extract text from OpenResponses format
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

    // Return in Anthropic format (frontend expects this shape)
    return corsJson({
      content: [{ type: "text", text: text }],
      model: "openclaw",
      role: "assistant",
    });
  },
};

function corsJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
