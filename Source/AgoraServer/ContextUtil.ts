/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

type EntryType = "message" | "image" | "document";

type EntryRole = "user" | "ark" | "env" | "info";

// TODO: Order of optionals?
interface ContextEntry {
	type: EntryType;
	time?: number;
	role?: EntryRole;
	name: string;
	content: string;
}

interface TranscriptTemplate {
	gapHandler: DateGapHandler;
	lineLength: number;
	lineCount: number;
	delimeter: string;
	date: string;
	time: string;
	user: string;
	ark: string;
	env: string;
	info: string;
	image: string;
	document: string;
}

namespace ContextUtil {
	const chatsPath = SettingsUtil.getLocation("/ThinkTank/Agora/Chats");

	export const streamTemplate = {
		gapHandler: null,
		lineLength: Infinity,
		lineCount: Infinity,
		delimeter: "\n",
		date: null,
		time: null,
		user: "[[message role=user name={{name}} time={{epoch}}]]\n{{content}}",
		ark: "[[message role=ark name={{name}} time={{epoch}}]]\n{{content}}",
		env: "[[message role=env name={{name}} time={{epoch}}]]\n{{content}}",
		info: "[[message role=info]]\n{{content}}",
		image: "[[image name={{name}}]]\n{{content}}",
		document: "[[document name={{name}}]]\n{{content}}"
	};

	export const arkTemplate = {
		gapHandler: null,
		lineLength: Infinity,
		lineCount: Infinity,
		delimeter: "\n",
		date: " date={{date}}",
		time: " time={{time}}",
		user: "[[author={{name}}{{date}}{{time}}]]\n{{content}}",
		ark: "{{content}}",
		env: "[[author=env source={{name}}{{date}}{{time}}]]\n{{content}}",
		info: "[[author=env]]\n{{content}}",
		image: "[[image name={{name}}]]\n{{content}}",
		document: "[[document name={{name}}]]\n{{content}}"
	};

	export const archiveTemplate = {
		gapHandler: null,
		lineLength: Infinity,
		lineCount: Infinity,
		delimeter: "\n\n",
		date: "\n{{date}}",
		time: "\n{{time}}",
		user: "Message from {{name}}:{{date}}{{time}}\n\n{{content}}",
		ark: "Message from {{name}}:{{date}}{{time}}\n\n{{content}}",
		env: "Result of {{name}}:{{date}}{{time}}\n\n{{content}}",
		info: "[info]\n{{content}}",
		image: "[image {{name}}]\n{{content}}",
		document: "[document {{name}}]\n{{content}}"
	};

	export const minimalTemplate = {
		gapHandler: null,
		lineLength: 200,
		lineCount: 2,
		delimeter: "\n",
		date: null,
		time: null,
		user: "{{name}}:\n{{content}}",
		ark: "{{name}}:\n{{content}}",
		env: "[result of {{name}}]",
		info: "[{{content}}]",
		image: "[image {{name}}]",
		document: "[document {{name}}]"
	};

	export async function loadActive(chatID: string): Promise<ContextEntry[]> {
		const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
		return FileUtil.readJSONLocked(activePath);
	}

	export async function writeActive(chatID: string, entries: ContextEntry[]): Promise<void> {
		const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
		await FileUtil.writeJSONLocked(activePath, entries);
	}

	export async function editActive(chatID: string, index: number, entries: ContextEntry[]): Promise<ContextEntry[]> {
		const activePath = NodeUtil.getPath(chatsPath, chatID, "active.json");
		return editFile(activePath, index, entries);
	}

	export async function loadArchive(chatID: string): Promise<ContextEntry[]> {
		const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
		return FileUtil.readJSONLocked(archivePath);
	}

	export async function writeArchive(chatID: string, entries: ContextEntry[]): Promise<void> {
		const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
		await FileUtil.writeJSONLocked(archivePath, entries);
	}

	export async function editArchive(chatID: string, index: number, entries: ContextEntry[]): Promise<ContextEntry[]> {
		const archivePath = NodeUtil.getPath(chatsPath, chatID, "archive.json");
		return editFile(archivePath, index, entries);
	}

	async function editFile(path: string, index: number, entries: ContextEntry[]): Promise<ContextEntry[]> {
		const lock = await FileUtil.lock(path);
		try {
			const context = await FileUtil.readJSONRAW(path) ?? [];
			context.splice(index, Infinity, ...entries);
			await FileUtil.writeJSONRAW(path, context);
			return context;
		} finally {
			lock.release();
		}
	}

	export function contextToText(context: ContextEntry[], template: TranscriptTemplate, limit: number): string {
		const result = [];
		for (const entry of context) {
			result.push(entryToText(entry, template));
		}
		return result.slice(-limit).join(template.delimeter);
	}

	export function entryToText(entry: ContextEntry, template: TranscriptTemplate): string {
		let result = template[entry.role ?? entry.type];
		let date = "";
		let time = "";
		if (template.gapHandler) {
			if (result.match(/\{\{date\}\}|\{\{time\}\}/)) {
				const gap = template.gapHandler.check(entry.time);
				if (gap.date) {
					date = template.date.replace("{{date}}", gap.date);
				}
				if (gap.time) {
					time = template.time.replace("{{time}}", gap.time);
				}
			}
		}// TODO: Think this through.
		let content: string;
		if (template.lineCount == Infinity) {
			if (template.lineLength == Infinity) {
				content = TextUtil.normalizeAll(entry.content);
			} else {
				content = TextUtil.shortifyTextNicely(entry.content, template.lineCount, template.lineLength);
			}
		} else {
			content = TextUtil.shortifyTextNicely(entry.content, template.lineCount, template.lineLength);
		}
		return result
			.replace("{{date}}", date)
			.replace("{{time}}", time)
			.replace("{{epoch}}", entry.time)
			.replace("{{name}}", entry.name)
			.replace("{{content}}", content)
			.trim();
	}

	// new functions

	export function getReportArk(entry: ContextEntry, name: string, ending: string): string {
		if (entry.type == "message") {
			if (entry.role == "env") {
				if (entry.name == "name") {
					if (entry.content.endsWith(ending) == false) {
						return entry.content.slice(0, -ending.length);
					}
				}
			}
		}
		return null;
	}

	export async function setEntry(chatID: string, index: number, entry: ContextEntry): Promise<ContextEntry[]> {
		const remove = entry == null;
		const archive = await loadArchive(chatID) ?? [];
		const active = await loadActive(chatID) ?? [];
		if (index < 0) {
			return [ ...archive, ...active ];
		}
		if (index < archive.length) {
			if (remove) {
				archive.splice(index, 1);
			} else {
				archive[index] = entry;
			}
			await writeArchive(chatID, archive);
		} else {
			const activeIndex = index - archive.length;
			if (remove) {
				active.splice(activeIndex, 1);
			} else {
				active[activeIndex] = entry;
			}
			await writeActive(chatID, active);
		}
		return [ ...archive, ...active ];
	}
}