/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../TextForgeCore/ExecutionCore.ts" />
/// <reference path="../TextForgeCore/ExecutionState.ts" />
/// <reference path="../TextForgeCore/Channels.ts" />
/// <reference path="../Language/ScriptParser.ts" />
/// <reference path="./Config.ts" />

namespace TextForgeServer {
	export interface RouteSpec {
		route: string;
		handler?: (requestData: any, response: any) => Promise<any>;
		dir?: string;
	}

	const CTNDJSON = { "Content-Type": "application/x-ndjson" };

	class SinkChannel implements StringChannel {
		private sink: OutputSink;

		public constructor(sink: OutputSink) {
			this.sink = sink;
		}

		public async * read(): AsyncGenerator<string> {
			// the server never reads back from stdout
		}

		public async write(value: string): Promise<void> {
			if (value) {
				this.sink.stream(`${value}\n\n`);
			}
		}
	}

	class RequestChannelFactory implements ChannelFactory {
		private inputChannel = new InternalChannel();
		private stdoutChannel: SinkChannel;

		public constructor(input: string, sink: OutputSink) {
			this.inputChannel.write(input);
			this.stdoutChannel = new SinkChannel(sink);
		}

		public create(name: string): StringChannel {
			if (name == "stdin" || name == "input") {
				return this.inputChannel;
			}
			if (name == "stdout") {
				return this.stdoutChannel;
			}
			if (name.includes("/") || name.includes(".")) {
				throw new Error(`channel not allowed: ${name}`);
			}
			return null;
		}
	}

	export function getSpecs(): RouteSpec[] {
		return [
			{ route: "/api/scripts", handler: TextForgeServer.handleScripts },
			{ route: "/api/script", handler: TextForgeServer.handleScript },
			{ route: "/api/run", handler: TextForgeServer.handleRun },
			{ route: "/ui/", dir: "./web/textforge-ui/" }
		];
	}

	export async function handleScripts(requestData: any, response: any): Promise<string[]> {
		const settings = await readSettings();
		if (settings?.scripts) {
			return Object.keys(settings.scripts);
		}
		return [];
	}

	export async function handleScript(requestData: any, response: any): Promise<string> {
		const name = requestData?.name;
		if (name) {
			const settings = await readSettings();
			const location = settings?.scripts?.[name];
			if (location) {
				return FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(location));
			}
		}
		return null;
	}

	export async function handleRun(requestData: any, response: any): Promise<void> {
		response.writeHead(200, CTNDJSON);
		const sink: OutputSink = {
			stream: (text: string) => sendEvent(response, { type: "stream", text }),
			print: (text: string) => sendEvent(response, { type: "stream", text: `${text}\n` })
		};
		const factory = new RequestChannelFactory(requestData?.input ?? "", sink);
		const state = new ExecutionState(factory, sink);
		try {
			const input = requestData?.input ?? "";
			const settings = await readSettings();
			await loadSettings(state, settings);
			await state.getChannel("main").write(input);
			await state.getChannel("original").write(input);
			const calls = ScriptParser.parse(requestData?.script ?? "");
			for (const call of calls) {
				await ExecutionCore.executeCall(state, call);
			}
			const output = await readChannel(state.getChannel("main"));
			sendEvent(response, { type: "output", text: output });
		} catch (error) {
			sendEvent(response, { type: "error", message: getMessage(error) });
		}
		sendEvent(response, { type: "done" });
		response.end();
	}

	async function readSettings(): Promise<any> {
		return FileUtil.readJSONRAW(TextForgeServerConfig.getSettingsPath());
	}

	async function loadSettings(state: ExecutionState, settings: any): Promise<void> {
		if (settings?.variables) {
			for (const name in settings.variables) {
				const content = await FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(settings.variables[name]));
				if (content != null) {
					state.setVariable(name, content);
				}
			}
		}
		if (settings?.channels) {
			for (const name in settings.channels) {
				const content = await FileUtil.readTextRAW(TextForgeServerConfig.getFilePath(settings.channels[name]));
				if (content != null) {
					const channel = state.getChannel(name);
					if (channel) {
						await channel.write(content);
					}
				}
			}
		}
	}

	async function readChannel(channel: StringChannel): Promise<string> {
		let result = "";
		if (channel == null) {
			return result;
		}
		for await (const chunk of channel.read()) {
			if (result) {
				result += "\n\n";
			}
			result += chunk;
		}
		return result;
	}

	function sendEvent(response: any, value: any): void {
		response.write(`${JSON.stringify(value)}\n`);
	}

	function getMessage(error: any): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}
