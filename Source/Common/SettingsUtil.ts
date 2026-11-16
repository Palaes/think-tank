/// <reference path="./NodeUtil.ts" />
/// <reference path="./FileUtil.ts" />

namespace SettingsUtil {
	export const homePath = NodeUtil.os.homedir();

	const configDir = NodeUtil.getPath(homePath, ".config", "think-tank");
	const configPath = NodeUtil.getPath(configDir, "locations.json");

	export function getLocation(local: string): string {
		// TODO: Initialize data with most important paths if missing.
		const locations = FileUtil.readJSONSync(configPath) ?? {};
		return resolveLocation(locations, local);
	}

	function resolveLocation(locations: any, local: string): string {
		const headParts = local.split(/(\/)/);
		const tailParts = [];
		while (true) {
			const headString = headParts.join("");
			const tailString = tailParts.join("");
			if (headString) {
				if (headString in locations) {
					return `${locations[headString]}${tailString}`;
				} else {
					tailParts.unshift(headParts.pop());
				}
			} else {
				return NodeUtil.getPath(homePath, tailString);
			}
		}
	}

	export async function ensure<Type>(path: string, defaults: Type): Promise<Type> {
		const lock = await FileUtil.lock(path);
		try {
			const settings = await FileUtil.readJSONRAW(path);
			if (settings == null) {
				await FileUtil.writeJSONRAW(path, defaults);
			}
			return mergeAll(defaults, settings);
		} finally {
			lock.release();
		}
	}

	export async function read<Type>(path: string, defaults: Type): Promise<Type> {
		return mergeAll(defaults, await FileUtil.readJSONLocked(path));
	}

	// null override deletes that key and every other key merges in
	export async function edit<Type>(path: string, overrides: Partial<Type>, defaults: Type): Promise<Type> {
		const lock = await FileUtil.lock(path);
		try {
			const settings = await FileUtil.readJSONRAW(path) ?? {};
			const merged = mergeTwo(settings, pruneNulls(settings, overrides));
			await FileUtil.writeJSONRAW(path, merged);
			return mergeAll(defaults, merged);
		} finally {
			lock.release();
		}
	}

	// removes null-valued keys from the target and returns the patch without them
	function pruneNulls(target: any, overrides: any): any {
		const result: any = {};
		for (const key in overrides) {
			const value = overrides[key];
			if (value == null) {
				if (isObject(target)) {
					delete target[key];
				}
			} else if (isObject(value)) {
				const child = isObject(target) ? target[key] : null;
				result[key] = pruneNulls(isObject(child) ? child : null, value);
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	function isObject(value: any): boolean {
		if (value == null) {
			return false;
		}
		if (Array.isArray(value)) {
			return false;
		}
		return typeof value == "object";
	}


	// merges settings layers deeply, skipping absent layers
	export function mergeAll(...layers: any[]): any {
		let result: any;
		for (const layer of layers) {
			if (layer == null) {
				continue;
			}
			result = mergeTwo(result, layer);
		}
		return result;
	}

	// both plain objects merge per key, anything else replaces
	export function mergeTwo(a: any, b: any): any {
		if (bothPO(a, b)) {
			const result = { ...a };
			for (const key in b) {
				result[key] = mergeTwo(a[key], b[key]);
			}
			return result;
		}
		return b;
	}

	// a plain object of fields, as opposed to an array or a scalar
	function bothPO(a: any, b: any): boolean {
		// TODO: Is this really needed?
		if (a == null) {
			return false;
		}
		if (typeof a == "object") {
			if (typeof b == "object") {
				if (Array.isArray(a)) {
					return false;
				}
				if (Array.isArray(b)) {
					return false;
				}
				return true;
			}
		}
		return false;
	}
}