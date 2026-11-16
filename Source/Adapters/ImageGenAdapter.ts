interface ImageGenLoRA {
	file: string;
	weight: number;
}

interface ImageGenControl {
	file: string;
	weight: number;
	priority?: string;
	start?: number;
	end?: number;
	inputOverride?: string;
	targetBlocks?: any;
}

type ImageInputMode = "path" | "raw";

type ProgressHandler = (percentage: number) => void;

interface ImageGenParams {
	APIType: string;
	APIHost: string;
	APITool: string;
	modelsFolder?: string;
	inputMode?: ImageInputMode;
	inputImage?: string;
	positivePrompt?: string;
	negativePrompt?: string;
	batchCount?: number;
	seed?: number;
	seedMode?: string;
	model?: string;
	refinerModel?: string;
	refinerStart?: number;
	loras?: ImageGenLoRA[];
	controls?: ImageGenControl[];
	sampler?: string;
	steps?: number;
	cfg?: number;
	shift?: number;
	sss?: number;
	strength?: number;
	width?: number;
	height?: number;
	hiRes?: boolean;
	hiResWidth?: number;
	hiResHeight?: number;
	hiResStrength?: number;
	customSizeEmbed?: boolean;
	originalWidth?: number;
	originalHeight?: number;
	targetWidth?: number;
	targetHeight?: number;
	negativeWidth?: number;
	negativeHeight?: number;
}

interface ImageGenAdapter {
	convertTo(params: ImageGenParams): any;
	convertFrom(data: any): ImageGenParams;
	parse(data: string): any;
	generate(data: any, outputPath: string, signal: AbortSignal, onProgress?: ProgressHandler): Promise<string>;
}