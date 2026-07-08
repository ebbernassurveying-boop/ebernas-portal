import React from "react";
import "./employee.css";

const SUPER_ADMIN = "e.b.bernassurveying@gmail.com";

/**
 * EmployeeProfile — read-only profile view
 * Props: employee, onClose, onEdit
 */
export default function EmployeeProfile({ employee: e, onClose, onEdit }) {
  if (!e) return null;

  const isSuper = e.email === SUPER_ADMIN;
  const roleColor = isSuper ? "#fbbf24" : e.role === "admin" ? "#60a5fa" : "#34d399";
  const roleText = isSuper ? "👑 Super Admin" : e.role === "admin" ? "🛡️ Admin" : "👤 Employee";

  const fields = [
    ["Employee ID", e.employeeId || "—"],
    ["Position", e.position || "—"],
    ["Mobile", e.mobile || "—"],
    ["Email", e.email || "—"],
    ["Address", e.address || "—"],
    ["Date Hired", e.dateHired || "—"],
    ["Status", e.status || "Active"],
    ["Emergency Contact", e.emergencyContact || "—"],
    ["Emergency Number", e.emergencyNumber || "—"],
    ["Registered At", e.registeredAt || "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="emp-eyebrow">Employee Profile</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e8f5ee", margin: "0 0 6px 0" }}>{e.name || e.fullName}</h2>
          <span className="emp-role-badge" style={{ color: roleColor, border: `1px solid ${roleColor}44`, fontSize: 11, padding: "3px 10px" }}>
            {roleText}
          </span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(220,245,230,0.35)", fontSize: 20, fontFamily: "inherit" }}>✕</button>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px 0" }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#e8f5ee", margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Notes */}
      {e.notes && (
        <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px 0" }}>Notes</p>
          <p style={{ fontSize: 13, color: "#e8f5ee", margin: 0, lineHeight: 1.6 }}>{e.notes}</p>
        </div>
      )}

      {onEdit && (
        <button onClick={() => onEdit(e)} className="btn-outline" style={{ padding: "10px 0" }}>
          ✏️ Edit Profile
        </button>
      )}
    </div>
  );
}
