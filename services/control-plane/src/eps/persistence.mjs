import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function createEpsStore(cacheDir) {
  const directory = join(cacheDir, "eps-audits");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const fileFor = (id) => join(directory, `${id}.json`);
  return {
    save(audit) { writeFileSync(fileFor(audit.id), `${JSON.stringify(audit, null, 2)}\n`, { mode: 0o600 }); return audit; },
    get(id) { try { return JSON.parse(readFileSync(fileFor(id), "utf8")); } catch { return null; } },
    list() { return readdirSync(directory).filter((name) => name.endsWith(".json")).map((name) => this.get(name.slice(0, -5))).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); },
  };
}
