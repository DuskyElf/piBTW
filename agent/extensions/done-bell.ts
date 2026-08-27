/**
 * done-bell: one-shot system notification + sound + media pause when agent settles.
 * Plays a freedesktop sound once, pauses all players via playerctl, and shows a
 * critical desktop notification. Dismisses the notification when you focus the
 * pi window or send any input, mirroring gui/idle.nix break-timer.
 * Usage: /bell [on|off|test|status]  (aliases: /done-bell, /alarm)
 */
import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "done-bell";
const FOCUS_ENABLE = "\x1b[?1004h";
const FOCUS_DISABLE = "\x1b[?1004l";
const FOCUS_IN = "\x1b[I";

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let lastCtx: ExtensionContext | undefined;
	let focusUnsub: (() => void) | undefined;
	let notifyId: string | undefined;
	let active = false;

	function hasUI(ctx: ExtensionContext): boolean {
		return ctx.hasUI && ctx.mode === "tui";
	}

	function clearStatus(ctx: ExtensionContext): void {
		try {
			if (hasUI(ctx)) ctx.ui.setStatus(STATUS_KEY, undefined);
		} catch {}
	}

	async function dismissNotification(): Promise<void> {
		if (!notifyId) return;
		const id = notifyId;
		notifyId = undefined;
		// mako is the notification daemon on this system (see gui/idle.nix skipBreak)
		try {
			await pi.exec("makoctl", ["dismiss", "-n", id]);
		} catch {}
		// best-effort fallback: try generic close via notify-send is not standard, ignore
	}

	async function dismiss(ctx?: ExtensionContext): Promise<void> {
		const c = ctx ?? lastCtx;
		if (c) clearStatus(c);
		try {
			process.stdout.write(FOCUS_DISABLE);
		} catch {}
		await dismissNotification();
		active = false;
	}

	async function doNotify(ctx: ExtensionContext): Promise<void> {
		// System notification: captures replaceable ID via -p (like gui/idle.nix breakTimer)
		try {
			const res = await pi.exec("notify-send", [
				"-p",
				"Agent done",
				"Task finished — focus terminal to dismiss",
				"-u",
				"critical",
			]);
			const id = res.stdout.trim().split("\n")[0]?.trim();
			if (id) notifyId = id;
		} catch {
			// Fallback to pi's in-app notification if system notify outside jail fails
			try {
				ctx.ui.notify("Agent done — focus to dismiss", "info");
			} catch {}
		}
	}

	async function pausePlayers(): Promise<void> {
		try {
			await pi.exec("playerctl", ["-a", "pause"]);
		} catch {}
	}

	async function playSound(): Promise<void> {
		// Find freedesktop sound in nix store (like gui/idle.nix breakTimer's
		// ${pkgs.sound-theme-freedesktop}/share/sounds/...). /run/current-system
		// has no sounds on this host, so we must search /nix/store.
		try {
			await pi.exec("sh", [
				"-c",
				'for f in /nix/store/*sound-theme-freedesktop*/share/sounds/freedesktop/stereo/message-new-instant.oga /nix/store/*sound-theme-freedesktop*/share/sounds/freedesktop/stereo/message.oga; do [ -f "$f" ] && pw-play "$f" >/dev/null 2>&1 & break; done',
			]);
		} catch {}
	}

	function start(ctx: ExtensionContext): void {
		if (!enabled || active) return;
		if (!hasUI(ctx)) return;
		lastCtx = ctx;
		active = true;
		try {
			ctx.ui.setStatus(STATUS_KEY, "Agent done — focus to dismiss");
		} catch {}
		try {
			process.stdout.write(FOCUS_ENABLE);
		} catch {}
		// Fire-and-forget: notification, pause, sound (same order as breakTimer)
		void (async () => {
			await doNotify(ctx);
			await pausePlayers();
			await playSound();
		})();
	}

	function stopSync(ctx?: ExtensionContext): void {
		// Synchronous entry from event handlers; dismiss is async but we don't await.
		void dismiss(ctx);
	}

	pi.on("input", (_, ctx) => {
		lastCtx = ctx;
		if (active) stopSync(ctx);
	});
	pi.on("before_agent_start", (_, ctx) => {
		lastCtx = ctx;
		if (active) stopSync(ctx);
	});
	pi.on("agent_start", (_, ctx) => {
		lastCtx = ctx;
		if (active) stopSync(ctx);
	});
	pi.on("agent_settled", (_, ctx) => {
		lastCtx = ctx;
		start(ctx);
	});
	pi.on("agent_end", (_, ctx) => {
		// agent_end fires slightly before settled; re-check idle shortly after.
		setTimeout(() => {
			if (active) return;
			try {
				if (!ctx.isIdle() || !enabled) return;
				start(ctx);
			} catch {}
		}, 60);
	});
	pi.on("session_start", (_, ctx) => {
		lastCtx = ctx;
		void dismiss(ctx);
		if (hasUI(ctx) && !focusUnsub) {
			try {
				focusUnsub = ctx.ui.onTerminalInput((data: string) => {
					if (data === FOCUS_IN) {
						if (active) stopSync(lastCtx);
						return { consume: false };
					}
					if (active) stopSync(lastCtx);
					return undefined;
				});
			} catch {}
		}
	});
	pi.on("session_shutdown", (_, ctx) => {
		void dismiss(ctx);
		if (focusUnsub) {
			try {
				focusUnsub();
			} catch {}
			focusUnsub = undefined;
		}
		try {
			process.stdout.write(FOCUS_DISABLE);
		} catch {}
	});

	function handle(args: string, ctx: ExtensionCommandContext): void {
		const a = args.trim().toLowerCase();
		if (!a || a === "status") {
			ctx.ui.notify(`done-bell: ${enabled ? "on" : "off"}, ${active ? `active${notifyId ? ` (notification ${notifyId})` : ""}` : "idle"}`, "info");
			return;
		}
		if (a === "on" || a === "enable") {
			enabled = true;
			ctx.ui.notify("done-bell: on", "info");
			return;
		}
		if (a === "off" || a === "disable" || a === "stop" || a === "silence") {
			enabled = false;
			stopSync(ctx);
			ctx.ui.notify("done-bell: off", "info");
			return;
		}
		if (a === "test") {
			ctx.ui.notify("done-bell: test — notification + sound + pause", "info");
			// Force a fresh start even if already active
			void dismiss(ctx).then(() => start(ctx));
			return;
		}
		if (a.startsWith("interval")) {
			ctx.ui.notify("done-bell no longer uses interval — it fires once per settle", "warning");
			return;
		}
		ctx.ui.notify(`unknown /bell arg: ${args}`, "error");
	}

	pi.registerCommand("bell", {
		description: "One-shot bell on agent done (notify + sound + pause). Usage: /bell [on|off|test|status]",
		handler: async (args, ctx) => handle(args, ctx),
	});
	pi.registerCommand("done-bell", {
		description: "Alias for /bell",
		handler: async (args, ctx) => handle(args, ctx),
	});
	pi.registerCommand("alarm", {
		description: "Alias for /bell",
		handler: async (args, ctx) => handle(args, ctx),
	});
}
