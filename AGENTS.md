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

## Why this exists

- pi stores config in `~/.pi` by default
- User wants all dotfiles in Nix-managed `~/dotfiles`
- The symlink bridges "where pi expects its config" → "where Nix puts dotfiles"
- Changes here sync via git to the piBTW repo

## Directories

- `agent/` - pi agent data (auth, extensions, settings, sessions)
- `scripts/` - utility scripts for dotfiles management

## How to update extensions

```bash
./scripts/update-extensions
```
After running, tell the user to /reload pi.

## How to add extensions

On nix-managed machines, `pi install` won't work. Clone the extension repo directly into `agent/extensions` as a subrepo:

```bash
cd agent/extensions
git clone --depth 1 <repo-url>
cd <extension-folder>
npm install
# Link any skills so pi discovers them
ln -sf ../extensions/<ext>/skills/<name> agent/skills/<name>
```
then /reload pi.

## Currently installed extensions

- `pi-web-access` - Web search, URL fetching, GitHub repo cloning, PDF extraction, YouTube video understanding
- `pi-subagents` - Delegate work to child agents (scout, researcher, planner, worker, reviewer, oracle, delegate)
