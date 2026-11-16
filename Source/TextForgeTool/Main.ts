/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="./Config.ts" />
/// <reference path="../TextForgeCore/ExecutionCore.ts" />
/// <reference path="../Language/ScriptParser.ts" />
/// <reference path="../Language/CLIParser.ts" />
/// <reference path="./STDChannel.ts" />
/// <reference path="./FileChannel.ts" />

const RCPath = TextForgeConfig.getRCPath();

class ToolChannelFactory implements ChannelFactory {
	private standardChannel = new STDChannel();

	public create(name: string): StringChannel {
		if (name == "stdin" || name == "stdout") {
			return this.standardChannel;
		}
		if (name.includes("/") || name.includes(".")) {
			return new FileChannel(name);
		}
		return null;
	}
}

class ToolOutputSink implements OutputSink {
	public stream(text: string): void {
		process.stdout.write(text);
	}

	public print(text: string): void {
		process.stdout.write(`${text}\n`);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	let calls: CommandCall[];
	if (args.length) {
		calls = [
			{ command: "run", parameters: [ RCPath ]},
			...CLIParser.parse(args)
		];
	} else {
		calls = [
			{ command: "run", parameters: [ RCPath ]},
			{ command: "run", parameters: [ "stdin" ]}
		];
	}
	const factory = new ToolChannelFactory();
	const sink = new ToolOutputSink();
	const state = new ExecutionState(factory, sink);
	for (const call of calls) {
		await ExecutionCore.executeCall(state, call);
	}
}

main();
