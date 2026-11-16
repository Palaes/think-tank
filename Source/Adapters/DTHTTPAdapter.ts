/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="./ImageGenAdapter.ts" />

interface DTHImageGenLoRA {
	file: string;
	weight: number;
}

interface DTHImageGenControl {
	file: string;
	weight: number;
	control_importance?: string;
	guidance_start?: number;
	guidance_end?: number;
	input_override?: string;
	target_blocks?: any;
	no_prompt?: boolean;
	down_sampling_rate?: number;
	global_average_pooling?: boolean;
}

interface DTHImageGenParams {
	APIHost?: string;
	inputMode?: ImageInputMode;
	inputImage?: string;
	prompt?: string;
	negative_prompt?: string;
	seed?: number;
	seed_mode?: string;
	batch_count?: number;
	model?: string;
	refiner_model?: string;
	refiner_start?: number;
	loras?: DTHImageGenLoRA[];
	controls?: DTHImageGenControl[];
	sampler?: string;
	steps?: number;
	guidance_scale?: number;
	shift?: number;
	stochastic_sampling_gamma?: number;
	strength?: number;
	width?: number;
	height?: number;
	hires_fix?: boolean;
	hires_fix_width?: number;
	hires_fix_height?: number;
	hires_fix_strength?: number;
	original_width?: number;
	original_height?: number;
	target_width?: number;
	target_height?: number;
	negative_original_width?: number;
	negative_original_height?: number;
	init_images?: string[];
}

namespace DTHTTPAdapter {
	const generationEndpoint = "/sdapi/v1/txt2img";
	const img2imgEndpoint = "/sdapi/v1/img2img";

	export function convertTo(params: ImageGenParams): DTHImageGenParams {
		const result: DTHImageGenParams = {
			APIHost: params.APIHost,
			inputMode: params.inputMode,
			inputImage: params.inputImage,
			prompt: params.positivePrompt,
			negative_prompt: params.negativePrompt,
			batch_count: params.batchCount,
			seed: params.seed,
			seed_mode: params.seedMode,
			model: params.model,
			refiner_model: params.refinerModel,
			refiner_start: params.refinerStart,
			loras: params.loras.filter(lora => lora.file).map(convertLoRATo),
			controls: params.controls.filter(control => control.file).map(convertControlTo),
			sampler: params.sampler,
			steps: params.steps,
			guidance_scale: params.cfg,
			shift: params.shift,
			stochastic_sampling_gamma: params.sss,
			strength: params.strength,
			hires_fix_strength: params.hiResStrength
		};
		if (params.hiRes) {
			result.hires_fix = true;
			result.width = params.hiResWidth;
			result.height = params.hiResHeight;
			result.hires_fix_width = params.width;
			result.hires_fix_height = params.height;
		} else {
			result.hires_fix = false;
			result.width = params.width;
			result.height = params.height;
			result.hires_fix_width = params.hiResWidth;
			result.hires_fix_height = params.hiResHeight;
		}
		result.original_width = params.originalWidth;
		result.original_height = params.originalHeight;
		result.target_width = params.targetWidth;
		result.target_height = params.targetHeight;
		result.negative_original_width = params.negativeWidth;
		result.negative_original_height = params.negativeHeight;
		return result;
	}

	export function convertFrom(data: DTHImageGenParams): ImageGenParams {
		const result: ImageGenParams = {
			APIType: "",
			APIHost: data.APIHost ?? "",
			APITool: "",
			inputMode: data.inputMode ?? "path",
			inputImage: data.inputImage ?? null,
			positivePrompt: data.prompt ?? "",
			negativePrompt: data.negative_prompt ?? "",
			batchCount: data.batch_count,
			seed: data.seed,
			seedMode: data.seed_mode,
			model: data.model,
			refinerModel: data.refiner_model,
			refinerStart: data.refiner_start,
			loras: (data.loras ?? []).filter(lora => lora.file).map(convertLoRAFrom),
			controls: (data.controls ?? []).filter(control => control.file).map(convertControlFrom),
			sampler: data.sampler,
			steps: data.steps,
			cfg: data.guidance_scale,
			shift: data.shift,
			sss: data.stochastic_sampling_gamma,
			strength: data.strength,
			hiResStrength: data.hires_fix_strength,
			customSizeEmbed: data.original_width != null
		};
		if (data.hires_fix) {
			result.hiRes = true;
			result.width = Math.min(data.width, data.hires_fix_width);
			result.height = Math.min(data.height, data.hires_fix_height);
			result.hiResWidth = Math.max(data.width, data.hires_fix_width);
			result.hiResHeight = Math.max(data.height, data.hires_fix_height);
		} else {
			result.hiRes = false;
			result.width = data.width;
			result.height = data.height;
			result.hiResWidth = data.hires_fix_width;
			result.hiResHeight = data.hires_fix_height;
		}
		result.originalWidth = data.original_width;
		result.originalHeight = data.original_height;
		result.targetWidth = data.target_width;
		result.targetHeight = data.target_height;
		result.negativeWidth = data.negative_original_width;
		result.negativeHeight = data.negative_original_height;
		return result;
	}

	export function parse(data: string): DTHImageGenParams {
		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	export async function generate(data: DTHImageGenParams, outputPath: string, signal: AbortSignal): Promise<string> {
		const config = { ...data };
		delete config.APIHost;
		delete config.inputMode;
		delete config.inputImage;
		if (data.inputImage) {
			config.init_images = [ readInputImage(data) ];
			const response = await forward(data.APIHost, img2imgEndpoint, "POST", JSON.stringify(config), signal);
			return response.images[0];
		}
		const response = await forward(data.APIHost, generationEndpoint, "POST", JSON.stringify(config), signal);
		return response.images[0];
	}

	function readInputImage(data: DTHImageGenParams): string {
		if (data.inputMode == "path") {
			const buffer = NodeUtil.readFileSync(data.inputImage);
			return buffer.toString("base64");
		}
		return data.inputImage;
	}

	function convertLoRATo(param: ImageGenLoRA): DTHImageGenLoRA {
		return { file: param.file, weight: param.weight };
	}

	function convertLoRAFrom(param: DTHImageGenLoRA): ImageGenLoRA {
		return { file: param.file, weight: param.weight };
	}

	function convertControlTo(param: ImageGenControl): DTHImageGenControl {
		return {
			file: param.file,
			weight: param.weight,
			control_importance: param.priority ?? "balanced",
			guidance_start: param.start ?? 0,
			guidance_end: param.end ?? 1,
			input_override: param.inputOverride ?? "",
			target_blocks: param.targetBlocks ?? [],
			no_prompt: false,
			down_sampling_rate: 1,
			global_average_pooling: false
		};
	}

	function convertControlFrom(param: DTHImageGenControl): ImageGenControl {
		return {
			file: param.file,
			weight: param.weight,
			priority: param.control_importance,
			start: param.guidance_start,
			end: param.guidance_end,
			inputOverride: param.input_override,
			targetBlocks: param.target_blocks
		};
	}

	async function forward(APIHost: string, endpoint: string, method: string, body?: string, signal?: AbortSignal): Promise<any> {
		const url = `${APIHost}${endpoint}`;
		const response = await fetch(url, {
			method,
			headers: body ? { "Content-Type": "application/json" } : {},
			body,
			signal
		});
		if (response.ok == false) {
			const errorText = await response.text();
			console.error(`Draw Things API error ${response.status}:`, errorText);
			throw new Error(`Draw Things API returned ${response.status}: ${errorText.substring(0, 500)}`);
		}
		const text = await response.text();
		try {
			return JSON.parse(text);
		} catch (error) {
			console.error("Failed to parse response:", text.substring(0, 500));
			throw error;
		}
	}
}