# backend/mini_agent/skills/ — M18 Status

**Audit wave**: M18-doc-audit (2026-10-11)
**Finding ID**: M18-44

## Status: IN USE — RETAIN

The Python skill-loader at `backend/mini_agent/tools/skill_loader.py` actively reads this subtree:

```python
def __init__(self, skills_dir: str = "./skills"):
    """Initialize skill loader.

    Args:
        skills_dir: Skills directory path
    """
    self.skills_dir = Path(skills_dir)
```

Default `skills_dir = "./skills"` is exactly `backend/mini_agent/skills/`.

The runtime wiring is in `backend/mini_agent/cli.py`:

```python
skills_path = Path(config.tools.skills_dir).expanduser()
if config.tools.enable_skills:
    skills_dir = str(skills_path)
    ...
    skill_tools, skill_loader = create_skill_tools(skills_dir)
```

`config.py` defaults: `enable_skills: bool = True`, `skills_dir: str = "./skills"`.

## Why retained

Per M18 instruction: "verify Python skill-loader actually reads from this path. If not, prune". This subtree **is read** by `tools/skill_loader.py` via the `SkillLoader(skills_dir)` API and surfaced as `skill_tools` to the agent runtime. Pruning would break the agent's skill discovery.

The 2026-02-24 mtime reflects the original Anthropic agent-skills scaffold import. Content is vendor-mirrored and 15 top-level skills (algorithmic-art, brand-guidelines, canvas-design, document-skills, internal-comms, mcp-builder, skill-creator, slack-gif-creator, template-skill, theme-factory, webapp-testing, …). Owner may later sync from upstream Anthropic skills repo if staleness becomes a problem; not in M18 scope.

Added 2026-10-11 by fix-agent-4 (M18 doc-cleanup wave).
