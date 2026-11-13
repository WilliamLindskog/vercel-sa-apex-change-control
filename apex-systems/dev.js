// Local stand-in for the deployed mock: node apex-systems/dev.js (port 4100).
import { createServer } from "node:http";
import { handle } from "./lib/handler.js";

process.env.APEX_SYSTEMS_TOKEN ??= "dev-apex-token";
const port = Number(process.env.PORT ?? 4100);

createServer(async (req, res) => {
  const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(port, () => console.log(`apex-systems mock on http://localhost:${port}`));
