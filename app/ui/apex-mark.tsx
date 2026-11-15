// Apex logo: two sharp peaks in the warm strata colours, the taller one tipped with gold (the apex),
// paired with an "Apex" wordmark set in the soft serif.
const peaks = [
  { points: "12,24 19,10.5 26,24", fill: "#e08a34" },
  { points: "2,24 11,5 20,24", fill: "#b85a26" },
  { points: "11,5 14.32,12 12.6,10.8 11,12.4 9.4,10.8 7.68,12", fill: "#f4b54f" },
];

export function ApexMark({ size = 28, mono = false }: { size?: number; mono?: boolean }) {
  return <svg className="apex-mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    {peaks.map((peak, i) => <polygon key={peak.points} points={peak.points} fill={mono ? "currentColor" : peak.fill} opacity={mono && i === 0 ? 0.55 : undefined} />)}
  </svg>;
}

export function ApexLogo({ size = 28, label }: { size?: number; label?: string }) {
  return <span className="apex-logo" style={{ "--logo-size": `${size}px` } as React.CSSProperties}>
    <ApexMark size={size} />
    <span className="apex-wordmark">Apex</span>
    {label && <span className="apex-logo-label">{label}</span>}
  </span>;
}
