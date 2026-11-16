/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/Globals.ts" />
/// <reference path="../TextForgeCore/Channels.ts" />
/// <reference path="./StreamChannel.ts" />

class FileChannel extends StreamChannel implements StringChannel {
	private readonly filePath: string;

	public constructor(filePath: string) {
		super(false);
		this.filePath = filePath;
	}

	public async * read(): AsyncGenerator<string> {
		try {
			yield * this.readstream(await NodeUtil.fs.createReadStream(this.filePath));
		} catch {
			// TODO: Handle error.
		}
	}

	public async write(value: string): Promise<void> {
		if (value) {
			try {
				const dir = NodeUtil.path.dirname(this.filePath);
				await NodeUtil.makeDirPromise(dir, { recursive: true });
				await NodeUtil.appendFilePromise(this.filePath, `${value}\n\n`, ENCODING);
			} catch {
				// TODO: Handle error.
			}
		}
	}
}
