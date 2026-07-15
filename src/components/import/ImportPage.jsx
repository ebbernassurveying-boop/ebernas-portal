import React, { useState, useRef } from "react";
import { saveCase } from "../../firebase";

// ── CDN LOADER (SheetJS) ─────────────────────────────────────────────────────
const XLSX_CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const existing = document.querySelector(`script[src="${XLSX_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.XLSX));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = XLSX_CDN; s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const makeCaseKey = (name, lot) => {
  const n = (name || "").trim();
  const l = (lot || "").toString().trim();
  return l ? `${n} — Lot ${l}` : n;
};

const CASE_TYPES = [
  "Subdivision – Tax Declaration Only",
  "Subdivision – Titled Property",
  "Relocation Plan – Titled Property",
  "Relocation Plan – Not Titled (Tax Dec)",
  "Segregation",
  "Titling",
];

// Ang sheet na babasahin. Ito ang master list — kasama na dito ang APPROVED,
// ON PROCESS, REJECTED, atbp. kaya iisa lang ang binabasa (iwas doble).
const SHEET_NAME = "ALL SUBMITTED";

const fmtDate = (v) => {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v)) return v.toLocaleDateString("en-CA");
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("en-CA");
};

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());

// Trans ID: "125544.0" -> "125544" ; "---" -> ""
const cleanTransId = (v) => {
  const s = clean(v);
  if (!s || /^-+$/.test(s)) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(Math.round(n)) : s;
};

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ImportPage({ caseStore = {}, isAdmin, setActiveMenu }) {
  const [rows, setRows] = useState(null);      // parsed preview
  const [fileName, setFileName] = useState("");
  const [defaultType, setDefaultType] = useState(CASE_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const inputRef = useRef(null);

  if (!isAdmin) {
    return <div style={{ padding: 20, textAlign: "center", color: "rgba(220,245,230,0.5)" }}>👀 Admin lang ang may access.</div>;
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setDone(null); setRows(null); setFileName(file.name);
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      if (!wb.SheetNames.includes(SHEET_NAME)) {
        setErr(`Walang "${SHEET_NAME}" na sheet. Nakita: ${wb.SheetNames.join(", ")}`);
        return;
      }
      const ws = wb.Sheets[SHEET_NAME];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, cellDates: true });

      const parsed = [];
      const seen = new Set();
      for (let i = 1; i < aoa.length; i++) {          // laktawan ang header row
        const r = aoa[i] || [];
        const claimant = clean(r[4]);                  // E = CLAIMANT
        const lot = clean(r[2]);                       // C = LOT NUMBER
        if (!claimant || !lot) continue;

        const key = makeCaseKey(claimant, lot);
        if (seen.has(key)) continue;                   // doble sa loob mismo ng Excel
        seen.add(key);

        const status = clean(r[6]).toUpperCase();      // G = CURRENT STATUS
        parsed.push({
          key,
          transId: cleanTransId(r[0]),                 // A = FG
          location: clean(r[1]),                       // B = LOCATION
          lot,
          date: fmtDate(r[3]),                         // D = DATE
          claimant,
          unit: clean(r[5]),                           // F = CURRENT UNIT
          statusRaw: clean(r[6]),
          isApproved: status.startsWith("APPROVED"),
          contact: clean(r[7]),                        // H = CONTACT PERSON
          dup: !!caseStore[key],
        });
      }
      if (!parsed.length) setErr("Walang nabasang row na may Claimant at Lot Number.");
      setRows(parsed);
    } catch (e2) {
      setErr("Hindi mabasa ang file: " + (e2?.message || e2));
    }
  };

  const buildCase = (row) => {
    const steps = {
      survey_done:    { done: true },
      plan_made:      { done: true },
      reqs_collected: { done: true },
      submitted:      { done: true, date: row.date || "" },
      trans_id:       { done: !!row.transId, transId: row.transId || "" },
      monitoring:     { done: !!row.statusRaw, approvalRemarks: row.statusRaw || "" },
      approved:       row.isApproved ? { done: true, date: "" } : { done: false },
    };
    return {
      caseType: defaultType,
      lotNo: row.lot,
      titleNo: "",
      agent: "",
      propertyLocation: row.location,
      contact: row.contact,
      email: "",
      ref: row.transId,
      overallStatus: row.isApproved ? "Approved" : (row.statusRaw || "Submitted sa Region"),
      progress: 0,
      remarks: [row.unit, row.statusRaw].filter(Boolean).join(" — "),
      currentLocation: row.unit || "DENR Region I",
      dateOfSurvey: "",
      dateOfSubmittal: row.date || "",
      missingItems: [],
      trackerSteps: steps,
      transId: row.transId || "",
      checklist: [
        { name: "Client Information Form", status: "Pending" },
        { name: "Property Documents", status: "Pending" },
        { name: "Valid IDs", status: "Pending" },
        { name: "Tax Declaration", status: "Pending" },
      ],
      folders: [],
      dateCreated: new Date().toLocaleDateString("en-PH"),
      importedFrom: "excel:" + SHEET_NAME,
      importedAt: new Date().toISOString(),
    };
  };

  const runImport = async () => {
    if (!rows) return;
    const todo = rows.filter(r => !r.dup);
    if (!todo.length) { setErr("Walang bagong i-import — lahat naka-encode na."); return; }
    setBusy(true); setProgress(0); setErr("");
    let ok = 0, failed = 0;
    const CHUNK = 20;
    for (let i = 0; i < todo.length; i += CHUNK) {
      const batch = todo.slice(i, i + CHUNK);
      const res = await Promise.allSettled(batch.map(r => saveCase(r.key, buildCase(r))));
      res.forEach(x => x.status === "fulfilled" ? ok++ : failed++);
      setProgress(Math.round(Math.min(i + CHUNK, todo.length) / todo.length * 100));
    }
    setBusy(false);
    setDone({ ok, failed, skipped: rows.length - todo.length });
  };

  const newCount = rows ? rows.filter(r => !r.dup).length : 0;
  const dupCount = rows ? rows.length - newCount : 0;
  const apprCount = rows ? rows.filter(r => r.isApproved && !r.dup).length : 0;

  const box = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18 };
  const pill = (bg, color) => ({ background: bg, color, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bulk Encoding</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e8f5ee", margin: "2px 0 0" }}>📥 Import mula sa Excel</h2>
      </div>

      <div style={box}>
        <p style={{ fontSize: 13, color: "rgba(220,245,230,0.6)", lineHeight: 1.6, marginBottom: 14 }}>
          Babasahin ang <b>"{SHEET_NAME}"</b> na sheet lang — ito ang master list, kasama na dito ang APPROVED,
          ON PROCESS, at REJECTED. Ang mga naka-encode na ay awtomatikong lalaktawan.
        </p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => inputRef.current?.click()} className="btn-primary" style={{ padding: "10px 20px", fontSize: 13 }}>
          📂 Pumili ng Excel File
        </button>
        {fileName && <span style={{ marginLeft: 12, fontSize: 12, color: "rgba(220,245,230,0.5)" }}>{fileName}</span>}
      </div>

      {err && (
        <div style={{ ...box, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.3)", color: "#fb7185", fontSize: 13 }}>⚠️ {err}</div>
      )}

      {done && (
        <div style={{ ...box, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <p style={{ color: "#34d399", fontSize: 15, fontWeight: 800, marginBottom: 6 }}>✅ Tapos na ang import!</p>
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.7)" }}>
            Na-import: <b>{done.ok}</b> · Nilaktawan (naka-encode na): <b>{done.skipped}</b>
            {done.failed > 0 && <> · <span style={{ color: "#fb7185" }}>Bigo: <b>{done.failed}</b></span></>}
          </p>
          <button onClick={() => setActiveMenu("overview")} className="btn-outline" style={{ marginTop: 12, padding: "7px 14px", fontSize: 12 }}>
            Tingnan sa Overview →
          </button>
        </div>
      )}

      {rows && !done && (
        <>
          <div style={box}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={pill("rgba(96,165,250,0.15)", "#60a5fa")}>📊 {rows.length} nabasa</span>
              <span style={pill("rgba(52,211,153,0.15)", "#34d399")}>✨ {newCount} bago</span>
              {dupCount > 0 && <span style={pill("rgba(251,191,36,0.15)", "#fbbf24")}>⏭️ {dupCount} naka-encode na (laktawan)</span>}
              <span style={pill("rgba(52,211,153,0.15)", "#34d399")}>🎉 {apprCount} approved</span>
            </div>

            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Default Survey Type (pwede mong e-edit isa-isa sa portal pagkatapos)</p>
            <select value={defaultType} onChange={e => setDefaultType(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "#0f2318", color: "#e8f5ee", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "inherit", fontSize: 13, marginBottom: 16 }}>
              {CASE_TYPES.map(t => <option key={t} value={t} style={{ background: "#0f2318" }}>{t}</option>)}
            </select>

            {busy ? (
              <div>
                <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "#34d399", transition: "width 0.2s" }} />
                </div>
                <p style={{ fontSize: 12, color: "rgba(220,245,230,0.5)", textAlign: "center" }}>Ini-import… {progress}% — huwag isara ang page</p>
              </div>
            ) : (
              <button onClick={runImport} disabled={!newCount} className="btn-primary"
                style={{ width: "100%", padding: "12px 0", fontSize: 14, opacity: newCount ? 1 : 0.4, cursor: newCount ? "pointer" : "not-allowed" }}>
                ⚡ I-import ang {newCount} bagong case{newCount === 1 ? "" : "s"}
              </button>
            )}
          </div>

          <div style={{ ...box, padding: 0, overflow: "hidden" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "14px 18px 8px" }}>
              Preview (unang 100)
            </p>
            <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ position: "sticky", top: 0, background: "#0f2318" }}>
                  <tr>
                    {["", "Claimant", "Lot", "Location", "Trans ID", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "rgba(220,245,230,0.4)", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: r.dup ? 0.4 : 1 }}>
                      <td style={{ padding: "7px 10px" }}>{r.dup ? "⏭️" : (r.isApproved ? "🎉" : "🔄")}</td>
                      <td style={{ padding: "7px 10px", color: "#e8f5ee", fontWeight: 600 }}>{r.claimant}</td>
                      <td style={{ padding: "7px 10px", color: "rgba(220,245,230,0.6)" }}>{r.lot}</td>
                      <td style={{ padding: "7px 10px", color: "rgba(220,245,230,0.45)" }}>{r.location}</td>
                      <td style={{ padding: "7px 10px", color: "rgba(220,245,230,0.45)" }}>{r.transId || "—"}</td>
                      <td style={{ padding: "7px 10px", color: r.isApproved ? "#34d399" : "rgba(220,245,230,0.5)" }}>{r.statusRaw || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && (
              <p style={{ fontSize: 11, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "10px" }}>
                +{rows.length - 100} pa — lahat ay isasama sa import
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
