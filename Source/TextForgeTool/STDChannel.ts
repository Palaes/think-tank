/// <reference path="../TextForgeCore/Channels.ts" />
/// <reference path="./StreamChannel.ts" />

class STDChannel extends StreamChannel implements StringChannel {
	public constructor() {
		super(true);
	}

	public async * read(): AsyncGenerator<string> {
		yield * this.readstream(process.stdin);
	}

	public async write(value: string): Promise<void> {
		if (value) {
			process.stdout.write(`${value}\n\n`);
		}
	}
}
