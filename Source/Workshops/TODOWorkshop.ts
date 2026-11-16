/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />
/// <reference path="../AgoraServer/ChatUtil.ts" />
/// <reference path="../AgoraServer/ParamsUtil.ts" />
/// <reference path="../AgoraServer/ProcessUtil.ts" />

interface TODOSettings {
	enabled: boolean;
	lastIndex: number;
	defaultChat?: string;
}

interface TODOEntry {
	category: string;
	text: string;
	name: string;
	due: string;
	repeat: string;
	done: boolean;
}

namespace TODOWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/TODOs");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");

	export const defaultSettings = {
		enabled: true,
		lastIndex: 0
	};

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.todo.enabled) {
			return {
				todo: {
					add: TODOWorkshop.addAction,
					list: TODOWorkshop.listAction,
					cats: TODOWorkshop.catsAction,
					done: TODOWorkshop.doneAction,
					edit: TODOWorkshop.editAction,
					remove: TODOWorkshop.removeAction,
					remind: TODOWorkshop.remindAction,
					cancel: TODOWorkshop.cancelAction
				}
			};
		}
		return {};
	}

	export async function initialize(): Promise<void> {
		await NodeUtil.makeDirPromise(TODOWorkshop.rootPath, { recursive: true });
		await SettingsUtil.ensure(TODOWorkshop.settingsPath, TODOWorkshop.defaultSettings);
	}

	export async function readSettings(): Promise<TODOSettings> {
		return SettingsUtil.read(TODOWorkshop.settingsPath, TODOWorkshop.defaultSettings);
	}

	export async function editSettings(overrides: Partial<TODOSettings>): Promise<TODOSettings> {
		return SettingsUtil.edit(TODOWorkshop.settingsPath, overrides, TODOWorkshop.defaultSettings);
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.todo.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "TODO actions",
			content: `TODO Actions:
Create a TODO:
@todo-add [cat=name] [due=when] [repeat=every] <text>
List TODO categories:
@todo-cats
List TODOs:
@todo-list [cat=name] [words]
Mark a TODO done:
@todo-done <id>
Edit a TODO:
@todo-edit <id> [category=name] [due=when] [repeat=every] [text]
Remove a TODO:
@todo-remove <id>
Schedule a reminder:
@todo-remind [time=when] [repeat=every] <message>
Cancel a reminder:
@todo-cancel <id>`
		}];
	}

	export async function addAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const fields = { cat: "INBOX", due: null, repeat: null };
		const text = TextUtil.parseMetaFields((args ?? "").trim(), fields);
		if (text) {
			const category = fields.cat;
			const due = fields.due ? TODOWorkshop.parseDue(fields.due) : null;
			const repeat = fields.repeat;
			const todos = await TODOWorkshop.readTodos(category);
			const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
			const id = `${year}-${month}-${day}-${padded}`;
			const todo: TODOEntry = { category, text, name: id, due, repeat, done: false };
			todos.push(todo);
			await TODOWorkshop.writeTodos(category, todos);
			return TODOWorkshop.infoEntry(`Created TODO:\n${TODOWorkshop.formatTodo(todo)}`);
		}
		return null;
	}

	export async function listAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const fields = { cat: null };
		const text = TextUtil.parseMetaFields((args ?? "").trim(), fields);
		const words = text.toLowerCase().split(/\s+/).filter(Boolean);
		const names = fields.cat ? [ fields.cat ] : await TODOWorkshop.listCategories();
		const blocks = [];
		for (const name of names) {
			const lines = [];
			for (const todo of await TODOWorkshop.readTodos(name)) {
				if (TODOWorkshop.matchesWords(todo, words)) {
					lines.push(TODOWorkshop.formatTodo(todo));
				}
			}
			if (lines.length) {
				blocks.push(`${name}:\n${lines.join("\n")}`);
			}
		}
		if (blocks.length == 0) {
			return TODOWorkshop.resultEntry("todo-list", "There are no TODOs.");
		}
		return TODOWorkshop.resultEntry("todo-list", blocks.join("\n\n"));
	}

	export async function catsAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const categories = await TODOWorkshop.listCategories();
		if (categories.length == 0) {
			return TODOWorkshop.resultEntry("todo-cats", "There are no categories.");
		}
		return TODOWorkshop.resultEntry("todo-cats", categories.join("\n"));
	}

	export async function doneAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const id = (args ?? "").trim();
		for (const category of await TODOWorkshop.listCategories()) {
			const todos = await TODOWorkshop.readTodos(category);
			for (const todo of todos) {
				if (todo.name == id) {
					todo.done = true;
					if (todo.repeat && todo.due) {
						todos.push(await TODOWorkshop.repeatTodo(todo));
					}
					await TODOWorkshop.writeTodos(category, todos);
					return TODOWorkshop.infoEntry(`Done TODO:\n${TODOWorkshop.formatTodo(todo)}`);
				}
			}
		}
		return null;
	}

	export async function editAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const parts = (args ?? "").trim().split(/[ \t]+/);
		const id = parts.shift() ?? "";
		for (const category of await TODOWorkshop.listCategories()) {
			const todos = await TODOWorkshop.readTodos(category);
			for (let index = 0; index < todos.length; ++index) {
				if (todos[index].name == id) {
					const todo = todos[index];
					const target = TODOWorkshop.editTodo(todo, parts);
					if (target && target != category) {
						todos.splice(index, 1);
						await TODOWorkshop.writeTodos(category, todos);
						todo.category = target;
						const targetTodos = await TODOWorkshop.readTodos(target);
						targetTodos.push(todo);
						await TODOWorkshop.writeTodos(target, targetTodos);
					} else {
						await TODOWorkshop.writeTodos(category, todos);
					}
					return TODOWorkshop.infoEntry(`Edited TODO:\n${TODOWorkshop.formatTodo(todo)}`);
				}
			}
		}
		return null;
	}

	export async function removeAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const id = (args ?? "").trim();
		for (const category of await TODOWorkshop.listCategories()) {
			const todos = await TODOWorkshop.readTodos(category);
			for (let index = 0; index < todos.length; ++index) {
				if (todos[index].name == id) {
					const todo = todos[index];
					todos.splice(index, 1);
					await TODOWorkshop.writeTodos(category, todos);
					return TODOWorkshop.infoEntry(`Removed TODO:\n${TODOWorkshop.formatTodo(todo)}`);
				}
			}
		}
		return null;
	}

	export async function cancelAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const id = (args ?? "").trim();
		if (id && await WorkshopUtil.removeSchedule(id)) {
			return TODOWorkshop.infoEntry(`Canceled reminder: ${id}`);
		}
		return null;
	}

	export async function remindAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const fields = { time: "1d", repeat: null };
		const content = TextUtil.parseMetaFields((args ?? "").trim(), fields);
		const next = TODOWorkshop.parseDue(fields.time);
		if (params.chatID && content && next) {
			const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
			const id = `${year}-${month}-${day}-${padded}`;
			let line = `Created reminder:\n- ${content} @id=${id} @due=${next}`;
			if (fields.repeat) {
				line += ` @repeat=${fields.repeat}`;
			}
			await WorkshopUtil.scheduleAt(id, next, "onRemind", { chatID: params.chatID, content }, fields.repeat);
			return TODOWorkshop.infoEntry(line);
		}
		return null;
	}

	// Sends the todos that are due soon to the chat, the ark answers it.
	export async function onSchedule(params: any): Promise<void> {
		const content = await TODOWorkshop.buildDueReport(Date.now());
		if (content) {
			await TODOWorkshop.sendReport(params.chatID, content);
		}
	}

	// Sends a stored reminder message to the chat, the ark answers it.
	export async function onRemind(params: any): Promise<void> {
		const content = TODOWorkshop.buildContent([ params.content ], "");
		await TODOWorkshop.sendReport(params.chatID, content);
	}

	// Lists todos by how soon they are due, the empty sections left out.
	export async function buildDueReport(now: number): Promise<string> {
		const today = DateUtil.toLocalDate(now);
		const twoDays = DateUtil.toLocalDate(now + 2 * 86400000);
		const sevenDays = DateUtil.toLocalDate(now + 7 * 86400000);
		const pastDue = [];
		const dueTwo = [];
		const dueSeven = [];
		for (const category of await TODOWorkshop.listCategories()) {
			for (const todo of await TODOWorkshop.readTodos(category)) {
				if (todo.done || todo.due == null) {
					continue;
				}
				const dueDate = todo.due.slice(0, 10);
				if (dueDate < today) {
					pastDue.push(todo);
				} else if (dueDate <= twoDays) {
					dueTwo.push(todo);
				} else if (dueDate <= sevenDays) {
					dueSeven.push(todo);
				}
			}
		}
		if (pastDue.length == 0 && dueTwo.length == 0 && dueSeven.length == 0) {
			return "";
		}
		const parts = [ "Wake up to scheduled TODO check:" ];
		TODOWorkshop.addDueSection(parts, "Past due items:", pastDue);
		TODOWorkshop.addDueSection(parts, "Due in two days:", dueTwo);
		TODOWorkshop.addDueSection(parts, "Due in seven days:", dueSeven);
		return parts.join("\n\n");
	}

	export function addDueSection(parts: string[], title: string, todos: TODOEntry[]): void {
		if (todos.length == 0) {
			return;
		}
		const lines = [ title ];
		for (const todo of todos) {
			lines.push(TODOWorkshop.formatTodo(todo));
		}
		parts.push(lines.join("\n"));
	}

	export async function sendReport(chatID: string, content: string): Promise<void> {
		const target = await TODOWorkshop.resolveChat(chatID);
		if (target.chatID == null) {
			return;
		}
		const lock = await Mutex.lock(target.chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(target.chatID, new AgoraStreamer(target.chatID, null));
			await ProcessUtil.sendMessage(params, "env", "todo-report", target.notice + content, [], []);
		} finally {
			AgoraStreamer.end(target.chatID);
			lock.release();
		}
	}

	// Falls back from the source chat to the default chat, then to the newest chat,
	// skipping archived ones so the report can still be answered.
	export async function resolveChat(chatID: string): Promise<{ chatID: string, notice: string }> {
		if (await ChatUtil.isChatAvailable(chatID)) {
			return { chatID, notice: "" };
		}
		const settings = await TODOWorkshop.readSettings();
		const defaultChat = settings.defaultChat;
		if (await ChatUtil.isChatAvailable(defaultChat)) {
			return { chatID: defaultChat, notice: `Source chat ${chatID} is unavailable, sending here instead:\n` };
		}
		const latestChat = await ChatUtil.latestChat();
		if (latestChat) {
			return { chatID: latestChat, notice: `Source chat ${chatID} and default ${defaultChat} are unavailable, sending here instead:\n` };
		}
		return { chatID: null, notice: "" };
	}

	export function categoryPath(category: string): string {
		return NodeUtil.getPath(TODOWorkshop.rootPath, `${category.replace(/\W+/g, "-")}.txt`);
	}

	export function resultEntry(name: string, content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "env", name, content };
	}

	export function infoEntry(content: string): ContextEntry {
		return { type: "message", time: Date.now(), role: "info", name: "todo", content };
	}

	export async function listCategories(): Promise<string[]> {
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(TODOWorkshop.rootPath)) {
			if (name.endsWith(".txt")) {
				result.push(name.slice(0, -4));
			}
		}
		return result;
	}

	export async function readCategory(category: string): Promise<string> {
		return FileUtil.readTextLocked(TODOWorkshop.categoryPath(category));
	}

	export async function readTodos(category: string): Promise<TODOEntry[]> {
		const content = await TODOWorkshop.readCategory(category);
		const result = [];
		if (content) {
			for (const line of content.split("\n")) {
				const entry = TODOWorkshop.parseTodo(category, line);
				if (entry) {
					result.push(entry);
				}
			}
		}
		return result;
	}

	export async function writeTodos(category: string, todos: TODOEntry[]): Promise<void> {
		await NodeUtil.makeDirPromise(TODOWorkshop.rootPath, { recursive: true });
		const lines = [];
		for (const todo of todos) {
			lines.push(TODOWorkshop.formatTodo(todo));
		}
		await FileUtil.writeTextLocked(TODOWorkshop.categoryPath(category), lines.join("\n"));
	}

	export function parseTodo(category: string, line: string): TODOEntry {
		const trimmed = line.trim();
		const done = trimmed.startsWith("+ ");
		if (done || trimmed.startsWith("- ")) {
			const fields = { "@id": null, "@due": null, "@repeat": null };
			const text = TextUtil.parseMetaFields(trimmed.slice(2), fields);
			return { category, text: text.trim(), name: fields["@id"], due: fields["@due"], repeat: fields["@repeat"], done };
		}
		return null;
	}

	export function formatTodo(todo: TODOEntry): string {
		let mark = "-";
		if (todo.done) {
			mark = "+";
		}
		let line = `${mark} ${todo.text} @id=${todo.name}`;
		if (todo.due) {
			line += ` @due=${todo.due}`;
		}
		if (todo.repeat) {
			line += ` @repeat=${todo.repeat}`;
		}
		return line;
	}

	export function matchesWords(todo: TODOEntry, words: string[]): boolean {
		const text = todo.text.toLowerCase();
		for (const word of words) {
			if (text.includes(word) == false) {
				return false;
			}
		}
		return true;
	}

	export function editTodo(todo: TODOEntry, parts: string[]): string {
		const fields: { category?: string, due?: string, repeat?: string } = {};
		const text = TextUtil.parseMetaFields(parts.join(" "), fields);
		if (text) {
			todo.text = text;
		}
		if (fields.due) {
			todo.due = TODOWorkshop.parseDue(fields.due);
		}
		if (fields.repeat) {
			todo.repeat = fields.repeat;
		}
		return fields.category ?? null;
	}

	// The next occurrence of a repeating todo, the done one kept in place.
	export async function repeatTodo(todo: TODOEntry): Promise<TODOEntry> {
		const { year, month, day, padded } = await LibraryUtil.nextParts(TODOWorkshop.settingsPath);
		const id = `${year}-${month}-${day}-${padded}`;
		const due = DateUtil.advanceWhen(todo.due, todo.repeat, Date.now());
		return { ...todo, name: id, due, done: false };
	}

	export function parseDue(value: string): string {
		return DateUtil.formatWhen(DateUtil.parseWhen(value));
	}

	export function buildReminder(messages: string[]): string {
		if (messages.length == 0) {
			return "";
		}
		let title = "Wake up to reminders:";
		return [ title, ...messages ].join("\n");
	}

	export function buildContent(messages: string[], todos: string): string {
		const reminder = TODOWorkshop.buildReminder(messages);
		// let request = "";
		// if (reminder || todos) {
		// 	request = "Please remind the user about these in your natural style.";
		// }
		// const parts = [ reminder, todos, request ];
		const parts = [ reminder, todos ];
		return parts.filter(part => part).join("\n\n");
	}
}