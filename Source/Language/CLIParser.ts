interface CommandCall {
	command: string;
	parameters: string[];
}

class CLIParser {
	public static parse(args: string[]): CommandCall[] {
		let result = [];
		let command: string;
		let parameters = [];
		for (const arg of args) {
			if (arg.endsWith(":")) {
				if (command) {
					result.push({ command, parameters });
				}
				command = arg.substring(0, arg.length - 1);
				parameters = [];
			} else if (command) {
				parameters.push(arg);
			} else {
				// TODO: Handle error.
			}
		}
		if (command) {
			result.push({ command, parameters });
		}
		return result;
	}
}