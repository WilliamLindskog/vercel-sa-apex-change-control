import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoScenario } from "@/app/ui/demo-scenario";
import { boardCards } from "@/lib/board";
import { supplierChanges } from "@/lib/case";
import { productRegistry } from "@/lib/products";
import { requireUser } from "@/lib/session";
import "./products.css";

export const metadata: Metadata = { title: "Products" };

// Every product Apex sells, by product line, read from SAP's product master (cached). Each row shows
// where it is sold, what goes into it, and any supplier-change case that touches it (live stage).
export default function ProductsPage() {
  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Products</span></nav><DemoScenario /></header>
    <main className="page pr">
      <Suspense fallback={<div className="pr-skeleton sk-block" />}><Registry /></Suspense>
    </main>
  </>;
}

async function Registry() {
  await requireUser();
  const [products, cards] = await Promise.all([productRegistry(), boardCards()]);
  const stageOf = new Map(cards.map(card => [card.id, card.stage]));
  const casesFor = (finishedGoods: string[]) => supplierChanges.filter(change => change.candidates.some(id => finishedGoods.includes(id)));
  const lines = [...new Set(products.map(p => p.line))];

  return <>
    <header className="pr-head">
      <h1>Products</h1>
      <p>{products.length} products in {lines.length} lines | from SAP</p>
    </header>

    {lines.map(line => {
      const rows = products.filter(p => p.line === line);
      return <section key={line} className="pr-line" aria-labelledby={`line-${line}`}>
        <h2 id={`line-${line}`}>{line}<span>{rows.length}</span></h2>
        <div className="pr-table" role="table" aria-label={`${line} products`}>
          <div className="pr-row is-head" role="row"><span role="columnheader">Product</span><span role="columnheader">Markets</span><span role="columnheader">Key materials</span><span role="columnheader">Changes</span></div>
          {rows.map(product => {
            const cases = casesFor(product.markets.map(m => m.finishedGood));
            return <div key={product.family} className="pr-row" role="row">
              <span role="cell" className="pr-name"><strong>{product.name}</strong><code>{product.family}</code></span>
              <span role="cell" className="pr-markets">{product.markets.map(m => <em key={m.market} title={`${m.finishedGood}, plant ${m.plant}`}>{m.market}</em>)}</span>
              <span role="cell" className="pr-materials">{product.materials.map(m => m.name).join(", ")}</span>
              <span role="cell" className="pr-cases">
                {cases.length === 0 ? <span className="pr-none">None</span> : cases.map(change => {
                  const done = stageOf.get(change.id) === "done";
                  return <Link key={change.id} href={`/cases/${change.id}`} className={`pr-case ${done ? "is-done" : ""}`} title={`${change.title}${done ? " (done)" : ""}`}>{change.materialName}</Link>;
                })}
              </span>
            </div>;
          })}
        </div>
      </section>;
    })}
  </>;
}
