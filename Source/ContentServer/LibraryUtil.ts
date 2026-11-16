/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />

interface NameParts extends DateParts {
	time: number;
	index: number;
	padded: string;
}

namespace LibraryUtil {
	export async function ensure(root: string, defaults: any): Promise<void> {
		await NodeUtil.makeDirPromise(root, { recursive: true });
		const settingsPath = NodeUtil.getPath(root, "settings.json");
		await SettingsUtil.ensure(settingsPath, defaults);
		const cataloguePath = NodeUtil.getPath(root, "catalogue.json");
		await SettingsUtil.ensure(cataloguePath, {});
	}

	export async function nextIndex(path: string): Promise<number> {
		const lock = await FileUtil.lock(path);
		try {
			const settings = await FileUtil.readJSONRAW(path) ?? {};
			settings.lastIndex = (settings.lastIndex ?? 0) + 1;
			await FileUtil.writeJSONRAW(path, settings);
			return settings.lastIndex;
		} finally {
			lock.release();
		}
	}

	export async function nextParts(path: string): Promise<NameParts> {
		const time = Date.now();
		const parts = DateUtil.toLocalParts(time);
		const index = await nextIndex(path);
		const padded = index.toString().padStart(5, "0");
		return { time, ...parts, index, padded };
	}

	// A rename keeps the entry's original date and replaces the rest of the name.
	export function buildName(time: number, name: string): string {
		const date = DateUtil.toLocalDate(time ?? Date.now());
		const clean = LibraryUtil.cleanName(name);
		if (clean) {
			return `${date}-${clean}`;
		}
		return date;
	}

	// Drops a stored date, index and excerpt/note kind from a typed name.
	export function cleanName(value: string): string {
		const trimmed = (value ?? "").trim();
		const match = trimmed.match(/^\d{4}-\d{2}-\d{2}[- ]*(?:(?:excerpt|note)-)?(?:\d+(?=[- ]|$)[- ]*)?(.*)$/);
		if (match) {
			return match[1].trim();
		}
		return trimmed;
	}

	export async function readEntries<EntryType>(path: string): Promise<EntryType> {
		const data = await FileUtil.readJSONLocked(path) ?? {};
		return data.entries ?? {};
	}

	export async function setEntry<EntryType>(path: string, name: string, entry: EntryType): Promise<void> {
		const lock = await FileUtil.lock(path);
		try {
			const data = await FileUtil.readJSONRAW(path) ?? {};
			data.entries = data.entries ?? {};
			data.entries[name] = entry;
			await FileUtil.writeJSONRAW(path, data);
		} finally {
			lock.release();
		}
	}

	export async function getEntry<EntryType>(path: string, name: string): Promise<EntryType> {
		const data = await FileUtil.readJSONLocked(path) ?? {};
		const entries = data.entries ?? {};
		return entries[name];
	}

	export async function removeEntry(path: string, name: string): Promise<void> {
		const lock = await FileUtil.lock(path);
		try {
			const data = await FileUtil.readJSONRAW(path) ?? {};
			data.entries = data.entries ?? {};
			delete data.entries[name];
			await FileUtil.writeJSONRAW(path, data);
		} finally {
			lock.release();
		}
	}

	export async function listDirectoryEntries(root: string): Promise<string[]> {
		try {
			return await NodeUtil.readDirPromise(root);
		} catch {
			console.warn(`unable to list directory of ${root}`);
		}
		return [];
	}

	export async function listFoldersWithSettings(root: string): Promise<string[]> {
		const result = [];
		for (const folder of await listDirectoryEntries(root)) {
			const settingsPath = NodeUtil.getPath(root, folder, "settings.json");
			if (await FileUtil.exists(settingsPath)) {
				result.push(folder);
			}
		}
		return result;
	}
}