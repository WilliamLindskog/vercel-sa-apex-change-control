import { erp, qms, regulatory } from "./data.js";

// One web-standard handler for the whole mock, so it runs the same locally (dev.js) and on Vercel (api/router.js).
//
// Demo controls, sent by the Change Control app as a request header (x-apex-scenario):
//   missing-eu-qualification  QMS behaves as if QLF-EU-03 was archived without a replacement.
//   qms-outage                QMS answers 503, as during a maintenance window.

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json", ...headers } });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function handle(request) {
  const url = new URL(request.url);
  // On Vercel the rewrite passes the original path as ?path=; locally the path is used directly.
  const path = "/" + (url.searchParams.get("path") ?? url.pathname).replace(/^\/+/, "");
  const scenario = request.headers.get("x-apex-scenario") ?? "normal";

  if (path === "/" || path === "/health") return json({ service: "apex-systems-mock", systems: ["erp", "qms", "regulatory"] });

  // Internal systems sit behind a service token, as they would behind Apex's API gateway.
  const expected = process.env.APEX_SYSTEMS_TOKEN;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return json({ error: "unauthorized", message: "A valid service token is required." }, 401, { "www-authenticate": "Bearer" });
  }

  // Real back-office systems are not instant. A little latency keeps the demo honest about network cost.
  await sleep(120 + Math.floor(Math.random() * 380));

  let match;

  // ERP: material master
  if ((match = path.match(/^\/erp\/v1\/materials\/([A-Z0-9-]+)$/))) {
    const material = erp.materials[match[1]];
    return material ? json({ d: material }) : json({ error: { code: "MATERIAL_NOT_FOUND", message: `Material ${match[1]} does not exist.` } }, 404);
  }

  // ERP: where-used list for a raw material
  if ((match = path.match(/^\/erp\/v1\/materials\/([A-Z0-9-]+)\/where-used$/))) {
    return json({ d: { results: erp.whereUsed[match[1]] ?? [] } });
  }

  // ERP: finished good with its bill of materials
  if ((match = path.match(/^\/erp\/v1\/finished-goods\/([A-Z0-9-]+)$/))) {
    const good = erp.finishedGoods[match[1]];
    return good ? json({ d: good }) : json({ error: { code: "MATERIAL_NOT_FOUND", message: `Finished good ${match[1]} does not exist.` } }, 404);
  }

  // QMS: qualification records for a product
  if (path === "/qms/v1/qualifications") {
    if (scenario === "qms-outage") return json({ responseStatus: "FAILURE", errors: [{ type: "SERVICE_UNAVAILABLE", message: "Vault is in a maintenance window." }] }, 503, { "retry-after": "120" });
    const product = url.searchParams.get("product");
    const data = qms.qualifications
      .filter(record => !product || record.product__c === product)
      .filter(record => !(scenario === "missing-eu-qualification" && record.id === "QLF-EU-03"));
    return json({ responseStatus: "SUCCESS", responseDetails: { total: data.length }, data });
  }

  // Regulatory: notification rules for a market and change type
  if (path === "/regulatory/v2/notification-rules") {
    const market = url.searchParams.get("market");
    const changeType = url.searchParams.get("changeType");
    const items = regulatory.rules.filter(rule => (!market || rule.market === market) && (!changeType || rule.changeType === changeType));
    return json({ items, count: items.length });
  }

  return json({ error: "not_found", path }, 404);
}
