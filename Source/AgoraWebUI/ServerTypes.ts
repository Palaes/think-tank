/// <reference path="../Adapters/ChatAdapter.ts" />

interface ContextEntry {
	type: "message" | "image" | "document";
	time?: number;
	role?: "user" | "ark" | "env" | "info";
	name: string;
	content: string;
}

interface UserMessageData {
	time: number;
	content: string;
	images: string[];
	documents: string[];
}

interface ChatMeta {
	chatID: string;
	title: string;
	created: number;
	updated: number;
	viewed: number;
	archived: boolean;
}

interface ArkMeta {
	arkName: string;
	description: string;
}

interface IdeaInfo {
	name: string;
	entries: string[];
}

interface IdeaListing {
	ideas: IdeaInfo[];
	inbox: string[];
}

// One settings layer as it crosses the wire; a missing key stays unset,
// so the layer below decides, and "enabled" keys merge as all-true.
interface AgoraSettings {
	title?: string;
	archived?: boolean;
	members?: string[];
	process?: SettingsProcess;
	generate?: SettingsGenerate;
	memory?: SettingsMemory;
	actions?: SettingsActions;
	image?: SettingsImage;
	document?: SettingsDocument;
	web?: SettingsWeb;
	idea?: SettingsIdea;
	todo?: SettingsTodo;
	tts?: SettingsTTS;
}

interface SettingsProcess {
	userName?: string;
	arkName?: string;
	urgPrompt?: string;
	useClock?: boolean;
	useArchive?: boolean;
	minContextCount?: number;
	minContextSize?: number;
	minBlockSize?: number;
}

interface SettingsGenerate {
	mainModel?: string;
	visionModel?: string;
	smallModel?: string;
	thinking?: ThoughtMode;
	prompt?: string;
	think?: ThinkMode;
	temp?: number;
	topP?: number;
	topK?: number;
	numCtx?: number;
	numKeep?: number;
	numPredict?: number;
}

interface SettingsMemory {
	model?: string;
	prompt?: string;
	shortLimit?: number;
	longLimit?: number;
	activeLimit?: number;
	activeEntries?: number;
	allowRead?: boolean;
	allowWrite?: boolean;
}

interface SettingsActions {
	enabled?: boolean;
	generate?: boolean;
	prompt?: string;
}

interface SettingsImage {
	enabled?: boolean;
	prompt?: string;
	upload?: "raw" | "save" | "describe";
	convertLargeCommand?: string;
	convertSmallCommand?: string;
}

interface SettingsDocument {
	enabled?: boolean;
	prompt?: string;
	uploadMode?: "raw" | "save" | "describe";
	rawCount?: number;
	rawLines?: number;
	rawLength?: number;
}

interface SettingsWeb {
	enabled?: boolean;
	APIType?: string;
	APIHost?: string;
	APIKey?: string;
}

interface SettingsIdea {
	enabled?: boolean;
	model?: string;
	assignedArk?: string;
	selectPrompt?: string;
	summaryPrompt?: string;
	contemplatePrompt?: string;
	selectModel?: string;
	summaryModel?: string;
	contemplateModel?: string;
	itemsPerWake?: number;
	deferred?: string[];
	lastIndex?: number;
	defaultChat?: string;
}

interface SettingsTodo {
	enabled?: boolean;
	lastIndex?: number;
	defaultChat?: string;
}

interface SettingsTTS {
	enabled?: boolean;
	APIType?: string;
	APIHost?: string;
	APIKey?: string;
	model?: string;
	voice?: string;
}

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
