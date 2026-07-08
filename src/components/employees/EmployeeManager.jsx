import React, { useState, useEffect } from "react";
import { db, listenEmployees, updateEmployeeDB, deleteEmployeeDB, saveEmployeeDB } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import EmployeeList from "./EmployeeList";
import EmployeeSearch from "./EmployeeSearch";
import EmployeeForm from "./EmployeeForm";
import EmployeeProfile from "./EmployeeProfile";
import "./employee.css";

const SUPER_ADMIN = "e.b.bernassurveying@gmail.com";

function Card({ children }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
      {children}
    </div>
  );
}

const PERMISSIONS = [
  { action: "View cases & schedules", allowed: true },
  { action: "Upload documents", allowed: true },
  { action: "Tick checklist items", allowed: true },
  { action: "Add schedule entries", allowed: true },
  { action: "Delete documents", allowed: false },
  { action: "Delete cases or schedules", allowed: false },
  { action: "Edit case information", allowed: false },
  { action: "Approve documents", allowed: false },
  { action: "Access Admin Panel", allowed: false },
];

export default function EmployeeManager({ currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);

  const isSuperAdmin = currentUser?.email === SUPER_ADMIN;

  useEffect(() => {
    const unsub = listenEmployees(setEmployees);
    // Also listen to profiles collection to get mobile numbers
    const unsubProfiles = onSnapshot(collection(db, "profiles"), snap => {
      const profileMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.email) {
          profileMap[data.email] = data;
        }
      });
      setProfiles(profileMap);
    });
    return () => { unsub(); unsubProfiles(); };
  }, []);

  // Merge profiles into employees — profiles may have mobile that employees don't
  const mergedEmployees = employees.map(emp => {
    const profile = profiles[emp.email] || {};
    return {
      ...emp,
      mobile: emp.mobile || profile.mobile || "",
      name: emp.name || profile.name || emp.fullName || "",
      position: emp.position || profile.position || "",
    };
  });

  const approve = (email) => { updateEmployeeDB(email, { approved: true }); };
  const reject = (email) => { deleteEmployeeDB(email); };
  const setRole = (email, role) => { updateEmployeeDB(email, { role }); };

  const handleSave = (data) => {
    const docKey = data.email?.trim() || data.employeeId || `EMP-${Date.now()}`;
    // Normalize: always save as `name` (EmployeeForm uses `fullName`)
    const name = data.fullName?.trim() || data.name?.trim() || "";
    saveEmployeeDB({ ...data, name, approved: true, email: docKey });
    setTimeout(() => { setView("list"); setSelected(null); }, 800);
  };

  // Load existing employee into form — map `name` → `fullName` for EmployeeForm
  const handleEdit = (emp) => { setSelected({ ...emp, fullName: emp.fullName || emp.name || "" }); setView("edit"); };
  const handleProfile = (emp) => { setSelected(emp); setView("profile"); };

  const q = query.toLowerCase();
  const filtered = mergedEmployees.filter(e =>
    !q ||
    (e.name || "").toLowerCase().includes(q) ||
    (e.email || "").toLowerCase().includes(q) ||
    (e.role || "").toLowerCase().includes(q) ||
    (e.employeeId || "").toLowerCase().includes(q) ||
    (e.position || "").toLowerCase().includes(q) ||
    (e.mobile || "").toLowerCase().includes(q)
  );

  const pending = filtered.filter(e => !e.approved);
  const approved = filtered.filter(e => e.approved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {view === "profile" && selected && (
        <Card>
          <EmployeeProfile
            employee={selected}
            onClose={() => { setView("list"); setSelected(null); }}
            onEdit={handleEdit}
          />
        </Card>
      )}

      {(view === "add" || view === "edit") && (
        <Card>
          <p className="emp-eyebrow" style={{ marginBottom: 6 }}>
            {view === "add" ? "Add New Employee" : "Edit Employee"}
          </p>
          <h3 className="emp-section-title" style={{ marginBottom: 16 }}>
            {view === "add" ? "➕ New Employee" : `✏️ ${selected?.name || selected?.fullName}`}
          </h3>
          <EmployeeForm
            initial={selected || {}}
            onSave={handleSave}
            onCancel={() => { setView("list"); setSelected(null); }}
          />
        </Card>
      )}

      {view === "list" && (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p className="emp-eyebrow">Admin Panel</p>
                <h3 className="emp-section-title">👑 Employee Management</h3>
              </div>
              {isSuperAdmin && (
                <button onClick={() => { setSelected(null); setView("add"); }} className="btn-primary" style={{ fontSize: 12, padding: "8px 16px" }}>
                  ➕ Add Employee
                </button>
              )}
            </div>
            <EmployeeSearch query={query} onChange={setQuery} />
            <EmployeeList
              pending={pending}
              approved={approved}
              isSuperAdmin={isSuperAdmin}
              onApprove={approve}
              onReject={reject}
              onSetRole={setRole}
              onProfile={handleProfile}
              onEdit={handleEdit}
            />
          </Card>

          <Card>
            <p className="emp-eyebrow" style={{ marginBottom: 10 }}>Employee Permissions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PERMISSIONS.map(p => (
                <div key={p.action} className="emp-perm-row">
                  <p className="emp-perm-label">{p.action}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.allowed ? "#34d399" : "#fb7185" }}>
                    {p.allowed ? "✓ Allowed" : "✕ Restricted"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
