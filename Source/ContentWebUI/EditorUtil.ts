namespace EditorUtil {
	// structured values turn into editable text and back
	export function textify(value: any): string {
		return JSON.stringify(value, null, "\t");
	}

	export function parseText(text: string): any {
		return JSON.parse(text);
	}

	// keeps only the keys whose values agree across every selected item
	export function intersect(values: any[]): any {
		let result = values[0] ?? {};
		for (let i = 1; i < values.length; ++i) {
			result = intersectTwo(result, values[i]);
		}
		return result;
	}

	function intersectTwo(a: any, b: any): any {
		const result: any = {};
		for (const key in a) {
			if (key in b) {
				const childA = a[key];
				const childB = b[key];
				if (isObject(childA) && isObject(childB)) {
					result[key] = intersectTwo(childA, childB);
				} else if (JSON.stringify(childA) == JSON.stringify(childB)) {
					result[key] = childA;
				}
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
}
