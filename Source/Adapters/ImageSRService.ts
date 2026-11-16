/// <reference path="./ImageSRAdapter.ts" />
/// <reference path="./RESRGANAdapter.ts" />

namespace ImageSRService {
	const adapters = {
		"default": RESRGANAdapter,
		"resrgan": RESRGANAdapter,
		"local": RESRGANAdapter
	};

	export const defaults: ImageSRParams = {
		APIType: "default",
		APIHost: null,
		APITool: "realesrgan-ncnn-vulkan",
		modelsPath: null,
		model: null
	};

	export function normalize(params: ImageSRParams): ImageSRParams {
		return { ...defaults, ...params };
	}

	export async function listModels(params: ImageSRParams): Promise<string[]> {
		const normalized = normalize(params);
		const adapter = adapters[normalized.APIType] ?? adapters["default"];
		return adapter.listModels(normalized);
	}

	export async function upscale(params: ImageSRParams, inputPath: string, outputPath: string): Promise<string> {
		const normalized = normalize(params);
		const adapter = adapters[normalized.APIType] ?? adapters["default"];
		return adapter.upscale(normalized, inputPath, outputPath);
	}
}