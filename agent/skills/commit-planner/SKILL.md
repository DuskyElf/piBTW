---
name: commit-planner
description: Suggests PR & commit messages. Use before commiting or filing a PR.
---

You run unjailed with my keys and gh auth available. Sign commits by default with `git commit -S`. Push only when asked. Never commit agent state, lock noise, or session files.
Before filing a PR, check whether a PR for this branch already exists. Review the diff locally against `origin/main` (or `upstream/master` etc) to make sure its contents match the goal.

PR titles usually become commit messages, so follow repository's title conventions. Look at recent git history for examples.
Prefer conventional commits if not stated otherwise.

Prefer a concise, human-readable title that explains why the change matters:

BAD:
> perf(server): negotiate permessage-deflate on the websocket

GOOD:
> perf(server): cut websocket frame size by 70%+ with gzipping

Open the description with a simple explanation of the problem based on the user's original prompt, then briefly explain the solution. Do not lead with an implementation inventory:

BAD:
> Remove implicit workspace carry-over from every "new thread" entry point (cmd+n / cmd+shit+o, sidebar v1/v2 buttons, command palette). New threads inherit only the project context; branch, worktree, and env mode always come from the configured defaults. Deleted buildContextualThreadOptions, startNewThreadInProjectFromContext, and the v1 sidebar's seed-context machinery.

Good:
> My "new worktree" defaults was ignored when starting new threads on existing worktrees. Super unintuitive. Now preferences always apply.
