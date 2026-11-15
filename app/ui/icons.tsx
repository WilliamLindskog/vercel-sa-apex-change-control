// Small line icons drawn in one consistent stroke, so the app needs no icon library.
const base = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const BoardIcon = () => <svg {...base}><rect x="2.5" y="3.5" width="4.5" height="13" rx="1.5" /><rect x="8.75" y="3.5" width="4.5" height="9" rx="1.5" /><rect x="15" y="3.5" width="2.5" height="6" rx="1.25" /></svg>;
export const CaseIcon = () => <svg {...base}><path d="M5 2.5h7l3.5 3.5v11.5H5z" /><path d="M12 2.5V6h3.5" /><path d="M7.5 10.5h5M7.5 13.5h3.5" /></svg>;
export const BriefIcon = () => <svg {...base}><path d="M4 3.5h12v13H4z" /><path d="M7 7h6M7 10h6M7 13h3.5" /></svg>;
export const ChevronIcon = ({ direction = "left" }: { direction?: "left" | "right" }) => <svg {...base} style={{ transform: direction === "right" ? "rotate(180deg)" : undefined }}><path d="M12 5l-5 5 5 5" /></svg>;
export const CalendarIcon = () => <svg {...base}><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2.5v3M13 2.5v3M6.5 11.5h4M8.5 14h5" /></svg>;
export const ChartIcon = () => <svg {...base}><path d="M3 16.5h14" /><path d="M5.5 13.5v-4M10 13.5V5M14.5 13.5V8.5" /></svg>;
export const BoxIcon = () => <svg {...base}><path d="M3.5 6.5 10 3l6.5 3.5v7L10 17l-6.5-3.5z" /><path d="M3.5 6.5 10 10l6.5-3.5M10 10v7" /></svg>;
export const PlugIcon = () => <svg {...base}><path d="M7 3v4M13 3v4" /><path d="M5 7h10v3a5 5 0 0 1-10 0z" /><path d="M10 15v2.5" /></svg>;
