import { z } from "zod";

// Client for the systems Apex keeps: SAP (ERP), Veeva Vault (QMS) and the regulatory compliance service.
// This is the boundary. The app only reads across it, and every record it reads becomes a citable source.
// In production the same calls go through Apex's API gateway over Vercel Secure Compute (static egress IPs,
// VPC peering); here they go to a mock deployed as its own Vercel project.

export type Scenario = "normal" | "missing-eu-qualification" | "qms-outage";
export type SystemName = "ERP" | "QMS" | "Regulatory";

export type SourceRecord = { id: string; system: SystemName | "Supplier notice"; title: string; detail: string };
export type SystemCall = { system: SystemName; endpoint: string; status: number; ms: number };

export class ApexSystemError extends Error {
  constructor(public system: SystemName, public status: number, message: string) { super(message); }
}

// Local development falls back to the mock on localhost with its dev token. A deployed environment must be
// configured explicitly, so a missing variable fails loudly instead of quietly using a known dev credential.
function connection() {
  const url = process.env.APEX_SYSTEMS_URL;
  const token = process.env.APEX_SYSTEMS_TOKEN;
  if (url && token) return { url, token };
  if (process.env.VERCEL_ENV) throw new Error("APEX_SYSTEMS_URL and APEX_SYSTEMS_TOKEN must be set in this Vercel environment.");
  return { url: url ?? "http://localhost:4100", token: token ?? "dev-apex-token" };
}

// Each system speaks its own dialect. Parsing at the boundary keeps the rest of the app on one clean shape.
const erpMaterial = z.object({ d: z.object({ Material: z.string(), MaterialDescription: z.string(), Supplier: z.string(), SupplierName: z.string(), SupplyEndDate: z.string() }) });
const erpWhereUsed = z.object({ d: z.object({ results: z.array(z.object({ Recipe: z.string(), FinishedGood: z.string(), FinishedGoodDescription: z.string(), Plant: z.string(), SalesOrg: z.string() })) }) });
const erpFinishedGood = z.object({ d: z.object({ FinishedGood: z.string(), Description: z.string(), Plant: z.string(), SalesOrg: z.string(), Components: z.array(z.object({ Material: z.string(), Description: z.string() })) }) });
const qmsQualifications = z.object({ data: z.array(z.object({ id: z.string(), name__v: z.string(), status__v: z.string(), product__c: z.string(), material__c: z.string(), material_grade__c: z.string(), region__c: z.string(), effective_date__c: z.string(), scope__c: z.string() })) });
const regRules = z.object({ items: z.array(z.object({ ruleId: z.string(), market: z.string(), changeType: z.string(), appliesTo: z.string(), noticeDays: z.number(), requirement: z.string() })) });

const title = (text: string) => text.toLowerCase().replace(/(^|[\s(/-])\S/g, s => s.toUpperCase()).replace(/\bX-17(\w?)\b/gi, m => m.toUpperCase());
const sapDate = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
export const marketFor = (salesOrg: string) => (salesOrg.startsWith("EU") ? "EU" : "US");

// A session with the systems of record: it remembers every record it read and every call it made,
// so the assessment can be checked against what was actually retrieved.
export function apexSession(scenario: Scenario) {
  const sources = new Map<string, SourceRecord>();
  const calls: SystemCall[] = [];
  // Same endpoint, same answer within one assessment: the policy check reuses what the agent already fetched.
  const cache = new Map<string, Promise<unknown>>();

  function get<T>(system: SystemName, endpoint: string, schema: z.ZodType<T>): Promise<T | null> {
    if (!cache.has(endpoint)) cache.set(endpoint, fetchOnce(system, endpoint, schema));
    return cache.get(endpoint) as Promise<T | null>;
  }

  async function fetchOnce<T>(system: SystemName, endpoint: string, schema: z.ZodType<T>): Promise<T | null> {
    const started = performance.now();
    const { url, token } = connection();
    const response = await fetch(`${url}${endpoint}`, {
      headers: { authorization: `Bearer ${token}`, "x-apex-scenario": scenario },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    calls.push({ system, endpoint, status: response.status, ms: Math.round(performance.now() - started) });
    if (response.status === 404) return null;
    if (!response.ok) throw new ApexSystemError(system, response.status, `${system} returned ${response.status} for ${endpoint}`);
    return schema.parse(await response.json());
  }

  const remember = (record: SourceRecord) => { sources.set(record.id, record); return record; };

  return {
    sources, calls,

    async material(material: string) {
      const body = await get("ERP", `/erp/v1/materials/${material}`, erpMaterial);
      if (!body) return null;
      const m = body.d;
      remember({ id: m.Material, system: "ERP", title: `Material master | ${title(m.MaterialDescription)}`, detail: `Supplied by ${title(m.SupplierName)} (${m.Supplier}). Supply ends ${sapDate(m.SupplyEndDate)}.` });
      return { material: m.Material, description: title(m.MaterialDescription), supplier: title(m.SupplierName), supplyEnds: sapDate(m.SupplyEndDate) };
    },

    async whereUsed(material: string) {
      const body = await get("ERP", `/erp/v1/materials/${material}/where-used`, erpWhereUsed);
      const results = body?.d.results ?? [];
      for (const r of results) remember({ id: r.FinishedGood, system: "ERP", title: `Where-used | ${title(r.FinishedGoodDescription)}`, detail: `Recipe ${r.Recipe} uses ${material}. Plant ${r.Plant}, sales org ${r.SalesOrg}.` });
      return results.map(r => ({ finishedGood: r.FinishedGood, product: title(r.FinishedGoodDescription), recipe: r.Recipe, plant: r.Plant, market: marketFor(r.SalesOrg) }));
    },

    async finishedGood(id: string) {
      const body = await get("ERP", `/erp/v1/finished-goods/${id}`, erpFinishedGood);
      if (!body) return null;
      const g = body.d;
      remember({ id: g.FinishedGood, system: "ERP", title: `Bill of materials | ${title(g.Description)}`, detail: `Components: ${g.Components.map(c => `${title(c.Description)} (${c.Material})`).join(", ")}.` });
      return { finishedGood: g.FinishedGood, product: title(g.Description), market: marketFor(g.SalesOrg), components: g.Components.map(c => c.Material) };
    },

    async qualifications(finishedGood: string) {
      const body = await get("QMS", `/qms/v1/qualifications?product=${encodeURIComponent(finishedGood)}`, qmsQualifications);
      const data = body?.data ?? [];
      for (const q of data) remember({ id: q.id, system: "QMS", title: `Qualification | ${q.name__v}`, detail: q.scope__c });
      return data.map(q => ({ id: q.id, product: q.product__c, material: q.material__c, grade: q.material_grade__c, effective: q.status__v === "effective__c", scope: q.scope__c }));
    },

    async notificationRules(market: string) {
      const body = await get("Regulatory", `/regulatory/v2/notification-rules?market=${market}&changeType=FORMULATION`, regRules);
      const items = body?.items ?? [];
      for (const r of items) remember({ id: r.ruleId, system: "Regulatory", title: `Notification rule | ${r.market} formulation change`, detail: `${r.requirement} Notice period: ${r.noticeDays} days.` });
      return items.map(r => ({ id: r.ruleId, market: r.market, noticeDays: r.noticeDays, requirement: r.requirement }));
    },
  };
}

export type ApexSession = ReturnType<typeof apexSession>;
