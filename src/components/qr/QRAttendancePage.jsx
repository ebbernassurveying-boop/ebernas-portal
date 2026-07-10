import React, { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";

// ── CDN LOADERS ───────────────────────────────────────────────────────────────
// Iniiwasan ang npm install — iniload ang libraries mula sa CDN.
function loadScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) return resolve(window[globalName]);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window[globalName]));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(window[globalName]);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

const QRCODE_CDN = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
const HTML5QR_CDN = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

// Petsa ngayon sa Manila time (YYYY-MM-DD)
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// Doc ID na katulad ng ginagawa ng portal + receiver
function attDocId(employeeId, date) {
  const safe = String(employeeId).replace(/[^a-zA-Z0-9]/g, "_");
  return `ATT-${safe}-${date}`;
}

// ── QR CODE RENDERER (isang QR) ───────────────────────────────────────────────
function QRBox({ value, size = 128 }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadScript(QRCODE_CDN, "QRCode").then((QRCodeLib) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = "";
      // eslint-disable-next-line no-new
      new QRCodeLib(ref.current, {
        text: String(value),
        width: size,
        height: size,
        correctLevel: QRCodeLib.CorrectLevel.H,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [value, size]);
  return <div ref={ref} style={{ display: "inline-block", background: "#fff", padding: 8, borderRadius: 8 }} />;
}

// ── QR GENERATOR (lahat ng empleyado) ─────────────────────────────────────────
function GeneratorSection({ employees }) {
  const withId = employees.filter((e) => String(e.deviceId ?? "").trim() !== "");
  const withoutId = employees.filter((e) => String(e.deviceId ?? "").trim() === "");

  const printCards = () => window.print();

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: "rgba(220,245,230,0.6)", marginBottom: 10, lineHeight: 1.5 }}>
          Bawat empleyadong may <b>Device ID</b> ay may QR code dito. I-print o i-screenshot,
          tapos gawing ID card. Kapag na-scan sa QR Attendance, awto nang mag-PRESENT sa portal.
        </p>
        <button onClick={printCards} className="btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>
          🖨️ Print / Save ID Cards
        </button>
      </div>

      {withoutId.length > 0 && (
        <div className="no-print" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", marginBottom: 14, fontSize: 12, color: "#fbbf24" }}>
          ⚠️ {withoutId.length} empleyado ang walang Device ID pa: {withoutId.map((e) => e.name || e.fullName || e.email).join(", ")}.
          Lagyan sila ng Device ID sa Admin Panel → Employee → para magkaroon ng QR.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {withId.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(220,245,230,0.3)" }}>Walang empleyadong may Device ID pa.</p>
        ) : (
          withId.map((e) => (
            <div key={e.email || e.id} className="qr-card" style={{ width: 180, textAlign: "center", padding: 14, borderRadius: 14, background: "#fff", border: "1px solid #ddd" }}>
              <QRBox value={String(e.deviceId).trim()} size={128} />
              <p style={{ fontSize: 13, fontWeight: 800, color: "#111", marginTop: 8, marginBottom: 2 }}>{e.name || e.fullName || "—"}</p>
              <p style={{ fontSize: 11, color: "#555" }}>{e.position || "Employee"}</p>
              <p style={{ fontSize: 10, color: "#999", marginTop: 2 }}>ID: {String(e.deviceId).trim()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── QR SCANNER (camera) ───────────────────────────────────────────────────────
function ScannerSection({ employees }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }
  const [recent, setRecent] = useState([]);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ id: "", at: 0 });
  const regionId = "qr-reader-region";

  // deviceId -> employee
  const empByDevice = {};
  employees.forEach((e) => {
    const d = String(e.deviceId ?? "").trim().replace(/^0+/, "");
    if (d) empByDevice[d] = e;
  });

  const recordPresent = async (rawValue) => {
    const key = String(rawValue).trim().replace(/^0+/, "");
    const emp = empByDevice[key];
    if (!emp) {
      setStatus({ ok: false, msg: `Device ID "${key}" — walang katugmang empleyado.` });
      return;
    }
    const employeeId = emp.email || emp.id;
    const date = todayStr();
    const id = attDocId(employeeId, date);
    try {
      await setDoc(doc(db, "fin_attendance", id), {
        id, employeeId, date, present: true, half: false,
        source: "qr", deviceUserId: key, updatedAt: new Date().toISOString(),
      }, { merge: true });
      const name = emp.name || emp.fullName || employeeId;
      setStatus({ ok: true, msg: `✅ ${name} — PRESENT @ ${date}` });
      setRecent((r) => [{ name, at: new Date().toLocaleTimeString("en-PH") }, ...r].slice(0, 8));
    } catch (err) {
      setStatus({ ok: false, msg: "Firebase error: " + (err?.message || "hindi nai-save") });
    }
  };

  const onScanSuccess = (decodedText) => {
    const now = Date.now();
    // debounce: iwasan ang doble-scan ng parehong QR sa loob ng 3 segundo
    if (lastScanRef.current.id === decodedText && now - lastScanRef.current.at < 3000) return;
    lastScanRef.current = { id: decodedText, at: now };
    recordPresent(decodedText);
  };

  const startScan = async () => {
    setStatus(null);
    try {
      await loadScript(HTML5QR_CDN, "Html5Qrcode");
      const Html5Qrcode = window.Html5Qrcode;
      if (!Html5Qrcode) { setStatus({ ok: false, msg: "Hindi ma-load ang scanner library." }); return; }
      setScanning(true);
      // maikling delay para ma-render ang region div
      setTimeout(async () => {
        try {
          const scanner = new Html5Qrcode(regionId);
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            onScanSuccess,
            () => {} // ignore per-frame errors
          );
        } catch (err) {
          setScanning(false);
          setStatus({ ok: false, msg: "Hindi mabuksan ang camera: " + (err?.message || err) });
        }
      }, 200);
    } catch {
      setStatus({ ok: false, msg: "Hindi ma-load ang scanner library (check internet)." });
    }
  };

  const stopScan = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try { await scanner.stop(); await scanner.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { // cleanup sa unmount
    const scanner = scannerRef.current;
    if (scanner) { scanner.stop().then(() => scanner.clear()).catch(() => {}); }
  }, []);

  return (
    <div className="no-print">
      <p style={{ fontSize: 13, color: "rgba(220,245,230,0.6)", marginBottom: 12, lineHeight: 1.5 }}>
        Buksan ang camera, tapos i-scan ang QR ng empleyado. Awto nang mag-PRESENT sa portal.
        Gumagana sa cellphone (office o field) basta may internet.
      </p>

      {!scanning ? (
        <button onClick={startScan} className="btn-primary" style={{ padding: "11px 22px", fontSize: 14 }}>
          📷 Buksan ang Camera
        </button>
      ) : (
        <button onClick={stopScan} className="btn-outline" style={{ padding: "11px 22px", fontSize: 14 }}>
          ⏹️ Itigil ang Scan
        </button>
      )}

      {scanning && (
        <div style={{ marginTop: 14, maxWidth: 360 }}>
          <div id={regionId} style={{ width: "100%", borderRadius: 14, overflow: "hidden" }} />
        </div>
      )}

      {status && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700,
          background: status.ok ? "rgba(52,211,153,0.1)" : "rgba(251,113,133,0.1)",
          border: `1px solid ${status.ok ? "rgba(52,211,153,0.3)" : "rgba(251,113,133,0.3)"}`,
          color: status.ok ? "#34d399" : "#fb7185" }}>
          {status.msg}
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Na-scan ngayon
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: "#e8f5ee" }}>{r.name}</span>
                <span style={{ color: "rgba(220,245,230,0.4)" }}>{r.at}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function QRAttendancePage({ globalEmployees = [], isAdmin }) {
  const [tab, setTab] = useState("scan"); // scan | generate
  const employees = globalEmployees.filter((e) => e.approved);

  if (!isAdmin) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "rgba(220,245,230,0.5)", fontSize: 14 }}>
        👀 Admin lang ang may access sa QR Attendance.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-print-area, .qr-print-area * { visibility: visible; }
          .qr-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; margin: 8px; }
        }
      `}</style>

      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,245,230,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Attendance</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e8f5ee", margin: "2px 0 0" }}>📷 QR Attendance</h2>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("scan")} className={tab === "scan" ? "btn-primary" : "btn-outline"} style={{ padding: "8px 16px", fontSize: 13 }}>
          📷 Scan Attendance
        </button>
        <button onClick={() => setTab("generate")} className={tab === "generate" ? "btn-primary" : "btn-outline"} style={{ padding: "8px 16px", fontSize: 13 }}>
          🏷️ QR ID Cards
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
        {tab === "scan" && <ScannerSection employees={employees} />}
        {tab === "generate" && (
          <div className="qr-print-area">
            <GeneratorSection employees={employees} />
          </div>
        )}
      </div>
    </div>
  );
}
