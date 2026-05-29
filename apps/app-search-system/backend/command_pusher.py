#!/usr/bin/env python3
"""
SOP 系统命令推送模块（Server-Sent Events）
"""
import sys
import os
import json
import time
import queue
import threading
from collections import defaultdict
from flask import Response, request, jsonify

# ============== 路径处理 ==============
def get_data_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


# ============== SSE 连接管理器 ==============
class SSEConnectionManager:
    """SSE 连接管理器"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._connections = {}      # uuid -> queue.Queue
        self._device_ids = {}       # uuid -> device_id
        self._lock = threading.Lock()
        self._pending_heartbeats = set()   # 待批量刷新的心跳 uuid 集合
        self._hb_lock = threading.Lock()   # 保护 _pending_heartbeats
        self._start_heartbeat_flusher()    # 启动心跳批量刷新守护线程
        print("[SSE] 连接管理器已初始化")

    def queue_heartbeat(self, device_uuid: str):
        """将心跳加入批量队列（非立即写库，由后台线程每 10s 批量刷新）"""
        with self._hb_lock:
            self._pending_heartbeats.add(device_uuid)

    def _start_heartbeat_flusher(self):
        """启动心跳批量刷新守护线程（每 10 秒批量写一次 DB，替代每台设备独立写入）"""
        def _flush():
            from models import batch_update_heartbeat
            while True:
                time.sleep(10)
                with self._hb_lock:
                    if not self._pending_heartbeats:
                        continue
                    uuids = list(self._pending_heartbeats)
                    self._pending_heartbeats.clear()
                try:
                    batch_update_heartbeat(uuids)
                except Exception as e:
                    print(f"[SSE] 心跳批量刷新失败: {e}")
        threading.Thread(target=_flush, daemon=True).start()

    def add_connection(self, device_uuid: str, device_id: int):
        """添加 SSE 连接。若该设备已有旧连接，先发送 stop 信号让旧生成器退出。"""
        with self._lock:
            if device_uuid in self._connections:
                # 通知旧生成器退出，避免两个生成器同时消费同一队列
                try:
                    self._connections[device_uuid].put_nowait(('stop', {}))
                except queue.Full:
                    pass
            q = queue.Queue(maxsize=50)
            self._connections[device_uuid] = q
            self._device_ids[device_uuid] = device_id
            print(f"[SSE] 设备连接: {device_uuid} (在线: {len(self._connections)})")

    def remove_connection(self, device_uuid: str):
        """移除 SSE 连接"""
        with self._lock:
            if device_uuid in self._connections:
                del self._connections[device_uuid]
                self._device_ids.pop(device_uuid, None)
                print(f"[SSE] 设备断开: {device_uuid} (在线: {len(self._connections)})")

    def remove_connection_if_same(self, device_uuid: str, q):
        """
        仅当 _connections[uuid] 指向的就是 q 时，才移除连接。
        避免旧生成器的 finally 误删新连接（发生在设备快速重连场景）。
        """
        with self._lock:
            current_q = self._connections.get(device_uuid)
            if current_q is q:
                del self._connections[device_uuid]
                self._device_ids.pop(device_uuid, None)
                print(f"[SSE] 设备断开: {device_uuid} (在线: {len(self._connections)})")

    def get_queue(self, device_uuid: str):
        """获取设备的命令队列"""
        with self._lock:
            return self._connections.get(device_uuid)

    def is_online(self, device_uuid: str) -> bool:
        with self._lock:
            return device_uuid in self._connections

    def get_online_uuids(self) -> list:
        with self._lock:
            return list(self._connections.keys())

    def send_command(self, device_uuid: str, command_type: str, payload: dict) -> bool:
        """向指定设备发送命令（放入队列）"""
        with self._lock:
            if device_uuid not in self._connections:
                return False
            q = self._connections[device_uuid]
        try:
            data = {
                'type': command_type,
                'payload': payload,
                'timestamp': int(time.time())
            }
            q.put_nowait(('command', data))
            return True
        except queue.Full:
            return False

    def send_heartbeat(self, device_uuid: str):
        """发送心跳"""
        with self._lock:
            if device_uuid not in self._connections:
                return
            q = self._connections[device_uuid]
        try:
            q.put_nowait(('heartbeat', {'ts': int(time.time())}))
        except queue.Full:
            pass

    def broadcast(self, command_type: str, payload: dict):
        """广播命令到所有在线设备"""
        with self._lock:
            uuids = list(self._connections.keys())
        for uuid in uuids:
            self.send_command(uuid, command_type, payload)


# 全局连接管理器
sse_manager = SSEConnectionManager()


def init_command_routes(app):
    """注册命令推送路由"""
    from models import (
        get_device_by_uuid, get_devices_by_ids, get_devices_by_uuids, get_pending_commands,
        mark_command_sent, mark_commands_sent_batch, mark_command_acknowledged,
        create_commands_batch, acknowledge_all_pending, list_commands, get_command_stats,
        update_device_heartbeat, update_device_display, batch_update_device_display, list_devices
    )
    import models

    def require_auth():
        """检查 JWT 认证"""
        from auth import decode_token, get_token_from_header
        token = get_token_from_header()
        if not token or not decode_token(token):
            return False
        return True

    def _update_display_targets(target_uuids: list[str], command_type: str, payload: dict):
        """批量维护设备当前展示状态，离线设备也要保留恢复上下文。"""
        if not target_uuids:
            return
        if command_type == 'show_image':
            current_image = payload.get('image_url') or payload.get('image_path', '')
            batch_update_device_display(
                target_uuids,
                current_job=payload.get('job_name', ''),
                current_image=current_image,
                current_command_type=command_type,
                current_payload=payload,
            )
        elif command_type == 'show_job':
            batch_update_device_display(
                target_uuids,
                current_job=payload.get('job_name', ''),
                current_image='',
                current_command_type=command_type,
                current_payload=payload,
            )
        elif command_type == 'clear':
            batch_update_device_display(
                target_uuids,
                current_job='',
                current_image='',
                current_command_type='',
                current_payload=None,
            )

    def _normalize_target_devices(target_devices: list[dict]) -> list[dict]:
        normalized = []
        seen = set()
        for device in target_devices or []:
            uuid_value = (device.get('uuid') or '').strip()
            if not uuid_value:
                continue
            key = uuid_value.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(device)
        return normalized

    def _dispatch_commands(target_devices: list[dict], command_type: str, payload: dict) -> dict:
        """单次请求内完成批量建命令、批量更新展示状态和在线设备下发。"""
        devices = _normalize_target_devices(target_devices)
        if not devices:
            return {
                'device_count': 0,
                'online_count': 0,
                'sent_count': 0,
                'queued_count': 0,
                'queue_full_count': 0,
                'command_ids': [],
            }

        command_rows = create_commands_batch([int(device['id']) for device in devices], command_type, payload)
        command_id_by_device_id = {row['device_id']: row['command_id'] for row in command_rows}
        target_uuids = [device['uuid'] for device in devices]
        _update_display_targets(target_uuids, command_type, payload)

        online_uuids = set(sse_manager.get_online_uuids())
        sent_command_ids: list[int] = []
        sent_count = 0
        queued_count = 0
        queue_full_count = 0
        online_count = 0

        for device in devices:
            command_id = command_id_by_device_id.get(int(device['id']))
            device_uuid = device['uuid']
            if device_uuid in online_uuids:
                online_count += 1
                if sse_manager.send_command(device_uuid, command_type, payload):
                    sent_count += 1
                    if command_id:
                        sent_command_ids.append(command_id)
                else:
                    queued_count += 1
                    queue_full_count += 1
            else:
                queued_count += 1

        if sent_command_ids:
            mark_commands_sent_batch(sent_command_ids)

        return {
            'device_count': len(devices),
            'online_count': online_count,
            'sent_count': sent_count,
            'queued_count': queued_count,
            'queue_full_count': queue_full_count,
            'command_ids': [row['command_id'] for row in command_rows],
        }

    def command_subscribe():
        """设备 SSE 订阅命令流"""
        print(f"[DEBUG] command_subscribe called", flush=True)
        device_uuid = request.args.get('uuid', '').strip()
        print(f"[DEBUG] device_uuid = {device_uuid}", flush=True)
        if not device_uuid:
            return Response("data: {\"error\":\"uuid required\"}\n\n", status=400)

        device = get_device_by_uuid(device_uuid)
        print(f"[DEBUG] device = {device}", flush=True)
        if not device:
            print(f"[SSE] 拒绝未注册设备连接: {device_uuid}", flush=True)
            return Response("data: {\"error\":\"device not registered\"}\n\n", status=404)

        device_id = device['id']
        update_device_heartbeat(device_uuid, ip_address=request.remote_addr)

        # 注册连接，并保存本次连接的 queue 对象（用于 finally 中精准清理）
        sse_manager.add_connection(device_uuid, device_id)
        local_queue = sse_manager.get_queue(device_uuid)

        def generate():
            try:
                # 发送连接成功消息
                yield f"event: connected\ndata: {json.dumps({'uuid': device_uuid})}\n\n"

                # 发送 pending 命令
                pending = get_pending_commands(device_id)
                for cmd in pending:
                    try:
                        payload = json.loads(cmd['payload']) if isinstance(cmd['payload'], str) else cmd['payload']
                        data = {
                            'id': cmd['id'],
                            'type': cmd['command_type'],
                            'payload': payload,
                            'timestamp': int(time.time())
                        }
                        mark_command_sent(cmd['id'])
                        yield f"event: command\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        print(f"[SSE] 发送 pending 命令失败: {e}")

                # 重连时恢复当前显示状态（设备重启/网络闪断后，保持原展示内容）
                current_job = device.get('current_job', '') or ''
                current_image = device.get('current_image', '') or ''
                current_command_type = device.get('current_command_type', '') or ''
                current_payload_raw = device.get('current_payload', '') or ''
                current_payload = {}
                if current_payload_raw:
                    try:
                        current_payload = json.loads(current_payload_raw)
                    except Exception:
                        current_payload = {}

                if not current_payload and (current_job or current_image):
                    current_payload = {'job_name': current_job}
                    if current_image:
                        current_payload['image_path'] = current_image

                restore_type = current_command_type or ('show_image' if current_image else 'show_job')
                if current_payload:
                    print(f"[SSE] 重连恢复显示: job={current_job}, type={restore_type}", flush=True)
                    restore_data = {
                        'type': restore_type,
                        'payload': current_payload,
                        'timestamp': int(time.time()),
                    }
                    yield f"event: command\ndata: {json.dumps(restore_data, ensure_ascii=False)}\n\n"

                # 保持连接，定期发送心跳
                heartbeat_interval = 25  # 秒
                last_heartbeat = time.time()

                while True:
                    # 获取当前设备的队列；若已被新连接替换，队列对象会不同，
                    # 旧生成器收到 stop 信号后退出（在下面的 msg_type 判断里处理）
                    q = sse_manager.get_queue(device_uuid)
                    if q is None:
                        # 连接已被 remove_connection 清除，退出
                        break

                    now = time.time()

                    # 每 25 秒发送心跳
                    if now - last_heartbeat >= heartbeat_interval:
                        yield f"event: heartbeat\ndata: {json.dumps({'ts': int(now)})}\n\n"
                        last_heartbeat = now
                        sse_manager.queue_heartbeat(device_uuid)

                    # 非阻塞检查队列（最多等 1 秒）
                    try:
                        msg_type, msg_data = q.get(timeout=1)
                        if msg_type == 'stop':
                            # 新连接到来时，旧生成器收到 stop 信号，静默退出
                            break
                        elif msg_type == 'command':
                            yield f"event: command\ndata: {json.dumps(msg_data, ensure_ascii=False)}\n\n"
                        elif msg_type == 'heartbeat':
                            yield f"event: heartbeat\ndata: {json.dumps(msg_data)}\n\n"
                    except queue.Empty:
                        pass

            except GeneratorExit:
                pass  # 客户端主动关闭连接（正常情况）
            except Exception as e:
                # BrokenPipeError / ConnectionResetError 等网络异常
                print(f"[SSE] 连接异常断开 ({device_uuid}): {type(e).__name__}: {e}")
            finally:
                # 无论何种原因退出，都确保清理连接
                # 注意：若是 stop 信号退出（新连接覆盖），此时 _connections[uuid] 已是新队列，
                # remove_connection 会看到 uuid 存在但指向新连接，不能删！
                # 因此需要比对 queue 对象身份
                sse_manager.remove_connection_if_same(device_uuid, local_queue)

        response = Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            }
        )
        return response

    # 显式注册路由（避免装饰器在闭包中可能失效的问题）
    app.add_url_rule('/api/command/subscribe', 'command_subscribe', command_subscribe, methods=['GET'])

    def command_send():
        """发送命令到指定设备"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        data = request.get_json() or {}
        device_uuid = data.get('device_uuid', '').strip()
        device_id = data.get('device_id')
        command_type = data.get('type', 'show_image')
        payload = data.get('payload', {})

        if not isinstance(payload, dict):
            return jsonify({'error': 'payload 必须是对象'}), 400

        if device_uuid:
            devices = get_devices_by_uuids([device_uuid])
        elif device_id:
            devices = get_devices_by_ids([device_id])
        else:
            return jsonify({'error': '必须提供 device_uuid 或 device_id'}), 400

        if not devices:
            return jsonify({'error': '设备不存在'}), 404

        device = devices[0]
        result = _dispatch_commands([device], command_type, payload)
        command_id = result['command_ids'][0] if result['command_ids'] else None
        if result['sent_count'] == 1:
            return jsonify({'status': 'sent', 'command_id': command_id})

        note = '设备离线，命令已存入队列'
        if result['queue_full_count'] > 0:
            note = '在线但队列满，命令已转为待发送'
        return jsonify({'status': 'queued', 'command_id': command_id, 'note': note})

    def command_send_batch():
        """批量发送命令到多台设备（单请求合并分发）。"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        data = request.get_json() or {}
        command_type = data.get('type', 'show_image')
        payload = data.get('payload', {})
        device_uuids = data.get('device_uuids')
        device_ids = data.get('device_ids')

        if not isinstance(payload, dict):
            return jsonify({'error': 'payload 必须是对象'}), 400
        if device_uuids is not None and not isinstance(device_uuids, list):
            return jsonify({'error': 'device_uuids 必须是数组'}), 400
        if device_ids is not None and not isinstance(device_ids, list):
            return jsonify({'error': 'device_ids 必须是数组'}), 400

        requested_uuids = [
            (item or '').strip()
            for item in (device_uuids or [])
            if isinstance(item, str) and (item or '').strip()
        ]
        requested_ids = list(device_ids or [])

        if not requested_uuids and not requested_ids:
            return jsonify({'error': '必须提供 device_uuids 或 device_ids'}), 400
        if len(requested_uuids) + len(requested_ids) > 500:
            return jsonify({'error': '单次最多推送 500 台设备'}), 400

        resolved_by_uuid = get_devices_by_uuids(requested_uuids)
        resolved_by_id = get_devices_by_ids(requested_ids)
        devices = _normalize_target_devices(resolved_by_uuid + resolved_by_id)
        if not devices:
            return jsonify({'error': '设备不存在'}), 404

        resolved_uuid_keys = {(device.get('uuid') or '').strip().lower() for device in devices}
        missing_uuids = [item for item in requested_uuids if item.lower() not in resolved_uuid_keys]
        resolved_ids = {int(device['id']) for device in devices}
        missing_ids = []
        for item in requested_ids:
            try:
                device_id = int(item)
            except (TypeError, ValueError):
                continue
            if device_id not in resolved_ids:
                missing_ids.append(device_id)

        result = _dispatch_commands(devices, command_type, payload)
        return jsonify({
            'status': 'batch',
            'device_count': result['device_count'],
            'online_count': result['online_count'],
            'sent_count': result['sent_count'],
            'queued_count': result['queued_count'],
            'queue_full_count': result['queue_full_count'],
            'missing_count': len(missing_uuids) + len(missing_ids),
            'missing_uuids': missing_uuids[:20],
            'missing_ids': missing_ids[:20],
        })

    def command_send_all():
        """广播命令到所有已配置设备，离线设备进入待发送队列。"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        data = request.get_json() or {}
        command_type = data.get('type', 'show_image')
        payload = data.get('payload', {})
        if not isinstance(payload, dict):
            return jsonify({'error': 'payload 必须是对象'}), 400

        devices = list_devices(include_offline=True)
        if not devices:
            return jsonify({'error': '暂无已配置设备'}), 404

        result = _dispatch_commands(devices, command_type, payload)

        return jsonify({
            'status': 'broadcast',
            'device_count': result['device_count'],
            'online_count': result['online_count'],
            'sent_count': result['sent_count'],
            'queued_count': result['queued_count'],
            'queue_full_count': result['queue_full_count'],
        })

    def command_send_to_group():
        """按分组推送命令到该分组所有设备，离线设备进入待发送队列。"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        data = request.get_json() or {}
        command_type = data.get('type', 'show_image')
        payload = data.get('payload', {})
        group = data.get('group', '').strip()

        if not group:
            return jsonify({'error': '必须提供 group 参数'}), 400
        if not isinstance(payload, dict):
            return jsonify({'error': 'payload 必须是对象'}), 400

        group_devices = list_devices(include_offline=True, group=group)
        if not group_devices:
            return jsonify({'error': f'分组 "{group}" 不存在或无设备'}), 404

        result = _dispatch_commands(group_devices, command_type, payload)

        return jsonify({
            'status': 'broadcast_group',
            'group': group,
            'device_count': result['device_count'],
            'online_count': result['online_count'],
            'sent_count': result['sent_count'],
            'queued_count': result['queued_count'],
            'queue_full_count': result['queue_full_count'],
        })

    def command_history():
        """命令历史"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        device_id = request.args.get('device_id', type=int)
        limit = request.args.get('limit', 100, type=int)
        history = list_commands(device_id, limit)

        for cmd in history:
            try:
                cmd['payload'] = json.loads(cmd['payload'])
            except Exception:
                pass

        return jsonify(history)

    def command_stats():
        """命令统计"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        return jsonify(get_command_stats())

    def device_report_status():
        """设备主动上报状态（无需认证，设备通过 SSE 心跳保持连接）"""
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        is_fullscreen = data.get('is_fullscreen', True)  # 默认 True 保持兼容性
        current_image = data.get('current_image', '')
        current_job = data.get('current_job', '')

        if not device_uuid:
            return jsonify({'error': '必须提供 uuid'}), 400

        # 如果设备退出全屏，清除显示状态；否则更新当前显示状态
        if not is_fullscreen:
            update_device_display(
                device_uuid,
                current_job='',
                current_image='',
                current_command_type='',
                current_payload=None,
            )
        else:
            with models.get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE devices
                    SET current_job = ?, current_image = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE uuid = ?
                ''', (current_job, current_image, device_uuid))

        return jsonify({'status': 'ok'})

    def devices_online():
        """获取在线设备列表"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        online = sse_manager.get_online_uuids()
        return jsonify({'online_uuids': online, 'count': len(online)})

    # 显式注册所有路由
    app.add_url_rule('/api/command/send', 'command_send', command_send, methods=['POST'])
    app.add_url_rule('/api/command/send-batch', 'command_send_batch', command_send_batch, methods=['POST'])
    app.add_url_rule('/api/command/send-all', 'command_send_all', command_send_all, methods=['POST'])
    app.add_url_rule('/api/command/send-to-group', 'command_send_to_group', command_send_to_group, methods=['POST'])
    app.add_url_rule('/api/command/history', 'command_history', command_history, methods=['GET'])
    app.add_url_rule('/api/command/stats', 'command_stats', command_stats, methods=['GET'])
    app.add_url_rule('/api/devices/report', 'device_report_status', device_report_status, methods=['POST'])
    app.add_url_rule('/api/devices/online', 'devices_online', devices_online, methods=['GET'])
