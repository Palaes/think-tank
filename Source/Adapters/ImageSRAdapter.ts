interface ImageSRParams {
	APIType: string;
	APIHost: string;
	APITool: string;
	modelsPath: string;
	model?: string;
}

interface ImageSRAdapter {
	listModels(params: ImageSRParams): Promise<string[]>;
	upscale(params: ImageSRParams, inputPath: string, outputPath: string): Promise<string>;
}