"use client";

import { useEffect, useRef, useState } from "react";
import { ApexMark } from "./apex-mark";

const scenes = [
  { label: "News", title: "Made at Apex.", image: 27892708, alt: "Sunlit sandstone cut by deep, branching seams" },
  { label: "History", title: "Since 1828.", image: 40847428, alt: "The Colorado River winding through red canyon walls at sunrise" },
  { label: "Culture", title: "Material knowledge.", image: 31831100, alt: "Fine mineral bands running through fractured stone" },
];

export function MaterialJourney() {
  const track = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = track.current!;
    const layers = Array.from(root.querySelectorAll<HTMLElement>(".plate-image"));
    const stops = Array.from(root.querySelectorAll<HTMLElement>(".chapter-stop"));
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    // Adapted from scroll-world's weighted segments, still-image camera and smooth seam dissolve.
    // The MIT notice is included at /scroll-world/LICENSE. Native anchors also work for deep links.
    function paint() {
      frame = 0;
      const y = window.scrollY;
      const stride = Math.max(1, stops[1].offsetTop - stops[0].offsetTop);
      const position = Math.max(0, Math.min(scenes.length - 1, (y - stops[0].offsetTop) / stride));
      const index = Math.floor(position);
      const part = position - index;
      const isFocusDissolve = index === 0;
      const start = isFocusDissolve ? .27 : .37;
      const blend = Math.min(1, Math.max(0, (part - start) / (1 - start)));
      const eased = blend * blend * (3 - 2 * blend);
      layers.forEach((layer, i) => {
        const entering = i === index + 1;
        layer.style.opacity = String(i === index ? 1 : entering ? eased : 0);
        // Resolve each plate to the same resting crop from either scroll direction.
        const softness = Math.sin(Math.PI * eased);
        const blur = motion.matches ? 0 : softness * (isFocusDissolve ? 3.5 : 1.2);
        layer.style.filter = blur > .02 ? `blur(${blur}px)` : "none";
        const shift = isFocusDissolve ? 0 : (entering ? 1 - eased : -eased) * 2.5;
        const zoom = 1.055 + (isFocusDissolve && !entering ? .045 * eased : 0);
        layer.style.transform = motion.matches ? "none" : `translateX(${shift}%) scale(${zoom})`;

      });
      root.style.setProperty("--caption-opacity", String(Math.min(1, Math.abs(2 * eased - 1) * 1.8)));
      setActive(Math.min(scenes.length - 1, index + Number(eased >= .5)));
    }
    function queue() { if (!frame) frame = requestAnimationFrame(paint); }
    paint();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    motion.addEventListener("change", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      motion.removeEventListener("change", queue);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <main ref={track} className="journey">
    <div className="journey-stage">
      {scenes.map((s,i) => <img className="plate-image" key={s.image} src={`/journal/${s.image}.webp`} alt={s.alt} aria-hidden={active !== i} fetchPriority={i === 0 ? "high" : "auto"} />)}
      <div className="journey-shade"/>
      <header className="journey-header"><a href="#news" className="journey-brand"><ApexMark size={38}/><span className="brand-type">APEX<small>ADDITIVES</small></span></a><a href="/signin" className="journey-login">Log in</a></header>
      <div className="journey-caption"><h1 key={active}>{scenes[active].title}</h1></div>
      <nav aria-label="Chapters" className="journey-nav">{scenes.map((s,i) => <a href={`#${s.label.toLowerCase()}`} key={s.label} aria-current={active === i ? "step" : undefined}>{s.label}</a>)}</nav>
    </div>
    {scenes.map(s => <div key={s.label} className="chapter-stop" id={s.label.toLowerCase()}/>)}
  </main>;
}
