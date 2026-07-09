import React, { useState, useRef, useEffect } from "react";
import { db, listenSchedules, saveSchedule, deleteScheduleDB, saveEmployeeDB, listenEmployees, listenCases, saveCase, deleteCase, uploadClientFile, deleteClientFile, saveProfile, getProfile } from "./firebase";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import EmployeeManager from "./components/employees/EmployeeManager";
import BIRCalculatorPage from "./components/bir/BIRCalculatorPage";
import FinancePage from "./components/finance/FinancePage";

// ── SMS UTILITY ──────────────────────────────────────────────────────────────
async function sendSMS(number, message) {
  const cleanNum = number.replace(/\D/g, "").replace(/^0/, "63");
  try {
    // Call our own Vercel serverless function — avoids CORS
    const res = await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: cleanNum, message }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data };
    return data;
  } catch (err) {
    console.error("SMS error:", err);
    return { error: err.message };
  }
}

function buildScheduleSMS(schedule, employeeName) {
  const dateStr = schedule.date ? new Date(schedule.date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const lot = schedule.lotNo ? `Lot ${schedule.lotNo}` : schedule.title || "";
  const loc = schedule.location ? ` - ${schedule.location}` : "";
  return `E.B. Bernas: Kumusta ${employeeName}! May survey schedule ka sa ${dateStr}${loc}${lot ? `, ${lot}` : ""}. Para sa katanungan, tawagan si Engr. Bernas: 09176525851.`;
}

// ── TELEGRAM NOTIFICATION UTILITY ────────────────────────────────────────────
async function sendTelegram(message) {
  try {
    await fetch("/api/send-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch (err) {
    console.error("Telegram error:", err);
  }
}

// ── AUTH ───────────────────────────────────────────────────────────────────────
const ADMIN_ACCOUNTS = [
  { email: "e.b.bernassurveying@gmail.com", password: "Ebernas2026!", name: "Engr. Eugene Benedict Bernas", role: "admin" },
  { email: "admin2@ebernas.com", password: "Admin2026!", name: "Admin 2", role: "admin" },
];

async function findUser(email, password) {
  const admins = ADMIN_ACCOUNTS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (admins) return admins;
  // Check Firebase employees
  const { getDocs, collection } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "employees"));
  const emps = snap.docs.map(d => d.data());
  return emps.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.approved) || null;
}

async function registerEmployee(name, email, password, mobile) {
  const { getDocs, collection } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "employees"));
  const emps = snap.docs.map(d => d.data());
  const allEmails = [...ADMIN_ACCOUNTS.map(a => a.email), ...emps.map(e => e.email)];
  if (allEmails.find(e => e.toLowerCase() === email.toLowerCase())) return { error: "Email already registered." };
  await saveEmployeeDB({ email, password, name, mobile: mobile || "", role: "employee", approved: false, registeredAt: new Date().toLocaleDateString("en-PH") });
  sendTelegram(`👤 <b>New Employee Registered</b>\nName: ${name}\nEmail: ${email}\nMobile: ${mobile || "—"}\n⚠️ Needs Admin approval`);
  return { success: true };
}

// ── LOGIN / REGISTER PAGE ─────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  // Pre-fill from saved credentials
  const savedCreds = (() => { try { return JSON.parse(localStorage.getItem("ebernas_remember") || "{}"); } catch { return {}; } })();
  const [email, setEmail] = useState(savedCreds.email || "");
  const [password, setPassword] = useState(savedCreds.password || "");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!savedCreds.email);

  const handleLogin = async () => {
    if (!email || !password) { setError("Ilagay ang email at password."); return; }
    setLoading(true); setError("");
    const user = await findUser(email, password);
    setLoading(false);
    if (!user) { setError("Mali ang email o password. Subukan ulit."); return; }
    if (user.role === "employee" && !user.approved) { setError("Hindi pa approved ang iyong account. Antayin ang Admin."); return; }
    // Save or clear remembered credentials
    if (rememberMe) {
      localStorage.setItem("ebernas_remember", JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem("ebernas_remember");
    }
    onLogin({ email: user.email, role: user.role, displayName: user.name, mobile: user.mobile || "" });
  };

  const handleRegister = async () => {
    if (!email || !password || !name || !mobile) { setError("Punan ang lahat ng required fields."); return; }
    if (password.length < 6) { setError("Password — minimum 6 characters."); return; }
    setLoading(true); setError("");
    const result = await registerEmployee(name, email, password, mobile);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setSuccess("✓ Account created! Hintayin ang Admin approval bago makapag-login.");
    setMode("login"); setPassword(""); setEmail(""); setName(""); setMobile("");
  };

  const inputSt = { background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "11px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a1a13", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🏛️</div>
          <p style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#34d399", fontWeight: 600 }}>E.B. Bernas Land Consultancy</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 6 }}>Employee Portal</h1>
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.4)", marginTop: 4 }}>No. 051, Brgy. Garrita, Bani, Pangasinan</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 24, padding: 28 }}>
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

          {error && <div style={{ background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#6ee7b7", marginBottom: 16 }}>{success}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name *" style={inputSt} />
                <input value={mobile} onChange={(e) => setMobile(e.target.value)}
                  placeholder="Contact Number * (e.g. 09xxxxxxxxx)" type="tel" style={inputSt} />
              </>
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address *" type="email" style={inputSt} />
            <div style={{ position: "relative" }}>
              <input value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password *" type={showPass ? "text" : "password"}
                onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
                style={{ ...inputSt, padding: "11px 44px 11px 14px", width: "100%", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 14, border: "none", background: loading ? "rgba(255,255,255,0.5)" : "#fff", color: "#0a1a13", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {loading ? "Sandali lang..." : mode === "login" ? "Login" : "Create Account"}
          </button>

          {mode === "login" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#34d399", cursor: "pointer" }} />
              <span style={{ fontSize: 12, color: "rgba(220,245,230,0.55)" }}>Remember me sa device na ito</span>
            </label>
          )}

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
const INIT_CASES = {};

const CLIENT_FOLDERS = {};

const ALL_CASES = [];

const INIT_MESSAGES = [];

const INIT_FILES = [];



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
function OverviewPage({ caseStore, setCaseStore, schedules = [], currentUser, setActiveMenu }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (currentUser?.displayName || "there").split(" ").pop().toUpperCase();
  const dateStr = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const [caseFilter, setCaseFilter] = useState("all"); // "approval" | "field" | "all"
  const [delTarget, setDelTarget] = useState(null); // client name pending delete confirm
  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "e.b.bernassurveying@gmail.com";

  const totalSchedules = schedules.length;

  const typeIcon = (t) => ({ Survey: "📐", Appointment: "🤝", Deadline: "⚠️", "Follow-up": "📞", Other: "📌" }[t] || "📌");
  const typeColor = (t) => ({ Survey: "#34d399", Appointment: "#60a5fa", Deadline: "#fb7185", "Follow-up": "#fbbf24", Other: "#a78bfa" }[t] || "#a78bfa");

  const todaySchedules = schedules.filter(s => s.date === today && !s.done);
  const upcomingSchedules = schedules.filter(s => !s.done && s.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  // ── Case Status Logic ──
  const getCaseStatus = (data) => {
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

  const getSurveyLabel = (data) => {
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

  const allClients = Object.entries(caseStore).filter(([k]) => k.trim());
  const surveyedClients = allClients.filter(([, d]) => getCaseStatus(d) !== "not_surveyed");
  const processClients = surveyedClients.filter(([, d]) => getCaseStatus(d) === "process");
  const pendingClients = surveyedClients.filter(([, d]) => getCaseStatus(d) === "pending");
  const doneClients = surveyedClients.filter(([, d]) => getCaseStatus(d) === "done");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* ── GREETING ── */}
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontFamily: "Georgia, serif" }}>{greeting}, {firstName}</h1>
        <p style={{ fontSize: 14, color: "rgba(220,245,230,0.5)", marginTop: 4 }}>{dateStr}</p>
      </div>

      {/* ── STATS CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
        <div className="stat-card"><span className="stat-icon">📅</span><p className="stat-value">{totalSchedules}</p><p className="stat-label">Total Schedules</p></div>
        <div className="stat-card"><span className="stat-icon">🔄</span><p className="stat-value" style={{ color: "#60a5fa" }}>{processClients.length}</p><p className="stat-label">On Process</p></div>
        <div className="stat-card"><span className="stat-icon">⏳</span><p className="stat-value" style={{ color: "#fbbf24" }}>{pendingClients.length}</p><p className="stat-label">Cases Pending</p></div>
        <div className="stat-card"><span className="stat-icon">✅</span><p className="stat-value" style={{ color: "#34d399" }}>{doneClients.length}</p><p className="stat-label">Cases Done</p></div>
        <div className="stat-card"><span className="stat-icon">👥</span><p className="stat-value">{allClients.length}</p><p className="stat-label">Active Clients</p></div>
      </div>

      {/* ── TODAY + UPCOMING ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 className="section-title">📅 Today's Schedule</h3>
            <button onClick={() => setActiveMenu("schedule")} style={{ background: "none", border: "none", color: "#34d399", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View all →</button>
          </div>
          {todaySchedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(220,245,230,0.3)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📆</div>
              <p style={{ fontSize: 13 }}>No schedules for today</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todaySchedules.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, border: `1px solid ${typeColor(s.type)}33`, background: `${typeColor(s.type)}0a`, padding: "10px 14px" }}>
                  <span style={{ fontSize: 16 }}>{typeIcon(s.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>{s.lotNo || s.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)" }}>{s.time && "⏰ " + s.time}{s.client && " · 👤 " + s.client}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="section-title" style={{ marginBottom: 16 }}>🔜 Upcoming</h3>
          {upcomingSchedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(220,245,230,0.3)" }}>
              <p style={{ fontSize: 13 }}>No upcoming schedules</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcomingSchedules.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.1)", padding: "10px 14px" }}>
                  <span style={{ fontSize: 16 }}>{typeIcon(s.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{s.lotNo || s.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)" }}>📅 {fmtDate(s.date)}{s.client && " · " + s.client}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── CASE STATUS SUMMARY TABLE ── */}
      {allClients.length > 0 && (() => {
        const approvalClients = surveyedClients.filter(([, d]) => isApprovalCaseType(d));
        const fieldClients = surveyedClients.filter(([, d]) => !isApprovalCaseType(d));
        const visibleClients = caseFilter === "approval" ? approvalClients : caseFilter === "field" ? fieldClients : surveyedClients;

        const renderRow = ([name, data]) => {
          const status = getCaseStatus(data);
          const steps = data?.trackerSteps || {};
          const trackerKey = resolveTrackerKey(data);
          const totalSteps = (APPROVAL_STEPS[trackerKey] || []).length;
          const doneSteps = (APPROVAL_STEPS[trackerKey] || []).filter(s => steps[s.id]?.done).length;
          const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
            const st = {
              done:    { bg: "rgba(52,211,153,0.04)", bgHover: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.15)", pillBg: "rgba(52,211,153,0.15)", color: "#34d399", label: "✅ Done" },
              pending: { bg: "rgba(251,191,36,0.03)", bgHover: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.12)", pillBg: "rgba(251,191,36,0.15)", color: "#fbbf24", label: "⏳ Pending" },
              process: { bg: "rgba(96,165,250,0.03)", bgHover: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.12)", pillBg: "rgba(96,165,250,0.15)", color: "#60a5fa", label: "🔄 On Process" },
            }[status] || { bg: "rgba(96,165,250,0.03)", bgHover: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.12)", pillBg: "rgba(96,165,250,0.15)", color: "#60a5fa", label: "🔄 On Process" };
            return (
            <div key={name} onClick={() => setActiveMenu("dashboard")} className="case-table-row" style={{ display: "grid", gridTemplateColumns: isAdmin ? "2fr 1.5fr 1fr 1fr 36px" : "2fr 1.5fr 1fr 1fr", gap: 8, padding: "10px 12px", borderRadius: 12, background: st.bg, border: `1px solid ${st.border}`, cursor: "pointer", transition: "all 0.15s" }}
              onMouseOver={e => e.currentTarget.style.background = st.bgHover}
              onMouseOut={e => e.currentTarget.style.background = st.bg}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{caseClientName(name)}</p>
                {(data.lotNo || parseCaseKey(name).lot) && <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 2 }}>🏷️ {data.lotNo || parseCaseKey(name).lot}</p>}
              </div>
              <p className="case-table-survey-type" style={{ fontSize: 12, color: "rgba(220,245,230,0.7)", alignSelf: "center" }}>{getSurveyLabel(data)}</p>
              <div style={{ alignSelf: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: st.pillBg, color: st.color }}>
                  {st.label}
                </span>
              </div>
              <div style={{ alignSelf: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: st.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(220,245,230,0.5)", minWidth: 28 }}>{pct}%</span>
                </div>
              </div>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); setDelTarget(name); }} title="Delete case"
                  style={{ alignSelf: "center", background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.6)", fontSize: 15, padding: "0 4px", fontFamily: "inherit" }}>🗑</button>
              )}
            </div>
          );
        };

        return (
          <Card>
            {/* Header + Filter Toggle */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <p className="eyebrow">Case Monitoring</p>
                <h3 className="section-title">📊 Client Status Summary</h3>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "approval", label: "📋 For Approval", count: approvalClients.length },
                  { id: "field",    label: "📐 Field Survey", count: fieldClients.length },
                  { id: "all",      label: "All", count: surveyedClients.length },
                ].map(f => (
                  <button key={f.id} onClick={() => setCaseFilter(f.id)}
                    style={{ fontSize: 11, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all 0.15s",
                      background: caseFilter === f.id ? "#fff" : "rgba(255,255,255,0.07)",
                      color: caseFilter === f.id ? "#0a1a13" : "rgba(220,245,230,0.6)" }}>
                    {f.label} <span style={{ opacity: 0.6 }}>({f.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* On Process/Pending/Done counts for visible group */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 20, padding: "3px 10px", color: "#60a5fa", fontWeight: 700 }}>
                🔄 {visibleClients.filter(([,d]) => getCaseStatus(d) === "process").length} On Process
              </span>
              <span style={{ fontSize: 11, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 20, padding: "3px 10px", color: "#fbbf24", fontWeight: 700 }}>
                ⏳ {visibleClients.filter(([,d]) => getCaseStatus(d) === "pending").length} Pending
              </span>
              <span style={{ fontSize: 11, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 20, padding: "3px 10px", color: "#34d399", fontWeight: 700 }}>
                ✅ {visibleClients.filter(([,d]) => getCaseStatus(d) === "done").length} Done
              </span>
            </div>

            {/* Table header */}
            <div className="case-table-header" style={{ display: "grid", gridTemplateColumns: isAdmin ? "2fr 1.5fr 1fr 1fr 36px" : "2fr 1.5fr 1fr 1fr", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.2)", marginBottom: 8 }}>
              {["Client", "Survey Type", "Status", "Progress"].map(h => (
                <p key={h} className={h === "Survey Type" ? "case-table-survey-type" : ""} style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</p>
              ))}
              {isAdmin && <span />}
            </div>

            {/* Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(() => {
                const subHeader = (text, color) => (
                  <p key={text} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color, margin: "10px 2px 4px" }}>{text}</p>
                );
                const categoryHeader = (text, color) => (
                  <div key={text} style={{ margin: "16px 0 6px", paddingBottom: 6, borderBottom: `1px solid ${color}33` }}>
                    <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color }}>{text}</p>
                  </div>
                );
                // Render Pending + Case Done sub-groups for a set of clients
                const renderStatusGroups = (clients, keyPrefix) => {
                  const processRows = clients.filter(([, d]) => getCaseStatus(d) === "process");
                  const pendingRows = clients.filter(([, d]) => getCaseStatus(d) === "pending");
                  const doneRows = clients.filter(([, d]) => getCaseStatus(d) === "done");
                  return (
                    <React.Fragment key={keyPrefix}>
                      {processRows.length > 0 && subHeader(`🔄 On Process (${processRows.length})`, "#60a5fa")}
                      {processRows.map(renderRow)}
                      {pendingRows.length > 0 && subHeader(`⏳ Pending (${pendingRows.length})`, "#fbbf24")}
                      {pendingRows.map(renderRow)}
                      {doneRows.length > 0 && subHeader(`✅ Case Done (${doneRows.length})`, "#34d399")}
                      {doneRows.map(renderRow)}
                      {clients.length === 0 && (
                        <p style={{ fontSize: 12, color: "rgba(220,245,230,0.3)", padding: "6px 2px" }}>Wala pang cases dito.</p>
                      )}
                    </React.Fragment>
                  );
                };

                // ALL view → separate Approval at Field, bawat isa may Pending/Done
                if (caseFilter === "all") {
                  return (
                    <>
                      {categoryHeader("📋 For Approval", "#fbbf24")}
                      {renderStatusGroups(approvalClients, "appr")}
                      {categoryHeader("📐 Field Survey (Not Approval)", "#34d399")}
                      {renderStatusGroups(fieldClients, "field")}
                    </>
                  );
                }

                // Approval o Field lang
                if (visibleClients.length === 0) {
                  return (
                    <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "16px 0" }}>
                      Wala pang {caseFilter === "approval" ? "approval" : "field survey"} cases.
                    </p>
                  );
                }
                return renderStatusGroups(visibleClients, caseFilter);
              })()}
            </div>
          </Card>
        );
      })()}

      {/* ── COMPANY PROFILE ── */}
      <Card>
        <SectionHeader eyebrow="Company Profile" title="E.B. Bernas Land Consultancy" />
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

      {/* ── DELETE CONFIRM MODAL (Case Monitoring) ── */}
      {delTarget && (
        <div onClick={() => setDelTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f2318", border: "1px solid rgba(251,113,133,0.3)", borderRadius: 24, padding: 28, maxWidth: 400, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#fb7185", marginBottom: 8 }}>⚠️ Delete Case</p>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Sigurado ka ba?</h3>
            <p style={{ fontSize: 13, color: "rgba(220,245,230,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
              Ide-delete ang lahat ng data ni <strong style={{ color: "#e8f5ee" }}>{delTarget}</strong>. <strong style={{ color: "#fb7185" }}>Hindi na mababalik.</strong>
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDelTarget(null)} className="btn-outline" style={{ flex: 1, padding: "12px 0" }}>Cancel</button>
              <button onClick={async () => {
                const name = delTarget;
                setDelTarget(null);
                try {
                  await deleteCase(name);
                  // Real-time listener (listenCases) ang bahalang mag-update ng UI
                  sendTelegram(`🗑 <b>Case Deleted</b>\nClient: ${name}\nBy: ${currentUser?.displayName || "Admin"}`);
                } catch (e) {
                  console.error("Delete failed:", e);
                  alert("❌ Hindi na-delete: " + (e?.message || "Unknown error"));
                }
              }} className="btn-danger" style={{ flex: 1, padding: "12px 0", fontWeight: 700 }}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
// ── APPROVAL TRACKER STEPS ───────────────────────────────────────────────────
const APPROVAL_STEPS = {
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

const resolveTrackerKey = (data) => {
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
const isApprovalCaseType = (data) => {
  const key = resolveTrackerKey(data);
  return key === "subdivision_approval_titled" || key === "subdivision_approval_taxdec";
};

// ── CASE KEY HELPERS (folder-per-client: isang pangalan, maraming lot) ────────
// Ang case key ay "Pangalan — Lot X" para magkahiwalay ang bawat lote ng
// parehong client. Backward-compatible: lumang cases (pangalan lang) ay gumagana pa rin.
const makeCaseKey = (name, lot) => {
  const n = (name || "").trim();
  const l = (lot || "").toString().trim();
  return l ? `${n} — Lot ${l}` : n;
};
const parseCaseKey = (key) => {
  const m = (key || "").match(/^(.*?)\s+—\s+Lot\s+(.+)$/);
  if (m) return { name: m[1].trim(), lot: m[2].trim() };
  return { name: (key || "").trim(), lot: "" };
};
const caseClientName = (key) => parseCaseKey(key).name;

function ClientFilesCard({ client, data, setCaseStore }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef();
  const files = data?.files || [];

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Max 10MB ang file size!"); return; }
    setUploading(true); setError(""); setProgress(0);
    try {
      const fileData = await uploadClientFile(client, file, setProgress);
      const newFiles = [...files, fileData];
      const newData = { ...data, files: newFiles };
      setCaseStore(p => ({ ...p, [client]: newData }));
      await saveCase(client, newData);
      sendTelegram(`📁 <b>Document Uploaded</b>\nClient: ${client}\nFile: ${file.name}\nSize: ${(file.size/1024).toFixed(1)} KB`);
    } catch (err) { setError("Upload failed: " + err.message); }
    setUploading(false); setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (idx) => {
    const f = files[idx];
    try { if (f.path) await deleteClientFile(f.path); } catch {}
    const newFiles = files.filter((_, i) => i !== idx);
    const newData = { ...data, files: newFiles };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const getIcon = (type) => {
    if (!type) return "📄";
    if (type.includes("pdf")) return "📕";
    if (type.includes("image")) return "🖼️";
    if (type.includes("word") || type.includes("doc")) return "📝";
    if (type.includes("sheet") || type.includes("excel") || type.includes("xls")) return "📊";
    return "📄";
  };

  const fmtSize = (b) => !b ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b/1024).toFixed(1) + " KB" : (b/1048576).toFixed(1) + " MB";

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Client Documents</p>
          <h3 className="section-title">📁 Uploaded Files</h3>
        </div>
        <span style={{ fontSize: 12, color: "rgba(220,245,230,0.4)" }}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
      </div>
      <input ref={fileInputRef} type="file" onChange={handleUpload} style={{ display: "none" }}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className="btn-primary" style={{ width: "100%", padding: "11px 0", fontSize: 13, marginBottom: 12, opacity: uploading ? 0.7 : 1 }}>
        {uploading ? `⏳ Uploading... ${progress}%` : "📤 Upload File (PDF / Image / Doc)"}
      </button>
      {uploading && (
        <div style={{ marginBottom: 10, borderRadius: 8, background: "rgba(0,0,0,0.2)", height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#34d399", width: `${progress}%`, transition: "width 0.3s" }} />
        </div>
      )}
      {error && <p style={{ fontSize: 11, color: "#fb7185", marginBottom: 8 }}>⚠️ {error}</p>}
      {files.length === 0 ? (
        <p style={{ fontSize: 12, color: "rgba(220,245,230,0.25)", textAlign: "center", padding: "12px 0" }}>Wala pang uploaded files</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{getIcon(f.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.35)", marginTop: 2 }}>{fmtSize(f.size)} · {f.uploadedAt}</p>
              </div>
              <a href={f.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: "#34d399", fontWeight: 600, textDecoration: "none", flexShrink: 0, padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(52,211,153,0.3)" }}>
                View
              </a>
              <button onClick={() => handleDelete(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.5)", fontSize: 16, padding: "0 2px", fontFamily: "inherit" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function InlineReqsEditor({ data, client, setCaseStore }) {
  const [newReq, setNewReq] = useState("");
  const checklist = data?.checklist || [];

  // Default requirements based on survey type
  const getDefaults = () => {
    const cat = data?.surveyCategory || "";
    const ct = data?.caseType || "";
    if (cat === "approval" && ct.includes("Tax")) return ["Tax Declaration", "Barangay Certificate", "Court Certificate", "Deed of Conveyance", "Land Status", "Investigation Report"];
    if (cat === "approval" || ct.includes("Titled")) return ["Title (Certified True Copy)", "Plan", "Trans ID"];
    if (cat === "subdivision" && data?.surveySubCategory === "Para sa Approval na") {
      if (ct.includes("Tax")) return ["Tax Declaration", "Barangay Certificate", "Court Certificate", "Deed of Conveyance", "Land Status", "Investigation Report"];
      return ["Title (Certified True Copy)", "Plan", "Trans ID"];
    }
    return [];
  };

  const loadDefaults = async () => {
    const defaults = getDefaults();
    if (!defaults.length) return;
    const newData = { ...data, checklist: defaults.map(name => ({ name, status: "Pending" })) };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const toggleItem = async (i) => {
    const updated = checklist.map((item, idx) => idx === i ? { ...item, status: item.status === "Completed" ? "Pending" : "Completed" } : item);
    const newData = { ...data, checklist: updated };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const addItem = async () => {
    if (!newReq.trim()) return;
    const newData = { ...data, checklist: [...checklist, { name: newReq.trim(), status: "Pending" }] };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
    setNewReq("");
  };

  const removeItem = async (i) => {
    const newData = { ...data, checklist: checklist.filter((_, idx) => idx !== i) };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, paddingLeft: 8, borderLeft: "2px solid rgba(251,191,36,0.25)", marginLeft: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.1em", textTransform: "uppercase" }}>📋 Survey Authority Requirements</p>
        {checklist.length === 0 && (
          <button onClick={loadDefaults} style={{ fontSize: 10, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "3px 8px", color: "#fbbf24", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            Load Defaults
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {checklist.length === 0 && (
          <p style={{ fontSize: 11, color: "rgba(220,245,230,0.3)", marginBottom: 4 }}>Wala pang requirements — mag-add o i-click "Load Defaults".</p>
        )}
        {checklist.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "7px 10px", borderRadius: 10, background: item.status === "Completed" ? "rgba(52,211,153,0.08)" : "rgba(0,0,0,0.15)", border: item.status === "Completed" ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => toggleItem(i)} style={{ width: 20, height: 20, borderRadius: "50%", border: item.status === "Completed" ? "none" : "2px solid rgba(255,255,255,0.2)", background: item.status === "Completed" ? "#34d399" : "transparent", color: item.status === "Completed" ? "#0a1a13" : "transparent", fontSize: 10, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>✓</button>
            <p style={{ flex: 1, textDecoration: item.status === "Completed" ? "line-through" : "none", opacity: item.status === "Completed" ? 0.5 : 1 }}>{item.name}</p>
            <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.5)", fontSize: 13, padding: "0 2px", fontFamily: "inherit" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={newReq} onChange={e => setNewReq(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addItem(); }}
          placeholder="+ Mag-add ng requirement..."
          style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
        <button onClick={addItem} className="btn-primary" style={{ padding: "6px 12px", fontSize: 11 }}>Add</button>
      </div>
    </div>
  );
}

// ── DEBOUNCED FIELD ──────────────────────────────────────────────────────────
// Local state habang nagta-type (instant, walang lag); save lang pag tumigil
// (~0.6s) o pag-blur. Hindi ino-overwrite ng server snapshot habang naka-focus,
// kaya hindi na kusang nagde-delete / nagta-type.
function DebouncedField({ value, onCommit, multiline = false, ...rest }) {
  const [local, setLocal] = useState(value || "");
  const focused = useRef(false);
  const timer = useRef(null);

  // Sync mula sa server value — pero LANG kung hindi naka-focus (hindi nagta-type)
  useEffect(() => {
    if (!focused.current) setLocal(value || "");
  }, [value]);

  const commit = (val) => {
    if (val !== (value || "")) onCommit(val);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocal(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(val), 600);
  };

  const handleBlur = () => {
    focused.current = false;
    if (timer.current) clearTimeout(timer.current);
    commit(local);
  };

  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      {...rest}
      value={local}
      onChange={handleChange}
      onFocus={() => { focused.current = true; }}
      onBlur={handleBlur}
    />
  );
}

// ── MONITORING HISTORY (type-nalang na remarks + date) ──────────────────────
// Isang timeline sa loob ng Monitoring submenu. Mag-type ka lang ng remark
// (hal. napending, na-resubmit, na-pasa sa CENRO, etc.) + petsa → i-add.
function MonitoringHistory({ log, onSave }) {
  const list = Array.isArray(log) ? log : [];
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = (e) => {
    e.stopPropagation();
    if (!text.trim()) return;
    onSave([...list, { id: Date.now().toString(), date, note: text.trim() }]);
    setText("");
  };
  const remove = (id) => onSave(list.filter((x) => x.id !== id));
  const sorted = [...list].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const inp = { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: 10 }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>📋 History / Timeline (may petsa)</p>

      {sorted.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {sorted.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.15)", borderLeft: "3px solid #60a5fa" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>📅 {fmtDate(e.date)}</p>
                <p style={{ fontSize: 12, color: "rgba(220,245,230,0.85)", marginTop: 1, lineHeight: 1.4 }}>{e.note}</p>
              </div>
              <button onClick={() => remove(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.5)", fontSize: 12, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "rgba(220,245,230,0.3)", marginBottom: 8 }}>Wala pang naka-log. Mag-type sa ibaba. ↓</p>
      )}

      {/* Add — type remark + date */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ ...inp, width: "auto", alignSelf: "flex-start" }} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} onClick={(e) => e.stopPropagation()} rows={2}
          placeholder="I-type ang remark... hal. Napending — kulang Court Cert / Na-resubmit na / Na-pasa sa CENRO / Approved ni Engr. Cruz"
          style={{ ...inp, width: "100%", resize: "vertical" }} />
        <button onClick={add} disabled={!text.trim()}
          style={{ fontSize: 11, fontWeight: 700, padding: "8px 0", borderRadius: 10, border: "none", cursor: text.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", background: text.trim() ? "#60a5fa" : "rgba(255,255,255,0.1)", color: text.trim() ? "#0a1a13" : "rgba(220,245,230,0.4)" }}>
          ➕ I-add sa History
        </button>
      </div>
    </div>
  );
}

function ApprovalTrackerCard({ client, data, setCaseStore, isAdmin = false }) {
  const trackerKey = resolveTrackerKey(data);
  const defaultSteps = APPROVAL_STEPS[trackerKey] || [];
  // Gumamit ng custom steps kung na-edit; kung wala, default para sa tracker type
  const steps = (Array.isArray(data.customSteps) && data.customSteps.length) ? data.customSteps : defaultSteps;
  const trackerData = data?.trackerSteps || {};
  const [expandedStep, setExpandedStep] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draftSteps, setDraftSteps] = useState(steps);

  const saveCustomSteps = async (newSteps) => {
    const newData = { ...data, customSteps: newSteps };
    setCaseStore(p => ({ ...p, [client]: newData }));
    try { await saveCase(client, newData); } catch (e) { console.error(e); }
  };
  const resetToDefault = async () => {
    const newData = { ...data };
    delete newData.customSteps;
    setCaseStore(p => ({ ...p, [client]: newData }));
    try { await saveCase(client, newData); } catch (e) { console.error(e); }
    setEditMode(false);
  };

  const toggleStep = async (stepId) => {
    const current = trackerData[stepId] || {};
    const nowDone = !current.done;
    const updated = { ...trackerData, [stepId]: { ...current, done: nowDone, doneAt: nowDone ? new Date().toLocaleDateString("en-PH") : "" } };
    const newData = { ...data, trackerSteps: updated };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
    // Telegram notification
    const stepLabel = steps.find(s => s.id === stepId)?.label || stepId;
    if (nowDone) sendTelegram(`📊 <b>Tracker Step Done</b>\nClient: ${client}\nStep: ${stepLabel}`);
  };

  const [tgStatus, setTgStatus] = useState(""); // "" | "sending" | "sent" | "error" (remarks button)
  const [updStatus, setUpdStatus] = useState(""); // header "Send Update" button

  // Shared: send message to admin chat + all employees with connected Telegram
  const broadcastToTeam = async (msg) => {
    // 1) Send sa admin chat (Engr. Bernas)
    await sendTelegram(msg);
    // 2) Send sa lahat ng employees na may connected Telegram
    const { getDocs, collection } = await import("firebase/firestore");
    const [empSnap, profSnap] = await Promise.all([
      getDocs(collection(db, "employees")),
      getDocs(collection(db, "profiles")),
    ]);
    const profiles = {};
    profSnap.docs.forEach(d => { const p = d.data(); if (p.email) profiles[p.email] = p; });
    const chatIds = new Set();
    empSnap.docs.forEach(d => {
      const emp = d.data();
      const cid = emp.telegramChatId || profiles[emp.email]?.telegramChatId || "";
      if (cid) chatIds.add(String(cid).trim());
    });
    await Promise.all([...chatIds].map(chatId =>
      fetch("/api/send-telegram-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, message: msg }) }).catch(() => {})
    ));
  };

  const broadcastRemarks = async (sd) => {
    setTgStatus("sending");
    const st = sd.approvalRemarks ? `\nStatus: ${sd.approvalRemarks}` : "";
    const dt = sd.remarksDate ? `\nDate: ${fmtDate(sd.remarksDate)}` : "";
    const msg = `📝 <b>Monitoring Remarks — Regional Office</b>\nClient: ${client}${data?.lotNo ? "\nLot: " + data.lotNo : ""}${st}${dt}\n\nRemarks: ${sd.monitoringNotes}`;
    try { await broadcastToTeam(msg); setTgStatus("sent"); }
    catch (err) { console.error("Broadcast error:", err); setTgStatus("sent"); }
    setTimeout(() => setTgStatus(""), 4000);
  };

  // Header "Send Update" — buong status ng proseso
  const broadcastUpdate = async () => {
    setUpdStatus("sending");
    const done = steps.filter(s => trackerData[s.id]?.done);
    const currentStep = steps.find(s => !trackerData[s.id]?.done);
    const lastDone = done.length ? done[done.length - 1] : null;
    const monStep = Object.values(trackerData).find(s => s?.monitoringNotes || s?.approvalRemarks);
    const statusLine = monStep?.approvalRemarks ? `\nRO Status: ${monStep.approvalRemarks}` : "";
    const notesLine = monStep?.monitoringNotes ? `\nRemarks: ${monStep.monitoringNotes}` : "";
    const msg = `🔔 <b>Case Update</b>\nClient: ${client}${data?.lotNo ? "\nLot: " + data.lotNo : ""}${data?.propertyLocation ? "\nLocation: " + data.propertyLocation : ""}\n\nProgress: ${pct}% (${doneCount}/${steps.length} steps)${lastDone ? `\n✅ Latest done: ${lastDone.label}` : ""}${currentStep ? `\n⏭️ Next: ${currentStep.label}` : "\n🎉 COMPLETED na lahat ng steps!"}${statusLine}${notesLine}`;
    try { await broadcastToTeam(msg); setUpdStatus("sent"); }
    catch (err) { console.error("Update broadcast error:", err); setUpdStatus("sent"); }
    setTimeout(() => setUpdStatus(""), 4000);
  };

  const setStepField = async (stepId, field, val) => {
    const current = trackerData[stepId] || {};
    const updated = { ...trackerData, [stepId]: { ...current, [field]: val } };
    const newData = { ...data, trackerSteps: updated };
    setCaseStore(p => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
    // Telegram notification for approval status change
    if (field === "approvalRemarks" && val) {
      const emoji = val === "Approved" ? "✅" : val === "Pending" ? "⏳" : "⚠️";
      sendTelegram(`${emoji} <b>Approval Status Updated</b>\nClient: ${client}\nStatus: ${val}`);
    }
    if (field === "transId" && val) {
      sendTelegram(`🔢 <b>Transaction ID Added</b>\nClient: ${client}\nTrans ID: ${val}`);
    }
  };

  const doneCount = steps.filter(s => trackerData[s.id]?.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const isCompleted = pct === 100;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p className="eyebrow">Approval Tracker</p>
          <h3 className="section-title">📊 Process Steps</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isAdmin && (
            <button onClick={() => { setDraftSteps(steps); setEditMode(!editMode); }}
              style={{ fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 999, border: editMode ? "none" : "1px solid rgba(96,165,250,0.4)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                background: editMode ? "#60a5fa" : "transparent", color: editMode ? "#0a1a13" : "#60a5fa" }}>
              {editMode ? "✖ Isara" : "✏️ Edit Steps"}
            </button>
          )}
          <button onClick={broadcastUpdate} disabled={updStatus === "sending"}
            style={{ fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap",
              background: updStatus === "sent" ? "rgba(52,211,153,0.2)" : "#fbbf24", color: updStatus === "sent" ? "#34d399" : "#0a1a13", opacity: updStatus === "sending" ? 0.6 : 1 }}>
            {updStatus === "sending" ? "📤 Sine-send..." : updStatus === "sent" ? "✅ Na-update!" : "🔔 Send Update"}
          </button>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: isCompleted ? "#34d399" : "#fbbf24" }}>{pct}%</p>
            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)" }}>{doneCount}/{steps.length} steps</p>
          </div>
        </div>
      </div>

      {/* ── EDIT STEPS PANEL (admin) ── */}
      {editMode && (
        <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 14, padding: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", marginBottom: 4 }}>✏️ I-edit ang Process Steps</p>
          <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 12 }}>
            Iba ang haba ng proseso ng Titled vs Untitled/Tax Dec — pwede mong baguhin dito. Ang mga steps na ito ay para sa case na ito lang.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {draftSteps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                  <button onClick={() => { if (i === 0) return; const d = [...draftSteps]; [d[i-1], d[i]] = [d[i], d[i-1]]; setDraftSteps(d); }} disabled={i === 0}
                    style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "rgba(255,255,255,0.15)" : "#60a5fa", fontSize: 12, padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={() => { if (i === draftSteps.length-1) return; const d = [...draftSteps]; [d[i+1], d[i]] = [d[i], d[i+1]]; setDraftSteps(d); }} disabled={i === draftSteps.length-1}
                    style={{ background: "none", border: "none", cursor: i === draftSteps.length-1 ? "default" : "pointer", color: i === draftSteps.length-1 ? "rgba(255,255,255,0.15)" : "#60a5fa", fontSize: 12, padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <input value={s.label} onChange={e => { const d = [...draftSteps]; d[i] = { ...d[i], label: e.target.value }; setDraftSteps(d); }}
                    placeholder="Pangalan ng step (hal. 📤 Submitted sa CENRO)" style={{ width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  <input value={s.detail || ""} onChange={e => { const d = [...draftSteps]; d[i] = { ...d[i], detail: e.target.value }; setDraftSteps(d); }}
                    placeholder="Detalye (optional)" style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "rgba(220,245,230,0.7)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
                <button onClick={() => setDraftSteps(draftSteps.filter((_, idx) => idx !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.6)", fontSize: 15, padding: "2px 4px" }}>🗑</button>
              </div>
            ))}
          </div>
          <button onClick={() => setDraftSteps([...draftSteps, { id: "step_" + Date.now(), label: "🆕 Bagong Step", detail: "" }])}
            style={{ width: "100%", fontSize: 12, fontWeight: 700, padding: "8px 0", borderRadius: 10, border: "1px dashed rgba(96,165,250,0.4)", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#60a5fa", marginBottom: 12 }}>
            ➕ Magdagdag ng Step
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => { await saveCustomSteps(draftSteps); setEditMode(false); }}
              style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#34d399", color: "#0a1a13" }}>💾 I-save ang Steps</button>
            <button onClick={resetToDefault}
              style={{ fontSize: 12, fontWeight: 700, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "rgba(220,245,230,0.7)" }}>↺ Default</button>
          </div>
        </div>
      )}
      <div className="progress-track" style={{ marginBottom: 20 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: isCompleted ? "#34d399" : "#fbbf24" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step, idx) => {
          const sd = trackerData[step.id] || {};
          const isDone = sd.done;
          const prevDone = idx === 0 || trackerData[steps[idx - 1].id]?.done;
          return (
            <div key={step.id} style={{
              borderRadius: 14, border: isDone ? "1px solid rgba(52,211,153,0.3)" : prevDone ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(255,255,255,0.07)",
              background: isDone ? "rgba(52,211,153,0.06)" : prevDone ? "rgba(251,191,36,0.04)" : "rgba(0,0,0,0.1)",
              padding: "12px 14px", transition: "all 0.2s",
              cursor: "pointer",
            }} onClick={(e) => {
              setExpandedStep(expandedStep === step.id ? null : step.id);
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }} style={{
                  width: 28, height: 28, borderRadius: "50%", border: isDone ? "none" : "2px solid rgba(255,255,255,0.2)",
                  background: isDone ? "#34d399" : "transparent", color: isDone ? "#0a1a13" : "rgba(220,245,230,0.3)",
                  fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "inherit",
                }}>
                  {isDone ? "✓" : idx + 1}
                </button>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isDone ? "#34d399" : prevDone ? "#e8f5ee" : "rgba(220,245,230,0.4)" }}>
                    {step.label}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(220,245,230,0.35)", marginTop: 2 }}>{step.detail}</p>
                  {sd.stepNote && expandedStep !== step.id && <p style={{ fontSize: 11, color: "#fbbf24", marginTop: 3 }}>📝 {sd.stepNote}</p>}
                  {sd.monitoringNotes && expandedStep !== step.id && <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 3 }}>📝 {sd.monitoringNotes}</p>}
                </div>
                {isDone && sd.doneAt && (
                  <span style={{ fontSize: 10, color: "#34d399", fontWeight: 600, whiteSpace: "nowrap" }}>✓ {sd.doneAt}</span>
                )}
                <span style={{ fontSize: 12, color: "rgba(220,245,230,0.35)", marginLeft: 4 }}>
                  {expandedStep === step.id ? "▲" : "▼"}
                </span>
              </div>

              {/* Date of release input */}
              {step.hasDate && isDone && (
                <div style={{ marginTop: 10, paddingLeft: 40 }}>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>📅 Date:</p>
                  <input type="date" value={sd.dateValue || ""} onChange={e => setStepField(step.id, "dateValue", e.target.value)}
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                  {sd.dateValue && <p style={{ fontSize: 11, color: "#34d399", marginTop: 4 }}>{fmtDate(sd.dateValue)}</p>}
                </div>
              )}

              {/* Trans ID input */}
              {step.hasInput === "transId" && (isDone || prevDone) && (
                <div style={{ marginTop: 10, paddingLeft: 40 }}>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>🔢 Transaction ID:</p>
                  <DebouncedField value={sd.transId || ""} onCommit={val => setStepField(step.id, "transId", val)}
                    placeholder="i-type ang Trans ID..." style={{ background: "rgba(0,0,0,0.25)", border: "1.5px solid rgba(52,211,153,0.3)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%", fontWeight: 600 }} />
                  {sd.transId && <p style={{ fontSize: 12, color: "#34d399", marginTop: 5, fontWeight: 700 }}>✓ {sd.transId}</p>}
                </div>
              )}

              {/* ── SURVEY AUTHORITY SUBMENU ── */}
              {step.id === "reqs_collected" && expandedStep === "reqs_collected" && (
                <InlineReqsEditor data={data} client={client} setCaseStore={setCaseStore} />
              )}

              {/* ── MONITORING REMARKS SUBMENU ── */}
              {step.hasInput === "approvalRemarks" && expandedStep === step.id && (
                <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, paddingLeft: 8, borderLeft: "2px solid rgba(96,165,250,0.3)", marginLeft: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.1em", textTransform: "uppercase" }}>🔍 Monitoring Details</p>

                  {/* Status dropdown */}
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>📌 Status:</p>
                    <select value={sd.approvalRemarks || ""} onChange={e => { e.stopPropagation(); setStepField(step.id, "approvalRemarks", e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                      <option value="">-- Piliin ang status --</option>
                      <option value="Pending">⏳ Pending</option>
                      <option value="For Compliance">⚠️ For Compliance</option>
                      <option value="For Resubmission">🔄 For Resubmission</option>
                      <option value="Resubmitted">📤 Resubmitted (naghihintay sa Region)</option>
                      <option value="Approved">✅ Approved</option>
                    </select>
                    {sd.approvalRemarks && (
                      <p style={{ fontSize: 11, marginTop: 4, fontWeight: 700, color: sd.approvalRemarks === "Approved" ? "#34d399" : sd.approvalRemarks === "Resubmitted" ? "#60a5fa" : sd.approvalRemarks === "Pending" ? "#fbbf24" : "#fb7185" }}>
                        {sd.approvalRemarks === "Approved" ? "✅" : sd.approvalRemarks === "Resubmitted" ? "📤" : sd.approvalRemarks === "Pending" ? "⏳" : "⚠️"} {sd.approvalRemarks}
                      </p>
                    )}
                  </div>

                  {/* Reason for pending */}
                  {(sd.approvalRemarks === "Pending" || sd.approvalRemarks === "For Compliance" || sd.approvalRemarks === "For Resubmission") && (
                    <div>
                      <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>❓ Bakit napending / kulang:</p>
                      <DebouncedField value={sd.pendingReason || ""} onCommit={val => setStepField(step.id, "pendingReason", val)}
                        onClick={e => e.stopPropagation()}
                        placeholder="e.g. Kulang ang Court Certificate..." style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                    </div>
                  )}

                  {/* Free-text remarks — ano ang nangyari sa Regional Office */}
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>📝 Remarks — ano ang nangyari sa Regional Office:</p>
                    <DebouncedField multiline value={sd.monitoringNotes || ""} onCommit={val => setStepField(step.id, "monitoringNotes", val)}
                      onClick={e => e.stopPropagation()} rows={3}
                      placeholder="e.g. Binisita 7/7 — sabi ng evaluator, nasa signing na ng RTD ang plan..."
                      style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                    {sd.monitoringNotes && (
                      <button onClick={(e) => { e.stopPropagation(); broadcastRemarks(sd); }} disabled={tgStatus === "sending"}
                        style={{ marginTop: 8, fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          background: tgStatus === "sent" ? "rgba(52,211,153,0.2)" : "#60a5fa", color: tgStatus === "sent" ? "#34d399" : "#0a1a13", opacity: tgStatus === "sending" ? 0.6 : 1 }}>
                        {tgStatus === "sending" ? "📤 Sine-send..." : tgStatus === "sent" ? "✅ Na-send sa Telegram (ikaw + team)!" : "📲 I-send sa Telegram (Admin + Employees)"}
                      </button>
                    )}
                  </div>

                  {/* Date ng natanggap ang remarks */}
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>📅 Date na natanggap ang remarks:</p>
                    <input type="date" value={sd.remarksDate || ""} onChange={e => setStepField(step.id, "remarksDate", e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                    {sd.remarksDate && <p style={{ fontSize: 11, color: "#34d399", marginTop: 3 }}>{fmtDate(sd.remarksDate)}</p>}
                  </div>

                  {/* Date ng re-submit */}
                  {(sd.approvalRemarks === "For Compliance" || sd.approvalRemarks === "For Resubmission") && (
                    <div>
                      <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>🔄 Date ng Re-submit:</p>
                      <input type="date" value={sd.resubmitDate || ""} onChange={e => setStepField(step.id, "resubmitDate", e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                      {sd.resubmitDate && <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 3 }}>🔄 Re-submit: {fmtDate(sd.resubmitDate)}</p>}
                    </div>
                  )}

                  {/* ── HISTORY / TIMELINE ng Remarks (type-nalang) ── */}
                  <MonitoringHistory log={sd.monitoringLog} onSave={(newLog) => setStepField(step.id, "monitoringLog", newLog)} />
                </div>
              )}

              {/* Step Note — for all steps except monitoring and approved */}
              {expandedStep === step.id && step.id !== "monitoring" && step.id !== "approved" && (
                <div style={{ marginTop: 10, paddingLeft: 40 }} onClick={e => e.stopPropagation()}>
                  <p style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>📝 Remarks / Notes:</p>
                  <DebouncedField value={sd.stepNote || ""} onCommit={val => setStepField(step.id, "stepNote", val)}
                    placeholder="I-type ang remarks para sa step na ito..."
                    style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isCompleted && (
        <div style={{ marginTop: 16, borderRadius: 14, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "14px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#34d399" }}>🎉 COMPLETED!</p>
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.5)", marginTop: 4 }}>Tapos na ang lahat ng steps para kay {caseClientName(client)}!</p>
        </div>
      )}
    </Card>
  );
}

function SurveyRequirementsCard({ data, client, toggle, addReq, removeReq, updateReqRemark }) {
  const [newReq, setNewReq] = useState("");
  const [expandedIdx, setExpandedIdx] = useState(null);
  const checklist = data.checklist || [];
  const reqDone = checklist.filter(c => c.status === "Completed").length;
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p className="eyebrow">Survey Authority</p>
          <h3 className="section-title">📁 Requirements</h3>
        </div>
        <span style={{ fontSize: 12, color: "rgba(220,245,230,0.45)", marginTop: 4 }}>{reqDone}/{checklist.length} done</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {checklist.length === 0 && (
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "12px 0" }}>Wala pang requirements. Mag-add sa baba. 👇</p>
        )}
        {checklist.map((item, i) => (
          <div key={item.name + i} style={{ borderRadius: 12, border: item.status === "Completed" ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(255,255,255,0.08)", background: item.status === "Completed" ? "rgba(52,211,153,0.05)" : "rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              <button onClick={() => toggle(i)} style={{ width: 24, height: 24, borderRadius: "50%", border: item.status === "Completed" ? "none" : "2px solid rgba(255,255,255,0.2)", background: item.status === "Completed" ? "#34d399" : "transparent", color: item.status === "Completed" ? "#0a1a13" : "transparent", fontWeight: 800, fontSize: 12, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 500, textDecoration: item.status === "Completed" ? "line-through" : "none", opacity: item.status === "Completed" ? 0.45 : 1 }}>{item.name}</p>
              {item.remark && <span style={{ fontSize: 10, color: "#fbbf24", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {item.remark}</span>}
              <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} style={{ background: "none", border: "none", cursor: "pointer", color: expandedIdx === i ? "#60a5fa" : "rgba(220,245,230,0.3)", fontSize: 12, padding: "0 4px", fontFamily: "inherit" }}>📝</button>
              <button onClick={() => removeReq(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(251,113,133,0.5)", fontSize: 14, padding: "0 4px", fontFamily: "inherit" }}>✕</button>
            </div>
            {expandedIdx === i && (
              <div style={{ padding: "0 12px 10px 44px" }}>
                <DebouncedField value={item.remark || ""} onCommit={val => updateReqRemark(i, val)}
                  placeholder="Add remarks / notes (e.g. CTC, pending, etc.)"
                  style={{ width: "100%", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#e8f5ee", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newReq} onChange={e => setNewReq(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newReq.trim()) { addReq(newReq); setNewReq(""); } }}
          placeholder="+ Mag-add ng requirement..."
          style={{ flex: 1, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
        <button onClick={() => { if (newReq.trim()) { addReq(newReq); setNewReq(""); } }} className="btn-primary" style={{ padding: "8px 14px", fontSize: 12 }}>Add</button>
      </div>
    </Card>
  );
}

// ── CLIENT SMS CARD ───────────────────────────────────────────────────────────
function ClientSmsCard({ client, data, currentUser }) {
  const [smsLog, setSmsLog] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [smsStatus, setSmsStatus] = useState(""); // "" | "sending" | "sent" | "error"
  const [showCompose, setShowCompose] = useState(false);

  // Load SMS log from caseStore data
  useEffect(() => {
    setSmsLog(data?.smsLog || []);
  }, [data]);

  const contactNum = data?.contact || "";

  // ── Generate template based on current tracker state ──
  // ── Detect case type ──
  const isFieldSurvey = (() => {
    const cat = data?.surveyCategory || "";
    const sub = data?.surveySubCategory || "";
    const ct = data?.caseType || "";
    return (
      cat === "relocation" || cat === "topographic" || cat === "segregation" || cat === "verification" ||
      (cat === "subdivision" && sub !== "Para sa Approval na") ||
      (!cat && (ct.includes("Relocation") || ct.includes("Topographic") || ct.includes("Segregation")))
    );
  })();

  const getDocumentType = () => {
    const cat = data?.surveyCategory || "";
    const ct = data?.caseType || "";
    if (cat === "relocation" || ct.includes("Relocation")) return "Relocation Plan";
    if (cat === "topographic" || ct.includes("Topographic")) return "Topographic Survey";
    if (cat === "segregation" || ct.includes("Segregation")) return "Segregation Plan";
    if (cat === "verification") return "Verification Survey";
    if (cat === "subdivision") return "Subdivision Plan";
    return "Survey Plan";
  };

  const generateTemplate = (type) => {
    const lotNo = data?.lotNo || "—";
    const location = data?.propertyLocation || "—";
    const docType = getDocumentType();
    const transId = data?.trackerSteps?.trans_id?.transId || "";
    const monStep = Object.values(data?.trackerSteps || {}).find(s => s.approvalRemarks);
    const pendingReason = monStep?.pendingReason || "";

    if (type === "ready") {
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nYour ${docType} for Lot ${lotNo} located at ${location} is now ready for claiming.\n\nPlease visit our office during business hours.\n\nThank you!`;
    }
    if (type === "transid" && transId) {
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nYour Transaction ID ${transId} for Lot ${lotNo} has been received and is now being processed.\n\nFor inquiries, please contact us at 09176525851.\n\nThank you!`;
    }
    if (type === "pending") {
      const reason = pendingReason ? `\n\nReason: ${pendingReason}.` : "";
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nYour ${docType} for Lot ${lotNo} is currently PENDING in the approval process.${reason}\n\nFor inquiries, please contact us at 09176525851.\n\nThank you!`;
    }
    if (type === "approved") {
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nGreat news! Your ${docType} for Lot ${lotNo} has been APPROVED. We will contact you shortly for the next steps.\n\nFor inquiries, please contact us at 09176525851.\n\nThank you!`;
    }
    if (type === "compliance") {
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nYour ${docType} for Lot ${lotNo} requires additional documents (FOR COMPLIANCE).${pendingReason ? `\n\nReason: ${pendingReason}.` : ""}\n\nPlease visit our office at your earliest convenience.\n\nFor inquiries: 09176525851.\n\nThank you!`;
    }
    if (type === "remarks") {
      const monNotes = data?.trackerSteps?.monitoring?.monitoringNotes || "";
      const status = monStep?.approvalRemarks ? `\n\nStatus: ${monStep.approvalRemarks}` : "";
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\nUpdate on your ${docType} for Lot ${lotNo}:${status}${monNotes ? `\n\nRemarks: ${monNotes}` : ""}\n\nFor inquiries, please contact us at 09176525851.\n\nThank you!`;
    }
    if (type === "custom") {
      return `E.B. BERNAS LAND CONSULTANCY\n\nGood day, ${client}!\n\n`;
    }
    return "";
  };

  // ── Determine which templates are relevant ──
  const getRelevantTemplates = () => {
    const templates = [];
    const transId = data?.trackerSteps?.trans_id?.transId;
    const monStep = Object.values(data?.trackerSteps || {}).find(s => s.approvalRemarks);
    const approvalStatus = monStep?.approvalRemarks || "";

    if (isFieldSurvey) {
      templates.push({ id: "ready", label: "✅ Ready for Claiming", color: "#34d399" });
    }
    if (transId) templates.push({ id: "transid", label: "🔢 May Trans ID Na", color: "#34d399" });
    if (approvalStatus === "Pending") templates.push({ id: "pending", label: "⏳ Status: Pending", color: "#fbbf24" });
    if (approvalStatus === "For Compliance" || approvalStatus === "For Resubmission") templates.push({ id: "compliance", label: "⚠️ For Compliance", color: "#fb7185" });
    if (approvalStatus === "Approved") templates.push({ id: "approved", label: "✅ Approved Na!", color: "#34d399" });
    if (data?.trackerSteps?.monitoring?.monitoringNotes) templates.push({ id: "remarks", label: "📝 Send Remarks", color: "#60a5fa" });
    templates.push({ id: "custom", label: "✏️ Custom", color: "#60a5fa" });
    return templates;
  };

  // Auto-fill default template for field survey types
  useEffect(() => {
    if (isFieldSurvey && !msgText && showCompose) {
      setMsgText(generateTemplate("ready"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompose]);

  const handleSend = async () => {
    if (!msgText.trim()) return;
    if (!contactNum) { setSmsStatus("error"); setTimeout(() => setSmsStatus(""), 3000); return; }
    setSmsStatus("sending");
    const result = await sendSMS(contactNum, msgText);
    const logEntry = {
      id: Date.now(),
      message: msgText,
      sentBy: currentUser?.displayName || "Admin",
      sentAt: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      status: result?.error ? "Failed" : "Sent",
      contact: contactNum,
    };
    const newLog = [logEntry, ...smsLog];
    setSmsLog(newLog);
    // Save log to Firebase inside caseStore
    await saveCase(client, { ...data, smsLog: newLog });
    setSmsStatus(result?.error ? "error" : "sent");
    setTimeout(() => { setSmsStatus(""); setShowCompose(false); setMsgText(""); }, 3000);
  };

  const templates = getRelevantTemplates();

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Client Communication</p>
          <h3 className="section-title">📲 SMS Updates</h3>
        </div>
        {!showCompose && (
          <button onClick={() => setShowCompose(true)} className="btn-primary" style={{ fontSize: 12, padding: "7px 14px" }}>
            + Send SMS
          </button>
        )}
      </div>

      {/* Contact number display */}
      {!contactNum && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>
          ⚠️ Walang contact number si <strong>{caseClientName(client)}</strong>. I-update sa New Case page.
        </div>
      )}
      {contactNum && !showCompose && (
        <p style={{ fontSize: 11, color: "rgba(220,245,230,0.4)", marginBottom: 14 }}>📱 {contactNum}</p>
      )}

      {/* Compose Section */}
      {showCompose && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 16, border: "1px solid rgba(96,165,250,0.2)", background: "rgba(96,165,250,0.05)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#60a5fa", marginBottom: 10 }}>
            Pumili ng template o mag-custom:
          </p>
          {/* Template buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {templates.map(t => (
              <button key={t.id} onClick={() => setMsgText(generateTemplate(t.id))}
                style={{ fontSize: 11, padding: "6px 12px", borderRadius: 999, border: `1px solid ${t.color}44`, background: `${t.color}11`, color: t.color, fontFamily: "inherit", cursor: "pointer", fontWeight: 600 }}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Message editor */}
          <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={5}
            placeholder="I-type o i-edit ang mensahe..."
            style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          <p style={{ fontSize: 10, color: "rgba(220,245,230,0.3)", marginTop: 4, marginBottom: 10 }}>
            📱 Ipapadala sa: {contactNum || "—"} · {msgText.length} characters
          </p>
          {/* Status feedback */}
          {smsStatus && (
            <div style={{ marginBottom: 10, padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: smsStatus === "sent" ? "rgba(52,211,153,0.12)" : smsStatus === "sending" ? "rgba(96,165,250,0.12)" : "rgba(251,113,133,0.12)",
              color: smsStatus === "sent" ? "#34d399" : smsStatus === "sending" ? "#60a5fa" : "#fca5a5",
              border: smsStatus === "sent" ? "1px solid rgba(52,211,153,0.3)" : smsStatus === "sending" ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(251,113,133,0.3)" }}>
              {smsStatus === "sending" && "📤 Nagse-send..."}
              {smsStatus === "sent" && "✅ Na-send na ang SMS kay " + client + "!"}
              {smsStatus === "error" && (contactNum ? "❌ Error sa pagse-send. Check mo ang Semaphore credits." : "❌ Walang contact number.")}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSend} disabled={!msgText.trim() || smsStatus === "sending" || !contactNum}
              className="btn-primary" style={{ flex: 1, padding: "10px 0", fontSize: 13, opacity: (!msgText.trim() || !contactNum) ? 0.5 : 1 }}>
              {smsStatus === "sending" ? "📤 Nagse-send..." : "📲 Send SMS"}
            </button>
            <button onClick={() => { setShowCompose(false); setMsgText(""); setSmsStatus(""); }}
              className="btn-outline" style={{ padding: "10px 16px", fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SMS Log */}
      {smsLog.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(220,245,230,0.35)", marginBottom: 4 }}>
            📨 SMS History ({smsLog.length})
          </p>
          {smsLog.map(log => (
            <div key={log.id} style={{ borderRadius: 12, border: log.status === "Sent" ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(251,113,133,0.2)", background: log.status === "Sent" ? "rgba(52,211,153,0.04)" : "rgba(251,113,133,0.04)", padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: log.status === "Sent" ? "#34d399" : "#fb7185" }}>
                  {log.status === "Sent" ? "✅ Sent" : "❌ Failed"}
                </span>
                <span style={{ fontSize: 10, color: "rgba(220,245,230,0.35)" }}>{log.sentAt}</span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(220,245,230,0.7)", lineHeight: 1.6, marginBottom: 4 }}>{log.message}</p>
              <p style={{ fontSize: 10, color: "rgba(220,245,230,0.3)" }}>👤 {log.sentBy} · 📱 {log.contact}</p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "rgba(220,245,230,0.25)", textAlign: "center", padding: "16px 0" }}>
          Wala pang SMS na napadala kay {client}.
        </p>
      )}
    </Card>
  );
}

function DashboardPage({ client: clientProp, caseStore, setCaseStore, currentUser }) {
  // Palaging gumamit ng WASTONG client key. Kung blangko o wala ang napiling client,
  // pumili ng unang may-pangalang case — para hindi masave ang edits sa blangkong "" key.
  const client = (clientProp && caseStore[clientProp]) ? clientProp : (Object.keys(caseStore).find(k => k.trim()) || clientProp || "");
  const data = caseStore[client] || {};
  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "e.b.bernassurveying@gmail.com";

  if (!data.checklist) {
    return <Card><div style={{ textAlign: "center", padding: "48px 0", color: "rgba(220,245,230,0.3)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No client selected</p>
      <p style={{ fontSize: 13 }}>Go to Create New Case to register a client, or select one from Quick Select.</p>
    </div></Card>;
  }

  const toggle = async (idx) => {
    const updated = data.checklist.map((item, i) =>
      i === idx ? { ...item, status: item.status === "Completed" ? "Pending" : "Completed" } : item
    );
    const newData = { ...data, checklist: updated };
    setCaseStore((p) => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const addReq = async (name) => {
    if (!name.trim()) return;
    const newData = { ...data, checklist: [...(data.checklist || []), { name: name.trim(), status: "Pending" }] };
    setCaseStore((p) => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const removeReq = async (idx) => {
    const newData = { ...data, checklist: (data.checklist || []).filter((_, i) => i !== idx) };
    setCaseStore((p) => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const updateReqRemark = async (idx, remark) => {
    const updated = (data.checklist || []).map((item, i) => i === idx ? { ...item, remark } : item);
    const newData = { ...data, checklist: updated };
    setCaseStore((p) => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const setField = async (f, v, label) => {
    const now = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const logEntry = { field: label || f, value: v, updatedAt: now };
    const existingLog = data.updateLog || [];
    const newData = { ...data, [f]: v, updateLog: [logEntry, ...existingLog].slice(0, 20) };
    setCaseStore((p) => ({ ...p, [client]: newData }));
    await saveCase(client, newData);
  };

  const done = (data.checklist || []).filter((c) => c.status === "Completed").length;
  const pct = data.checklist?.length ? Math.round((done / data.checklist.length) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1.1fr 0.9fr" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div><p className="eyebrow">Client Case Dashboard</p><h3 className="section-title">{caseClientName(client)}{(data?.lotNo || parseCaseKey(client).lot) ? <span style={{ fontSize: 14, color: "#34d399", fontWeight: 700 }}> · 🏷️ Lot {data?.lotNo || parseCaseKey(client).lot}</span> : null}</h3></div>
            <Badge label={data.caseType} variant="badge-amber" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoBlock label="Lot Number" value={data.lotNo} />
            <InfoBlock label="Overall Status" value={data.overallStatus} />
            <div className="info-block" style={{ gridColumn: "1 / -1" }}>
              <p className="info-label">Property Location</p>
              <p className="info-value">{data.propertyLocation}</p>
            </div>
            {/* Trans ID — show prominently if available */}
            {(() => {
              const transStep = data.trackerSteps?.trans_id;
              const transId = transStep?.transId;
              return transId ? (
                <div className="info-block" style={{ gridColumn: "1 / -1", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 14, padding: "12px 14px" }}>
                  <p className="info-label" style={{ color: "#34d399" }}>🔢 Transaction ID</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#34d399", marginTop: 4, letterSpacing: "0.05em" }}>{transId}</p>
                  {transStep?.doneAt && <p style={{ fontSize: 10, color: "rgba(52,211,153,0.5)", marginTop: 3 }}>Natanggap: {transStep.doneAt}</p>}
                </div>
              ) : null;
            })()}
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

        {/* Survey Authority Requirements — only for Approval types */}
        {(data.surveyCategory === "approval" || (data.surveyCategory === "subdivision" && data.surveySubCategory === "Para sa Approval na") || (!data.surveyCategory && data.checklist?.length > 0)) && (
          <SurveyRequirementsCard data={data} client={client} toggle={toggle} addReq={addReq} removeReq={removeReq} updateReqRemark={updateReqRemark} />
        )}
        <ClientFilesCard client={client} data={data} setCaseStore={setCaseStore} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <ApprovalTrackerCard client={client} data={data} setCaseStore={setCaseStore} isAdmin={isAdmin} />
        <ClientSmsCard client={client} data={data} currentUser={currentUser} />

        {/* Update Log */}
        {(data.updateLog || []).length > 0 && (
          <Card>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Activity</p>
            <h3 className="section-title" style={{ marginBottom: 12 }}>📋 Update Log</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(data.updateLog || []).slice(0, 10).map((log, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.1)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{log.field}</p>
                    <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)", marginTop: 1 }}>→ {log.value || "—"}</p>
                  </div>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.35)" }}>{log.updatedAt}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card>
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
// Map surveyType → caseType for auto-case creation

function SchedulePage({ schedules, setSchedules, caseStore, setCaseStore, setActiveMenu, setSelectedClient, globalEmployees = [] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "", assignedEmployees: [] });
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalSchedule, setCreateModalSchedule] = useState(null);
  const [modalStep, setModalStep] = useState(1);
  const [pickedType, setPickedType] = useState(null);
  const [pickedSub, setPickedSub] = useState(null);
  const employees = globalEmployees;
  const [smsStatus, setSmsStatus] = useState("");
  // ── Survey Done Finance Modal ──
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeModalSched, setFinanceModalSched] = useState(null);
  const [financeForm, setFinanceForm] = useState({ amountCharged: "", hasAgent: false, agentName: "", expenses: [{ category: "Fuel", description: "", amount: "" }] });
  const [financeSaving, setFinanceSaving] = useState(false);

  const types = ["Survey", "Appointment", "Deadline", "Follow-up", "Other"];
  const typeColor = (t) => ({ Survey: "#34d399", Appointment: "#60a5fa", Deadline: "#fb7185", "Follow-up": "#fbbf24", Other: "#a78bfa" }[t] || "#a78bfa");
  const typeIcon = (t) => ({ Survey: "📐", Appointment: "🤝", Deadline: "⚠️", "Follow-up": "📞", Other: "📌" }[t] || "📌");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const openAddForDate = (dayStr) => {
    setForm(p => ({ ...p, date: dayStr }));
    setEditingId(null);
    setShowAdd(true);
    setSelectedSchedule(null);
  };

  const openEdit = (s) => {
    setForm({ title: s.title, client: s.client, type: s.type, date: s.date, time: s.time, location: s.location, contact: s.contact || "", remarks: s.remarks, surveyType: s.surveyType || "", lotNo: s.lotNo || "", assignedEmployees: s.assignedEmployees || [] });
    setEditingId(s.id);
    setShowAdd(true);
    setSelectedSchedule(null);
  };

  const saveScheduleEntry = async () => {
    if ((!form.title.trim() && !form.lotNo.trim()) || !form.date) return;
    const assigned = form.assignedEmployees || [];
    if (editingId) {
      await setSchedules(p => p.map(s => s.id === editingId ? { ...s, ...form } : s));
      setEditingId(null);
    } else {
      await setSchedules(p => [...p, { ...form, id: Date.now(), done: false }]);
    }
    // Send SMS + Telegram to assigned employees
    if (assigned.length > 0) {
      setSmsStatus("sending");
      const toNotify = employees.filter(e => assigned.includes(e.email || e.id));
      let allOk = true;
      for (const emp of toNotify) {
        const num = emp.mobile || emp.contact_number || "";
        const empName = emp.name || emp.displayName || "Employee";
        const msg = buildScheduleSMS(form, empName);
        // Send SMS
        if (num) {
          const result = await sendSMS(num, msg);
          if (result?.error) allOk = false;
        }
        // Send Telegram to employee
        if (emp.telegramChatId) {
          const lotInfo = form.lotNo ? ` — Lot ${form.lotNo}` : "";
          const dateInfo = form.date ? ` sa ${new Date(form.date+"T00:00:00").toLocaleDateString("en-PH", {month:"long",day:"numeric",year:"numeric"})}` : "";
          const tgMsg = `📅 <b>Bagong Schedule</b>\nKumusta ${empName}!\n\nMay survey schedule ka${dateInfo}${lotInfo}${form.location ? `\n📍 ${form.location}` : ""}${form.client ? `\n👤 Client: ${form.client}` : ""}\n\nPara sa katanungan: 09176525851`;
          try {
            await fetch("/api/send-telegram-user", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ chatId: emp.telegramChatId, message: tgMsg }) });
          } catch {}
        }
      }
      setSmsStatus(allOk && toNotify.length > 0 ? "sent" : toNotify.length === 0 ? "no_number" : "error");
      setTimeout(() => setSmsStatus(""), 4000);
    }
    setForm({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "", assignedEmployees: [] });
    setShowAdd(false);
    // Telegram notification
    if (!editingId) {
      const lotInfo = form.lotNo ? ` | Lot ${form.lotNo}` : "";
      const clientInfo = form.client ? ` | Client: ${form.client}` : "";
      const dateInfo = form.date ? ` | Date: ${form.date}` : "";
      sendTelegram(`📅 <b>New Schedule Added</b>\nType: ${form.type}${form.surveyType ? " — " + form.surveyType : ""}${lotInfo}${clientInfo}${dateInfo}${form.location ? "\nLocation: " + form.location : ""}`);
    }
  };

  const toggleDone = async (id) => {
    const sched = schedules.find(s => s.id === id);
    const nowDone = !sched?.done;

    // If marking as DONE and it's a Survey — show finance modal first
    if (nowDone && sched?.type === "Survey") {
      setFinanceModalSched(sched);
      setFinanceForm({ amountCharged: "", hasAgent: false, agentName: "", expenses: [{ category: "Fuel", description: "", amount: "" }] });
      setShowFinanceModal(true);
      return;
    }

    // Otherwise toggle normally
    await doToggleDone(id, sched, nowDone);
  };

  const doToggleDone = async (id, sched, nowDone) => {
    setSchedules(p => p.map(s => s.id === id ? { ...s, done: nowDone } : s));
    if (selectedSchedule?.id === id) setSelectedSchedule(p => ({ ...p, done: nowDone }));
    // Telegram notification
    if (nowDone && sched) {
      const lotInfo = sched.lotNo ? ` | Lot ${sched.lotNo}` : "";
      const clientInfo = sched.client ? ` | Client: ${sched.client}` : "";
      sendTelegram(`✅ <b>Schedule Marked as Done</b>\n${sched.title || sched.surveyType || sched.type}${lotInfo}${clientInfo}${sched.date ? "\nDate: " + sched.date : ""}`);
    }

    // Auto-create case immediately when marked done
    if (nowDone && sched?.client && sched.client.trim()) {
      const autoKey = makeCaseKey(sched.client, sched.lotNo);
      // Only create if no existing case yet
      if (!caseStore[autoKey]) {
        const autoCase = {
          caseType: "Relocation Plan – Titled Property", // default, updated after modal
          surveyCategory: "",
          surveySubCategory: "",
          lotNo: sched.lotNo || "",
          propertyLocation: sched.location || "",
          contact: sched.contact || "",
          email: "",
          ref: "",
          overallStatus: "Survey Done",
          progress: 0,
          remarks: sched.remarks || "",
          currentLocation: "Survey Completed",
          dateOfSurvey: sched.date || "",
          dateOfSubmittal: "",
          missingItems: [],
          trackerSteps: {
            survey_done: { done: true, doneAt: (sched.date ? fmtDate(sched.date) : new Date().toLocaleDateString("en-PH")) },
          },
          checklist: [
            { name: "Client Information Form", status: "Pending" },
            { name: "Property Documents", status: "Pending" },
            { name: "Valid IDs", status: "Pending" },
            { name: "Tax Declaration", status: "Pending" },
          ],
          folders: serviceFolderTemplates["Relocation Plan – Titled Property"] || [],
          dateCreated: new Date().toLocaleDateString("en-PH"),
        };
        await setCaseStore(p => ({ ...p, [autoKey]: autoCase }));
      }
      // Show modal to pick survey type (updates tracker)
      setCreateModalSchedule(sched);
      setModalStep(1);
      setPickedType(null);
      setPickedSub(null);
      setShowCreateModal(true);
    }
  };
  const deleteSchedule = (id) => {
    setSchedules(p => p.filter(s => s.id !== id));
    if (selectedSchedule?.id === id) setSelectedSchedule(null);
  };

  const handleFinanceModalSave = async () => {
    if (!financeModalSched) return;
    setFinanceSaving(true);
    const sched = financeModalSched;
    const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const charged = Number(financeForm.amountCharged || 0);
    const agentFee = financeForm.hasAgent && charged > 0 ? Math.round(charged * 0.20 * 100) / 100 : 0;
    // Save income
    if (charged > 0) {
      const incId = `INC-${Date.now()}`;
      await setDoc(doc(db, "fin_income", incId), {
        id: incId, scheduleId: String(sched.id), client: sched.client || "",
        description: `${sched.surveyType || "Survey"} - Lot ${sched.lotNo || "—"} - ${sched.client || ""}`,
        amount: charged, date: sched.date || todayDate, createdAt: new Date().toISOString()
      });
    }
    // Save agent fee as expense
    if (agentFee > 0) {
      const agentExpId = `EXP-AGENT-${Date.now()}`;
      await setDoc(doc(db, "fin_expenses", agentExpId), {
        id: agentExpId, category: "Agent Fee",
        description: `Agent: ${financeForm.agentName || "—"} (20% of ₱${charged.toLocaleString()})`,
        amount: agentFee, date: sched.date || todayDate,
        addedBy: "System", scheduleId: String(sched.id), createdAt: new Date().toISOString()
      });
    }
    // Save other expenses
    for (const exp of financeForm.expenses) {
      if (exp.amount && Number(exp.amount) > 0) {
        const expId = `EXP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        await setDoc(doc(db, "fin_expenses", expId), {
          id: expId, category: exp.category, description: exp.description || `Survey - ${sched.client || ""}`,
          amount: Number(exp.amount), date: sched.date || todayDate,
          addedBy: "Survey Team", scheduleId: String(sched.id), createdAt: new Date().toISOString()
        });
      }
    }
    // Now actually mark as done
    await doToggleDone(sched.id, sched, true);
    setShowFinanceModal(false);
    setFinanceModalSched(null);
    setFinanceSaving(false);
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

  // Survey type choices for modal
  const SURVEY_TYPES = [
    { id: "relocation",    label: "📐 Relocation",          sub: null },
    { id: "segregation",   label: "📋 Segregation",         sub: null },
    { id: "subdivision",   label: "🗂 Subdivision",         sub: ["Hindi pa Approval", "Para sa Approval na"] },
    { id: "approval",      label: "✅ Approval",            sub: ["Titled Property", "Tax Declaration Land"] },
    { id: "verification",  label: "🔍 Verification Survey", sub: null },
    { id: "topographic",   label: "🏔 Topographic Survey",  sub: null },
  ];

  const resolveCaseType = (type, sub) => {
    if (type === "relocation")   return "Relocation Plan – Titled Property";
    if (type === "segregation")  return "Segregation";
    if (type === "verification") return "Relocation Plan – Titled Property";
    if (type === "topographic")  return "Relocation Plan – Titled Property";
    if (type === "subdivision") {
      if (sub === "Para sa Approval na") return "Subdivision – Titled Property";
      return "Subdivision – Titled Property"; // hindi pa approval = same folders, status lang different
    }
    if (type === "approval") {
      if (sub === "Tax Declaration Land") return "Subdivision – Tax Declaration Only";
      return "Subdivision – Titled Property";
    }
    return "Relocation Plan – Titled Property";
  };

  const resolveOverallStatus = (type, sub) => {
    if (type === "approval") return "For Approval";
    if (type === "subdivision" && sub === "Para sa Approval na") return "For Approval";
    if (type === "subdivision") return "Survey Done – Pre-Approval";
    if (type === "relocation") return "Plan Done";
    if (type === "segregation") return "Survey Done";
    if (type === "verification") return "Survey Done";
    if (type === "topographic") return "Survey Done";
    return "New Case";
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setCreateModalSchedule(null);
    setModalStep(1);
    setPickedType(null);
    setPickedSub(null);
  };

  const handleCreateCaseFromSchedule = async (type, sub) => {
    const s = createModalSchedule;
    if (!s?.client) return;
    const caseType = resolveCaseType(type, sub);
    const folders = serviceFolderTemplates[caseType] || [];
    const newCase = {
      caseType,
      surveyCategory: type,
      surveySubCategory: sub || "",
      lotNo: s.lotNo || "",
      propertyLocation: s.location || "",
      contact: s.contact || "",
      email: "",
      ref: "",
      overallStatus: resolveOverallStatus(type, sub),
      progress: 0,
      remarks: s.remarks || "",
      currentLocation: type === "approval" ? "For Approval Processing" : "Survey Completed",
      dateOfSurvey: s.date || "",
      dateOfSubmittal: "",
      missingItems: [],
      trackerSteps: {
        // Na-mark as done ang schedule = tapos na ang field survey
        survey_done: { done: true, doneAt: (s.date ? fmtDate(s.date) : new Date().toLocaleDateString("en-PH")) },
      },
      checklist: [
        { name: "Client Information Form", status: "Pending" },
        { name: "Property Documents", status: "Pending" },
        { name: "Valid IDs", status: "Pending" },
        { name: "Tax Declaration", status: "Pending" },
      ],
      folders,
      dateCreated: new Date().toLocaleDateString("en-PH"),
    };
    const caseKey = makeCaseKey(s.client, s.lotNo);
    await setCaseStore(p => ({ ...p, [caseKey]: newCase }));
    try { await saveCase(caseKey, newCase); } catch (e) { console.error("saveCase failed:", e); }
    closeModal();
    setSelectedClient(caseKey);
    setActiveMenu("dashboard");
  };

  return (
    <div style={{ display: "flex", gap: 20 }}>

      {/* ── CREATE CASE MODAL ── */}
      {showCreateModal && createModalSchedule && (() => {
        const s = createModalSchedule;
        const hasCase = !!caseStore[makeCaseKey(s.client, s.lotNo)];
        const selectedTypeObj = SURVEY_TYPES.find(t => t.id === pickedType);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#0f2318", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 28, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#34d399", marginBottom: 6 }}>✅ Survey Done — Case Created!</p>
                  <h3 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>
                    {modalStep === 1 && "Anong uri ng survey?"}
                    {modalStep === 2 && selectedTypeObj?.label}
                    {modalStep === 3 && "Confirm — I-update ang Tracker"}
                  </h3>
                  <p style={{ fontSize: 12, color: "rgba(220,245,230,0.45)", marginTop: 4 }}>👤 {s.client}{s.lotNo && " · 🏷️ " + s.lotNo}</p>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(220,245,230,0.35)", fontSize: 20, padding: "0 0 0 12px" }}>✕</button>
              </div>

              {/* ── STEP 1: Pick survey type ── */}
              {modalStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {hasCase && (
                    <div style={{ marginBottom: 8, borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", padding: "10px 14px", fontSize: 12, color: "#fcd34d" }}>
                      ⚠️ May existing case na si {s.client}. Ma-a-update ang status niya.
                    </div>
                  )}
                  {SURVEY_TYPES.map(t => (
                    <button key={t.id} onClick={() => {
                      setPickedType(t.id);
                      if (t.sub) { setModalStep(2); }
                      else { setPickedSub(null); setModalStep(3); }
                    }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)", color: "#e8f5ee",
                      fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s", textAlign: "left",
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(52,211,153,0.08)"; e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                      <span>{t.label}</span>
                      <span style={{ fontSize: 12, color: "rgba(220,245,230,0.35)" }}>{t.sub ? "›" : "Direct"}</span>
                    </button>
                  ))}
                  <button onClick={closeModal} className="btn-outline" style={{ marginTop: 4, padding: "10px 0", fontSize: 12 }}>Skip — Wag muna</button>
                </div>
              )}

              {/* ── STEP 2: Pick sub-choice ── */}
              {modalStep === 2 && selectedTypeObj?.sub && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 13, color: "rgba(220,245,230,0.5)", marginBottom: 4 }}>
                    {pickedType === "subdivision" ? "Anong status ng Subdivision?" : "Anong klase ng lupa?"}
                  </p>
                  {selectedTypeObj.sub.map(sub => (
                    <button key={sub} onClick={() => { setPickedSub(sub); setModalStep(3); }}
                      style={{
                        padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.03)", color: "#e8f5ee",
                        fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.15s", textAlign: "left",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "rgba(52,211,153,0.1)"; e.currentTarget.style.borderColor = "rgba(52,211,153,0.35)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                      {pickedType === "subdivision"
                        ? (sub === "Hindi pa Approval" ? "🗂 " + sub + " — i-track muna ang survey docs" : "✅ " + sub + " — simulan na ang approval tracking")
                        : (sub === "Titled Property" ? "📜 " + sub + " — may OCT/TCT" : "📋 " + sub + " — Tax Dec basis")}
                    </button>
                  ))}
                  <button onClick={() => { setModalStep(1); setPickedType(null); }} className="btn-outline" style={{ padding: "10px 0", fontSize: 12 }}>‹ Back</button>
                </div>
              )}

              {/* ── STEP 3: Confirm ── */}
              {modalStep === 3 && pickedType && (
                <div>
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["👤 Client", s.client],
                      ["📐 Survey", SURVEY_TYPES.find(t=>t.id===pickedType)?.label + (pickedSub ? " — " + pickedSub : "")],
                      ["📋 Case Type", resolveCaseType(pickedType, pickedSub)],
                      ["📊 Status", resolveOverallStatus(pickedType, pickedSub)],
                      ["🏷️ Lot No.", s.lotNo || "—"],
                      ["📅 Date of Survey", fmtDate(s.date)],
                      ["📍 Location", s.location || "—"],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <span style={{ color: "rgba(220,245,230,0.4)", minWidth: 130 }}>{lbl}</span>
                        <span style={{ fontWeight: 600 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleCreateCaseFromSchedule(pickedType, pickedSub)} className="btn-primary" style={{ flex: 1, padding: "13px 0", fontSize: 13 }}>
                      ✓ {hasCase ? "I-update ang Case & Tracker" : "I-update ang Case & Tracker"}
                    </button>
                    <button onClick={() => setModalStep(selectedTypeObj?.sub ? 2 : 1)} className="btn-outline" style={{ padding: "13px 16px", fontSize: 12 }}>‹ Back</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

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
            <button onClick={() => { setShowAdd(false); setEditingId(null); setForm({ title: "", client: "", type: "Survey", surveyType: "", lotNo: "", date: "", time: "", location: "", contact: "", remarks: "", assignedEmployees: [] }); }} className="btn-outline" style={{ fontSize: 12 }}>✕ Cancel</button>
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

          {/* ── ASSIGN EMPLOYEES + SMS ── */}
          {employees.filter(e => e.approved).length > 0 && (
            <div style={{ marginTop: 14, padding: "14px", borderRadius: 14, border: "1px solid rgba(96,165,250,0.25)", background: "rgba(96,165,250,0.05)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#60a5fa", marginBottom: 10 }}>📲 Assign Employees — Mag-send ng SMS notification</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {employees.filter(e => e.approved).map(emp => {
                  const empId = emp.email || emp.id;
                  const isChecked = (form.assignedEmployees || []).includes(empId);
                  const hasMobile = !!(emp.mobile || emp.contact_number);
                  return (
                    <label key={empId} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 10, background: isChecked ? "rgba(96,165,250,0.12)" : "rgba(0,0,0,0.1)", border: isChecked ? "1px solid rgba(96,165,250,0.35)" : "1px solid transparent", transition: "all 0.15s" }}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => {
                          setForm(p => ({
                            ...p,
                            assignedEmployees: isChecked
                              ? p.assignedEmployees.filter(id => id !== empId)
                              : [...(p.assignedEmployees || []), empId]
                          }));
                        }}
                        style={{ accentColor: "#60a5fa", width: 14, height: 14 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 700 }}>{emp.name || emp.displayName}</p>
                        <p style={{ fontSize: 10, color: hasMobile ? "rgba(220,245,230,0.5)" : "#fb7185", marginTop: 1 }}>
                          {hasMobile ? `📱 ${emp.mobile || emp.contact_number}` : "⚠️ Walang contact number — hindi masend ang SMS"}
                        </p>
                      </div>
                      {isChecked && hasMobile && <span style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700 }}>SMS ✓</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* SMS Status */}
          {smsStatus && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: smsStatus === "sent" ? "rgba(52,211,153,0.12)" : smsStatus === "sending" ? "rgba(96,165,250,0.12)" : "rgba(251,113,133,0.12)",
              border: smsStatus === "sent" ? "1px solid rgba(52,211,153,0.3)" : smsStatus === "sending" ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(251,113,133,0.3)",
              color: smsStatus === "sent" ? "#34d399" : smsStatus === "sending" ? "#60a5fa" : "#fca5a5" }}>
              {smsStatus === "sending" && "📤 Nagse-send ng SMS..."}
              {smsStatus === "sent" && "✅ Na-send na ang SMS sa assigned employees!"}
              {smsStatus === "no_number" && "⚠️ Walang contact number ang assigned employees."}
              {smsStatus === "error" && "❌ May error sa pag-send ng SMS. Check mo ang Semaphore credits."}
            </div>
          )}

          <button onClick={saveScheduleEntry} className="btn-primary" style={{ width: "100%", padding: "11px 0", marginTop: 14 }}>
            {editingId ? "✓ Save Changes" : `✓ Add to Schedule${(form.assignedEmployees||[]).length > 0 ? ` & Send SMS (${(form.assignedEmployees||[]).length})` : ""}`}
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

              {/* Assigned Employees in side panel */}
              {selectedSchedule.assignedEmployees?.length > 0 && (
                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 6 }}>Assigned Employees</p>
                  {employees.filter(e => selectedSchedule.assignedEmployees.includes(e.email || e.id)).map(emp => (
                    <p key={emp.email || emp.id} style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                      👷 {emp.name || emp.displayName} {emp.mobile ? <span style={{ fontSize: 10, color: "rgba(220,245,230,0.45)" }}>· {emp.mobile}</span> : null}
                    </p>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <button onClick={() => openEdit(selectedSchedule)} className="btn-outline" style={{ width: "100%", padding: "9px 0", fontSize: 12 }}>
                  ✏️ Edit
                </button>
                <button onClick={() => toggleDone(selectedSchedule.id)} className="btn-primary" style={{ width: "100%", padding: "10px 0", fontSize: 12 }}>
                  {selectedSchedule.done ? "↩ Mark as Pending" : "✓ Mark as Done"}
                </button>
                {/* Manual Resend SMS */}
                {selectedSchedule.assignedEmployees?.length > 0 && (
                  <button onClick={async () => {
                    setSmsStatus("sending");
                    const toNotify = employees.filter(e => selectedSchedule.assignedEmployees.includes(e.email || e.id) && (e.mobile || e.contact_number));
                    let allOk = true;
                    for (const emp of toNotify) {
                      const num = emp.mobile || emp.contact_number || "";
                      if (num) {
                        const msg = buildScheduleSMS(selectedSchedule, emp.name || emp.displayName || "Employee");
                        const result = await sendSMS(num, msg);
                        if (result?.error) allOk = false;
                      }
                    }
                    setSmsStatus(allOk && toNotify.length > 0 ? "sent" : toNotify.length === 0 ? "no_number" : "error");
                    setTimeout(() => setSmsStatus(""), 4000);
                  }} style={{ width: "100%", padding: "9px 0", fontSize: 12, borderRadius: 12, border: "1.5px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.1)", color: "#60a5fa", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
                    {smsStatus === "sending" ? "📤 Nagse-send..." : "📲 Resend SMS"}
                  </button>
                )}
                {/* Smart navigation — show after marked done */}
                {selectedSchedule.done && selectedSchedule.client && (
                  caseStore[makeCaseKey(selectedSchedule.client, selectedSchedule.lotNo)] ? (
                    <button onClick={() => {
                      setSelectedClient(makeCaseKey(selectedSchedule.client, selectedSchedule.lotNo));
                      setActiveMenu("dashboard");
                    }} style={{ width: "100%", padding: "10px 0", fontSize: 12, borderRadius: 12, border: "1.5px solid rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.1)", color: "#34d399", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
                      📂 View Case — {selectedSchedule.client}
                    </button>
                  ) : (
                    <button onClick={() => {
                      setCreateModalSchedule(selectedSchedule);
                      setModalStep(1);
                      setPickedType(null);
                      setPickedSub(null);
                      setShowCreateModal(true);
                    }} style={{ width: "100%", padding: "10px 0", fontSize: 12, borderRadius: 12, border: "1.5px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}>
                      ➕ Create Case para kay {selectedSchedule.client}
                    </button>
                  )
                )}
                <button onClick={() => deleteSchedule(selectedSchedule.id)} className="btn-danger" style={{ width: "100%", padding: "8px 0", fontSize: 12 }}>
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SURVEY DONE FINANCE MODAL ── */}
      {showFinanceModal && financeModalSched && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0f2318", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 24, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#34d399", marginBottom: 8 }}>✅ Survey Done!</p>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>I-record ang Gastos at Kita</h3>
            <p style={{ fontSize: 12, color: "rgba(220,245,230,0.5)", marginBottom: 20, lineHeight: 1.6 }}>
              {financeModalSched.surveyType || "Survey"} — Lot {financeModalSched.lotNo || "—"} — {financeModalSched.client || "—"}
            </p>

            {/* Amount Charged */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>💰 Magkano ang siningil sa client?</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>₱</span>
                <input type="number" value={financeForm.amountCharged}
                  onChange={e => setFinanceForm(p => ({ ...p, amountCharged: e.target.value }))}
                  placeholder="0.00" autoFocus
                  style={{ flex: 1, background: "rgba(52,211,153,0.08)", border: "1.5px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px 16px", fontSize: 18, fontWeight: 800, color: "#34d399", fontFamily: "inherit", outline: "none" }} />
              </div>
            </div>

            {/* Agent Fee */}
            <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: financeForm.hasAgent ? 12 : 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.1em", textTransform: "uppercase" }}>👤 May Agent?</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["Wala", false], ["Meron", true]].map(([label, val]) => (
                    <button key={label} onClick={() => setFinanceForm(p => ({ ...p, hasAgent: val }))}
                      style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                        background: financeForm.hasAgent === val ? "#fbbf24" : "rgba(255,255,255,0.07)",
                        color: financeForm.hasAgent === val ? "#0a1a13" : "rgba(220,245,230,0.5)" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {financeForm.hasAgent && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={financeForm.agentName} onChange={e => setFinanceForm(p => ({ ...p, agentName: e.target.value }))}
                    placeholder="Pangalan ng agent..."
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                  {financeForm.amountCharged && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "rgba(220,245,230,0.5)" }}>Agent Fee (20%):</span>
                      <span style={{ color: "#fbbf24", fontWeight: 800 }}>
                        ₱{(Math.round(Number(financeForm.amountCharged || 0) * 0.20 * 100) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Expenses */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fb7185", letterSpacing: "0.1em", textTransform: "uppercase" }}>🧾 Mga Gastos sa Survey na ito</p>
                <button onClick={() => setFinanceForm(p => ({ ...p, expenses: [...p.expenses, { category: "Fuel", description: "", amount: "" }] }))}
                  style={{ fontSize: 11, background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 8, padding: "4px 10px", color: "#fb7185", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  + Add
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {financeForm.expenses.map((exp, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <select value={exp.category} onChange={e => setFinanceForm(p => ({ ...p, expenses: p.expenses.map((ex, j) => j === i ? { ...ex, category: e.target.value } : ex) }))}
                      style={{ background: "#0f2318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 8px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }}>
                      {["Fuel", "Merienda / Meals", "Transportation", "Materials", "Others"].map(c => <option key={c} style={{ background: "#0f2318" }}>{c}</option>)}
                    </select>
                    <input value={exp.description} onChange={e => setFinanceForm(p => ({ ...p, expenses: p.expenses.map((ex, j) => j === i ? { ...ex, description: e.target.value } : ex) }))}
                      placeholder="Description (optional)"
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#fb7185" }}>₱</span>
                      <input type="number" value={exp.amount} onChange={e => setFinanceForm(p => ({ ...p, expenses: p.expenses.map((ex, j) => j === i ? { ...ex, amount: e.target.value } : ex) }))}
                        placeholder="0"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%" }} />
                    </div>
                    {financeForm.expenses.length > 1 && (
                      <button onClick={() => setFinanceForm(p => ({ ...p, expenses: p.expenses.filter((_, j) => j !== i) }))}
                        style={{ background: "none", border: "none", color: "rgba(251,113,133,0.5)", fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Net preview */}
            {financeForm.amountCharged && (() => {
              const charged = Number(financeForm.amountCharged || 0);
              const agentFee = financeForm.hasAgent ? Math.round(charged * 0.20 * 100) / 100 : 0;
              const otherExp = financeForm.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
              const totalExp = agentFee + otherExp;
              const net = charged - totalExp;
              return (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: net >= 0 ? "rgba(52,211,153,0.08)" : "rgba(251,113,133,0.08)", border: `1px solid ${net >= 0 ? "rgba(52,211,153,0.2)" : "rgba(251,113,133,0.2)"}`, marginBottom: 20 }}>
                  {[
                    { label: "Income", val: charged, color: "#34d399" },
                    ...(agentFee > 0 ? [{ label: `Agent Fee (20%) — ${financeForm.agentName || "—"}`, val: -agentFee, color: "#fbbf24" }] : []),
                    ...(otherExp > 0 ? [{ label: "Expenses", val: -otherExp, color: "#fb7185" }] : []),
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: "rgba(220,245,230,0.5)" }}>{r.label}:</span>
                      <span style={{ color: r.color, fontWeight: 700 }}>{r.val < 0 ? "-" : ""}₱{Math.abs(r.val).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 4 }}>
                    <span>Net Income:</span>
                    <span style={{ color: net >= 0 ? "#34d399" : "#fb7185" }}>₱{net.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleFinanceModalSave} disabled={financeSaving}
                style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "none", background: financeSaving ? "rgba(255,255,255,0.5)" : "#34d399", color: "#0a1a13", fontSize: 14, fontWeight: 800, cursor: financeSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {financeSaving ? "Saving..." : "✓ I-save at Mark as Done"}
              </button>
              <button onClick={async () => { setShowFinanceModal(false); await doToggleDone(financeModalSched.id, financeModalSched, true); }}
                style={{ padding: "13px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(220,245,230,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Skip
              </button>
            </div>
            <p style={{ fontSize: 10, color: "rgba(220,245,230,0.3)", textAlign: "center", marginTop: 8 }}>I-click ang "Skip" kung ayaw mag-record ng financial data ngayon.</p>
          </div>
        </div>
      )}
    </div>
  );
}
function ChecklistPage({ client: clientProp, caseStore, setCaseStore, isAdmin }) {
  const client = (clientProp && caseStore[clientProp]) ? clientProp : (Object.keys(caseStore).find(k => k.trim()) || clientProp || "");
  const data = caseStore[client] || {};
  const [newItem, setNewItem] = useState("");

  if (!data.checklist) {
    return <Card><div style={{ textAlign: "center", padding: "48px 0", color: "rgba(220,245,230,0.3)" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No client selected</p>
      <p style={{ fontSize: 13 }}>Create a client first, then select from Quick Select to manage their checklist.</p>
    </div></Card>;
  }

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
function MessagingPage({ globalEmployees = [] }) {
  const [messages, setMessages] = useState(INIT_MESSAGES);
  const [recipientType, setRecipientType] = useState("employee"); // "employee" | "client"
  const employees = globalEmployees; // use global merged employees
  const [form, setForm] = useState({ recipients: [], subject: "", body: "" });
  const [smsStatus, setSmsStatus] = useState(""); // "" | "sending" | "sent" | "error" | "no_number"
  const [clientSearch, setClientSearch] = useState("");

  const approvedEmps = employees.filter(e => e.approved);

  const toggleRecipient = (id) => {
    setForm(p => ({
      ...p,
      recipients: p.recipients.includes(id)
        ? p.recipients.filter(r => r !== id)
        : [...p.recipients, id]
    }));
  };

  const selectAll = () => {
    const allIds = approvedEmps.map(e => e.email || e.id);
    setForm(p => ({ ...p, recipients: allIds }));
  };

  const handleSend = async () => {
    if (!form.body.trim() || form.recipients.length === 0) return;

    setSmsStatus("sending");
    const toSend = approvedEmps.filter(e => form.recipients.includes(e.email || e.id));
    let successCount = 0;
    let errorCount = 0;

    for (const emp of toSend) {
      const num = emp.mobile || emp.contact_number || "";
      if (!num) continue;
      const msgText = form.subject.trim()
        ? `[E.B. Bernas] ${form.subject}: ${form.body}`
        : `[E.B. Bernas] ${form.body}`;
      const result = await sendSMS(num, msgText);
      if (result?.error) errorCount++;
      else successCount++;
    }

    // Log to message history
    const recipientNames = toSend.map(e => e.name || e.displayName || e.email).join(", ");
    setMessages(p => [{
      id: Date.now(),
      to: recipientNames || "—",
      channel: "SMS",
      subject: form.subject || "Message",
      body: form.body,
      status: errorCount === 0 ? "Sent" : successCount > 0 ? "Partial" : "Ready to Send",
      date: todayStr(),
    }, ...p]);

    setSmsStatus(errorCount === 0 && successCount > 0 ? "sent" : successCount === 0 && toSend.length === 0 ? "no_number" : "error");
    setTimeout(() => setSmsStatus(""), 5000);
    setForm({ recipients: [], subject: "", body: "" });
    setClientSearch("");
  };

  const inputSt = { background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 22 }}>
      {/* ── LEFT: Message Log ── */}
      <Card>
        <SectionHeader eyebrow="Message Log" title="📨 Sent Messages" />
        {messages.length === 0 ? (
          <p style={{ textAlign: "center", padding: "28px 0", color: "rgba(220,245,230,0.3)", fontSize: 13 }}>Wala pang sent messages.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{m.subject}</p>
                  <Badge label={m.status} variant={statusBadge(m.status)} />
                </div>
                <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginBottom: m.body ? 6 : 0 }}>📲 {m.to} · {m.channel} · {m.date}</p>
                {m.body && <p style={{ fontSize: 12, color: "rgba(220,245,230,0.55)", lineHeight: 1.6 }}>{m.body}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── RIGHT: Compose ── */}
      <div style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(135deg, rgba(96,165,250,0.07), rgba(255,255,255,0.02))", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "#60a5fa" }}>SMS Messaging</p>
          <h3 className="section-title" style={{ marginBottom: 4 }}>📲 Send SMS</h3>
          <p style={{ fontSize: 12, color: "rgba(220,245,230,0.45)" }}>Pumili ng recipients tapos i-type ang mensahe.</p>
        </div>

        {/* Recipient Type Toggle */}
        <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 3, gap: 3 }}>
          {[{ id: "employee", label: "👷 Employees" }, { id: "client", label: "👤 Clients" }].map(t => (
            <button key={t.id} onClick={() => { setRecipientType(t.id); setForm(p => ({ ...p, recipients: [] })); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: recipientType === t.id ? "#fff" : "transparent",
                color: recipientType === t.id ? "#0a1a13" : "rgba(220,245,230,0.5)",
                transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Recipients Picker */}
        <div style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: 14, background: "rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)" }}>
              {recipientType === "employee" ? "Piliin ang employees" : "Piliin ang clients"}
            </p>
            {recipientType === "employee" && approvedEmps.length > 0 && (
              <button onClick={selectAll} style={{ fontSize: 10, fontWeight: 700, background: "none", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, padding: "3px 10px", color: "#60a5fa", cursor: "pointer", fontFamily: "inherit" }}>
                Select All
              </button>
            )}
          </div>

          {recipientType === "employee" ? (
            approvedEmps.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "10px 0" }}>Walang approved employees.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {approvedEmps.map(emp => {
                  const id = emp.email || emp.id;
                  const isChecked = form.recipients.includes(id);
                  const hasMobile = !!(emp.mobile || emp.contact_number);
                  return (
                    <label key={id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 10,
                      background: isChecked ? "rgba(96,165,250,0.12)" : "rgba(0,0,0,0.1)",
                      border: isChecked ? "1px solid rgba(96,165,250,0.35)" : "1px solid transparent", transition: "all 0.15s" }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleRecipient(id)}
                        style={{ accentColor: "#60a5fa", width: 14, height: 14, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{emp.name || emp.displayName}</p>
                        <p style={{ fontSize: 10, color: hasMobile ? "rgba(220,245,230,0.45)" : "#fb7185", marginTop: 1 }}>
                          {hasMobile ? `📱 ${emp.mobile || emp.contact_number}` : "⚠️ Walang contact number"}
                        </p>
                      </div>
                      {isChecked && <span style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700 }}>✓</span>}
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            /* Client recipient — manual input for now */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, color: "rgba(220,245,230,0.4)" }}>I-type ang contact number ng client:</p>
              <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setForm(p => ({ ...p, recipients: e.target.value ? [e.target.value] : [] })); }}
                placeholder="09xxxxxxxxx" style={inputSt} />
            </div>
          )}
        </div>

        {/* Message fields */}
        <input value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
          placeholder="Subject (optional, e.g. Schedule Notice)" style={inputSt} />
        <textarea value={form.body} onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))}
          placeholder="I-type ang mensahe..." rows={4} style={{ ...inputSt, resize: "none" }} />

        {/* SMS Status */}
        {smsStatus && (
          <div style={{ padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: smsStatus === "sent" ? "rgba(52,211,153,0.12)" : smsStatus === "sending" ? "rgba(96,165,250,0.12)" : "rgba(251,113,133,0.12)",
            border: smsStatus === "sent" ? "1px solid rgba(52,211,153,0.3)" : smsStatus === "sending" ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(251,113,133,0.3)",
            color: smsStatus === "sent" ? "#34d399" : smsStatus === "sending" ? "#60a5fa" : "#fca5a5" }}>
            {smsStatus === "sending" && "📤 Nagse-send ng SMS..."}
            {smsStatus === "sent" && "✅ Na-send na ang SMS!"}
            {smsStatus === "no_number" && "⚠️ Walang contact number ang piniling recipients."}
            {smsStatus === "error" && "❌ May error. Check mo ang Semaphore credits."}
          </div>
        )}

        <button onClick={handleSend} disabled={form.recipients.length === 0 || !form.body.trim() || smsStatus === "sending"}
          className="btn-primary" style={{ width: "100%", padding: "12px 0", opacity: (form.recipients.length === 0 || !form.body.trim()) ? 0.5 : 1 }}>
          {smsStatus === "sending" ? "📤 Nagse-send..." : `📲 Send SMS${form.recipients.length > 0 ? ` (${form.recipients.length})` : ""}`}
        </button>
      </div>
    </div>
  );
}

// ── NEW CASE ───────────────────────────────────────────────────────────────────
function NewCasePage({ caseStore, setCaseStore, setActiveMenu, setSelectedClient, isAdmin, currentUser }) {
  const [service, setService] = useState("Subdivision – Titled Property");
  const [form, setForm] = useState({ client: "", ref: "", contact: "", email: "", location: "", lot: "", titleNo: "", dateOfSurvey: "", dateOfSubmittal: "", remarks: "" });
  const [justCreated, setJustCreated] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [clientFilter, setClientFilter] = useState("approval"); // "approval" | "field" | "all"

  const folders = serviceFolderTemplates[service] || [];

  const handleCreate = async () => {
    if (!form.client.trim()) return;
    // Save to Firebase caseStore
    const newCase = {
      caseType: service,
      lotNo: form.lot,
      titleNo: form.titleNo,
      propertyLocation: form.location,
      contact: form.contact,
      email: form.email,
      ref: form.ref,
      overallStatus: "New Case",
      progress: 0,
      remarks: form.remarks,
      currentLocation: "Newly registered",
      dateOfSurvey: form.dateOfSurvey,
      dateOfSubmittal: form.dateOfSubmittal,
      missingItems: [],
      checklist: [
        { name: "Client Information Form", status: "Pending" },
        { name: "Property Documents", status: "Pending" },
        { name: "Valid IDs", status: "Pending" },
        { name: "Tax Declaration", status: "Pending" },
      ],
      folders: folders,
      dateCreated: new Date().toLocaleDateString("en-PH"),
    };
    const caseKey = makeCaseKey(form.client, form.lot);
    if (caseStore[caseKey]) {
      const proceed = window.confirm(`May case na para kay "${caseKey}". Gusto mo bang i-overwrite? (Kung ibang lote, palitan ang Lot No.)`);
      if (!proceed) return;
    }
    await setCaseStore(p => ({ ...p, [caseKey]: newCase }));
    setJustCreated({ client: caseKey, service, folders });
    // Telegram notification
    sendTelegram(`📋 <b>New Case Created</b>\nClient: ${form.client}\nService: ${service}${form.lot ? "\nLot: " + form.lot : ""}${form.location ? "\nLocation: " + form.location : ""}${form.contact ? "\nContact: " + form.contact : ""}`);
    setForm({ client: "", ref: "", contact: "", email: "", location: "", lot: "", titleNo: "", dateOfSurvey: "", dateOfSubmittal: "", remarks: "" });
    setTimeout(() => setJustCreated(null), 5000);
  };

  const serviceGroups = [
    { label: "── Subdivision", options: ["Subdivision – Titled Property", "Subdivision – Tax Declaration Only"] },
    { label: "── Relocation Plan", options: ["Relocation Plan – Titled Property", "Relocation Plan – Not Titled (Tax Dec)"] },
    { label: "── Other Services", options: ["Segregation", "Titling"] },
  ];

  return (
    <>
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
              ✓ Case created for <strong>{justCreated.client}</strong> — {justCreated.service} — {justCreated.folders.length} folders auto-generated! Naka-save na sa database.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Client / Family Name *" className="form-input" />
            <input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Case Reference Number" className="form-input" />
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="📱 Contact Number" className="form-input" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="📧 Email (optional)" className="form-input" />
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Property Location" className="form-input" />
            <input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="Lot No." className="form-input" />
            <input value={form.titleNo} onChange={(e) => setForm({ ...form, titleNo: e.target.value })} placeholder="TCT / TD No. (optional)" className="form-input" />
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

      {/* Existing clients list */}
      <Card>
        {(() => {
          const allEntries = Object.entries(caseStore).filter(([name]) => name.trim());
          const approvalEntries = allEntries.filter(([, d]) => isApprovalCaseType(d));
          const fieldEntries = allEntries.filter(([, d]) => !isApprovalCaseType(d));
          const visibleEntries = clientFilter === "approval" ? approvalEntries : clientFilter === "field" ? fieldEntries : allEntries;

          const renderRow = ([name, data]) => {
            const lot = data.lotNo || parseCaseKey(name).lot;
            return (
            <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)", padding: "12px 16px", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{caseClientName(name)}{lot ? <span style={{ color: "#34d399", fontWeight: 600 }}> · 🏷️ Lot {lot}</span> : null}</p>
                <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 3 }}>
                  {data.caseType}{data.propertyLocation && " · 📍 " + data.propertyLocation}{data.contact && " · 📱 " + data.contact}
                </p>
              </div>
              <button onClick={() => { setSelectedClient(name); setActiveMenu("dashboard"); }} className="btn-outline" style={{ fontSize: 11, padding: "6px 12px" }}>View →</button>
              <button onClick={() => isAdmin ? setDeleteConfirm(name) : setPendingDelete(name)} className="btn-danger" style={{ fontSize: 11, padding: "6px 10px" }}>🗑</button>
            </div>
            );
          };

          // Folder grouping — isahin ang mga lote sa ilalim ng iisang pangalan
          const renderFolders = (entries) => {
            const groups = {};
            entries.forEach(([key, data]) => {
              const nm = caseClientName(key);
              if (!groups[nm]) groups[nm] = [];
              groups[nm].push([key, data]);
            });
            const names = Object.keys(groups).sort((a, b) => a.localeCompare(b));
            return names.map(nm => {
              const lots = groups[nm];
              if (lots.length === 1) return renderRow(lots[0]);
              return (
                <div key={nm} style={{ border: "1px solid rgba(52,211,153,0.2)", borderRadius: 14, background: "rgba(52,211,153,0.04)", padding: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "#34d399", padding: "2px 6px 8px" }}>📁 {nm} <span style={{ color: "rgba(220,245,230,0.4)", fontWeight: 600 }}>({lots.length} lots)</span></p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lots.map(renderRow)}</div>
                </div>
              );
            });
          };

          return (
            <>
              {/* Header + Filter Toggle */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="eyebrow">Registered Clients</p>
                  <h3 className="section-title">👥 All Clients ({allEntries.length})</h3>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "approval", label: "📋 For Approval", count: approvalEntries.length },
                    { id: "field",    label: "📐 Field Survey", count: fieldEntries.length },
                    { id: "all",      label: "All", count: allEntries.length },
                  ].map(f => (
                    <button key={f.id} onClick={() => setClientFilter(f.id)}
                      style={{ fontSize: 11, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all 0.15s",
                        background: clientFilter === f.id ? "#fff" : "rgba(255,255,255,0.07)",
                        color: clientFilter === f.id ? "#0a1a13" : "rgba(220,245,230,0.6)" }}>
                      {f.label} <span style={{ opacity: 0.6 }}>({f.count})</span>
                    </button>
                  ))}
                </div>
              </div>
              {allEntries.length === 0 ? (
                <p style={{ textAlign: "center", padding: "24px 0", color: "rgba(220,245,230,0.3)", fontSize: 13 }}>No clients yet.</p>
              ) : visibleEntries.length === 0 ? (
                <p style={{ textAlign: "center", padding: "24px 0", color: "rgba(220,245,230,0.3)", fontSize: 13 }}>
                  Wala pang {clientFilter === "approval" ? "approval" : "field survey"} clients.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{renderFolders(visibleEntries)}</div>
              )}
            </>
          );
        })()}
      </Card>
    </div>

    {/* ── ADMIN DELETE MODAL ── */}
    {deleteConfirm && (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#0f2318", border: "1px solid rgba(251,113,133,0.3)", borderRadius: 24, padding: 28, maxWidth: 400, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#fb7185", marginBottom: 8 }}>⚠️ Delete Client</p>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Sigurado ka ba?</h3>
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
            Ide-delete ang lahat ng data ni <strong style={{ color: "#e8f5ee" }}>{deleteConfirm}</strong>. <strong style={{ color: "#fb7185" }}>Hindi na mababalik.</strong>
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDeleteConfirm(null)} className="btn-outline" style={{ flex: 1, padding: "12px 0" }}>Cancel</button>
            <button onClick={async () => {
              const clientName = deleteConfirm;
              setDeleteConfirm(null);
              try {
                await deleteCase(clientName);
                sendTelegram(`🗑 <b>Case Deleted</b>\nClient: ${clientName}\nBy: ${currentUser?.displayName || "Admin"}`);
              } catch (e) {
                console.error("Delete failed:", e);
                alert("❌ Hindi na-delete: " + (e?.message || "error"));
              }
            }} className="btn-danger" style={{ flex: 1, padding: "12px 0", fontWeight: 700 }}>🗑 Delete</button>
          </div>
        </div>
      </div>
    )}

    {/* ── EMPLOYEE DELETE REQUEST MODAL ── */}
    {pendingDelete && (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#0f2318", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 24, padding: 28, maxWidth: 400, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#fbbf24", marginBottom: 8 }}>⚠️ Delete Request</p>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Mag-request ng deletion?</h3>
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
            Magpapadala ng notification kay <strong style={{ color: "#e8f5ee" }}>Engr. Bernas</strong> para i-approve ang deletion ni <strong style={{ color: "#fbbf24" }}>{pendingDelete}</strong>.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setPendingDelete(null)} className="btn-outline" style={{ flex: 1, padding: "12px 0" }}>Cancel</button>
            <button onClick={async () => {
              sendTelegram(`⚠️ <b>Delete Request — Needs Approval</b>\nEmployee: ${currentUser?.displayName || "Employee"}\nWants to delete: <b>${pendingDelete}</b>\n\nLogin to portal to confirm.`);
              setPendingDelete(null);
              alert("✅ Na-send na ang request kay Engr. Bernas.");
            }} style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "none", background: "#fbbf24", color: "#0a1a13", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              📲 Send Request
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}


function FormsPage({ caseStore }) {
  const LOGO_SRC = "data:image/png;base64,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";
  const clients = Object.keys(caseStore).filter(k => k.trim());
  const [selClient, setSelClient] = React.useState(clients[0] || "");
  const [formType, setFormType] = React.useState("survey-notice");
  const [fields, setFields] = React.useState({
    surveyDate: "", surveyTime: "9:00 AM", barangayCaptain: "", witnesses: ["", ""],
    tdNo: "", requestedBy: "",
    invoiceNo: "", dateIssued: new Date().toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" }),
    clientAddress: "", clientEmail: "", clientContact: "",
    projectDescription: "", contractPrice: "", mobilizationPct: "20",
    paymentTerms: "",
  });
  const [showPreview, setShowPreview] = React.useState(false);

  const cd = caseStore[selClient] || {};
  const lotNo = cd?.lotNo || "\u2014";
  const location = cd?.propertyLocation || "\u2014";
  const surveyType = cd?.caseType || "Survey";
  const locParts = location.split(",").map(s => s.trim());
  const barangay = locParts[0] || "\u2014";
  const municipality = locParts[1] || "\u2014";
  const province = locParts[2] || locParts[1] || "\u2014";

  const setF = (k, v) => setFields(p => ({ ...p, [k]: v }));
  const mobilizationAmt = fields.contractPrice ? Math.round(Number(fields.contractPrice) * Number(fields.mobilizationPct) / 100) : 0;
  const fmtP = (n) => `Php ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;

  const numToWords = (n) => {
    if (!n || isNaN(n)) return "";
    const ones = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
    const tens = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
    const toW = (num) => {
      if (num === 0) return "";
      if (num < 20) return ones[num] + " ";
      if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "") + " ";
      if (num < 1000) return ones[Math.floor(num/100)] + " HUNDRED " + toW(num%100);
      if (num < 1000000) return toW(Math.floor(num/1000)) + "THOUSAND " + toW(num%1000);
      return toW(Math.floor(num/1000000)) + "MILLION " + toW(num%1000000);
    };
    return toW(Number(n)).trim() + " PESOS ONLY";
  };

  const inputSt = { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  const Header = () => (
    <div style={{display:"flex",alignItems:"center",gap:16,paddingBottom:10,borderBottom:"2.5px solid #1a4a8a",marginBottom:16}}>
      <img src={LOGO_SRC} style={{width:72,height:72,objectFit:"contain"}} alt="logo" />
      <div style={{flex:1,textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:800,color:"#1a4a8a",fontFamily:"serif"}}>E. B. Bernas Land Consultancy</div>
        <div style={{fontSize:13,color:"#333"}}>#051 Garrita, Bani, Pangasinan</div>
        <div style={{fontSize:13,color:"#333"}}>Contact Number: 0969-4931-815 / 0991-9374-062</div>
      </div>
    </div>
  );

  const Footer = () => (
    <div style={{marginTop:40,paddingTop:6,borderTop:"1.5px solid #1a4a8a",textAlign:"center",fontSize:11,color:"#555",fontFamily:"serif",letterSpacing:"0.05em"}}>
      E.B. BERNAS LAND CONSULTANCY
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <style>{`@media print { body * { visibility:hidden!important; } #print-area,#print-area * { visibility:visible!important; } #print-area { position:fixed;top:0;left:0;width:100%;background:white;z-index:9999;padding:40px;box-sizing:border-box; } .no-print { display:none!important; } }`}</style>

      <Card>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <p className="eyebrow">Forms Generator</p>
            <h3 className="section-title">📋 Auto-fill Forms</h3>
          </div>
        </div>

        <div className="no-print" style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {[["survey-notice","📋 Survey Notice"],["invoice","🧾 Invoice / Billing"]].map(([id,label]) => (
            <button key={id} onClick={() => { setFormType(id); setShowPreview(false); }}
              style={{padding:"9px 18px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,
                background:formType===id?"#fff":"rgba(255,255,255,0.07)",
                color:formType===id?"#0a1a13":"rgba(220,245,230,0.6)"}}>
              {label}
            </button>
          ))}
        </div>

        <div className="no-print" style={{marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(220,245,230,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Select Client</p>
          <select value={selClient} onChange={e => { setSelClient(e.target.value); setShowPreview(false); }} style={{...inputSt,background:"#0f2318"}}>
            <option value="">-- Piliin ang client --</option>
            {clients.map(c => { const lot = caseStore[c]?.lotNo || parseCaseKey(c).lot; return <option key={c} value={c} style={{background:"#0f2318"}}>{caseClientName(c)}{lot ? ` \u2014 Lot ${lot}` : ""}</option>; })}
          </select>
          {selClient && (
            <div style={{marginTop:8,padding:"8px 12px",borderRadius:10,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",fontSize:12}}>
              \u2705 Auto-filled: <strong>{selClient}</strong> \u00b7 Lot {lotNo} \u00b7 {location}
            </div>
          )}
        </div>

        {formType === "survey-notice" && selClient && (
          <div className="no-print" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {[["surveyDate","📅 Date of Survey","date"],["surveyTime","⏰ Time","text"],["tdNo","TD No.","text"],["requestedBy","Requested by","text"],["barangayCaptain","Barangay Captain Name","text"]].map(([key,label,type]) => (
              <div key={key} style={key==="barangayCaptain"?{gridColumn:"1/-1"}:{}}>
                <p style={{fontSize:10,color:"rgba(220,245,230,0.4)",marginBottom:4}}>{label}</p>
                <input type={type} value={key==="requestedBy"?(fields.requestedBy||selClient):fields[key]}
                  onChange={e => setF(key, e.target.value)}
                  placeholder={key==="surveyTime"?"9:00 AM":key==="requestedBy"?selClient:""}
                  style={inputSt} />
              </div>
            ))}
            {[0,1].map(i => (
              <div key={i}>
                <p style={{fontSize:10,color:"rgba(220,245,230,0.4)",marginBottom:4}}>Witness {i+1}</p>
                <input value={fields.witnesses[i]} onChange={e => setF("witnesses", i===0?[e.target.value,fields.witnesses[1]]:[fields.witnesses[0],e.target.value])} placeholder="Name" style={inputSt} />
              </div>
            ))}
          </div>
        )}

        {formType === "invoice" && selClient && (
          <div className="no-print" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {[["invoiceNo","Invoice No.","text"],["dateIssued","Date Issued","text"],["clientAddress","Client Address","text","1/-1"],["clientEmail","Client Email","text"],["clientContact","Client Contact No.","text"],["projectDescription","Project Description","text","1/-1"],["contractPrice","Total Contract Price (₱)","number"],["mobilizationPct","Mobilization %","number"]].map(([key,label,type,col]) => (
              <div key={key} style={col?{gridColumn:col}:{}}>
                <p style={{fontSize:10,color:"rgba(220,245,230,0.4)",marginBottom:4}}>{label}</p>
                <input type={type} value={key==="projectDescription"?(fields.projectDescription||`${surveyType} \u2014 Lot ${lotNo} \u2014 ${location}`):fields[key]}
                  onChange={e => setF(key, e.target.value)} style={inputSt} />
                {key==="contractPrice" && fields.contractPrice && <p style={{fontSize:11,color:"#34d399",marginTop:4}}>Mobilization: \u20b1{mobilizationAmt.toLocaleString()}</p>}
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <p style={{fontSize:10,color:"rgba(220,245,230,0.4)",marginBottom:4}}>Payment Terms</p>
              <textarea value={fields.paymentTerms||`This billing represents ${fields.mobilizationPct}% mobilization payment in accordance with the agreed payment terms for the ${surveyType} project.`}
                onChange={e => setF("paymentTerms",e.target.value)} rows={2} style={{...inputSt,resize:"none"}} />
            </div>
          </div>
        )}

        {selClient && (
          <button onClick={() => setShowPreview(true)} className="btn-primary no-print" style={{width:"100%",padding:"12px 0"}}>
            \u26a1 Generate Form
          </button>
        )}
      </Card>

      {showPreview && selClient && (
        <div className="no-print" style={{position:"sticky",top:70,zIndex:50,display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(26,74,138,0.95)",borderRadius:14,padding:"12px 20px",backdropFilter:"blur(10px)"}}>
          <p style={{color:"#fff",fontSize:13,fontWeight:700}}>✅ {formType === "survey-notice" ? "Survey Notice" : "Invoice/Billing"} — {selClient}</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={() => setShowPreview(false)} style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              ✏️ Edit
            </button>
            <button onClick={() => window.print()} style={{background:"#fff",color:"#1a4a8a",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              🖨️ Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {showPreview && selClient && (
        <div id="print-area" style={{background:"#fff",color:"#000",borderRadius:16,padding:40,fontFamily:"serif",fontSize:13,lineHeight:1.7}}>

          {formType === "survey-notice" && (
            <>
              <Header />
              <div style={{textAlign:"right",marginBottom:12}}>
                Date: <span style={{borderBottom:"1px solid #000",paddingBottom:2,paddingRight:40}}>
                  {fields.surveyDate ? new Date(fields.surveyDate+"T00:00:00").toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"}) : "_______________"}
                </span>
              </div>
              <div style={{textAlign:"center",fontWeight:800,fontSize:15,marginBottom:20,textDecoration:"underline",letterSpacing:"0.05em"}}>NOTICE OF SURVEY</div>
              <p style={{textAlign:"justify",marginBottom:16}}>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This is to inform all concern persons, <strong>E.B. BERNAS LAND CONSULTANCY</strong> will conduct a <strong>{surveyType}</strong> on{" "}
                <strong style={{borderBottom:"1px solid #000",paddingBottom:2}}>
                  {fields.surveyDate ? new Date(fields.surveyDate+"T00:00:00").toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"}) : "_______________"}
                </strong>{" "}
                with <strong>Lot No. {lotNo}</strong>, TD no. <strong>{fields.tdNo||"_______________"}</strong> at <strong>Brgy. {barangay}, {municipality}, {province}</strong>.
                {" "}You are invited to Witness this said Survey in order to avoid conflicts on this Activity. At <strong>{fields.surveyTime}</strong>.
              </p>
              <p style={{marginBottom:28}}>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;This survey notice is issued upon the request of{" "}
                <strong style={{borderBottom:"1px solid #000",padding:"0 50px 2px 4px"}}>{fields.requestedBy||selClient}</strong>.
                Your consent on this activity is highly appreciated.
              </p>
              <p style={{marginBottom:40}}><strong>Very truly yours;</strong></p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,marginBottom:40}}>
                <div><div style={{borderTop:"1px solid #000",paddingTop:6,marginTop:50}}><strong>EUGENE BENEDICT C. BERNAS</strong><br/>GEODETIC ENGINEER<br/>LIC. NO. 8835</div></div>
                <div><div style={{borderTop:"1px solid #000",paddingTop:6,marginTop:50}}><strong>{fields.barangayCaptain||"_______________________"}</strong><br/>BARANGAY CAPTAIN</div></div>
              </div>
              <div>
                <strong>WITNESS:</strong>
                <div style={{display:"flex",gap:60,marginTop:50}}>
                  <div style={{flex:1,borderTop:"1px solid #000",paddingTop:4}}>{fields.witnesses[0]||"________________________"}</div>
                  <div style={{flex:1,borderTop:"1px solid #000",paddingTop:4}}>{fields.witnesses[1]||"________________________"}</div>
                </div>
              </div>
              <Footer />
            </>
          )}

          {formType === "invoice" && (
            <>
              <Header />
              <div style={{marginBottom:16}}>
                <strong>{selClient.toUpperCase()}</strong><br/>
                {fields.clientAddress && <span>Address: {fields.clientAddress}<br/></span>}
                {fields.clientEmail && <span>Email: {fields.clientEmail}<br/></span>}
                {fields.clientContact && <span>Contact No: {fields.clientContact}</span>}
              </div>
              <p style={{marginBottom:16}}><strong>Project Description:</strong> {fields.projectDescription||`${surveyType} \u2014 Lot ${lotNo} \u2014 ${location}`}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",marginBottom:20,border:"1px solid #999"}}>
                {[["DATE ISSUED",fields.dateIssued],["INVOICE NO:",fields.invoiceNo||"___________"],["AMOUNT",fmtP(mobilizationAmt)]].map(([h,v]) => (
                  <div key={h} style={{padding:"8px 12px",borderRight:"1px solid #999"}}><strong>{h}</strong><br/>{v}</div>
                ))}
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
                <thead><tr style={{background:"#e8e8e8"}}><th style={{border:"1px solid #999",padding:"8px 12px",textAlign:"center"}}>DESCRIPTION</th><th style={{border:"1px solid #999",padding:"8px 12px",textAlign:"center"}}>AMOUNT</th></tr></thead>
                <tbody>
                  <tr><td style={{border:"1px solid #999",padding:"8px 12px"}}>Total Contract Price</td><td style={{border:"1px solid #999",padding:"8px 12px",textAlign:"right"}}>{fmtP(fields.contractPrice)}</td></tr>
                  <tr><td style={{border:"1px solid #999",padding:"8px 12px"}}>Mobilization ({fields.mobilizationPct}%) Upon signing of agreement and issuance of Notice to Proceed</td><td style={{border:"1px solid #999",padding:"8px 12px",textAlign:"right"}}>{fmtP(mobilizationAmt)}</td></tr>
                  <tr style={{fontWeight:800}}><td style={{border:"1px solid #999",padding:"8px 12px",textAlign:"center"}}>TOTAL</td><td style={{border:"1px solid #999",padding:"8px 12px",textAlign:"right"}}>{fmtP(mobilizationAmt).toUpperCase()}</td></tr>
                </tbody>
              </table>
              <p style={{marginBottom:4}}><strong>PAYMENT TERMS</strong></p>
              <p style={{paddingLeft:16,marginBottom:16}}>{fields.paymentTerms||`This billing represents ${fields.mobilizationPct}% mobilization payment in accordance with the agreed payment terms for the ${surveyType} project.`}</p>
              <p style={{marginBottom:32}}><strong>TOTAL AMOUNT DUE:</strong> {fmtP(mobilizationAmt)} ({numToWords(mobilizationAmt)})</p>
              <p style={{marginBottom:50}}>Very Truly Yours,</p>
              <div style={{display:"inline-block",borderTop:"1px solid #000",paddingTop:6}}>
                <strong>EUGENE BENEDICT C. BERNAS</strong><br/>GEODETIC ENGINEER
              </div>
              <Footer />
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
// ── MY PROFILE PAGE ───────────────────────────────────────────────────────────
function MyProfilePage({ currentUser, onUpdate }) {
  const [form, setForm] = useState({
    name: currentUser?.displayName || "",
    mobile: currentUser?.mobile || "",
    position: currentUser?.position || "",
    address: currentUser?.address || "",
  });
  const [saved, setSaved] = useState(false);
  const [telegramId, setTelegramId] = useState(currentUser?.telegramChatId || "");
  const [telegramStatus, setTelegramStatus] = useState(""); // "" | "testing" | "sent" | "error"
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  const handleSave = async () => {
    const updated = { ...currentUser, displayName: form.name, mobile: form.mobile, position: form.position, address: form.address, telegramChatId: telegramId };
    try {
      await saveProfile(currentUser.email, { name: form.name, mobile: form.mobile, position: form.position, address: form.address, telegramChatId: telegramId });
    } catch {}
    onUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testTelegram = async () => {
    if (!telegramId.trim()) return;
    setTelegramStatus("testing");
    try {
      const res = await fetch("/api/send-telegram-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: telegramId.trim(),
          message: `✅ <b>EB Bernas Portal</b>\n\nKumusta ${form.name || currentUser?.displayName}! Na-connect na ang iyong Telegram sa portal. Makakatanggap ka na ng notifications dito. 🎉`
        }),
      });
      const data = await res.json();
      setTelegramStatus(data?.ok ? "sent" : "error");
    } catch { setTelegramStatus("error"); }
    setTimeout(() => setTelegramStatus(""), 4000);
  };

  const fields = [
    { label: "Full Name", key: "name", placeholder: "Your full name" },
    { label: "Contact Number", key: "mobile", placeholder: "09xxxxxxxxx" },
    { label: "Position", key: "position", placeholder: "e.g. Team Leader" },
    { label: "Address", key: "address", placeholder: "Barangay, Municipality, Province" },
  ];

  const inputSt = { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Account Settings</p>
        <h3 className="section-title" style={{ marginBottom: 4 }}>👤 My Profile</h3>
        <p style={{ fontSize: 12, color: "rgba(220,245,230,0.4)", marginBottom: 20 }}>📧 {currentUser?.email}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map(f => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} style={inputSt} />
            </div>
          ))}
        </div>

        {saved && (
          <div style={{ marginTop: 14, borderRadius: 12, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "10px 14px", fontSize: 13, color: "#34d399", fontWeight: 600 }}>
            ✅ Profile updated!
          </div>
        )}

        <button onClick={handleSave}
          style={{ width: "100%", padding: "13px 0", marginTop: 16, borderRadius: 14, border: "none", background: "#34d399", color: "#0a1a13", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          💾 Save Changes
        </button>
      </Card>

      {/* ── TELEGRAM CONNECT ── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>✈️</div>
          <div>
            <p className="eyebrow" style={{ color: "#60a5fa" }}>Notifications</p>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Connect Telegram</h3>
          </div>
          {currentUser?.telegramChatId && (
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>✅ Connected</span>
          )}
        </div>

        <p style={{ fontSize: 13, color: "rgba(220,245,230,0.55)", marginBottom: 16, lineHeight: 1.6 }}>
          I-connect ang iyong Telegram para makatanggap ng <strong style={{ color: "#e8f5ee" }}>libre</strong> na notifications — bagong schedule, updates, at iba pa.
        </p>

        {/* Step by step guide toggle */}
        <button onClick={() => setShowTelegramGuide(!showTelegramGuide)}
          style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: "#60a5fa", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left", marginBottom: 14 }}>
          {showTelegramGuide ? "▲" : "▼"} Paano kumuha ng Telegram Chat ID?
        </button>

        {showTelegramGuide && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, border: "1px solid rgba(96,165,250,0.15)", background: "rgba(96,165,250,0.05)" }}>
            {[
              { step: "1", text: "I-open ang Telegram app sa phone mo" },
              { step: "2", text: 'I-search ang "@BernasPortal_Bot" sa Telegram' },
              { step: "3", text: 'I-click ang "Start" button' },
              { step: "4", text: 'Mag-send ng kahit anong message (e.g. "hi")' },
              { step: "5", text: 'Buksan ang browser, i-type: api.telegram.org/bot[TOKEN]/getUpdates — hanapin ang "chat":{"id":XXXXXXX} — iyon ang iyong Chat ID' },
              { step: "6", text: "I-paste ang Chat ID sa field sa baba tapos i-click Test" },
            ].map(s => (
              <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(96,165,250,0.2)", color: "#60a5fa", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.step}</span>
                <p style={{ fontSize: 12, color: "rgba(220,245,230,0.7)", lineHeight: 1.5 }}>{s.text}</p>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", fontFamily: "monospace", fontSize: 11, color: "#60a5fa", wordBreak: "break-all" }}>
              Step 5 URL example:<br />
              https://api.telegram.org/bot7657934679:AAFv.../getUpdates
            </div>
          </div>
        )}

        {/* Chat ID input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Telegram Chat ID</label>
          <input value={telegramId} onChange={e => setTelegramId(e.target.value)}
            placeholder="e.g. 1633018954" style={inputSt} />
        </div>

        {/* Status */}
        {telegramStatus && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: telegramStatus === "sent" ? "rgba(52,211,153,0.12)" : telegramStatus === "testing" ? "rgba(96,165,250,0.12)" : "rgba(251,113,133,0.12)",
            color: telegramStatus === "sent" ? "#34d399" : telegramStatus === "testing" ? "#60a5fa" : "#fca5a5",
            border: `1px solid ${telegramStatus === "sent" ? "rgba(52,211,153,0.3)" : telegramStatus === "testing" ? "rgba(96,165,250,0.3)" : "rgba(251,113,133,0.3)"}` }}>
            {telegramStatus === "testing" && "📤 Nagse-send ng test message..."}
            {telegramStatus === "sent" && "✅ Na-send na! Tingnan ang Telegram mo."}
            {telegramStatus === "error" && "❌ Hindi na-send. Tiyakin na tama ang Chat ID at na-Start mo na ang bot."}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={testTelegram} disabled={!telegramId.trim() || telegramStatus === "testing"}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "rgba(96,165,250,0.15)", color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: telegramId.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: telegramId.trim() ? 1 : 0.5 }}>
            📲 Test Connection
          </button>
          <button onClick={handleSave} disabled={!telegramId.trim()}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: telegramId.trim() ? "#60a5fa" : "rgba(96,165,250,0.2)", color: telegramId.trim() ? "#fff" : "rgba(220,245,230,0.3)", fontSize: 13, fontWeight: 700, cursor: telegramId.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            💾 Save Chat ID
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function EBBernasPortal() {
  const [activeMenu, setActiveMenu] = useState("overview");
  const [selectedClient, setSelectedClient] = useState("");
  const [search, setSearch] = useState("");
  const [clientCategory, setClientCategory] = useState("all"); // "all" | "approval" | "field"
  const [quickName, setQuickName] = useState(""); // pinili sa dropdown 1 (client name)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("ebernas_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = async (user) => {
    // Load saved profile from Firebase
    try {
      const profile = await getProfile(user.email);
      if (profile) {
        user = { ...user, displayName: profile.name || user.displayName, mobile: profile.mobile || user.mobile, position: profile.position || "", address: profile.address || "", telegramChatId: profile.telegramChatId || "" };
      }
    } catch {}
    localStorage.setItem("ebernas_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("ebernas_user");
    setCurrentUser(null);
  };

  const handleUpdateProfile = (updatedUser) => {
    localStorage.setItem("ebernas_user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  // ── FIREBASE REAL-TIME STATE ──
  const [caseStore, setCaseStoreRaw] = useState(INIT_CASES);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const [schedules, setSchedulesRaw] = useState([]);
  const [allEmployees, setAllEmployeesRaw] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});

  // Merged employees — employees + profiles data combined
  const allEmployeesMerged = allEmployees.map(emp => {
    const profile = profilesMap[emp.email] || {};
    return {
      ...emp,
      mobile: emp.mobile || profile.mobile || "",
      name: emp.name || profile.name || emp.fullName || "",
      position: emp.position || profile.position || "",
      telegramChatId: emp.telegramChatId || profile.telegramChatId || "",
    };
  });

  // Listen to Firebase in real-time
  useEffect(() => {
    const unsubSchedules = listenSchedules(setSchedulesRaw);
    const unsubCases = listenCases((data) => {
      setCaseStoreRaw(prev => ({ ...INIT_CASES, ...data }));
    });
    const unsubEmployees = listenEmployees(setAllEmployeesRaw);
    // Listen to profiles
    const unsubProfiles = onSnapshot(collection(db, "profiles"), snap => {
      const map = {};
      snap.docs.forEach(d => { const data = d.data(); if (data.email) map[data.email] = data; });
      setProfilesMap(map);
    });
    return () => { unsubSchedules(); unsubCases(); unsubEmployees(); unsubProfiles(); };
  }, []);

  const setCaseStore = async (val) => {
    const next = typeof val === "function" ? val(caseStore) : val;
    setCaseStoreRaw(next);
    // Fire lahat ng saves nang PARALLEL (hindi sequential await).
    // Importante ito para OFFLINE: kung sequential, na-stuck sa unang case
    // (di natatapos ang setDoc offline) kaya di na-queue ang iba. Ngayon,
    // agad na-queue lahat sa Firestore cache; awtomatikong mag-sasync online.
    Object.entries(next).forEach(([clientName, clientData]) => {
      if (!clientName || !clientName.trim()) return; // skip blank keys
      saveCase(clientName, clientData).catch((e) => console.error("saveCase failed for", clientName, e));
    });
  };

  const setSchedules = async (val) => {
    const next = typeof val === "function" ? val(schedules) : val;
    // Firebase handles state via listener — just sync changes
    const prevIds = schedules.map(s => s.id);
    const nextIds = next.map(s => s.id);
    // Find deleted
    for (const id of prevIds) {
      if (!nextIds.includes(id)) await deleteScheduleDB(id);
    }
    // Find added/updated
    for (const s of next) {
      if (!prevIds.includes(s.id) || JSON.stringify(schedules.find(x => x.id === s.id)) !== JSON.stringify(s)) {
        await saveSchedule(s);
      }
    }
  };

  if (!currentUser) return <AuthPage onLogin={handleLogin} />;

  const SUPER_ADMIN_EMAIL = "e.b.bernassurveying@gmail.com";
  const isAdmin = currentUser.role === "admin" || currentUser.email === SUPER_ADMIN_EMAIL;

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
    { id: "birtax", label: "🧮 BIR Tax Calculator" },
    { id: "profile", label: "👤 My Profile" },
    ...(isAdmin ? [
      { id: "finance", label: "💰 Finance & Payroll" },
      { id: "admin", label: "👑 Admin Panel" },
    ] : []),
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
          .portal-layout { padding:12px; }
          .brand-addr { display:none; }
          .brand-sup { display:none; }
          .brand-name { font-size:13px; }
          .brand-logo { width:36px !important; height:36px !important; font-size:18px !important; border-radius:10px !important; }
          .brand-version { display:none; }
          .header-inner { padding:0 12px !important; height:56px !important; }
          .user-display-name { max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px !important; }
          .case-table-row { grid-template-columns: 1.8fr 1fr 1fr 32px !important; }
          .case-table-header { grid-template-columns: 1.8fr 1fr 1fr 32px !important; }
          .case-table-survey-type { display:none !important; }
          .stat-card { padding:10px !important; }
          .stat-value { font-size:18px !important; }
        }
      `}</style>

      <div className="portal">
        {!isOnline && (
          <div style={{ background: "rgba(251,191,36,0.15)", borderBottom: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", textAlign: "center", padding: "8px 12px", fontSize: 12, fontWeight: 700 }}>
            📴 Offline ka ngayon — patuloy kang makakapag-edit. Awtomatikong mag-sasync pagbalik ng internet.
          </div>
        )}
        <header className="portal-header">
          <div className="header-inner">
            <div className="brand">
              <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
              <div className="brand-logo">🏛️</div>
              <div>
                <p className="brand-sup">E.B. Bernas Land Consultancy</p>
                <p className="brand-name">EB BERNAS PORTAL V1</p>
                <p className="brand-addr">No. 051, Brgy. Garrita, Bani, Pangasinan</p>
                <p className="brand-version" style={{ fontSize: 9, color: "rgba(220,245,230,0.3)", marginTop: 1 }}>v1.1.0 — Jul 3, 2026</p>
              </div>
            </div>
            <div className="header-actions">
              {/* Sync status badge */}
              <div title={isOnline ? "Online — naka-sync ang data" : "Offline — mase-save lokal, mag-sasync pagbalik ng net"}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  background: isOnline ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)",
                  border: isOnline ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(251,191,36,0.4)",
                  color: isOnline ? "#34d399" : "#fbbf24" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: isOnline ? "#34d399" : "#fbbf24", boxShadow: isOnline ? "0 0 6px #34d399" : "0 0 6px #fbbf24" }} />
                {isOnline ? "Naka-sync" : "Offline"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(220,245,230,0.6)", textAlign: "right" }}>
                <p className="user-display-name" style={{ fontWeight: 600, color: "#e8f5ee" }}>{currentUser.displayName}</p>
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
                {/* Category filter */}
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {[["all","All"],["approval","📋 Approval"],["field","📐 Field"]].map(([id,label]) => (
                    <button key={id} onClick={() => setClientCategory(id)}
                      style={{ flex:1, fontSize:9, padding:"4px 2px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:700,
                        background: clientCategory===id ? "#fff" : "rgba(255,255,255,0.07)",
                        color: clientCategory===id ? "#0a1a13" : "rgba(220,245,230,0.5)" }}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Dropdown 1 — Pangalan lang (walang doble) */}
                {(() => {
                  const keys = Object.keys(caseStore).filter(k => {
                    if (!k.trim()) return false;
                    const d = caseStore[k];
                    const isApproval = isApprovalCaseType(d);
                    if (clientCategory === "approval") return isApproval;
                    if (clientCategory === "field") return !isApproval;
                    return true;
                  });
                  const names = [...new Set(keys.map(k => caseClientName(k)))].sort((a, b) => a.localeCompare(b));
                  const lotsForName = keys.filter(k => caseClientName(k) === quickName)
                    .sort((a, b) => a.localeCompare(b));
                  return (
                    <>
                      <select value={quickName} onChange={(e) => {
                        const nm = e.target.value;
                        setQuickName(nm);
                        const lots = keys.filter(k => caseClientName(k) === nm);
                        if (lots.length === 1) { setSelectedClient(lots[0]); setMenu("dashboard"); }
                      }}
                        className="search-input" style={{ width: "100%", cursor: "pointer", marginBottom: 6, background: quickName ? "rgba(52,211,153,0.15)" : "rgba(0,0,0,0.2)", color: quickName ? "#34d399" : "rgba(220,245,230,0.5)", fontWeight: quickName ? 700 : 400, border: quickName ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(255,255,255,0.08)" }}>
                        <option value="">-- Piliin ang Client --</option>
                        {names.map(nm => <option key={nm} value={nm} style={{ background: "#0f2318", color: "#e8f5ee" }}>{nm}</option>)}
                      </select>

                      {/* Dropdown 2 — Lot (lalabas kung may 2+ lots) */}
                      {quickName && lotsForName.length > 1 && (
                        <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setMenu("dashboard"); }}
                          className="search-input" style={{ width: "100%", cursor: "pointer", background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontWeight: 700, border: "1px solid rgba(96,165,250,0.35)" }}>
                          <option value="" style={{ background: "#0f2318" }}>-- Piliin ang Lot ({lotsForName.length}) --</option>
                          {lotsForName.map(k => {
                            const lot = caseStore[k]?.lotNo || parseCaseKey(k).lot || "Walang lot";
                            return <option key={k} value={k} style={{ background: "#0f2318", color: "#e8f5ee" }}>🏷️ Lot {lot}</option>;
                          })}
                        </select>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </aside>

          <main className="content">
            {activeMenu === "overview" && <OverviewPage caseStore={caseStore} setCaseStore={setCaseStore} schedules={schedules} currentUser={currentUser} setActiveMenu={setActiveMenu} />}
            {activeMenu === "schedule" && <SchedulePage schedules={schedules} setSchedules={setSchedules} caseStore={caseStore} setCaseStore={setCaseStore} setActiveMenu={setMenu} setSelectedClient={setSelectedClient} globalEmployees={allEmployeesMerged} />}
            {activeMenu === "dashboard" && <DashboardPage client={selectedClient} caseStore={caseStore} setCaseStore={setCaseStore} isAdmin={isAdmin} currentUser={currentUser} />}
            {activeMenu === "cases" && <CasesPage setClient={setSelectedClient} setMenu={setMenu} search={search} setSearch={setSearch} />}
            {activeMenu === "documents" && <DocumentsPage client={selectedClient} isAdmin={isAdmin} />}
            {activeMenu === "checklist" && <ChecklistPage client={selectedClient} caseStore={caseStore} setCaseStore={setCaseStore} isAdmin={isAdmin} />}
            {activeMenu === "messaging" && <MessagingPage globalEmployees={allEmployeesMerged} />}
            {activeMenu === "newcase" && <NewCasePage caseStore={caseStore} setCaseStore={setCaseStore} setActiveMenu={setActiveMenu} setSelectedClient={setSelectedClient} isAdmin={isAdmin} currentUser={currentUser} />}
            {activeMenu === "forms" && <FormsPage caseStore={caseStore} />}
            {activeMenu === "birtax" && <BIRCalculatorPage isAdmin={isAdmin} />}
            {activeMenu === "admin" && isAdmin && <EmployeeManager currentUser={currentUser} />}
            {activeMenu === "finance" && isAdmin && <FinancePage isAdmin={isAdmin} currentUser={currentUser} globalEmployees={allEmployeesMerged} schedules={schedules} />}
            {activeMenu === "profile" && <MyProfilePage currentUser={currentUser} onUpdate={handleUpdateProfile} />}
          </main>
        </div>
      </div>
    </>
  );
}
