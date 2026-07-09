import React, { useState } from "react";

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
      {eyebrow && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 4 }}>{eyebrow}</p>}
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8f5ee" }}>{title}</h3>
    </div>
  );
}

// ── AGENTS PAGE (cases grouped by agent) ─────────────────────────────────────
// Tumatanggap ng helpers mula sa App.js (single source of truth ang data logic).
export default function AgentsPage({ caseStore, setActiveMenu, setSelectedClient, caseClientName, parseCaseKey, resolveTrackerKey }) {
  const [search, setSearch] = useState("");
  const entries = Object.entries(caseStore || {}).filter(([k]) => k.trim());

  // Group by agent
  const groups = {};
  entries.forEach(([key, d]) => {
    const agent = (d.agent || "").trim() || "— Walang Agent (Office/Walk-in) —";
    if (!groups[agent]) groups[agent] = [];
    groups[agent].push([key, d]);
  });
  const agentNames = Object.keys(groups)
    .filter(a => !search || a.toLowerCase().includes(search.toLowerCase()) || groups[a].some(([k]) => k.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => a.localeCompare(b));

  const typeBadge = (d) => {
    const k = resolveTrackerKey(d);
    if (k === "subdivision_approval_titled") return { t: "Approval (Titled)", c: "#fbbf24" };
    if (k === "subdivision_approval_taxdec") return { t: "Approval (Tax Dec)", c: "#fbbf24" };
    if (k === "relocation") return { t: "Relocation", c: "#60a5fa" };
    if (k === "segregation") return { t: "Segregation", c: "#60a5fa" };
    if (k === "subdivision") return { t: "Subdivision", c: "#60a5fa" };
    return { t: d.caseType || "Field Survey", c: "#60a5fa" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Card>
        <SectionHeader eyebrow="By Agent" title="👥 Agents & Kanilang Clients" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Hanapin ang agent o client..." className="form-input" style={{ marginBottom: 16 }} />

        {agentNames.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "24px 0" }}>Walang agent na natatagpuan. Maglagay ng Agent sa Create New Case.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {agentNames.map(agent => {
              const clients = groups[agent];
              return (
                <div key={agent} style={{ border: "1px solid rgba(167,139,250,0.25)", borderRadius: 16, background: "rgba(167,139,250,0.04)", padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#a78bfa" }}>👤 {agent}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,245,230,0.5)", background: "rgba(0,0,0,0.2)", borderRadius: 999, padding: "3px 10px" }}>{clients.length} client{clients.length > 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {clients.sort((a, b) => a[0].localeCompare(b[0])).map(([key, d]) => {
                      const badge = typeBadge(d);
                      const lot = d.lotNo || parseCaseKey(key).lot;
                      return (
                        <div key={key} onClick={() => { setSelectedClient(key); setActiveMenu("dashboard"); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{caseClientName(key)}{lot ? <span style={{ color: "#34d399", fontWeight: 600 }}> · 🏷️ Lot {lot}</span> : null}</p>
                            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>{d.propertyLocation ? "📍 " + d.propertyLocation : ""}{d.contact ? " · 📱 " + d.contact : ""}</p>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: badge.c, background: `${badge.c}22`, borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>{badge.t}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
