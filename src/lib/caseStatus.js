// src/lib/caseStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// ISANG SOURCE OF TRUTH para sa lohika ng kaso.
// Dating nakatago sa loob ng App.js (at ang getCaseStatus/getSurveyLabel ay
// nakakulong pa sa loob ng OverviewPage). Inilipat dito para magamit din ng
// AI Assistant — pare-pareho ang sagot ng Overview at ng AI, walang drift.
//
// Walang import dito galing sa App.js — kaya walang circular dependency.
// ─────────────────────────────────────────────────────────────────────────────

// ── APPROVAL TRACKER STEPS ───────────────────────────────────────────────────
export const APPROVAL_STEPS = {
  "relocation": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang field survey" },
    { id: "plan_made",     label: "📐 Sketch Plan Done",          detail: "Na-draft na at tapos na ang sketch plan" },
    { id: "plan_released", label: "📋 Plan Released sa Client",  detail: "Natanggap na ng client ang plan", hasDate: true },
  ],
  "segregation": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang field survey" },
    { id: "plan_made",     label: "📐 Sketch Plan Done",          detail: "Na-draft na at tapos na ang sketch plan" },
    { id: "plan_released", label: "📋 Plan Released sa Client",  detail: "Natanggap na ng client ang plan", hasDate: true },
  ],
  "subdivision": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang field survey" },
    { id: "plan_made",     label: "📐 Sketch Plan Done",          detail: "Na-draft na at tapos na ang sketch plan" },
    { id: "plan_released", label: "📋 Plan Released sa Client",  detail: "Natanggap na ng client ang plan", hasDate: true },
  ],
  "subdivision_approval_titled": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang field survey" },
    { id: "plan_made",     label: "📐 Plan Done",               detail: "Na-prepare at tapos na ang subdivision plan" },
    { id: "reqs_collected",label: "📁 Requirements Nakuha",      detail: "Title (CTC), Plan, Trans ID" },
    { id: "submitted",     label: "📤 Submitted sa Region",      detail: "Na-submit na sa DENR Region I", hasDate: true },
    { id: "trans_id",      label: "🔢 May Transaction ID Na",    detail: "Natanggap na ang Trans ID", hasInput: "transId" },
    { id: "monitoring",    label: "🔍 Monitoring ng Remarks",    detail: "Binibisita ang status — Pending / Approved", hasInput: "approvalRemarks" },
    { id: "approved",      label: "🎉 APPROVED!",               detail: "Na-approve na ang subdivision plan", hasDate: true },
  ],
  "subdivision_approval_taxdec": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang field survey" },
    { id: "plan_made",     label: "📐 Plan Done",               detail: "Na-prepare at tapos na ang subdivision plan" },
    { id: "reqs_collected",label: "📁 Requirements Nakuha",      detail: "Tax Dec, Brgy Cert, Court Cert, Deed, Land Status, Inspection Report" },
    { id: "submitted",     label: "📤 Submitted sa Region",      detail: "Na-submit na sa DENR Region I", hasDate: true },
    { id: "trans_id",      label: "🔢 May Transaction ID Na",    detail: "Natanggap na ang Trans ID", hasInput: "transId" },
    { id: "monitoring",    label: "🔍 Monitoring ng Remarks",    detail: "Binibisita ang status — Pending / Approved", hasInput: "approvalRemarks" },
    { id: "approved",      label: "🎉 APPROVED!",               detail: "Na-approve na ang subdivision plan", hasDate: true },
  ],
  "verification": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang verification survey" },
    { id: "report_made",   label: "📋 Report Ginawa",            detail: "Na-prepare ang survey report" },
    { id: "released",      label: "📋 Report Released sa Client",detail: "Natanggap na ng client ang report", hasDate: true },
  ],
  "topographic": [
    { id: "survey_done",   label: "✅ Survey Done",              detail: "Natapos na ang topographic survey" },
    { id: "report_made",   label: "📋 Report Ginawa",            detail: "Na-prepare ang topo report" },
    { id: "released",      label: "📋 Report Released sa Client",detail: "Natanggap na ng client ang report", hasDate: true },
  ],
};

export const resolveTrackerKey = (data) => {
  const cat = data?.surveyCategory || "";
  const sub = data?.surveySubCategory || "";
  if (cat === "subdivision" && sub === "Para sa Approval na") {
    const ct = data?.caseType || "";
    return ct.includes("Tax") ? "subdivision_approval_taxdec" : "subdivision_approval_titled";
  }
  if (cat === "approval") {
    const ct = data?.caseType || "";
    return ct.includes("Tax") ? "subdivision_approval_taxdec" : "subdivision_approval_titled";
  }
  if (cat === "relocation")   return "relocation";
  if (cat === "segregation")  return "segregation";
  if (cat === "subdivision")  return "subdivision";
  if (cat === "verification") return "verification";
  if (cat === "topographic")  return "topographic";
  // fallback by caseType
  const ct = data?.caseType || "";
  if (ct.includes("Segregation"))  return "segregation";
  if (ct.includes("Subdivision") && ct.includes("Tax")) return "subdivision_approval_taxdec";
  if (ct.includes("Subdivision"))  return "subdivision_approval_titled";
  if (ct.includes("Relocation"))   return "relocation";
  return "relocation";
};

// ── SHARED CATEGORIZER ───────────────────────────────────────────────────────
// Isang source of truth para sa "For Approval" vs "Field Survey".
// Naka-tie sa resolveTrackerKey para naka-sync ang Case Monitoring,
// Registered Clients, progress %, at status — pare-pareho lahat.
export const isApprovalCaseType = (data) => {
  const key = resolveTrackerKey(data);
  return key === "subdivision_approval_titled" || key === "subdivision_approval_taxdec";
};

// ── CASE KEY HELPERS (folder-per-client: isang pangalan, maraming lot) ────────
// Ang case key ay "Pangalan — Lot X" para magkahiwalay ang bawat lote ng
// parehong client. Backward-compatible: lumang cases (pangalan lang) ay gumagana pa rin.
export const makeCaseKey = (name, lot) => {
  const n = (name || "").trim();
  const l = (lot || "").toString().trim();
  return l ? `${n} — Lot ${l}` : n;
};
export const parseCaseKey = (key) => {
  const m = (key || "").match(/^(.*?)\s+—\s+Lot\s+(.+)$/);
  if (m) return { name: m[1].trim(), lot: m[2].trim() };
  return { name: (key || "").trim(), lot: "" };
};
export const caseClientName = (key) => parseCaseKey(key).name;

// ── CASE STATUS LOGIC ────────────────────────────────────────────────────────
// ── Case Status Logic ──
export const getCaseStatus = (data) => {
  if (!data) return "not_surveyed";
  const steps = data.trackerSteps || {};
  const key = resolveTrackerKey(data);
  const trackerSteps = (Array.isArray(data.customSteps) && data.customSteps.length) ? data.customSteps : (APPROVAL_STEPS[key] || []);
  if (!trackerSteps.length) return "process";
  const firstStep = trackerSteps[0];
  // not_surveyed kung hindi pa done ang unang step (hal. Survey Done)
  if (firstStep && !steps[firstStep.id]?.done) return "not_surveyed";
  // "Done" kung LAHAT ng steps ay tapos na (100% COMPLETED)
  const allDone = trackerSteps.every(s => steps[s.id]?.done);
  if (allDone) return "done";
  // "Pending" kung may pending flag na naghihintay pa SA IYO na aksyunan:
  // RO status = Pending/For Compliance/For Resubmission, O may pendingReason.
  // Pero kung "Resubmitted" na (naghihintay na sa Region) → "On Process".
  const monitoring = steps.monitoring || {};
  if (monitoring.approvalRemarks === "Resubmitted") return "process";
  const pendingRemark = ["Pending", "For Compliance", "For Resubmission"].includes(monitoring.approvalRemarks);
  const hasPendingReason = Object.values(steps).some(s => s && typeof s.pendingReason === "string" && s.pendingReason.trim());
  return (pendingRemark || hasPendingReason) ? "pending" : "process";
};

export const getSurveyLabel = (data) => {
  const cat = data?.surveyCategory || "";
  const sub = data?.surveySubCategory || "";
  const ct = data?.caseType || "";
  if (cat === "relocation") return "Relocation";
  if (cat === "segregation") return "Segregation";
  if (cat === "verification") return "Verification Survey";
  if (cat === "topographic") return "Topographic Survey";
  if (cat === "subdivision" && sub === "Para sa Approval na") return ct.includes("Tax") ? "Subdivision Approval (Tax Dec)" : "Subdivision Approval (Titled)";
  if (cat === "subdivision") return "Subdivision (Pre-Approval)";
  if (cat === "approval") return ct.includes("Tax") ? "Subdivision Approval (Tax Dec)" : "Subdivision Approval (Titled)";
  return ct || "—";
};
