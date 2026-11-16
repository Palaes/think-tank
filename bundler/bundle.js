const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const rootPath = path.resolve(__dirname, "..");
const bundlerPath = __dirname;
const appsPath = path.join(bundlerPath, "apps");
const skeletonPath = path.join(bundlerPath, "skeleton", "main.swift");
const distPath = path.join(bundlerPath, "dist");
const workPath = path.join(bundlerPath, "build");

function readApps(names) {
	const result = [];
	for (const file of fs.readdirSync(appsPath)) {
		if (!file.endsWith(".json")) {
			continue;
		}
		const app = JSON.parse(fs.readFileSync(path.join(appsPath, file), "utf8"));
		if (names.length && !names.includes(app.name)) {
			continue;
		}
		result.push(app);
	}
	if (names.length) {
		const missing = names.filter(name => !result.some(app => app.name == name));
		if (missing.length) {
			throw new Error(`unknown app: ${missing.join(", ")}`);
		}
	}
	return result;
}

function buildApp(app) {
	const appPath = path.join(distPath, `${app.name}.app`);
	const contentsPath = path.join(appPath, "Contents");
	const macosPath = path.join(contentsPath, "MacOS");
	const resourcesPath = path.join(contentsPath, "Resources");
	const workAppPath = path.join(workPath, app.name);

	fs.rmSync(appPath, { recursive: true, force: true });
	fs.mkdirSync(macosPath, { recursive: true });
	fs.mkdirSync(resourcesPath, { recursive: true });
	fs.mkdirSync(workAppPath, { recursive: true });

	for (const relative of app.resources) {
		const source = path.join(rootPath, relative);
		const target = path.join(resourcesPath, relative);
		if (!fs.existsSync(source)) {
			throw new Error(`missing resource: ${relative}`);
		}
		fs.cpSync(source, target, { recursive: true });
	}

	writeInfoPlist(app, contentsPath);
	writeSources(app, workAppPath);
	compileApp(app, workAppPath, macosPath);
	signApp(appPath);
	return appPath;
}

function writeInfoPlist(app, contentsPath) {
	const info = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>${escapeXml(app.name)}</string>
	<key>CFBundleDisplayName</key>
	<string>${escapeXml(app.name)}</string>
	<key>CFBundleIdentifier</key>
	<string>${escapeXml(app.bundleID)}</string>
	<key>CFBundleExecutable</key>
	<string>${escapeXml(app.name)}</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleShortVersionString</key>
	<string>${escapeXml(app.version)}</string>
	<key>CFBundleVersion</key>
	<string>${escapeXml(app.version)}</string>
	<key>LSMinimumSystemVersion</key>
	<string>12.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSPrincipalClass</key>
	<string>NSApplication</string>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
</dict>
</plist>
`;
	fs.writeFileSync(path.join(contentsPath, "Info.plist"), info);
	fs.writeFileSync(path.join(contentsPath, "PkgInfo"), "APPL????");
}

function escapeXml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function writeSources(app, workAppPath) {
	const cli = app.cli ?? { name: "", script: "" };
	const lines = [
		"enum AppConfig {",
		`\tstatic let name = ${JSON.stringify(app.name)};`,
		`\tstatic let bundleID = ${JSON.stringify(app.bundleID)};`,
		`\tstatic let label = bundleID + ".server";`,
		`\tstatic let serverScript = ${JSON.stringify(app.serverScript)};`,
		`\tstatic let port = ${JSON.stringify(app.port)};`,
		`\tstatic let uiPath = ${JSON.stringify(app.uiPath)};`,
		`\tstatic let cliName = ${JSON.stringify(cli.name ?? "")};`,
		`\tstatic let cliScript = ${JSON.stringify(cli.script ?? "")};`,
		"}",
		""
	];
	fs.writeFileSync(path.join(workAppPath, "Config.swift"), lines.join("\n"));
	fs.copyFileSync(skeletonPath, path.join(workAppPath, "main.swift"));
}

function compileApp(app, workAppPath, macosPath) {
	const executable = path.join(macosPath, app.name);
	const args = [
		"-O",
		"-swift-version", "5",
		"-framework", "Cocoa",
		"-framework", "WebKit",
		"-module-cache-path", path.join(workAppPath, "modules"),
		"-o", executable,
		path.join(workAppPath, "Config.swift"),
		path.join(workAppPath, "main.swift")
	];
	const result = childProcess.spawnSync("swiftc", args, { stdio: "inherit" });
	if (result.status != 0) {
		throw new Error(`swiftc failed for ${app.name}`);
	}
}

function signApp(appPath) {
	const result = childProcess.spawnSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "ignore" });
	if (result.status != 0) {
		console.warn(`warning: could not sign ${path.basename(appPath)}`);
	}
}

function makeDmg(app) {
	const appPath = buildApp(app);
	const dmgPath = path.join(distPath, `${app.name}.dmg`);
	const binPath = "create-dmg";
	fs.rmSync(dmgPath, { force: true });
	const result = childProcess.spawnSync(binPath, [
		"--overwrite",
		"--skip-jenkins",
		"--volname", app.name,
		"--app-drop-link", "0", "0",
		`${app.name}.dmg`,
		`${app.name}.app`
	], {
		cwd: distPath,
		env: { ...process.env, TMPDIR: workPath },
		stdio: "inherit"
	});
	if (result.error) {
		throw new Error("create-dmg is missing, run brew install create-dmg");
	}
	if (result.status != 0) {
		throw new Error(`create-dmg failed for ${app.name}`);
	}
	return dmgPath;
}

function findApp(name) {
	const candidates = [
		path.join(distPath, `${name}.app`),
		path.join(os.homedir(), "Applications", `${name}.app`),
		path.join("/Applications", `${name}.app`)
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error(`app not built: ${name}`);
}

function runAppCommand(name, flag) {
	const appPath = findApp(name);
	const executable = path.join(appPath, "Contents", "MacOS", name);
	const result = childProcess.spawnSync(executable, [flag], { stdio: "inherit" });
	process.exitCode = result.status ?? 1;
}

function runServiceCommand(args) {
	const action = args[0];
	const name = args[1];
	if (action == "install" && name) {
		runAppCommand(name, "--install-service");
		return;
	}
	if (action == "uninstall" && name) {
		runAppCommand(name, "--remove-service");
		return;
	}
	if (action == "status" && name) {
		runAppCommand(name, "--service-status");
		return;
	}
	printUsage();
}

function runCLICommand(args) {
	const action = args[0];
	const name = args[1];
	if (action == "install" && name) {
		runAppCommand(name, "--install-cli");
		return;
	}
	if (action == "uninstall" && name) {
		runAppCommand(name, "--remove-cli");
		return;
	}
	printUsage();
}

function clean() {
	fs.rmSync(distPath, { recursive: true, force: true });
	fs.rmSync(workPath, { recursive: true, force: true });
}

function printUsage() {
	console.log("Usage:");
	console.log("  node bundle.js list");
	console.log("  node bundle.js build [App...]");
	console.log("  node bundle.js dmg [App...]");
	console.log("  node bundle.js clean");
	console.log("  node bundle.js service install|uninstall|status <App>");
	console.log("  node bundle.js cli install|uninstall <App>");
}

function main(args) {
	const command = args[0] ?? "help";
	const rest = args.slice(1);
	switch (command) {
		case "list":
			for (const app of readApps([])) {
				console.log(`${app.name}\t${app.bundleID}\t${app.port}\t${app.uiPath}`);
			}
			break;
		case "build":
			for (const app of readApps(rest)) {
				const appPath = buildApp(app);
				console.log(`built ${path.relative(rootPath, appPath)}`);
			}
			break;
		case "dmg":
			for (const app of readApps(rest)) {
				const dmgPath = makeDmg(app);
				console.log(`built ${path.relative(rootPath, dmgPath)}`);
			}
			break;
		case "clean":
			clean();
			break;
		case "service":
			runServiceCommand(rest);
			break;
		case "cli":
			runCLICommand(rest);
			break;
		default:
			printUsage();
	}
}

main(process.argv.slice(2));
