// api/ai.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────────────────
// Tulay ng portal papuntang Gemini. Ang API key ay NANDITO LANG sa server —
// hindi kailanman naaabot ng browser. Kaya ligtas.
//
// KAILANGAN sa Vercel → Settings → Environment Variables:
//   GEMINI_API_KEY  = <ang key mo>          (required)
//   GEMINI_MODEL    = gemini-2.5-flash      (optional — default na ito)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_CHARS = 4000;      // hangganan ng haba ng tanong
const MAX_HISTORY = 12;      // ilang naunang mensahe ang ipapadala

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST lang ang tinatanggap." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Hindi pa naka-set ang GEMINI_API_KEY sa Vercel." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context || null;   // Phase 3: datos ng portal

    if (!text) return res.status(400).json({ error: "Walang laman ang mensahe." });
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `Sobrang haba. Hanggang ${MAX_CHARS} characters lang.` });
    }

    // Gawing Gemini format ang usapan. Laktawan ang unang welcome message.
    const contents = history
      .filter((m) => m && m.text && (m.role === "user" || m.role === "ai"))
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: String(m.text).slice(0, MAX_CHARS) }],
      }));

    // Siguraduhing ang huling turn ay galing sa user
    if (!contents.length || contents[contents.length - 1].role !== "user") {
      contents.push({ role: "user", parts: [{ text }] });
    }

    // Kung may context na ipinasa, isama sa system instruction.
    const sysText = context
      ? `${SYSTEM_PROMPT}\n\nDatos ng portal ngayon (gamitin kung kailangan):\n${JSON.stringify(context).slice(0, 12000)}`
      : SYSTEM_PROMPT;

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysText }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Gemini error", r.status, detail.slice(0, 500));
      // Huwag ipasa ang raw error sa browser — baka may sensitibong laman.
      return res.status(502).json({ error: "Hindi maabot ang AI service. Subukan ulit." });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();

    if (!reply) {
      const blocked = data?.promptFeedback?.blockReason;
      return res.status(200).json({
        reply: blocked
          ? "Hindi ko masagot ang tanong na iyan."
          : "Walang naibalik na sagot. Subukan ulit.",
      });
    }

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("api/ai error:", e);
    return res.status(500).json({ error: "May mali sa server. Subukan ulit." });
  }
}
