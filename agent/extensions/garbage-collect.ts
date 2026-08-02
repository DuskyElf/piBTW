/**
 * garbage-collect: delete pi sessions inactive for over a week.
 *
 * Scans the session store (~/.pi/agent/sessions, or $PI_CODING_AGENT_DIR/sessions)
 * for session roots whose last activity is older than a cutoff (default 7 days)
 * and removes them — entirely in-process, no LLM involvement.
 *
 * What counts as a session: a `.jsonl` file or directory named
 * `<utc-start-timestamp>_<uuid>` inside a per-project folder
 * (e.g. `--home-duskyelf-Projects--` maps to `/home/duskyelf/Projects`).
 * Age is *last activity* (newest file mtime under the root), not creation
 * time, so a long-lived session touched yesterday is never caught.
 * `subagent-artifacts/` and hex-named branch dirs are not session roots.
 *
 * Per-project floor: the KEEP_PER_PROJECT most-recent sessions in each project
 * are always kept, even if older than the cutoff.
 *
 * The currently-running session is naturally safe — its files are being
 * written right now, so its mtime is "now".
 *
 * Usage: /garbage-collect [--days N] [--yes] [--dry-run]
 *
 * Drop in ~/.pi/agent/extensions/ (or agent/extensions/ in a piBTW checkout)
 * and /reload.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

/** Session root name prefix: <utc-timestamp>_<uuid> */
const SESSION_ROOT_RE = /^\d{4}-\d{2}-\d{2}T/;
const DEFAULT_DAYS = 7;
/** Per-project floor: always keep this many most-recent sessions, even if old. */
const KEEP_PER_PROJECT = 10;

/** Resolve the sessions store dir the same way pi does (getSessionsDir). */
function sessionsDir(): string {
	const env = process.env.PI_CODING_AGENT_DIR;
	const agentDir = env ? env.replace(/^~\//, `${homedir()}/`) : join(homedir(), ".pi", "agent");
	return join(agentDir, "sessions");
}

/** Newest mtime (epoch ms) anywhere under `path` — the session's last activity. */
function lastActivity(path: string): number {
	const st = statSync(path);
	if (st.isFile()) return st.mtimeMs;
	let max = st.mtimeMs;
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		max = Math.max(max, lastActivity(join(path, entry.name)));
	}
	return max;
}

/** Total size of a session root in bytes. */
function rootSize(path: string): number {
	const st = statSync(path);
	if (st.isFile()) return st.size;
	let total = 0;
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		total += rootSize(join(path, entry.name));
	}
	return total;
}

function fmtBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

interface Candidate {
	path: string;
	project: string;
	ageDays: number;
	sizeBytes: number;
}

function findCandidates(days: number): { candidates: Candidate[]; cutoff: number } {
	const dir = sessionsDir();
	const cutoff = Date.now() - days * 86400_000;
	const candidates: Candidate[] = [];

	let projects: string[] = [];
	try {
		projects = readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => join(dir, e.name));
	} catch {
		// sessions dir missing -> nothing to collect
		return { candidates, cutoff };
	}

	for (const project of projects) {
		let roots: string[] = [];
		try {
			roots = readdirSync(project).filter((n) => SESSION_ROOT_RE.test(n));
		} catch {
			continue;
		}

		// Per-project recent sessions (by last activity); the newest KEEP_PER_PROJECT
		// are exempt from collection even if they predate the cutoff.
		const sessions = roots
			.map((name) => {
				const root = join(project, name);
				return {
					root,
					last: lastActivity(root),
					sizeBytes: rootSize(root),
				};
			})
			.sort((a, b) => b.last - a.last);

		for (let i = KEEP_PER_PROJECT; i < sessions.length; i++) {
			const s = sessions[i];
			if (s.last >= cutoff) continue;
			candidates.push({
				path: s.root,
				project: basename(project),
				ageDays: Math.floor((Date.now() - s.last) / 86_400_000),
				sizeBytes: s.sizeBytes,
			});
		}
	}

	candidates.sort((a, b) => b.ageDays - a.ageDays || b.sizeBytes - a.sizeBytes);
	return { candidates, cutoff };
}

function report(candidates: Candidate[], days: number, cutoff: number): string {
	if (candidates.length === 0) {
		return `No sessions inactive for >${days} days outside each project's ${KEEP_PER_PROJECT} most recent. (cutoff: ${new Date(cutoff).toISOString()})`;
	}
	const totalBytes = candidates.reduce((s, c) => s + c.sizeBytes, 0);
	const lines = candidates.map((c) =>
		`${String(c.ageDays).padStart(4)}d  ${fmtBytes(c.sizeBytes).padStart(9)}  ${c.project}/${basename(c.path)}`,
	);
	return [
		`${candidates.length} session(s) inactive for >${days} days (${fmtBytes(totalBytes)} total):`,
		...lines,
	].join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("garbage-collect", {
		description: "Delete pi sessions inactive for over a week (default). Usage: /garbage-collect [--days N] [--yes] [--dry-run]",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			let days = DEFAULT_DAYS;
			let yes = false;
			let dryRun = false;

			const toks = args.trim().split(/\s+/).filter(Boolean);
			for (let i = 0; i < toks.length; i++) {
				const tok = toks[i];
				if (tok === "--yes" || tok === "-y") yes = true;
				else if (tok === "--dry-run") dryRun = true;
				else if (tok === "--days" && i + 1 < toks.length && /^\d+$/.test(toks[i + 1])) {
					days = Number(toks[++i]);
				} else if (/^--days=\d+$/.test(tok)) {
					days = Number(tok.split("=")[1]);
				} else if (/^\d+$/.test(tok)) {
					days = Number(tok); // bare number = days for convenience
				} else {
					ctx.ui.notify(`Unknown argument: ${tok}`, "error");
					return;
				}
			}
			if (days < 1) {
				ctx.ui.notify("Days must be >= 1.", "error");
				return;
			}

			const { candidates, cutoff } = findCandidates(days);
			const text = report(candidates, days, cutoff);
			pi.sendMessage(
				{ customType: "garbage-collect", content: text, display: true },
				{ triggerTurn: false },
			);

			if (dryRun || candidates.length === 0) {
				ctx.ui.notify(
					dryRun && candidates.length > 0
						? `Would delete ${candidates.length} session(s); run without --dry-run to do it.`
						: `No sessions to collect.`,
					"info",
				);
				return;
			}

			if (!yes) {
				yes = await ctx.ui.confirm(
					"Garbage collect?",
					`Delete ${candidates.length} session(s) (${fmtBytes(candidates.reduce((s, c) => s + c.sizeBytes, 0))}) inactive for >${days} days? This is irreversible.`,
				);
			}
			if (!yes) {
				ctx.ui.notify("Aborted — nothing deleted.", "info");
				return;
			}

			for (const c of candidates) rmSync(c.path, { recursive: true, force: true });
			ctx.ui.notify(`Deleted ${candidates.length} session(s).`, "info");
		},
	});
}
