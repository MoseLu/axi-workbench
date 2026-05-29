import { createServer } from "node:http";
import { createControlPlane } from "./control-plane.mjs";

const port = Number.parseInt(process.env.CONTROL_PLANE_PORT || "8092", 10);
const controlPlane = createControlPlane();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "healthy", service: "control-plane" });
    }
    if (req.method === "GET" && url.pathname === "/snapshot") {
      return sendJson(res, 200, controlPlane.snapshot());
    }
    if (req.method === "POST" && url.pathname === "/query") {
      return sendJson(res, 200, await controlPlane.query(await readJsonBody(req)));
    }
    if (req.method === "POST" && url.pathname === "/communication/messages") {
      return sendJson(res, 200, await controlPlane.handleCommunicationMessage(await readJsonBody(req), {
        intelligenceOnly: url.searchParams.get("mode") === "intelligence",
      }));
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      return sendJson(res, 202, controlPlane.createJob(await readJsonBody(req)));
    }
    const jobEventsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/events$/);
    if (req.method === "GET" && jobEventsMatch) {
      return sendJson(res, 200, controlPlane.getJobEvents(decodeURIComponent(jobEventsMatch[1]), {
        afterEventId: url.searchParams.get("afterEventId") || "",
      }));
    }
    const jobArtifactsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/artifacts$/);
    if (req.method === "GET" && jobArtifactsMatch) {
      return sendJson(res, 200, controlPlane.getJobArtifacts(decodeURIComponent(jobArtifactsMatch[1])));
    }
    const cancelJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelJobMatch) {
      const job = controlPlane.cancelJob(decodeURIComponent(cancelJobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" });
    }
    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = controlPlane.getJob(decodeURIComponent(jobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" });
    }
    const agentTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)$/);
    if (req.method === "GET" && agentTaskMatch) {
      const task = controlPlane.getAgentTask(decodeURIComponent(agentTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" });
    }
    const cancelTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelTaskMatch) {
      const task = controlPlane.cancelAgentTask(decodeURIComponent(cancelTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" });
    }
    const approvalMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decision$/);
    if (req.method === "POST" && approvalMatch) {
      const decision = controlPlane.decideApproval({
        id: decodeURIComponent(approvalMatch[1]),
        ...await readJsonBody(req),
      });
      return sendJson(res, decision ? 200 : 404, decision || { error: "approval not found" });
    }
    const commandMatch = url.pathname.match(/^\/commands\/([^/]+)\/run$/);
    if (req.method === "POST" && commandMatch) {
      const run = controlPlane.runCommand(decodeURIComponent(commandMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "command not found" });
    }
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const run = controlPlane.getRun(decodeURIComponent(runMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "run not found" });
    }
    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    return sendJson(res, 500, { error: "control-plane error", message: error?.message || String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`control-plane listening on http://127.0.0.1:${port}`);
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
