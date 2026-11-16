/// <reference path="../Common/NodeUtil.ts" />

/// <reference path="SpeechUtil.ts" />

type ChatState = "idle" | "active" | "raised" | "aborted";

interface ChatControl {
	state: ChatState;
	controller: AbortController;
}

class AgoraStreamer {
	private static readonly controls: Dict<ChatControl> = {};

	public static getControl(chatID: string): ChatControl {
		return this.controls[chatID] ?? { state: "idle", controller: null };
	}

	public static checkAborted(chatID: string): boolean {
		return this.getControl(chatID).state == "aborted";
	}

	public static checkRaised(chatID: string): boolean {
		return this.getControl(chatID).state == "raised";
	}

	public static abort(chatID: string): void {
		SpeechUtil.abort(chatID);
		if (chatID in this.controls) {
			this.controls[chatID].state = "aborted";
			this.controls[chatID].controller.abort();
		}
	}

	public static raiseHand(chatID: string): void {
		this.getControl(chatID).state = "raised";
	}

	public static end(chatID: string): void {
		SpeechUtil.finish(chatID);
		delete this.controls[chatID];
	}

	private chatID: string;
	private response: any;

	public controller: AbortController;

	public checkAbort = (): boolean => {
		return AgoraStreamer.checkAborted(this.chatID);
	};

	public onChunk = (chunk: string): string => {
		this.streamEscaped(chunk);
		return chunk;
	};

	public onSpeak = (chunk: string, settings: TTSSettings): void => {
		SpeechUtil.feed(this.chatID, chunk, settings);
	};

	public flushSpeech(): void {
		SpeechUtil.flush(this.chatID);
	}

	public onError = (error: Error): string => {
		if (error.name == "AbortError") {
			this.streamInfo("interrupted");
			return "\n\n[interrupted]";
		}
		this.streamInfo(error.message);
		return "\n\n[error]";
	};

	public constructor(chatID: string, response: any) {
		this.chatID = chatID;
		this.response = response;
		this.controller = new AbortController();
		// this may override but chatID guards prevent it
		AgoraStreamer.controls[chatID] = { state: "active", controller: this.controller };
	}

	public streamRaw(content: string): void {
		if (this.response) {
			this.response.write(content);
		}
	}

	public streamEscaped(content: string): void {
		if (this.response) {
			this.response.write(content.replace(/\[/g, "\\[").replace(/\]/g, "\\]"));
		}
	}

	public streamInfo(content: string): void {
		this.streamRaw("[[message role=info]]\n");
		if (content) {
			this.streamEscaped(content);
			this.streamRaw("\n");
		}
	}

	public streamMessage(role: string, name: string, time: number): void {
		this.streamRaw(`[[message role=${role} name=${encodeURIComponent(name)} time=${time}]]\n`)
	}

	public streamImage(name: string): void {
		this.streamRaw(`[[image name=${encodeURIComponent(name)}]]\n`)
	}

	public streamDocument(name: string): void {
		this.streamRaw(`[[document name=${encodeURIComponent(name)}]]\n`)
	}

	public streamEntry(entry: ContextEntry): void {
		if (entry.type == "message") {
			this.streamMessage(entry.role, entry.name, entry.time);
		} else if (entry.type == "image") {
			this.streamImage(entry.name);
		} else if (entry.type == "document") {
			this.streamDocument(entry.name);
		}
		if (entry.content) {
			this.streamEscaped(entry.content);
			this.streamRaw("\n");
		}
	}

	public hasStream(): boolean {
		if (this.response) {
			return true;
		} else {
			return false;
		}
	}
}