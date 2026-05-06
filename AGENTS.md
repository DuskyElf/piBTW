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

## Libraries

All libraries live in `libs/` as **git submodules** and are symlinked to `agent/extensions/` or `agent/skills/` for pi discovery:

## How to update libraries

```bash
./scripts/update-extensions
```
After running, tell the user to /reload pi.

## How to add libraries

The library registry is **implicit** - any git submodule in `libs/` is automatically discovered by `./scripts/update-extensions`. No manual registration required.

1. **Clone into libs/** as a submodule:
   ```bash
   git submodule add <repo-url> libs/<extension-name>
   ```

2. **Update libraries** (this runs automatically on each library in libs/):
   ```bash
   ./scripts/update-extensions
   ```

3. **Symlink to agent/extensions/** for pi discovery:
   ```bash
   ln -s ../libs/<extension-name> agent/extensions/<extension-name>
   ```

4. **Link any skills** (if library has `.agents/skills/` or `skills/`):
   ```bash
   ln -sf ../libs/<extension-name>/skills/<skill-name> agent/skills/<skill-name>
   ```

5. **Reload pi**: tell user to /reload pi

### Issue tracker

Local markdown issues under `.scratch/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root. See `docs/adr/` for architectural decisions.
