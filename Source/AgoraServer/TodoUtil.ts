/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />

/// <reference path="../ContentServer/LibraryUtil.ts" />

namespace TodoUtil {
	const todoPath = SettingsUtil.getLocation("/ThinkTank/Agora/TODOs");

	export async function listTodos(): Promise<string[]> {
		const result = [];
		for (const name of await LibraryUtil.listDirectoryEntries(todoPath)) {
			if (name.endsWith(".txt")) {
				result.push(name);
			}
		}
		result.sort();
		return result;
	}

	export async function createTodo(name: string): Promise<string> {
		await FileUtil.writeTextLocked(NodeUtil.getPath(todoPath, name), "");
		return name;
	}

	export async function renameTodo(oldName: string, newName: string): Promise<string> {
		await NodeUtil.renamePromise(NodeUtil.getPath(todoPath, oldName), NodeUtil.getPath(todoPath, newName));
		return newName;
	}

	export async function removeTodo(name: string): Promise<string> {
		await NodeUtil.removePromise(NodeUtil.getPath(todoPath, name));
		return name;
	}

	export async function readTodo(name: string): Promise<string> {
		return FileUtil.readTextLocked(NodeUtil.getPath(todoPath, name));
	}

	export async function writeTodo(name: string, content: string): Promise<string> {
		await FileUtil.writeTextLocked(NodeUtil.getPath(todoPath, name), content);
		return content;
	}
}