# Context for pi Agent

This directory (`~/.pi` → `piBTW/`) is a **symlink trick** to share pi config across machines via Nix/Home Manager.

## How it works

1. **Git Submodule**: This `piBTW/` is a git submodule cloned from `https://github.com/DuskyElf/piBTW`

2. **Symlink in Nix**: In `~/dotfiles/cli/pi-coding-agent.nix`:
   ```nix
   home.file.".pi".source =
     config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/dotfiles/piBTW";
   ```
   This creates `~/.pi` → `~/dotfiles/piBTW`

3. **Result**: When pi starts, it reads from `~/.pi` which transparently follows into this directory.

## Extensions Location

All extensions live in `libs/` as **git submodules** and are symlinked to `agent/extensions/` or `agent/skills/` for pi discovery:

## How to update extensions

```bash
./scripts/update-extensions
```
After running, tell the user to /reload pi.

## How to add extensions

1. **Clone into libs/** as a submodule:
   ```bash
   git submodule add <repo-url> libs/<extension-name>
   ```

2. **Symlink to agent/extensions/** for pi discovery:
   ```bash
   ln -s ../libs/<extension-name> agent/extensions/<extension-name>
   ```

3. **Link any skills** (if extension has `.agents/skills/` or `skills/`):
   ```bash
   ln -sf ../libs/<extension-name>/skills/<skill-name> agent/skills/<skill-name>
   ```

4. **Reload pi**: tell user to /reload pi

## Currently installed extensions

- `pi-web-access` - Web search, URL fetching, GitHub repo cloning, PDF extraction, YouTube video understanding
- `pi-subagents` - Delegate work to child agents (scout, researcher, planner, worker, reviewer, oracle, delegate)
- `pi-context-prune` - Context management (planning, release skills)
