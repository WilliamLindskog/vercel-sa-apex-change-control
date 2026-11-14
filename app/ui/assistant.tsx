"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@/lib/users";
import "./assistant.css";

// Helper's avatar: a small monkey. It bobs, blinks and wiggles its ears; while thinking it tilts its head and looks around.
// Drawn here, not borrowed from any product. Motion is off for people who ask for reduced motion.
export function HelperAvatar({ size = 32, thinking = false }: { size?: number; thinking?: boolean }) {
  return <svg className={`helper-avatar ${thinking ? "is-thinking" : ""}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <g className="ha-body">
      <g className="ha-ear is-left"><circle cx="8.5" cy="24" r="6.2" fill="#9a6440" /><circle cx="8.5" cy="24" r="3.6" fill="#f4c9a2" /></g>
      <g className="ha-ear is-right"><circle cx="39.5" cy="24" r="6.2" fill="#9a6440" /><circle cx="39.5" cy="24" r="3.6" fill="#f4c9a2" /></g>
      <circle cx="24" cy="23" r="15.5" fill="#9a6440" />
      <path d="M21 8.2q3-3.4 5.6-.4q-2.4-.6-3 1.6z" fill="#7d4e31" />
      <ellipse cx="20" cy="19" rx="6.6" ry="7" fill="#f6d8b6" />
      <ellipse cx="28" cy="19" rx="6.6" ry="7" fill="#f6d8b6" />
      <ellipse cx="24" cy="29" rx="10.5" ry="8" fill="#f6d8b6" />
      <g className="ha-eyes">
        <ellipse cx="20" cy="20.5" rx="2.3" ry="2.9" fill="#3b2a20" />
        <ellipse cx="28" cy="20.5" rx="2.3" ry="2.9" fill="#3b2a20" />
        <circle cx="20.8" cy="19.4" r=".9" fill="#fff" />
        <circle cx="28.8" cy="19.4" r=".9" fill="#fff" />
      </g>
      <circle cx="14.6" cy="27" r="2.2" fill="#ec8f7a" opacity=".5" />
      <circle cx="33.4" cy="27" r="2.2" fill="#ec8f7a" opacity=".5" />
      <circle cx="22.6" cy="26.4" r=".8" fill="#7d4e31" />
      <circle cx="25.4" cy="26.4" r=".8" fill="#7d4e31" />
      <path className="ha-mouth" d="M20.5 30q3.5 3.2 7 0" fill="none" stroke="#7d4e31" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  </svg>;
}

const starters = (user: User) => [
  "What should I focus on today?",
  "Who is holding things up?",
  user.id === "priya" ? "Check in with Marcus on Binder X-17" : "Check in with Priya on Wax W-210",
  "Draft a Q4 report for Coatings",
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

type Report = { ok: true; title: string; period: string; line?: string; summary: string; highlights: string[]; watch: string[] };

// A report the user can paste into an email or a deck, plus a link to the same numbers on the Analytics page.
function ReportCard({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  const text = [report.title, "", report.summary, "", ...report.highlights.map(h => `• ${h}`), ...(report.watch.length ? ["", "To watch:", ...report.watch.map(w => `• ${w}`)] : [])].join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  return <div className="as-draft as-report">
    <strong className="as-report-title">{report.title}</strong>
    <p>{report.summary}</p>
    <ul>{report.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
    {report.watch.length > 0 && <><span className="as-report-sub">To watch</span><ul>{report.watch.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
    <div className="as-draft-actions">
      <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy report"}</button>
      <Link className="as-link" href={`/analytics?period=${report.period}${report.line ? `&line=${report.line}` : ""}`}>Open analytics</Link>
    </div>
  </div>;
}

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

export function Assistant({ user, open, onToggle }: { user: User; open: boolean; onToggle: () => void }) {
  const { messages, sendMessage, status, error, setMessages } = useChat({ transport: new DefaultChatTransport({ api: "/api/assistant" }) });
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, status]);

  const send = (text: string) => { if (!text.trim() || busy) return; sendMessage({ text }); setInput(""); };

  // A chat window that opens above the page from a round button in the lower right. The chat stays in memory when closed.
  const launcher = <button className={`as-launcher ${open ? "is-open" : ""}`} onClick={onToggle} aria-label={open ? "Close Helper" : "Open Helper"} aria-expanded={open} aria-controls="helper-window">
    <HelperAvatar size={44} thinking={busy} />
    {!open && messages.length > 0 && <i className="as-dot" aria-hidden="true" />}
  </button>;
  if (!open) return launcher;

  return <>{launcher}<section className="assistant" id="helper-window" role="dialog" aria-label="Helper">
    <header className="as-head">
      <HelperAvatar size={34} thinking={busy} />
      <div><strong>Helper</strong><span>Plans your day, nudges people</span></div>
      {messages.length > 0 && <button className="as-icon" onClick={() => setMessages([])} title="New chat" aria-label="New chat">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>}
      <button className="as-icon" onClick={onToggle} aria-label="Minimise Helper">
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </header>

    <div className="as-body" aria-live="polite">
      {messages.length === 0 && <div className="as-empty">
        <HelperAvatar size={60} />
        <p>Hi {user.name.split(" ")[0]}. I can sort your day, draft a check-in or write a report.</p>
        <div className="as-starters">{starters(user).map(text => <button key={text} onClick={() => send(text)}>{text}</button>)}</div>
      </div>}

      {messages.map(message => <div key={message.id} className={`as-msg is-${message.role}`}>
        {message.parts.map((part, i) => {
          if (part.type === "text") return message.role === "user" ? <p key={i}>{part.text}</p> : <Formatted key={i} text={part.text} />;
          if (part.type === "tool-getBoard") return <span key={i} className="as-tool">{part.state === "output-available" ? "Checked the board" : "Checking the board…"}</span>;
          if (part.type === "tool-getAnalytics") return <span key={i} className="as-tool">{part.state === "output-available" ? "Checked analytics" : "Checking analytics…"}</span>;
          if (part.type === "tool-draftReport") return part.state === "output-available" ? <ReportCard key={i} report={part.output as Report} /> : <span key={i} className="as-tool">Drafting a report…</span>;
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
  </section></>;
}
