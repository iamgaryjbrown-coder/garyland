// GaryLand API Proxy — Cloudflare Worker (v7: direct Anthropic + web search)
// Secrets: ANTHROPIC_KEY (set via wrangler secret put)
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

    return handleClaude(body, env, request.headers.get("Origin") || "");
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
// Chat: direct Anthropic, with live web search
// ═══════════════════════════════════════
const CLAUDE_MODEL = "claude-sonnet-4-6";
const MAX_CONTINUATIONS = 3; // extra requests allowed when the API pauses a long search turn
const MAX_SOURCES = 5;
const MAX_TOKENS_CAP = 4000; // the page sends 2500; stops anyone asking for more
// Web search is only switched on for the chat screens, and only from the live page.
// The main venue search ("garyland-search") must return bare JSON, so it never gets the tool.
const WEB_SEARCH_ORIGINS = ["https://iamgaryjbrown-coder.github.io"];
function wantsWebSearch(sessionId, origin) {
  if (!WEB_SEARCH_ORIGINS.includes(origin)) return false;
  return sessionId === "garyland-chat" || (typeof sessionId === "string" && sessionId.startsWith("venue-"));
}
const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
  allowed_callers: ["direct"], // plain search: no code-execution container to carry across pause_turn
  user_location: { type: "approximate", country: "GB" },
};

// Added to every system prompt the page sends, so the fix needs only a Worker deploy.
function webSearchNote(now = new Date()) {
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
  });
  return "Today is " + today + " (UK time). You have a web_search tool, so you can look things up on the internet. " +
    "Use it whenever the answer depends on live or changeable facts: opening hours, menus and prices, booking and availability, " +
    "events, recent reviews, or whether a place is still trading. If the user asks you to look something up, search; never say you cannot. " +
    "When you used a search, say so briefly (for example \"I looked this up:\") and add one short line that hours and menus can change, " +
    "so it is worth checking with the venue before going. Do not write URLs yourself; the app adds the sources.";
}

function chatReply(text) {
  return corsJson({ content: [{ type: "text", text }], role: "assistant" });
}

async function handleClaude(body, env, origin = "") {
  const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  const pageSystem = typeof body.system === "string" ? body.system : "";
  const search = wantsWebSearch(body.sessionId, origin);
  const system = search ? (pageSystem ? pageSystem + "\n\n" : "") + webSearchNote() : pageSystem;
  const max_tokens = Math.min(Math.max(parseInt(body.max_tokens, 10) || 2500, 1), MAX_TOKENS_CAP);

  const content = []; // assistant content gathered across pause_turn rounds
  let data = null;

  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    // After a pause, re-send with the partial assistant turn last; the API resumes it.
    const reqMessages = content.length ? messages.concat([{ role: "assistant", content }]) : messages;
    let resp;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(Object.assign(
          { model: CLAUDE_MODEL, max_tokens: max_tokens, system: system, messages: reqMessages },
          search ? { tools: [WEB_SEARCH_TOOL] } : {}
        )),
      });
    } catch (err) {
      return chatReply("Claude fetch error: " + String(err));
    }

    try {
      data = await resp.json();
    } catch (err) {
      return chatReply("Error: Claude returned an unreadable reply (HTTP " + resp.status + ").");
    }

    if (data.error || !resp.ok) {
      const e = data.error || {};
      return chatReply("Error: " + (e.message || JSON.stringify(data.error || data) || ("HTTP " + resp.status)));
    }

    if (data.stop_reason === "refusal") {
      return chatReply("Sorry, I can't help with that one.");
    }

    if (Array.isArray(data.content)) content.push(...data.content);
    if (data.stop_reason !== "pause_turn") break;
  }

  return chatReply(buildReplyText(content, data && data.stop_reason));
}

// Text blocks: adjacent ones joined with "" (citations split one sentence into
// several blocks); a paragraph break where a search sat between them.
// Then a short Sources list from the citations.
function joinText(content) {
  let out = "";
  let gap = false;
  for (const b of content) {
    if (b.type !== "text") { gap = true; continue; }
    const t = b.text || "";
    if (gap && out.trim() && t.trim()) out = out.replace(/\s+$/, "") + "\n\n" + t.replace(/^\s+/, "");
    else out += t;
    gap = false;
  }
  return out.trim();
}

const EMPTY_REPLY = "Sorry, I couldn't finish that answer. Try asking again?";

function buildReplyText(content, stopReason) {
  let text = joinText(content);

  const searchErrors = content
    .filter(b => b.type === "web_search_tool_result" && b.content && !Array.isArray(b.content))
    .map(b => b.content.error_code || "unknown");

  if (!text) {
    if (stopReason === "pause_turn") return "That search took too long. Try asking again?";
    if (searchErrors.length) return "Live search isn't working right now (" + searchErrors[0] + "). Try again in a minute?";
    return EMPTY_REPLY;
  }

  if (stopReason === "max_tokens") text += "\n\n(Reply cut short.)";
  if (stopReason === "pause_turn") text += "\n\n(Search ran long, so this may be incomplete.)";

  const sources = collectSources(content);
  if (sources.length) {
    text += "\n\nSources:\n" + sources.map(s => s.title + " " + s.url).join("\n");
  }
  return text;
}

function collectSources(content) {
  const seen = new Set();
  const out = [];
  for (const b of content) {
    if (b.type !== "text" || !Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      const url = c && c.url;
      if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      // Braces stripped so a source title can't break the Go Rogue JSON detector.
      let title = String(c.title || "").replace(/[{}\s]+/g, " ").trim();
      if (!title) { try { title = new URL(url).hostname; } catch (e) { title = "Link"; } }
      if (title.length > 70) title = title.slice(0, 67) + "...";
      out.push({ title, url });
      if (out.length >= MAX_SOURCES) return out;
    }
  }
  return out;
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
