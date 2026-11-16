/// <reference path="../Common/Globals.ts" />

class IOHandlers {
	public static async add(state: ExecutionState, value: string, target: string): Promise<void> {
		// value = await state.expandValue(value);
		target = await state.expandName(target);
		state.getChannel(target).write(value);
	}

	public static async read(state: ExecutionState, source: string, target: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			// text = await state.expandValue(text);
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(text);
		}
	}

	public static async write(state: ExecutionState, target: string, source: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			text = await state.expandValue(text);
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(text);
		}
	}

	public static async copy(state: ExecutionState, target: string, source: string): Promise<void> {
		source = await state.expandName(source);
		const input = state.getChannel(source);
		// prevents infinite circling when source and target are the same
		input.write(null);
		state.delete("index");
		for await (let text of input.read()) {
			state.increment("index");
			state.increment("count");
			// text = await state.expandValue(text);
			target = await state.expandName(target);
			const output = state.getChannel(target);
			await output.write(text);
			await input.write(text);
		}
	}
}