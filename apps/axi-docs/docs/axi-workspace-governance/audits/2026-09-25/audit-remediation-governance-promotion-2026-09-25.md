# Governance Completion Promotion Runbook (2026-09-25)

> 本文件由 audit-remediation 自动生成。基于当前 handoff / manifest 状态推导 stage 升级建议。
> 这些升级**不是自动执行**的——它们要求修改 `workspace.graph.json` 中项目的 `completion` 字段，属 owner 决策。

## 升级推导逻辑

```
if handoff == 'documented' and confidence == 'high' and stage == 'unassessed':
    → stage = 'near-complete'

elif handoff == 'documented' and stage == 'unassessed':
    → stage = 'usable'

elif handoff == 'verified' and stage == 'unassessed':
    → stage = 'usable'

# 其他维持
```

## 8 个建议升级项目

| 项目 | 当前 stage | 建议 stage | confidence | handoff |
|---|---|---|---|---|
| axi-apps | unassessed | usable | low | documented |
| axi-inbox | unassessed | usable | low | documented |
| axi-kernel | unassessed | usable | low | verified |
| axi-pet-desktop | unassessed | usable | **high** | verified |
| axi-runtime | unassessed | usable | low | documented |
| axi-sync | unassessed | usable | low | documented |
| axi-workbench-cli | unassessed | usable | low | verified |
| story-graph | unassessed | usable | **high** | verified |

## 修改方式

`workspace.graph.json` 中每个项目的 `completion` 字段是声明式的：

```json
"completion": {
  "stage": "unassessed",   ← 改为 "usable" 或 "near-complete"
  "confidence": "high",
  "summary": "...",
  "updatedAt": "2026-09-25",
  "evidence": [...]
}
```

### 升级命令（脚本示例）

```bash
WORKSPACE=/Volumes/code/workspace
cd $WORKSPACE

# 先备份
cp workspace.graph.json workspace.graph.json.bak-2026-09-25

# 用 jq 批量更新
PROJECTS=("axi-apps" "axi-inbox" "axi-kernel" "axi-pet-desktop" "axi-runtime" "axi-sync" "axi-workbench-cli" "story-graph")

for proj in "${PROJECTS[@]}"; do
  python3 -c "
import json
with open('$WORKSPACE/workspace.graph.json') as f:
    d = json.load(f)
target = '$proj'
if d['projects'][target]['completion']['stage'] == 'unassessed':
    d['projects'][target]['completion']['stage'] = 'usable'
    d['projects'][target]['completion']['updatedAt'] = '2026-09-25'
with open('$WORKSPACE/workspace.graph.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
"
done

# 重新同步
cd /Volumes/code/workspace/foundation/workspace-governance
pnpm workspace:docs:sync
node scripts/workspace-project-cli.mjs validate
node scripts/workspace-audit.mjs
```

### 预期效果

执行后：
- `byStage.unassessed` 从 29 → **21**（-8）
- `byStage.usable` 从 10 → **18**（+8）
- `byStage.complete` 维持 1（除非额外把 axi-pet-desktop / story-graph 升到 near-complete）

## 治理模型改进建议（长期）

### 当前缺陷

1. `completion.stage` 是声明式字段，无自动触发器。owner 不显式改 graph.json，stage 永远是 `unassessed`。
2. 高 confidence + documented handoff 仍可能在 graph 中显示 `unassessed` —— 评估模型自身缺乏触发。
3. `workspace-completion.mjs` 只读取不推导，浪费了已有的 handoff 状态信息。

### 改进路径（不属本轮整改）

1. 在 `buildProjectCompletionSnapshot` 中加入自动推导层：
   - 读取 handoff 快照，对每个 project 推导 handoff_stage
   - 如果 `completion.stage == 'unassessed'` 且 `handoff_stage` 非空且 `confidence != 'low'` → 自动覆盖到推导结果
   - 在 `evidence` 字段追加 `[auto-derived-from-handoff]` 标记，告知 owner
2. 增加 CLI：`node workspace-completion.mjs promote <project-id>`，单独跑某个项目的升级。
3. 在 `workspace-graph.json` 增加 `auto_promote: true` 字段，让 owner 选择是否启用自动晋升。

## 交付 owner 决策

| 选项 | 内容 |
|---|---|
| ① | 仅记录建议，暂不修改 workspace.graph.json（保持治理收紧） |
| ② | 升级全部 8 个项目到 `usable` |
| ③ | 升级全部 8 个项目，其中 confidence=high 的 axi-pet-desktop 和 story-graph 升级到 `near-complete` |
| ④ | 采纳长期改进建议（修改 `workspace-completion.mjs` 加入推导层） |

**owner 请选择一个选项。**