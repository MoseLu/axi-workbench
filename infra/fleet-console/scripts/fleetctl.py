#!/usr/bin/env python3
"""Render and validate the lightweight fleet registry.

The registry is intentionally JSON so the control plane has no Python package
dependency before Ansible is installed.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import shlex
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "registry" / "machines.json"
GENERATED_DIR = ROOT / "generated"
DASHBOARD_DATA_PATH = ROOT / "dashboard" / "public" / "fleet-data.json"
DEFAULT_CREDENTIAL_VAULT_PATH = Path("/Users/mose/Documents/Codex/2026-05-15/https-x-com-rwayne-status-2054523563248611675/knowledge_base")

REQUIRED_MACHINE_FIELDS = {
    "id",
    "provider",
    "role",
    "ssh_user",
    "public_ip",
    "tailscale_name",
    "tags",
    "lifecycle",
}
ALLOWED_LIFECYCLES = {"active", "staging", "maintenance", "retired"}
ALLOWED_MONITOR_TYPES = {"tcp", "http"}
CREDENTIAL_EXPORT_FIELDS = (
    "type",
    "title",
    "aliases",
    "service",
    "environment",
    "secret_ref",
    "source_location",
    "risk",
    "rotation",
    "last_verified",
    "agent_use",
    "migration_status",
    "profile",
    "related",
)


class FleetError(RuntimeError):
    pass


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            registry = json.load(handle)
    except FileNotFoundError as exc:
        raise FleetError(f"registry not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise FleetError(f"invalid JSON in {path}: {exc}") from exc
    validate_registry(registry)
    return registry


def validate_registry(registry: dict[str, Any]) -> None:
    if registry.get("schema_version") != 1:
        raise FleetError("schema_version must be 1")
    machines = registry.get("machines")
    if not isinstance(machines, list) or not machines:
        raise FleetError("machines must be a non-empty list")

    seen_ids: set[str] = set()
    for index, machine in enumerate(machines):
        if not isinstance(machine, dict):
            raise FleetError(f"machines[{index}] must be an object")
        missing = REQUIRED_MACHINE_FIELDS - machine.keys()
        if missing:
            raise FleetError(f"{machine.get('id', f'machines[{index}]')} missing fields: {sorted(missing)}")

        machine_id = machine["id"]
        if not isinstance(machine_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", machine_id):
            raise FleetError(f"invalid machine id: {machine_id!r}")
        if machine_id in seen_ids:
            raise FleetError(f"duplicate machine id: {machine_id}")
        seen_ids.add(machine_id)

        lifecycle = machine["lifecycle"]
        if lifecycle not in ALLOWED_LIFECYCLES:
            raise FleetError(f"{machine_id}: lifecycle must be one of {sorted(ALLOWED_LIFECYCLES)}")

        tags = machine["tags"]
        if not isinstance(tags, list) or not all(isinstance(tag, str) and tag for tag in tags):
            raise FleetError(f"{machine_id}: tags must be a non-empty string list")
        for tag in tags:
            sanitize_group(tag)

        for field in ("provider", "role", "ssh_user"):
            if not isinstance(machine[field], str) or not machine[field]:
                raise FleetError(f"{machine_id}: {field} must be a non-empty string")

        for field in ("credential_ref", "credential_profile"):
            if field in machine and machine[field] is not None and not isinstance(machine[field], str):
                raise FleetError(f"{machine_id}: {field} must be a string or null")

        public_ip = machine["public_ip"]
        tailscale_name = machine["tailscale_name"]
        if not public_ip and not tailscale_name:
            raise FleetError(f"{machine_id}: one of public_ip or tailscale_name is required")

        monitors = machine.get("monitors", [])
        if not isinstance(monitors, list):
            raise FleetError(f"{machine_id}: monitors must be a list")
        for monitor in monitors:
            validate_monitor(machine_id, monitor)


def validate_monitor(machine_id: str, monitor: Any) -> None:
    if not isinstance(monitor, dict):
        raise FleetError(f"{machine_id}: monitor entries must be objects")
    monitor_type = monitor.get("type")
    if monitor_type not in ALLOWED_MONITOR_TYPES:
        raise FleetError(f"{machine_id}: monitor type must be one of {sorted(ALLOWED_MONITOR_TYPES)}")
    if not monitor.get("name"):
        raise FleetError(f"{machine_id}: monitor name is required")
    if monitor_type == "tcp":
        if not monitor.get("host") or not isinstance(monitor.get("port"), int):
            raise FleetError(f"{machine_id}: tcp monitor requires host and integer port")
    if monitor_type == "http":
        url = monitor.get("url", "")
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            raise FleetError(f"{machine_id}: http monitor requires http(s) url")


def sanitize_group(value: str) -> str:
    group = re.sub(r"[^A-Za-z0-9_]", "_", value.strip())
    if not group or group[0].isdigit():
        group = f"g_{group}"
    return group


def choose_host(machine: dict[str, Any], network: str) -> str:
    if network == "bootstrap":
        host = machine.get("bootstrap_host") or machine.get("public_ip") or machine.get("tailscale_name")
    elif network == "public":
        host = machine.get("public_ip")
    elif network == "tailscale":
        host = machine.get("tailscale_name")
    elif network == "auto":
        host = machine.get("tailscale_name") or machine.get("public_ip")
    else:
        raise FleetError(f"unknown network mode: {network}")
    if not host:
        raise FleetError(f"{machine['id']}: no host for network mode {network}")
    return host


def active_machines(registry: dict[str, Any]) -> list[dict[str, Any]]:
    return [machine for machine in registry["machines"] if machine["lifecycle"] != "retired"]


def shell_quote(value: Any) -> str:
    return shlex.quote(str(value))


def sql_quote(value: Any) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def render_inventory(registry: dict[str, Any], network: str) -> str:
    defaults = registry.get("defaults", {})
    machines = active_machines(registry)
    lines: list[str] = [
        "# Generated by fleet/scripts/fleetctl.py. Edit fleet/registry/machines.json instead.",
        "[all]",
    ]

    group_members: dict[str, list[str]] = {}
    for machine in machines:
        machine_id = machine["id"]
        host = choose_host(machine, network)
        ssh_port = machine.get("ssh_port", defaults.get("ssh_port", 22))
        parts = [
            machine_id,
            f"ansible_host={shell_quote(host)}",
            f"ansible_user={shell_quote(machine['ssh_user'])}",
            f"ansible_port={ssh_port}",
            f"fleet_provider={shell_quote(machine['provider'])}",
            f"fleet_role={shell_quote(machine['role'])}",
            f"fleet_lifecycle={shell_quote(machine['lifecycle'])}",
        ]
        key_path = machine.get("ssh_key_path")
        if key_path:
            parts.append(f"ansible_ssh_private_key_file={shell_quote(key_path)}")
        interpreter = machine.get("ansible_python_interpreter") or defaults.get("ansible_python_interpreter")
        if interpreter:
            parts.append(f"ansible_python_interpreter={shell_quote(interpreter)}")
        lines.append(" ".join(parts))

        groups = {
            "lifecycle_" + sanitize_group(machine["lifecycle"]),
            "provider_" + sanitize_group(machine["provider"]),
            "role_" + sanitize_group(machine["role"]),
        }
        groups.update("tag_" + sanitize_group(tag) for tag in machine.get("tags", []))
        for group in sorted(groups):
            group_members.setdefault(group, []).append(machine_id)

    lines.append("")
    for group, members in sorted(group_members.items()):
        lines.append(f"[{group}]")
        lines.extend(sorted(members))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_ssh_config(registry: dict[str, Any], network: str) -> str:
    lines = [
        "# Generated by fleet/scripts/fleetctl.py. Edit fleet/registry/machines.json instead.",
    ]
    for machine in active_machines(registry):
        host = choose_host(machine, network)
        lines.extend(
            [
                f"Host fleet-{machine['id']}",
                f"  HostName {host}",
                f"  User {machine['ssh_user']}",
                f"  Port {machine.get('ssh_port', registry.get('defaults', {}).get('ssh_port', 22))}",
                "  ServerAliveInterval 30",
                "  ServerAliveCountMax 3",
            ]
        )
        if machine.get("ssh_key_path"):
            lines.append(f"  IdentityFile {machine['ssh_key_path']}")
            lines.append("  IdentitiesOnly yes")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def shell_identifier(value: str) -> str:
    name = sanitize_group(value).lower()
    return re.sub(r"_+", "_", name).strip("_")


def render_aliases(registry: dict[str, Any], network: str) -> str:
    ssh_config = GENERATED_DIR / "ssh_config"
    lines = [
        "# Generated by fleet/scripts/fleetctl.py. Edit fleet/registry/machines.json instead.",
        "# Source with: source fleet/generated/aliases.sh",
        f"export FLEET_SSH_CONFIG={shell_quote(ssh_config)}",
        "",
    ]
    for machine in active_machines(registry):
        machine_name = shell_identifier(machine["id"])
        host_alias = f"fleet-{machine['id']}"
        lines.extend(
            [
                f"fleet_ssh_{machine_name}() {{",
                f"  ssh -F \"$FLEET_SSH_CONFIG\" {shell_quote(host_alias)} \"$@\"",
                "}",
                "",
                f"fleet_cockpit_{machine_name}() {{",
                f"  ssh -F \"$FLEET_SSH_CONFIG\" -N -L \"${{1:-9090}}:127.0.0.1:9090\" {shell_quote(host_alias)}",
                "}",
                "",
                f"fleet_netdata_{machine_name}() {{",
                f"  ssh -F \"$FLEET_SSH_CONFIG\" -N -L \"${{1:-19999}}:127.0.0.1:19999\" {shell_quote(host_alias)}",
                "}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def render_hosts_markdown(registry: dict[str, Any], network: str) -> str:
    lines = [
        "# Fleet Hosts",
        "",
        "Generated from `fleet/registry/machines.json`.",
        "",
        "| id | provider | role | lifecycle | selected host | tags |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for machine in registry["machines"]:
        selected_host = "retired"
        if machine["lifecycle"] != "retired":
            selected_host = choose_host(machine, network)
        tags = ", ".join(machine.get("tags", []))
        lines.append(
            f"| `{machine['id']}` | {machine['provider']} | {machine['role']} | "
            f"{machine['lifecycle']} | `{selected_host}` | {tags} |"
        )
    lines.append("")
    return "\n".join(lines)


def render_monitor_targets(registry: dict[str, Any], network: str) -> str:
    targets: list[dict[str, Any]] = []
    for machine in active_machines(registry):
        monitors = machine.get("monitors") or [
            {
                "name": f"{machine['id']} ssh",
                "type": "tcp",
                "host": choose_host(machine, network),
                "port": machine.get("ssh_port", registry.get("defaults", {}).get("ssh_port", 22)),
            }
        ]
        for monitor in monitors:
            record = {
                "machine_id": machine["id"],
                "provider": machine["provider"],
                "role": machine["role"],
                "lifecycle": machine["lifecycle"],
                **monitor,
            }
            targets.append(record)
    return json.dumps({"targets": targets}, ensure_ascii=False, indent=2) + "\n"


def render_dashboard_data(registry: dict[str, Any], network: str) -> str:
    machines = []
    monitor_targets = json.loads(render_monitor_targets(registry, network))["targets"]
    for machine in registry["machines"]:
        selected_host = None
        if machine["lifecycle"] != "retired":
            selected_host = choose_host(machine, network)
        machines.append({**machine, "selected_host": selected_host})
    return json.dumps(
        {
            "generated_at": datetime.datetime.now(datetime.UTC).isoformat(),
            "network": network,
            "machines": machines,
            "monitor_targets": monitor_targets,
            "credential_vault": credential_vault_summary(registry),
            "credential_refs": load_credential_refs(registry),
        },
        ensure_ascii=False,
        indent=2,
    ) + "\n"


def credential_vault_path(registry: dict[str, Any]) -> Path:
    env_path = os.environ.get("LOCAL_CREDENTIALS_VAULT")
    if env_path:
        return Path(env_path).expanduser()
    configured = registry.get("defaults", {}).get("credential_vault_path")
    if isinstance(configured, str) and configured:
        return Path(configured).expanduser()
    return DEFAULT_CREDENTIAL_VAULT_PATH


def credential_vault_summary(registry: dict[str, Any]) -> dict[str, Any]:
    vault = credential_vault_path(registry)
    return {
        "path": str(vault),
        "loaded": vault.exists(),
        "metadata_only": True,
    }


def load_credential_refs(registry: dict[str, Any]) -> list[dict[str, Any]]:
    vault = credential_vault_path(registry)
    entities_dir = vault / "wiki" / "entities"
    if not entities_dir.exists():
        return []

    records: list[dict[str, Any]] = []
    for path in sorted(entities_dir.glob("*.md")):
        frontmatter = parse_frontmatter(path)
        if frontmatter.get("type") not in {"credential-ref", "server"}:
            continue
        record = {field: frontmatter.get(field) for field in CREDENTIAL_EXPORT_FIELDS if field in frontmatter}
        record["id"] = path.stem
        record["path"] = str(path.relative_to(vault))
        record["metadata_only"] = True
        records.append(record)
    return sorted(records, key=lambda item: (str(item.get("service") or ""), str(item.get("title") or "")))


def parse_frontmatter(path: Path) -> dict[str, Any]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    values: dict[str, Any] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" not in line or line.startswith((" ", "\t", "-")):
            continue
        key, raw_value = line.split(":", 1)
        values[key.strip()] = parse_frontmatter_value(raw_value.strip())
    return values


def parse_frontmatter_value(raw_value: str) -> Any:
    if raw_value == "":
        return ""
    if raw_value in {"true", "false"}:
        return raw_value == "true"
    if raw_value == "null":
        return None
    if raw_value.startswith("[") and raw_value.endswith("]"):
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return raw_value
    if (raw_value.startswith('"') and raw_value.endswith('"')) or (raw_value.startswith("'") and raw_value.endswith("'")):
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return raw_value[1:-1]
    return raw_value


def render(args: argparse.Namespace) -> int:
    registry = load_registry()
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "inventory.ini": render_inventory(registry, args.network),
        "ssh_config": render_ssh_config(registry, args.network),
        "aliases.sh": render_aliases(registry, args.network),
        "hosts.md": render_hosts_markdown(registry, args.network),
        "monitor-targets.json": render_monitor_targets(registry, args.network),
    }
    for name, content in outputs.items():
        (GENERATED_DIR / name).write_text(content, encoding="utf-8")
    if DASHBOARD_DATA_PATH.parent.exists():
        DASHBOARD_DATA_PATH.write_text(render_dashboard_data(registry, args.network), encoding="utf-8")
    print(f"rendered {len(outputs)} files in {GENERATED_DIR} using network={args.network}")
    return 0


def validate(_: argparse.Namespace) -> int:
    registry = load_registry()
    print(f"valid registry: {len(registry['machines'])} machines")
    return 0


def list_hosts(args: argparse.Namespace) -> int:
    registry = load_registry()
    for machine in active_machines(registry):
        print(f"{machine['id']}\t{choose_host(machine, args.network)}\t{machine['ssh_user']}\t{','.join(machine['tags'])}")
    return 0


def smoke(args: argparse.Namespace) -> int:
    targets_path = Path(args.targets)
    targets = json.loads(targets_path.read_text(encoding="utf-8"))["targets"]
    if args.lifecycle != "all":
        targets = [target for target in targets if target.get("lifecycle") == args.lifecycle]
    if args.machine:
        targets = [target for target in targets if target.get("machine_id") == args.machine]

    failures = 0
    for target in targets:
        ok, detail = check_target(target, args.timeout)
        status = "ok" if ok else "fail"
        print(f"{status}\t{target['machine_id']}\t{target['name']}\t{detail}")
        failures += 0 if ok else 1
    return 1 if failures else 0


def load_monitor_targets(path: Path, lifecycle: str, machine_id: str | None) -> list[dict[str, Any]]:
    targets = json.loads(path.read_text(encoding="utf-8"))["targets"]
    if lifecycle != "all":
        targets = [target for target in targets if target.get("lifecycle") == lifecycle]
    if machine_id:
        targets = [target for target in targets if target.get("machine_id") == machine_id]
    return targets


def uptime_kuma_sql(args: argparse.Namespace) -> int:
    targets = load_monitor_targets(Path(args.targets), args.lifecycle, args.machine)
    print("BEGIN;")
    print(f"INSERT OR IGNORE INTO tag (name, color) VALUES ({sql_quote(args.tag)}, {sql_quote(args.tag_color)});")
    for target in targets:
        if target["type"] == "tcp":
            monitor_type = "port"
            url = None
            hostname = target["host"]
            port = target["port"]
        elif target["type"] == "http":
            monitor_type = "http"
            url = target["url"]
            hostname = None
            port = None
        else:
            continue

        name = target["name"]
        machine = target["machine_id"]
        description = f"fleet:{machine} provider:{target.get('provider', '')} role:{target.get('role', '')}"
        where = f"name = {sql_quote(name)} AND user_id = {args.user_id}"
        print(f"DELETE FROM monitor_tag WHERE monitor_id IN (SELECT id FROM monitor WHERE {where});")
        print(f"DELETE FROM monitor WHERE {where};")
        print(
            "INSERT INTO monitor "
            "(name, active, user_id, interval, url, type, hostname, port, maxretries, retry_interval, timeout, description) "
            f"VALUES ({sql_quote(name)}, 1, {args.user_id}, {args.interval}, {sql_quote(url)}, "
            f"{sql_quote(monitor_type)}, {sql_quote(hostname)}, {port if port is not None else 'NULL'}, "
            f"{args.max_retries}, {args.retry_interval}, {args.timeout}, {sql_quote(description)});"
        )
        print(
            "INSERT INTO monitor_tag (monitor_id, tag_id, value) "
            f"VALUES (last_insert_rowid(), (SELECT id FROM tag WHERE name = {sql_quote(args.tag)}), {sql_quote(machine)});"
        )
    print("COMMIT;")
    return 0


def doctor(args: argparse.Namespace) -> int:
    registry = load_registry()
    issues = 0
    for machine in active_machines(registry):
        host = choose_host(machine, args.network)
        key_path = machine.get("ssh_key_path")
        credential_ref = machine.get("credential_ref")
        credential_profile = machine.get("credential_profile")
        key_status = "agent-or-password"
        if key_path:
            expanded = Path(key_path).expanduser()
            key_status = "key-ok" if expanded.exists() else f"key-missing:{key_path}"
            if not expanded.exists() and machine["lifecycle"] == "active":
                issues += 1
        elif credential_ref:
            key_status = f"secret-ref:{credential_profile or 'no-profile'}"
        elif machine["lifecycle"] == "active":
            issues += 1

        monitor_count = len(machine.get("monitors", []))
        credential_status = machine.get("credential_status", "ok")
        print(
            "\t".join(
                [
                    machine["id"],
                    f"lifecycle={machine['lifecycle']}",
                    f"host={host}",
                    f"user={machine['ssh_user']}",
                    key_status,
                    f"credential={credential_status}",
                    f"monitors={monitor_count}",
                ]
            )
        )
    return 1 if issues else 0


def check_target(target: dict[str, Any], timeout: float) -> tuple[bool, str]:
    if target["type"] == "tcp":
        host = target["host"]
        port = int(target["port"])
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True, f"tcp {host}:{port}"
        except OSError as exc:
            return False, f"tcp {host}:{port} {exc}"

    if target["type"] == "http":
        url = target["url"]
        request = urllib.request.Request(url, headers={"User-Agent": "fleetctl-smoke/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status < 500, f"http {url} status={response.status}"
        except urllib.error.HTTPError as exc:
            return exc.code < 500, f"http {url} status={exc.code}"
        except OSError as exc:
            return False, f"http {url} {exc}"

    return False, f"unsupported type {target['type']}"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fleet registry helper")
    subcommands = parser.add_subparsers(dest="command", required=True)

    validate_parser = subcommands.add_parser("validate", help="validate registry schema")
    validate_parser.set_defaults(func=validate)

    render_parser = subcommands.add_parser("render", help="render generated inventory and monitor files")
    render_parser.add_argument(
        "--network",
        choices=["bootstrap", "public", "tailscale", "auto"],
        default="bootstrap",
        help="which address family to render into generated files",
    )
    render_parser.set_defaults(func=render)

    list_parser = subcommands.add_parser("list", help="list active hosts")
    list_parser.add_argument("--network", choices=["bootstrap", "public", "tailscale", "auto"], default="bootstrap")
    list_parser.set_defaults(func=list_hosts)

    smoke_parser = subcommands.add_parser("smoke", help="run TCP/HTTP checks from monitor-targets.json")
    smoke_parser.add_argument("--targets", default=str(GENERATED_DIR / "monitor-targets.json"))
    smoke_parser.add_argument("--timeout", type=float, default=3.0)
    smoke_parser.add_argument("--lifecycle", choices=["active", "staging", "maintenance", "retired", "all"], default="all")
    smoke_parser.add_argument("--machine", help="only check one machine id")
    smoke_parser.set_defaults(func=smoke)

    kuma_sql_parser = subcommands.add_parser("uptime-kuma-sql", help="render SQL to import monitor targets into Uptime Kuma")
    kuma_sql_parser.add_argument("--targets", default=str(GENERATED_DIR / "monitor-targets.json"))
    kuma_sql_parser.add_argument("--lifecycle", choices=["active", "staging", "maintenance", "retired", "all"], default="active")
    kuma_sql_parser.add_argument("--machine", help="only import one machine id")
    kuma_sql_parser.add_argument("--user-id", type=int, default=1)
    kuma_sql_parser.add_argument("--interval", type=int, default=60)
    kuma_sql_parser.add_argument("--retry-interval", type=int, default=60)
    kuma_sql_parser.add_argument("--max-retries", type=int, default=1)
    kuma_sql_parser.add_argument("--timeout", type=float, default=10)
    kuma_sql_parser.add_argument("--tag", default="fleet")
    kuma_sql_parser.add_argument("--tag-color", default="#3B82F6")
    kuma_sql_parser.set_defaults(func=uptime_kuma_sql)

    doctor_parser = subcommands.add_parser("doctor", help="check local registry readiness")
    doctor_parser.add_argument("--network", choices=["bootstrap", "public", "tailscale", "auto"], default="bootstrap")
    doctor_parser.set_defaults(func=doctor)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except FleetError as exc:
        print(f"fleetctl: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
