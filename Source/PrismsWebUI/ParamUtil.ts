/// <reference path="../PrismsLibrary/DTGenParam.ts" />

namespace ParamUtil {
	function toDTHLoRA(param: LoRAParam): DTHLoRAParam {
		if (param.file) {
			return {
				file: param.file,
				weight: param.weight
			};
		}
		return null;
	}

	function toDTHControl(param: ControlParam): DTHControlParam {
		if (param.file) {
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
		return null;
	}

	export function toDTHGen(param: GenParam): DTHGenParam {
		const result = { ...defaultDTHGenParam };

		result.model = param.model;
		result.refiner_model = param.refinerModel;
		result.refiner_start = param.refinerStart;

		if (param.loras) {
			result.loras = param.loras.map(toDTHLoRA).filter(Boolean);
		}

		if (param.controls) {
			result.controls = param.controls.map(toDTHControl).filter(Boolean);
		}

		result.sampler = param.sampler;
		result.steps = param.steps;
		result.guidance_scale = param.CFG;
		result.shift = param.shift;
		result.stochastic_sampling_gamma = param.SSS;
		result.strength = param.strength;
		result.seed = param.seed;
		result.width = param.width;
		result.height = param.height;

		if (param.hiRes) {
			result.hires_fix = true;
			result.width = Math.max(param.width, param.hiResWidth);
			result.height = Math.max(param.height, param.hiResHeight);
			result.hires_fix_width = Math.min(param.width, param.hiResWidth);
			result.hires_fix_height = Math.min(param.height, param.hiResHeight);
		} else {
			result.hires_fix = false;
			result.width = param.width;
			result.height = param.height;
			result.hires_fix_width = param.hiResWidth;
			result.hires_fix_height = param.hiResHeight;
		}

		result.hires_fix_strength = param.hiResStrength;

		if (param.customSizeEmbed) {
			result.custom_size_embed = true;
			result.original_width = param.originalWidth;
			result.original_height = param.originalHeight;
			result.target_width = param.targetWidth;
			result.target_height = param.targetHeight;
			result.negative_original_width = param.negativeWidth;
			result.negative_original_height = param.negativeHeight;
		} else {
			result.custom_size_embed = false;
			// TODO: Is this the right choice?
			result.original_width = param.width;
			result.original_height = param.height;
			result.target_width = param.width;
			result.target_height = param.height;
			result.negative_original_width = param.width;
			result.negative_original_height = param.height;
		}

		result.prompt = param.positivePrompt;
		result.negative_prompt = param.negativePrompt;
		result.batch_count = param.batchCount;

		return result;
	}

	function fromDTHLoRA(param: DTHLoRAParam): LoRAParam {
		if (param.file) {
			return {
				file: param.file,
				weight: param.weight
			};
		}
		return null;
	}

	function fromDTHControl(param: DTHControlParam): ControlParam {
		if (param.file) {
			return {
				file: param.file,
				weight: param.weight,
				priority: param.control_importance,
				start: param.guidance_start,
				end: param.guidance_end
			}
		}
		return null;
	}

	export function fromDTHGen(param: DTHGenParam): GenParam {
		const result = { ...defaultGenParam };

		result.model = param.model;
		result.refinerModel = param.refiner_model;
		result.refinerStart = param.refiner_start;

		if (param.loras) {
			result.loras = param.loras.map(fromDTHLoRA).filter(Boolean);
		}

		for (let i = 0; i < 3; ++i) {
			result.loras[i] = result.loras[i] || { file: null, weight: 0 }
		}

		if (param.controls) {
			result.controls = param.controls.map(fromDTHControl).filter(Boolean);
		}

		for (let i = 0; i < 3; ++i) {
			result.controls[i] = result.controls[i] || { file: null, weight: 0 }
		}

		result.sampler = param.sampler;
		result.steps = param.steps;
		result.CFG = param.guidance_scale;
		result.shift = param.shift;
		result.SSS = param.stochastic_sampling_gamma;
		result.strength = param.strength;
		result.seed = param.seed;

		if (param.hires_fix) {
			result.hiRes = true;
			result.width = Math.min(param.width, param.hires_fix_width);
			result.height = Math.min(param.height, param.hires_fix_height);
			result.hiResWidth = Math.max(param.width, param.hires_fix_width);
			result.hiResHeight = Math.max(param.height, param.hires_fix_height);
		} else {
			result.hiRes = false;
			result.width = param.width;
			result.height = param.height;
			result.hiResWidth = param.hires_fix_width;
			result.hiResHeight = param.hires_fix_height;
		}

		result.hiResStrength = param.hires_fix_strength;
		result.customSizeEmbed = param.custom_size_embed ?? false;
		result.originalWidth = param.original_width;
		result.originalHeight = param.original_height;
		result.targetWidth = param.target_width;
		result.targetHeight = param.target_height;
		result.negativeWidth = param.negative_original_width;
		result.negativeHeight = param.negative_original_height;

		result.positivePrompt = param.prompt ?? "";
		result.negativePrompt = param.negative_prompt ?? "";
		// result.batchCount = param.batch_count;

		return result;
	}

	function duplicateLoRA(param: LoRAParam): LoRAParam {
		return { ...param };
	}

	function duplicateControl(param: ControlParam): ControlParam {
		return { ...param };
	}

	export function duplicateSDGen(param: GenParam): GenParam {
		const result = { ...param };

		if (param.loras) {
			result.loras = param.loras.map(duplicateLoRA);
		}

		if (param.controls) {
			result.controls = param.controls.map(duplicateControl);
		}

		return result;
	}

	export function overrideGen(target: GenParam, source: GenParam): void {
		for (const key in source) {
			target[key] = source[key];
		}

		if (source.loras) {
			target.loras = source.loras.map(duplicateLoRA);
		}

		if (source.controls) {
			target.controls = source.controls.map(duplicateControl);
		}
	}
}