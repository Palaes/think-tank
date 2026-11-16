/// <reference path="../Common/Globals.ts" />

/// <reference path="./Channels.ts" />

type VarValue = string | boolean | number;

class ExecutionState {
	private variables: Dict<VarValue> = {};
	private channels: Dict<InternalChannel> = {};
	private factory: ChannelFactory;
	private sink: OutputSink;

	public constructor(factory: ChannelFactory, sink: OutputSink) {
		this.factory = factory;
		this.sink = sink;
	}

	public setVariable(name: string, value: VarValue): void {
		this.variables[name] = value;
	}

	public getString(name: string): string {
		const raw = this.variables[name];
		if (raw == undefined) {
			return undefined;
		}
		return String(raw);
	}

	public getBoolean(name: string): boolean {
		const raw = this.variables[name];
		if (raw == undefined) {
			return undefined;
		}
		if (typeof raw == "string") {
			switch (raw) {
				case "TRUE":
				case "True":
				case "true":
				case "T":
				case "t":
				case "YES":
				case "Yes":
				case "yes":
				case "Y":
				case "y":
					return true;
				default:
					return false;
			}
		}
		if (typeof raw == "boolean") {
			return raw;
		}
		if (typeof raw == "number") {
			return raw > 0;
		}
	}

	public getNumber(name: string): number {
		const raw = this.variables[name];
		if (raw == undefined) {
			return undefined;
		}
		if (typeof raw == "string") {
			const num = parseFloat(raw);
			if (isNaN(num)) {
				return undefined;
			}
			return num;
		}
		if (typeof raw == "boolean") {
			if (raw) {
				return 1;
			}
			return 0;
		}
		if (typeof raw == "number") {
			return raw;
		}
	}

	public increment(name: string): void {
		const value = this.getNumber(name) ?? 0;
		this.variables[name] = value + 1;
	}

	public delete(name: string): void {
		delete this.variables[name];
	}

	public getChannel(name: string): StringChannel {
		const external = this.factory.create(name);
		if (external) {
			return external;
		}
		if (name.includes("/") || name.includes(".")) {
			return null;
		}
		return this.channels[name] = this.channels[name] ?? new InternalChannel();
	}

	public stream(text: string): void {
		this.sink.stream(text);
	}

	public print(text: string): void {
		this.sink.print(text);
	}

	public async expandName(text: string): Promise<string> {
		return this.expandSubstitutions(text, false);
	}

	public async expandValue(text: string): Promise<string> {
		return this.expandSubstitutions(text, true);
	}

	private async expandSubstitutions(result: string, useChannels: boolean): Promise<string> {
		let match: RegExpMatchArray;
		while (match = result.match(/\{\{([^{}]+)\}\}/)) {
			const outer = match[0];
			const inner = match[1];
			let replacement = this.getString(inner);
			if (replacement == undefined) {
				if (useChannels) {
					const channel = this.getChannel(inner);
					if (channel) {
						replacement = "";
						for await (const chunk of channel.read()) {
							replacement += chunk;
							replacement += "\n\n";
						}
					} else {
						// TODO: Handle warning.
						replacement = "UNDEFINED";
					}
				} else {
					// TODO: Handle warning.
					replacement = "UNDEFINED";
				}
			}
			result = result.replace(outer, replacement);
		}
		return result;
	}
}