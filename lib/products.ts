import { cacheLife, cacheTag } from "next/cache";
import { apexSession } from "./apex-systems";

export type Product = {
  family: string;            // e.g. FG-420
  name: string;              // e.g. Aeroshield 420 Protective Coating
  line: string;              // product line from SAP's product hierarchy
  markets: { market: string; finishedGood: string; plant: string }[];
  materials: { material: string; name: string }[];
};

// The product registry, read from SAP's product master. Products change rarely and everyone sees the same
// list, so it is cached for hours under the "products" tag (revalidate it when SAP's catalogue changes).
// US and EU variants of a product are one row with two markets.
export async function productRegistry(): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const goods = await apexSession("normal").catalogue();
  const byFamily = new Map<string, Product>();
  for (const g of goods) {
    const family = g.finishedGood.replace(/-(US|EU)$/, "");
    const product = byFamily.get(family) ?? { family, name: g.product, line: g.line, markets: [], materials: [] };
    product.markets.push({ market: g.market, finishedGood: g.finishedGood, plant: g.plant });
    for (const c of g.components) if (!product.materials.some(m => m.material === c.material)) product.materials.push(c);
    byFamily.set(family, product);
  }
  return [...byFamily.values()].sort((a, b) => a.line.localeCompare(b.line) || a.family.localeCompare(b.family));
}
