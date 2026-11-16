/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="./ImageGenAdapter.ts" />

interface DTSImageGenLoRA {
	file: string;
	weight: number;
}

interface DTSImageGenControl {
	file: string;
	weight: number;
	controlImportance: string;
	guidanceStart: number;
	guidanceEnd: number;
	noPrompt: boolean;
	downSamplingRate: number;
	globalAveragePooling: boolean;
	inputOverride: string;
	targetBlocks: any;
}

interface DTSImageGenParams {
	APITool?: string;
	modelsFolder?: string;
	inputMode?: ImageInputMode;
	inputImage?: string;
	prompt?: string;
	negativePrompt?: string;
	seed?: number;
	seedMode?: number;
	batchCount?: number;
	model?: string;
	refinerModel?: string;
	refinerStart?: number;
	loras?: DTSImageGenLoRA[];
	controls?: DTSImageGenControl[];
	sampler?: number;
	steps?: number;
	guidanceScale?: number;
	shift?: number;
	stochasticSamplingGamma?: number;
	strength?: number;
	width?: number;
	height?: number;
	hiresFix?: boolean;
	hiresFixWidth?: number;
	hiresFixHeight?: number;
	hiresFixStrength?: number;
	originalImageWidth?: number;
	originalImageHeight?: number;
	targetImageWidth?: number;
	targetImageHeight?: number;
	negativeOriginalImageWidth?: number;
	negativeOriginalImageHeight?: number;
}

namespace DTCLIAdapter {
	const samplerNames = [
		"DPM++ 2M Karras",
		"Euler a",
		"DDIM",
		"UniPC",
		"DPM++ SDE Karras",
		"PLMS",
		"LCM",
		"Euler A Substep",
		"DPM++ SDE Substep",
		"TCD",
		"Euler A Trailing",
		"DPM++ SDE Trailing",
		"DPM++ 2M AYS",
		"Euler A AYS",
		"DPM++ SDE AYS",
		"DPM++ 2M Trailing",
		"DDIM Trailing",
		"UniPC Trailing",
		"UniPC AYS",
		"TCD Trailing"
	];

	const seedModeNames = [
		"Legacy",
		"Torch",
		"Scale Alike"
	];

	export function convertTo(params: ImageGenParams): DTSImageGenParams {
		const sampler = samplerNames.indexOf(params.sampler);
		const seedMode = seedModeNames.indexOf(params.seedMode);
		const result: DTSImageGenParams = {
			APITool: params.APITool,
			modelsFolder: params.modelsFolder,
			inputMode: params.inputMode,
			inputImage: params.inputImage,
			prompt: params.positivePrompt,
			negativePrompt: params.negativePrompt,
			seed: params.seed,
			seedMode,
			batchCount: params.batchCount,
			model: params.model,
			refinerModel: params.refinerModel,
			refinerStart: params.refinerStart,
			loras: params.loras.filter(lora => lora.file).map(convertLoRATo),
			controls: params.controls.filter(control => control.file).map(convertControlTo),
			sampler,
			steps: params.steps,
			guidanceScale: params.cfg,
			shift: params.shift,
			stochasticSamplingGamma: params.sss,
			strength: params.strength,
			hiresFixStrength: params.hiResStrength
		};
		if (params.hiRes) {
			result.hiresFix = true;
			result.width = params.hiResWidth;
			result.height = params.hiResHeight;
			result.hiresFixWidth = params.width;
			result.hiresFixHeight = params.height;
		} else {
			result.hiresFix = false;
			result.width = params.width;
			result.height = params.height;
			result.hiresFixWidth = params.hiResWidth;
			result.hiresFixHeight = params.hiResHeight;
		}
		result.originalImageWidth = params.originalWidth;
		result.originalImageHeight = params.originalHeight;
		result.targetImageWidth = params.targetWidth;
		result.targetImageHeight = params.targetHeight;
		result.negativeOriginalImageWidth = params.negativeWidth;
		result.negativeOriginalImageHeight = params.negativeHeight;
		return result;
	}

	export function convertFrom(data: DTSImageGenParams): ImageGenParams {
		const result: ImageGenParams = {
			APIType: "",
			APIHost: "",
			APITool: data.APITool ?? "",
			modelsFolder: data.modelsFolder ?? null,
			inputMode: data.inputMode ?? "path",
			inputImage: data.inputImage ?? null,
			positivePrompt: data.prompt ?? "",
			negativePrompt: data.negativePrompt ?? "",
			batchCount: data.batchCount,
			seed: data.seed,
			seedMode: seedModeNames[data.seedMode],
			model: data.model,
			refinerModel: data.refinerModel,
			refinerStart: data.refinerStart,
			loras: (data.loras ?? []).filter(lora => lora.file).map(convertLoRAFrom),
			controls: (data.controls ?? []).filter(control => control.file).map(convertControlFrom),
			sampler: samplerNames[data.sampler],
			steps: data.steps,
			cfg: data.guidanceScale,
			shift: data.shift,
			sss: data.stochasticSamplingGamma,
			strength: data.strength,
			hiResStrength: data.hiresFixStrength,
			customSizeEmbed: data.originalImageWidth != null
		};
		if (data.hiresFix) {
			result.hiRes = true;
			result.width = Math.min(data.width, data.hiresFixWidth);
			result.height = Math.min(data.height, data.hiresFixHeight);
			result.hiResWidth = Math.max(data.width, data.hiresFixWidth);
			result.hiResHeight = Math.max(data.height, data.hiresFixHeight);
		} else {
			result.hiRes = false;
			result.width = data.width;
			result.height = data.height;
			result.hiResWidth = data.hiresFixWidth;
			result.hiResHeight = data.hiresFixHeight;
		}
		result.originalWidth = data.originalImageWidth;
		result.originalHeight = data.originalImageHeight;
		result.targetWidth = data.targetImageWidth;
		result.targetHeight = data.targetImageHeight;
		result.negativeWidth = data.negativeOriginalImageWidth;
		result.negativeHeight = data.negativeOriginalImageHeight;
		return result;
	}

	export function parse(data: string): DTSImageGenParams {
		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	export async function generate(data: DTSImageGenParams, outputPath: string, signal: AbortSignal, onProgress?: ProgressHandler): Promise<string> {
		const tool = data.APITool ?? "draw-things-cli";
		const config = { ...data };
		delete config.APITool;
		delete config.modelsFolder;
		delete config.inputMode;
		delete config.inputImage;
		delete config.prompt;
		delete config.negativePrompt;
		const configJson = JSON.stringify(config);
		const args = [
			"generate",
			"--config-json", configJson,
			"-p", data.prompt ?? "",
			"--output", outputPath,
			"--model", data.model ?? "",
			"--models-dir", data.modelsFolder ?? ""
		];
		let inputPath: string = null;
		if (data.inputImage) {
			if (data.inputMode == "path") {
				inputPath = data.inputImage;
			} else {
				inputPath = `${outputPath}.input.png`;
				await NodeUtil.writeFilePromise(inputPath, Buffer.from(data.inputImage, "base64"));
			}
			args.push("--image", inputPath);
		}
		if (data.negativePrompt) {
			args.push("--negative-prompt", data.negativePrompt);
		}
		try {
			return await spawn(tool, args, outputPath, signal, onProgress);
		} finally {
			if (inputPath && data.inputMode == "raw") {
				try {
					await NodeUtil.removePromise(inputPath);
				} catch {
					// the temporary input may already be gone
				}
			}
		}
	}

	function spawn(tool: string, args: string[], outputPath: string, signal?: AbortSignal, onProgress?: ProgressHandler): Promise<string> {
		const child = NodeUtil.process.spawn(tool, args);
		return new Promise((resolve, reject) => {
			let stderr = "";
			let progressText = "";
			const collectProgress = (text: string) => {
				if (!onProgress) {
					return;
				}
				progressText += text;
				if (progressText.length > 4096) {
					progressText = progressText.slice(-4096);
				}
				const percentage = parseProgress(progressText);
				if (percentage != null) {
					onProgress(percentage);
				}
			};
			const abortCallback = () => child.kill();
			if (signal) {
				signal.addEventListener("abort", abortCallback);
			}
			child.stdout.on("data", data => {
				const str = data.toString();
				process.stdout.write(str);
				collectProgress(str);
			});
			child.stderr.on("data", data => {
				const str = data.toString();
				stderr += str;
				process.stderr.write(str);
				collectProgress(str);
			});
			child.on("close", code => {
				if (signal) {
					signal.removeEventListener("abort", abortCallback);
				}
				if (signal && signal.aborted) {
					reject(new Error("Generation aborted"));
				} else if (code != 0) {
					console.error(`draw-things-cli failed with code ${code}`);
					reject(new Error(`draw-things-cli failed: ${stderr}`));
				} else {
					try {
						if (NodeUtil.fs.existsSync(outputPath) == false) {
							reject(new Error(`Output file not found: ${outputPath}`));
							return;
						}
						resolve(NodeUtil.readFileSync(outputPath).toString("base64"));
					} catch (error) {
						reject(new Error(`Failed to read output image: ${error}`));
					}
				}
			});
			child.on("error", error => {
				if (signal) {
					signal.removeEventListener("abort", abortCallback);
				}
				console.error("Failed to spawn draw-things-cli:", error);
				reject(error);
			});
		});
	}

	// The last percentage or step fraction in the recent output, as 0 to 100.
	function parseProgress(text: string): number {
		let percentage: number = null;
		let match: RegExpExecArray;
		const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
		while (match = percentPattern.exec(text)) {
			percentage = parseFloat(match[1]);
		}
		if (percentage == null) {
			const stepPattern = /(\d+)\s*\/\s*(\d+)/g;
			while (match = stepPattern.exec(text)) {
				const value = parseInt(match[1]);
				const total = parseInt(match[2]);
				if (total && value <= total) {
					percentage = value / total * 100;
				}
			}
		}
		if (percentage == null) {
			return null;
		}
		return Math.max(0, Math.min(100, percentage));
	}

	function convertLoRATo(param: ImageGenLoRA): DTSImageGenLoRA {
		return { file: param.file, weight: param.weight };
	}

	function convertLoRAFrom(param: DTSImageGenLoRA): ImageGenLoRA {
		return { file: param.file, weight: param.weight };
	}

	function convertControlTo(param: ImageGenControl): DTSImageGenControl {
		return {
			file: param.file,
			weight: param.weight,
			controlImportance: param.priority ?? "balanced",
			guidanceStart: param.start ?? 0,
			guidanceEnd: param.end ?? 1,
			noPrompt: false,
			downSamplingRate: 1,
			globalAveragePooling: false,
			inputOverride: param.inputOverride ?? "",
			targetBlocks: param.targetBlocks ?? []
		};
	}

	function convertControlFrom(param: DTSImageGenControl): ImageGenControl {
		return {
			file: param.file,
			weight: param.weight,
			priority: param.controlImportance,
			start: param.guidanceStart,
			end: param.guidanceEnd,
			inputOverride: param.inputOverride,
			targetBlocks: param.targetBlocks
		};
	}
}