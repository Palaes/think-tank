namespace FontUtil {
	const chatKey = "chatFont";
	const editorKey = "editorFont";
	const chatDefault = "Roboto";
	const editorDefault = "Consolas";
	const families = [ "Roboto", "Charter", "Consolas" ];
	const classes = [ "fontCharter", "fontRoboto", "fontConsolas" ];

	// The body class carries the choice; chats and editors use the same three
	// styles but store their selection under their own key.
	export function applyChat(family: string = readChat()): void {
		apply(family);
	}

	export function applyEditor(family: string = readEditor()): void {
		apply(family);
	}

	export function readChat(): string {
		return read(chatKey, chatDefault);
	}

	export function readEditor(): string {
		return read(editorKey, editorDefault);
	}

	export function writeChat(family: string): void {
		localStorage.setItem(chatKey, family);
		applyChat(family);
	}

	export function writeEditor(family: string): void {
		localStorage.setItem(editorKey, family);
		applyEditor(family);
	}

	export function getFamilies(): string[] {
		return families.slice();
	}

	function read(key: string, fallback: string): string {
		const stored = localStorage.getItem(key);
		if (families.includes(stored)) {
			return stored;
		}
		return fallback;
	}

	function apply(family: string): void {
		document.body.classList.remove(...classes);
		document.body.classList.add(`font${family}`);
	}
}
