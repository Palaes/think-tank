declare const require: any;
declare const process: any;
declare const Buffer: any;

namespace NodeUtil {
	export const os = require("os");

	export const path = require("path");

	export function getPath(...segments: string[]) {
		return path.join(...segments);
	}

	export const fs = require("fs");

	export function accessSync(path: string) {
		return NodeUtil.fs.accessSync(path);
	}

	export function makeDirSync(path: string, options?: any) {
		return NodeUtil.fs.mkdirSync(path, options);
	}

	export function readFileSync(path: string, encoding?: string) {
		return NodeUtil.fs.readFileSync(path, encoding);
	}

	export function writeFileSync(path: string, content: string, encoding?: string) {
		return NodeUtil.fs.writeFileSync(path, content, encoding);
	}

	export function readDirSync(path: string) {
		return NodeUtil.fs.readdirSync(path);
	}

	export function copySync(source: string, destination: string, options?: any) {
		return NodeUtil.fs.cpSync(source, destination, options);
	}

	export function renameSync(source: string, destination: string, options?: any) {
		return NodeUtil.fs.renameSync(source, destination);
	}

	export function removeSync(path: string, options?: any) {
		return NodeUtil.fs.rmSync(path, options);
	}

	export async function accessPromise(path: string) {
		return NodeUtil.fs.promises.access(path);
	}

	export async function makeDirPromise(path: string, options?: any) {
		return NodeUtil.fs.promises.mkdir(path, options);
	}

	export async function readFilePromise(path: string, encoding?: string) {
		return NodeUtil.fs.promises.readFile(path, encoding);
	}

	export async function writeFilePromise(path: string, content: any, encoding?: string) {
		return NodeUtil.fs.promises.writeFile(path, content, encoding);
	}

	export async function appendFilePromise(path: string, content: string, encoding?: string) {
		return NodeUtil.fs.promises.appendFile(path, content, encoding);
	}

	export async function readDirPromise(path: string) {
		return NodeUtil.fs.promises.readdir(path);
	}

	export async function copyPromise(source: string, destination: string, options?: any) {
		return NodeUtil.fs.promises.cp(source, destination, options);
	}

	export async function renamePromise(source: string, destination: string, options?: any) {
		return NodeUtil.fs.promises.rename(source, destination);
	}

	export async function removePromise(path: string, options?: any) {
		return NodeUtil.fs.promises.rm(path, options);
	}

	export const http = require("http");

	export const zlib = require("zlib");

	export const process = require("child_process");

	export async function executeProcess(command: string, input: string, ...args: string[]): Promise<string> {
		const child = NodeUtil.process.spawn(command, args);

		return new Promise(resolve => {
			let stdout = "";

			child.stdout.on("data", data => {
				stdout += data.toString();
			});

			child.stderr.on("data", data => {
				console.warn(data.toString());
			});

			child.on("error", error => {
				console.warn(`unable to spawn ${command}`);
				console.warn(error);
				resolve(null);
			});

			child.on("close", code => {
				if (code) {
					console.warn(`${command} ended with code ${code}`);
					resolve(null);
				} else {
					resolve(stdout);
				}
			});

			child.stdin.on("error", error => {
				console.warn(`unable to write stdin to ${command}`);
				console.warn(error);
				resolve(null);
			});

			child.stdin.end(input);
		});
	}
}