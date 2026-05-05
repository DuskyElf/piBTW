# Declarative dotfiles via git submodules and symlinks

This repo uses Nix/home-manager for the Pi config so the setup is easy to audit and reload locally, while still allowing fast edit/test cycles. The goal is not to replace all dotfile tooling, but to keep this config transparent and reproducible enough to share and reason about.

## Decision

**1.** `~/.pi` is a symlink created via home-manager:

```nix
home.file.".pi".source =
  config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/dotfiles/piBTW";
```

→ `~/.pi` → `~/dotfiles/piBTW`

This keeps the config editable in-place: changes under `~/dotfiles/piBTW` are reflected immediately in `~/.pi`.

**2.** Extensions are git submodules in `libs/`, symlinked to `agent/extensions/`:

```bash
git submodule add <repo-url> libs/<ext>
ln -s ../libs/<ext> agent/extensions/<ext>
```

Update via `./scripts/update-extensions`.

## Consequences

- Changes are immediately visible through the symlink, which makes local testing fast.
- The setup is easy to inspect and share, and can be reused on another machine with the same Nix/home-manager pattern.
- `pi install` is not used; extension management is manual via submodules.
- The symlink is out-of-store, so this favors convenience and live editing over strict Nix purity.
