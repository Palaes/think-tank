/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/ServerUtil.ts" />
/// <reference path="./TextForgeServer.ts" />

let textForgePort = 8093;
for (let i = 0; i < process.argv.length; ++i) {
	if (process.argv[i] == "--port" && i + 1 < process.argv.length) {
		textForgePort = parseInt(process.argv[i + 1]) || textForgePort;
	}
}

startServer(
	textForgePort,
	...TextForgeServer.getSpecs()
);
