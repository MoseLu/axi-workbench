import { createServer } from "node:http";
import { createCommunicationGateway } from "./gateway.mjs";

const port = Number.parseInt(process.env.COMMUNICATION_GATEWAY_PORT || "8093", 10);
const gateway = createCommunicationGateway();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "healthy", service: "communication-gateway" });
    }
    if (req.method === "GET" && url.pathname === "/routes") {
      return sendJson(res, 200, gateway.listState());
    }
    if (req.method === "GET" && url.pathname === "/healthz") {
      return sendJson(res, 200, { status: "ok", service: "communication-gateway", compatibility: "mosscoder-relay" });
    }
    if (req.method === "PUT" && url.pathname === "/v1/devices") {
      const registered = gateway.registerMossCoderDevice(await readJsonBody(req));
      return sendJson(res, registered.statusCode || 200, registered.ok ? { deviceDbId: registered.deviceDbId } : { error: registered.error });
    }
    if (req.method === "GET" && url.pathname === "/v1/events") {
      return sendJson(res, 200, await gateway.pollMossCoderEvents({
        sessionId: url.searchParams.get("sessionId") || "",
        after: url.searchParams.get("after") || "",
      }));
    }
    if (req.method === "POST" && url.pathname === "/v1/events") {
      const handled = await gateway.handleMossCoderRelayEvent(await readJsonBody(req));
      return sendJson(res, handled.statusCode || 200, handled.ok === false ? { error: handled.error } : {
        status: handled.accepted ? "accepted" : (handled.status || "dispatched"),
        jobId: handled.job?.id,
        receiptId: handled.receipt?.id,
        simulated: true,
      });
    }
    if (req.method === "POST" && url.pathname === "/routes/pair/start") {
      return sendJson(res, 200, gateway.startPair(await readJsonBody(req)));
    }
    if (req.method === "POST" && url.pathname === "/routes/pair/confirm") {
      return sendJson(res, 200, gateway.confirmPair(await readJsonBody(req)));
    }
    const transportMatch = url.pathname.match(/^\/transports\/([^/]+)\/messages$/);
    if (req.method === "POST" && transportMatch) {
      return sendJson(res, 200, await gateway.handleTransportMessage(decodeURIComponent(transportMatch[1]), await readJsonBody(req)));
    }
    const responseMatch = url.pathname.match(/^\/responses\/([^/]+)\/send$/);
    if (req.method === "POST" && responseMatch) {
      return sendJson(res, 200, gateway.sendResponse(decodeURIComponent(responseMatch[1]), await readJsonBody(req)));
    }
    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    return sendJson(res, 500, { error: "communication-gateway error", message: error?.message || String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`communication-gateway listening on http://127.0.0.1:${port}`);
});

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
