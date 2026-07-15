import React, { useState, useRef } from "react";

/**
 * Message input + send button.
 * @param {function} onSend - tinatawag na may (text) kapag nag-send
 * @param {boolean}  disabled - true habang naghihintay ng sagot
 */
export default function AIInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKeyDown = (e) => {
    // Enter = send · Shift+Enter = bagong linya
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="ai-input">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => { setText(e.target.value); autoGrow(e.target); }}
        onKeyDown={onKeyDown}
        placeholder="Magtanong…"
        aria-label="Mensahe"
      />
      <button
        className="ai-send"
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="Ipadala"
        title="Ipadala (Enter)"
      >
        ➤
      </button>
    </div>
  );
}
