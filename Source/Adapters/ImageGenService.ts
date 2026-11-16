/// <reference path="./ImageGenAdapter.ts" />
/// <reference path="./DTHTTPAdapter.ts" />
/// <reference path="./DTCLIAdapter.ts" />

namespace ImageGenService {
	const adapters = {
		"default": DTCLIAdapter,
		"dtcli": DTCLIAdapter,
		"cli": DTCLIAdapter,
		"dthttp": DTHTTPAdapter,
		"http": DTHTTPAdapter
	};

	export const defaults: ImageGenParams = {
		APIType: "default",
		APIHost: null,
		APITool: "draw-things-cli",
		modelsFolder: null,
		inputMode: "path",
		inputImage: null,
		positivePrompt: "",
		negativePrompt: "",
		batchCount: 1,
		seed: 0,
		seedMode: "Scale Alike",
		refinerStart: 0.5,
		loras: [],
		controls: [],
		sampler: "DPM++ 2M Karras",
		steps: 20,
		cfg: 5,
		shift: 1,
		sss: 0.3,
		strength: 0.5,
		width: 768,
		height: 512,
		hiRes: false,
		hiResWidth: 1152,
		hiResHeight: 768,
		hiResStrength: 0.5,
		customSizeEmbed: false,
		originalWidth: 768,
		originalHeight: 512,
		targetWidth: 768,
		targetHeight: 512,
		negativeWidth: 768,
		negativeHeight: 512
	};

	export function normalize(params: ImageGenParams): ImageGenParams {
		const result: ImageGenParams = { ...defaults, ...params };
		result.hiResWidth = params.hiResWidth ?? result.width;
		result.hiResHeight = params.hiResHeight ?? result.height;
		result.originalWidth = params.originalWidth ?? result.width;
		result.originalHeight = params.originalHeight ?? result.height;
		result.targetWidth = params.targetWidth ?? result.width;
		result.targetHeight = params.targetHeight ?? result.height;
		result.negativeWidth = params.negativeWidth ?? result.width;
		result.negativeHeight = params.negativeHeight ?? result.height;
		if (result.hiRes) {
			const width = Math.min(result.width, result.hiResWidth);
			const height = Math.min(result.height, result.hiResHeight);
			result.hiResWidth = Math.max(result.width, result.hiResWidth);
			result.hiResHeight = Math.max(result.height, result.hiResHeight);
			result.width = width;
			result.height = height;
		}
		return result;
	}

	export async function generate(params: ImageGenParams, outputPath: string, signal?: AbortSignal, onProgress?: ProgressHandler): Promise<string> {
		const adapter = adapters[params.APIType] ?? adapters["default"];
		const converted = adapter.convertTo(normalize(params));
		return adapter.generate(converted, outputPath, signal, onProgress);
	}

	export function parse(APIType: string, data: string): ImageGenParams {
		const adapter = adapters[APIType] ?? adapters["default"];
		return adapter.convertFrom(adapter.parse(data));
	}
}