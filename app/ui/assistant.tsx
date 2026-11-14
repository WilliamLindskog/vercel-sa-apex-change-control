"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@/lib/users";
import "./assistant.css";

// A small helper mark: a warm sun with two eyes. Ours, not borrowed from any product.
export function HelperMark({ size = 28 }: { size?: number }) {
  return <svg className="helper-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14" fill="var(--marigold)" />
    <path d="M16 2a14 14 0 0 1 0 28" fill="var(--marigold-deep)" opacity=".35" />
    <circle cx="12" cy="14.5" r="1.9" fill="var(--action)" />
    <circle cx="20" cy="14.5" r="1.9" fill="var(--action)" />
    <path d="M12.5 20q3.5 2.6 7 0" fill="none" stroke="var(--action)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

const starters = (user: User) => [
  "What should I focus on today?",
  "Who is holding things up?",
  user.id === "priya" ? "Check in with Marcus on Binder X-17" : "Check in with Priya on Wax W-210",
];

// Just enough formatting for short answers: bullet lines and **bold**.
function Formatted({ text }: { text: string }) {
  const bold = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((piece, i) => piece.startsWith("**") && piece.endsWith("**") ? <strong key={i}>{piece.slice(2, -2)}</strong> : piece);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{bold(item)}</li>)}</ul>); list = []; };
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (item) list.push(item[1]);
    else { flush(); if (line.trim()) blocks.push(<p key={blocks.length}>{bold(line)}</p>); }
  }
  flush();
  return <>{blocks}</>;
}

type Draft = { ok: true; caseId: string; material: string; to: { id: string; name: string; role: string }; message: string } | { ok: false; error: string };

function DraftCard({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState(false);
  if (!draft.ok) return <p className="as-note">{draft.error}</p>;
  const copy = async () => { try { await navigator.clipboard.writeText(draft.message); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  return <div className="as-draft">
    <div className="as-draft-to"><span className={`avatar tiny tone-${draft.to.id}`} aria-hidden="true" /><span>To <strong>{draft.to.name.split(" ")[0]}</strong> · {draft.material}</span></div>
    <p>{draft.message}</p>
    <div className="as-draft-actions">
      <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy message"}</button>
      <Link className="as-link" href={`/cases/${draft.caseId}`}>Open case</Link>
    </div>
  </div>;
}

export function Assistant({ user, onClose }: { user: User; onClose: () => void }) {
  const { messages, sendMessage, status, error, setMessages } = useChat({ transport: new DefaultChatTransport({ api: "/api/assistant" }) });
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, status]);

  const send = (text: string) => { if (!text.trim() || busy) return; sendMessage({ text }); setInput(""); };

  return <aside className="assistant" aria-label="Assistant">
    <header className="as-head">
      <HelperMark />
      <div><strong>Helper</strong><span>Plans your day, nudges people</span></div>
      {messages.length > 0 && <button className="as-icon" onClick={() => setMessages([])} title="New chat" aria-label="New chat">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      <button className="as-icon" onClick={onClose} aria-label="Close assistant">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </header>

    <div className="as-body" aria-live="polite">
      {messages.length === 0 && <div className="as-empty">
        <p>Hi {user.name.split(" ")[0]}. I can sort your day or draft a check-in.</p>
        <div className="as-starters">{starters(user).map(text => <button key={text} onClick={() => send(text)}>{text}</button>)}</div>
      </div>}

      {messages.map(message => <div key={message.id} className={`as-msg is-${message.role}`}>
        {message.parts.map((part, i) => {
          if (part.type === "text") return message.role === "user" ? <p key={i}>{part.text}</p> : <Formatted key={i} text={part.text} />;
          if (part.type === "tool-getBoard") return <span key={i} className="as-tool">{part.state === "output-available" ? "Checked the board" : "Checking the board…"}</span>;
          if (part.type === "tool-draftCheckIn") return part.state === "output-available" ? <DraftCard key={i} draft={part.output as Draft} /> : <span key={i} className="as-tool">Drafting a check-in…</span>;
          return null;
        })}
      </div>)}

      {status === "submitted" && <div className="as-msg is-assistant"><span className="as-typing" aria-label="Thinking"><i /><i /><i /></span></div>}
      {error && <p className="as-note is-error">Something went wrong. Try again in a moment.</p>}
      <div ref={end} />
    </div>

    <form className="as-input" onSubmit={event => { event.preventDefault(); send(input); }}>
      <input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about your cases…" aria-label="Message" />
      <button className="as-send" disabled={busy || !input.trim()} aria-label="Send">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  </aside>;
}
