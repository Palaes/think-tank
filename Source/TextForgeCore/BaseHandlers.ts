/// <reference path="../Language/ScriptParser.ts" />

class BaseHandlers {
	public static async set(state: ExecutionState, name: string, value: string): Promise<void> {
		// name = await state.expandName(name);
		value = await state.expandValue(value);
		state.setVariable(name, value);
	}

	public static async run(state: ExecutionState, source: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		for await (const text of input.read()) {
			const calls = ScriptParser.parse(text);
			for (const call of calls) {
				await ExecutionCore.executeCall(state, call);
			}
		}
	}

	public static async print(state: ExecutionState, value: string): Promise<void> {
		value = await state.expandValue(value);
		state.print(value);
	}
}