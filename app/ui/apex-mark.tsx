// Apex logomark: a stylised apex over a baseline, drawn in the current text colour.
export function ApexMark({ size = 28 }: { size?: number }) {
  return <svg className="apex-mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="9" fill="currentColor" />
    <path d="M7 20.5 14 7l7 13.5" fill="none" stroke="var(--mark-ink, #fff)" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M10.2 16h7.6" stroke="var(--mark-ink, #fff)" strokeWidth="2.4" />
  </svg>;
}
