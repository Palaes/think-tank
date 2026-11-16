/// <reference path="./NodeUtil.ts" />
/// <reference path="./StreamUtil.ts" />

function sendError(response: any, status: number, message: string, error: any): void {
	if (response.headersSent) {
		response.end(`\n\n[Error: ${message}]`);
	} else {
		response.writeHead(status, CTTEXT);
		response.end(message);
	}
	console.error(message);
	console.error(error);
}

async function handleWith(request: any, response: any, handler: any): Promise<void> {
	let requestText: string;
	try {
		requestText = await StreamUtil.decode(request);
	} catch (error) {
		sendError(response, 400, "unable to decode request text", error);
		return;
	}
	let requestData: any;
	const contentType = request.headers["content-type"];
	if (contentType == null) {
		if (requestText.length) {
			sendError(response, 400, "content type missing for body", null);
			return;
		}
	} else if (contentType.toLowerCase().includes("json")) {
		try {
			requestData = JSON.parse(requestText);
		} catch (error) {
			sendError(response, 400, "unable to parse request JSON", error);
			return;
		}
	} else if (contentType.toLowerCase().includes("text")) {
		requestData = requestText;
	} else {
		sendError(response, 400, "wrong content type", contentType);
		return;
	}

	let responseData: any;
	try {
		responseData = await handler(requestData, response, request);
	} catch (error) {
		sendError(response, 500, "internal server error", error);
		return;
	}
	if (response.headersSent) {
		// handled internally
	} else if (typeof responseData == "string") {
		response.writeHead(200, CTTEXT);
		response.end(responseData);
	} else if (responseData) {
		response.writeHead(200, CTJSON);
		response.end(JSON.stringify(responseData));
	} else {
		sendError(response, 500, "internal server error", "no response data");
	}
}

async function handleStatic(response: any, path: string): Promise<void> {
	try {
		const data = await NodeUtil.readFilePromise(path);
		response.statusCode = 200;
		response.end(data);
	} catch {
		sendError(response, 404, "static not found", path);
	}
}

function ensureSlash(path: string): string {
	if (path.endsWith("/")) {
		return path;
	}
	return path + "/";
}

function startServer(port, ...specs) {
	async function serverFunction(request, response) {
		const url = new URL("http://" + request.headers.host + request.url);
		for (const item of specs) {
			const path = ensureSlash(url.pathname);
			const route = ensureSlash(item.route);
			if (path.startsWith(route)) {
				if (item.handler) {
					await handleWith(request, response, item.handler);
				} else if (item.dir) {
					// TODO: Think about this again.
					const rest = decodeURIComponent(url.pathname.slice(route.length));
					const path = item.dir + (rest || "index.html");
					await handleStatic(response, path);
				}
				return;
			}
		}
		response.statusCode = 404;
		response.end("not found");
	}
	const server = NodeUtil.http.createServer(serverFunction);
	server.listen(port, event => {
		console.log("Server started at:");
		console.log("localhost:" + port);
	});
}