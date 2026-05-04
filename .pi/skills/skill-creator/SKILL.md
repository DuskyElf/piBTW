---
name: skill-creator
description: Guidelines for creating new pi skills. Use when the user asks to create, modify, or understand how to build a custom skill for pi.
---

# Skill Creator Guidelines

When asked to create a new skill for pi, follow these rules based on the Agent Skills standard:

## 1. Scoping (Where to put the skill)
- **Local/Project skills** (specifically for editing pi config or this repo): Create in `.pi/skills/<skill-name>/SKILL.md`
- **Global/User skills** (useful across all projects): Create in `agent/skills/<skill-name>/SKILL.md`

## 2. Structure & Naming
- Create a directory named exactly as the skill: `mkdir -p <location>/<skill-name>`
- Create a `SKILL.md` file inside it.
- Name must be 1-64 chars, lowercase a-z, 0-9, hyphens only. No consecutive/trailing hyphens.
- The `name` in frontmatter **must** match the parent directory name.

## 3. Content Rules
- **Keep it compact but trigger-focused:** Make the description minimal but explicitly state *when* to use the skill (e.g., "Use when...") so the model can auto-load it at the correct time.
- Make the body straight to the point. Give the agent exact instructions, not filler.
- If using helper scripts/assets, reference them using relative paths from the skill directory.

## 4. SKILL.md Template
```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---

# My Skill Name

[Add your instructions here that agent will follow when this skill is active]

## Examples
- Example usage 1
- Example usage 2

## Guidelines
- Guideline 1
- Guideline 2
```

After creating or updating a skill, remind the user to run `/reload`.

## What Skills Are
Skills are self-contained capability packages that pi loads on-demand. They provide specialized workflows, setup instructions, helper scripts, and reference documentation for specific tasks. Pi implements the [Agent Skills standard](https://agentskills.io/specification).

**How they work** (progressive disclosure):
1. At startup, pi scans skill locations and extracts names + descriptions
2. The system prompt includes available skills in XML format
3. When a task matches, the agent uses `read` to load the full SKILL.md
4. The agent follows the instructions, using relative paths for scripts/assets

## Skill Structure

A skill is a **directory** containing a `SKILL.md` file:

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts (optional)
│   └── process.sh
├── references/           # Detailed docs loaded on-demand (optional)
│   └── api-reference.md
└── assets/               # Templates, configs, etc. (optional)
    └── template.json
```

### Name Rules
- 1-64 characters
- Lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- No consecutive hyphens
- **Must match the parent directory name**

Valid: `pdf-processing`, `data-analysis`, `code-review`
Invalid: `PDF-Processing`, `-pdf`, `pdf--processing`

### Description Best Practices
The description determines **when** the agent loads the skill. Be specific about what it does and when to use it.

**Good:**
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

**Poor:**
```yaml
description: Helps with PDFs.
```

## Official Sources
- **Official docs**: https://pi.dev/docs/latest/skills
- **GitHub source**: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md
- **Agent Skills standard**: https://agentskills.io/specification
- **Pi Skills repo**: https://github.com/badlogic/pi-skills
- **Anthropic Skills repo**: https://github.com/anthropics/skills
