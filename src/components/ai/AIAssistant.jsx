import React, { useState, useCallback } from "react";
import AIWidget from "./AIWidget";
import { buildAIContext } from "./aiContext";
import "./ai.css";

/* ──────────────────────────────────────────────────────────────────────────
   Ang tulay papuntang AI. Tumatawag sa /api/ai (Vercel serverless function)
   kung saan naroon ang Anthropic API key — HINDI dito sa browser.

   PHASE 3: Nakakabasa na ng datos ng portal. Sa bawat tanong, tinatawag ang
   buildAIContext() na pumipili LANG ng datos na kailangan ng tanong na iyon
   (hindi lahat ng 775 cases) — mabilis at mura.
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

Nakakabasa na ako ng datos ng portal — cases, schedules, at employees.

Subukan mo:
• "Ano status ni Juan Cruz?"
• "Ilan ang pending?"
• "Sino-sino ang On Process?"
• "May schedule ba bukas?"

Ano'ng maitutulong ko?`;

let seq = 0;
const nextId = () => `m${++seq}`;

/**
 * Floating AI Assistant — button + chat widget.
 * Naka-mount sa buong portal pagkatapos mag-login.
 *
 * @param {object} caseStore   - cases (naka-scope na sa agent kung agent)
 * @param {Array}  schedules   - schedules (naka-scope na rin)
 * @param {Array}  employees   - merged employees + profiles
 * @param {object} currentUser - sino ang naka-login
 */
export default function AIAssistant({
  caseStore = {},
  schedules = [],
  employees = [],
  currentUser = null,
}) {
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

      // Buuin ang konteksto base sa tinanong — dito nangyayari ang pagpili.
      let context = null;
      try {
        context = buildAIContext(text, { caseStore, schedules, employees, currentUser });
      } catch (ctxErr) {
        // Kung pumalya ang context builder, huwag mabasag ang chat —
        // magpatuloy na lang nang walang datos.
        console.error("buildAIContext failed:", ctxErr);
      }

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
  }, [messages, caseStore, schedules, employees, currentUser]);

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
