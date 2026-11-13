import type { Metadata } from "next";
import Link from "next/link";
import { cases } from "@/lib/cases";
import { requireUser } from "@/lib/session";
import { findUser } from "@/lib/users";

export const metadata: Metadata = { title: "Cases" };

export default async function CasesPage() {
  const user = await requireUser();
  const open = cases.filter(item => item.state === "open");
  const greeting = user.role === "Product Change Lead"
    ? "You own 1 open case."
    : `1 open case needs your ${user.role} sign-off.`;

  return <>
    <header className="topbar"><nav className="breadcrumb" aria-label="Breadcrumb"><span aria-current="page">Cases</span></nav><span className="env-badge">Demo data</span></header>
    <main className="page">
      <div className="page-head">
        <h1>Supplier change cases</h1>
        <p>{greeting}</p>
      </div>
      <div className="table-wrap">
        <table className="case-table">
          <thead><tr><th scope="col">Case</th><th scope="col">Supplier</th><th scope="col">Opened</th><th scope="col">Decision due</th><th scope="col">Owner</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {cases.map(item => <tr key={item.id} className={item.state === "closed" ? "is-closed" : undefined}>
              <td>
                {item.state === "open"
                  ? <Link href={`/cases/${item.id}`} className="case-title-link"><strong>{item.title}</strong><span>{item.id}</span></Link>
                  : <span className="case-title-link"><strong>{item.title}</strong><span>{item.id}</span></span>}
              </td>
              <td>{item.supplier}</td>
              <td className="num">{item.opened}</td>
              <td className="num">{item.due}</td>
              <td>{findUser(item.ownerId)?.name}</td>
              <td>{item.state === "open" ? <span className="badge badge-progress">In review</span> : <span className="badge badge-neutral">Closed</span>}<span className="cell-note">{item.outcome}</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="page-footnote">Closed cases are shown for context. Only {open[0].id} is loaded with records in this demo.</p>
    </main>
  </>;
}
