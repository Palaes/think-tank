/// <reference path="../Common/StreamUtil.ts" />

// Plays the raw PCM stream from /agora/api/listen. A live WAV is not
// supported by every browser, so the samples are scheduled directly.
class SpeechPlayer {
	private static readonly sampleRate = 24000;

	private context: AudioContext;
	private controller: AbortController = null;
	private sources: AudioBufferSourceNode[] = [];
	private leftover = new Uint8Array(0);
	private nextTime = 0;

	public prepare(): void {
		if (this.context == null) {
			this.context = new AudioContext();
		}
		this.context.resume();
	}

	public start(url: string): void {
		this.stop();
		this.prepare();
		this.controller = new AbortController();
		this.play(url, this.controller.signal);
	}

	public stop(): void {
		if (this.controller) {
			this.controller.abort();
			this.controller = null;
		}
		for (const source of this.sources) {
			source.stop();
		}
		this.sources = [];
		this.leftover = new Uint8Array(0);
		this.nextTime = 0;
	}

	private async play(url: string, signal: AbortSignal): Promise<void> {
		let response: Response;
		try {
			response = await fetch(url, { signal });
		} catch {
			return;
		}
		if (response.ok == false || response.body == null) {
			return;
		}
		for await (const chunk of StreamUtil.asIterable<Uint8Array>(response.body)) {
			if (signal.aborted) {
				return;
			}
			this.append(chunk);
		}
	}

	// Chunks can split a sample, so the odd trailing byte waits for the next one.
	private append(chunk: Uint8Array): void {
		const combined = new Uint8Array(this.leftover.length + chunk.length);
		combined.set(this.leftover, 0);
		combined.set(chunk, this.leftover.length);
		const count = combined.length - combined.length % 2;
		if (count == 0) {
			this.leftover = combined;
			return;
		}
		this.leftover = combined.slice(count);
		const samples = new Int16Array(combined.buffer, combined.byteOffset, count / 2);
		this.schedule(samples);
	}

	private schedule(samples: Int16Array): void {
		const buffer = this.context.createBuffer(1, samples.length, SpeechPlayer.sampleRate);
		const data = buffer.getChannelData(0);
		for (let index = 0; index < samples.length; ++index) {
			data[index] = samples[index] / 32768;
		}
		const source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.context.destination);
		const time = Math.max(this.nextTime, this.context.currentTime + 0.1);
		source.start(time);
		this.nextTime = time + buffer.duration;
		this.sources.push(source);
		source.addEventListener("ended", () => {
			const index = this.sources.indexOf(source);
			if (index >= 0) {
				this.sources.splice(index, 1);
			}
		});
	}
}
