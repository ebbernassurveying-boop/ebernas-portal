// api/ai.js — Vercel Serverless Function (Anthropic / Claude)
// ─────────────────────────────────────────────────────────────────────────────
// Tulay ng portal papuntang Claude. Ang API key ay NANDITO LANG sa server —
// hindi kailanman naaabot ng browser.
//
// KAILANGAN sa Vercel → Settings → Environment Variables:
//   ANTHROPIC_API_KEY = <ang key mo>                 (required)
//   ANTHROPIC_MODEL   = claude-haiku-4-5-20251001    (optional — default na ito)
//
// Tungkol sa model: Haiku ang default — mabilis at pinakamura, sapat na sa
// paghahanap ng status sa datos. Kung gusto mo ng mas matalino para sa
// mahihirap na tanong, palitan ang ANTHROPIC_MODEL ng "claude-sonnet-5".
//
// PHASE 3: May `context` na ngayon — plain text na gawa ng
// src/components/ai/aiContext.js sa browser. Naka-pili na 'yon (tugmang cases,
// counters, schedules) kaya hindi na kailangang mag-query dito.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_CHARS = 4000;      // hangganan ng haba ng tanong
const MAX_HISTORY = 12;      // ilang naunang mensahe ang ipapadala
const MAX_CONTEXT = 20000;   // hangganan ng haba ng datos ng portal

const SYSTEM_PROMPT = `Ikaw ang "Bernas AI Assistant" ng E.B. Bernas Land Consultancy —
isang land surveying at geodetic engineering firm sa Bani, Pangasinan na pag-aari ni
Engr. Eugene Benedict C. Bernas (Geodetic Engineer, PRC Lic. No. 8835).

Ang trabaho mo: tumulong sa mga tanong tungkol sa operasyon ng kompanya — schedules,
survey cases, employees, finance, at reports.

Paano sumagot:
- Sumagot sa Taglish (halo ng Tagalog at English), gaya ng usapan sa opisina.
- Maikli at diretso. Huwag magpahaba kung hindi kailangan.
- Kung wala kang sapat na datos para sagutin, sabihin mo nang tapat — huwag manghula
  ng pangalan, petsa, numero, o status ng kaso.
- Ikaw ay katulong, hindi kapalit ng propesyonal na paghuhusga ng lisensyadong
  Geodetic Engineer. Sa mga teknikal o legal na desisyon, sabihing kailangang
  i-verify ni Engr. Bernas.`;

const CONTEXT_RULES = `Kasama sa ibaba ang LIVE na datos ng portal, pinili base sa tinanong.

Mahahalagang tuntunin sa paggamit ng datos:
- Sagutin LANG mula sa datos na nasa ibaba. Ito ang tanging pinagkukunan mo.
- Kung sinabi ng datos na WALANG tugmang case, sabihin mo iyon nang diretso. HUWAG
  gumawa ng pangalan, status, Trans ID, o petsa na wala sa listahan.
- Kapag may ipinakitang "Mga step", gamitin iyon para ipaliwanag kung nasaan na ang
  kaso at ano ang susunod na dapat gawin.
- Kahulugan ng status:
    • On Process = nasimulan na (tapos na ang unang step) pero hindi pa kumpleto,
      at walang hinihintay na aksyon mula sa opisina.
    • Pending = may hinihintay na aksyon — ang remarks ng DENR Region I ay
      Pending / For Compliance / For Resubmission, o may naka-tala na dahilan.
    • Done = kumpleto na LAHAT ng steps.
    • Hindi pa na-survey = hindi pa tapos ang unang step (Survey Done).
- SCHEDULES — dito madalas ang mali, basahin nang mabuti:
    • May nakasulat na EKSAKTONG date range para sa "ngayon", "bukas", "ngayong
      linggo", at "susunod na linggo". Iyon ang sundin — huwag kang magbilang
      o manghula ng sarili mong petsa.
    • Naka-hiwalay na ang mga bucket. Kung "next week" ang tanong, ang bucket na
      "SUSUNOD NA LINGGO" LANG ang sagutin. Huwag hahakutin ang laman ng ibang
      bucket kahit malapit ang petsa.
    • Kung 0 ang bilang ng hinihinging bucket, sabihin nang diretso: WALA.
      HUWAG mo itong palitan ng ibang petsa mapasagot ka lang. Mas mabuti nang
      "walang schedule next week" kaysa maling sagot.
    • Pwede kang magdagdag ng maikling paalala pagkatapos (hal. "pero may 2 sa
      Sabado, Jul 18") — basta't malinaw na hiwalay iyon sa tinanong.
- Kung marami ang tugma (hal. maraming lot ng iisang client), banggitin lahat nang
  maikli at itanong kung alin ang tinutukoy.
- Kapag pinutol ang listahan, sabihin sa user na mag-search sa portal para makita
  ang buo.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST lang ang tinatanggap." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Hindi pa naka-set ang ANTHROPIC_API_KEY sa Vercel." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const rawContext = body.context;   // Phase 3: datos ng portal

    if (!text) return res.status(400).json({ error: "Walang laman ang mensahe." });
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `Sobrang haba. Hanggang ${MAX_CHARS} characters lang.` });
    }

    // Gawing Anthropic format ang usapan.
    const messages = history
      .filter((m) => m && m.text && (m.role === "user" || m.role === "ai"))
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.text).slice(0, MAX_CHARS),
      }));

    // Kailangang mag-umpisa sa "user" — tanggalin ang welcome message sa unahan.
    while (messages.length && messages[0].role !== "user") messages.shift();

    // Siguraduhing ang huling turn ay galing sa user
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      messages.push({ role: "user", content: text });
    }

    // ── Konteksto ──
    // Plain text ang ipinapadala ng aiContext.js. Tinatanggap pa rin ang object
    // (JSON) para backward-compatible.
    let contextText = "";
    if (typeof rawContext === "string") {
      contextText = rawContext.trim();
    } else if (rawContext && typeof rawContext === "object") {
      try { contextText = JSON.stringify(rawContext); } catch { contextText = ""; }
    }
    if (contextText.length > MAX_CONTEXT) {
      contextText = contextText.slice(0, MAX_CONTEXT) + "\n…(pinutol)";
    }

    const sysText = contextText
      ? `${SYSTEM_PROMPT}\n\n${CONTEXT_RULES}\n\n${contextText}`
      : SYSTEM_PROMPT;

    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.3,   // mas mababa — datos ang sinasagot, hindi kuwento
        system: sysText,
        messages,
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Anthropic error", r.status, detail.slice(0, 800));

      const hint =
        r.status === 400 ? "mali ang request" :
        r.status === 401 ? "hindi tanggap ang API key — baka mali, expired, o na-delete" :
        r.status === 403 ? "walang permiso ang key na ito" :
        r.status === 404 ? `walang model na "${model}" para sa key na ito` :
        r.status === 429 ? "masyadong mabilis ang requests — sandali lang, subukan ulit" :
        r.status === 402 ? "baka naubos ang credits — tignan sa console.anthropic.com" :
        r.status >= 500 ? "may problema sa Anthropic — subukan ulit mamaya" :
        "may problema sa AI service";

      return res.status(502).json({ error: `Claude ${r.status}: ${hint}.` });
    }

    const data = await r.json();
    const reply = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(200).json({ reply: "Walang naibalik na sagot. Subukan ulit." });
    }

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("api/ai error:", e);
    return res.status(500).json({ error: "May mali sa server. Subukan ulit." });
  }
}
