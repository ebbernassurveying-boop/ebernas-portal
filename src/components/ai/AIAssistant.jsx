import React, { useState, useCallback } from "react";
import AIWidget from "./AIWidget";
import "./ai.css";

/* ──────────────────────────────────────────────────────────────────────────
   Ang tulay papuntang AI. Tumatawag sa /api/ai (Vercel serverless function)
   kung saan naroon ang Gemini API key — HINDI dito sa browser.

   Ang `context` ay para sa Phase 3: doon ipapasa ang datos ng portal
   (schedules, cases, employees, finance) na mababasa ng AI.
   ────────────────────────────────────────────────────────────────────────── */
async function sendToAI(text, history, context) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, history, context }),
  });

  let data = {};
  try { data = await res.json(); } catch { /* walang JSON body */ }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return { text: data.reply || "Walang naibalik na sagot." };
}

const now = () =>
  new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

const WELCOME = `Hello Engr. Bernas!
I'm your AI Assistant.

Makakausap mo na ako ngayon — magtanong ka lang.

Isang paalala: hindi ko pa nababasa ang datos ng portal (schedules, cases,
employees, finance). Susunod na phase iyon. Sa ngayon, hindi ko masasagot
ang mga tanong tungkol sa aktwal na laman ng portal.

Ano'ng maitutulong ko?`;

let seq = 0;
const nextId = () => `m${++seq}`;

/**
 * Floating AI Assistant — button + chat widget.
 * Naka-mount sa buong portal pagkatapos mag-login.
 *
 * @param {object} context - (optional, para sa Phase 2) datos ng portal na
 *                           mababasa ng AI. Walang epekto sa ngayon.
 */
export default function AIAssistant({ context }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: nextId(), role: "ai", text: WELCOME, ts: now() },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async (text) => {
    const userMsg = { id: nextId(), role: "user", text, ts: now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg];
      const res = await sendToAI(text, history, context);
      setMessages((prev) => [...prev, { id: nextId(), role: "ai", text: res.text, ts: now() }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: nextId(),
        role: "ai",
        text: `⚠️ ${e.message || "Hindi naabot ang assistant."}`,
        ts: now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, context]);

  return (
    <div className="ai-root">
      {isOpen && (
        <AIWidget
          messages={messages}
          loading={loading}
          onSend={handleSend}
          onClose={() => setIsOpen(false)}
        />
      )}
      <button
        className={`ai-fab ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Isara ang AI Assistant" : "Buksan ang AI Assistant"}
        aria-expanded={isOpen}
        title="Bernas AI Assistant"
      >
        {isOpen ? "✕" : "🤖"}
      </button>
    </div>
  );
}
