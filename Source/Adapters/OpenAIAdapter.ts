/// <reference path="ChatAdapter.ts" />

namespace OpenAIAdapter {
	const thinkModeMap = {
		"false": "none",
		"true": "high",
		"low": "low",
		"medium": "medium",
		"high": "high",
		"max": "max"
	};

	export function createChatRequestBody(params: ChatParams, context: ChatMessage[]): any {
		return {
			messages: context.map(convertMessage),
			model: params.model,
			temperature: params.temp,
			top_p: params.topP,
			max_tokens: params.numPredict,
			reasoning_effort: thinkModeMap[String(params.think)],
			stream: true
		};
	}

	export function processChatResponseLine(params: ChatParams, line: string): { thinking: string, content: string } {
		if (line.startsWith("data:")) {
			line = line.slice(5).trim();
			if (line == "[DONE]") {
				return { thinking: "", content: "" };
			}
			const data = JSON.parse(line);
			if (data.error) {
				throw new Error(`OpenAI type API error: ${data.error.message}`);
			}
			if (data.choices == null || data.choices.length == 0) {
				return { thinking: "", content: "" };
			}
			const selection = data.choices[0];
			const payload = selection.message ?? selection.delta;
			if (payload) {
				return { thinking: payload.reasoning_content ?? payload.reasoning ?? "", content: payload.content ?? "" };
			}
		}
		return { thinking: "", content: "" };
	}

	function convertMessage(message: ChatMessage): any {
		if (message.images == null || message.images.length == 0) {
			return { role: message.role, content: message.content };
		}
		const parts = [];
		if (message.content) {
			parts.push({ type: "text", text: message.content });
		}
		for (const image of message.images) {
			parts.push({ type: "image_url", image_url: { url: `data:${getMime(image)};base64,${image}` }});
		}
		return { role: message.role, content: parts };
	}

	function getMime(data: string): string {
		if (data.startsWith("iVBORw0KGgo")) {
			return "image/png";
		}
		if (data.startsWith("/9j/")) {
			return "image/jpeg";
		}
		if (data.startsWith("R0lGOD")) {
			return "image/gif";
		}
		if (data.startsWith("UklGR")) {
			return "image/webp";
		}
		return "image/png";
	}
}