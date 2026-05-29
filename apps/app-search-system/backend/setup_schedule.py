#!/usr/bin/env python3
"""
Windows计划任务配置脚本
创建每天凌晨2:00执行的SOP同步任务
"""

import subprocess
import sys
from pathlib import Path

def create_scheduled_task():
    """创建Windows计划任务"""

    # 获取脚本绝对路径
    script_dir = Path(__file__).parent.resolve()
    bat_file = script_dir / "sync_task.bat"

    # 任务名称
    task_name = "SOP_File_Sync"

    # 计划任务命令
    # 每天凌晨2:00执行
    cmd = [
        'schtasks', '/create',
        '/tn', task_name,
        '/tr', str(bat_file),
        '/sc', 'daily',
        '/st', '02:00',
        '/rl', 'HIGHEST',  # 最高权限运行
        '/f'  # 强制覆盖已存在的任务
    ]

    print("创建Windows计划任务...")
    print(f"任务名称: {task_name}")
    print(f"执行文件: {bat_file}")
    print(f"执行时间: 每天 02:00")
    print()

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print("✓ 计划任务创建成功!")
            print()
            print("管理命令:")
            print(f"  查看任务: schtasks /query /tn \"{task_name}\"")
            print(f"  立即运行: schtasks /run /tn \"{task_name}\"")
            print(f"  删除任务: schtasks /delete /tn \"{task_name}\" /f")
            print(f"  修改时间: schtasks /change /tn \"{task_name}\" /st 03:00")
        else:
            print(f"✗ 创建失败: {result.stderr}")
            print()
            print("请尝试以管理员身份运行此脚本")

    except FileNotFoundError:
        print("✗ schtasks命令不可用，请确保在Windows系统上运行")
    except Exception as e:
        print(f"✗ 错误: {e}")


def delete_scheduled_task():
    """删除Windows计划任务"""
    task_name = "SOP_File_Sync"

    cmd = ['schtasks', '/delete', '/tn', task_name, '/f']

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ 已删除计划任务: {task_name}")
        else:
            print(f"✗ 删除失败: {result.stderr}")
    except Exception as e:
        print(f"✗ 错误: {e}")


def list_scheduled_task():
    """查看计划任务状态"""
    task_name = "SOP_File_Sync"

    cmd = ['schtasks', '/query', '/tn', task_name, '/v', '/fo', 'list']

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(result.stdout)
        else:
            print(f"任务不存在或查询失败")
    except Exception as e:
        print(f"✗ 错误: {e}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='SOP同步计划任务管理')
    parser.add_argument('action', choices=['create', 'delete', 'list', 'status'],
                       help='操作: create=创建, delete=删除, list/status=查看')

    args = parser.parse_args()

    if args.action == 'create':
        create_scheduled_task()
    elif args.action == 'delete':
        delete_scheduled_task()
    elif args.action in ['list', 'status']:
        list_scheduled_task()


if __name__ == "__main__":
    main()