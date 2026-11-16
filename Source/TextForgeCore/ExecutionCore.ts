/// <reference path="./ExecutionState.ts" />
/// <reference path="./BaseHandlers.ts" />
/// <reference path="./IOHandlers.ts" />
/// <reference path="./TextHandlers.ts" />

type ParameterType = "string" | "channel";

type TextCommandHandler = (state: ExecutionState, ...parameters: string[]) => Promise<void>;

interface ParameterDescriptor {
	type: ParameterType;
	fallback: string;
}

interface CommandDescriptor {
	signature: ParameterDescriptor[];
	handler: TextCommandHandler;
}

interface CommandCall {
	command: string;
	parameters: string[];
}

class ExecutionCore {
	private static readonly commands: Dict<CommandDescriptor> = {
		set: this.createDescriptor("name value", BaseHandlers.set),
		run: this.createDescriptor("source=stdin", BaseHandlers.run),
		print: this.createDescriptor("value", BaseHandlers.print),
		add: this.createDescriptor("value target=main", IOHandlers.add),
		read: this.createDescriptor("source=stdin target=main", IOHandlers.read),
		write: this.createDescriptor("target=stdout source=main", IOHandlers.write),
		copy: this.createDescriptor("target=stdout source=main", IOHandlers.copy),
		split: this.createDescriptor("limit=2000 source=main target=main", TextHandlers.split),
		merge: this.createDescriptor("separator=\n\n source=main target=main", TextHandlers.merge),
		process: this.createDescriptor("prompt source=main target=main", TextHandlers.process),
		replace: this.createDescriptor("pattern replacement source=main target=main", TextHandlers.replace),
		clean: this.createDescriptor("source=main target=main", TextHandlers.clean)
	};

	private static createDescriptor(representation: string, handler: TextCommandHandler): CommandDescriptor {
		const signature = [];
		for (const parameter of representation.split(" ")) {
			const [ type, fallback ] = parameter.split("=");
			signature.push({ type: type as ParameterType, fallback });
		}
		return { signature, handler };
	}

	public static async executeCall(state: ExecutionState, call: CommandCall): Promise<void> {
		const command = this.commands[call.command];
		if (command) {
			if (command.signature.length < call.parameters.length) {
				// TODO: Handle warning.
			}
			const resolved = [];
			for (let i = 0; i < command.signature.length; ++i) {
				resolved[i] = call.parameters[i] ?? command.signature[i].fallback;
			}
			// console.log(call.command, resolved);
			await command.handler(state, ...resolved);
		} else {
			// TODO: Handle error.
		}
	}
}