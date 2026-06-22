import React, { useState, useRef, useEffect } from "react";

// ── LOCALSTORAGE HELPERS ───────────────────────────────────────────────────────
const LS = {
  get: (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ── AUTH ───────────────────────────────────────────────────────────────────────
const ADMIN_ACCOUNTS = [
  { email: "e.b.bernassurveying@gmail.com", password: "Ebernas2026!", name: "Engr. Eugene Benedict Bernas", role: "admin" },
  { email: "admin2@ebernas.com", password: "Admin2026!", name: "Admin 2", role: "admin" },
];

function getEmployees() { return LS.get("eb_employees", []); }
function saveEmployees(list) { LS.set("eb_employees", list); }

function findUser(email, password) {
  const all = [...ADMIN_ACCOUNTS, ...getEmployees()];
  return all.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password) || null;
}

function registerEmployee(name, email, password) {
  const all = [...ADMIN_ACCOUNTS, ...getEmployees()];
  if (all.find((u) => u.email.toLowerCase() === email.toLowerCase())) return { error: "Email already registered." };
  const emps = getEmployees();
  emps.push({ email, password, name, role: "employee", approved: false, registeredAt: new Date().toLocaleDateString("en-PH") });
  saveEmployees(emps);
  return { success: true };
}

// ── LOGIN / REGISTER PAGE ─────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = () => {
    if (!email || !password) { setError("Ilagay ang email at password."); return; }
    setLoading(true); setError("");
    setTimeout(() => {
      const user = findUser(email, password);
      setLoading(false);
      if (!user) { setError("Mali ang email o password. Subukan ulit."); return; }
      if (user.role === "employee" && !user.approved) { setError("Hindi pa approved ang iyong account. Antayin ang Admin."); return; }
      onLogin({ email: user.email, role: user.role, displayName: user.name });
    }, 600);
  };

  const handleRegister = () => {
    if (!email || !password || !name) { setError("Punan ang lahat ng fields."); return; }
    if (password.length < 6) { setError("Password — minimum 6 characters."); return; }
    setLoading(true); setError("");
    setTimeout(() => {
      const result = registerEmployee(name, email, password);
      setLoading(false);
      if (result.error) { setError(result.error); return; }
      setSuccess("✓ Account created! Hintayin ang Admin approval bago makapag-login.");
      setMode("login"); setPassword(""); setEmail(""); setName("");
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a1a13", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🏛️</div>
          <p style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#34d399", fontWeight: 600 }}>E.B. Bernas Land Consultancy</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 6 }}>Employee Portal</h1>
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.4)", marginTop: 4 }}>No. 051, Brgy. Garrita, Bani, Pangasinan</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 24, padding: 28 }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 4, marginBottom: 24 }}>
            {["login","register"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#0a1a13" : "rgba(220,245,230,0.5)",
                  transition: "all 0.15s" }}>
                {m === "login" ? "🔑 Login" : "📝 Register"}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && <div style={{ background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#6ee7b7", marginBottom: 16 }}>{success}</div>}

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && (
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address" type="email"
              style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" type="password"
              onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
              style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
          </div>

          <button
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 14, border: "none", background: loading ? "rgba(255,255,255,0.5)" : "#fff", color: "#0a1a13", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "opacity 0.15s" }}>
            {loading ? "Sandali lang..." : mode === "login" ? "Login" : "Create Account"}
          </button>

          {mode === "register" && (
            <p style={{ fontSize: 11, color: "rgba(220,245,230,0.35)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
              Ang iyong account ay kailangang i-approve ng Admin bago makapasok sa portal.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SERVICE FOLDER TEMPLATES ─────────────────────────────────────────────────
const serviceFolderTemplates = {

  "Segregation": [
    "📁 Client Profile","📁 Property Documents","📁 Segregation Documents",
    "📁 Survey Records","📁 Tax / BIR Documents","📁 Official Receipts",
    "📁 Client Visible Files","📁 Internal Only","📁 Final Release",
  ],
  "Subdivision – Titled Property": [
    "📁 Client Profile",
    "📁 Owner's Duplicate Title (OCT/TCT)",
    "📁 Tax Declaration",
    "📁 Approved Subdivision Plan",
    "📁 Survey Records & Technical Descriptions",
    "📁 Transfer Certificate of Title (New Titles)",
    "📁 Official Receipts",
    "📁 Client Visible Files",
    "📁 Internal Only",
    "📁 Final Release",
  ],
  "Subdivision – Tax Declaration Only": [
    "📁 Client Profile","📁 Tax Declaration (Mother TD)","📁 Affidavit / Extra-Judicial Settlement",
    "📁 Sketch Plan / Subdivision Plan","📁 BLGF / Assessor's Office Documents",
    "📁 Barangay Certification","📁 DENR Survey Authority","📁 New Tax Declarations (Per Lot)",
    "📁 Official Receipts","📁 Client Visible Files","📁 Internal Only","📁 Final Release",
  ],
  "Relocation Plan – Titled Property": [
    "📁 Client Profile","📁 Owner's Duplicate Title (OCT/TCT)","📁 Tax Declaration",
    "📁 Relocation Plan Documents","📁 Site Photos","📁 Survey Records",
    "📁 BIR Clearance / CAR","📁 Official Receipts",
    "📁 Client Visible Files","📁 Internal Only","📁 Final Release",
  ],
  "Relocation Plan – Not Titled (Tax Dec)": [
    "📁 Client Profile","📁 Tax Declaration","📁 Affidavit of Ownership",
    "📁 Relocation Plan Documents","📁 Site Photos","📁 Assessor's Office Documents",
    "📁 Barangay Certification","📁 DENR Survey Authority","📁 Official Receipts",
    "📁 Client Visible Files","📁 Internal Only","📁 Final Release",
  ],
  "Titling": [
    "📁 Client Profile","📁 Property Documents","📁 Title Verification",
    "📁 Supporting Affidavits","📁 Tax / BIR Documents","📁 Official Receipts",
    "📁 Client Visible Files","📁 Internal Only","📁 Final Release",
  ],
};

// ── REQUIREMENTS PER SERVICE ──────────────────────────────────────────────────
const serviceRequirements = {

  "Segregation": [
    "Mother Title (OCT/TCT)","Tax Declaration","Valid IDs of All Parties",
    "Survey Request Form","Segregation Plan (DENR Approved)","Tax Clearance",
    "🧾 OR – Survey Fee","🧾 OR – Filing Fee",
  ],
  "Subdivision – Titled Property": [
    "── LRA / DENR SUBMISSION",
    "TCT / OCT (Owner's Duplicate Certificate of Title)",
    "── COMPLETE SURVEY RETURN",
    "Plan",
    "Lot Data Computation",
    "Field Notes",
    "Traverse",
    "Deed of Sale (if applicable)",
    "Confirmation of Subdivision",
    "🧾 OR – LRA / DENR Submission Fee",
    "── OTHER DOCUMENTS",
  ],
  "Subdivision – Tax Declaration Only": [
    "── SURVEY AUTHORITY",
    "Tax Declaration",
    "Barangay Clearance",
    "Court Clearance",
    "Deed of Sale (if applicable)",
    "Inspection Report",
    "Lot Status",
    "── SURVEY RETURNS",
    "Plan",
    "Lot Data Computation",
    "Traverse Computation",
    "Field Notes",
    "── OTHER DOCUMENTS",
  ],
  "Relocation Plan – Titled Property": [
    "TCT / OCT (Photocopy)",
    "Barangay Notice",
    "Approved Plan (if applicable)",
    "🧾 OR – Relocation Fee",
  ],

  "Relocation Plan – Not Titled (Tax Dec)": [
    "Barangay Notice",
    "Approved Plan (if applicable)",
    "Tax Declaration",
    "🧾 OR – Relocation Fee",
  ],
  "Titling": [
    "Tax Declaration (Mother TD)","Tax Clearance / RPT Receipt","Valid IDs of Applicant",
    "DENR Survey Authority","Approved Survey Plan","Affidavit of Ownership",
    "Barangay / Municipal Certification","Publication Requirements (if needed)",
    "🧾 OR – DENR / Survey Fee","🧾 OR – LRA Filing Fee",
  ],
};

// ── INITIAL DATA ─────────────────────────────────────────────────────────────
const INIT_CASES = {
  "Santos Family": {
    caseType: "Titling", lotNo: "Lot 2680-A", propertyLocation: "Lipa, Batangas",
    overallStatus: "Awaiting BIR Clearance", progress: 78,
    remarks: "Title documents are mostly complete. Waiting for BIR clearance and signed tax forms before final routing.",
    currentLocation: "BIR clearance processing and internal review desk",
    dateOfSurvey: "2026-02-10", dateOfSubmittal: "2026-03-01",
    missingItems: ["Signed tax forms", "Clearer copy of authorization letter"],
    checklist: [
      { name: "Client Information Form", status: "Completed" },
      { name: "Title Copy", status: "Completed" },
      { name: "Valid IDs", status: "For Review" },
      { name: "Tax Declaration", status: "Completed" },
      { name: "BIR Clearance", status: "Pending" },
      { name: "Registry of Deeds Filing", status: "Not Started" },
    ],
  },
  "Reyes Family": {
    caseType: "Segregation", lotNo: "Lot 2680-B", propertyLocation: "San Pablo, Laguna",
    overallStatus: "Documents Submitted", progress: 56,
    remarks: "Segregation file submitted and under document validation before survey coordination.",
    currentLocation: "Document validation and survey scheduling",
    dateOfSurvey: "2026-03-15", dateOfSubmittal: "2026-03-10",
    missingItems: ["Updated survey request form"],
    checklist: [
      { name: "Client Information Form", status: "Completed" },
      { name: "Mother Title Copy", status: "Completed" },
      { name: "Tax Declaration", status: "Completed" },
      { name: "Survey Request", status: "Pending" },
      { name: "Segregation Plan", status: "For Review" },
      { name: "Final Approval Routing", status: "Not Started" },
    ],
  },
  "Cruz Estate": {
    caseType: "Subdivision – Titled Property", lotNo: "Lot 4521-C", propertyLocation: "Tarlac City",
    overallStatus: "Survey Scheduled", progress: 91,
    remarks: "Subdivision papers almost complete. Survey confirmed and final technical review is next.",
    currentLocation: "Survey team coordination and final technical review",
    dateOfSurvey: "2026-03-25", dateOfSubmittal: "2026-03-05",
    missingItems: ["Signed owner consent"],
    checklist: [
      { name: "Client Information Form", status: "Completed" },
      { name: "Subdivision Plan", status: "Completed" },
      { name: "Survey Records", status: "Completed" },
      { name: "Technical Plans", status: "Completed" },
      { name: "Owner Consent", status: "Pending" },
      { name: "Final Release Preparation", status: "For Review" },
    ],
  },
};

const CLIENT_FOLDERS = {
  "Santos Family": [
    { name: "Client Profile", count: 3 }, { name: "Property Documents", count: 6 },
    { name: "Transfer Documents", count: 4 }, { name: "Tax / BIR Documents", count: 5 },
    { name: "Official Receipts", count: 2 }, { name: "Signed Copies", count: 2 },
  ],
  "Reyes Family": [
    { name: "Client Profile", count: 2 }, { name: "Property Documents", count: 4 },
    { name: "Segregation Documents", count: 3 }, { name: "Tax / BIR Documents", count: 2 },
    { name: "Official Receipts", count: 1 }, { name: "Returned Files", count: 1 },
  ],
  "Cruz Estate": [
    { name: "Client Profile", count: 4 }, { name: "Subdivision Documents", count: 7 },
    { name: "Survey Records", count: 3 }, { name: "Tax / BIR Documents", count: 2 },
    { name: "Official Receipts", count: 3 }, { name: "Final Release", count: 1 },
  ],
};

const ALL_CASES = [
  { title: "Titling - Santos Property", client: "Santos Family", lotNo: "Lot 2680-A", location: "Lipa, Batangas", stage: "In Progress", status: "Awaiting BIR Clearance", tone: "amber" },
  { title: "Segregation - Reyes Lot", client: "Reyes Family", lotNo: "Lot 2680-B", location: "San Pablo, Laguna", stage: "For Review", status: "Documents Submitted", tone: "blue" },
  { title: "Subdivision - Cruz Estate", client: "Cruz Estate", lotNo: "Lot 4521-C", location: "Tarlac City", stage: "Ongoing", status: "Survey Scheduled", tone: "green" },
];

const INIT_MESSAGES = [
  { id: 1, to: "Santos Family", channel: "SMS / Email", subject: "Document Approved", status: "Ready to Send", body: "Your document has been approved and is ready for next steps.", date: "Mar 20, 2026" },
  { id: 2, to: "Reyes Family", channel: "Portal Notice", subject: "For Resubmission", status: "Sent", body: "Please resubmit the updated survey request form at your earliest convenience.", date: "Mar 19, 2026" },
  { id: 3, to: "Cruz Estate", channel: "SMS / Email", subject: "Survey Schedule Update", status: "Draft", body: "Your survey has been scheduled. Our team will coordinate with you shortly.", date: "Mar 18, 2026" },
];

const INIT_FILES = [
  { id: 1, name: "Santos_Title_Copy.pdf", folder: "Property Documents", type: "Property Document", date: "Mar 18, 2026", by: "Maria", review: "Approved", isReceipt: false },
  { id: 2, name: "Valid_ID_Buyer.jpg", folder: "Client Profile", type: "Client Document", date: "Mar 18, 2026", by: "Joseph", review: "For Review", isReceipt: false },
  { id: 3, name: "Tax_Declaration_Copy.pdf", folder: "Tax / BIR Documents", type: "Tax Document", date: "Mar 17, 2026", by: "Angela", review: "Approved", isReceipt: false },
  { id: 4, name: "OR_BIR_Payment.pdf", folder: "Official Receipts", type: "Official Receipt", date: "Mar 16, 2026", by: "Paolo", review: "Approved", isReceipt: true },
];



// ── HELPERS ───────────────────────────────────────────────────────────────────
const toneBadge = (t) => ({ amber: "badge-amber", blue: "badge-blue", green: "badge-green" }[t] || "badge-neutral");
const statusBadge = (s) => ({
  Completed: "badge-green", Pending: "badge-amber", "For Review": "badge-blue",
  "Not Started": "badge-neutral", Uploaded: "badge-violet", Missing: "badge-rose",
  "For Resubmission": "badge-amber", Approved: "badge-green",
  "Ready to Send": "badge-blue", Sent: "badge-green", Draft: "badge-neutral",
  "On File": "badge-green", Needed: "badge-rose",
}[s] || "badge-neutral");

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return iso; }
};

const todayStr = () => new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
function Badge({ label, variant }) { return <span className={`badge ${variant}`}>{label}</span>; }

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
      <div><p className="eyebrow">{eyebrow}</p><h3 className="section-title">{title}</h3></div>
      {action}
    </div>
  );
}

function Card({ children, style = {} }) {
  return <div className="card" style={style}>{children}</div>;
}

function InfoBlock({ label, value }) {
  return (
    <div className="info-block">
      <p className="info-label">{label}</p>
      <p className="info-value">{value || "—"}</p>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewPage({ caseStore }) {
  const [avgResponse, setAvgResponse] = useState("< 15 min");
  const [editAvg, setEditAvg] = useState(false);

  const clients = Object.keys(caseStore);
  const activeFiles = clients.length;
  const pendingDocs = clients.reduce((acc, c) => acc + (caseStore[c].checklist?.filter(i => i.status !== "Completed").length || 0), 0);
  const completedTransfers = clients.reduce((acc, c) => acc + (caseStore[c].checklist?.filter(i => i.status === "Completed").length || 0), 0);

  return (
    <div style={{ display: "grid", gap: 22, gridTemplateColumns: "1.2fr 0.8fr" }}>
      <Card>
        <SectionHeader eyebrow="Overview / Company Profile" title="E.B. Bernas Land Consultancy" />
        <p className="body-text" style={{ marginBottom: 18 }}>
          A licensed land survey and consultancy firm providing comprehensive land documentation, case handling, property records coordination, and transaction processing services.
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <InfoBlock label="Office Address" value="No. 051, Barangay Garrita, Municipality of Bani, Pangasinan, Region I" />
          <InfoBlock label="License / Authorization" value="Licensed Geodetic Engineer since 2011. Authorized by the Lands Management Bureau until October 20, 2028." />
          <InfoBlock label="Main Services" value="Transfer, Segregation, Subdivision (Titled / Tax Dec), Relocation Plan (Titled / Not Titled), Titling, and All Kinds of Survey." />
          <div className="info-block">
            <p className="info-label">Contact Information</p>
            <p className="info-value">📧 e.b.bernassurveying@gmail.com</p>
            <p className="info-value" style={{ marginTop: 4 }}>📱 09176525851</p>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div><p className="eyebrow">Company Snapshot</p><h3 className="section-title">Key Metrics</h3></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="stat-card">
              <span className="stat-icon">📁</span>
              <p className="stat-value">{activeFiles}</p>
              <p className="stat-label">Active Client Files</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⏳</span>
              <p className="stat-value" style={{ color: "#fb7185" }}>{pendingDocs}</p>
              <p className="stat-label">Pending Items</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">✅</span>
              <p className="stat-value" style={{ color: "#34d399" }}>{completedTransfers}</p>
              <p className="stat-label">Completed Items</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⚡</span>
              {editAvg ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <input value={avgResponse} onChange={(e) => setAvgResponse(e.target.value)}
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "4px 8px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%" }} />
                  <button onClick={() => setEditAvg(false)} className="btn-primary" style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}>✓</button>
                </div>
              ) : (
                <p className="stat-value" onClick={() => setEditAvg(true)} style={{ cursor: "pointer" }}>{avgResponse}</p>
              )}
              <p className="stat-label">Avg. Response Time {!editAvg && <span style={{ fontSize: 9, opacity: 0.5 }}>(click to edit)</span>}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Quick Info</p>
          {[
            "Go to Checklist Tracker to manage status per client.",
            "Go to Schedule to add surveys, appointments & deadlines.",
            "Go to Create New Case to register a new client.",
          ].map((t) => (
            <div key={t} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "#fbbf24", flexShrink: 0 }}>→</span>
              <p style={{ fontSize: 12, color: "rgba(220,245,230,0.6)", lineHeight: 1.6 }}>{t}</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({ client, caseStore, setCaseStore }) {
  const data = caseStore[client] || caseStore["Santos Family"];

  const toggle = (idx) => {
    const updated = data.checklist.map((item, i) =>
      i === idx ? { ...item, status: item.status === "Completed" ? "Pending" : "Completed" } : item
    );
    setCaseStore((p) => ({ ...p, [client]: { ...data, checklist: updated } }));
  };

  const setField = (f, v) => setCaseStore((p) => ({ ...p, [client]: { ...data, [f]: v } }));

  const done = data.checklist.filter((c) => c.status === "Completed").length;
  const pct = Math.round((done / data.checklist.length) * 100);

  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1.1fr 0.9fr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div><p className="eyebrow">Client Case Dashboard</p><h3 className="section-title">{client}</h3></div>
            <Badge label={data.caseType} variant="badge-amber" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoBlock label="Lot Number" value={data.lotNo} />
            <InfoBlock label="Overall Status" value={data.overallStatus} />
            <div className="info-block" style={{ gridColumn: "1 / -1" }}>
              <p className="info-label">Property Location</p>
              <p className="info-value">{data.propertyLocation}</p>
            </div>
          </div>

          {/* DATE FIELDS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div className="info-block">
              <p className="info-label">📅 Date of Survey</p>
              <input type="date" value={data.dateOfSurvey || ""} onChange={(e) => setField("dateOfSurvey", e.target.value)} className="form-input" style={{ marginTop: 6 }} />
              {data.dateOfSurvey && <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>{fmtDate(data.dateOfSurvey)}</p>}
            </div>
            <div className="info-block">
              <p className="info-label">📋 Date of Submittal of Papers</p>
              <input type="date" value={data.dateOfSubmittal || ""} onChange={(e) => setField("dateOfSubmittal", e.target.value)} className="form-input" style={{ marginTop: 6 }} />
              {data.dateOfSubmittal && <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>{fmtDate(data.dateOfSubmittal)}</p>}
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            eyebrow="Case Checklist"
            title="Requirement and process tracker"
            action={<span style={{ fontSize: 12, color: "rgba(220,245,230,0.45)" }}>{done}/{data.checklist.length} done</span>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.checklist.map((item, i) => (
              <button key={item.name + i} onClick={() => toggle(i)} className="checklist-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`check-box ${item.status === "Completed" ? "checked" : ""}`}>
                    {item.status === "Completed" && "✓"}
                  </span>
                  <p style={{ fontSize: 13, fontWeight: 500, textDecoration: item.status === "Completed" ? "line-through" : "none", opacity: item.status === "Completed" ? 0.4 : 1 }}>
                    {item.name}
                  </p>
                </div>
                <Badge label={item.status} variant={statusBadge(item.status)} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Card>
          <SectionHeader eyebrow="Status & Remarks" title="Current case condition" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="info-block">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <p className="info-label">Overall Progress</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{pct}%</p>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            </div>
            <InfoBlock label="Remarks" value={data.remarks} />
            <InfoBlock label="Nasaan Na Ang Documents" value={data.currentLocation} />
            <div className="info-block">
              <p className="info-label" style={{ marginBottom: 10 }}>Mga Kulang</p>
              {data.missingItems.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", padding: "8px 14px", marginBottom: 6 }}>
                  <p style={{ fontSize: 13 }}>{item}</p>
                  <Badge label="Missing" variant="badge-rose" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── CASES ─────────────────────────────────────────────────────────────────────
function CasesPage({ setClient, setMenu, search, setSearch }) {
  const filtered = ALL_CASES.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.client.toLowerCase().includes(q) || c.lotNo.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });
  return (
    <Card>
      <SectionHeader
        eyebrow="Assigned Client Files"
        title="Assigned case workload"
        action={<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client or lot no." className="search-input" style={{ width: 200 }} />}
      />
      {filtered.length === 0 && <p style={{ textAlign: "center", padding: "48px 0", color: "rgba(220,245,230,0.3)", fontSize: 14 }}>No cases found for "{search}"</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {filtered.map((c) => (
          <button key={c.title} onClick={() => { setClient(c.client); setMenu("dashboard"); }} className="case-card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ textAlign: "left" }}>
                <h4 style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{c.title}</h4>
                <p style={{ fontSize: 12, color: "rgba(220,245,230,0.55)", marginTop: 5 }}>{c.client} · {c.lotNo}</p>
                <p style={{ fontSize: 11, color: "rgba(220,245,230,0.35)", marginTop: 2 }}>{c.location}</p>
              </div>
              <Badge label={c.status} variant={toneBadge(c.tone)} />
            </div>
            <InfoBlock label="Current Stage" value={c.stage} />
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── REQUIREMENTS PANEL ───────────────────────────────────────────────────────
function RequirementsPanel({ caseType, files, baseReqs }) {
  const [otherDocs, setOtherDocs] = useState([]);
  const [newDoc, setNewDoc] = useState("");

  const addOther = () => {
    if (!newDoc.trim()) return;
    setOtherDocs((p) => [...p, newDoc.trim()]);
    setNewDoc("");
  };

  const removeOther = (i) => setOtherDocs((p) => p.filter((_, idx) => idx !== i));

  // Split base reqs into sections
  const sections = [];
  let currentSection = { header: null, items: [] };
  for (const req of baseReqs) {
    if (req.startsWith("──")) {
      if (currentSection.items.length || currentSection.header) sections.push(currentSection);
      currentSection = { header: req.replace("──", "").trim(), items: [] };
    } else {
      currentSection.items.push(req);
    }
  }
  if (currentSection.items.length || currentSection.header) sections.push(currentSection);

  return (
    <Card>
      <SectionHeader eyebrow="Requirements Checklist" title={`Documents needed — ${caseType}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {sections.map((section) => (
          <div key={section.header || "main"}>
            {section.header && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#fbbf24" }}>
                  {section.header}
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(251,191,36,0.2)" }} />
              </div>
            )}
            {section.header === "OTHER DOCUMENTS" ? (
              <div>
                {/* Add input */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input
                    value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                    placeholder="Add other document…"
                    className="form-input"
                    onKeyDown={(e) => e.key === "Enter" && addOther()}
                  />
                  <button onClick={addOther} className="btn-outline" style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}>+ Add</button>
                </div>
                {otherDocs.length === 0 && (
                  <p style={{ fontSize: 12, color: "rgba(220,245,230,0.3)", padding: "8px 0" }}>No other documents added yet.</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {otherDocs.map((doc, i) => (
                    <div key={doc + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)", padding: "9px 14px", gap: 8 }}>
                      <p style={{ fontSize: 12, lineHeight: 1.4 }}>📄 {doc}</p>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge label="Added" variant="badge-violet" />
                        <button onClick={() => removeOther(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(220,245,230,0.25)", fontSize: 13 }}
                          onMouseOver={(e) => e.currentTarget.style.color = "#fb7185"}
                          onMouseOut={(e) => e.currentTarget.style.color = "rgba(220,245,230,0.25)"}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {section.items.map((req) => {
                  const onFile = files.some((f) =>
                    f.name.toLowerCase().replace(/[^a-z]/g, "").includes(
                      req.replace(/[^a-zA-Z]/g, "").toLowerCase().slice(0, 8)
                    )
                  );
                  const isOR = req.startsWith("🧾");
                  return (
                    <div key={req} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: isOR ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(255,255,255,0.08)", background: isOR ? "rgba(251,191,36,0.05)" : "rgba(0,0,0,0.1)", padding: "9px 14px", gap: 8 }}>
                      <p style={{ fontSize: 12, lineHeight: 1.4 }}>{req}</p>
                      <Badge label={onFile ? "On File" : "Needed"} variant={onFile ? "badge-green" : "badge-rose"} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
function DocumentsPage({ client, isAdmin }) {
  const folders = CLIENT_FOLDERS[client] || [];
  const [files, setFiles] = useState(INIT_FILES);
  const [activeFolder, setActiveFolder] = useState("Property Documents");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("Property Document");
  const [isReceipt, setIsReceipt] = useState(false);
  const fileRef = useRef(null);

  const folderFiles = files.filter((f) => f.folder === activeFolder);
  const caseType = INIT_CASES[client]?.caseType || "";
  const reqs = serviceRequirements[caseType] || [];

  const updateFile = (id, review) => setFiles((p) => p.map((f) => f.id === id ? { ...f, review } : f));
  const deleteFile = (id) => setFiles((p) => p.filter((f) => f.id !== id));

  const handleUpload = () => {
    if (!uploadName.trim()) return;
    setFiles((p) => [...p, {
      id: Date.now(), name: uploadName.trim(), folder: activeFolder,
      type: isReceipt ? "Official Receipt" : uploadType,
      date: todayStr(), by: "Staff", review: "For Review", isReceipt,
    }]);
    setUploadName(""); setIsReceipt(false); setShowUpload(false);
  };

  const docTypes = ["Property Document", "Tax Document", "Survey Document", "BIR Document", "Supporting Document", "Client Document", "Internal Document"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
      {/* Folder list */}
      <Card>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Client Folders</p>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: "#fbbf24" }}>{client}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {folders.map((f) => (
            <button key={f.name} onClick={() => setActiveFolder(f.name)}
              className={`folder-card ${activeFolder === f.name ? "folder-active" : ""}`}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13 }}>📁 {f.name}</p>
                <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>{f.count} files</p>
              </div>
              {activeFolder === f.name && <span style={{ color: "#fbbf24", fontSize: 10 }}>●</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* File area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div>
              <p className="eyebrow">Folder Contents</p>
              <h3 className="section-title">📁 {activeFolder}</h3>
            </div>
            <button onClick={() => setShowUpload(!showUpload)} className="btn-primary" style={{ fontSize: 12, padding: "7px 14px" }}>
              {showUpload ? "✕ Cancel" : "+ Upload File"}
            </button>
          </div>

          {/* Upload panel */}
          {showUpload && (
            <div style={{ borderRadius: 18, border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.05)", padding: 16, marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
                Upload to: {activeFolder}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                  placeholder="File name (e.g. Cruz_OR_Survey.pdf)" className="form-input"
                  onKeyDown={(e) => e.key === "Enter" && handleUpload()} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="form-input">
                    {docTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "10px 14px", cursor: "pointer" }}>
                    <input type="checkbox" checked={isReceipt} onChange={(e) => setIsReceipt(e.target.checked)} style={{ accentColor: "#fbbf24" }} />
                    <span style={{ fontSize: 13 }}>🧾 Official Receipt</span>
                  </label>
                </div>
                <div onClick={() => fileRef.current?.click()}
                  style={{ border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 14, padding: "16px", textAlign: "center", cursor: "pointer" }}>
                  <p style={{ fontSize: 13, color: "rgba(220,245,230,0.4)" }}>📎 Click to attach file (PDF, JPG, PNG)</p>
                  <input ref={fileRef} type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" />
                </div>
                <button onClick={handleUpload} className="btn-primary" style={{ width: "100%", padding: "11px 0" }}>Upload to Folder</button>
              </div>
            </div>
          )}

          {/* Files */}
          {folderFiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(220,245,230,0.25)", fontSize: 13 }}>
              No files in this folder. Upload one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {folderFiles.map((file) => (
                <div key={file.id} style={{ borderRadius: 18, border: file.isReceipt ? "1px solid rgba(251,191,36,0.2)" : "1px solid rgba(255,255,255,0.08)", background: file.isReceipt ? "rgba(251,191,36,0.05)" : "rgba(0,0,0,0.1)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{file.isReceipt ? "🧾" : "📄"} {file.name}</p>
                      <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>{file.type}</p>
                    </div>
                    <Badge label={file.review} variant={statusBadge(file.review)} />
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(220,245,230,0.4)", marginBottom: 12 }}>
                    Uploaded {file.date} by {file.by}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isAdmin && <button onClick={() => updateFile(file.id, "Approved")} className="btn-primary" style={{ fontSize: 11, padding: "6px 12px" }}>✓ Approve</button>}
                    {isAdmin && <button onClick={() => updateFile(file.id, "For Review")} className="btn-outline" style={{ fontSize: 11, padding: "6px 12px" }}>For Review</button>}
                    {isAdmin && <button onClick={() => updateFile(file.id, "For Resubmission")} className="btn-outline" style={{ fontSize: 11, padding: "6px 12px" }}>Return</button>}
                    {isAdmin && <button onClick={() => deleteFile(file.id)} className="btn-danger" style={{ marginLeft: "auto" }}>🗑 Delete</button>}
                    {!isAdmin && <Badge label="Uploaded" variant="badge-green" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Requirements */}
        <RequirementsPanel caseType={caseType} files={files} baseReqs={reqs} />
      </div>
    </div>
  );
}

// ── SCHEDULE PAGE ─────────────────────────────────────────────────────────────
function SchedulePage({ schedules, setSchedules }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "" });
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const types = ["Survey", "Appointment", "Deadline", "Follow-up", "Other"];
  const typeColor = (t) => ({ Survey: "#34d399", Appointment: "#60a5fa", Deadline: "#fb7185", "Follow-up": "#fbbf24", Other: "#a78bfa" }[t] || "#a78bfa");
  const typeIcon = (t) => ({ Survey: "📐", Appointment: "🤝", Deadline: "⚠️", "Follow-up": "📞", Other: "📌" }[t] || "📌");

  const today = new Date().toISOString().split("T")[0];

  const openAddForDate = (dayStr) => {
    setForm(p => ({ ...p, date: dayStr }));
    setEditingId(null);
    setShowAdd(true);
    setSelectedSchedule(null);
  };

  const openEdit = (s) => {
    setForm({ title: s.title, client: s.client, type: s.type, date: s.date, time: s.time, location: s.location, contact: s.contact || "", remarks: s.remarks });
    setEditingId(s.id);
    setShowAdd(true);
    setSelectedSchedule(null);
  };

  const saveSchedule = () => {
    if ((!form.title.trim() && !form.lotNo.trim()) || !form.date) return;
    if (editingId) {
      setSchedules(p => p.map(s => s.id === editingId ? { ...s, ...form } : s));
      setEditingId(null);
    } else {
      setSchedules(p => [...p, { ...form, id: Date.now(), done: false }]);
    }
    setForm({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "" });
    setShowAdd(false);
  };

  const toggleDone = (id) => {
    setSchedules(p => p.map(s => s.id === id ? { ...s, done: !s.done } : s));
    if (selectedSchedule?.id === id) setSelectedSchedule(p => ({ ...p, done: !p.done }));
  };
  const deleteSchedule = (id) => {
    setSchedules(p => p.filter(s => s.id !== id));
    if (selectedSchedule?.id === id) setSelectedSchedule(null);
  };

  const filtered = schedules.filter(s => filter === "All" || s.type === filter);
  const upcoming = filtered.filter(s => !s.done && s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(s => s.done || s.date < today).sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const schedulesThisMonth = schedules.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === calMonth && d.getFullYear() === calYear;
  });

  const getDaySchedules = (day) => schedulesThisMonth.filter(s => new Date(s.date).getDate() === day);

  const inputSt = { background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%" };

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>

      {/* ── CALENDAR VIEW ── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div><p className="eyebrow">Calendar</p><h3 className="section-title">📅 {monthNames[calMonth]} {calYear}</h3></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} className="btn-outline" style={{ padding: "6px 12px", fontSize: 13 }}>‹</button>
            <button onClick={() => { setCalMonth(now.getMonth()); setCalYear(now.getFullYear()); }} className="btn-outline" style={{ padding: "6px 12px", fontSize: 11 }}>Today</button>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} className="btn-outline" style={{ padding: "6px 12px", fontSize: 13 }}>›</button>
            <button onClick={() => { setEditingId(null); setForm(p => ({...p, date: today})); setShowAdd(true); setSelectedSchedule(null); }} className="btn-primary" style={{ fontSize: 12, padding: "7px 14px" }}>+ Add Schedule</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.4)", letterSpacing: "0.1em", padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={"empty-"+i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday = dayStr === today;
            const dayScheds = getDaySchedules(day);
            return (
              <div key={day} onClick={() => openAddForDate(dayStr)}
                style={{ borderRadius: 10, border: isToday ? "1.5px solid #34d399" : "1px solid rgba(255,255,255,0.07)", background: isToday ? "rgba(52,211,153,0.08)" : "rgba(0,0,0,0.1)", padding: "6px", minHeight: 52, cursor: "pointer", transition: "background 0.15s" }}
                onMouseOver={(e) => e.currentTarget.style.background = isToday ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.05)"}
                onMouseOut={(e) => e.currentTarget.style.background = isToday ? "rgba(52,211,153,0.08)" : "rgba(0,0,0,0.1)"}>
                <p style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "#34d399" : "rgba(220,245,230,0.6)", marginBottom: 3 }}>{day}</p>
                {dayScheds.slice(0,2).map(s => (
                  <div key={s.id} onClick={() => setSelectedSchedule(s)}
                    style={{ fontSize: 9, borderRadius: 4, padding: "2px 4px", marginBottom: 2, background: typeColor(s.type) + "22", color: typeColor(s.type), fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", cursor: "pointer" }}>
                    {typeIcon(s.type)} {s.title}
                  </div>
                ))}
                {dayScheds.length > 2 && <p style={{ fontSize: 9, color: "rgba(220,245,230,0.4)", cursor: "pointer" }} onClick={() => setSelectedSchedule(dayScheds[2])}>+{dayScheds.length-2} more</p>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── ADD / EDIT FORM ── */}
      {showAdd && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div><p className="eyebrow">{editingId ? "Edit Entry" : "New Entry"}</p><h3 className="section-title">{editingId ? "Edit Schedule" : "Add Schedule"}</h3></div>
            <button onClick={() => { setShowAdd(false); setEditingId(null); setForm({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "" }); }} className="btn-outline" style={{ fontSize: 12 }}>✕ Cancel</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input value={form.lotNo} onChange={(e) => setForm(p => ({ ...p, lotNo: e.target.value }))} placeholder="Lot No. *" style={inputSt} />
            <input value={form.client} onChange={(e) => setForm(p => ({ ...p, client: e.target.value }))} placeholder="Client Name" style={inputSt} />
            <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} style={inputSt}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            {form.type === "Survey" ? (
              <select value={form.surveyType} onChange={(e) => setForm(p => ({ ...p, surveyType: e.target.value }))} style={inputSt}>
                <option value="">-- Kind of Survey --</option>
                <option>Relocation Survey</option>
                <option>Subdivision Survey</option>
                <option>Topographic Survey</option>
                <option>Cadastral Survey</option>
                <option>Boundary Survey</option>
                <option>Hydrographic Survey</option>
                <option>As-Built Survey</option>
                <option>Route Survey</option>
                <option>Other Survey</option>
              </select>
            ) : (
              <input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (optional)" style={inputSt} />
            )}
            <input value={form.contact} onChange={(e) => setForm(p => ({ ...p, contact: e.target.value }))} placeholder="Contact No. (optional)" style={inputSt} />
            {form.type === "Survey" && (
              <input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (optional)" style={inputSt} />
            )}
            <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title / Description (optional)" style={inputSt} />
            <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} style={inputSt} />
            <input type="time" value={form.time} onChange={(e) => setForm(p => ({ ...p, time: e.target.value }))} style={inputSt} />
            <input value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Remarks / Notes" style={{ ...inputSt, gridColumn: "1 / -1" }} />
          </div>
          <button onClick={saveSchedule} className="btn-primary" style={{ width: "100%", padding: "11px 0", marginTop: 14 }}>
            {editingId ? "✓ Save Changes" : "✓ Add to Schedule"}
          </button>
        </Card>
      )}

      {/* ── LIST ── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div><p className="eyebrow">Schedule List</p><h3 className="section-title">All Events</h3></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", ...types].map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, border: filter === t ? "none" : "1px solid rgba(255,255,255,0.12)", background: filter === t ? "#fff" : "transparent", color: filter === t ? "#0a1a13" : "rgba(220,245,230,0.6)", fontFamily: "inherit", cursor: "pointer", fontWeight: 600 }}>
                {t === "All" ? "All" : typeIcon(t) + " " + t}
              </button>
            ))}
          </div>
        </div>

        {upcoming.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#34d399", marginBottom: 10 }}>Upcoming</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map(s => (
                <div key={s.id} onClick={() => setSelectedSchedule(s)}
                  style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, border: selectedSchedule?.id === s.id ? `1.5px solid ${typeColor(s.type)}` : `1px solid ${typeColor(s.type)}33`, background: selectedSchedule?.id === s.id ? `${typeColor(s.type)}18` : `${typeColor(s.type)}0a`, padding: "12px 16px", cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 18 }}>{typeIcon(s.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)", marginTop: 2 }}>
                      📅 {fmtDate(s.date)}{s.time && " · ⏰ " + s.time}{s.client && " · 👤 " + s.client}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: typeColor(s.type), fontWeight: 600 }}>{s.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.35)", marginBottom: 10 }}>Past / Done</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {past.map(s => (
                <div key={s.id} onClick={() => setSelectedSchedule(s)}
                  style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.08)", padding: "10px 16px", opacity: 0.55, cursor: "pointer" }}>
                  <span style={{ fontSize: 16 }}>{typeIcon(s.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 12, textDecoration: "line-through" }}>{s.title}</p>
                    <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 1 }}>{fmtDate(s.date)}{s.client && " · " + s.client}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <p style={{ textAlign: "center", padding: "32px 0", color: "rgba(220,245,230,0.25)", fontSize: 13 }}>No schedules yet. Click "+ Add Schedule" to start.</p>
        )}
      </Card>
      </div>

      {/* ── SIDE PANEL ── */}
      {selectedSchedule && (
        <div style={{ width: 280, flexShrink: 0, position: "sticky", top: 88, alignSelf: "flex-start" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${typeColor(selectedSchedule.type)}44`, borderRadius: 24, padding: 20 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: typeColor(selectedSchedule.type), marginBottom: 4 }}>
                  {typeIcon(selectedSchedule.type)} {selectedSchedule.type}
                </p>
                <h4 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>{selectedSchedule.title}</h4>
              </div>
              <button onClick={() => setSelectedSchedule(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(220,245,230,0.4)", fontSize: 18, padding: "0 0 0 8px" }}>✕</button>
            </div>

            {/* Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Date & Time</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>📅 {fmtDate(selectedSchedule.date)}</p>
                {selectedSchedule.time && <p style={{ fontSize: 12, color: "rgba(220,245,230,0.6)", marginTop: 2 }}>⏰ {selectedSchedule.time}</p>}
              </div>

              {selectedSchedule.client && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Client</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>👤 {selectedSchedule.client}</p>
                </div>
              )}

              {selectedSchedule.surveyType && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Kind of Survey</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>📐 {selectedSchedule.surveyType}</p>
                </div>
              )}

              {selectedSchedule.lotNo && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Lot No.</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>🏷️ {selectedSchedule.lotNo}</p>
                </div>
              )}

              {selectedSchedule.contact && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Contact No.</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>📱 {selectedSchedule.contact}</p>
                </div>
              )}

              {selectedSchedule.location && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Location</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>📍 {selectedSchedule.location}</p>
                </div>
              )}

              {selectedSchedule.remarks && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Remarks</p>
                  <p style={{ fontSize: 12, color: "rgba(220,245,230,0.7)", lineHeight: 1.6 }}>📝 {selectedSchedule.remarks}</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <button onClick={() => openEdit(selectedSchedule)} className="btn-outline" style={{ width: "100%", padding: "9px 0", fontSize: 12 }}>
                  ✏️ Edit
                </button>
                <button onClick={() => toggleDone(selectedSchedule.id)} className="btn-primary" style={{ width: "100%", padding: "10px 0", fontSize: 12 }}>
                  {selectedSchedule.done ? "↩ Mark as Pending" : "✓ Mark as Done"}
                </button>
                <button onClick={() => deleteSchedule(selectedSchedule.id)} className="btn-danger" style={{ width: "100%", padding: "8px 0", fontSize: 12 }}>
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHECKLIST ─────────────────────────────────────────────────────────────────
function ChecklistPage({ client, caseStore, setCaseStore, isAdmin }) {
  const data = caseStore[client] || caseStore["Santos Family"];
  const [newItem, setNewItem] = useState("");

  const toggle = (idx) => {
    const updated = data.checklist.map((item, i) =>
      i === idx ? { ...item, status: item.status === "Completed" ? "Pending" : "Completed" } : item
    );
    setCaseStore((p) => ({ ...p, [client]: { ...data, checklist: updated } }));
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setCaseStore((p) => ({ ...p, [client]: { ...data, checklist: [...data.checklist, { name: newItem.trim(), status: "Pending" }] } }));
    setNewItem("");
  };

  const removeItem = (idx) => {
    setCaseStore((p) => ({ ...p, [client]: { ...data, checklist: data.checklist.filter((_, i) => i !== idx) } }));
  };

  const done = data.checklist.filter((c) => c.status === "Completed").length;

  return (
    <Card>
      <SectionHeader
        eyebrow="Checklist Tracker"
        title={`Checklist for ${client}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
              placeholder="New item..." className="search-input" style={{ width: 180 }}
              onKeyDown={(e) => e.key === "Enter" && addItem()} />
            <button onClick={addItem} className="btn-outline" style={{ fontSize: 12, padding: "6px 14px" }}>+ Add</button>
          </div>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.checklist.map((item, i) => (
          <div key={item.name + i} className="checklist-row">
            <button onClick={() => toggle(i)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
              <span className={`check-box ${item.status === "Completed" ? "checked" : ""}`}>
                {item.status === "Completed" && "✓"}
              </span>
              <p style={{ fontSize: 13, fontWeight: 500, textDecoration: item.status === "Completed" ? "line-through" : "none", opacity: item.status === "Completed" ? 0.4 : 1 }}>
                {item.name}
              </p>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={item.status} variant={statusBadge(item.status)} />
              {isAdmin && <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(220,245,230,0.2)", fontSize: 13, padding: "0 2px" }}
                onMouseOver={(e) => e.currentTarget.style.color = "#fb7185"}
                onMouseOut={(e) => e.currentTarget.style.color = "rgba(220,245,230,0.2)"}>✕</button>}
            </div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: "rgba(220,245,230,0.35)" }}>{done} of {data.checklist.length} completed</p>
    </Card>
  );
}

// ── MESSAGING ─────────────────────────────────────────────────────────────────
function MessagingPage() {
  const [messages, setMessages] = useState(INIT_MESSAGES);
  const [form, setForm] = useState({ to: "", channel: "SMS / Email", subject: "", body: "" });
  const [sent, setSent] = useState(false);

  const sendMsg = () => {
    if (!form.to.trim() || !form.subject.trim()) return;
    setMessages((p) => [{ id: Date.now(), to: form.to, channel: form.channel, subject: form.subject, body: form.body, status: "Ready to Send", date: todayStr() }, ...p]);
    setForm({ to: "", channel: "SMS / Email", subject: "", body: "" });
    setSent(true); setTimeout(() => setSent(false), 3000);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 22 }}>
      <Card>
        <SectionHeader eyebrow="Client Messaging" title="Portal notices and message queue" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m) => (
            <div key={m.id} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{m.subject}</p>
                <Badge label={m.status} variant={statusBadge(m.status)} />
              </div>
              <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)" }}>To: {m.to} · {m.channel} · {m.date}</p>
              {m.body && <p style={{ fontSize: 12, color: "rgba(220,245,230,0.55)", marginTop: 8, lineHeight: 1.6 }}>{m.body}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(255,255,255,0.03))", padding: 24 }}>
        <p className="eyebrow" style={{ color: "#fcd34d" }}>Client Messaging Form</p>
        <h3 className="section-title" style={{ marginBottom: 6 }}>Send an update</h3>
        <p style={{ fontSize: 13, color: "rgba(220,245,230,0.55)", marginBottom: 20 }}>Prepare update messages and document notices for clients.</p>
        {sent && (
          <div style={{ marginBottom: 14, borderRadius: 16, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", padding: "12px 16px", fontSize: 13, color: "#6ee7b7" }}>
            ✓ Message queued successfully!
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="Client / Family Name" className="form-input" />
          <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="form-input">
            <option>SMS / Email</option><option>Portal Notice</option><option>Phone Call Log</option>
          </select>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject / Message Type" className="form-input" />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Type the update to send to the client…" rows={4} className="form-input" style={{ resize: "none" }} />
          <button onClick={sendMsg} className="btn-primary" style={{ width: "100%", padding: "12px 0" }}>Send Message</button>
        </div>
      </div>
    </div>
  );
}

// ── NEW CASE ───────────────────────────────────────────────────────────────────
function NewCasePage() {
  const [service, setService] = useState("Subdivision – Titled Property");
  const [form, setForm] = useState({ client: "", ref: "", location: "", lot: "", dateOfSurvey: "", dateOfSubmittal: "", remarks: "" });
  const [createdCases, setCreatedCases] = useState([]);
  const [justCreated, setJustCreated] = useState(null);

  const folders = serviceFolderTemplates[service] || [];

  const handleCreate = () => {
    if (!form.client.trim()) return;
    const nc = { ...form, service, folders: [...folders], id: Date.now() };
    setCreatedCases((p) => [nc, ...p]);
    setJustCreated(nc);
    setForm({ client: "", ref: "", location: "", lot: "", dateOfSurvey: "", dateOfSubmittal: "", remarks: "" });
    setTimeout(() => setJustCreated(null), 5000);
  };

  const serviceGroups = [
    { label: "── Subdivision", options: ["Subdivision – Titled Property", "Subdivision – Tax Declaration Only"] },
    { label: "── Relocation Plan", options: ["Relocation Plan – Titled Property", "Relocation Plan – Not Titled (Tax Dec)"] },
    { label: "── Other Services", options: ["Segregation", "Titling"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 0.85fr", gap: 22 }}>
        <Card>
          <SectionHeader
            eyebrow="Create New Case"
            title="New client case registration"
            action={<button onClick={handleCreate} className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }}>✓ Create Case</button>}
          />
          {justCreated && (
            <div style={{ marginBottom: 18, borderRadius: 16, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", padding: "12px 16px", fontSize: 13, color: "#6ee7b7" }}>
              ✓ Case created for <strong>{justCreated.client}</strong> — {justCreated.service} — {justCreated.folders.length} folders auto-generated!
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Client / Family Name *" className="form-input" />
            <input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Case Reference Number" className="form-input" />
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Property Location" className="form-input" />
            <input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="Lot No. / TCT / TD No." className="form-input" />
            <div style={{ gridColumn: "1 / -1" }}>
              <p className="info-label" style={{ marginBottom: 8 }}>Service Type</p>
              <select value={service} onChange={(e) => setService(e.target.value)} className="form-input">
                {serviceGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => <option key={o}>{o}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <p className="info-label" style={{ marginBottom: 8 }}>📅 Date of Survey</p>
              <input type="date" value={form.dateOfSurvey} onChange={(e) => setForm({ ...form, dateOfSurvey: e.target.value })} className="form-input" />
              {form.dateOfSurvey && <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>{fmtDate(form.dateOfSurvey)}</p>}
            </div>
            <div>
              <p className="info-label" style={{ marginBottom: 8 }}>📋 Date of Submittal of Papers</p>
              <input type="date" value={form.dateOfSubmittal} onChange={(e) => setForm({ ...form, dateOfSubmittal: e.target.value })} className="form-input" />
              {form.dateOfSubmittal && <p style={{ fontSize: 11, color: "#34d399", marginTop: 5 }}>{fmtDate(form.dateOfSubmittal)}</p>}
            </div>
            <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Initial remarks or notes" rows={3} className="form-input" style={{ resize: "none", gridColumn: "1 / -1" }} />
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Auto-Folder Preview" title={service} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {folders.map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, border: f.includes("Official Receipts") ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(255,255,255,0.08)", background: f.includes("Official Receipts") ? "rgba(251,191,36,0.05)" : "rgba(0,0,0,0.1)", padding: "10px 14px" }}>
                <span style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace", width: 20, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{f}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: "rgba(251,191,36,0.6)" }}>{folders.length} folders will be auto-created.</p>
        </Card>
      </div>

      {/* Created cases log */}
      {createdCases.length > 0 && (
        <Card>
          <SectionHeader eyebrow="Created This Session" title="New cases log" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {createdCases.map((c) => (
              <div key={c.id} style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{c.client}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>{c.service} · {c.lot || "No lot no."} · {c.location || "No location"}</p>
                  </div>
                  <Badge label={`${c.folders.length} folders`} variant="badge-green" />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {c.dateOfSurvey && <span style={{ fontSize: 11, color: "rgba(220,245,230,0.45)" }}>📅 Survey: {fmtDate(c.dateOfSurvey)}</span>}
                  {c.dateOfSubmittal && <span style={{ fontSize: 11, color: "rgba(220,245,230,0.45)" }}>📋 Submittal: {fmtDate(c.dateOfSubmittal)}</span>}
                  {c.ref && <span style={{ fontSize: 11, color: "rgba(220,245,230,0.45)" }}>Ref: {c.ref}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── FORMS PAGE ────────────────────────────────────────────────────────────────

const CASE_FORMS = {
  "Subdivision – Titled Property": ["Survey Authority Form","Subdivision Notice Form","Inspection Request Form","Barangay Notice Form"],
  "Subdivision – Tax Declaration Only": ["Survey Authority Form","Subdivision Notice Form","Barangay Notice Form","Inspection Request Form"],
  "Relocation Plan – Titled Property": ["Relocation Plan Form","Barangay Notice Form","Inspection Request Form"],
  "Relocation Plan – Not Titled (Tax Dec)": ["Relocation Plan Form","Barangay Notice Form","Inspection Request Form"],
  "Segregation": ["Survey Authority Form","Barangay Notice Form","Inspection Request Form"],
  "Titling": ["Survey Authority Form","Barangay Notice Form","Inspection Request Form"],
};

const FORM_DESC = {
  "Survey Authority Form": "DENR/LMB survey authority application form.",
  "Relocation Plan Form": "Relocation survey request form with Date of Release of Plan field.",
  "Subdivision Notice Form": "Notice form for subdivision of titled or tax-declared property.",
  "Barangay Notice Form": "Barangay clearance / notice requirement for survey and relocation.",
  "Inspection Request Form": "DENR/LMB inspection request form for lot survey and relocation.",
};

function FormsPage({ caseStore }) {
  const clients = Object.keys(caseStore);
  const [selClient, setSelClient] = useState(clients[0]);
  const [selForm, setSelForm] = useState(null);
  const [ex, setEx] = useState({ surveyor:"", purpose:"", area:"", dateOfRelease:"", remarks:"" });
  const [generated, setGenerated] = useState(false);
  const [printed, setPrinted] = useState(false);

  const cd = caseStore[selClient];
  const availForms = CASE_FORMS[cd?.caseType] || [];
  const lotNo = cd?.lotNo || "—";
  const location = cd?.propertyLocation || "—";
  const locParts = location.split(",").map((s) => s.trim());
  const municipality = locParts[0] || "—";
  const province = locParts[1] || "—";
  const today = new Date().toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" });

  const pickClient = (c) => { setSelClient(c); setSelForm(null); setGenerated(false); };
  const pickForm = (f) => { setSelForm(f); setGenerated(false); };
  const setField = (k,v) => { setEx((p) => ({...p,[k]:v})); setGenerated(false); };

  const handlePrint = () => { setPrinted(true); setTimeout(()=>setPrinted(false),2500); window.print?.(); };

  const baseRows = [
    { label:"Date", value:today },
    { label:"Lot No.", value:lotNo },
    { label:"Owner / Client", value:selClient },
    { label:"Property Location", value:location },
    { label:"Municipality / City", value:municipality },
    { label:"Province", value:province },
    { label:"Area", value: ex.area ? ex.area+" sq.m." : "—" },
    { label:"Case Type", value:cd?.caseType||"—" },
  ];

  const surveyRows = [...baseRows,
    { label:"Purpose", value:ex.purpose||"—" },
    { label:"Date of Survey", value: ex.dateOfSurvey ? fmtDate(ex.dateOfSurvey) : (cd?.dateOfSurvey ? fmtDate(cd.dateOfSurvey):"—") },
    { label:"Geodetic Engineer", value:ex.surveyor||"—" },
  ];

  const rowsMap = {
    "Survey Authority Form": surveyRows,
    "Inspection Request Form": surveyRows,
    "Subdivision Notice Form": [...baseRows,
      { label:"Date of Survey", value: cd?.dateOfSurvey ? fmtDate(cd.dateOfSurvey):"—" },
      { label:"Date of Submittal", value: cd?.dateOfSubmittal ? fmtDate(cd.dateOfSubmittal):"—" },
      { label:"Geodetic Engineer", value:ex.surveyor||"—" },
    ],
    "Barangay Notice Form": [
      { label:"Date", value:today },
      { label:"Lot No.", value:lotNo },
      { label:"Owner / Client", value:selClient },
      { label:"Municipality / City", value:municipality },
      { label:"Province", value:province },
      { label:"Purpose", value:ex.purpose||"—" },
      { label:"Date of Survey", value: cd?.dateOfSurvey ? fmtDate(cd.dateOfSurvey):"—" },
    ],
    "Relocation Plan Form": [...baseRows,
      { label:"Date of Survey", value: cd?.dateOfSurvey ? fmtDate(cd.dateOfSurvey):"—" },
      { label:"📅 Date of Release of Plan", value: ex.dateOfRelease ? fmtDate(ex.dateOfRelease):"—", highlight:true },
      { label:"Geodetic Engineer", value:ex.surveyor||"—" },
    ],
  };

  const formTitles = {
    "Survey Authority Form":"SURVEY AUTHORITY FORM",
    "Relocation Plan Form":"RELOCATION PLAN FORM",
    "Subdivision Notice Form":"SUBDIVISION NOTICE FORM",
    "Barangay Notice Form":"BARANGAY NOTICE FORM",
    "Inspection Request Form":"INSPECTION REQUEST FORM",
  };

  const FormPreview = () => {
    const rows = [...(rowsMap[selForm] || surveyRows)];
    if (ex.remarks) rows.push({ label:"Remarks", value:ex.remarks });
    return (
      <div className="form-preview">
        <div className="form-preview-header">
          <p className="form-preview-agency">REPUBLIC OF THE PHILIPPINES</p>
          <p className="form-preview-agency">DEPARTMENT OF ENVIRONMENT AND NATURAL RESOURCES</p>
          <p className="form-preview-agency">LANDS MANAGEMENT BUREAU</p>
          <div className="form-preview-divider" />
          <h2 className="form-preview-title">{formTitles[selForm]}</h2>
          <p className="form-preview-sub">E.B. Bernas Land Consultancy · No. 051, Brgy. Garrita, Bani, Pangasinan</p>
        </div>
        <div className="form-preview-body">
          {rows.map((r,i) => (
            <div key={i} className="form-preview-row"
              style={r.highlight ? {background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,padding:"7px 10px"} : {}}>
              <span className="form-preview-label" style={r.highlight?{color:"#b45309"}:{}}>{r.label}:</span>
              <span className="form-preview-value" style={r.highlight?{fontWeight:700,color:"#92400e"}:{}}>{r.value}</span>
            </div>
          ))}
          <div className="form-preview-sig">
            <div className="form-preview-sigbox"><div className="form-preview-sigline"/><p>Authorized Representative</p><p style={{fontWeight:700}}>E.B. Bernas Land Consultancy</p></div>
            <div className="form-preview-sigbox"><div className="form-preview-sigline"/><p>Geodetic Engineer</p><p style={{fontWeight:700}}>{ex.surveyor||"___________________"}</p></div>
            <div className="form-preview-sigbox"><div className="form-preview-sigline"/><p>Client / Owner</p><p style={{fontWeight:700}}>{selClient}</p></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Card>
        <SectionHeader eyebrow="Forms Generator" title="Select a client to generate forms" />

        {/* Step 1 */}
        <p className="info-label" style={{marginBottom:10}}>Step 1 — Choose Client</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
          {clients.map((c) => {
            const isA = selClient===c;
            const d = caseStore[c];
            return (
              <button key={c} onClick={()=>pickClient(c)} style={{
                display:"flex",flexDirection:"column",alignItems:"flex-start",
                padding:"12px 18px",borderRadius:16,minWidth:160,cursor:"pointer",
                border: isA ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,0.1)",
                background: isA ? "rgba(251,191,36,0.1)" : "rgba(0,0,0,0.12)",
                fontFamily:"inherit",color:"var(--text)",transition:"all 0.15s",
              }}>
                <p style={{fontWeight:700,fontSize:14}}>{c}</p>
                <p style={{fontSize:11,color:"rgba(220,245,230,0.5)",marginTop:3}}>{d?.lotNo}</p>
                <span style={{marginTop:8,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:999,background:"rgba(251,191,36,0.15)",color:"#fcd34d"}}>{d?.caseType}</span>
              </button>
            );
          })}
        </div>

        {/* Step 2 */}
        <p className="info-label" style={{marginBottom:10}}>Step 2 — Choose Form to Generate</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {availForms.map((f) => {
            const isA = selForm===f;
            return (
              <button key={f} onClick={()=>pickForm(f)} style={{
                padding:"10px 16px",borderRadius:14,cursor:"pointer",
                border: isA ? "none" : "1px solid rgba(255,255,255,0.1)",
                background: isA ? "#fff" : "rgba(255,255,255,0.04)",
                color: isA ? "#0a1a13" : "rgba(220,245,230,0.8)",
                fontFamily:"inherit",fontSize:13,fontWeight:600,transition:"all 0.15s",
              }}>{f}</button>
            );
          })}
        </div>
        {selForm && <p style={{marginTop:12,fontSize:12,color:"rgba(220,245,230,0.4)"}}>{FORM_DESC[selForm]}</p>}
      </Card>

      {selForm && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.1fr",gap:20}}>
          {/* Extra fields */}
          <Card>
            <SectionHeader eyebrow="Additional Details" title="Fill in remaining fields" />
            <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:14,padding:"12px 16px",marginBottom:16}}>
              <p style={{fontSize:10,fontWeight:700,color:"#34d399",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10}}>Auto-filled from case record</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[["Client",selClient],["Lot No.",lotNo],["Case Type",cd?.caseType],["Location",location],
                  ["Date of Survey",cd?.dateOfSurvey?fmtDate(cd.dateOfSurvey):"—"],
                  ["Date of Submittal",cd?.dateOfSubmittal?fmtDate(cd.dateOfSubmittal):"—"],
                ].map(([lbl,val])=>(
                  <div key={lbl} style={{fontSize:12}}>
                    <span style={{color:"rgba(220,245,230,0.45)"}}>{lbl}: </span>
                    <span style={{fontWeight:600}}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <p className="info-label" style={{marginBottom:6}}>Area (sq.m.)</p>
                <input value={ex.area} onChange={(e)=>setField("area",e.target.value)} placeholder="e.g. 450" className="form-input" />
              </div>
              <div>
                <p className="info-label" style={{marginBottom:6}}>Geodetic Engineer</p>
                <input value={ex.surveyor} onChange={(e)=>setField("surveyor",e.target.value)} placeholder="Surveyor name" className="form-input" />
              </div>
              <div>
                <p className="info-label" style={{marginBottom:6}}>Purpose</p>
                <input value={ex.purpose} onChange={(e)=>setField("purpose",e.target.value)} placeholder="e.g. Subdivision" className="form-input" />
              </div>
              {selForm==="Relocation Plan Form" && (
                <div>
                  <p className="info-label" style={{marginBottom:6}}>📅 Date of Release of Plan</p>
                  <input type="date" value={ex.dateOfRelease} onChange={(e)=>setField("dateOfRelease",e.target.value)} className="form-input" />
                  {ex.dateOfRelease && <p style={{fontSize:11,color:"#34d399",marginTop:4}}>{fmtDate(ex.dateOfRelease)}</p>}
                </div>
              )}
              <div style={{gridColumn:"1 / -1"}}>
                <p className="info-label" style={{marginBottom:6}}>Remarks (optional)</p>
                <textarea value={ex.remarks} onChange={(e)=>setField("remarks",e.target.value)}
                  rows={2} className="form-input" style={{resize:"none"}} placeholder="Additional notes…" />
              </div>
            </div>
            <button onClick={()=>setGenerated(true)} className="btn-primary" style={{width:"100%",padding:"12px 0",marginTop:14}}>
              ⚡ Generate {selForm}
            </button>
          </Card>

          {/* Preview */}
          <Card>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div><p className="eyebrow">Form Preview</p><h3 className="section-title">{selForm}</h3></div>
              {generated && (
                <button onClick={handlePrint} className="btn-gold" style={{fontSize:12,padding:"8px 16px"}}>
                  {printed ? "✓ Printing…" : "🖨 Print / Save PDF"}
                </button>
              )}
            </div>
            {!generated ? (
              <div style={{textAlign:"center",padding:"48px 0",color:"rgba(220,245,230,0.2)",fontSize:13}}>
                Click "Generate" to preview the form.
              </div>
            ) : <FormPreview />}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const [employees, setEmployees] = useState(getEmployees());

  const refresh = () => setEmployees(getEmployees());

  const approve = (email) => {
    const list = getEmployees().map(e => e.email === email ? { ...e, approved: true } : e);
    saveEmployees(list); refresh();
  };

  const reject = (email) => {
    const list = getEmployees().filter(e => e.email !== email);
    saveEmployees(list); refresh();
  };

  const pending = employees.filter(e => !e.approved);
  const approved = employees.filter(e => e.approved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <SectionHeader eyebrow="Admin Panel" title="👑 Employee Management" />

        {/* Pending Approvals */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#fb7185", marginBottom: 12 }}>
            ⏳ Pending Approval ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", padding: "12px 0" }}>No pending registrations.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pending.map(e => (
                <div key={e.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, border: "1px solid rgba(251,113,133,0.25)", background: "rgba(251,113,133,0.05)", padding: "12px 16px", gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>📧 {e.email} · Registered: {e.registeredAt || "—"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => approve(e.email)} className="btn-primary" style={{ fontSize: 11, padding: "6px 14px" }}>✓ Approve</button>
                    <button onClick={() => reject(e.email)} className="btn-danger" style={{ fontSize: 11, padding: "6px 12px" }}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approved Employees */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#34d399", marginBottom: 12 }}>
            ✅ Approved Employees ({approved.length})
          </p>
          {approved.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", padding: "12px 0" }}>No approved employees yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {approved.map(e => (
                <div key={e.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.04)", padding: "12px 16px", gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>👤 {e.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>📧 {e.email}</p>
                  </div>
                  <button onClick={() => reject(e.email)} className="btn-danger" style={{ fontSize: 11, padding: "6px 12px" }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Employee Permissions</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { action: "View cases & schedules", allowed: true },
            { action: "Upload documents", allowed: true },
            { action: "Tick checklist items", allowed: true },
            { action: "Add schedule entries", allowed: true },
            { action: "Delete documents", allowed: false },
            { action: "Delete cases or schedules", allowed: false },
            { action: "Edit case information", allowed: false },
            { action: "Approve documents", allowed: false },
            { action: "Access Admin Panel", allowed: false },
          ].map(p => (
            <div key={p.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.1)", padding: "9px 14px" }}>
              <p style={{ fontSize: 13 }}>{p.action}</p>
              <span style={{ fontSize: 12, fontWeight: 700, color: p.allowed ? "#34d399" : "#fb7185" }}>{p.allowed ? "✓ Allowed" : "✕ Restricted"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function EBBernasPortal() {
  const [activeMenu, setActiveMenu] = useState("overview");
  const [selectedClient, setSelectedClient] = useState("Santos Family");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // ── PERSISTENT STATE via localStorage ──
  const [caseStore, setCaseStoreRaw] = useState(() => LS.get("eb_cases", INIT_CASES));
  const [schedules, setSchedulesRaw] = useState(() => LS.get("eb_schedules", []));

  const setCaseStore = (val) => {
    const next = typeof val === "function" ? val(caseStore) : val;
    setCaseStoreRaw(next);
    LS.set("eb_cases", next);
  };

  const setSchedules = (val) => {
    const next = typeof val === "function" ? val(schedules) : val;
    setSchedulesRaw(next);
    LS.set("eb_schedules", next);
  };

  const handleLogout = () => setCurrentUser(null);

  if (!currentUser) return <AuthPage onLogin={setCurrentUser} />;

  const isAdmin = currentUser.role === "admin";

  const menus = [
    { id: "overview", label: "🏢 Overview" },
    { id: "schedule", label: "📅 Schedule" },
    { id: "dashboard", label: "Client Dashboard" },
    { id: "cases", label: "Assigned Cases" },
    { id: "documents", label: "Documents & Folders" },
    { id: "checklist", label: "Checklist Tracker" },
    { id: "messaging", label: "Client Messaging" },
    { id: "newcase", label: "Create New Case" },
    { id: "forms", label: "📋 Forms Generator" },
    ...(isAdmin ? [{ id: "admin", label: "👑 Admin Panel" }] : []),
  ];

  const setMenu = (m) => { setActiveMenu(m); setSidebarOpen(false); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --bg:#0a1a13; --surface:rgba(255,255,255,0.04); --border:rgba(255,255,255,0.09); --text:#e8f5ee; --accent:#34d399; --gold:#fbbf24; }
        .portal { min-height:100vh; background:var(--bg); color:var(--text); font-family:'Sora',sans-serif; }
        .portal-header { border-bottom:1px solid var(--border); background:rgba(10,26,19,0.93); backdrop-filter:blur(16px); position:sticky; top:0; z-index:50; }
        .header-inner { max-width:1280px; margin:0 auto; padding:0 24px; height:68px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .brand { display:flex; align-items:center; gap:14px; }
        .brand-logo { width:46px; height:46px; border-radius:14px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
        .brand-sup { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:var(--accent); font-weight:600; }
        .brand-name { font-size:17px; font-weight:800; }
        .brand-addr { font-size:10px; color:rgba(220,245,230,0.38); margin-top:2px; }
        .header-actions { display:flex; align-items:center; gap:8px; }
        .portal-layout { max-width:1280px; margin:0 auto; padding:28px 24px; display:flex; gap:24px; }
        .sidebar { width:252px; flex-shrink:0; position:sticky; top:88px; align-self:flex-start; }
        .sidebar-box { background:var(--surface); border:1px solid var(--border); border-radius:24px; padding:20px; }
        .content { flex:1; min-width:0; }
        .nav-eyebrow { font-size:9px; letter-spacing:0.25em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:12px; }
        .nav-btn { display:block; width:100%; padding:9px 14px; border-radius:13px; font-size:13px; font-weight:600; text-align:left; cursor:pointer; border:1px solid transparent; background:none; color:var(--text); transition:all 0.15s; margin-bottom:3px; font-family:inherit; }
        .nav-btn:hover { background:rgba(255,255,255,0.06); border-color:var(--border); }
        .nav-btn.active { background:#fff; color:#0a1a13; }
        .selector-box { background:rgba(0,0,0,0.15); border:1px solid var(--border); border-radius:18px; padding:14px; margin-top:12px; }
        .selector-label { font-size:9px; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:8px; }
        .search-input { background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:8px 12px; font-size:13px; color:var(--text); font-family:inherit; outline:none; }
        .search-input::placeholder { color:rgba(220,245,230,0.3); }
        .search-input:focus { border-color:rgba(52,211,153,0.4); }
        .card { background:var(--surface); border:1px solid var(--border); border-radius:24px; padding:24px; box-shadow:0 4px 32px rgba(0,0,0,0.18); }
        .info-block { background:rgba(0,0,0,0.12); border:1px solid var(--border); border-radius:16px; padding:14px 16px; }
        .info-label { font-size:9px; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:5px; }
        .info-value { font-size:14px; font-weight:500; color:rgba(220,245,230,0.85); line-height:1.55; }
        .eyebrow { font-size:10px; letter-spacing:0.28em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:5px; }
        .section-title { font-size:21px; font-weight:800; line-height:1.15; }
        .body-text { font-size:14px; color:rgba(220,245,230,0.72); line-height:1.7; }
        .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; white-space:nowrap; }
        .badge-amber { background:rgba(251,191,36,0.15); color:#fcd34d; }
        .badge-blue { background:rgba(56,189,248,0.15); color:#7dd3fc; }
        .badge-green { background:rgba(52,211,153,0.15); color:#6ee7b7; }
        .badge-neutral { background:rgba(255,255,255,0.08); color:rgba(220,245,230,0.6); }
        .badge-rose { background:rgba(251,113,133,0.15); color:#fca5a5; }
        .badge-violet { background:rgba(167,139,250,0.15); color:#c4b5fd; }
        .btn-primary { background:#fff; color:#0a1a13; border:none; border-radius:12px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:opacity 0.15s, transform 0.1s; display:inline-flex; align-items:center; justify-content:center; }
        .btn-primary:hover { opacity:0.9; transform:scale(1.01); }
        .btn-outline { background:transparent; color:var(--text); border:1px solid var(--border); border-radius:12px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:background 0.15s; }
        .btn-outline:hover { background:rgba(255,255,255,0.06); }
        .btn-gold { background:var(--gold); color:#0a1a13; border:none; border-radius:12px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
        .btn-danger { background:rgba(251,113,133,0.1); color:#fca5a5; border:1px solid rgba(251,113,133,0.2); border-radius:12px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; transition:background 0.15s; }
        .btn-danger:hover { background:rgba(251,113,133,0.2); }
        .progress-track { height:6px; border-radius:999px; background:rgba(255,255,255,0.1); overflow:hidden; }
        .progress-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--gold),var(--accent)); transition:width 0.6s ease; }
        .checklist-row { display:flex; align-items:center; justify-content:space-between; width:100%; padding:11px 16px; border-radius:14px; border:1px solid var(--border); background:rgba(0,0,0,0.1); color:var(--text); transition:background 0.15s; }
        .checklist-row:hover { background:rgba(255,255,255,0.04); }
        .check-box { width:18px; height:18px; border-radius:6px; border:1.5px solid rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; font-size:10px; color:#0a1a13; flex-shrink:0; transition:all 0.15s; }
        .check-box.checked { background:var(--accent); border-color:var(--accent); }
        .case-card { background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)); border:1px solid var(--border); border-radius:22px; padding:20px; cursor:pointer; font-family:inherit; color:var(--text); transition:transform 0.15s,box-shadow 0.15s; text-align:left; width:100%; }
        .case-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,0,0,0.3); }
        .folder-card { display:flex; align-items:center; justify-content:space-between; width:100%; padding:11px 14px; border-radius:13px; border:1px solid var(--border); background:rgba(0,0,0,0.1); cursor:pointer; font-family:inherit; color:var(--text); transition:background 0.15s; text-align:left; }
        .folder-card:hover { background:rgba(255,255,255,0.06); }
        .folder-active { border-color:rgba(251,191,36,0.4) !important; background:rgba(251,191,36,0.07) !important; }
        .form-input { width:100%; background:rgba(0,0,0,0.15); border:1px solid var(--border); border-radius:14px; padding:10px 14px; font-size:13px; color:var(--text); font-family:inherit; outline:none; transition:border-color 0.15s; }
        .form-input::placeholder { color:rgba(220,245,230,0.3); }
        .form-input:focus { border-color:rgba(52,211,153,0.4); }
        .stat-card { background:rgba(0,0,0,0.12); border:1px solid var(--border); border-radius:16px; padding:14px; }
        .stat-icon { font-size:20px; display:block; margin-bottom:6px; }
        .stat-value { font-size:22px; font-weight:800; }
        .stat-label { font-size:12px; color:rgba(220,245,230,0.55); margin-top:2px; }
        .hamburger { display:none; background:none; border:1px solid var(--border); border-radius:10px; padding:7px 10px; color:var(--text); cursor:pointer; font-size:18px; }
        .sidebar-overlay { display:none; }
        /* form preview */
        .form-preview { background:#fff; color:#1a1a1a; border-radius:16px; padding:0; overflow:hidden; font-family:'Sora',sans-serif; }
        .form-preview-header { background:#0a1a13; padding:20px 24px; text-align:center; }
        .form-preview-agency { font-size:10px; color:rgba(220,245,230,0.7); letter-spacing:0.05em; line-height:1.6; }
        .form-preview-divider { height:1px; background:rgba(255,255,255,0.15); margin:10px 0; }
        .form-preview-title { font-size:16px; font-weight:800; color:#fff; margin:6px 0 4px; letter-spacing:0.05em; }
        .form-preview-sub { font-size:11px; color:rgba(220,245,230,0.5); }
        .form-preview-body { padding:20px 24px; display:flex; flex-direction:column; gap:8px; }
        .form-preview-row { display:flex; gap:12px; align-items:flex-start; padding:6px 0; border-bottom:1px solid #f0f0f0; }
        .form-preview-label { font-size:11px; font-weight:700; color:#555; min-width:130px; flex-shrink:0; padding-top:1px; }
        .form-preview-value { font-size:12px; color:#1a1a1a; font-weight:500; }
        .form-preview-sig { display:flex; gap:24px; margin-top:24px; padding-top:16px; border-top:2px solid #eee; }
        .form-preview-sigbox { flex:1; text-align:center; font-size:10px; color:#666; line-height:1.8; }
        .form-preview-sigline { height:1px; background:#999; margin-bottom:6px; }
        @media (max-width:1024px) {
          .sidebar { display:none; }
          .sidebar.open { display:block; position:fixed; top:0; left:0; bottom:0; z-index:100; overflow-y:auto; padding:16px; background:var(--bg); border-right:1px solid var(--border); width:260px; }
          .sidebar-overlay.open { display:block; position:fixed; inset:0; z-index:99; background:rgba(0,0,0,0.55); }
          .hamburger { display:block; }
        }
        @media (max-width:640px) {
          .portal-layout { padding:16px; }
          .brand-addr { display:none; }
          .brand-name { font-size:14px; }
        }
      `}</style>

      <div className="portal">
        <header className="portal-header">
          <div className="header-inner">
            <div className="brand">
              <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
              <div className="brand-logo">🏛️</div>
              <div>
                <p className="brand-sup">E.B. Bernas Land Consultancy</p>
                <p className="brand-name">EB BERNAS PORTAL V1</p>
                <p className="brand-addr">No. 051, Brgy. Garrita, Bani, Pangasinan</p>
                <p style={{ fontSize: 9, color: "rgba(220,245,230,0.3)", marginTop: 1 }}>v1.0.7 — Jun 22, 2026</p>
              </div>
            </div>
            <div className="header-actions">
              <div style={{ fontSize: 12, color: "rgba(220,245,230,0.6)", textAlign: "right" }}>
                <p style={{ fontWeight: 600, color: "#e8f5ee" }}>{currentUser.displayName}</p>
                <p style={{ fontSize: 10, color: isAdmin ? "#fbbf24" : "#34d399" }}>{isAdmin ? "👑 Admin" : "👤 Employee"}</p>
              </div>
              <button onClick={handleLogout} className="btn-outline" style={{ fontSize: 11 }}>Logout</button>
            </div>
          </div>
        </header>

        <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

        <div className="portal-layout">
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="sidebar-box">
              <p className="nav-eyebrow">Main Menu</p>
              <div style={{ marginBottom: 14 }}>
                {menus.map((m) => (
                  <button key={m.id} onClick={() => setMenu(m.id)}
                    className={`nav-btn ${activeMenu === m.id ? "active" : ""}`}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="selector-box">
                <p className="selector-label">Search Clients</p>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Client name or lot no." className="search-input"
                  style={{ width: "100%", marginBottom: 10 }} />
                <p className="selector-label" style={{ marginTop: 10 }}>Quick Select</p>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
                  className="search-input" style={{ width: "100%", cursor: "pointer" }}>
                  <option>Santos Family</option>
                  <option>Reyes Family</option>
                  <option>Cruz Estate</option>
                </select>
              </div>
            </div>
          </aside>

          <main className="content">
            {activeMenu === "overview" && <OverviewPage caseStore={caseStore} />}
            {activeMenu === "schedule" && <SchedulePage schedules={schedules} setSchedules={setSchedules} />}
            {activeMenu === "dashboard" && <DashboardPage client={selectedClient} caseStore={caseStore} setCaseStore={setCaseStore} isAdmin={isAdmin} />}
            {activeMenu === "cases" && <CasesPage setClient={setSelectedClient} setMenu={setMenu} search={search} setSearch={setSearch} />}
            {activeMenu === "documents" && <DocumentsPage client={selectedClient} isAdmin={isAdmin} />}
            {activeMenu === "checklist" && <ChecklistPage client={selectedClient} caseStore={caseStore} setCaseStore={setCaseStore} isAdmin={isAdmin} />}
            {activeMenu === "messaging" && <MessagingPage />}
            {activeMenu === "newcase" && isAdmin && <NewCasePage />}
            {activeMenu === "newcase" && !isAdmin && <Card><p style={{textAlign:"center",padding:"40px 0",color:"rgba(220,245,230,0.3)"}}>⚠️ Admin access only.</p></Card>}
            {activeMenu === "forms" && <FormsPage caseStore={caseStore} />}
            {activeMenu === "admin" && isAdmin && <AdminPanel />}
          </main>
        </div>
      </div>
    </>
  );
}
