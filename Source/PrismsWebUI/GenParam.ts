interface LoRAParam {
	file: string;
	weight: number;
}

interface ControlParam {
	file: string;
	weight: number;
	priority?: string;
	start?: number;
	end?: number;
	inputOverride?: string;
	targetBlocks?: any[];
}

interface GenParam {
	// generation
	combinedPrompt?: string;
	positivePrompt?: string;
	negativePrompt?: string;
	batchCount?: number;
	seed?: number;
	// models
	model?: string;
	refinerModel?: string;
	refinerStart?: number;
	loras?: LoRAParam[];
	controls?: ControlParam[];
	// sampling
	sampler?: string;
	steps?: number;
	CFG?: number;
	shift?: number;
	SSS?: number;
	strength?: number;
	// source
	sourceImage?: string;
	// job
	type?: string;
	upscaleModel?: string;
	// resolution
	width?: number;
	height?: number;
	hiRes?: boolean;
	hiResWidth: number;
	hiResHeight: number;
	hiResStrength: number;
	// size embed
	customSizeEmbed?: boolean;
	originalWidth?: number;
	originalHeight?: number;
	targetWidth?: number;
	targetHeight?: number;
	negativeWidth?: number;
	negativeHeight?: number;
}

const defaultGenParam: GenParam = {
	// generation
	// combinedPrompt: "",
	positivePrompt: "",
	negativePrompt: "",
	batchCount: 1,
	// seed: 0,
	// models
	// model: null,
	refinerModel: null,
	refinerStart: 0.5,
	loras: [],
	controls: [],
	// sampling
	sampler: "DPM++ 2M Karras",
	steps: 20,
	CFG: 5,
	shift: 1,
	SSS: 0.3,
	strength: 0.5,
	// resolution
	width: 768,
	height: 512,
	hiRes: false,
	hiResWidth: 1152,
	hiResHeight: 768,
	hiResStrength: 0.5,
	// size mebed
	customSizeEmbed: false,
	originalWidth: 768,
	originalHeight: 512,
	targetWidth: 768,
	targetHeight: 512,
	negativeWidth: 768,
	negativeHeight: 512
};