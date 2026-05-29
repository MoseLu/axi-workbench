# SOP文件同步工具

## 概述

自动同步 `\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)` 网络共享目录到本地，并触发向量数据库更新。

## 文件结构

```
E:\app\
├── sop\
│   ├── src\                    # 代码目录
│   │   ├── sync_sop.py         # 主同步脚本
│   │   ├── sync_task.bat       # Windows计划任务调用的批处理
│   │   ├── setup_schedule.py   # 计划任务配置脚本
│   │   ├── test_embedding.py   # 向量数据库脚本
│   │   ├── sync_history.db    # SQLite数据库
│   │   ├── logs\               # 日志目录
│   │   └── README.md          # 本文件
│   └── asserts\                # SOP文件目录（只读）
│       ├── PA组件包装SOP\
│       ├── 成品包装SOP\
│       ├── 化学品SOP\
│       ├── 装配 SOP\
│       └── 测试 SOP\
```

## 使用方法

### 1. 检查同步差异（只读模式）

```bash
cd E:\app\sop\src
python sync_sop.py
```

### 2. 执行实际同步

```bash
python sync_sop.py --sync
```

### 3. 查看同步历史

```bash
python sync_sop.py --history
python sync_sop.py --last
```

### 4. 配置Windows计划任务（每天凌晨2:00）

需要管理员权限运行：

```bash
python setup_schedule.py create
```

### 5. 管理计划任务

```bash
python setup_schedule.py list   # 查看状态
python setup_schedule.py delete # 删除任务
```

## 高级选项

```bash
python sync_sop.py --sync --hash  # 使用哈希比较（慢但精确）
```

## 数据库

变更记录保存在 `sync_history.db`：
- `sync_history`: 同步历史
- `file_records`: 文件记录
- `change_details`: 变更详情
