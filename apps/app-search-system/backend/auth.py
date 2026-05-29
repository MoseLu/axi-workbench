#!/usr/bin/env python3
"""
SOP 系统 JWT 认证模块
"""
import sys
import os
import time
import jwt
from functools import wraps
from flask import request, jsonify, g

# ============== 路径处理 ==============
def get_data_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

# ============== JWT 配置 ==============
SECRET_KEY = 'sop-system-secret-key-2024'  # 生产环境应从配置文件读取
ALGORITHM = 'HS256'
TOKEN_EXPIRE_HOURS = 24 * 7  # 7天


def generate_token(user_id: int, username: str, role: str) -> str:
    """生成 JWT token"""
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': int(time.time()) + TOKEN_EXPIRE_HOURS * 3600,
        'iat': int(time.time()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """解码 JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_from_header():
    """从请求头获取 token"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def jwt_required(f):
    """JWT 认证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({'error': '未提供认证令牌'}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({'error': '令牌无效或已过期'}), 401

        g.user_id = payload['user_id']
        g.username = payload['username']
        g.role = payload['role']
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """管理员权限装饰器"""
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if g.role != 'admin':
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated


# ============== 认证 API ==============
def init_auth_routes(app):
    """注册认证路由"""
    from models import get_user_by_username, get_user_by_id, update_user_password, list_users, delete_user, verify_password

    @app.route('/api/auth/login', methods=['POST'])
    def auth_login():
        """登录"""
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400

        user = get_user_by_username(username)
        if not user:
            return jsonify({'error': '用户名或密码错误'}), 401

        if not verify_password(password, user['password_hash']):
            return jsonify({'error': '用户名或密码错误'}), 401

        token = generate_token(user['id'], user['username'], user['role'])
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'must_change_password': bool(user['must_change_password']),
            }
        })

    @app.route('/api/auth/me', methods=['GET'])
    @jwt_required
    def auth_me():
        """获取当前用户信息"""
        user = get_user_by_id(g.user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'must_change_password': bool(user['must_change_password']),
        })

    @app.route('/api/auth/change-password', methods=['POST'])
    @jwt_required
    def auth_change_password():
        """修改密码"""
        data = request.get_json() or {}
        old_password = data.get('old_password', '')
        new_password = data.get('new_password', '')

        if not new_password or len(new_password) < 6:
            return jsonify({'error': '新密码长度不能少于6位'}), 400

        user = get_user_by_id(g.user_id)
        if not verify_password(old_password, user['password_hash']):
            return jsonify({'error': '原密码错误'}), 400

        update_user_password(g.user_id, new_password)
        return jsonify({'message': '密码修改成功'})

    @app.route('/api/auth/users', methods=['GET'])
    @admin_required
    def auth_list_users():
        """列出所有用户"""
        return jsonify(list_users())

    @app.route('/api/auth/users', methods=['POST'])
    @admin_required
    def auth_create_user():
        """创建用户"""
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'admin')

        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
        if len(password) < 6:
            return jsonify({'error': '密码长度不能少于6位'}), 400

        try:
            from models import create_user
            user_id = create_user(username, password, role)
            return jsonify({'id': user_id, 'username': username, 'role': role}), 201
        except Exception as e:
            if 'UNIQUE constraint' in str(e):
                return jsonify({'error': '用户名已存在'}), 409
            return jsonify({'error': str(e)}), 500

    @app.route('/api/auth/users/<int:user_id>', methods=['DELETE'])
    @admin_required
    def auth_delete_user(user_id):
        """删除用户"""
        if user_id == g.user_id:
            return jsonify({'error': '不能删除自己'}), 400
        if delete_user(user_id):
            return jsonify({'message': '删除成功'})
        return jsonify({'error': '用户不存在'}), 404
