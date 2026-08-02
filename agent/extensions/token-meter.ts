/**
 * token-meter: live token usage in the footer.
 *
 * pi's built-in footer context %/token count is computed from committed messages
 * (`agent.state.messages`), which only update at `message_end`. So it jumps only
 * when the model stops streaming. This extension shows a live readout instead,
 * updated on every `message_update` token:
 *
 *   ctx 38.4% · 76.8k/200k · out 2.1k
 *
 *   ctx     = live context usage (% and tokens) — committed context (via
 *             ctx.getContextUsage()) + an estimate of the in-flight response
 *   out     = output tokens streamed this turn (estimate; exact once message ends)
 *
 * Exact usage only arrives in the final stream chunk, so "real time" necessarily
 * means estimate-while-streaming, exact-at-completion.
 *
 * Drop in ~/.pi/agent/extensions/ (or agent/extensions/ in a piBTW checkout)
 * and /reload.
 */
import type {
	ExtensionAPI,
	ExtensionContext,
	MessageEndEvent,
	MessageStartEvent,
	MessageUpdateEvent,
} from "@earendil-works/pi-coding-agent";

/** Approximate chars-per-token for the streaming estimate. pi's own estimate is similar (~4). */
const CHARS_PER_TOKEN = 4;

/** Rough token estimate from an assistant message's streamed content blocks. */
function estimateOutputTokens(message: MessageUpdateEvent["message"]): number {
	if (message.role !== "assistant" || !Array.isArray(message.content)) return 0;
	let chars = 0;
	for (const block of message.content) {
		if (block.type === "text") chars += block.text.length;
		else if (block.type === "thinking" && block.thinking) chars += block.thinking.length;
		// toolCall args are small and land in context as input; skip for the output meter
	}
	return Math.round(chars / CHARS_PER_TOKEN);
}

function formatTokens(n: number): string {
	return Math.round(n).toLocaleString("en-US");
}

export default function (pi: ExtensionAPI) {
	/** Streamed output tokens of the current in-flight assistant response. */
	let streamedOutput = 0;
	/** Throttle so per-token events don't trigger a redraw every frame. */
	let lastRender = 0;
	let queued = false;

	function render(ctx: ExtensionContext) {
		const usage = ctx.getContextUsage();
		const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
		const baseTokens = usage?.tokens ?? 0;
		const liveTokens = baseTokens + streamedOutput;
		const percent = window > 0 ? (liveTokens / window) * 100 : 0;

		const parts: string[] = [];
		parts.push(`ctx ${percent.toFixed(1)}% · ${formatTokens(liveTokens)}/${formatTokens(window)}`);
		if (streamedOutput > 0) parts.push(`out ${formatTokens(streamedOutput)}`);
		if (ctx.hasUI) ctx.ui.setStatus("token-meter", parts.join(" "));
	}

	/** Coalesce the per-token burst into at most ~1 render per 100ms. */
	function schedule(ctx: ExtensionContext) {
		const now = Date.now();
		if (now - lastRender >= 100) {
			lastRender = now;
			render(ctx);
		} else if (!queued) {
			queued = true;
			setTimeout(() => {
				queued = false;
				render(ctx);
			}, 100);
		}
	}

	// Fresh turn: start the output meter at zero.
	pi.on("message_start", (event: MessageStartEvent, ctx) => {
		if (event.message.role !== "assistant") return;
		streamedOutput = 0;
		schedule(ctx);
	});

	// Live updates as tokens stream.
	pi.on("message_update", (event: MessageUpdateEvent, ctx) => {
		streamedOutput = estimateOutputTokens(event.message);
		schedule(ctx);
	});

	// Exact usage at completion; correct the estimate.
	pi.on("message_end", (event: MessageEndEvent, ctx) => {
		if (event.message.role !== "assistant") return;
		streamedOutput = event.message.usage?.output ?? streamedOutput;
		render(ctx);
	});

	// Re-render when the context window / model changes (also refreshes on session load).
	pi.on("model_select", (_event, ctx) => {
		streamedOutput = 0;
		render(ctx);
	});

	pi.on("session_start", (_event, ctx) => {
		streamedOutput = 0;
		render(ctx);
	});

	// Clear the status on shutdown so a stale value never lingers.
	pi.on("session_shutdown", (_event, ctx) => {
		streamedOutput = 0;
		if (ctx.hasUI) ctx.ui.setStatus("token-meter", undefined);
	});
}
