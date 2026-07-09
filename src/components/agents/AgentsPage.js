import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

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
export default function AgentsPage({ caseStore, setActiveMenu, setSelectedClient, caseClientName, parseCaseKey, resolveTrackerKey, isAdmin = false }) {
  const [search, setSearch] = useState("");
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ name: "", username: "", password: "", contact: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      setAgentAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.error(e));
    return () => unsub();
  }, []);

  const saveAgent = async () => {
    if (!f.name.trim() || !f.username.trim() || !f.password.trim()) { setMsg("Punan ang Name, Username, at Password."); return; }
    const uname = f.username.trim().toLowerCase();
    if (agentAccounts.some(a => (a.username || "").toLowerCase() === uname && a.id !== f.id)) { setMsg("May account na sa username na yan."); return; }
    const id = f.id || uname.replace(/[^a-z0-9]/g, "_");
    try {
      await setDoc(doc(db, "agents", id), { name: f.name.trim(), username: uname, password: f.password, contact: f.contact.trim(), role: "agent", createdAt: new Date().toLocaleDateString("en-PH") });
      setF({ name: "", username: "", password: "", contact: "" }); setShowAdd(false); setMsg("");
    } catch (e) { console.error(e); setMsg("May error sa pag-save."); }
  };
  const editAgent = (a) => { setF({ id: a.id, name: a.name, username: a.username, password: a.password, contact: a.contact || "" }); setShowAdd(true); setMsg(""); };
  const delAgent = async (id) => { if (window.confirm("Sigurado ka bang buburahin ang agent account na ito?")) { try { await deleteDoc(doc(db, "agents", id)); } catch (e) { console.error(e); } } };

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
      {/* ── AGENT ACCOUNTS (admin only) ── */}
      {isAdmin && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 4 }}>Agent Accounts</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8f5ee" }}>🔐 Agent Login Management</h3>
            </div>
            <button onClick={() => { setShowAdd(!showAdd); setF({ name: "", username: "", password: "", contact: "" }); setMsg(""); }}
              style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#a78bfa", color: "#0a1a13", whiteSpace: "nowrap" }}>
              {showAdd ? "✖ Isara" : "➕ Add Agent"}
            </button>
          </div>

          {showAdd && (
            <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Buong Pangalan *" className="form-input" />
                <input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="Contact Number" className="form-input" />
                <input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder="Username (ilo-login) *" className="form-input" />
                <input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Password *" className="form-input" />
              </div>
              {msg && <p style={{ fontSize: 12, color: "#fb7185", marginBottom: 8 }}>{msg}</p>}
              <button onClick={saveAgent} style={{ width: "100%", fontSize: 13, fontWeight: 700, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#34d399", color: "#0a1a13" }}>
                💾 {f.id ? "I-update ang Agent" : "Gumawa ng Agent Account"}
              </button>
              <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 8, lineHeight: 1.4 }}>
                Ibigay ang Username at Password sa agent. Pwede nilang palitan ang password mismo (🔑 sa header) pagkatapos mag-login.
              </p>
            </div>
          )}

          {agentAccounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "12px 0" }}>Wala pang agent account. Mag-add sa itaas. ☝️</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {agentAccounts.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#e8f5ee" }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)" }}>👤 {a.username}{a.contact ? " · 📱 " + a.contact : ""}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => editAgent(a)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(96,165,250,0.4)", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#60a5fa" }}>✏️ Edit</button>
                    <button onClick={() => delAgent(a.id)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: "rgba(251,113,133,0.15)", color: "#fb7185" }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
