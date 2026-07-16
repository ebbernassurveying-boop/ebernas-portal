// src/components/ai/aiContext.js
// ─────────────────────────────────────────────────────────────────────────────
// ANG UTAK NG KONTEKSTO.
//
// Hindi natin ibinubuhos ang lahat ng ~775 cases sa bawat mensahe — mabagal,
// magastos, at nalulunod ang AI. Sa halip, binabasa muna natin ang tanong,
// tapos 'yon lang ang datos na ipinapadala.
//
//   "Ano status ni Juan Cruz?"   → buong detalye ng cases ni Juan Cruz
//   "Ilan ang pending?"          → counters lang
//   "Sino-sino ang On Process?"  → listahan ng pangalan
//   "May schedule ba bukas?"     → schedules
//
// Nagbabalik ng PLAIN TEXT (hindi JSON) — mas kaunting token, mas madaling
// basahin ng AI.
// ─────────────────────────────────────────────────────────────────────────────

import {
  APPROVAL_STEPS,
  resolveTrackerKey,
  parseCaseKey,
  getCaseStatus,
  getSurveyLabel,
} from "../../lib/caseStatus";

const MAX_CHARS = 11000;     // hangganan ng buong konteksto
const MAX_CASE_DETAIL = 6;   // ilang case ang isasalaysay nang buo
const MAX_LIST = 40;         // haba ng listahan ng pangalan
const MAX_SCHED = 12;

const STATUS_LABEL = {
  process: "On Process",
  pending: "Pending",
  done: "Done (tapos na lahat ng steps)",
  not_surveyed: "Hindi pa na-survey",
};

// ── TEXT HELPERS ─────────────────────────────────────────────────────────────
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Mga salitang hindi pangalan — para hindi mag-match ang "ano", "status", atbp.
const STOP = new Set(
  ("ano anu ang si ni kay kina nina ng nang sa mga ba na naman din rin daw po " +
   "kumusta kamusta status kaso kaso case cases client kliyente lot lote ilan " +
   "sino sinong saan kailan bakit paano may mayroon meron wala hindi di oo " +
   "pwede puwede pakita ipakita tingnan tignan check sabihin sabi mo ko namin " +
   "natin nila niya ka kayo tayo kami sila ako ito iyan iyon yan yun this that " +
   "what who when where how many which the of for and is are was were a an at " +
   "in on to my our your his her their show tell me give list all any about " +
   "please pls update updates info impormasyon detalye details survey surveys " +
   "engr engineer sir maam ma am mr mrs ms " +
   // mga salitang may sariling seksyon na sa ibaba — hindi pangalan ng tao
   "pending process prosesong ginagawa done tapos natapos approved aprubado " +
   "nakabinbin schedule sched iskedyul bukas ngayon today tomorrow week linggo " +
   "employee employees empleyado tauhan staff team kawani overview portal " +
   "dashboard report reports finance payroll attendance " +
   // mga salitang teknikal — hindi rin pangalan
   "tax declaration dec subdivision relocation segregation verification " +
   "topographic approval titled title plan plano monitoring trans transaction " +
   "denr region lra brgy barangay").split(" ")
);

const tokens = (s) =>
  norm(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP.has(t));

const fmt = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(d); }
};

// ── DATE HELPERS ─────────────────────────────────────────────────────────────
// Ginagawa lahat sa "YYYY-MM-DD" na string at UTC noon para walang gulo sa
// timezone at walang off-by-one sa hatinggabi.
const DAYS = ["Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"];
const asUTC = (iso) => new Date(`${iso}T12:00:00Z`);
const shift = (iso, n) => {
  const d = asUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayName = (iso) => {
  const d = asUTC(iso);
  return isNaN(d) ? "" : DAYS[d.getUTCDay()];
};

// Linggo–Sabado ang linggo, tugma sa calendar grid ng portal.
function weekWindows(todayIso) {
  const dow = asUTC(todayIso).getUTCDay();   // 0 = Linggo
  return {
    tomorrow:  shift(todayIso, 1),
    weekStart: shift(todayIso, -dow),
    weekEnd:   shift(todayIso, 6 - dow),
    nextStart: shift(todayIso, 7 - dow),
    nextEnd:   shift(todayIso, 13 - dow),
  };
}

// ── NAME MATCHING ────────────────────────────────────────────────────────────
// Score kung gaano ka-tugma ang case key sa tanong.
function scoreCase(key, data, qTokens, qNorm) {
  const { name, lot } = parseCaseKey(key);
  const nameNorm = norm(name);
  if (!nameNorm) return 0;

  // Buong pangalan nasa tanong → pinakamalakas
  if (qNorm.includes(nameNorm) && nameNorm.length >= 5) return 100;

  const nTokens = nameNorm.split(" ").filter((t) => t.length >= 3);
  if (!nTokens.length) return 0;

  let hits = 0;
  for (const nt of nTokens) {
    if (qTokens.includes(nt)) { hits += 2; continue; }
    // maluwag na tugma (typo / pinaikli): "cruzz" vs "cruz"
    if (qTokens.some((qt) => qt.length >= 4 && (qt.startsWith(nt) || nt.startsWith(qt)))) hits += 1;
  }
  if (!hits) return 0;

  let score = hits * 10;
  // bonus kung banggit ang lot number
  const lotNo = String(data?.lotNo || lot || "").trim();
  if (lotNo && qNorm.split(" ").includes(norm(lotNo))) score += 15;
  return score;
}

// ── CASE NARRATIVE ───────────────────────────────────────────────────────────
function describeCase(key, data) {
  const { name, lot } = parseCaseKey(key);
  const steps = data?.trackerSteps || {};
  const trackerKey = resolveTrackerKey(data);
  const stepDefs = (Array.isArray(data?.customSteps) && data.customSteps.length)
    ? data.customSteps
    : (APPROVAL_STEPS[trackerKey] || []);
  const doneCount = stepDefs.filter((s) => steps[s.id]?.done).length;

  const L = [];
  L.push(`CASE: ${key}`);
  L.push(`  Client: ${name}${(data?.lotNo || lot) ? ` | Lot: ${data?.lotNo || lot}` : ""}`);
  L.push(`  Status: ${STATUS_LABEL[getCaseStatus(data)]}`);
  L.push(`  Uri ng survey: ${getSurveyLabel(data)}`);
  if (data?.caseType) L.push(`  Case type: ${data.caseType}`);
  if (data?.propertyLocation) L.push(`  Lokasyon: ${data.propertyLocation}`);
  if (data?.agent) L.push(`  Agent: ${data.agent}`);
  if (data?.contact) L.push(`  Contact: ${data.contact}`);
  if (data?.dateOfSurvey) L.push(`  Petsa ng survey: ${fmt(data.dateOfSurvey)}`);
  if (data?.dateCreated) L.push(`  Petsa ng pag-encode: ${fmt(data.dateCreated)}`);

  const transId = steps.trans_id?.transId || data?.transId || "";
  if (transId) L.push(`  Trans ID: ${transId}`);

  const remarks = steps.monitoring?.approvalRemarks || "";
  if (remarks) L.push(`  Remarks ng Region: ${remarks}`);

  if (stepDefs.length) {
    L.push(`  Progress: ${doneCount}/${stepDefs.length} steps`);
    L.push("  Mga step:");
    for (const s of stepDefs) {
      const st = steps[s.id] || {};
      const mark = st.done ? "[TAPOS]" : "[hindi pa]";
      const bits = [];
      if (st.date) bits.push(fmt(st.date));
      if (st.pendingReason && String(st.pendingReason).trim()) bits.push(`PENDING: ${st.pendingReason}`);
      L.push(`    ${mark} ${String(s.label || s.id).replace(/[^\u0020-\u007E]/g, "").trim()}${bits.length ? " — " + bits.join(" | ") : ""}`);
    }
  }

  // Huling galaw sa monitoring history
  const log = Array.isArray(data?.monitoringLog) ? data.monitoringLog.slice(-2) : [];
  if (log.length) {
    L.push("  Huling monitoring:");
    log.forEach((e) => L.push(`    - ${fmt(e.date)} ${e.status || ""} ${e.reason || ""}`.trimEnd()));
  }

  return L.join("\n");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
/**
 * @param {string} question   ang tinanong ng user
 * @param {object} data       { caseStore, schedules, employees, currentUser }
 * @returns {string|null}     plain-text na konteksto para sa system prompt
 */
export function buildAIContext(question, data = {}) {
  const caseStore = data.caseStore || {};
  const schedules = Array.isArray(data.schedules) ? data.schedules : [];
  const employees = Array.isArray(data.employees) ? data.employees : [];
  const user = data.currentUser || {};

  const q = String(question || "");
  const qNorm = norm(q);
  const qTokens = tokens(q);

  const entries = Object.entries(caseStore).filter(([k]) => k && k.trim());
  const withStatus = entries.map(([k, d]) => [k, d, getCaseStatus(d)]);

  const count = (s) => withStatus.filter((r) => r[2] === s).length;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const out = [];
  out.push("=== DATOS NG PORTAL (live, ngayon lang kinuha) ===");
  out.push(`Petsa ngayon: ${new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  out.push(`Naka-login: ${user.displayName || user.name || user.email || "—"} (${user.role || "employee"})`);
  out.push("");
  out.push("BILANG NG CASES:");
  out.push(`  Kabuuan: ${entries.length}`);
  out.push(`  On Process: ${count("process")}`);
  out.push(`  Pending: ${count("pending")}`);
  out.push(`  Done: ${count("done")}`);
  out.push(`  Hindi pa na-survey: ${count("not_surveyed")}`);
  out.push("");

  // Anong ibang seksyon ang hihilingin ng tanong? Kailangan alam natin ito bago
  // magbabala tungkol sa "walang tugmang pangalan".
  const wants = [];
  if (/\bpending\b|nakabinbin/i.test(q)) wants.push("pending");
  if (/on.?process|prosesong|ginagawa/i.test(q)) wants.push("process");
  if (/\bdone\b|tapos|natapos|approved|na-?aprubahan/i.test(q)) wants.push("done");
  if (/hindi pa.*survey|not.?surveyed|di pa.*survey/i.test(q)) wants.push("not_surveyed");
  const wantsSched = /sched|iskedyul|bukas|ngayon|today|tomorrow|next.?week|this.?week|susunod|sunod|linggo|araw|appointment|kailan/i.test(q);
  const wantsEmp = /employee|empleyado|tauhan|staff|team|kawani/i.test(q);

  // ── 1. TUGMANG PANGALAN ────────────────────────────────────────────────────
  let matched = [];
  if (qTokens.length) {
    matched = withStatus
      .map(([k, d, st]) => ({ k, d, st, score: scoreCase(k, d, qTokens, qNorm) }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  if (matched.length) {
    // Itapon ang mahihinang tugma. Kung may nakuhang buong pangalan (score 100),
    // huwag nang isama ang mga apelyido lang na nagkataong pareho.
    const best = matched[0].score;
    matched = matched.filter((m) => m.score >= best * 0.85);

    const top = matched.slice(0, MAX_CASE_DETAIL);
    out.push(`--- TUGMANG CASES SA TANONG (${matched.length} nahanap, ipinapakita ang ${top.length}) ---`);
    top.forEach((m) => { out.push(describeCase(m.k, m.d)); out.push(""); });
    if (matched.length > top.length) {
      out.push(`(May ${matched.length - top.length} pang tugma na hindi isinama: ${matched.slice(MAX_CASE_DETAIL, MAX_CASE_DETAIL + 12).map((m) => m.k).join("; ")})`);
      out.push("");
    }
  } else if (qTokens.length && !wants.length && !wantsSched && !wantsEmp) {
    out.push(`--- WALANG TUGMANG CASE sa mga salitang: ${qTokens.join(", ")} ---`);
    out.push("Kung PANGALAN ng client ang tinutukoy: wala ito sa portal, o iba ang baybay.");
    out.push("HUWAG mag-imbento ng status, Trans ID, o petsa — sabihing hindi nahanap at");
    out.push("imungkahing i-check ang spelling o mag-search sa portal.");
    out.push("Pero kung HINDI naman pangalan ang tanong (hal. general na tanong tungkol sa");
    out.push("surveying o proseso), balewalain ang babalang ito at sumagot nang normal.");
    out.push("");
  }

  // ── 2. LISTAHAN AYON SA STATUS ─────────────────────────────────────────────
  for (const w of wants) {
    const rows = withStatus.filter((r) => r[2] === w);
    out.push(`--- LISTAHAN: ${STATUS_LABEL[w]} (${rows.length} lahat) ---`);
    rows.slice(0, MAX_LIST).forEach(([k, d]) => out.push(`  • ${k} — ${getSurveyLabel(d)}${d?.agent ? ` (agent: ${d.agent})` : ""}`));
    if (rows.length > MAX_LIST) out.push(`  ...at ${rows.length - MAX_LIST} pa. Sabihin sa user na mag-search sa portal para sa buong listahan.`);
    out.push("");
  }

  // ── 3. SCHEDULES ───────────────────────────────────────────────────────────
  // MAHALAGA: hindi lang "paparating" ang ipinapadala. Naka-bucket ayon sa
  // EKSAKTONG petsa (ngayon / bukas / ngayong linggo / susunod na linggo) at
  // kasama ang mismong date range — kung hindi, hinuhulaan ng AI kung alin ang
  // "next week" at nagkakamali.
  if (wantsSched) {
    const W = weekWindows(today);
    const open = schedules.filter((s) => !s.done && s.date);
    const inRange = (s, a, b) => s.date >= a && s.date <= b;

    const bToday  = open.filter((s) => s.date === today);
    const bTom    = open.filter((s) => s.date === W.tomorrow);
    const bWeek   = open.filter((s) => inRange(s, today, W.weekEnd) && s.date !== today && s.date !== W.tomorrow);
    const bNext   = open.filter((s) => inRange(s, W.nextStart, W.nextEnd));
    const bLater  = open.filter((s) => s.date > W.nextEnd);
    const bPast   = open.filter((s) => s.date < today);

    const line = (s) => `  • ${s.date} (${dayName(s.date)}) — ${s.type || "Schedule"}${s.surveyType ? ` (${s.surveyType})` : ""}${s.client ? ` | Client: ${s.client}` : ""}${s.lotNo ? ` | Lot ${s.lotNo}` : ""}${s.location ? ` | ${s.location}` : ""}${s.agent ? ` | Agent: ${s.agent}` : ""}`;
    const bucket = (label, rows, cap = MAX_SCHED) => {
      out.push(`${label}: ${rows.length}${rows.length ? "" : " — WALA"}`);
      rows.slice(0, cap).forEach((r) => out.push(line(r)));
      if (rows.length > cap) out.push(`  ...at ${rows.length - cap} pa.`);
    };

    out.push(`--- SCHEDULES (${open.length} bukas pa lahat) ---`);
    out.push("KAHULUGAN NG PETSA — sundin nang eksakto, huwag baguhin:");
    out.push(`  "ngayon"/"today"            = ${today} (${dayName(today)})`);
    out.push(`  "bukas"/"tomorrow"          = ${W.tomorrow} (${dayName(W.tomorrow)})`);
    out.push(`  "ngayong linggo"/"this week" = ${W.weekStart} hanggang ${W.weekEnd} (Linggo–Sabado)`);
    out.push(`  "susunod na linggo"/"next week" = ${W.nextStart} hanggang ${W.nextEnd} (Linggo–Sabado)`);
    out.push("BABALA: ang petsang WALA sa hinihinging range ay HINDI kasagutan.");
    out.push(`Halimbawa: kung "next week" ang tanong, ${W.weekEnd} ay HINDI kasama —`);
    out.push("ngayong linggo pa 'yon. Kung walang laman ang range, sabihing WALA.");
    out.push("");
    bucket(`NGAYON (${today})`, bToday);
    bucket(`BUKAS (${W.tomorrow})`, bTom);
    bucket(`NATITIRA PA NGAYONG LINGGO (hanggang ${W.weekEnd}, hindi kasama ang ngayon/bukas)`, bWeek);
    bucket(`SUSUNOD NA LINGGO (${W.nextStart} – ${W.nextEnd})`, bNext);
    bucket("PAGKATAPOS NG SUSUNOD NA LINGGO", bLater, 8);
    if (bPast.length) bucket("LAGPAS NA ANG PETSA PERO HINDI PA NAMAMARKAHANG DONE", bPast, 5);
    out.push("");
  }

  // ── 4. EMPLOYEES ───────────────────────────────────────────────────────────
  if (wantsEmp) {
    out.push(`--- EMPLOYEES (${employees.length}) ---`);
    employees.slice(0, 30).forEach((e) =>
      out.push(`  • ${e.name || e.fullName || "—"}${e.position ? ` — ${e.position}` : ""}${e.status ? ` [${e.status}]` : ""}`)
    );
    out.push("");
  }

  out.push("=== KATAPUSAN NG DATOS ===");
  out.push("Sagutin LANG mula sa datos sa itaas. Kung wala rito ang sagot, sabihing wala kang datos — huwag manghula.");

  let text = out.join("\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + "\n…(pinutol — sobrang haba. Sabihin sa user na paliitin ang tanong.)";
  return text;
}

export default buildAIContext;
