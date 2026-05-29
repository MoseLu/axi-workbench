#!/usr/bin/env python3
"""
Bundle 发布脚本 - 在 build_all.bat 的 React build 之后调用

功能：
  1. 将 frontend/build/ 目录打包为 bundle.zip
  2. 计算版本号（build 目录下 index.html 的 SHA256 前 12 位，保证幂等）
  3. 将 bundle.zip 写入 backend/bundle_updates/ (开发) 或指定数据目录
  4. 更新 bundle_version.json
  5. 如果后端服务器正在运行（本地 HTTP 检测），POST 到 /api/update/bundle/publish
     触发 SSE 广播，所有在线设备会自动热更新

用法：
  python publish_bundle.py [--build-dir <path>] [--data-dir <path>] [--server <url>] [--note <text>]

默认值：
  --build-dir  ../frontend/build   (相对于本脚本所在目录)
  --data-dir   ./                  (后端数据目录，bundle_updates/ 将在此创建)
  --server     http://127.0.0.1:8765
  --note       ""
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile
import datetime
import urllib.request
import urllib.error
from runtime_paths import get_runtime_data_dir

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def get_data_dir():
    """获取与 server.py 一致的运行时数据目录"""
    return os.fspath(get_runtime_data_dir())


def compute_version(build_dir: str) -> str:
    """
    版本号 = index.html 内容的 SHA256 前 12 位
    这样只要内容不变，版本号就不变（幂等），内容变了版本号才变。
    """
    index_path = os.path.join(build_dir, "index.html")
    if not os.path.exists(index_path):
        raise FileNotFoundError(f"找不到 index.html: {index_path}")
    h = hashlib.sha256()
    with open(index_path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:12]


def zip_build_dir(build_dir: str, output_zip: str):
    """
    将 build_dir 里的所有文件打包到 output_zip。
    ZIP 内路径为相对于 build_dir 的路径（如 index.html, static/js/main.xxx.js）。
    """
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(build_dir):
            # 跳过隐藏目录和 .map 文件（可选）
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fname in files:
                full_path = os.path.join(root, fname)
                arcname  = os.path.relpath(full_path, build_dir)
                zf.write(full_path, arcname)
    size = os.path.getsize(output_zip)
    print(f"  bundle.zip 创建完成: {output_zip} ({size / 1024 / 1024:.1f} MB)")
    return size


def notify_server(server_url: str, version: str, note: str) -> bool:
    """
    POST 到后端 /api/update/bundle/publish，触发 SSE 广播。
    如果服务器未运行，静默跳过。
    """
    url  = f"{server_url}/api/update/bundle/publish"
    body = json.dumps({"version": version, "note": note}).encode("utf-8")
    req  = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            sent = data.get("sent_count", 0)
            online = data.get("online_count", 0)
            print(f"  服务器已接受，已广播到 {sent}/{online} 台在线设备")
            return True
    except urllib.error.URLError as e:
        print(f"  服务器未运行或不可达（{e.reason}），跳过广播通知")
        return False
    except Exception as e:
        print(f"  通知服务器失败: {e}")
        return False


def bump_semver(ver: str, level: str) -> str:
    """语义化版本递增"""
    prefix = ''
    v = ver
    if ver.startswith('v'):
        prefix = 'v'
        v = ver[1:]
    try:
        parts = [int(x) for x in v.split('.')]
    except Exception:
        parts = [0, 0, 0]
    while len(parts) < 3:
        parts.append(0)
    if level == 'major':
        parts[0] += 1; parts[1] = 0; parts[2] = 0
    elif level == 'minor':
        parts[1] += 1; parts[2] = 0
    else:  # patch
        parts[2] += 1
    return f"{prefix}{parts[0]}.{parts[1]}.{parts[2]}"


def main():
    parser = argparse.ArgumentParser(description="SOP Bundle 发布工具")
    parser.add_argument("--build-dir",
                        default=os.path.join(SCRIPT_DIR, "..", "frontend", "build"),
                        help="React build 输出目录")
    parser.add_argument("--data-dir",
                        default=get_data_dir(),
                        help="后端数据目录（bundle_updates/ 将创建于此，默认与 server.py 一致）")
    parser.add_argument("--server",
                        default="http://127.0.0.1:8765",
                        help="后端服务器地址（用于广播通知）")
    parser.add_argument("--note",
                        default="",
                        help="版本说明")
    parser.add_argument("--semver",
                        default=None,
                        help="语义化版本号，如 v1.2.3（省略则自动递增 patch）")
    parser.add_argument("--bump",
                        default='patch',
                        choices=['patch', 'minor', 'major'],
                        help="自动递增的版本级别（默认 patch）")
    args = parser.parse_args()

    build_dir  = os.path.abspath(args.build_dir)
    data_dir   = os.path.abspath(args.data_dir)
    bundle_dir = os.path.join(data_dir, "bundle_updates")
    zip_path   = os.path.join(bundle_dir, "bundle.zip")
    ver_path   = os.path.join(bundle_dir, "bundle_version.json")

    print("=" * 60)
    print("  SOP Bundle 发布")
    print("=" * 60)
    print(f"  build 目录 : {build_dir}")
    print(f"  数据目录   : {data_dir}")

    # 检查 build 目录
    if not os.path.isdir(build_dir):
        print(f"\n[错误] build 目录不存在: {build_dir}")
        print("  请先运行 pnpm build")
        sys.exit(1)

    if not os.path.exists(os.path.join(build_dir, "index.html")):
        print(f"\n[错误] build 目录缺少 index.html: {build_dir}")
        sys.exit(1)

    # 计算版本号
    version = compute_version(build_dir)
    print(f"  bundle 内容 hash: {version}")

    # 解析语义化版本
    os.makedirs(bundle_dir, exist_ok=True)
    existing = {}
    if os.path.exists(ver_path):
        try:
            with open(ver_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    # displayVersion: 人类可读版本号
    if args.semver:
        display_version = args.semver
        if not display_version.startswith('v'):
            display_version = 'v' + display_version
    else:
        prev = existing.get("displayVersion", "v0.0.0")
        display_version = bump_semver(prev, args.bump)
    print(f"  显示版本  : {display_version}")

    # 检查是否与已发布版本相同（幂等：hash 不变则跳过）
    if existing.get("version") == version and os.path.exists(zip_path):
        print(f"\n  当前版本 {display_version}（hash {version}）已是最新，无需重新打包。")
        # 仍然通知服务器（以防上次通知失败）
        print("\n[3] 通知服务器...")
        notify_server(args.server, version, args.note or existing.get("note", ""))
        print("\n完成。")
        return

    # 打包
    print("\n[1] 打包 bundle.zip ...")
    size = zip_build_dir(build_dir, zip_path)

    # 写版本信息
    print("\n[2] 更新版本信息 ...")
    info = {
        "version":        version,       # hash，用于设备版本比对
        "displayVersion": display_version, # 人类可读版本号
        "size":           size,
        "note":           args.note,
        "published_at":   datetime.datetime.now().isoformat(),
    }
    with open(ver_path, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    print(f"  bundle_version.json 已更新")

    # 通知服务器（传入 displayVersion 作为 note 的默认值）
    print("\n[3] 通知服务器广播更新...")
    note = args.note or display_version
    notify_server(args.server, version, note)

    print("\n" + "=" * 60)
    print(f"  Bundle 发布完成！版本: {display_version} (hash: {version})")
    print(f"  设备下次心跳时会收到 bundle_update 命令并自动热更新。")
    print("=" * 60)


if __name__ == "__main__":
    main()
