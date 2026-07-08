import React from "react";
import "./employee.css";

const SUPER_ADMIN = "e.b.bernassurveying@gmail.com";

function roleLabel(e) {
  if (e.email === SUPER_ADMIN) return { label: "👑 Super Admin", color: "#fbbf24" };
  if (e.role === "admin") return { label: "🛡️ Admin", color: "#60a5fa" };
  return { label: "👤 Employee", color: "rgba(220,245,230,0.4)" };
}

/**
 * EmployeeList — shows pending and approved employee lists
 * Props: pending, approved, isSuperAdmin, onApprove, onReject, onSetRole
 */
export default function EmployeeList({ pending, approved, isSuperAdmin, onApprove, onReject, onSetRole, onEdit }) {
  return (
    <div>
      {/* ── Pending Approvals ── */}
      <div style={{ marginBottom: 24 }}>
        <p className="emp-section-label" style={{ color: "#fb7185" }}>
          ⏳ Pending Approval ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", padding: "12px 0" }}>
            No pending registrations.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(e => (
              <div key={e.email} className="emp-row emp-row-pending">
                <div>
                  <p className="emp-name">{e.name || e.fullName || e.email || e.employeeId || "—"}</p>
                  <p className="emp-meta">📧 {e.email || e.employeeId} · Registered: {e.registeredAt || "—"}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onApprove(e.email)}
                    className="btn-primary"
                    style={{ fontSize: 11, padding: "6px 14px" }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => onReject(e.email)}
                    className="btn-danger"
                    style={{ fontSize: 11, padding: "6px 12px" }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Approved Employees ── */}
      <div>
        <p className="emp-section-label" style={{ color: "#34d399" }}>
          ✅ Approved Employees ({approved.length})
        </p>
        {approved.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)", padding: "12px 0" }}>
            No approved employees yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {approved.map(e => {
              const rl = roleLabel(e);
              const isMe = e.email === SUPER_ADMIN;
              return (
                <div key={e.email} className="emp-row emp-row-approved">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <p className="emp-name">{e.name || e.fullName || e.email || e.employeeId || "—"}</p>
                      <span
                        className="emp-role-badge"
                        style={{ color: rl.color, border: `1px solid ${rl.color}44` }}
                      >
                        {rl.label}
                      </span>
                    </div>
                    <p className="emp-meta">📧 {e.email}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {isSuperAdmin && !isMe && (
                      <select
                        className="emp-role-select"
                        value={e.role || "employee"}
                        onChange={ev => onSetRole(e.email, ev.target.value)}
                      >
                        <option value="employee">👤 Employee</option>
                        <option value="admin">🛡️ Admin</option>
                      </select>
                    )}
                    {isSuperAdmin && onEdit && (
                      <button onClick={() => onEdit(e)} className="btn-outline" style={{ fontSize: 11, padding: "6px 12px" }}>
                        ✏️ Edit
                      </button>
                    )}
                    {!isMe && (
                      <button onClick={() => onReject(e.email)} className="btn-danger" style={{ fontSize: 11, padding: "6px 12px" }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
