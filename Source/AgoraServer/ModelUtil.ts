/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />

interface ModelParams {
	APIType: string;
	APIHost: string;
	APIKey: string;
	model: string;
	chat?: boolean;
	vision?: boolean;
	decision?: boolean;
	speech?: boolean;
	voices?: string[];
	tweak?: string;
	think?: ThinkMode;
	temp?: number;
	topP?: number;
	topK?: number;
	numCtx?: number;
	numKeep?: number;
	numPredict?: number;
}

interface ModelSettings extends ModelParams {
	display?: string;
	variants?: Dict<Partial<ModelParams>>;
}

interface ModelMeta {
	name: string;
	group: string;
	display: string;
}

namespace ModelUtil {
	export const modelsPath = SettingsUtil.getLocation("/ThinkTank/Agora/models.json");

	const defaultModel: ModelParams = {
		APIType: "ollama",
		APIHost: "http://localhost:11434/api/chat",
		APIKey: "",
		model: "",
		chat: true,
		vision: true,
		decision: false,
		speech: false,
		think: false,
		temp: 0.35,
		topP: 0.85,
		topK: 35,
		numCtx: 32768,
		numKeep: 8192,
		numPredict: 8192
	};

	export async function initialize(): Promise<void> {
		const lock = await FileUtil.lock(modelsPath);
		try {
			if (await FileUtil.readJSONRAW(modelsPath) == null) {
				await FileUtil.writeJSONRAW(modelsPath, { models: { default: defaultModel }});
			}
		} finally {
			lock.release();
		}
	}

	export async function readModels(): Promise<Dict<ModelParams>> {
		const models = await readRawModels();
		const result = {};
		for (const name in models) {
			const settings = models[name];
			const params = toParams(settings);
			const variants = settings.variants;
			if (variants == null) {
				result[name] = params;
				continue;
			}
			for (const variantName in variants) {
				result[`${name} ${variantName}`] = { ...params, ...variants[variantName] };
			}
		}
		return result;
	}

	export async function getModelNames(): Promise<string[]> {
		const models = await readRawModels();
		return Object.keys(models);
	}

	export async function getModelOptions(): Promise<ModelMeta[]> {
		const models = await readRawModels();
		const result = [];
		for (const name in models) {
			if (name == "default") {
				continue;
			}
			const settings = models[name];
			const split = splitDisplay(settings.display ?? name);
			const variants = settings.variants;
			if (variants == null) {
				addModelOption(result, name, split, toParams(settings), null);
				continue;
			}
			for (const variantName in variants) {
				const params = { ...toParams(settings), ...variants[variantName] };
				addModelOption(result, `${name} ${variantName}`, split, params, variantName);
			}
		}
		return result;
	}

	export function resolve(params: CombinedParams, modelName: string): ModelParams {
		return sanitizeModel({ ...defaultModel, ...params.models.default, ...params.models[modelName], ...params.generate });
	}

	export function sanitizeModel(model: any): ModelParams {
		if (model.speech == false) {
			delete model.voices;
		}
		for (const key of Object.keys(model)) {
			if (model[key] == null) {
				delete model[key];
			}
		}
		return model;
	}

	// support codes for settings UI

	export async function readModel(name: string): Promise<ModelSettings> {
		const models = await readRawModels();
		return models[name];
	}

	export async function writeModel(name: string, model: ModelSettings): Promise<ModelSettings> {
		await editModels(models => models[name] = model);
		return model;
	}

	export async function createModel(name: string): Promise<string> {
		await editModels(models => models[name] = { ...defaultModel, display: name, chat: true });
		return name;
	}

	export async function renameModel(oldName: string, newName: string): Promise<string> {
		await editModels(models => {
			models[newName] = models[oldName];
			delete models[oldName];
		});
		return newName;
	}

	export async function removeModel(name: string): Promise<string> {
		await editModels(models => {
			delete models[name];
		});
		return name;
	}

	async function readRawModels(): Promise<Dict<ModelSettings>> {
		const file = await FileUtil.readJSONRAW(modelsPath) ?? {};
		return file.models ?? {};
	}

	function toParams(settings: ModelSettings): ModelParams {
		const { display, variants, ...params } = settings;
		return params;
	}

	function splitDisplay(display: string): { group: string, label: string } {
		for (const separator of [ "–", "/" ]) {
			const index = display.indexOf(separator);
			if (index >= 0) {
				return {
					group: display.slice(0, index).trim(),
					label: display.slice(index + separator.length).trim()
				};
			}
		}
		return { group: "", label: display.trim() };
	}

	function addModelOption(result: ModelMeta[], name: string, split: { group: string, label: string }, params: ModelParams, variantName: string): void {
		if (params.chat == false) {
			return;
		}
		result.push({
			name,
			group: split.group,
			display: variantName ? `${split.label} ${variantName}` : split.label
		});
	}

	async function editModels(change: (models: Dict<ModelSettings>) => void): Promise<void> {
		const lock = await FileUtil.lock(modelsPath);
		try {
			const file = await FileUtil.readJSONRAW(modelsPath) ?? {};
			file.models = file.models ?? {};
			change(file.models);
			await FileUtil.writeJSONRAW(modelsPath, file);
		} finally {
			lock.release();
		}
	}
}
