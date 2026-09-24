import { execFile } from "node:child_process";

function command(file, args, timeout = 5000) {
  return new Promise((resolve) => execFile(file, args, { timeout, windowsHide: true }, (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout || ""), stderr: String(stderr || ""), error: error?.message || null })));
}

export async function probeWindowsDockerRuntime({ gatewayUrl = process.env.AXI_EPS_GATEWAY_URL || "http://127.0.0.1:18088" } = {}) {
  const docker = await command(process.platform === "win32" ? "docker.exe" : "docker", ["ps", "--format", "{{.Names}}|{{.Status}}|{{.Ports}}"]);
  const containers = docker.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, status, ports = ""] = line.split("|");
    return { name, status, ports, running: status.startsWith("Up ") };
  }).filter((item) => item.name.includes("axi-workbench") || item.name.includes("epap-"));
  const health = await command(process.platform === "win32" ? "curl.exe" : "curl", ["-sS", "-o", process.platform === "win32" ? "NUL" : "/dev/null", "-w", "%{http_code}", `${gatewayUrl.replace(/\/$/, "")}/health`]);
  const healthy = health.ok && health.stdout.trim() === "200";
  return { checkedAt: new Date().toISOString(), host: process.env.COMPUTERNAME || process.env.HOSTNAME || "local", mode: "windows-docker", status: docker.ok && healthy ? "healthy" : docker.ok ? "degraded" : "unreachable", gateway: { url: gatewayUrl, httpStatus: health.stdout.trim() || null, healthy }, containers, dockerAvailable: docker.ok };
}
