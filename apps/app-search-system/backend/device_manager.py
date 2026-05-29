#!/usr/bin/env python3
"""
SOP 系统设备管理模块
"""
import sys
import os
import json
from flask import request, jsonify

# ============== 路径处理 ==============
def get_data_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


# ============== 设备管理 API ==============
def init_device_routes(app):
    """注册设备管理路由"""
    from models import (
        register_device, list_devices, get_device_by_uuid, create_device_slot, create_device_slots_batch,
        update_device, delete_device, update_device_heartbeat,
        get_pending_commands, acknowledge_all_pending, migrate_device_uuid,
        list_device_groups, delete_test_devices, cleanup_old_devices,
        update_device_location
    )

    def require_auth():
        """检查 JWT 认证"""
        from auth import decode_token, get_token_from_header
        token = get_token_from_header()
        if not token or not decode_token(token):
            return False
        return True

    @app.route('/api/devices/register', methods=['POST'])
    def device_register():
        """展示端注册（用 UUID，无需认证）

        支持 APK 升级场景：传入 old_uuid 会在注册时自动合并旧设备记录。
        """
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        display_name = data.get('display_name', '')
        device_info = data.get('device_info', {})
        old_uuid = data.get('old_uuid', '').strip() or None

        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400

        device = register_device(device_uuid, display_name, device_info, old_uuid=old_uuid, ip_address=request.remote_addr)
        return jsonify({
            'id': device['id'],
            'uuid': device['uuid'],
            'display_name': device['display_name'],
            'sequence_num': device.get('sequence_num'),
            'assigned_jobs': device.get('assigned_job', ''),
            'status': device['status'],
        })

    @app.route('/api/devices/heartbeat', methods=['POST'])
    def device_heartbeat():
        """设备心跳（定时发送，维持在线状态）"""
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()

        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400

        device = get_device_by_uuid(device_uuid)
        if not device:
            return jsonify({'error': '设备未注册'}), 404

        print(f"[DEBUG] heartbeat: uuid={device_uuid}, remote_addr={request.remote_addr}")
        update_device_heartbeat(device_uuid, ip_address=request.remote_addr)

        return jsonify({'status': 'ok'})

    @app.route('/api/devices', methods=['GET'])
    def device_list():
        """列出设备，默认只返回当前已连接的（online + logged_in）

        Query 参数：
        - include_offline=1: 返回所有设备（含 offline）
        - group=二楼: 只返回指定分组的设备
        """
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        include_offline = request.args.get('include_offline', '').strip() in ('1', 'true', 'yes')
        group = request.args.get('group', '').strip() or None
        return jsonify(list_devices(include_offline=include_offline, group=group))

    @app.route('/api/devices', methods=['POST'])
    def device_create():
        """中控端预创建设备位，展示端首次登录时再绑定真实设备。"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        import re
        data = request.get_json() or {}
        sequence_num = data.get('sequence_num', '').strip()
        display_name = data.get('display_name', '').strip()
        device_group = data.get('device_group', '').strip()
        assigned_job = data.get('assigned_job', '').strip()
        device_password = data.get('device_password', '123456').strip() or '123456'

        if not sequence_num:
            return jsonify({'error': '设备编号不能为空'}), 400
        if not re.fullmatch(r'Line\d+-\d+', sequence_num):
            return jsonify({'error': '设备编号格式错误，应为 Line<产线号>-<设备号>，如 Line1-01'}), 400

        try:
            device = create_device_slot(
                sequence_num=sequence_num,
                device_password=device_password,
                display_name=display_name,
                device_group=device_group,
                assigned_job=assigned_job,
            )
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        return jsonify(device), 201

    @app.route('/api/devices/batch-create', methods=['POST'])
    def device_batch_create():
        """中控端批量预创建设备位，避免依赖外部表格导入。"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        import re
        data = request.get_json() or {}
        raw_devices = data.get('devices')
        if not isinstance(raw_devices, list) or not raw_devices:
            return jsonify({'error': 'devices 必须是非空数组'}), 400
        if len(raw_devices) > 300:
            return jsonify({'error': '单次最多批量创建 300 台设备'}), 400

        devices: list[dict] = []
        for index, item in enumerate(raw_devices, start=1):
            if not isinstance(item, dict):
                return jsonify({'error': f'第 {index} 条设备数据格式错误'}), 400

            sequence_num = str(item.get('sequence_num', '')).strip()
            if not sequence_num:
                return jsonify({'error': f'第 {index} 条设备编号不能为空'}), 400
            if not re.fullmatch(r'Line\d+-\d+', sequence_num):
                return jsonify({'error': f'第 {index} 条设备编号格式错误，应为 Line<产线号>-<设备号>'}), 400

            devices.append({
                'sequence_num': sequence_num,
                'display_name': str(item.get('display_name', '')).strip(),
                'device_group': str(item.get('device_group', '')).strip(),
                'assigned_job': str(item.get('assigned_job', '')).strip(),
                'device_password': str(item.get('device_password', '123456')).strip() or '123456',
            })

        try:
            created = create_device_slots_batch(devices)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        return jsonify({
            'created_count': len(created),
            'devices': created,
        }), 201

    @app.route('/api/devices/groups', methods=['GET'])
    def device_groups():
        """返回所有已配置的分组名称"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        return jsonify(list_device_groups())

    @app.route('/api/devices/<int:device_id>', methods=['GET'])
    def device_get(device_id):
        """获取单个设备"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        devices = list_devices(include_offline=True)
        for d in devices:
            if d['id'] == device_id:
                return jsonify(d)
        return jsonify({'error': '设备不存在'}), 404

    @app.route('/api/devices/<int:device_id>', methods=['PUT'])
    def device_update(device_id):
        """更新设备信息（支持分组）"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        import re
        data = request.get_json() or {}
        display_name = data.get('display_name')
        sequence_num = data.get('sequence_num')
        assigned_job = data.get('assigned_job')
        device_group = data.get('device_group')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        ip_address = data.get('ip_address')

        # 设备编号格式验证（可选，修改时才验证）
        if sequence_num and not re.fullmatch(r'Line\d+-\d+', sequence_num):
            return jsonify({'error': '设备编号格式错误，应为 Line<产线号>-<设备号>，如 Line1-01'}), 400

        if update_device(device_id, display_name, sequence_num, assigned_job, device_group,
                         latitude=latitude, longitude=longitude, ip_address=ip_address):
            devices = list_devices(include_offline=True)
            for d in devices:
                if d['id'] == device_id:
                    return jsonify(d)
        return jsonify({'error': '设备不存在'}), 404

    @app.route('/api/devices/<int:device_id>', methods=['DELETE'])
    def device_delete(device_id):
        """删除设备"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        if delete_device(device_id):
            return jsonify({'message': '删除成功'})
        return jsonify({'error': '设备不存在'}), 404

    @app.route('/api/devices/<device_uuid>/pending-commands', methods=['GET'])
    def device_get_pending_commands(device_uuid):
        """获取待执行的命令（设备连接时调用）"""
        device = get_device_by_uuid(device_uuid)
        if not device:
            return jsonify({'error': '设备未注册'}), 404

        pending = get_pending_commands(device['id'])
        acknowledge_all_pending(device['id'])

        # 解析 JSON payload
        for cmd in pending:
            try:
                cmd['payload'] = json.loads(cmd['payload'])
            except Exception:
                pass
            # 标记为已发送
            from models import mark_command_sent
            mark_command_sent(cmd['id'])

        return jsonify(pending)

    @app.route('/api/devices/migrate-uuid', methods=['POST'])
    def device_migrate_uuid():
        """迁移设备UUID（旧随机UUID → 新原生ANDROID_ID），无需认证"""
        data = request.get_json() or {}
        old_uuid = data.get('old_uuid', '').strip()
        new_uuid = data.get('new_uuid', '').strip()

        if not old_uuid or not new_uuid:
            return jsonify({'error': 'old_uuid 和 new_uuid 不能为空'}), 400

        if old_uuid == new_uuid:
            return jsonify({'error': '两个UUID相同，无需迁移'}), 400

        result = migrate_device_uuid(old_uuid, new_uuid)
        return jsonify(result)

    @app.route('/api/devices/merge', methods=['POST'])
    def device_merge():
        """管理员手动合并两个设备（无需认证，直接操作数据库）"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401

        data = request.get_json() or {}
        source_uuid = data.get('source_uuid', '').strip()   # 被合并（废弃）的 UUID
        target_uuid = data.get('target_uuid', '').strip()   # 保留的 UUID

        if not source_uuid or not target_uuid:
            return jsonify({'error': 'source_uuid 和 target_uuid 不能为空'}), 400

        if source_uuid == target_uuid:
            return jsonify({'error': '两个UUID相同，无需合并'}), 400

        result = migrate_device_uuid(source_uuid, target_uuid)
        return jsonify(result)

    @app.route('/api/devices/cleanup-test', methods=['POST'])
    def device_cleanup_test():
        """清理测试UUID格式的设备（随机UUID，非原生设备ID），需要认证"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        deleted = delete_test_devices()
        return jsonify({'deleted': deleted, 'message': f'已删除 {deleted} 个测试设备'})

    @app.route('/api/devices/cleanup-old', methods=['POST'])
    def device_cleanup_old():
        """清理超过指定天数未上线的设备，需要认证"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        data = request.get_json() or {}
        days = data.get('days', 30)
        deleted = cleanup_old_devices(days)
        return jsonify({'deleted': deleted, 'message': f'已删除 {deleted} 个超过 {days} 天未上线的设备'})

    @app.route('/api/devices/location', methods=['POST'])
    def device_update_location():
        """设备上报 GPS 坐标（无需认证），触发自动归组"""
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400
        if latitude is None or longitude is None:
            return jsonify({'error': 'latitude 和 longitude 不能为空'}), 400

        try:
            lat = float(latitude)
            lon = float(longitude)
            if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                return jsonify({'error': '坐标值超出范围'}), 400
        except (TypeError, ValueError):
            return jsonify({'error': 'latitude 和 longitude 必须为数字'}), 400

        ok = update_device_location(device_uuid, lat, lon)
        if not ok:
            return jsonify({'error': '设备未注册'}), 404

        return jsonify({'status': 'ok'})

    # ============== 展示端登录 & 心跳 ==============
    @app.route('/api/display/login', methods=['POST'])
    def display_login():
        """展示端登录：设备编号 + 密码，返回设备 UUID 和基本信息（无需认证）

        设备编号格式必须为 Line<产线号>-<设备号>，如 Line1-01、Line2-03。
        中控端预先创建设备位；展示端首次登录时自动完成 UUID 绑定。
        """
        import re
        from models import authenticate_device, device_login as do_login, bind_device_uuid
        data = request.get_json() or {}
        seq_num = data.get('device_number', '').strip()
        password = data.get('password', '')
        client_uuid = data.get('client_uuid', '').strip()

        if not seq_num or not password:
            return jsonify({'error': '设备编号和密码不能为空'}), 400

        # 格式验证：必须是 Line<产线号>-<设备号>
        if not re.fullmatch(r'Line\d+-\d+', seq_num):
            return jsonify({'error': f'设备编号格式错误，应为 Line<产线号>-<设备号>，如 Line1-01'}), 400

        # 验证设备编号（大小写不敏感）+ 密码
        device = authenticate_device(seq_num, password)
        if not device:
            return jsonify({'error': '设备编号或密码错误'}), 401

        # 首次登录时将预创建设备位绑定到真实设备 UUID；已绑定到其他设备则拒绝登录
        if client_uuid:
            bound = bind_device_uuid(seq_num, client_uuid)
            if not bound:
                return jsonify({'error': '当前设备与该编号未绑定，请联系管理员重新分配'}), 403
            device = do_login(seq_num, password)
            if not device:
                return jsonify({'error': '设备登录状态刷新失败'}), 500
        else:
            device = do_login(seq_num, password)
            if not device:
                return jsonify({'error': '设备登录状态刷新失败'}), 500

        return jsonify({
            'uuid': device['uuid'],
            'device_number': device.get('sequence_num', ''),  # 返回中控端设置的原始编号
            'display_name': device.get('display_name', ''),
            'device_group': device.get('device_group', ''),
            'assigned_jobs': device.get('assigned_jobs', ''),
            'status': 'ok',
        })

    @app.route('/api/display/heartbeat', methods=['POST'])
    def display_heartbeat():
        """
        展示端心跳（约30分钟一次）：
        1. 更新设备在线状态
        2. 检查设备是否仍存在于中控端列表
        """
        from models import get_device_by_uuid, update_device_heartbeat as update_hb
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        device_number = data.get('device_number', '').strip()

        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400

        # 检查设备是否在数据库中存在
        device = get_device_by_uuid(device_uuid)
        if not device:
            return jsonify({'ok': False, 'reason': 'device_not_found', 'message': '设备未注册，请重新登录'}), 200

        # 检查设备编号是否被中控端修改了
        stored_seq = device.get('sequence_num', '') or ''
        if device_number and stored_seq and device_number != stored_seq:
            return jsonify({
                'ok': False,
                'reason': 'device_number_changed',
                'message': f'设备编号已变更为 {stored_seq}，请重新登录',
                'new_device_number': stored_seq,
            }), 200

        # 更新心跳
        update_hb(device_uuid, ip_address=request.remote_addr)

        return jsonify({'ok': True})

    @app.route('/api/display/device', methods=['GET'])
    def display_device_info():
        """展示端获取自身设备信息（无需认证，凭 UUID）"""
        from models import get_device_by_uuid
        device_uuid = request.args.get('uuid', '').strip()
        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400

        device = get_device_by_uuid(device_uuid)
        if not device:
            return jsonify({'error': '设备未找到'}), 404

        return jsonify({
            'uuid': device['uuid'],
            'device_number': device.get('sequence_num', ''),
            'display_name': device.get('display_name', ''),
            'device_group': device.get('device_group', ''),
            'assigned_jobs': device.get('assigned_jobs', ''),
            'status': device.get('status', ''),
        })

    @app.route('/api/display/update-password', methods=['POST'])
    def display_update_password():
        """展示端修改设备密码（UUID + 新密码，无需旧密码）"""
        from models import get_device_by_uuid, hash_password, get_db
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        new_password = data.get('new_password', '').strip()

        if not device_uuid or not new_password:
            return jsonify({'error': 'UUID 和新密码不能为空'}), 400

        device = get_device_by_uuid(device_uuid)
        if not device:
            return jsonify({'error': '设备未找到'}), 404

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE devices SET device_password = ? WHERE uuid = ?',
                (hash_password(new_password), device_uuid)
            )

        return jsonify({'status': 'ok'})

    @app.route('/api/display/logout', methods=['POST'])
    def display_logout():
        """展示端退出登录：清除登录态，回到在线未登录状态。"""
        from models import logout_device
        data = request.get_json() or {}
        device_uuid = data.get('uuid', '').strip()
        if not device_uuid:
            return jsonify({'error': 'UUID 不能为空'}), 400
        ok = logout_device(device_uuid)
        return jsonify({'status': 'ok' if ok else 'not_found'})

    @app.route('/api/devices/<int:device_id>/password', methods=['PUT'])
    def device_update_password(device_id):
        """管理员修改单个设备密码（需要认证）"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        from models import get_db
        data = request.get_json() or {}
        new_password = data.get('new_password', '').strip()
        if not new_password:
            return jsonify({'error': '新密码不能为空'}), 400
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE devices SET device_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (new_password, device_id))
            if cursor.rowcount == 0:
                return jsonify({'error': '设备不存在'}), 404
        return jsonify({'status': 'ok'})

    @app.route('/api/devices/password-all', methods=['PUT'])
    def device_update_all_passwords():
        """管理员批量修改所有设备密码（统一修改，需要认证）"""
        if not require_auth():
            return jsonify({'error': '需要登录'}), 401
        from models import get_db
        data = request.get_json() or {}
        new_password = data.get('new_password', '').strip()
        if not new_password:
            return jsonify({'error': '新密码不能为空'}), 400
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE devices SET device_password = ?, updated_at = CURRENT_TIMESTAMP', (new_password,))
            updated = cursor.rowcount
        return jsonify({'status': 'ok', 'updated': updated})
