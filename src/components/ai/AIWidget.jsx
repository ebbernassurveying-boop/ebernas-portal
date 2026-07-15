import React, { useEffect, useRef } from "react";
import AIMessage, { AITyping } from "./AIMessage";
import AIInput from "./AIInput";

/**
 * Ang chat window mismo. Presentational lang — ang state ay nasa AIAssistant.
 * @param {array}    messages - [{ id, role, text, ts }]
 * @param {boolean}  loading  - true habang naghihintay ng sagot
 * @param {function} onSend   - (text) => void
 * @param {function} onClose  - () => void
 */
export default function AIWidget({ messages, loading, onSend, onClose }) {
  const bodyRef = useRef(null);

  // Awtomatikong mag-scroll sa pinakabago
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Escape = isara
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ai-widget" role="dialog" aria-label="Bernas AI Assistant">
      <div className="ai-head">
        <div className="ai-head-icon" aria-hidden="true">🤖</div>
        <div className="ai-head-text">
          <p className="ai-head-title">Bernas AI Assistant</p>
          <p className="ai-head-status"><span className="ai-dot" />Online</p>
        </div>
        <button className="ai-x" onClick={onClose} aria-label="Isara ang assistant">✕</button>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {messages.map((m) => <AIMessage key={m.id} message={m} />)}
        {loading && <AITyping />}
      </div>

      <AIInput onSend={onSend} disabled={loading} />
    </div>
  );
}
