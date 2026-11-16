/// <reference path="./TextUtil.ts" />

// The shared typing behaviour of the plain text editors: a tab types a tab,
// shift tab unindents, and the modifier chords shift or move lines.
namespace TextEditor {
	export function bind(input: HTMLTextAreaElement): void {
		input.addEventListener("keydown", event => TextEditor.onKeyDown(input, event));
	}

	// control+alt, command+alt and control+command
	export function isChord(event: KeyboardEvent): boolean {
		if (event.ctrlKey && event.altKey) {
			return true;
		}
		if (event.ctrlKey && event.metaKey) {
			return true;
		}
		return event.altKey && event.metaKey;
	}

	export function onKeyDown(input: HTMLTextAreaElement, event: KeyboardEvent): void {
		if (event.key == "Tab") {
			event.preventDefault();
			if (event.shiftKey) {
				TextEditor.shiftIndent(input, -1);
			} else {
				TextEditor.insertTab(input);
			}
			return;
		}
		if (TextEditor.isChord(event)) {
			if (event.key == "ArrowRight") {
				event.preventDefault();
				TextEditor.shiftIndent(input, 1);
				return;
			}
			if (event.key == "ArrowLeft") {
				event.preventDefault();
				TextEditor.shiftIndent(input, -1);
				return;
			}
			if (event.key == "ArrowUp") {
				event.preventDefault();
				TextEditor.moveLines(input, -1);
				return;
			}
			if (event.key == "ArrowDown") {
				event.preventDefault();
				TextEditor.moveLines(input, 1);
			}
		}
	}

	export function shiftIndent(input: HTMLTextAreaElement, delta: number): void {
		const result = TextUtil.shiftIndent(input.value, input.selectionStart, input.selectionEnd, delta);
		input.value = result.value;
		input.selectionStart = result.start;
		input.selectionEnd = result.end;
	}

	export function insertTab(input: HTMLTextAreaElement): void {
		const start = input.selectionStart;
		const end = input.selectionEnd;
		input.value = input.value.slice(0, start) + "\t" + input.value.slice(end);
		input.selectionStart = start + 1;
		input.selectionEnd = start + 1;
	}

	// Moves every line the selection touches one line up or down, the caret kept.
	export function moveLines(input: HTMLTextAreaElement, delta: number): void {
		const value = input.value;
		const start = input.selectionStart;
		const end = input.selectionEnd;
		const lines = value.split("\n");
		const firstLine = value.slice(0, start).split("\n").length - 1;
		let lastLine = value.slice(0, end).split("\n").length - 1;
		if (end > start && value[end - 1] == "\n") {
			--lastLine;
		}
		if (lastLine < firstLine) {
			lastLine = firstLine;
		}
		const count = lastLine - firstLine + 1;
		const target = firstLine + delta;
		if (target < 0 || target > lines.length - count) {
			return;
		}
		const oldStart = TextEditor.lineOffset(lines, firstLine);
		const block = lines.splice(firstLine, count);
		lines.splice(target, 0, ...block);
		const newStart = TextEditor.lineOffset(lines, target);
		input.value = lines.join("\n");
		input.selectionStart = newStart + (start - oldStart);
		input.selectionEnd = newStart + (end - oldStart);
	}

	export function lineOffset(lines: string[], index: number): number {
		let result = 0;
		for (let i = 0; i < index; ++i) {
			result += lines[i].length + 1;
		}
		return result;
	}
}