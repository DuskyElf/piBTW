---
name: commit-planner
description: Suggests commit messages based on git diff and project history style.
---

# Commit Planner

When asked to write or suggest a commit message:

1. Run `git status` to check staged files.
2. Run `git diff --cached` (if files are staged) or `git diff` to understand the changes.
3. Run `git log -n 10` to infer the project's commit style (e.g., conventional commits, tense, format).
4. Output 1-3 suggested commit messages matching the project's style.

Do NOT execute `git commit` yourself. Just output the suggested messages.