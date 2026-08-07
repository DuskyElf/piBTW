/**
 * handoff-inline: /handoff regenerates context as a clean new session seeded
 * with an in-memory handoff document.
 *
 * The /skill:handoff skill writes a handoff markdown file to the OS temp dir.
 * This extension instead runs a lean in-memory prompt (HANDOFF_BODY below) and
 * uses the resulting document to reset the context IN MEMORY:
 *
 *   1. Ask the current agent to produce the handoff document as its response
 *      text — no file is written anywhere.
 *   2. Capture that document (via the turn_end event, armed only after the
 *      handoff prompt is actually in the transcript).
 *   3. Open a NEW session seeded with the document as its opening context.
 *
 * The handoff prompt is sent with `deliverAs: "steer"` so it does not throw
 * when the agent is already streaming (it is queued into the running loop).
 * Capture is armed on `message_start` for our own steer message, NOT up front:
 * otherwise the in-flight turn's `turn_end` would be captured as the handoff
 * document before our prompt is even processed.
 *
 * The working session is left untouched in the session tree. The new session
 * starts clean with only the handoff as context, and the agent immediately
 * continues the work from it.
 *
 * The original file-writing handoff skill stays available as /skill:handoff.
 *
 * Tweak the HANDOFF_BODY prompt below freely (it is the "manual tweaks" knob).
 *
 * Usage: /handoff [focus]   — optional focus tailors the document.
 *
 * Drop in ~/.pi/agent/extensions/ (or agent/extensions/ in a piBTW checkout)
 * and /reload.
 */
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	MessageStartEvent,
	TurnEndEvent,
} from "@earendil-works/pi-coding-agent";

/**
 * The prompt that asks the agent to produce the handoff document. Tweak freely —
 * this is the "manual tweaks" knob. Note it deliberately avoids telling the
 * agent to write a file; output stays in-memory.
 */
const HANDOFF_BODY = `Your context is filling up, write down all the context to a handoff document, and I'll restart the session with that context.
Output the complete handoff document as your response text ONLY, no surrounding text. Do NOT write any file to disk.`;

/** Assemble the user message that prompts the agent to produce the document. */
function buildPrompt(args: string): string {
	const focus = args.trim()
		? `The next session will focus on: ${args.trim()}`
		: "The next session will continue the overall work.";
	return `${HANDOFF_BODY} ${focus}`;
}

/** Extract concatenated text blocks from an assistant message's content. */
function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const block of content) {
			if (
				block &&
				typeof block === "object" &&
				(block as { type?: string }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string"
			) {
				parts.push((block as { text: string }).text);
			}
		}
		return parts.join("\n");
	}
	return "";
}

/** How long to wait for the handoff turn before giving up. */
const GENERATION_TIMEOUT_MS = 300_000;

export default function (pi: ExtensionAPI) {
	// Rendezvous between the command handler (asks for the doc) and the
	// turn_end listener (receives it).
	let capturing = false;
	let handoffResolve: ((text: string) => void) | null = null;

	// Arm capture only once OUR steer message is actually in the transcript.
	// Without this, the in-flight turn's turn_end (fired before the queued steer
	// message is processed) would be captured as the handoff document.
	pi.on("message_start", (event: MessageStartEvent) => {
		if (!handoffResolve || capturing) return;
		if (event.message.role !== "user") return;
		if (!extractText(event.message.content).includes(HANDOFF_BODY)) return;
		// Our handoff prompt is now queued/being processed. The next text-bearing
		// assistant turn is the handoff document.
		capturing = true;
	});

	pi.on("turn_end", (event: TurnEndEvent) => {
		if (!capturing || !handoffResolve) return;
		// turn_end fires after EVERY assistant sub-turn, including intermediate
		// tool-call turns (which carry no text). Only resolve once a turn has
		// actual document text — otherwise the first tool call would capture an
		// empty/partial doc and abort the handoff. The timeout below is the
		// backstop if the agent never produces a text turn.
		const text = extractText(event.message.content);
		if (!text.trim()) return;
		capturing = false;
		const resolve = handoffResolve;
		handoffResolve = null;
		resolve(text);
	});

	pi.registerCommand("handoff", {
		description:
			"Reset context: generate an in-memory handoff document (no file written) and continue in a fresh session seeded with it. Usage: /handoff [focus]",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const doc = await new Promise<string>((resolve) => {
				handoffResolve = resolve;
				capturing = false;
				// deliverAs "steer": when the agent is already streaming this queues
				// the prompt into the running loop instead of throwing "Agent is
				// already processing". When idle it is ignored and the prompt is sent
				// directly. Capture is armed by the message_start listener above.
				pi.sendUserMessage(buildPrompt(args), { deliverAs: "steer" });
				// Safety net: if the turn never produces a document, fail the
				// command rather than leave the UI hanging.
				setTimeout(() => {
					if (!handoffResolve) return; // already resolved
					capturing = false;
					handoffResolve = null;
					resolve("");
				}, GENERATION_TIMEOUT_MS);
			});

			if (!doc.trim()) {
				ctx.ui.notify(
					"handoff generation failed or timed out — no document captured, current session unchanged.",
					"error",
				);
				return;
			}

			// Open a clean new session and seed it with the document. All
			// post-replacement work must happen inside withSession — the old
			// ctx (and this extension instance) is invalidated after this.
			await ctx.newSession({
				withSession: async (ctx2) => {
					await ctx2.sendUserMessage(doc);
				},
			});
		},
	});
}
