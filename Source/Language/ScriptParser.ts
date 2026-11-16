/// <reference path="./CLIParser.ts" />

class ScriptParser {
	private static * descape(source: string): Generator<string> {
		let state = "normal";
		for (let i = 0; i < source.length; ++i) {
			const char = source[i];
			if (state == "escape") {
				if (char == "s") {
					yield "\\ ";
				} else if (char == "t") {
					yield "\\\t";
				} else if (char == "n") {
					yield "\\\n";
				} else {
					yield "\\" + char;
				}
				state = "normal";
			} else if (state == "comment") {
				if (char == "/") {
					yield "//";
				} else {
					yield "/";
					yield char;
				}
				state = "normal";
			} else if (char == "\\") {
				state = "escape";
			} else if (char == "/") {
				state = "comment";
			} else {
				yield char;
			}
		}
	}

	private static readonly transitions = {
		"normal": {
			" ": "new",
			"\t": "new",
			"\n": "new",
			"\"": "str-1",
			"'": "str-2",
			"`": "str-3",
			"//": "cmt"
		},
		"str-1": {
			"\"": "normal"
		},
		"str-2": {
			"'": "normal"
		},
		"str-3": {
			"`": "normal"
		},
		"cmt": {
			"\n": "new"
		}
	}

	private static * tokanize(source: string): Generator<string> {
		let token = "";
		let state = "normal";

		for (const char of this.descape(source)) {
			const transition = this.transitions[state][char];
			if (transition == "new") {
				if (token) {
					yield token;
				}
				token = "";
				state = "normal";
			} else if (transition) {
				state = transition
			} else if (state == "cmt") {
				// discard comment text
			} else {
				token += char.slice(-1);
			}
		}
		if (token) {
			yield token;
		}
	}

	public static parse(source: string): CommandCall[] {
		return CLIParser.parse([ ...this.tokanize(source) ]);
	}
}