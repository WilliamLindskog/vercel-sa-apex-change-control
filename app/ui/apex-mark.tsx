// Apex logo: a peak built from three layers of warm strata (the "solid ground" the company stands on),
// paired with an "Apex" wordmark set in the soft serif.
const bands = [
  { points: "14,3 17.45,9.3 10.55,9.3", fill: "#f4b54f" },
  { points: "9.78,10.7 18.22,10.7 21.28,16.3 6.72,16.3", fill: "#e08a34" },
  { points: "5.95,17.7 22.05,17.7 25.5,24 2.5,24", fill: "#b85a26" },
];

export function ApexMark({ size = 28, mono = false }: { size?: number; mono?: boolean }) {
  return <svg className="apex-mark" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    {bands.map(band => <polygon key={band.points} points={band.points} fill={mono ? "currentColor" : band.fill} stroke={mono ? "currentColor" : band.fill} strokeWidth="1.4" strokeLinejoin="round" />)}
  </svg>;
}

export function ApexLogo({ size = 28, label }: { size?: number; label?: string }) {
  return <span className="apex-logo" style={{ "--logo-size": `${size}px` } as React.CSSProperties}>
    <ApexMark size={size} />
    <span className="apex-wordmark">Apex</span>
    {label && <span className="apex-logo-label">{label}</span>}
  </span>;
}
