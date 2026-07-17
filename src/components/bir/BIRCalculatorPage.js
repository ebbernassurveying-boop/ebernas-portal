import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

// ── Local UI helpers (para hindi umasa sa App.js) ────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: "rgba(20,40,30,0.5)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 22, ...style }}>
      {children}
    </div>
  );
}
function SectionHeader({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {eyebrow && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#34d399", marginBottom: 4 }}>{eyebrow}</p>}
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8f5ee" }}>{title}</h3>
    </div>
  );
}

// ── BIR CLASSIFICATION CODES ─────────────────────────────────────────────────
// Mula mismo sa legend ng D.O. No. 082-2022 (RDO No. 5).
const CLASS_LABELS = {
  RR: "Residential Regular", CR: "Commercial Regular",
  RC: "Residential Condominium", CC: "Commercial Condominium",
  CL: "Cemetery Lot", A: "Agricultural", GL: "Government Land",
  GP: "General Purposes", I: "Industrial", X: "Institutional",
  APD: "Area for Priority Development", PS: "Parking Slot", DA: "Drying Area",
  A1: "Riceland Irrigated", A2: "Riceland Unirrigated", A3: "Upland",
  A4: "Coco Land", A5: "Citrus Land", A6: "Fishpond", A7: "Swamp",
  A8: "Nipa Land", A9: "Cotton Land", A10: "Cogon", A11: "Abaca Land",
  A12: "Orchard", A13: "Pineapple Land", A14: "Banana Land", A15: "Pasture Land",
  A16: "Corn Land", A17: "Sugar Land", A18: "Tobacco Land", A19: "Cacao",
  A20: "Lanzones", A21: "Durian", A22: "Rambutan", A23: "Mango",
  A24: "Mangrove", A25: "Camote/Cassava", A26: "Bamboo Land", A27: "Peanut Land",
  A28: "Soy beans Land", A29: "Grape vineyard", A30: "Pepper Land",
  A31: "Mineral Land", A32: "Non Metallic Mineral Land", A33: "Coal Deposit",
  A34: "African Oil Land", A35: "Rubber Land", A36: "Forest Land / Timber Land",
  A37: "Horticultural Land", A38: "Salt Beds", A39: "Seashore", A40: "Resort",
  A41: "Sandy / Stony", A42: "Prawn Pond", A43: "Sorghum", A44: "Ipil-ipil",
  A45: "Kangkong", A46: "Zarate", A47: "Vegetable Land", A48: "Coffee",
  A49: "Mountainous / Hilly Areas", A50: "Other Agricultural Lands",
};
const classLabel = (c) => (CLASS_LABELS[c] ? `${c} — ${CLASS_LABELS[c]}` : c);

// Isang linyang pagkakakilanlan ng lokasyon: "ALL LOTS — ALONG NATIONAL ROAD"
const locKey = (r) => `${r.street || "—"}${r.vicinity ? ` — ${r.vicinity}` : ""}`;

// Para sa manual entries ng admin
const CLASS_OPTIONS = Object.keys(CLASS_LABELS);

// ── TRAIN LAW CONSTANTS ──────────────────────────────────────────────────────
const STANDARD_DEDUCTION = 5000000;   // Estate — RA 10963 (TRAIN)
const FAMILY_HOME_CAP    = 10000000;  // Estate — hangganan ng family home deduction
const DONATION_EXEMPT    = 250000;    // Donor's tax — taunang exempt

const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(String(v).replace(/,/g, "")) || 0;

const inputStyle = { width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const labelStyle = { fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" };
const optStyle = { background: "#0f2318" };

// ── ZONAL VALUE MANAGER (admin only) ─────────────────────────────────────────
// Para sa MANUAL na entries lang — mga lugar na wala sa opisyal na BIR schedule,
// o kung may bagong Department Order na hindi pa naka-file sa /public/zonal/.
function ZonalValueManager({ zonalList }) {
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [vicinity, setVicinity] = useState("");
  const [classification, setClassification] = useState("RR");
  const [pricePerSqm, setPricePerSqm] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [filter, setFilter] = useState("");

  const reset = () => { setMunicipality(""); setBarangay(""); setStreet(""); setVicinity(""); setClassification("RR"); setPricePerSqm(""); setEditId(null); };

  const save = async () => {
    if (!municipality.trim() || !barangay.trim() || num(pricePerSqm) <= 0) {
      alert("Punan ang Municipality, Barangay, at ₱/sqm.");
      return;
    }
    setSaving(true);
    const id = editId || `${municipality.trim()}__${barangay.trim()}__${street.trim()}__${classification}`
      .replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() + "_" + Date.now().toString().slice(-5);
    const data = {
      municipality: municipality.trim().toUpperCase(),
      barangay: barangay.trim().toUpperCase(),
      street: street.trim().toUpperCase() || "(Manual entry)",
      vicinity: vicinity.trim().toUpperCase() || "",
      classification,
      pricePerSqm: num(pricePerSqm),
      updatedAt: new Date().toLocaleDateString("en-PH"),
    };
    try {
      await setDoc(doc(db, "zonalValues", id), data);
      reset();
    } catch (e) {
      console.error(e);
      alert("❌ Hindi na-save: " + (e?.message || "error"));
    }
    setSaving(false);
  };

  const startEdit = (z) => {
    setEditId(z.id);
    setMunicipality(z.municipality || "");
    setBarangay(z.barangay || "");
    setStreet(z.street === "(Manual entry)" ? "" : (z.street || ""));
    setVicinity(z.vicinity || "");
    setClassification(z.classification || "RR");
    setPricePerSqm(String(z.pricePerSqm ?? ""));
  };

  const doDelete = async (id) => {
    try { await deleteDoc(doc(db, "zonalValues", id)); } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const visible = zonalList
    .filter(z => !filter || `${z.municipality} ${z.barangay} ${z.street || ""}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.municipality + a.barangay + (a.street || "")).localeCompare(b.municipality + b.barangay + (b.street || "")));

  return (
    <Card style={{ marginTop: 22 }}>
      <SectionHeader eyebrow="Admin — Manual na Entries" title="🗺️ Custom Zonal Values" />

      <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.6 }}>
          Ang opisyal na BIR schedule (D.O. 082-2022, RDO No. 5) ay nasa <strong>files na</strong> — hindi na kailangang i-type dito.
          Dito lang ang mga <strong>hindi kasama</strong>: ibang RDO, o bagong D.O. na wala pa sa system.
        </p>
      </div>

      <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 14, padding: 16, marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: editId ? "#fbbf24" : "#34d399", marginBottom: 12 }}>
          {editId ? "✏️ I-edit ang entry" : "➕ Magdagdag ng bagong entry"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Municipality / City</label>
            <input value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="hal. Bani" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Barangay</label>
            <input value={barangay} onChange={e => setBarangay(e.target.value)} placeholder="hal. Garrita" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Street / Subdivision</label>
            <input value={street} onChange={e => setStreet(e.target.value)} placeholder="hal. All Lots" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Vicinity</label>
            <input value={vicinity} onChange={e => setVicinity(e.target.value)} placeholder="hal. Along National Road" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Classification</label>
            <select value={classification} onChange={e => setClassification(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CLASS_OPTIONS.map(c => <option key={c} value={c} style={optStyle}>{classLabel(c)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>₱ per sqm</label>
            <input value={pricePerSqm} onChange={e => setPricePerSqm(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving}
            style={{ fontSize: 12, fontWeight: 700, padding: "9px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#34d399", color: "#0a1a13", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sinusave..." : editId ? "💾 I-update" : "💾 I-save"}
          </button>
          {editId && (
            <button onClick={reset}
              style={{ fontSize: 12, fontWeight: 700, padding: "9px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "rgba(220,245,230,0.7)" }}>
              Kanselahin
            </button>
          )}
        </div>
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔍 Hanapin..." style={{ ...inputStyle, marginBottom: 12 }} />

      {visible.length === 0 ? (
        <p style={{ fontSize: 12, color: "rgba(220,245,230,0.4)", textAlign: "center", padding: "18px 0" }}>
          Walang manual na entry. Ayos lang — nasa files na ang opisyal na BIR schedule.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {visible.map(z => (
            <div key={z.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#e8f5ee" }}>{z.municipality} · {z.barangay}</p>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.45)" }}>
                  {z.street || "—"}{z.vicinity ? ` · ${z.vicinity}` : ""} · {classLabel(z.classification)} · {peso(z.pricePerSqm)}/sqm
                </p>
              </div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <button onClick={() => startEdit(z)} title="I-edit"
                  style={{ fontSize: 12, padding: "4px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>✏️</button>
                {confirmDel === z.id ? (
                  <>
                    <button onClick={() => doDelete(z.id)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: "#f87171", color: "#0a1a13" }}>Sigurado</button>
                    <button onClick={() => setConfirmDel(null)} style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.1)", color: "rgba(220,245,230,0.7)" }}>Hindi</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDel(z.id)} title="Burahin"
                    style={{ fontSize: 12, padding: "4px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(248,113,113,0.15)", color: "#f87171" }}>🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function BIRCalculatorPage({ isAdmin = false }) {
  const [mode, setMode] = useState("sale"); // "sale" | "donation" | "estate"
  const [sellingPrice, setSellingPrice] = useState("");
  const [zonalValue, setZonalValue] = useState("");
  const [fmvAssessor, setFmvAssessor] = useState("");
  const [transferRate, setTransferRate] = useState("0.75");
  const [regFeeMode, setRegFeeMode] = useState("auto");
  const [manualRegFee, setManualRegFee] = useState("");

  // Estate-only na inputs
  const [familyHome, setFamilyHome] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");

  // ── Zonal picker ──
  const [zIndex, setZIndex] = useState(null);      // /zonal/index.json
  const [zData, setZData] = useState(null);        // /zonal/<municipality>.json
  const [zLoading, setZLoading] = useState(false);
  const [zErr, setZErr] = useState("");
  const [zMun, setZMun] = useState("");
  const [zBrgy, setZBrgy] = useState("");
  const [zLoc, setZLoc] = useState("");
  const [zClass, setZClass] = useState("");
  const [area, setArea] = useState("");

  // Manual entries ng admin (maliit lang — ligtas i-listen)
  const [customList, setCustomList] = useState([]);

  const base = process.env.PUBLIC_URL || "";

  useEffect(() => {
    let alive = true;
    fetch(`${base}/zonal/index.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => { if (alive) setZIndex(j); })
      .catch(e => { if (alive) setZErr(`Hindi ma-load ang BIR zonal files: ${e.message}`); });
    return () => { alive = false; };
  }, [base]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "zonalValues"), (snap) => {
      setCustomList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("zonalValues listen error:", err));
    return () => unsub();
  }, []);

  // Kunin ang file ng napiling municipality (isang beses lang — naka-cache ng browser)
  useEffect(() => {
    if (!zMun || !zIndex) { setZData(null); return; }
    const entry = (zIndex.municipalities || []).find(m => m.municipality === zMun);
    if (!entry) { setZData(null); return; }   // manual-only na municipality
    let alive = true;
    setZLoading(true); setZErr("");
    fetch(`${base}/zonal/${entry.file}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => { if (alive) { setZData(j); setZLoading(false); } })
      .catch(e => { if (alive) { setZErr(`Hindi ma-load ang ${zMun}: ${e.message}`); setZLoading(false); } });
    return () => { alive = false; };
  }, [zMun, zIndex, base]);

  // ── Pagsasama ng BIR schedule + manual entries ──
  const customRows = useMemo(() => customList.map(z => ({
    municipality: z.municipality, barangay: z.barangay,
    street: z.street || "(Manual entry)", vicinity: z.vicinity || "",
    cls: z.classification, zv: z.pricePerSqm,
    isNew: false, deleted: false, custom: true,
  })), [customList]);

  const municipalities = useMemo(() => {
    const a = (zIndex?.municipalities || []).map(m => m.municipality);
    const b = customRows.map(r => r.municipality).filter(Boolean);
    return [...new Set([...a, ...b])].sort();
  }, [zIndex, customRows]);

  const brgyMap = useMemo(() => {
    const out = {};
    Object.entries(zData?.barangays || {}).forEach(([b, rows]) => { out[b] = [...rows]; });
    customRows.filter(r => r.municipality === zMun).forEach(r => {
      if (!out[r.barangay]) out[r.barangay] = [];
      out[r.barangay].push(r);
    });
    return out;
  }, [zData, customRows, zMun]);

  const barangays = useMemo(() => Object.keys(brgyMap).sort(), [brgyMap]);
  const rowsForBrgy = useMemo(() => brgyMap[zBrgy] || [], [brgyMap, zBrgy]);
  const locations = useMemo(() => [...new Set(rowsForBrgy.map(locKey))], [rowsForBrgy]);
  const locRows = rowsForBrgy.filter(r => locKey(r) === zLoc);
  const selected = locRows.find(r => r.cls === zClass) || null;
  const pricePerSqm = selected ? selected.zv : 0;
  const computedZonal = pricePerSqm * num(area);
  const applyZonal = () => { if (computedZonal > 0) setZonalValue(String(computedZonal)); };

  // ── Computation ──
  const sp = num(sellingPrice), zv = num(zonalValue), fmv = num(fmvAssessor);
  const taxBase = Math.max(sp, zv, fmv);

  // LRA Registration Fee — tinatayang katumbas ng graduated schedule.
  const computeRegFee = (value) => {
    if (value <= 0) return 0;
    if (value <= 1700) return 30;
    return Math.round(value * 0.0025 + 30);
  };

  // DST — ₱15 kada ₱1,000. Ang labis na kulang sa ₱1,000 ay bilang buong ₱1,000.
  const dst = taxBase > 0 ? Math.ceil(taxBase / 1000) * 15 : 0;
  const transfer = taxBase * (num(transferRate) / 100);
  const regFee = regFeeMode === "manual" ? num(manualRegFee) : computeRegFee(taxBase);

  // Estate deductions (TRAIN Law)
  const fhDeduction = Math.min(num(familyHome), FAMILY_HOME_CAP);
  const totalDeductions = STANDARD_DEDUCTION + fhDeduction + num(otherDeductions);
  const netEstate = Math.max(0, taxBase - totalDeductions);

  let breakdown = [];
  let totalBIR = 0;
  const totalLGU = transfer;
  const totalReg = regFee;

  if (mode === "sale") {
    const cgt = taxBase * 0.06;
    totalBIR = cgt + dst;
    breakdown = [
      { label: "Capital Gains Tax (6%)", who: "BIR", amt: cgt, note: "6% ng tax base" },
      { label: "Documentary Stamp Tax", who: "BIR", amt: dst, note: `₱15 kada ₱1,000 → ${Math.ceil(taxBase / 1000).toLocaleString("en-PH")} × ₱15` },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Provincial/City Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  } else if (mode === "donation") {
    const net = Math.max(0, taxBase - DONATION_EXEMPT);
    const donorsTax = net * 0.06;
    totalBIR = donorsTax + dst;
    breakdown = [
      { label: "Donor's Tax (6%)", who: "BIR", amt: donorsTax, note: `6% ng lampas sa ${peso(DONATION_EXEMPT)} taunang exempt` },
      { label: "Documentary Stamp Tax", who: "BIR", amt: dst, note: "I-verify sa RDO — iba ang aplikasyon sa donation" },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  } else {
    const estateTax = netEstate * 0.06;
    totalBIR = estateTax + dst;
    breakdown = [
      { label: "Estate Tax (6%)", who: "BIR", amt: estateTax, note: `6% ng net estate na ${peso(netEstate)}` },
      { label: "Documentary Stamp Tax", who: "BIR", amt: dst, note: "I-verify sa RDO — iba ang aplikasyon sa estate" },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  }
  const grandTotal = totalBIR + totalLGU + totalReg;

  const chip = (active) => ({
    flex: 1, fontSize: 12, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer",
    fontFamily: "inherit", fontWeight: 700, transition: "all 0.15s",
    background: active ? "#34d399" : "rgba(255,255,255,0.07)",
    color: active ? "#0a1a13" : "rgba(220,245,230,0.6)",
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

        {/* ── INPUTS ── */}
        <Card>
          <SectionHeader eyebrow="Transfer of Ownership" title="🧮 BIR Tax Calculator" />

          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[{ id: "sale", label: "💰 Sale" }, { id: "donation", label: "🎁 Donation" }, { id: "estate", label: "⚰️ Estate" }].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={chip(mode === m.id)}>{m.label}</button>
            ))}
          </div>

          {/* ── Zonal picker ── */}
          <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", marginBottom: 4 }}>📍 Zonal Value mula sa BIR schedule</p>
            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.45)", marginBottom: 10 }}>
              {zIndex ? `${zIndex.do} · Epektibo ${zIndex.effectivity} · ${zIndex.source}` : "Kinukuha ang files..."}
            </p>

            {zErr && (
              <p style={{ fontSize: 11, color: "#f87171", marginBottom: 10 }}>⚠️ {zErr}</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <select value={zMun} onChange={e => { setZMun(e.target.value); setZBrgy(""); setZLoc(""); setZClass(""); }}
                style={{ ...inputStyle, cursor: "pointer", fontSize: 13 }}>
                <option value="" style={optStyle}>— Municipality —</option>
                {municipalities.map(m => <option key={m} value={m} style={optStyle}>{m}</option>)}
              </select>

              <select value={zBrgy} onChange={e => { setZBrgy(e.target.value); setZLoc(""); setZClass(""); }}
                disabled={!zMun || zLoading} style={{ ...inputStyle, cursor: "pointer", fontSize: 13, opacity: zMun && !zLoading ? 1 : 0.5 }}>
                <option value="" style={optStyle}>{zLoading ? "Kinukuha..." : "— Barangay —"}</option>
                {barangays.map(b => <option key={b} value={b} style={optStyle}>{b}</option>)}
              </select>
            </div>

            <select value={zLoc} onChange={e => { setZLoc(e.target.value); setZClass(""); }}
              disabled={!zBrgy} style={{ ...inputStyle, cursor: "pointer", fontSize: 13, marginBottom: 10, opacity: zBrgy ? 1 : 0.5 }}>
              <option value="" style={optStyle}>— Street / Vicinity —</option>
              {locations.map(l => <option key={l} value={l} style={optStyle}>{l}</option>)}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginBottom: 10 }}>
              <select value={zClass} onChange={e => setZClass(e.target.value)}
                disabled={!zLoc} style={{ ...inputStyle, cursor: "pointer", fontSize: 13, opacity: zLoc ? 1 : 0.5 }}>
                <option value="" style={optStyle}>— Classification —</option>
                {locRows.map(r => (
                  <option key={r.cls} value={r.cls} style={optStyle}>
                    {classLabel(r.cls)} · {peso(r.zv)}/sqm{r.deleted ? " ⚠️" : ""}{r.custom ? " (manual)" : ""}
                  </option>
                ))}
              </select>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="Area (sqm)" inputMode="decimal" style={{ ...inputStyle, fontSize: 13 }} />
            </div>

            {selected?.deleted && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: "#f87171", lineHeight: 1.6 }}>
                  ⚠️ Ang classification na ito ay may markang <strong>**</strong> sa BIR schedule — <strong>tinanggal na / wala na</strong>.
                  May halaga pa ring nakalista, pero magkasalungat 'yon. <strong>I-verify sa RDO bago gamitin.</strong>
                </p>
              </div>
            )}

            {selected && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <p style={{ fontSize: 12, color: "#e8f5ee" }}>
                  {peso(pricePerSqm)}/sqm × {(num(area) || 0).toLocaleString("en-PH")} sqm = <strong style={{ color: "#60a5fa" }}>{peso(computedZonal)}</strong>
                </p>
                <button onClick={applyZonal} disabled={computedZonal <= 0}
                  style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#60a5fa", color: "#0a1a13", opacity: computedZonal > 0 ? 1 : 0.5 }}>
                  ⬇️ Gamitin
                </button>
              </div>
            )}
          </div>

          {/* ── Halaga ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>{mode === "sale" ? "💵 Selling Price / Consideration" : "💵 Declared Value / Consideration"}</label>
              <input value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>🏛️ Zonal Value (BIR)</label>
                <a href="https://www.bir.gov.ph/zonal-values" target="_blank" rel="noreferrer"
                  style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textDecoration: "none", background: "rgba(96,165,250,0.12)", padding: "4px 10px", borderRadius: 999 }}>
                  🔗 Tingnan sa BIR
                </a>
              </div>
              <input value={zonalValue} onChange={e => setZonalValue(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>📋 FMV — Assessor's (Tax Dec)</label>
              <input value={fmvAssessor} onChange={e => setFmvAssessor(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>

            {mode === "estate" && (
              <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24" }}>⚰️ Estate Deductions (TRAIN Law)</p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e8f5ee" }}>
                  <span>Standard Deduction</span><strong>{peso(STANDARD_DEDUCTION)}</strong>
                </div>
                <div>
                  <label style={labelStyle}>🏠 Family Home (max {peso(FAMILY_HOME_CAP)})</label>
                  <input value={familyHome} onChange={e => setFamilyHome(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>➕ Iba pang deductions</label>
                  <input value={otherDeductions} onChange={e => setOtherDeductions(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
                </div>
                <div style={{ borderTop: "1px solid rgba(251,191,36,0.2)", paddingTop: 10, fontSize: 12, color: "#e8f5ee" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Kabuuang deductions</span><strong>{peso(totalDeductions)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>Net estate</span><strong style={{ color: netEstate > 0 ? "#fbbf24" : "#34d399" }}>{peso(netEstate)}</strong></div>
                </div>
                <p style={{ fontSize: 10, color: "rgba(251,191,36,0.8)", lineHeight: 1.6 }}>
                  ⚠️ Ang estate tax ay sa <strong>BUONG estate</strong> — lahat ng ari-arian ng namatay, hindi lang itong isang lote.
                  Kung may iba pang lupa, bahay, sasakyan, o bank deposit, idagdag sa Declared Value sa taas. Kung ito lang ang kabuuan ng estate, tama na ito.
                </p>
              </div>
            )}

            <div>
              <label style={labelStyle}>🏢 Transfer Tax Rate (%) — LGU</label>
              <input value={transferRate} onChange={e => setTransferRate(e.target.value)} placeholder="0.75" inputMode="decimal" style={inputStyle} />
              <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 5 }}>Karaniwan: 0.50% (probinsya) – 0.75%. Iba-iba kada LGU.</p>
            </div>
            <div>
              <label style={labelStyle}>📝 Registration Fee</label>
              <div style={{ display: "flex", gap: 6, marginBottom: regFeeMode === "manual" ? 10 : 0 }}>
                <button onClick={() => setRegFeeMode("auto")} style={chip(regFeeMode === "auto")}>Auto (est.)</button>
                <button onClick={() => setRegFeeMode("manual")} style={chip(regFeeMode === "manual")}>Manual</button>
              </div>
              {regFeeMode === "manual" && (
                <input value={manualRegFee} onChange={e => setManualRegFee(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
              )}
            </div>
          </div>
        </Card>

        {/* ── RESULTS ── */}
        <Card>
          <SectionHeader eyebrow="Computation" title="📊 Breakdown ng Bayarin" />

          <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#60a5fa", marginBottom: 4 }}>TAX BASE (HIGHEST)</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#e8f5ee" }}>{peso(taxBase)}</p>
            <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)", marginTop: 4 }}>Pinakamataas sa Selling Price, Zonal Value, at FMV</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(0,0,0,0.18)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{b.label}</p>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.45)" }}>{b.who} · {b.note}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#34d399", flexShrink: 0 }}>{peso(b.amt)}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "rgba(220,245,230,0.7)", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total BIR</span><strong>{peso(totalBIR)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total LGU (Transfer Tax)</span><strong>{peso(totalLGU)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Registry of Deeds</span><strong>{peso(totalReg)}</strong></div>
          </div>

          <div style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#34d399", marginBottom: 6 }}>KABUUANG BABAYARAN (EST.)</p>
            <p style={{ fontSize: 32, fontWeight: 900, color: "#34d399" }}>{peso(grandTotal)}</p>
          </div>

          <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.7, marginTop: 16 }}>
            ⚠️ Tinatayang halaga lamang ito. Hindi kasama ang penalties, surcharges, notarial, IT fee, at iba pa.
            Ang eksaktong Registration Fee ay base sa opisyal na LRA schedule. Palaging i-verify sa BIR at Registry of Deeds.
          </p>
        </Card>
      </div>

      {isAdmin && <ZonalValueManager zonalList={customList} />}
    </div>
  );
}
