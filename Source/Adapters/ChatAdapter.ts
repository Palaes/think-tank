type ThinkMode = false | true | "low" | "medium" | "high" | "max";

type ThoughtMode = "hidden" | "label" | "visible";

interface ChatParams {
	APIType: string;
	APIHost: string;
	APIKey: string;
	thought: ThoughtMode;
	model: string;
	think?: ThinkMode;
	temp?: number;
	topP?: number;
	topK?: number;
	numKeep?: number;
	numPredict?: number;
}

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
	role: ChatRole;
	content?: string;
	images?: string[];
}

interface ChatAdapter {
	createChatRequestBody(params: ChatParams, context: ChatMessage[]): any;
	processChatResponseLine(params: ChatParams, line: string): { thinking: string, content: string };
}