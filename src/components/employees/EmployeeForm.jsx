import React, { useState } from "react";
import "./employee.css";

const EMPTY_FORM = {
  employeeId: "", fullName: "", position: "", mobile: "",
  email: "", address: "", dateHired: "", status: "Active",
  emergencyContact: "", emergencyNumber: "", notes: "", telegramChatId: "",
};

const REQUIRED = ["fullName", "position", "mobile"];

export default function EmployeeForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: false }));
  };

  const handleSave = () => {
    const newErrors = {};
    REQUIRED.forEach(k => { if (!form[k]?.trim()) newErrors[k] = true; });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    const id = form.employeeId.trim() || `EMP-${Date.now()}`;
    onSave({ ...form, employeeId: id });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields = [
    { label: "Employee ID", key: "employeeId", placeholder: "Auto-generated if blank" },
    { label: "Full Name", key: "fullName", placeholder: "e.g. Juan Dela Cruz", required: true },
    { label: "Position", key: "position", placeholder: "e.g. Surveyor", required: true },
    { label: "Mobile Number", key: "mobile", placeholder: "e.g. 09xxxxxxxxx", required: true },
    { label: "Email (optional)", key: "email", placeholder: "e.g. juan@email.com" },
    { label: "Address (optional)", key: "address", placeholder: "Barangay, Municipality, Province" },
    { label: "Date Hired (optional)", key: "dateHired", type: "date" },
    { label: "Emergency Contact (optional)", key: "emergencyContact", placeholder: "Name of emergency contact" },
    { label: "Emergency Number (optional)", key: "emergencyNumber", placeholder: "09xxxxxxxxx" },
    { label: "📲 Telegram Chat ID (optional)", key: "telegramChatId", placeholder: "e.g. 7047009376" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 11, color: "rgba(220,245,230,0.4)", margin: 0 }}>
        Fields marked with <span style={{ color: "#fb7185" }}>*</span> are required
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {fields.map(f => (
          <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: errors[f.key] ? "#fb7185" : "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {f.label}{f.required && <span style={{ color: "#fb7185" }}> *</span>}
            </label>
            <input type={f.type || "text"} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder || ""}
              style={{ background: "rgba(0,0,0,0.2)", border: errors[f.key] ? "1.5px solid #fb7185" : "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }} />
            {errors[f.key] && <p style={{ fontSize: 10, color: "#fb7185", margin: 0 }}>⚠️ Required</p>}
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Status</label>
          <select value={form.status} onChange={e => set("status", e.target.value)}
            style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none" }}>
            <option>Active</option><option>Inactive</option><option>On Leave</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,245,230,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</label>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Additional notes..." rows={3}
          style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#e8f5ee", fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      </div>
      {saved && (
        <div style={{ borderRadius: 12, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "10px 14px", fontSize: 13, color: "#34d399", fontWeight: 600 }}>
          ✅ Employee saved successfully!
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={handleSave} className="btn-primary" style={{ flex: 1, padding: "11px 0" }}>
          💾 Save Employee
        </button>
        <button onClick={onCancel} className="btn-outline" style={{ flex: 1, padding: "11px 0" }}>Cancel</button>
      </div>
    </div>
  );
}
