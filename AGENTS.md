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

Single-context: one `CONTEXT.md` at the repo root — the domain glossary defining canonical terminology. See `docs/adr/` for architectural decisions.

## pi extension authoring

Gotchas from debugging `agent/extensions/*.ts` against pi's ExtensionAPI. The installed `.d.ts` is the source of truth, not docs — read it in the Nix store:
`/nix/store/*-pi-coding-agent-*/lib/node_modules/pi-monorepo/dist/core/extensions/types.d.ts` (ExtensionAPI, events, deliverAs; spans `@earendil-works/pi-agent-core`, `pi-ai`, `pi-tui`).

- `pi.sendUserMessage()/sendMessage()` THROW `"Agent is already processing"` while the agent is streaming unless you pass `{ deliverAs: "steer" | "followUp" }`. steer = interrupt + queue into the current run; followUp = process after current work. In an idle agent the option is ignored.
- A queued steer is drained into the SAME running loop, so `agent_start` resets `turnIndex` to 0 per run (`core/agent-session.js:_emitExtensionEvent`) — never use turnIndex as a cross-prompt counter.
- Ordering: the in-flight turn's `turn_end` fires BEFORE your queued steer message is processed. To capture the response to your own message, arm capture on `message_start` matching your prompt text, then take the first text-bearing `turn_end` after it — arming up front grabs the in-flight reply instead.
- `ctx.waitForIdle()` (and `agent.waitForIdle()`) resolves only after the whole activeRun settles, INCLUDING queued steer turns — not at the first idle moment.

## Model Configuration & Auth

We now rely primarily on Google Gemini (`google/*`) flash/lite models and open-weight Gemma 4 models using a Google API key, alongside Cerebras and Ollama cloud models.

- **Config Location**: Enabled models and default selections live in `agent/settings.json`.
- **Model Discoverability**: Pi natively discovers Google Gemini models via `auth.json` (`google` api key); no manual overrides are needed in `agent/models.json` unless customizing thinking level maps or context windows.
- **Cerebras & Other Providers**: Cerebras and Ollama models (`cerebras/gpt-oss-120b`, `cerebras/gemma-4-31b`, etc.) are configured in `settings.json` and `models.json` where specific parameter mapping is required.

### Updating Opencode Zen models (guidance, not gospel)

Free models churn fast. Don't treat any list here as fixed.

When asked to refresh Opencode Zen:

1. **Sources to check** (in order): live API `https://opencode.ai/zen/v1/models` (auth with `opencode` key from `agent/auth.json`), docs at `https://opencode.ai/docs/zen/` (pricing/free table + endpoint table), and pi's bundled catalog at `/nix/store/*-pi-coding-agent-*/lib/node_modules/pi-monorepo/node_modules/@earendil-works/pi-ai/dist/providers/data/opencode.json`.
2. **Verify live** — listing ≠ working. Probe `POST /zen/v1/chat/completions` (for `openai-completions` models) and `POST /zen/v1/responses` (for `openai-responses` like `muse-spark-*`) with a tiny `max_tokens`/`max_output_tokens`. Watch for `401 Model is not supported`, `400 Model is unavailable`, or `429 FreeUsageLimitError` (429 means it exists, just rate-limited). `hy3-free` and `deepseek-v4-flash-free` looked listed but were dead recently.
3. **What to update**:
   - `agent/settings.json` `enabledModels`: add/remove `opencode/<id>` for quick-switch (`/model`). Keep the list to actually-working free models.
   - `agent/models.json` `providers.opencode.models[]`: only needed for models missing from pi's bundled catalog (e.g. `laguna-s-2.1-free`, `muse-spark-1.3-contributor-free` were absent in 0.84.4). Copy `api`/`baseUrl`/`compat` from docs or the live catalog when you add one.
   - `providers.opencode.modelOverrides`: only if you need a custom `thinkingLevelMap` (e.g. muse-spark wants `minimal`/`xhigh`). Otherwise pi's defaults are fine.
4. **Keep it loose**: prefer the live check over this doc. If docs and API disagree, trust the live probe and note it.

**Sandbox quirk:** curl/wget die on bwrap in this env — use `node -e` + `https.get`.
