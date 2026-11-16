/// <reference path="./NodeUtil.ts" />
/// <reference path="./Globals.ts" />

class MLock {
	public release = () => {};

	public promise = new Promise<void>(resolve => this.release = resolve);
}

namespace Mutex {
	const locks = {};

	export async function lock(key: string): Promise<MLock> {
		const prev = locks[key];
		const lock = new MLock();
		locks[key] = lock;
		if (prev) {
			await prev.promise;
		}
		return lock;
	}
}

namespace FileUtil {
	export async function exists(path: string): Promise<boolean> {
		try {
			await NodeUtil.accessPromise(path);
			return true;
		} catch {
			return false;
		}
	}

	export async function lock(path: string): Promise<MLock> {
		return Mutex.lock(path);
	}

	export function readTextSync(path: string): string {
		try {
			return NodeUtil.readFileSync(path, ENCODING);
		} catch {
			console.warn(`unable to read ${path}`);
		}
		return null;
	}

	export function readJSONSync(path: string): any {
		return parseJSON(path, readTextSync(path));
	}

	export function writeTextSync(path: string, content: string): void {
		try {
			NodeUtil.writeFileSync(path, content, ENCODING);
		} catch {
			console.error(`unable to write ${path}`);
		}
	}

	export function writeJSONSync(path: string, data: any): void {
		writeTextSync(path, JSON.stringify(data, null, "\t"));
	}

	export async function readTextRAW(path: string): Promise<string> {
		try {
			return await NodeUtil.readFilePromise(path, ENCODING);
		} catch {
			console.warn(`unable to read ${path}`);
		}
		return null;
	}

	export async function readJSONRAW(path: string): Promise<any> {
		return parseJSON(path, await readTextRAW(path));
	}

	export async function writeTextRAW(path: string, content: string): Promise<void> {
		try {
			await NodeUtil.writeFilePromise(path, content, ENCODING);
		} catch {
			console.error(`unable to write ${path}`);
		}
	}

	export async function writeJSONRAW(path: string, data: any): Promise<void> {
		await writeTextRAW(path, JSON.stringify(data, null, "\t"));
	}

	export async function readTextLocked(path: string): Promise<string> {
		const lock = await FileUtil.lock(path);
		const result = await readTextRAW(path);
		lock.release();
		return result;
	}

	export async function readJSONLocked(path: string): Promise<any> {
		return parseJSON(path, await readTextLocked(path));
	}

	export async function writeTextLocked(path: string, content: string): Promise<void> {
		const lock = await FileUtil.lock(path);
		await writeTextRAW(path, content);
		lock.release();
	}

	export async function writeJSONLocked(path: string, data: any): Promise<void> {
		await writeTextLocked(path, JSON.stringify(data, null, "\t"));
	}

	function parseJSON(path: string, content: string): any {
		if (content) {
			try {
				return JSON.parse(content);
			} catch {
				console.error(`unable to parse ${path}`);
			}
		}
		return null;
	}
}