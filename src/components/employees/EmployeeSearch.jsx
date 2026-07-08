import React from "react";
import "./employee.css";

/**
 * EmployeeSearch — search bar for filtering employees
 * Props: query, onChange
 */
export default function EmployeeSearch({ query, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <input
        className="emp-search-input"
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder="🔍 Search by name, email, or role..."
      />
    </div>
  );
}
