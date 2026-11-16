type DisablerHandler = (state: number) => void;

interface InputWithHandler {
	input: HTMLElement;
	handler?: DisablerHandler;
}

class InputDisabler {
	private inputs: Set<InputWithHandler> = new Set();
	private states: Map<string, number> = new Map();
	private current: string;

	public addInput(input: HTMLElement, handler?: DisablerHandler): void {
		this.inputs.add({ input, handler });
	}

	public updateAll(state: number): void {
		for (const item of this.inputs) {
			if (item.handler) {
				item.handler(state);
			} else {
				if (state < 1) {
					item.input["disabled"] = false;
					item.input.style.pointerEvents = "";
					item.input.style.cursor = "";
				} else {
					item.input["disabled"] = true;
					item.input.style.pointerEvents = "none";
					item.input.style.cursor = "default";
				}
				if (state < 2) {
					item.input.style.opacity = "";
				} else {
					item.input.style.opacity = "0.5";
				}
			}
		}
	}

	public selectGroup(group: string): void {
		this.current = group;
		this.updateAll(this.states[group] ?? 0);
	}

	public silenceGroup(group: string): void {
		if (this.states[group] > 1) {
			return;
		}
		this.states[group] = 1;
		if (group == this.current) {
			this.updateAll(this.states[group]);
		}
	}

	public wakeGroup(group: string): void {
		if (this.states[group] > 1) {
			return;
		}
		this.states[group] = 0;
		if (group == this.current) {
			this.updateAll(this.states[group]);
		}
	}

	public disableGroup(group: string): void {
		this.states[group] = 2;
		if (group == this.current) {
			this.updateAll(this.states[group]);
		}
	}

	public enableGroup(group: string): void {
		this.states[group] = 0;
		if (group == this.current) {
			this.updateAll(this.states[group]);
		}
	}
}