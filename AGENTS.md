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

3. **Result**: When pi starts, it reads from `~/.pi` which transparently follows into this directory in the Nix dotfiles repo.

## Why this exists

- pi stores config in `~/.pi` by default
- User wants all dotfiles in Nix-managed `~/dotfiles`
- The symlink bridges "where pi expects its config" → "where Nix puts dotfiles"
- Changes here sync via git to the piBTW repo

## Directories

- `agent/` - pi agent data (auth, extensions, settings, sessions)
- `scripts/` - utility scripts for dotfiles management

## How to update extensions

Run the update script to sync extensions with the latest upstream:

```bash
./scripts/update-extensions
```
After running, tell the user to /reload pi to load the new version.
