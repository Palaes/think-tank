interface StringChannel {
	read(): AsyncGenerator<string>;
	write(value: string): Promise<void>;
}

interface ChannelFactory {
	create(name: string): StringChannel;
}

interface OutputSink {
	stream(text: string): void;
	print(text: string): void;
}

class InternalChannel implements StringChannel {
	private queue: string[] = [];

	public async * read(): AsyncGenerator<string> {
		while (true) {
			const next = this.queue.shift();
			if (next == null) {
				break;
			}
			yield next;
		}
	}

	public async write(value: string): Promise<void> {
		this.queue.push(value);
	}
}
