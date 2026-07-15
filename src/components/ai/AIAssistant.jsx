import React, { useState, useCallback } from "react";
import AIWidget from "./AIWidget";
import "./ai.css";

/* ──────────────────────────────────────────────────────────────────────────
   PHASE 2 SEAM — ito LANG ang palitan kapag ikinabit na ang tunay na AI.
   Walang ibang file ang kailangang baguhin.

   Ang `context` ay para sa hinaharap: doon ipapasa ang datos ng portal
   (schedules, cases, employees, finance) na mababasa ng AI. Optional muna.

   Halimbawa ng magiging laman balang-araw:
     const res = await fetch("/api/ai", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ text, history, context }),
     });
     const data = await res.json();
     return { text: data.reply };
   ────────────────────────────────────────────────────────────────────────── */
async function sendToAI(text, history, context) {  // eslint-disable-line no-unused-vars
  await new Promise((r) => setTimeout(r, 650)); // maikling pause para makita ang typing indicator
  return {
    text: "AI integration is not yet connected.\nThis is only a UI foundation.",
  };
}

const now = () =>
  new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

const WELCOME = `Hello Engr. Bernas!
I'm your AI Assistant.

Soon I'll be able to help you with:
• Schedules
• Survey Cases
• Employees
• Finance
• Reports
• Analytics

How can I help you today?`;

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
        text: "Hindi naabot ang assistant. Subukan ulit.",
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
