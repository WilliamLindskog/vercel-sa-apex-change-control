// What each raw material does and what each final product is, in plain words, so a reader who isn't a chemist
// can follow a case. In production this text comes from Apex's product catalogue (or SAP's long texts);
// here it sits next to the demo data. Keyed by SAP material number and by product family (FG-420, not FG-420-US).

export const materialPlain: Record<string, string> = {
  "MAT-000417": "stops the steel underneath from rusting",
  "MAT-000615": "gives inks their blue colour",
  "MAT-000502": "makes ink stick to plastic film",
  "MAT-000312": "a mineral that makes plastic parts stiffer",
  "MAT-000508": "stops plastic film sticking to itself",
  "MAT-000505": "protects plastic from sun damage",
  "MAT-000210": "gives wood finish a smooth, scratch-resistant feel",
  "MAT-000309": "takes the shine off for a matt look",
  "MAT-000683": "gives inks their yellow colour",
  "MAT-000404": "keeps pigment evenly mixed in paint",
  "MAT-000112": "stops plastic breaking down when heated",
};

export const productPlain: Record<string, string> = {
  "FG-420": "Anti-rust coating for steel bridges and tanks",
  "FG-088": "Additive for rust-proof packaging film",
  "FG-710": "Blue ink for food packaging",
  "FG-725": "Ink for printed brochures",
  "FG-730": "Ink for laminated snack bags",
  "FG-150": "Pellets that make plastic parts stiffer",
  "FG-160": "Lets plastic bags open smoothly",
  "FG-170": "Sun protection for garden furniture",
  "FG-175": "Long-life sun protection for outdoor plastics",
  "FG-440": "Satin finish for wooden floors and furniture",
  "FG-450": "Matt clear coat for kitchen cabinets",
  "FG-720": "Yellow ink for cartons",
  "FG-430": "Tough paint for machines and tractors",
  "FG-190": "Keeps plastic pipes stable while they are made",
};

const family = (finishedGood: string) => finishedGood.split("-").slice(0, 2).join("-");
export const whatMaterialDoes = (material: string) => materialPlain[material];
export const whatProductIs = (finishedGoodOrFamily: string) => productPlain[family(finishedGoodOrFamily)];
