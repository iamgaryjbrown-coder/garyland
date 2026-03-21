import { useState, useRef, useEffect, useCallback } from "react";

const SunCalc = (() => {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const toJulian = d => d.valueOf() / dayMs - 0.5 + J1970, toDays = d => toJulian(d) - J2000;
  const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(23.4397 * rad) - Math.tan(b) * Math.sin(23.4397 * rad), Math.cos(l));
  const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(23.4397 * rad) + Math.cos(b) * Math.sin(23.4397 * rad) * Math.sin(l));
  const azF = (H, p, d) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p));
  const altF = (H, p, d) => Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const sMA = d => (357.5291 + 0.98560028 * d) * rad;
  const eL = M => { const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad; return M + C + 102.9372 * rad + Math.PI; };
  const sT = (d, lw) => (280.16 + 360.9856235 * d) * rad - lw;
  return { getPosition(date, lat, lng) { const lw = -lng * rad, p = lat * rad, d = toDays(date), M = sMA(d), L = eL(M), dc = dec(L, 0), r2 = ra(L, 0), H = sT(d, lw) - r2; return { azimuth: azF(H, p, dc) / rad + 180, altitude: altF(H, p, dc) / rad }; } };
})();

const CATEGORIES = [
  { id: "sun_drink", emoji: "\u2600\uFE0F\uD83C\uDF7A", label: "Drink in the Sun", needsSun: true, prefs: [
    { id: "cask", label: "Cask ales", icon: "\uD83C\uDF7A" }, { id: "craft", label: "Craft beer", icon: "\uD83C\uDF7B" }, { id: "wine", label: "Good wine list", icon: "\uD83C\uDF77" },
    { id: "cocktails", label: "Cocktails", icon: "\uD83C\uDF78" }, { id: "food", label: "Decent food too", icon: "\uD83C\uDF7D\uFE0F" }, { id: "dog", label: "Dog-friendly", icon: "\uD83D\uDC15" },
    { id: "kids", label: "Kid-friendly", icon: "\uD83D\uDC67" }, { id: "garden", label: "Beer garden", icon: "\uD83C\uDF33" }, { id: "terrace", label: "Rooftop / terrace", icon: "\uD83C\uDFD9\uFE0F" },
    { id: "riverside", label: "Riverside / waterside", icon: "\uD83C\uDF0A" }] },
  { id: "sun_eat", emoji: "\u2600\uFE0F\uD83C\uDF7D\uFE0F", label: "Eat in the Sun", needsSun: true, prefs: [
    { id: "casual", label: "Casual / relaxed", icon: "\uD83D\uDE0E" }, { id: "fine", label: "Proper sit-down", icon: "\uD83E\uDE91" }, { id: "brunch", label: "Brunch", icon: "\uD83E\uDD5E" },
    { id: "sunday", label: "Sunday roast", icon: "\uD83E\uDD69" }, { id: "pizza", label: "Pizza / Italian", icon: "\uD83C\uDF55" }, { id: "asian", label: "Asian", icon: "\uD83E\uDD62" },
    { id: "seafood", label: "Seafood", icon: "\uD83E\uDD90" }, { id: "veggie", label: "Veggie / vegan", icon: "\uD83E\uDD57" }, { id: "kids", label: "Kid-friendly", icon: "\uD83D\uDC67" },
    { id: "dog", label: "Dog-friendly", icon: "\uD83D\uDC15" }, { id: "wine", label: "Good wine list", icon: "\uD83C\uDF77" }] },
  { id: "pub", emoji: "\uD83C\uDF7A", label: "Great Pub", needsSun: false, prefs: [
    { id: "cask", label: "Cask ales", icon: "\uD83C\uDF7A" }, { id: "craft", label: "Craft beer", icon: "\uD83C\uDF7B" }, { id: "wine", label: "Good wine list", icon: "\uD83C\uDF77" },
    { id: "cocktails", label: "Cocktails", icon: "\uD83C\uDF78" }, { id: "food", label: "Great pub food", icon: "\uD83C\uDF7D\uFE0F" }, { id: "sunday", label: "Sunday roast", icon: "\uD83E\uDD69" },
    { id: "cosy", label: "Cosy / character", icon: "\uD83E\uDEB5" }, { id: "lively", label: "Lively atmosphere", icon: "\uD83C\uDFB6" }, { id: "quiet", label: "Quiet / date night", icon: "\uD83D\uDD6F\uFE0F" },
    { id: "garden", label: "Beer garden", icon: "\uD83C\uDF33" }, { id: "dog", label: "Dog-friendly", icon: "\uD83D\uDC15" }, { id: "kids", label: "Kid-friendly", icon: "\uD83D\uDC67" },
    { id: "fireplace", label: "Real fireplace", icon: "\uD83D\uDD25" }, { id: "history", label: "Historic / heritage", icon: "\uD83C\uDFDB\uFE0F" }] },
  { id: "eat", emoji: "\uD83C\uDF74", label: "Great Restaurant", needsSun: false, prefs: [
    { id: "casual", label: "Casual", icon: "\uD83D\uDE0E" }, { id: "fine", label: "Fine dining", icon: "\u2728" }, { id: "tasting", label: "Tasting menu", icon: "\uD83C\uDF7D\uFE0F" },
    { id: "brunch", label: "Brunch", icon: "\uD83E\uDD5E" }, { id: "sunday", label: "Sunday roast", icon: "\uD83E\uDD69" }, { id: "italian", label: "Italian", icon: "\uD83C\uDF5D" },
    { id: "asian", label: "Asian", icon: "\uD83E\uDD62" }, { id: "indian", label: "Indian", icon: "\uD83C\uDF5B" }, { id: "seafood", label: "Seafood", icon: "\uD83E\uDD90" },
    { id: "steak", label: "Steak", icon: "\uD83E\uDD69" }, { id: "veggie", label: "Veggie / vegan", icon: "\uD83E\uDD57" }, { id: "wine", label: "Great wine list", icon: "\uD83C\uDF77" },
    { id: "cheap", label: "Budget-friendly", icon: "\uD83D\uDCB0" }, { id: "special", label: "Special occasion", icon: "\uD83C\uDF89" },
    { id: "kids", label: "Kid-friendly", icon: "\uD83D\uDC67" }, { id: "dog", label: "Dog-friendly", icon: "\uD83D\uDC15" }] },
  { id: "stay", emoji: "\uD83C\uDFE8", label: "Somewhere to Stay", needsSun: false, prefs: [
    { id: "boutique", label: "Boutique / design", icon: "\uD83C\uDFA8" }, { id: "budget", label: "Budget", icon: "\uD83D\uDCB0" }, { id: "luxury", label: "Luxury / treat", icon: "\u2728" },
    { id: "cosy", label: "Cosy B&B / guesthouse", icon: "\uD83C\uDFE1" }, { id: "pub_room", label: "Pub with rooms", icon: "\uD83C\uDF7A" },
    { id: "family", label: "Family-friendly", icon: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67" }, { id: "romantic", label: "Romantic", icon: "\u2764\uFE0F" }, { id: "pool", label: "Pool / spa", icon: "\uD83C\uDFCA" },
    { id: "parking", label: "Free parking", icon: "\uD83C\uDD7F\uFE0F" }, { id: "breakfast", label: "Great breakfast", icon: "\uD83E\uDD50" },
    { id: "dog", label: "Dog-friendly", icon: "\uD83D\uDC15" }, { id: "quirky", label: "Quirky / unusual", icon: "\uD83C\uDFF0" }] },
];

const MSGS = {
  sun: ["Checking the beer garden sun angle...", "Scouting outdoor seating via satellite...", "Cross-referencing with the Weather Gods...", "Measuring shadow lengths...", "Interrogating the locals..."],
  gen: ["Interrogating the locals...", "Reading every TripAdvisor rant...", "Consulting the oracle of Google...", "Asking regulars what they'd order...", "Separating the gems from the tourist traps..."],
  stay: ["Checking for lumpy mattresses...", "Sniffing out the boutique from the bland...", "Reading between the 3-star reviews...", "Asking the concierge for the real story...", "Spotting the hidden gems..."],
};

async function geocode(text) {
  try { const r = await fetch("https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(text) + "&format=json&limit=1"); const d = await r.json(); if (d && d[0]) return { lat: +d[0].lat, lng: +d[0].lon }; } catch {}
  return null;
}

async function askClaude(messages) {
  const ctrl = new AbortController(), to = setTimeout(function() { ctrl.abort(); }, 45000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: messages }) });
    clearTimeout(to);
    if (!r.ok) return { error: "API " + r.status };
    const data = await r.json();
    if (data.error) return { error: data.error.message };
    var text = (data.content || []).filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("\n");
    return text ? { text: text } : { error: "No text returned" };
  } catch (e) { clearTimeout(to); return { error: e.name === "AbortError" ? "Timed out" : e.message }; }
}

function parsePlaces(text) {
  if (!text) return null;
  try { var m = text.match(/\{[\s\S]*"places"[\s\S]*\}/); if (m) return JSON.parse(m[0].replace(/```json|```/g, "").trim()); } catch {}
  return null;
}

function svUrl(name, address, apiKey) {
  if (!apiKey) return null;
  return "https://maps.googleapis.com/maps/api/streetview?size=600x300&location=" + encodeURIComponent(name + ", " + address) + "&key=" + apiKey + "&fov=90";
}

function Beetle() {
  return (
    <svg viewBox="0 0 200 200" style={{ width: 180, height: 180, overflow: "visible" }}>
      <defs>
        <linearGradient id="i1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"><animate attributeName="stop-color" values="#22c55e;#06b6d4;#8b5cf6;#f59e42;#22c55e" dur="3s" repeatCount="indefinite"/></stop>
          <stop offset="50%"><animate attributeName="stop-color" values="#06b6d4;#8b5cf6;#f59e42;#22c55e;#06b6d4" dur="3s" repeatCount="indefinite"/></stop>
          <stop offset="100%"><animate attributeName="stop-color" values="#8b5cf6;#f59e42;#22c55e;#06b6d4;#8b5cf6" dur="3s" repeatCount="indefinite"/></stop>
        </linearGradient>
        <linearGradient id="i2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"><animate attributeName="stop-color" values="#f59e42;#ec4899;#06b6d4;#22c55e;#f59e42" dur="2.5s" repeatCount="indefinite"/></stop>
          <stop offset="100%"><animate attributeName="stop-color" values="#ec4899;#06b6d4;#22c55e;#f59e42;#ec4899" dur="2.5s" repeatCount="indefinite"/></stop>
        </linearGradient>
        <radialGradient id="sh" cx="35%" cy="30%" r="60%"><stop offset="0%" stopColor="rgba(255,255,255,0.4)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
      </defs>
      <g style={{ animation: "bW 8s linear infinite" }}>
        <ellipse cx="100" cy="105" rx="28" ry="36" fill="url(#i1)" stroke="#1a1a1a" strokeWidth="1.5"/>
        <line x1="100" y1="72" x2="100" y2="140" stroke="#1a1a1a" strokeWidth="1" opacity="0.6"/>
        <ellipse cx="100" cy="105" rx="28" ry="36" fill="url(#sh)"/>
        <ellipse cx="100" cy="74" rx="18" ry="12" fill="url(#i2)" stroke="#1a1a1a" strokeWidth="1.5"/>
        <ellipse cx="100" cy="60" rx="11" ry="9" fill="#1a1612" stroke="#2a2722" strokeWidth="1"/>
        <circle cx="93" cy="57" r="2.5" fill="#d4a853"/><circle cx="107" cy="57" r="2.5" fill="#d4a853"/>
        <path d="M93 55 Q85 42 78 38" stroke="#3a3632" strokeWidth="1.5" fill="none"/><circle cx="78" cy="38" r="1.5" fill="#555"/>
        <path d="M107 55 Q115 42 122 38" stroke="#3a3632" strokeWidth="1.5" fill="none"/><circle cx="122" cy="38" r="1.5" fill="#555"/>
        <line x1="76" y1="82" x2="60" y2="72" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
        <line x1="74" y1="98" x2="55" y2="95" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
        <line x1="76" y1="114" x2="58" y2="122" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
        <line x1="124" y1="82" x2="140" y2="72" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
        <line x1="126" y1="98" x2="145" y2="95" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
        <line x1="124" y1="114" x2="142" y2="122" stroke="#2a2218" strokeWidth="2" strokeLinecap="round"/>
      </g>
      <style>{"@keyframes bW{0%{transform:translate(0,0)rotate(0)}12%{transform:translate(60px,-30px)rotate(25deg)}25%{transform:translate(40px,-60px)rotate(60deg)}37%{transform:translate(-10px,-40px)rotate(120deg)}50%{transform:translate(-50px,10px)rotate(190deg)}62%{transform:translate(-30px,50px)rotate(240deg)}75%{transform:translate(20px,40px)rotate(300deg)}87%{transform:translate(50px,15px)rotate(340deg)}100%{transform:translate(0,0)rotate(360deg)}}"}</style>
    </svg>
  );
}

function Welcome({ onGo, apiKey, setApiKey }) {
  const [cat, setCat] = useState(null);
  const [prefs, setPrefs] = useState([]);
  const [loc, setLoc] = useState("");
  const [date, setDate] = useState(function() { return new Date().toISOString().split("T")[0]; });
  const [slot, setSlot] = useState(function() { return new Date().getHours() * 4 + Math.floor(new Date().getMinutes() / 15); });
  const [showKey, setShowKey] = useState(false);
  var h = Math.floor(slot / 4), m = (slot % 4) * 15;
  var timeStr = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");

  var doGo = function() {
    if (!loc.trim()) return;
    var dt = null;
    if (cat && cat.needsSun) dt = new Date(date + "T" + timeStr + ":00");
    onGo(cat, loc.trim(), prefs, dt);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 24, background: "linear-gradient(170deg,#0f0e0c 0%,#1a1612 50%,#0f0e0c 100%)", overflowY: "auto" }}>
      <button onClick={function() { setShowKey(!showKey); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: apiKey ? "#22c55e" : "#8a8376", opacity: 0.7 }}>{"⚙️"}</button>
      {showKey && (
        <div style={{ width: "100%", maxWidth: 440, marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(26,25,23,0.9)", border: "1px solid #2a2722" }}>
          <p style={{ fontSize: 12, color: "#8a8376", marginBottom: 6 }}>Google API Key (for Street View photos)</p>
          <input type="password" value={apiKey} onChange={function(e) { setApiKey(e.target.value); }} placeholder="Paste your Google API key..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2722", background: "#1a1917", color: "#e8e2d6", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          {apiKey && <p style={{ fontSize: 11, color: "#22c55e", marginTop: 4 }}>{"✓ Key set"}</p>}
        </div>
      )}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 48 }}>{"🪲"}</div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 42, fontWeight: 900, color: "#f5c542", letterSpacing: -1, lineHeight: 1.1 }}>Gary<span style={{ fontWeight: 300, fontSize: 28, color: "#d4a853" }}>Land</span></h1>
        <p style={{ fontSize: 14, color: "#8a8376" }}>The Brown family's AI-powered place finder</p>
      </div>
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 20 }}>
        <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#e8e2d6", textAlign: "center", marginBottom: 10 }}>What are you after?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {CATEGORIES.map(function(c) { return (
            <button key={c.id} onClick={function() { setCat(c); setPrefs([]); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12,
                border: (cat && cat.id === c.id) ? "2px solid #d4a853" : "2px solid #2a2722",
                background: (cat && cat.id === c.id) ? "rgba(212,168,83,0.1)" : "rgba(26,25,23,0.6)", cursor: "pointer" }}>
              <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{c.emoji}</span>
              <span style={{ fontSize: 14, fontWeight: (cat && cat.id === c.id) ? 600 : 400, color: (cat && cat.id === c.id) ? "#f5c542" : "#c4bdb0" }}>{c.label}</span>
            </button>
          ); })}
        </div>
      </div>
      {cat && (
        <>
          <div style={{ width: "100%", maxWidth: 440, marginBottom: 20 }}>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#e8e2d6", textAlign: "center", marginBottom: 10 }}>What matters to you?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {cat.prefs.map(function(p) { var on = prefs.indexOf(p.id) >= 0; return (
                <button key={p.id} onClick={function() { setPrefs(function(prev) { return on ? prev.filter(function(x) { return x !== p.id; }) : prev.concat([p.id]); }); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 20,
                    border: on ? "1.5px solid #d4a853" : "1.5px solid #2a2722", background: on ? "rgba(212,168,83,0.15)" : "rgba(26,25,23,0.6)", cursor: "pointer" }}>
                  <span style={{ fontSize: 14 }}>{p.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: on ? 600 : 400, color: on ? "#f5c542" : "#8a8376" }}>{p.label}</span>
                </button>
              ); })}
            </div>
            <p style={{ fontSize: 11, color: "#555", textAlign: "center", marginTop: 8 }}>{prefs.length ? prefs.length + " selected" : "Pick any — or skip"}</p>
          </div>
          {cat.needsSun && (
            <div style={{ width: "100%", maxWidth: 440, marginBottom: 20 }}>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#e8e2d6", textAlign: "center", marginBottom: 10 }}>When?</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <input type="date" value={date} onChange={function(e) { setDate(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #2a2722", background: "rgba(26,25,23,0.8)", color: "#e8e2d6", fontSize: 14, outline: "none", colorScheme: "dark" }} />
                <div style={{ padding: "10px 18px", borderRadius: 10, border: "2px solid #d4a853", background: "rgba(212,168,83,0.1)", fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700, color: "#f5c542", minWidth: 70, textAlign: "center" }}>{timeStr}</div>
              </div>
              <input type="range" min="0" max="95" value={slot} onChange={function(e) { setSlot(+e.target.value); }} style={{ width: "100%", accentColor: "#d4a853" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 2 }}><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:45</span></div>
            </div>
          )}
          <div style={{ width: "100%", maxWidth: 440, marginBottom: 20 }}>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#e8e2d6", textAlign: "center", marginBottom: 10 }}>Where?</p>
            <input type="text" value={loc} onChange={function(e) { setLoc(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") doGo(); }}
              placeholder="City, neighbourhood, or postcode..." style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid #2a2722", background: "rgba(26,25,23,0.8)", color: "#e8e2d6", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={doGo} disabled={!loc.trim()} style={{ padding: "14px 44px", borderRadius: 14, border: "none",
            background: loc.trim() ? "linear-gradient(135deg,#d4a853,#f5c542)" : "#2a2722", color: loc.trim() ? "#0f0e0c" : "#555",
            fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700, cursor: loc.trim() ? "pointer" : "default", marginBottom: 32 }}>
            Find me somewhere brilliant
          </button>
        </>
      )}
    </div>
  );
}

function Loading({ cat, error, onBack }) {
  var msgs = (cat && cat.needsSun) ? MSGS.sun : (cat && cat.id === "stay") ? MSGS.stay : MSGS.gen;
  const [mi, setMi] = useState(0);
  const [sec, setSec] = useState(0);
  useEffect(function() { var iv = setInterval(function() { setMi(function(i) { return (i + 1) % msgs.length; }); }, 2200); return function() { clearInterval(iv); }; }, []);
  useEffect(function() { if (error) return; var iv = setInterval(function() { setSec(function(s) { return s + 1; }); }, 1000); return function() { clearInterval(iv); }; }, [error]);

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#0f0e0c" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{"🪲"}</div>
      <p style={{ fontFamily: "'Fraunces',serif", fontSize: 20, color: "#ef4444", marginBottom: 8 }}>Hit a snag</p>
      <p style={{ fontSize: 14, color: "#8a8376", textAlign: "center", maxWidth: 360, marginBottom: 24, lineHeight: 1.5 }}>{error}</p>
      <button onClick={onBack} style={{ padding: "12px 28px", borderRadius: 10, border: "2px solid #d4a853", background: "transparent", color: "#d4a853", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#0f0e0c" }}>
      <Beetle />
      <p style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: "#f5c542", textAlign: "center", marginTop: 16 }}>{msgs[mi]}</p>
      <p style={{ fontSize: 14, color: "#6b6560", textAlign: "center", marginTop: 4 }}>{"Searching for " + (cat ? cat.label.toLowerCase() : "") + "..."}</p>
      <p style={{ fontSize: 12, color: "#4a4540", textAlign: "center", marginTop: 16 }}>{sec + "s — usually 15-30s"}</p>
    </div>
  );
}

function Card({ place, index, sunAlt, apiKey, onChat }) {
  const [imgOk, setImgOk] = useState(true);
  var rc = place.rating >= 8 ? "#22c55e" : place.rating >= 6 ? "#f5c542" : place.rating >= 4 ? "#f59e42" : "#ef4444";
  var sv = svUrl(place.name, place.address, apiKey);

  return (
    <div style={{ background: "rgba(26,25,23,0.9)", borderRadius: 16, border: "1px solid #2a2722", overflow: "hidden", animation: "fadeIn 0.4s ease-out " + (index * 0.1) + "s both" }}>
      {sv && imgOk && (
        <img src={sv} alt={place.name} onError={function() { setImgOk(false); }} referrerPolicy="no-referrer"
          style={{ width: "100%", height: 180, objectFit: "cover", display: "block", borderBottom: "1px solid #2a2722" }} />
      )}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700, color: "#e8e2d6", margin: "0 0 4px" }}>{place.name}</h3>
            <p style={{ fontSize: 13, color: "#8a8376", margin: 0 }}>{place.address}</p>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: rc + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 12 }}>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: rc }}>{place.rating}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {place.price_level && <span style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(212,168,83,0.1)", color: "#d4a853", fontSize: 12, fontWeight: 600 }}>{place.price_level}</span>}
          {place.sun_verdict && <span style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(245,197,66,0.1)", color: "#f5c542", fontSize: 12, fontWeight: 500 }}>{"☀️ " + place.sun_verdict}</span>}
        </div>
        <p style={{ fontSize: 14, color: "#c4bdb0", lineHeight: 1.55, marginBottom: 12 }}>{place.summary}</p>
        {place.highlights && place.highlights.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {place.highlights.map(function(h, i) { return <span key={i} style={{ padding: "3px 9px", borderRadius: 6, background: "#1f1e1b", border: "1px solid #2a2722", color: "#8a8376", fontSize: 12 }}>{h}</span>; })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={function() { onChat(place); }} style={{ flex: 1, padding: "11px 16px", borderRadius: 10, border: "2px solid #d4a853", background: "transparent", color: "#d4a853", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{"💬 Tell me more"}</button>
          <button onClick={function() { window.open("https://www.google.com/maps/search/" + encodeURIComponent(place.name + " " + place.address), "_blank"); }}
            style={{ padding: "11px 16px", borderRadius: 10, border: "2px solid #2a2722", background: "transparent", color: "#8a8376", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{"🗺️"}</button>
        </div>
      </div>
    </div>
  );
}

function Results({ data, cat, loc, sun, apiKey, onBack, onChat }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f0e0c", paddingBottom: 32 }}>
      <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 100, background: "rgba(15,14,12,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(42,39,34,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 500, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#d4a853", fontSize: 22, cursor: "pointer" }}>{"←"}</button>
          <div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, color: "#e8e2d6", margin: 0 }}>{cat.emoji + " " + cat.label}</h2>
            <p style={{ fontSize: 13, color: "#8a8376", margin: 0 }}>{loc + " · " + (data.places || []).length + " found" + (sun && sun.altitude > 0 ? " · Sun " + sun.altitude.toFixed(0) + "°" : "")}</p>
          </div>
        </div>
      </div>
      {data.weather && (
        <div style={{ maxWidth: 500, margin: "16px auto 0", padding: "12px 18px", borderRadius: 12, background: "rgba(245,197,66,0.06)", border: "1px solid rgba(245,197,66,0.15)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>{data.weather.cloud_cover > 70 ? "☁️" : data.weather.cloud_cover > 30 ? "⛅" : "☀️"}</span>
          <div>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 16, color: "#f5c542", margin: 0 }}>{data.weather.temp + "°C · " + data.weather.description}</p>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 500, margin: "16px auto 0", padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {(data.places || []).map(function(p, i) { return <Card key={i} place={p} index={i} sunAlt={cat.needsSun && sun ? sun.altitude : null} apiKey={apiKey} onChat={onChat} />; })}
      </div>
      <style>{"@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}"}</style>
    </div>
  );
}

function Chat({ place, cat, loc, sun, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  useEffect(function() { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);

  var send = async function() {
    if (!input.trim() || loading) return;
    var txt = input.trim(); setInput(""); setMsgs(function(prev) { return prev.concat([{ r: "u", t: txt }]); }); setLoading(true);
    var sys = 'You are GaryLand\'s AI concierge. Knowledgeable, opinionated, warm, British humour. Chatting about "' + place.name + '" at ' + place.address + ' near ' + loc + '. ' + (sun ? 'Sun: alt ' + sun.altitude.toFixed(1) + ' az ' + sun.azimuth.toFixed(0) + '.' : '') + ' Context: ' + place.summary + '\n\nIMPORTANT: You CANNOT display images. If asked, say so briefly and give: https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(place.name + ' ' + place.address) + '\n\nKeep under 150 words.';
    var apiMsgs = [{ role: "user", content: sys }, { role: "assistant", content: "Happy to chat about " + place.name + "!" }];
    msgs.forEach(function(m) { apiMsgs.push({ role: m.r === "u" ? "user" : "assistant", content: m.t }); });
    apiMsgs.push({ role: "user", content: txt });
    var resp = await askClaude(apiMsgs);
    setMsgs(function(prev) { return prev.concat([{ r: "a", t: resp.error ? "Sorry: " + resp.error : (resp.text || "Something went wrong.") }]); }); setLoading(false);
  };

  var bub = function(r) { return { alignSelf: r === "u" ? "flex-end" : "flex-start", maxWidth: "85%", padding: "12px 16px",
    borderRadius: r === "u" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
    background: r === "u" ? "rgba(212,168,83,0.15)" : "#1a1917", border: r === "u" ? "1px solid rgba(212,168,83,0.3)" : "1px solid #2a2722",
    fontSize: 14, color: r === "u" ? "#e8e2d6" : "#c4bdb0", lineHeight: 1.5, whiteSpace: "pre-wrap" }; };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f0e0c", display: "flex", flexDirection: "column", zIndex: 1000 }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2722", display: "flex", alignItems: "center", gap: 12, background: "rgba(26,25,23,0.95)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#d4a853", fontSize: 22, cursor: "pointer" }}>{"←"}</button>
        <div><h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#e8e2d6", margin: 0 }}>{place.name}</h3><p style={{ fontSize: 12, color: "#8a8376", margin: 0 }}>{place.address}</p></div>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={bub("a")}>{"Ask me anything about " + place.name + " — outdoor seating, food, Sunday roasts, whatever. 🪲"}</div>
        {msgs.map(function(m, i) { return <div key={i} style={bub(m.r)}>{m.t}</div>; })}
        {loading && <div style={bub("a")}><span style={{ color: "#d4a853" }}>Thinking...</span></div>}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #2a2722", display: "flex", gap: 8, background: "rgba(26,25,23,0.95)", paddingBottom: "max(12px,env(safe-area-inset-bottom))" }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") send(); }} placeholder="Ask about this place..."
          style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "2px solid #2a2722", background: "#1a1917", color: "#e8e2d6", fontSize: 14, outline: "none" }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: input.trim() ? "#d4a853" : "#2a2722", color: input.trim() ? "#0f0e0c" : "#555", fontSize: 14, fontWeight: 700, cursor: input.trim() ? "pointer" : "default" }}>Send</button>
      </div>
    </div>
  );
}

export default function GaryLand() {
  const [screen, setScreen] = useState("welcome");
  const [cat, setCat] = useState(null);
  const [loc, setLoc] = useState("");
  const [sun, setSun] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [chatPlace, setChatPlace] = useState(null);
  const [apiKey, setApiKey] = useState("");

  var handleGo = useCallback(async function(category, location, prefs, dateTime) {
    setCat(category); setLoc(location); setError(null); setScreen("loading");
    var s = null;
    if (category.needsSun) {
      var geo = await geocode(location);
      if (geo) { s = SunCalc.getPosition(dateTime || new Date(), geo.lat, geo.lng); setSun(s); }
    } else { setSun(null); }

    var prefLabels = prefs.map(function(id) { var p = category.prefs.find(function(p) { return p.id === id; }); return p ? p.label : null; }).filter(Boolean);
    var prefStr = prefLabels.length ? "\nUser wants: " + prefLabels.join(", ") + ". Prioritise matches." : "";
    var sunCtx = s ? "\nSun at " + location + ": alt " + s.altitude.toFixed(1) + " (" + (s.altitude < 0 ? "dark" : s.altitude < 6 ? "golden hour" : s.altitude < 20 ? "low sun" : "good sun") + "), az " + s.azimuth.toFixed(0) + "." : "";
    var sunInst = category.needsSun ? '\nSun-seeking: check outdoor seating, direction. Include "sun_verdict" field.' : "";
    var wb = category.needsSun ? '"weather":{"temp":<celsius>,"description":"<short>","cloud_cover":<percent>},' : "";
    var catDesc = { sun_drink: "pubs/bars with outdoor seating", sun_eat: "restaurants with outdoor dining", pub: "pubs", eat: "restaurants", stay: "places to stay" }[category.id];

    var prompt = 'Find 4-5 best ' + catDesc + ' near "' + location + '".' + prefStr + sunCtx + sunInst + '\n\nDo 1-2 web searches, return ONLY JSON:\n{' + wb + '"places":[{"name":"<real>","address":"<real>","rating":<1-10>,"summary":"<1-2 sentences>"' + (category.needsSun ? ',"sun_verdict":"<assessment>"' : '') + ',"highlights":["<tag>","<tag>","<tag>"],"google_maps_query":"<name+area>","price_level":"<£-££££>"}]}\n\nBe opinionated. Knowledgeable friend voice.';

    var resp = await askClaude([{ role: "user", content: prompt }]);
    if (resp.error) { setError(resp.error); return; }
    var parsed = parsePlaces(resp.text);
    if (parsed) { setResults(parsed); setScreen("results"); }
    else { setError("Couldn't parse results"); }
  }, []);

  return (
    <div style={{ background: "#0f0e0c", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,700;9..144,800;9..144,900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      {screen === "welcome" && <Welcome onGo={handleGo} apiKey={apiKey} setApiKey={setApiKey} />}
      {screen === "loading" && <Loading cat={cat} error={error} onBack={function() { setScreen("welcome"); setError(null); }} />}
      {screen === "results" && results && <Results data={results} cat={cat} loc={loc} sun={sun} apiKey={apiKey} onBack={function() { setScreen("welcome"); }} onChat={setChatPlace} />}
      {chatPlace && <Chat place={chatPlace} cat={cat} loc={loc} sun={sun} onClose={function() { setChatPlace(null); }} />}
    </div>
  );
}
