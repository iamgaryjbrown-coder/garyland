// GaryLand API Proxy — Cloudflare Worker (v3: session isolation)
// Secrets: OPENCLAW_TOKEN, OPENCLAW_URL (set via wrangler secret put)

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
    const input = [];

    if (body.system) {
      input.push({ type: "message", role: "developer", content: body.system });
    }

    if (body.messages) {
      for (const msg of body.messages) {
        input.push({ type: "message", role: msg.role, content: msg.content });
      }
    }

    // Use sessionId from frontend if provided, fall back to "garyland"
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
