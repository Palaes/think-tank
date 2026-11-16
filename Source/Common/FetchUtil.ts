/// <reference path="./StreamUtil.ts" />

interface FetchHandler {
	controller?: AbortController;
	checkAbort?: () => boolean;
	onChunk?: (chunk: string) => string;
	onSpeak?: (chunk: string, settings?: any) => void;
	onError?: (error: Error) => string;
};

function checkAbort(handler: FetchHandler): void {
	if (handler.controller) {
		if (handler.checkAbort) {
			if (handler.checkAbort()) {
				handler.controller.abort();
			}
		}
	}
}

async function fetchText(url: string, method: string, headers: any, body: any): Promise<string> {
	const request: RequestInit = { method };
	if (headers) {
		request.headers = headers;
	}
	if (typeof body == "string") {
		request.body = body;
	} else if (body) {
		request.body = JSON.stringify(body);
	}
	const response = await fetch(url, request);
	if (response.body) {
		return StreamUtil.decode(StreamUtil.asIterable(response.body));
	}
	return "";
}

async function fetchData(url: string, method: string, headers: any, body: any): Promise<any> {
	return JSON.parse(await fetchText(url, method, headers, body));
}

async function fetchByChunk(url: string, method: string, headers: any, body: any, handler: FetchHandler): Promise<string> {
	const request: RequestInit = { method };
	if (handler.controller) {
		request.signal = handler.controller.signal;
	}
	if (headers) {
		request.headers = headers;
	}
	if (typeof body == "string") {
		request.body = body;
	} else if (body) {
		request.body = JSON.stringify(body);
	}
	const response = await fetch(url, request);
	if (response.body) {
		const iterable = StreamUtil.byChunk(StreamUtil.asIterable(response.body));
		return StreamUtil.process(iterable, handler);
	}
	return "";
}

async function fetchByLine(url: string, method: string, headers: any, body: any, handler: FetchHandler): Promise<string> {
	const request: RequestInit = { method };
	if (handler.controller) {
		request.signal = handler.controller.signal;
	}
	if (headers) {
		request.headers = headers;
	}
	if (typeof body == "string") {
		request.body = body;
	} else if (body) {
		request.body = JSON.stringify(body);
	}
	const response = await fetch(url, request);
	if (response.body) {
		const iterable = StreamUtil.trimChunks(StreamUtil.byLine(StreamUtil.asIterable(response.body)));
		return StreamUtil.process(iterable, handler);
	}
	return "";
}