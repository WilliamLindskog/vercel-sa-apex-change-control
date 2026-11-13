// "Built on solid ground": the sign-in visual is a cross-section of rock strata.
// Each layer is one era of Apex, oldest at the bottom. Drawn in code (no image asset),
// so it stays sharp at any size, weighs a few KB and is rendered once on the server.

type Era = { year: string; label: string };

// The viewBox covers only the ground; the sky is the panel background.
const W = 800, H = 1000, TOP = 530;
const fills = ["#e9c48a", "#d9a35a", "#c27f3c", "#9a5b2c", "#6e3f22", "#4a2a18"];

// Deterministic "noise": a few summed sines per layer, so the ground looks natural but renders identically every time.
function surface(base: number, seed: number) {
  const points: string[] = [];
  for (let x = 0; x <= W; x += 20) {
    const y = base
      + Math.sin(x / 140 + seed) * 14
      + Math.sin(x / 57 + seed * 2.3) * 6
      + Math.sin(x / 23 + seed * 4.1) * 2;
    points.push(`${x},${y.toFixed(1)}`);
  }
  return points;
}

export function Strata({ eras }: { eras: Era[] }) {
  // Layers start in the lower half and get thicker with depth, like real sediment.
  const tops = [560, 618, 676, 734, 792, 850];
  const layers = tops.map((top, i) => ({ top, line: surface(top, i * 1.7 + 0.4), fill: fills[i] }));

  return <svg className="strata" viewBox={`0 ${TOP} ${W} ${H - TOP}`} preserveAspectRatio="xMidYMin slice" role="img" aria-label="Rock strata, one layer for each era of Apex Additives since 1828">
    <defs>
      {/* Engraved hatching, as on a 19th-century survey plate */}
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="#2a1a10" strokeWidth="0.8" strokeOpacity=".22" />
      </pattern>
      <pattern id="stipple" width="11" height="11" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r=".9" fill="#2a1a10" fillOpacity=".18" />
        <circle cx="8" cy="8" r=".7" fill="#fff6e6" fillOpacity=".18" />
      </pattern>
    </defs>

    {layers.map((layer, i) => {
      const d = `M0,${H} L${layer.line.join(" L")} L${W},${H} Z`;
      return <g key={i} className="stratum" style={{ animationDelay: `${(layers.length - i) * 90}ms` }}>
        <path d={d} fill={layer.fill} />
        <path d={d} fill={i % 2 ? "url(#hatch)" : "url(#stipple)"} />
        {/* Fine contour inside each layer */}
        <polyline points={surface(layer.top + 26, i * 1.7 + 1.1).join(" ")} fill="none" stroke="#2a1a10" strokeOpacity=".16" strokeWidth="1" />
        <polyline points={layer.line.join(" ")} fill="none" stroke="#fff3df" strokeOpacity={i === 0 ? .55 : .22} strokeWidth={i === 0 ? 1.5 : 1} />
      </g>;
    })}

    {/* A borehole through every layer: the era markers read like a core sample */}
    <line className="era" x1="560" y1={layers[0].top - 30} x2="560" y2={H} stroke="#fff3df" strokeOpacity=".45" strokeDasharray="2 5" />

    {/* Era markers sit on the layer they belong to: newest at the surface */}
    {eras.map((era, i) => {
      const layer = layers[i];
      if (!layer) return null;
      const y = layer.top + 30;
      return <g key={era.year} className="era" style={{ animationDelay: `${600 + i * 80}ms` }}>
        <line x1="560" y1={y - 5} x2="600" y2={y - 5} stroke="#fff3df" strokeOpacity=".7" />
        <circle cx="560" cy={y - 5} r="2.5" fill="#fff3df" />
        <text x="612" y={y} fill={i < 3 ? "#2a1a10" : "#fbead0"} fontSize="15" fontWeight="700" letterSpacing="1">{era.year}</text>
        <text x="612" y={y + 18} fill={i < 3 ? "#3d2817" : "#ecd2ad"} fontSize="12.5" opacity=".9">{era.label}</text>
      </g>;
    })}
  </svg>;
}
