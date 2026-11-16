/// <reference path="../Common/Globals.ts" />

/// <reference path="Movement.ts" />
/// <reference path="GenParam.ts" />
/// <reference path="ParamUtil.ts" />

type JobStatus = "pending" | "ongoing" | "done" | "error";

interface TaskProgress {
	seconds: number;
	percentage: number;
}

interface TaskState {
	ID: number;
	status: JobStatus;
	seconds: number;
	percentage: number;
	imageName?: string;
	genTime?: number;
}

interface GenData {
	ID: number;
	status: JobStatus;
	imageName?: string;
	taskData: GenParam;
	startedDate?: number;
	genTime?: number;
	progress?: TaskProgress;
}

namespace SDConnector {
	export const project = new URLSearchParams(window.location.search).get("p") || "Main";

	async function getResponse(location: string, method = "GET", body = undefined) {
		const request = {
			method,
			body: body ? JSON.stringify(body) : undefined,
			headers: body ? CTJSON : undefined
		};
		const response = await fetch(location, request);
		const result = await response.json();
		return result;
	}

	function sendRequest(location: string, method = "POST", body = undefined): void {
		const request = {
			method,
			body: body ? JSON.stringify(body) : undefined,
			headers: body ? CTJSON : undefined
		};
		fetch(location, request);
	}

	export async function getProjects() {
		return getResponse("/api/get-projects");
	}

	export async function createProject(name: string, IDs: number[]) {
		return getResponse("/api/create-project", "POST", { name, sourceProject: project, IDs });
	}

	export async function reindexProject() {
		return getResponse("/api/reindex-project", "POST", { project });
	}

	export async function assignParams(IDs: number[], taskData: GenParam) {
		return getResponse("/api/assign-params", "POST", { project, IDs, taskData: ParamUtil.toDTHGen(taskData) });
	}

	export async function renameProject(name: string) {
		return getResponse("/api/rename-project", "POST", { project, name });
	}

	export async function getUpscalers() {
		return getResponse("/api/upscalers");
	}

	export async function importImages(images: any[]): Promise<GenData[]> {
		const result = await getResponse("/api/import", "POST", { project, images });
		for (const entry of result.entries) {
			entry.status = entry.status || "done";
			entry.taskData = ParamUtil.fromDTHGen(entry.taskData);
		}
		return result.entries;
	}

	export async function getHistory() {
		const result = await getResponse("/api/get-history", "POST", { project });
		for (const item of result) {
			item.status = item.status || "done";
			item.taskData = ParamUtil.fromDTHGen(item.taskData);
		}
		return result;
	}

	export async function generate(taskData: GenParam) {
		const converted = ParamUtil.toDTHGen(taskData);
		const result = await getResponse("/api/generate", "POST", { ...converted, project, sourceImage: taskData.sourceImage, type: taskData.type, upscaleModel: taskData.upscaleModel });
		result.status = result.status || "done";
		result.taskData = ParamUtil.fromDTHGen(result.taskData);
		return result;
	}

	export async function generateTasks(taskData: GenParam, combinedPrompt: string, sources: any[]): Promise<{ entries: GenData[], seed: number }> {
		const result = await getResponse("/api/generate", "POST", { project, taskData, combinedPrompt, sources });
		for (const entry of result.entries) {
			entry.status = entry.status || "pending";
			entry.taskData = ParamUtil.fromDTHGen(entry.taskData);
		}
		return result;
	}

	export async function getTaskStates(IDs: number[]): Promise<TaskState[]> {
		return getResponse("/api/get-task-states", "POST", { project, IDs });
	}

	export function moveGens(IDs: number[], movement: string, steps: number): void {
		sendRequest("/api/move-gens", "POST", { project, IDs, movement, steps });
	}

	export function removeGens(IDs: number[]): void {
		sendRequest("/api/remove-gens", "POST", { project, IDs });
	}

	export function moveGen(ID: number, movement: Movement): void {
		switch (movement) {
			case Movement.PREV:
				return sendRequest("/api/move-gen-prev", "POST", { ID, project });
			case Movement.NEXT:
				return sendRequest("/api/move-gen-next", "POST", { ID, project });
		}
	}

	export function removeGen(ID: number): void {
		sendRequest("/api/remove-gen", "POST", { ID, project });
	}

	export async function clearHistory() {
		return getResponse("/api/clear-history");
	}

	export async function getSettings() {
		return getResponse("/api/settings");
	}

	export async function getPresets() {
		return getResponse("/api/presets", "POST", {});
	}

	export async function savePreset(presetName: string, preset: any) {
		return getResponse("/api/presets", "POST", { [ presetName ]: preset });
	}

	export function imageURL(name: string): string {
		return `/ui/results/${project}/${name}`;
	}
}