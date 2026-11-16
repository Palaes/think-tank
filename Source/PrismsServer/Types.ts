// Types for Prisms server

interface TaskData {
	[key: string]: any;
}

interface LoRA {
	file?: string;
	weight?: number;
}

interface Control {
	file?: string;
	weight?: number;
	priority?: string;
	start?: number;
	end?: number;
}

type ServerJobStatus = "pending" | "ongoing" | "done" | "error";

interface ServerGenData {
	ID: number;
	status: ServerJobStatus;
	imageName?: string;
	taskData: TaskData;
	startedDate?: number;
	genTime?: number;
}

interface GenJob {
	project: string;
	ID: number;
	taskData: TaskData;
}

interface TaskSource {
	path: string;
	positivePrompt: string;
	negativePrompt: string;
	width: number;
	height: number;
}

interface TaskState {
	ID: number;
	status: ServerJobStatus;
	seconds: number;
	percentage: number;
	imageName?: string;
	genTime?: number;
}

interface ResponseData {
	images: string[];
}

interface SettingsData {
	combinedLines?: number;
	positiveLines?: number;
	negativeLines?: number;
	models?: { [category: string]: { [name: string]: string } };
	LoRAs?: { [category: string]: { [name: string]: string } };
	samplers?: { [category: string]: { [name: string]: string } };
	presets?: { [name: string]: any };
}

type RequestConverter = (project: string, requestBody: string) => string | Promise<string>;
type ResponseConverter = (project: string, requestBody: string, responseBody: string, genTime: number) => string | Promise<string>;