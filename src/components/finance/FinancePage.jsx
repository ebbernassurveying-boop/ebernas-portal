import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";

// ── HELPERS ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
};
const fmtPeso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// Get Saturday of current week (week runs Sat -> Fri, payday = Fri)
const getWeekStart = (dateStr) => {
  const d = new Date(dateStr || todayStr());
  const day = d.getDay();          // Sun=0, Mon=1 ... Sat=6
  const diff = -((day + 1) % 7);   // Sat=0, Sun=-1, Mon=-2 ... Fri=-6
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

// Get Friday of current week (payday = 6 days after Saturday)
const getWeekEnd = (dateStr) => {
  const d = new Date(getWeekStart(dateStr));
  d.setDate(d.getDate() + 6);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

// Generate week days Sat-Fri
const getWeekDays = (weekStart) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  }
  return days;
};

const DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

// Convert an attendance record to a day value: full = 1, half = 0.5, absent = 0
const dayValue = (att) => (att?.present ? (att.half ? 0.5 : 1) : 0);

// Returns event handlers: short press = onClick, long press (>=500ms) = onHold.
// Works for both mouse and touch. Prevents the click from also firing after a hold.
const longPress = (onHold, onClick, ms = 500) => {
  let timer = null;
  let held = false;
  const start = (e) => {
    held = false;
    timer = setTimeout(() => { held = true; onHold(); }, ms);
  };
  const finish = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const cancel = () => { finish(); held = false; };
  return {
    onMouseDown: start,
    onMouseUp: finish,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: (e) => { finish(); if (held) { e.preventDefault(); } },
    onClick: (e) => { if (held) { e.preventDefault(); held = false; return; } onClick(); },
    onContextMenu: (e) => e.preventDefault(),
  };
};

// ── FIREBASE HELPERS ──────────────────────────────────────────────────────────
async function saveFinanceDoc(colName, id, data) {
  await setDoc(doc(db, colName, id), data, { merge: true });
}
async function deleteFinanceDoc(colName, id) {
  await deleteDoc(doc(db, colName, id));
}
function listenCol(colName, callback) {
  return onSnapshot(collection(db, colName), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── CARD COMPONENT ────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {eyebrow && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>{eyebrow}</p>}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#e8f5ee" }}>{title}</h3>
    </div>
  );
}

const inputSt = { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const selectSt = { ...inputSt, background: "#0f2318", color: "#e8f5ee" };
const btnPrimary = { background: "#fff", color: "#0a1a13", border: "none", borderRadius: 12, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const btnOutline = { background: "transparent", color: "rgba(220,245,230,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const btnDanger = { background: "rgba(251,113,133,0.12)", color: "#fb7185", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "income", label: "💰 Income" },
  { id: "attendance", label: "📋 Attendance" },
  { id: "payroll", label: "💵 Payroll" },
  { id: "expenses", label: "🧾 Expenses" },
];

// ── MAIN FINANCE PAGE ─────────────────────────────────────────────────────────
export default function FinancePage({ isAdmin, currentUser, globalEmployees = [], schedules = [] }) {
  const [tab, setTab] = useState("overview");
  const [income, setIncome] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [payroll, setPayroll] = useState([]); // employee rate records
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const u1 = listenCol("fin_income", setIncome);
    const u2 = listenCol("fin_attendance", setAttendance);
    const u3 = listenCol("fin_payroll", setPayroll);
    const u4 = listenCol("fin_expenses", setExpenses);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // Approved employees only
  const employees = globalEmployees.filter(e => e.approved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Sora', sans-serif", color: "#e8f5ee" }}>
      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...btnOutline, background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#0a1a13" : "rgba(220,245,230,0.6)", fontSize: 12, padding: "8px 14px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab income={income} attendance={attendance} payroll={payroll} expenses={expenses} employees={employees} />}
      {tab === "income" && <IncomeTab income={income} schedules={schedules} isAdmin={isAdmin} />}
      {tab === "attendance" && <AttendanceTab attendance={attendance} employees={employees} isAdmin={isAdmin} currentUser={currentUser} />}
      {tab === "payroll" && <PayrollTab payroll={payroll} attendance={attendance} employees={employees} isAdmin={isAdmin} />}
      {tab === "expenses" && <ExpensesTab expenses={expenses} isAdmin={isAdmin} currentUser={currentUser} />}
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ income, attendance, payroll, expenses, employees }) {
  const [period, setPeriod] = useState("month"); // week | month | all

  const now = new Date();
  const thisMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
  const weekStart = getWeekStart(todayStr());
  const weekEnd = getWeekEnd(todayStr());

  const filterByPeriod = (items, dateField) => {
    if (period === "all") return items;
    if (period === "month") return items.filter(i => (i[dateField] || "").startsWith(thisMonth));
    if (period === "week") return items.filter(i => (i[dateField] || "") >= weekStart && (i[dateField] || "") <= weekEnd);
    return items;
  };

  const filteredIncome = filterByPeriod(income, "date");
  const filteredExpenses = filterByPeriod(expenses, "date");

  const totalIncome = filteredIncome.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Payroll for period — sum of computed payroll
  const totalPayroll = (() => {
    const empIds = employees.map(e => e.email || e.id);
    return empIds.reduce((sum, empId) => {
      const rate = payroll.find(p => p.employeeId === empId)?.dailyRate || 0;
      const daysWorked = filterByPeriod(
        attendance.filter(a => a.employeeId === empId && a.present),
        "date"
      ).reduce((n, a) => n + dayValue(a), 0);
      return sum + (rate * daysWorked);
    }, 0);
  })();

  const totalDeductions = totalExpenses + totalPayroll;
  const netIncome = totalIncome - totalDeductions;

  const statCards = [
    { icon: "💰", label: "Total Income", value: fmtPeso(totalIncome), color: "#34d399" },
    { icon: "💵", label: "Payroll", value: fmtPeso(totalPayroll), color: "#fbbf24" },
    { icon: "🧾", label: "Expenses", value: fmtPeso(totalExpenses), color: "#fb7185" },
    { icon: netIncome >= 0 ? "📈" : "📉", label: "Net Income", value: fmtPeso(netIncome), color: netIncome >= 0 ? "#34d399" : "#fb7185" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Period Filter */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["week", "This Week"], ["month", "This Month"], ["all", "All Time"]].map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)}
            style={{ ...btnOutline, background: period === id ? "#fff" : "transparent", color: period === id ? "#0a1a13" : "rgba(220,245,230,0.6)", fontSize: 11, padding: "6px 12px" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {statCards.map(s => (
          <Card key={s.label}>
            <p style={{ fontSize: 20 }}>{s.icon}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)", marginTop: 2 }}>{s.label}</p>
          </Card>
        ))}
      </div>

      {/* P&L Bar */}
      <Card>
        <SectionTitle eyebrow="Profit & Loss" title="📊 Income vs Expenses" />
        {totalIncome === 0 && totalDeductions === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "20px 0" }}>Wala pang data sa period na ito.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Income", value: totalIncome, color: "#34d399", max: Math.max(totalIncome, totalDeductions) },
              { label: "Payroll", value: totalPayroll, color: "#fbbf24", max: Math.max(totalIncome, totalDeductions) },
              { label: "Expenses", value: totalExpenses, color: "#fb7185", max: Math.max(totalIncome, totalDeductions) },
            ].map(b => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{b.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{fmtPeso(b.value)}</p>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${b.max ? Math.round((b.value / b.max) * 100) : 0}%`, background: b.color, borderRadius: 4, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 12, background: netIncome >= 0 ? "rgba(52,211,153,0.08)" : "rgba(251,113,133,0.08)", border: `1px solid ${netIncome >= 0 ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)"}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: netIncome >= 0 ? "#34d399" : "#fb7185" }}>
                {netIncome >= 0 ? "📈 Kumikita ka!" : "📉 Lugi ngayon"} — Net: {fmtPeso(netIncome)}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── INCOME TAB ────────────────────────────────────────────────────────────────
function IncomeTab({ income, schedules, isAdmin }) {
  const [form, setForm] = useState({ scheduleId: "", client: "", description: "", amount: "", date: todayStr() });
  const [showAdd, setShowAdd] = useState(false);
  const [monthFilter, setMonthFilter] = useState(todayStr().slice(0, 7));

  // Done schedules without income yet or all done schedules
  const doneSchedules = schedules.filter(s => s.done);

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    const id = `INC-${Date.now()}`;
    await saveFinanceDoc("fin_income", id, { ...form, id, createdAt: new Date().toISOString() });
    setForm({ scheduleId: "", client: "", description: "", amount: "", date: todayStr() });
    setShowAdd(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("I-delete ang income record na ito?")) await deleteFinanceDoc("fin_income", id);
  };

  const handleSchedulePick = (schedId) => {
    const sched = doneSchedules.find(s => s.id === schedId || String(s.id) === schedId);
    if (sched) {
      setForm(p => ({ ...p, scheduleId: schedId, client: sched.client || "", description: `${sched.surveyType || sched.type || "Survey"} - Lot ${sched.lotNo || "—"} - ${sched.client || ""}` }));
    }
  };

  const filtered = income.filter(i => (i.date || "").startsWith(monthFilter)).sort((a, b) => b.date.localeCompare(a.date));
  const total = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <SectionTitle eyebrow="Income Tracker" title="💰 Schedule Income" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              style={{ ...inputSt, width: "auto", fontSize: 12 }} />
            {isAdmin && <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>+ Add Income</button>}
          </div>
        </div>

        {/* Add Form */}
        {showAdd && isAdmin && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.05)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>New Income Entry</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>From Schedule (Done)</p>
                <select value={form.scheduleId} onChange={e => handleSchedulePick(e.target.value)} style={selectSt}>
                  <option value="">-- Piliin ang schedule (optional) --</option>
                  {doneSchedules.map(s => (
                    <option key={s.id} value={s.id} style={{background:'#0f2318',color:'#e8f5ee'}}>{s.lotNo || s.title} — {s.client} ({s.date})</option>
                  ))}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Client</p>
                <input value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} placeholder="Client name" style={inputSt} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Description</p>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Relocation Survey - Lot 1234" style={inputSt} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Amount (₱) *</p>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inputSt} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Date *</p>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} style={btnPrimary}>💾 Save</button>
              <button onClick={() => setShowAdd(false)} style={btnOutline}>Cancel</button>
            </div>
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Total Income — {monthFilter}</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>{fmtPeso(total)}</p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "20px 0" }}>Wala pang income records ngayong buwan.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(inc => (
              <div key={inc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(52,211,153,0.15)", background: "rgba(52,211,153,0.04)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{inc.client || "—"}</p>
                  <p style={{ fontSize: 11, color: "rgba(220,245,230,0.5)", marginTop: 2 }}>{inc.description} · 📅 {fmtDate(inc.date)}</p>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#34d399" }}>{fmtPeso(inc.amount)}</p>
                {isAdmin && <button onClick={() => handleDelete(inc.id)} style={btnDanger}>🗑</button>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── ATTENDANCE TAB ────────────────────────────────────────────────────────────
function AttendanceTab({ attendance, employees, isAdmin, currentUser }) {
  const today = todayStr();
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const weekDays = getWeekDays(weekStart);

  const getAttendance = (empId, date) => attendance.find(a => a.employeeId === empId && a.date === date);

  // Click = toggle Present <-> Absent
  const toggleAttendance = async (empId, date, current) => {
    if (!isAdmin) return;
    const id = `ATT-${empId.replace(/[^a-zA-Z0-9]/g, "_")}-${date}`;
    if (current?.present) {
      await saveFinanceDoc("fin_attendance", id, { id, employeeId: empId, date, present: false, half: false });
    } else {
      await saveFinanceDoc("fin_attendance", id, { id, employeeId: empId, date, present: true, half: false });
    }
  };

  // Long-press = set Half Day (toggle back to full if already half)
  const setHalfDay = async (empId, date, current) => {
    if (!isAdmin) return;
    const id = `ATT-${empId.replace(/[^a-zA-Z0-9]/g, "_")}-${date}`;
    const makeHalf = !(current?.present && current?.half);
    await saveFinanceDoc("fin_attendance", id, { id, employeeId: empId, date, present: true, half: makeHalf });
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  };

  const weekEnd = weekDays[6];
  const totalDaysPerEmp = (empId) => weekDays.reduce((sum, d) => sum + dayValue(getAttendance(empId, d)), 0);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <SectionTitle eyebrow="Attendance Tracker" title="📋 Weekly Attendance" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={prevWeek} style={{ ...btnOutline, padding: "6px 12px" }}>‹ Prev</button>
          <p style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(weekStart)} – {fmtDate(weekEnd)}</p>
          <button onClick={nextWeek} style={{ ...btnOutline, padding: "6px 12px" }}>Next ›</button>
        </div>
      </div>

      {!isAdmin && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: 14, fontSize: 12, color: "#fbbf24" }}>
          👀 View only — Admin ang mag-mark ng attendance.
        </div>
      )}

      {employees.length === 0 ? (
        <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "20px 0" }}>Walang employees.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 6px" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, color: "rgba(220,245,230,0.4)", fontWeight: 700, textAlign: "left", padding: "0 8px 8px 0", minWidth: 120 }}>Employee</th>
                {weekDays.map((d, i) => (
                  <th key={d} style={{ fontSize: 10, color: d === today ? "#34d399" : "rgba(220,245,230,0.4)", fontWeight: 700, textAlign: "center", padding: "0 4px 8px", minWidth: 44 }}>
                    {DAY_LABELS[i]}<br />
                    <span style={{ fontSize: 9, fontWeight: 400 }}>{d.slice(5)}</span>
                  </th>
                ))}
                <th style={{ fontSize: 11, color: "rgba(220,245,230,0.4)", fontWeight: 700, textAlign: "center", padding: "0 0 8px 8px" }}>Days</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const empId = emp.email || emp.id;
                const days = totalDaysPerEmp(empId);
                return (
                  <tr key={empId}>
                    <td style={{ padding: "6px 8px 6px 0" }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{emp.name || emp.displayName}</p>
                      <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)" }}>{emp.position || "Employee"}</p>
                    </td>
                    {weekDays.map((d) => {
                      const att = getAttendance(empId, d);
                      const isPresent = att?.present;
                      const isHalf = att?.present && att?.half;
                      const bg = isHalf ? "rgba(251,191,36,0.2)" : isPresent ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)";
                      const fg = isHalf ? "#fbbf24" : isPresent ? "#34d399" : "rgba(220,245,230,0.2)";
                      const mark = isHalf ? "◑" : isPresent ? "✓" : "·";
                      return (
                        <td key={d} style={{ textAlign: "center", padding: "6px 4px" }}>
                          <button
                            {...longPress(() => setHalfDay(empId, d, att), () => toggleAttendance(empId, d, att))}
                            disabled={!isAdmin}
                            title={isAdmin ? "Click = Present/Absent · Hold = Half Day" : undefined}
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: "none", cursor: isAdmin ? "pointer" : "default", fontFamily: "inherit", fontSize: 14, transition: "all 0.15s",
                              background: bg, color: fg,
                              WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none",
                            }}>
                            {mark}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center", padding: "6px 0 6px 8px" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: days > 0 ? "#34d399" : "rgba(220,245,230,0.3)" }}>{Number(days.toFixed(1))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 11, color: "rgba(220,245,230,0.3)", marginTop: 12 }}>✓ = Present · ◑ = Half Day (0.5) · Linggo: Sabado → Biyernes (Biyernes = pasahod)</p>
      {isAdmin && <p style={{ fontSize: 11, color: "rgba(220,245,230,0.3)", marginTop: 4 }}>💡 I-click = Present/Absent · I-hold (pindutin nang matagal) = Half Day</p>}
    </Card>
  );
}

// ── PAYROLL TAB ───────────────────────────────────────────────────────────────
function PayrollTab({ payroll, attendance, employees, isAdmin }) {
  const today = todayStr();
  const [weekStart, setWeekStart] = useState(getWeekStart(today));
  const weekDays = getWeekDays(weekStart);
  const weekEnd = weekDays[6];
  const [editingRate, setEditingRate] = useState(null);
  const [rateInput, setRateInput] = useState("");

  const getRate = (empId) => payroll.find(p => p.employeeId === empId)?.dailyRate || 0;

  const saveRate = async (empId) => {
    const id = `RATE-${empId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    await saveFinanceDoc("fin_payroll", id, { id, employeeId: empId, dailyRate: Number(rateInput) });
    setEditingRate(null);
    setRateInput("");
  };

  const getDaysWorked = (empId) => weekDays.reduce((sum, d) => sum + dayValue(attendance.find(a => a.employeeId === empId && a.date === d)), 0);

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7);
    setWeekStart(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  };
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7);
    setWeekStart(d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  };

  const totalPayroll = employees.reduce((sum, emp) => {
    const empId = emp.email || emp.id;
    return sum + (getRate(empId) * getDaysWorked(empId));
  }, 0);

  // Check if today is Friday
  const isFriday = new Date().getDay() === 5;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <SectionTitle eyebrow="Payroll" title="💵 Weekly Payroll" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={prevWeek} style={{ ...btnOutline, padding: "6px 12px" }}>‹ Prev</button>
          <p style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(weekStart)} – {fmtDate(weekEnd)}</p>
          <button onClick={nextWeek} style={{ ...btnOutline, padding: "6px 12px" }}>Next ›</button>
        </div>
      </div>

      {isFriday && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", marginBottom: 14, fontSize: 12, color: "#34d399", fontWeight: 700 }}>
          🎉 Today is Friday — Pasahod Day! Total: {fmtPeso(totalPayroll)}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {employees.map(emp => {
          const empId = emp.email || emp.id;
          const rate = getRate(empId);
          const days = getDaysWorked(empId);
          const total = rate * days;
          const isEditing = editingRate === empId;

          return (
            <div key={empId} style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>{emp.name || emp.displayName}</p>
                  <p style={{ fontSize: 11, color: "rgba(220,245,230,0.45)", marginTop: 2 }}>{emp.position || "Employee"}</p>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Daily Rate */}
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: "rgba(220,245,230,0.4)", marginBottom: 3 }}>DAILY RATE</p>
                    {isEditing && isAdmin ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="number" value={rateInput} onChange={e => setRateInput(e.target.value)}
                          style={{ ...inputSt, width: 100, fontSize: 13 }} placeholder="0.00" autoFocus />
                        <button onClick={() => saveRate(empId)} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 11 }}>✓</button>
                        <button onClick={() => setEditingRate(null)} style={{ ...btnOutline, padding: "6px 10px", fontSize: 11 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>{fmtPeso(rate)}</p>
                        {isAdmin && <button onClick={() => { setEditingRate(empId); setRateInput(String(rate)); }} style={{ ...btnOutline, padding: "3px 8px", fontSize: 10 }}>✏️</button>}
                      </div>
                    )}
                  </div>
                  {/* Days */}
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: "rgba(220,245,230,0.4)", marginBottom: 3 }}>DAYS</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa" }}>{Number(days.toFixed(1))}</p>
                  </div>
                  {/* Total */}
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 9, color: "rgba(220,245,230,0.4)", marginBottom: 3 }}>TOTAL SAHOD</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: total > 0 ? "#34d399" : "rgba(220,245,230,0.3)" }}>{fmtPeso(total)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Grand Total */}
        <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 800 }}>💵 Total Payroll this Week</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#34d399" }}>{fmtPeso(totalPayroll)}</p>
        </div>
      </div>
    </Card>
  );
}

// ── EXPENSES TAB ──────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, isAdmin, currentUser }) {
  const CATEGORIES = ["Fuel", "Merienda / Meals", "Materials", "Transportation", "Office Supplies", "Others"];
  const [form, setForm] = useState({ category: "Fuel", description: "", amount: "", date: todayStr() });
  const [showAdd, setShowAdd] = useState(false);
  const [monthFilter, setMonthFilter] = useState(todayStr().slice(0, 7));

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    const id = `EXP-${Date.now()}`;
    await saveFinanceDoc("fin_expenses", id, { ...form, id, addedBy: currentUser?.displayName || "Admin", createdAt: new Date().toISOString() });
    setForm({ category: "Fuel", description: "", amount: "", date: todayStr() });
    setShowAdd(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("I-delete ang expense record na ito?")) await deleteFinanceDoc("fin_expenses", id);
  };

  const filtered = expenses.filter(e => (e.date || "").startsWith(monthFilter)).sort((a, b) => b.date.localeCompare(a.date));
  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Group by category
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount || 0), 0),
  })).filter(c => c.total > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <SectionTitle eyebrow="Expenses" title="🧾 Daily Expenses" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              style={{ ...inputSt, width: "auto", fontSize: 12 }} />
            <button onClick={() => setShowAdd(!showAdd)} style={btnPrimary}>+ Add Expense</button>
          </div>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, border: "1px solid rgba(251,113,133,0.2)", background: "rgba(251,113,133,0.05)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#fb7185", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>New Expense</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Category *</p>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={selectSt}>
                  {CATEGORIES.map(c => <option key={c} style={{background:'#0f2318',color:'#e8f5ee'}}>{c}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Amount (₱) *</p>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inputSt} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Description</p>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Diesel - 10L" style={inputSt} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginBottom: 4 }}>Date *</p>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} style={btnPrimary}>💾 Save</button>
              <button onClick={() => setShowAdd(false)} style={btnOutline}>Cancel</button>
            </div>
          </div>
        )}

        {/* Summary by Category */}
        {byCategory.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {byCategory.map(c => (
              <div key={c.cat} style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)" }}>
                <span style={{ fontSize: 11, color: "#fb7185", fontWeight: 700 }}>{c.cat}: {fmtPeso(c.total)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)" }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>Total Expenses — {monthFilter}</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fb7185" }}>{fmtPeso(total)}</p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", textAlign: "center", padding: "20px 0" }}>Wala pang expenses ngayong buwan.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(exp => (
              <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.08)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700 }}>{exp.category} {exp.description ? `— ${exp.description}` : ""}</p>
                  <p style={{ fontSize: 10, color: "rgba(220,245,230,0.4)", marginTop: 1 }}>📅 {fmtDate(exp.date)} · 👤 {exp.addedBy || "—"}</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#fb7185" }}>{fmtPeso(exp.amount)}</p>
                <button onClick={() => handleDelete(exp.id)} style={btnDanger}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
