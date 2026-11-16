/// <reference path="./MessageView.ts" />
/// <reference path="../Common/DateUtil.ts" />

class ContextView {
	private contentWrapper: HTMLElement;
	private chatContent: HTMLElement;
	private messages: MessageView[] = [];
	private current: MessageView = null;
	private buffer = "";
	private escapeHold = "";
	private dateGapHander: DateGapHandler;

	public constructor(contentWrapper: HTMLElement, chatContent: HTMLElement) {
		this.contentWrapper = contentWrapper;
		this.chatContent = chatContent;
		this.dateGapHander = this.newGapHandler();
	}

	// Full render, for a chat that just came on screen.
	public async loadContext(chatID: string): Promise<void> {
		const context = await AgoraAPI.readContext(chatID);
		this.chatContent.innerHTML = "";
		this.messages = [];
		this.current = null;
		this.buffer = "";
		this.escapeHold = "";
		this.dateGapHander = this.newGapHandler();
		for (const message of context) {
			this.appendMessage(message);
		}
	}

	// Diffed render, for a chat already on screen that gained content.
	public async loadDiff(chatID: string): Promise<void> {
		const context = await AgoraAPI.readContext(chatID);
		const anchor = this.firstDiff(context);
		if (anchor == -1) {
			return;
		}
		while (this.messages.length > anchor) {
			const view = this.messages.pop();
			view.getElement().remove();
		}
		this.current = this.messages[this.messages.length - 1] ?? null;
		this.buffer = "";
		this.escapeHold = "";
		this.rebuildGaps(anchor);
		for (let index = anchor; index < context.length; ++index) {
			this.appendMessage(context[index]);
		}
	}

	// TODO: Implement always adding full date to last user message.
	public appendMessage(message: ContextEntry): MessageView {
		// The previous stream is finished once a new entry starts.
		this.flushEscape();
		if (this.current) {
			this.current.flush();
		}
		let label: string;
		// Only conversation turns get a timestamp; data entries and info blocks
		// must not consume the gap handler state either.
		if (message.role == "user" || message.role == "ark") {
			const result = this.dateGapHander.check(message.time);
			if (result.time) {
				if (result.date) {
					label = `${result.date} ${result.time}`;
				} else {
					label = result.time;
				}
			}
		}
		const view = new MessageView(message, label);
		this.messages.push(view);
		this.current = view;
		this.chatContent.appendChild(view.getElement());
		this.scrollToBottom();
		return view;
	}

	// Feeds the raw stream through the [[meta]] parser.
	public appendChunk(chunk: string): string {
		this.feed(chunk);
		return chunk;
	}

	public removeMessage(role: string, shallow: boolean): void {
		for (let index = this.messages.length - 1; index >= 0; --index) {
			const entry = this.messages[index].getMessage();
			if (entry.type == "message" && entry.role == role) {
				this.removeAt(index);
				return;
			}
			if (entry.type == "message" && shallow) {
				return;
			}
		}
	}

	private removeAt(cut: number): ContextEntry[] {
		const removed: ContextEntry[] = [];
		while (this.messages.length > cut) {
			const view = this.messages.pop();
			view.getElement().remove();
			removed.unshift(view.getMessage());
		}
		this.current = this.messages[this.messages.length - 1] ?? null;
		this.buffer = "";
		this.escapeHold = "";
		return removed;
	}

	// Renders text still held back waiting for a possible link to complete.
	public flush(): void {
		this.releaseHolds();
		if (this.current) {
			this.current.flush();
		}
	}

	private feed(chunk: string): void {
		this.buffer += chunk;
		while (true) {
			const start = this.buffer.indexOf("[[");
			if (start == -1) {
				// no meta in the buffer; hold a trailing "[" (may become "[[")
				// or a trailing newline (may be the separator before the next meta)
				let flush = this.buffer;
				let hold = "";
				if (flush.endsWith("[")) {
					hold = "[";
					flush = flush.slice(0, -1);
				} else if (flush.endsWith("\n")) {
					hold = "\n";
					flush = flush.slice(0, -1);
				}
				this.buffer = hold;
				this.appendContent(flush);
				return;
			}
			// text before the meta belongs to the current block; drop the separator newline
			let before = this.buffer.slice(0, start);
			if (before.endsWith("\r\n")) {
				before = before.slice(0, -2);
			} else if (before.endsWith("\n")) {
				before = before.slice(0, -1);
			}
			this.appendContent(before);
			const end = this.buffer.indexOf("]]", start);
			if (end == -1) {
				// incomplete meta, wait for the rest
				this.buffer = this.buffer.slice(start);
				return;
			}
			const meta = this.buffer.slice(start, end + 2);
			this.buffer = this.buffer.slice(end + 2);
			// consume the meta's line terminator
			if (this.buffer.startsWith("\r\n")) {
				this.buffer = this.buffer.slice(2);
			} else if (this.buffer.startsWith("\n")) {
				this.buffer = this.buffer.slice(1);
			}
			this.processMeta(meta);
		}
	}

	private appendContent(content: string): void {
		if (!content || !this.current) {
			return;
		}
		const isAtBottom = this.isAtBottom();
		this.appendLive(this.decodeContent(content));
		if (isAtBottom) {
			this.scrollToBottom();
		}
	}

	private appendLive(content: string): void {
		this.current.appendChunk(content);
	}

	// Undoes the [[meta]] escaping, holding a trailing backslash that may still
	// grow into an escaped bracket in the next chunk.
	private decodeContent(content: string): string {
		let result = this.escapeHold + content;
		this.escapeHold = "";
		if (result.endsWith("\\")) {
			this.escapeHold = "\\";
			result = result.slice(0, -1);
		}
		return result.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
	}

	// Hands a held backslash to the current block; it never became an escape.
	private flushEscape(): void {
		if (this.escapeHold && this.current) {
			this.current.appendChunk(this.escapeHold);
		}
		this.escapeHold = "";
	}

	// The stream is done, so whatever is still held is plain content. A held
	// newline was a separator that never met its meta, so it is dropped.
	private releaseHolds(): void {
		if (!this.current) {
			this.buffer = "";
			this.escapeHold = "";
			return;
		}
		let held = this.escapeHold + this.buffer;
		this.buffer = "";
		this.escapeHold = "";
		if (held.endsWith("\n")) {
			held = held.slice(0, -1);
		}
		if (held) {
			this.appendLive(held.replace(/\\\[/g, "[").replace(/\\\]/g, "]"));
		}
	}

	private processMeta(meta: string): void {
		const parts = meta.slice(2, -2).trim().split(/\s+/);
		const kind = parts.shift();
		const attrs: any = {};
		for (const part of parts) {
			const index = part.indexOf("=");
			if (index >= 0) {
				attrs[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
			}
		}
		if (kind == "message") {
			this.appendMessage({
				type: "message",
				time: attrs.time ? parseInt(attrs.time) : Date.now(),
				role: attrs.role ?? "ark",
				name: attrs.name ?? "",
				content: ""
			});
		} else if (kind == "image" || kind == "document") {
			this.appendMessage({
				type: kind,
				name: attrs.name ?? "",
				content: ""
			});
		}
	}

	public popMessage(): ContextEntry {
		if (this.messages.length) {
			const lastView = this.messages.pop();
			lastView.getElement().remove();
			this.current = this.messages[this.messages.length - 1] ?? null;
			return lastView.getMessage();
		}
		return null;
	}

	public getContent(): string {
		return this.chatContent.innerText;
	}

	private isAtBottom(): boolean {
		return Math.abs(this.contentWrapper.scrollTop - this.contentWrapper.scrollHeight + this.contentWrapper.clientHeight) < 10;
	}

	private scrollToBottom(): void {
		this.contentWrapper.scrollTop = this.contentWrapper.scrollHeight - this.contentWrapper.clientHeight;
	}

	private newGapHandler(): DateGapHandler {
		return new DateGapHandler(1800000, 300000, 300000);
	}

	// The first index where the live views and the server context disagree; -1
	// means they agree throughout.
	private firstDiff(context: ContextEntry[]): number {
		const limit = Math.min(this.messages.length, context.length);
		for (let index = 0; index < limit; ++index) {
			const entry = this.messages[index].getMessage();
			if (entry.time != context[index].time || entry.type != context[index].type) {
				return index;
			}
		}
		if (this.messages.length != context.length) {
			return limit;
		}
		return -1;
	}

	// The label state cannot be rewound, so it is rebuilt from what stays on
	// screen before the tail is replayed.
	private rebuildGaps(anchor: number): void {
		this.dateGapHander = this.newGapHandler();
		for (let index = 0; index < anchor; ++index) {
			const entry = this.messages[index].getMessage();
			if (entry.role == "user" || entry.role == "ark") {
				this.dateGapHander.check(entry.time);
			}
		}
	}
}
