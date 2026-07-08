import React, { useState, useEffect } from "react";
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

const CLASSIFICATIONS = [
  { id: "RR", label: "RR — Residential" },
  { id: "CR", label: "CR — Commercial" },
  { id: "A",  label: "A — Agricultural" },
  { id: "I",  label: "I — Industrial" },
  { id: "GC", label: "GC — General Commercial" },
  { id: "SR", label: "SR — Socialized Housing" },
  { id: "OTHER", label: "Iba pa" },
];

// ── ZONAL VALUE MANAGER (admin only) ─────────────────────────────────────────
function ZonalValueManager({ zonalList }) {
  const [municipality, setMunicipality] = useState("");
  const [barangay, setBarangay] = useState("");
  const [classification, setClassification] = useState("RR");
  const [pricePerSqm, setPricePerSqm] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [filter, setFilter] = useState("");

  const inputStyle = { width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, display: "block" };

  const num = (v) => Number(String(v).replace(/,/g, "")) || 0;
  const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const reset = () => { setMunicipality(""); setBarangay(""); setClassification("RR"); setPricePerSqm(""); setEditId(null); };

  const save = async () => {
    if (!municipality.trim() || !barangay.trim() || num(pricePerSqm) <= 0) {
      alert("Punan ang Municipality, Barangay, at ₱/sqm.");
      return;
    }
    setSaving(true);
    const id = editId || `${municipality.trim()}__${barangay.trim()}__${classification}`.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() + "_" + Date.now().toString().slice(-5);
    const data = {
      municipality: municipality.trim(),
      barangay: barangay.trim(),
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
    setMunicipality(z.municipality);
    setBarangay(z.barangay);
    setClassification(z.classification || "RR");
    setPricePerSqm(String(z.pricePerSqm));
  };

  const doDelete = async (id) => {
    try { await deleteDoc(doc(db, "zonalValues", id)); } catch (e) { console.error(e); }
    setConfirmDel(null);
  };

  const visible = zonalList
    .filter(z => !filter || `${z.municipality} ${z.barangay}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.municipality + a.barangay).localeCompare(b.municipality + b.barangay));

  return (
    <Card style={{ marginTop: 22 }}>
      <SectionHeader eyebrow="Admin — Zonal Value Database" title="🗺️ Manage Zonal Values" />

      {/* Add / Edit form */}
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
            <label style={labelStyle}>Classification</label>
            <select value={classification} onChange={e => setClassification(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CLASSIFICATIONS.map(c => <option key={c.id} value={c.id} style={{ background: "#0f2318" }}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>₱ per sqm</label>
            <input value={pricePerSqm} onChange={e => setPricePerSqm(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving}
            style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#34d399", color: "#0a1a13", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sine-save..." : editId ? "💾 I-update" : "➕ I-save"}
          </button>
          {editId && (
            <button onClick={reset} style={{ fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "rgba(220,245,230,0.7)" }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Search + list */}
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔍 Hanapin ang lugar..." style={{ ...inputStyle, marginBottom: 12 }} />
      <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 10 }}>{visible.length} entries</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {visible.length === 0 ? (
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "16px 0" }}>Wala pang zonal values. Magdagdag sa itaas. ☝️</p>
        ) : visible.map(z => (
          <div key={z.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{z.barangay}, {z.municipality}</p>
              <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)" }}>{z.classification} · {peso(z.pricePerSqm)}/sqm{z.updatedAt ? ` · ${z.updatedAt}` : ""}</p>
            </div>
            <button onClick={() => startEdit(z)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✏️</button>
            {confirmDel === z.id ? (
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => doDelete(z.id)} style={{ fontSize: 10, fontWeight: 700, padding: "5px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#fb7185", color: "#0a1a13" }}>Sigurado</button>
                <button onClick={() => setConfirmDel(null)} style={{ fontSize: 10, padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", background: "transparent", color: "rgba(220,245,230,0.6)" }}>Hindi</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(z.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.6)", fontSize: 14, padding: "0 4px" }}>🗑</button>
            )}
          </div>
        ))}
      </div>
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

  // Zonal DB (real-time)
  const [zonalList, setZonalList] = useState([]);
  const [zMun, setZMun] = useState("");
  const [zBrgy, setZBrgy] = useState("");
  const [zClass, setZClass] = useState("");
  const [area, setArea] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "zonalValues"), (snap) => {
      setZonalList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("zonalValues listen error:", err));
    return () => unsub();
  }, []);

  const peso = (n) => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (v) => Number(String(v).replace(/,/g, "")) || 0;

  // Auto-fill options
  const municipalities = [...new Set(zonalList.map(z => z.municipality))].sort();
  const barangays = [...new Set(zonalList.filter(z => z.municipality === zMun).map(z => z.barangay))].sort();
  const classes = zonalList.filter(z => z.municipality === zMun && z.barangay === zBrgy);
  const selectedZonal = zonalList.find(z => z.municipality === zMun && z.barangay === zBrgy && z.classification === zClass);
  const pricePerSqm = selectedZonal ? selectedZonal.pricePerSqm : 0;
  const computedZonal = pricePerSqm * num(area);

  const applyZonal = () => {
    if (computedZonal > 0) setZonalValue(String(computedZonal));
  };

  const sp = num(sellingPrice), zv = num(zonalValue), fmv = num(fmvAssessor);
  const taxBase = Math.max(sp, zv, fmv);

  const computeRegFee = (value) => {
    if (value <= 0) return 0;
    if (value <= 1700) return 30;
    return Math.round(value * 0.0025 + 30);
  };

  let breakdown = [];
  let totalBIR = 0, totalLGU = 0, totalReg = 0;
  const transfer = taxBase * (num(transferRate) / 100);
  const dst = taxBase * 0.015;
  const regFee = regFeeMode === "manual" ? num(manualRegFee) : computeRegFee(taxBase);

  if (mode === "sale") {
    const cgt = taxBase * 0.06;
    totalBIR = cgt + dst; totalLGU = transfer; totalReg = regFee;
    breakdown = [
      { label: "Capital Gains Tax (6%)", who: "BIR", amt: cgt, note: "6% ng tax base" },
      { label: "Documentary Stamp Tax (1.5%)", who: "BIR", amt: dst, note: "1.5% ng tax base" },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Provincial/City Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  } else if (mode === "donation") {
    const net = Math.max(0, taxBase - 250000);
    const donorsTax = net * 0.06;
    totalBIR = donorsTax + dst; totalLGU = transfer; totalReg = regFee;
    breakdown = [
      { label: "Donor's Tax (6%)", who: "BIR", amt: donorsTax, note: "6% ng lampas sa ₱250,000 exempt" },
      { label: "Documentary Stamp Tax (1.5%)", who: "BIR", amt: dst, note: "1.5% ng tax base" },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  } else {
    const net = Math.max(0, taxBase - 200000);
    const estateTax = net * 0.06;
    totalBIR = estateTax + dst; totalLGU = transfer; totalReg = regFee;
    breakdown = [
      { label: "Estate Tax (6%)", who: "BIR", amt: estateTax, note: "6% ng net estate (simplified)" },
      { label: "Documentary Stamp Tax (1.5%)", who: "BIR", amt: dst, note: "1.5% ng tax base" },
      { label: `Transfer Tax (${transferRate}%)`, who: "LGU / Provincial", amt: transfer, note: "Treasurer" },
      { label: "Registration Fee", who: "Registry of Deeds", amt: regFee, note: regFeeMode === "manual" ? "Manual entry" : "Tinatayang LRA schedule" },
    ];
  }

  const grandTotal = totalBIR + totalLGU + totalReg;

  const inputStyle = { width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* ── INPUTS ── */}
        <Card>
          <SectionHeader eyebrow="Transfer of Ownership" title="🧮 BIR Tax Calculator" />

          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[
              { id: "sale", label: "💰 Sale" },
              { id: "donation", label: "🎁 Donation" },
              { id: "estate", label: "⚰️ Estate" },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ flex: 1, fontSize: 12, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all 0.15s",
                  background: mode === m.id ? "#34d399" : "rgba(255,255,255,0.07)", color: mode === m.id ? "#0a1a13" : "rgba(220,245,230,0.6)" }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Zonal auto-fill (kung may data) */}
          {zonalList.length > 0 && (
            <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", marginBottom: 10 }}>📍 Auto-fill Zonal Value mula sa database</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <select value={zMun} onChange={e => { setZMun(e.target.value); setZBrgy(""); setZClass(""); }} style={{ ...inputStyle, cursor: "pointer", fontSize: 13 }}>
                  <option value="" style={{ background: "#0f2318" }}>— Municipality —</option>
                  {municipalities.map(m => <option key={m} value={m} style={{ background: "#0f2318" }}>{m}</option>)}
                </select>
                <select value={zBrgy} onChange={e => { setZBrgy(e.target.value); setZClass(""); }} disabled={!zMun} style={{ ...inputStyle, cursor: "pointer", fontSize: 13, opacity: zMun ? 1 : 0.5 }}>
                  <option value="" style={{ background: "#0f2318" }}>— Barangay —</option>
                  {barangays.map(b => <option key={b} value={b} style={{ background: "#0f2318" }}>{b}</option>)}
                </select>
                <select value={zClass} onChange={e => setZClass(e.target.value)} disabled={!zBrgy} style={{ ...inputStyle, cursor: "pointer", fontSize: 13, opacity: zBrgy ? 1 : 0.5 }}>
                  <option value="" style={{ background: "#0f2318" }}>— Classification —</option>
                  {classes.map(c => <option key={c.id} value={c.classification} style={{ background: "#0f2318" }}>{c.classification} · {peso(c.pricePerSqm)}/sqm</option>)}
                </select>
                <input value={area} onChange={e => setArea(e.target.value)} placeholder="Area (sqm)" inputMode="decimal" style={{ ...inputStyle, fontSize: 13 }} />
              </div>
              {selectedZonal && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "#e8f5ee" }}>{peso(pricePerSqm)}/sqm × {num(area) || 0} = <strong style={{ color: "#60a5fa" }}>{peso(computedZonal)}</strong></p>
                  <button onClick={applyZonal} disabled={computedZonal <= 0} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#60a5fa", color: "#0a1a13", opacity: computedZonal > 0 ? 1 : 0.5 }}>
                    ⬇️ Gamitin
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>{mode === "sale" ? "💵 Selling Price / Consideration" : "💵 Declared Value / Consideration"}</label>
              <input value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>🏛️ Zonal Value (BIR)</label>
                <a href="https://www.bir.gov.ph/zonal-values" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textDecoration: "none", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                  🔗 Tingnan sa BIR
                </a>
              </div>
              <input value={zonalValue} onChange={e => setZonalValue(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>📋 FMV — Assessor's (Tax Dec)</label>
              <input value={fmvAssessor} onChange={e => setFmvAssessor(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>🏢 Transfer Tax Rate (%) — LGU</label>
              <input value={transferRate} onChange={e => setTransferRate(e.target.value)} placeholder="0.75" inputMode="decimal" style={inputStyle} />
              <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 4 }}>Karaniwan: 0.50% (probinsya) – 0.75%. Iba-iba kada LGU.</p>
            </div>
            <div>
              <label style={labelStyle}>📝 Registration Fee</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => setRegFeeMode("auto")} style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, background: regFeeMode === "auto" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.07)", color: regFeeMode === "auto" ? "#34d399" : "rgba(220,245,230,0.6)" }}>Auto (est.)</button>
                <button onClick={() => setRegFeeMode("manual")} style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, background: regFeeMode === "manual" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.07)", color: regFeeMode === "manual" ? "#34d399" : "rgba(220,245,230,0.6)" }}>Manual</button>
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

          <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tax Base (highest)</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#e8f5ee", marginTop: 2 }}>{peso(taxBase)}</p>
            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 2 }}>Pinakamataas sa Selling Price, Zonal Value, at FMV</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{b.label}</p>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 2 }}>{b.who} · {b.note}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#34d399", whiteSpace: "nowrap" }}>{peso(b.amt)}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(220,245,230,0.6)" }}>
              <span>Total BIR</span><span style={{ fontWeight: 700 }}>{peso(totalBIR)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(220,245,230,0.6)" }}>
              <span>Total LGU (Transfer Tax)</span><span style={{ fontWeight: 700 }}>{peso(totalLGU)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(220,245,230,0.6)" }}>
              <span>Registry of Deeds</span><span style={{ fontWeight: 700 }}>{peso(totalReg)}</span>
            </div>
          </div>

          <div style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 16, padding: "16px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.1em" }}>Kabuuang Babayaran (Est.)</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#34d399", marginTop: 4 }}>{peso(grandTotal)}</p>
          </div>

          <p style={{ fontSize: 10, color: "rgba(251,191,36,0.7)", marginTop: 14, lineHeight: 1.5 }}>
            ⚠️ Tinatayang halaga lamang ito. Hindi kasama ang penalties, surcharges, notarial, IT fee, at iba pa. Ang eksaktong Registration Fee ay base sa opisyal na LRA schedule. Palaging i-verify sa BIR at Registry of Deeds.
          </p>
        </Card>
      </div>

      {/* Admin-only zonal manager */}
      {isAdmin && <ZonalValueManager zonalList={zonalList} />}
    </div>
  );
}
