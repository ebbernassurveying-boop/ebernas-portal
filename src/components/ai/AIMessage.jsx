import React from "react";

/**
 * Isang message bubble.
 * @param {object} message - { id, role: "ai" | "user", text, ts }
 */
export default function AIMessage({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`ai-msg ${isUser ? "ai-msg--user" : "ai-msg--ai"}`}>
      {message.text}
      {message.ts && <span className="ai-msg-time">{message.ts}</span>}
    </div>
  );
}

/** Typing indicator — ipinapakita habang naghihintay ng sagot. */
export function AITyping() {
  return (
    <div className="ai-typing" aria-label="Nagta-type…">
      <span /><span /><span />
    </div>
  );
}
