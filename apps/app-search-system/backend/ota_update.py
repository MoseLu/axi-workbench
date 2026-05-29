#!/usr/bin/env python3
"""
OTA 远程更新模块
- APK 更新（保留兼容）: /api/update/check, /api/update/download/<filename>
- Web Bundle 热更新（主要方案）: /api/update/bundle/version, /api/update/bundle/download
  bundle 热更新无需重装 APK，仅替换 HTML/JS/CSS 资源
- 版本信息: apk_updates/version.json（APK）, bundle_updates/bundle_version.json（bundle）
"""
import os
import json
from flask import Blueprint, jsonify, send_from_directory, abort, request as flask_request

def get_apk_updates_dir(data_dir):
    """获取 APK 更新目录"""
    d = os.path.join(data_dir, "apk_updates")
    os.makedirs(d, exist_ok=True)
    return d


# ──────────────────────────────────────────────────────────────────
#  Web Bundle 热更新（无需重装 APK）
# ──────────────────────────────────────────────────────────────────

def get_bundle_updates_dir(data_dir):
    """获取 bundle 更新目录"""
    d = os.path.join(data_dir, "bundle_updates")
    os.makedirs(d, exist_ok=True)
    return d

def get_bundle_version_file(data_dir):
    return os.path.join(get_bundle_updates_dir(data_dir), "bundle_version.json")

def load_bundle_version(data_dir):
    vf = get_bundle_version_file(data_dir)
    if os.path.exists(vf):
        try:
            with open(vf, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_bundle_version(data_dir, info):
    vf = get_bundle_version_file(data_dir)
    with open(vf, 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

def get_version_file(data_dir):
    """获取版本信息文件路径"""
    return os.path.join(get_apk_updates_dir(data_dir), "version.json")

def load_version_info(data_dir):
    """加载版本信息"""
    vf = get_version_file(data_dir)
    if os.path.exists(vf):
        try:
            with open(vf, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_version_info(data_dir, info):
    """保存版本信息"""
    vf = get_version_file(data_dir)
    with open(vf, 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)

def get_current_apk_info(data_dir):
    """获取当前已存储的最新 APK 信息"""
    version_info = load_version_info(data_dir)
    latest = version_info.get("latest", {})
    if latest.get("filename") and latest.get("version"):
        apk_dir = get_apk_updates_dir(data_dir)
        apk_path = os.path.join(apk_dir, latest["filename"])
        if os.path.exists(apk_path):
            return latest
    return None

def init_ota_routes(app, data_dir_func):
    """
    注册 OTA 路由
    data_dir_func: 返回 DATA_DIR 的函数（兼容 PyInstaller frozen 模式）
    """
    ota_bp = Blueprint('ota', __name__)

    @ota_bp.route('/api/update/check', methods=['GET'])
    def check_update():
        """
        版本检查接口
        参数: app (默认 display)
        返回: { hasUpdate, latest: { version, filename, size, note } }
        """
        app_name = "display"
        data_dir = data_dir_func()
        apk_updates_dir = get_apk_updates_dir(data_dir)

        # 获取版本信息
        version_info = load_version_info(data_dir)
        latest = version_info.get("latest", {})

        if not latest.get("filename"):
            return jsonify({
                "hasUpdate": False,
                "message": "暂无更新",
                "latest": None
            })

        # 检查 APK 文件是否存在
        apk_path = os.path.join(apk_updates_dir, latest["filename"])
        if not os.path.exists(apk_path):
            return jsonify({
                "hasUpdate": False,
                "message": "APK 文件不存在",
                "latest": None
            })

        apk_size = os.path.getsize(apk_path)

        return jsonify({
            "hasUpdate": True,
            "version": latest.get("version", ""),
            "filename": latest["filename"],
            "size": apk_size,
            "note": latest.get("note", ""),
            "downloadUrl": f"/api/update/download/{latest['filename']}"
        })

    @ota_bp.route('/api/update/download/<filename>', methods=['GET'])
    def download_apk(filename):
        """
        APK 下载接口
        仅允许下载 apk_updates 目录下的 .apk 文件
        """
        data_dir = data_dir_func()
        apk_updates_dir = get_apk_updates_dir(data_dir)

        # 安全检查：只允许 .apk 文件
        safe_name = os.path.basename(filename)
        if not safe_name.endswith('.apk'):
            abort(403)

        apk_path = os.path.join(apk_updates_dir, safe_name)
        if not os.path.exists(apk_path):
            abort(404)

        return send_from_directory(
            apk_updates_dir,
            safe_name,
            as_attachment=True,
            download_name=safe_name
        )

    @ota_bp.route('/api/update/publish', methods=['POST'])
    def publish_update():
        """
        发布新版本（管理员接口）
        请求体: { version, filename, note }
        将指定文件标记为最新版本
        """
        from flask import request

        data_dir = data_dir_func()
        apk_updates_dir = get_apk_updates_dir(data_dir)

        body = request.get_json() or {}
        version = body.get("version", "").strip()
        filename = body.get("filename", "").strip()
        note = body.get("note", "")

        if not version or not filename:
            return jsonify({"error": "version 和 filename 不能为空"}), 400

        if not filename.endswith('.apk'):
            return jsonify({"error": "只支持 .apk 文件"}), 400

        apk_path = os.path.join(apk_updates_dir, filename)
        if not os.path.exists(apk_path):
            return jsonify({"error": f"文件不存在: {filename}"}), 404

        version_info = {
            "latest": {
                "version": version,
                "filename": filename,
                "size": os.path.getsize(apk_path),
                "note": note,
                "published_at": __import__('datetime').datetime.now().isoformat()
            }
        }
        save_version_info(data_dir, version_info)

        print(f"[OTA] 发布新版本: {version} ({filename})")
        return jsonify({"success": True, "version": version, "filename": filename})

    @ota_bp.route('/api/update/current', methods=['GET'])
    def current_version():
        """获取当前已发布的版本信息"""
        data_dir = data_dir_func()
        info = get_current_apk_info(data_dir)
        if info:
            return jsonify({"latest": info})
        return jsonify({"latest": None})

    # ──────────────────────────────────────────────────────────────
    #  Web Bundle 热更新路由
    # ──────────────────────────────────────────────────────────────

    @ota_bp.route('/api/update/bundle/version', methods=['GET'])
    def bundle_version():
        """
        返回当前已发布的 bundle 版本信息（设备轮询或 SSE 触发后用于核对版本）
        无需认证（展示端设备直接调用）
        """
        data_dir = data_dir_func()
        info = load_bundle_version(data_dir)
        if not info.get("version"):
            return jsonify({"hasBundle": False, "version": None})

        bundle_path = os.path.join(get_bundle_updates_dir(data_dir), "bundle.zip")
        if not os.path.exists(bundle_path):
            return jsonify({"hasBundle": False, "version": None, "message": "bundle.zip 不存在"})

        return jsonify({
            "hasBundle": True,
            "version":       info["version"],
            "displayVersion": info.get("displayVersion") or info["version"],
            "size":          os.path.getsize(bundle_path),
            "note":          info.get("note", ""),
            "publishedAt":   info.get("published_at", ""),
            "downloadUrl":   "/api/update/bundle/download",
        })

    @ota_bp.route('/api/update/bundle/download', methods=['GET'])
    def bundle_download():
        """
        下载 bundle.zip（无需认证）
        设备调用此接口下载最新 Web Bundle 并热替换
        """
        data_dir = data_dir_func()
        bundle_dir = get_bundle_updates_dir(data_dir)
        bundle_path = os.path.join(bundle_dir, "bundle.zip")
        if not os.path.exists(bundle_path):
            abort(404)
        return send_from_directory(bundle_dir, "bundle.zip",
                                   as_attachment=True,
                                   download_name="bundle.zip")

    @ota_bp.route('/api/update/bundle/publish', methods=['POST'])
    def bundle_publish():
        """
        发布新 bundle（由 publish_bundle.py 构建脚本调用）
        请求体: { version: str, note?: str }
        该接口同时会通过 SSE 广播 bundle_update 命令给所有在线设备
        """
        from auth import decode_token, get_token_from_header
        token = get_token_from_header()
        # 允许内网无 token 调用（构建脚本本地调用），或有效 token 调用
        # 通过检查是否来自 127.0.0.1 决定是否跳过认证
        from flask import request as req
        is_localhost = req.remote_addr in ('127.0.0.1', '::1', 'localhost')
        if not is_localhost and (not token or not decode_token(token)):
            return jsonify({'error': '需要认证'}), 401

        data_dir = data_dir_func()
        bundle_dir = get_bundle_updates_dir(data_dir)
        bundle_path = os.path.join(bundle_dir, "bundle.zip")

        if not os.path.exists(bundle_path):
            return jsonify({'error': 'bundle.zip 不存在，请先上传'}), 400

        body = flask_request.get_json() or {}
        version = body.get("version", "").strip()
        display_version = body.get("displayVersion", version).strip() or version
        note    = body.get("note", "")

        if not version:
            return jsonify({'error': 'version 不能为空'}), 400

        import datetime
        info = {
            "version":        version,
            "displayVersion": display_version,
            "size":           os.path.getsize(bundle_path),
            "note":           note,
            "published_at":    datetime.datetime.now().isoformat(),
        }
        save_bundle_version(data_dir, info)
        print(f"[OTA] 发布新 bundle 版本: {display_version} (hash: {version})")

        # 广播 bundle_update 给所有在线设备
        try:
            from command_pusher import sse_manager
            online = sse_manager.get_online_uuids()
            broadcast_payload = {
                "version":       version,
                "displayVersion": display_version,
                "downloadUrl":  "/api/update/bundle/download",
                "note":          note,
            }
            sent = sum(
                1 for uuid in online
                if sse_manager.send_command(uuid, "bundle_update", broadcast_payload)
            )
            print(f"[OTA] 已广播 bundle_update 到 {sent}/{len(online)} 台在线设备")
        except Exception as e:
            print(f"[OTA] 广播 bundle_update 失败: {e}")
            sent = 0

        return jsonify({
            "success":      True,
            "version":      version,
            "displayVersion": display_version,
            "online_count": len(sse_manager.get_online_uuids()) if 'sse_manager' in dir() else 0,
            "sent_count":   sent,
        })

    @ota_bp.route('/api/update/bundle/current', methods=['GET'])
    def bundle_current():
        """管理端查看当前已发布 bundle 信息"""
        data_dir = data_dir_func()
        info = load_bundle_version(data_dir)
        bundle_path = os.path.join(get_bundle_updates_dir(data_dir), "bundle.zip")
        return jsonify({
            "version":        info.get("version"),
            "displayVersion":  info.get("displayVersion", info.get("version")),
            "note":           info.get("note", ""),
            "publishedAt":    info.get("published_at", ""),
            "size":           os.path.getsize(bundle_path) if os.path.exists(bundle_path) else 0,
        })

    app.register_blueprint(ota_bp)
    print(f"[OTA] 路由已注册，APK 目录: {get_apk_updates_dir(data_dir_func())}")
    print(f"[OTA] Bundle 目录: {get_bundle_updates_dir(data_dir_func())}")
