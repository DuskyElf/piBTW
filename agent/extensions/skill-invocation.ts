/**
 * skill-invocation: toggle which skills are agent-invocable.
 *
 * By default every skill under agent/skills/ has its description injected into
 * the system prompt (`<available_skills>` block), so the agent can decide to
 * load and invoke it on its own. This extension lets you flip each skill off,
 * keeping its description OUT of context — the agent no longer sees it and
 * cannot auto-invoke it (it can still be called explicitly via /skill:name).
 *
 * Usage:
 *   /skill-invocation   open the toggle UI (TUI mode)
 *
 * State is stored in the main settings file (agent/settings.json) under the
 * `skillInvocation` key, e.g.:
 *
 *   "skillInvocation": { "librarian": false, "research": false }
 *
 * A missing key (or `true`) means the skill stays loaded in context. `false`
 * hides it. The native frontmatter flag `disable-model-invocation` is also
 * honored on top of these toggles.
 *
 * Drop in agent/extensions/ (or agent/extensions/ in a piBTW checkout) and /reload.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { homedir } from "os";
import type { SettingsListTheme } from "@earendil-works/pi-tui";
import { SettingsList } from "@earendil-works/pi-tui";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

/** Settings file: agentDir/settings.json, mirroring pi's getAgentDir() resolution. */
function getSettingsPath(): string {
	const env = process.env.PI_CODING_AGENT_DIR;
	let agentDir: string;
	if (env) {
		agentDir = env.startsWith("~/") ? join(homedir(), env.slice(2)) : env;
	} else {
		agentDir = join(homedir(), ".pi", "agent");
	}
	return join(agentDir, "settings.json");
}

const SETTINGS_PATH = getSettingsPath();
const SKILLS_DIR = join(dirname(SETTINGS_PATH), "skills");

/** The parsed skillInvocation map. Absent key / true = enabled (in context). */
interface SkillInvocationMap {
	[name: string]: boolean;
}

function parseSettings(): { map: SkillInvocationMap; raw: Record<string, unknown> } {
	try {
		const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Record<string, unknown>;
		const inv = raw.skillInvocation;
		const map: SkillInvocationMap =
			inv && typeof inv === "object" && !Array.isArray(inv) ? (inv as SkillInvocationMap) : {};
		return { map, raw };
	} catch {
		return { map: {}, raw: {} };
	}
}

/** Persist the toggle map back into the main settings file, preserving all other keys. */
function saveMap(map: SkillInvocationMap): void {
	const { raw } = parseSettings();
	raw.skillInvocation = map;
	// Match pi's own serializer: 2-space indent, no trailing newline.
	writeFileSync(SETTINGS_PATH, JSON.stringify(raw, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Skill enumeration (mirrors pi's discovery: dir with SKILL.md, name = frontmatter
// name || dir basename, description from frontmatter).
// ---------------------------------------------------------------------------
interface SkillInfo {
	name: string;
	description: string;
	path: string;
}

function parseFrontmatter(content: string): Record<string, string> {
	const out: Record<string, string> = {};
	const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	if (!m) return out;
	for (const line of m[1].split(/\r?\n/)) {
		const idx = line.indexOf(":");
		if (idx <= 0) continue;
		const key = line.slice(0, idx).trim();
		const val = line.slice(idx + 1).trim();
		if (key && val) out[key] = val;
	}
	return out;
}

function listSkills(): SkillInfo[] {
	const skills: SkillInfo[] = [];
	let entries: string[];
	try {
		entries = readdirSync(SKILLS_DIR);
	} catch {
		return skills;
	}
	for (const entry of entries) {
		const dir = resolve(SKILLS_DIR, entry);
		try {
			if (!statSync(dir).isDirectory()) continue;
		} catch {
			continue; // broken symlink etc.
		}
		const skillFile = join(dir, "SKILL.md");
		let content: string;
		try {
			content = readFileSync(skillFile, "utf-8");
		} catch {
			continue;
		}
		const fm = parseFrontmatter(content);
		const name = fm.name || entry;
		const description = fm.description || "";
		if (!description) continue;
		skills.push({ name, description, path: skillFile });
	}
	return skills;
}

// ---------------------------------------------------------------------------
// Rebuild the <available_skills> prompt block, excluding toggled-off skills.
// Mirrors pi's formatSkillsForPrompt (skills.js) exactly.
// ---------------------------------------------------------------------------
function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function formatSkillsBlock(
	skills: Array<{
		name: string;
		description: string;
		filePath: string;
		disableModelInvocation?: boolean;
	}>,
): string {
	const visible = skills.filter((s) => !s.disableModelInvocation);
	if (visible.length === 0) return "";
	const lines = [
		"\n\nThe following skills provide specialized instructions for specific tasks.",
		"Use the read tool to load a skill's file when the task matches its description.",
		"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
		"",
		"<available_skills>",
	];
	for (const skill of visible) {
		lines.push("  <skill>");
		lines.push(`    <name>${escapeXml(skill.name)}</name>`);
		lines.push(`    <description>${escapeXml(skill.description)}</description>`);
		lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
		lines.push("  </skill>");
	}
	lines.push("</available_skills>");
	return lines.join("\n");
}

/** Matches the whole skills section in an assembled system prompt. */
const SKILL_SECTION_RE =
	/\n\nThe following skills provide specialized instructions for specific tasks\.[\s\S]*?<\/available_skills>/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------
export default function (pi: ExtensionAPI) {
	// Filter toggled-off skills out of the system prompt on every agent start.
	pi.on("before_agent_start", (event) => {
		const { map } = parseSettings();
		const disabled = new Set<string>();
		for (const [name, on] of Object.entries(map)) {
			if (on === false) disabled.add(name);
		}
		if (disabled.size === 0) return;

		const skills = event.systemPromptOptions?.skills;
		if (!Array.isArray(skills) || skills.length === 0) return;
		const systemPrompt = event.systemPrompt;
		if (typeof systemPrompt !== "string" || !SKILL_SECTION_RE.test(systemPrompt)) return;

		const filtered = skills.filter((s) => !disabled.has(s.name));
		const block = formatSkillsBlock(filtered);
		return { systemPrompt: systemPrompt.replace(SKILL_SECTION_RE, block) };
	});

	// /skill-invocation — interactive toggle UI.
	pi.registerCommand("skill-invocation", {
		description: "Toggle which skills are loaded into context (agent-invocable).",
		async handler(_args: string, ctx: ExtensionCommandContext) {
			if (ctx.mode !== "tui" || !ctx.hasUI) {
				ctx.ui.notify("skill-invocation UI requires the interactive (TUI) mode.", "warning");
				return;
			}
			const skills = listSkills();
			if (skills.length === 0) {
				ctx.ui.notify("No skills found under agent/skills/.", "warning");
				return;
			}
			const { map } = parseSettings();

			// Mutable working copy; onChange mutates this so successive toggles accumulate.
			const state = { ...map };

			const items = skills.map((s) => ({
				id: s.name,
				label: s.name,
				description:
					s.description.length > 90 ? s.description.slice(0, 87) + "…" : s.description,
				currentValue: state[s.name] === false ? "off" : "on",
				values: ["on", "off"],
			}));

			const listTheme: SettingsListTheme = {
				label: (text, selected) => (selected ? ctx.ui.theme.fg("accent", text) : text),
				value: (text, selected) =>
					selected ? ctx.ui.theme.fg("accent", text) : ctx.ui.theme.fg("muted", text),
				description: (text) => ctx.ui.theme.fg("dim", text),
				cursor: ctx.ui.theme.fg("accent", "→ "),
				hint: (text) => ctx.ui.theme.fg("dim", text),
			};

			await ctx.ui.custom<"saved" | "cancelled">(
				(tui, theme, keybindings, done) => {
					const list = new SettingsList(
						items,
						Math.min(items.length, 12),
						listTheme,
						(id, value) => {
							if (value === "on") delete state[id]; // enabled = default, keep map clean
							else state[id] = false;
							saveMap(state);
							list.updateValue(id, value);
						},
						() => done("cancelled"),
					);
					return {
						render: (width: number) => list.render(width),
						handleInput: (data: string) => list.handleInput(data),
						invalidate: () => list.invalidate(),
					};
				},
			);
			ctx.ui.notify(
				`Skill invocation toggles saved to ${SETTINGS_PATH}`,
				"info",
			);
		},
	});
}
