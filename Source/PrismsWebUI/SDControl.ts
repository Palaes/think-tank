/// <reference path="../PrismsLibrary/ImageMetadata.ts" />
/// <reference path="SDCommandEngine.ts" />
/// <reference path="SDConnector.ts" />
/// <reference path="GenTask.ts" />
/// <reference path="Catalogue.ts" />

namespace SDControl {
	let inputs;
	let container;

	const wrappers = new Map<number, GenTask>();
	const pollInterval = 1000;
	let pollHandle: any = null;
	let polling = false;

	export function applyParameters(parameters: any): void {
		// TODO: This should be rethinked.
		// A preset that carries its own combined prompt must not have it overwritten.
		if (parameters.combinedPrompt == null) {
			if (typeof parameters.positivePrompt == "string") {
				if (typeof parameters.negativePrompt == "string") {
					parameters.combinedPrompt = UIUtil.combineMultiLine("", parameters.positivePrompt, parameters.negativePrompt, "\n");
				}
			}
		}
		for (const input of inputs) {
			let value = parameters;
			const key = input.getAttribute("SDTarget");
			for (const part of key.split("/")) {
				if (value) {
					value = value[part];
				}
			}
			if (value === undefined) {
				continue;
			}
			const type = input.getAttribute("SDType");
			switch (type) {
				case "bool":
					input.checked = value;
					break;
				case "int":
					input.value = value.toFixed(0);
					break;
				case "float":
					input.value = Number(value.toFixed(2));
					break;
				case "string":
					input.value = value;
					break;
				case "nest":
					addMissingOption(input, value);
					input.value = value || "";
					break;
			}
		}
	}

	function addMissingOption(select: HTMLSelectElement, value: any): void {
		if (value == null || value == "") {
			return;
		}
		for (const option of select.options) {
			if (option.value == value) {
				return;
			}
		}
		const option = document.createElement("option");
		option.textContent = value;
		option.value = value;
		select.appendChild(option);
	}

	const seedInput: any = document.getElementById("currentSeed");

	function applyNextSeed(): void {
		seedInput.value = XSRandom.next(parseInt(seedInput.value));
	}

	const widthInput: any = document.getElementById("width");
	const heightInput: any = document.getElementById("height");
	const hiResWidthInput: any = document.getElementById("hiResWidth");
	const hiResHeightInput: any = document.getElementById("hiResHeight");
	const hiResStrengthInput: any = document.getElementById("hiResStrength");
	const originalWidthInput: any = document.getElementById("originalWidth");
	const originalHeightInput: any = document.getElementById("originalHeight");
	const targetWidthInput: any = document.getElementById("targetWidth");
	const targetHeightInput: any = document.getElementById("targetHeight");
	const negativeWidthInput: any = document.getElementById("negativeWidth");
	const negativeHeightInput: any = document.getElementById("negativeHeight");

	const projectList: any = document.getElementById("projectList");
	const upscalerList: any = document.getElementById("upscalerList");
	const presetList: any = document.getElementById("presetList");

	const presetsByName = new Map<string, any>();

	const selectedIDs = new Set<number>();
	const genDataByID = new Map<number, GenData>();
	let selectionAnchor: number = null;

	// TODO: This could be nicer.
	function resetSiblings(...elements: any): void {
		for (const element of elements) {
			element.nextElementSibling.value = element.value;
		}
	}

	function executeSwapResolution(): void {
		[ widthInput.value, heightInput.value ] = [ heightInput.value, widthInput.value ];
		resetSiblings(widthInput, heightInput);
		[ hiResWidthInput.value, hiResHeightInput.value ] = [ hiResHeightInput.value, hiResWidthInput.value ];
		resetSiblings(hiResWidthInput, hiResHeightInput);
		[ originalWidthInput.value, originalHeightInput.value ] = [ originalHeightInput.value, originalWidthInput.value ];
		resetSiblings(originalWidthInput, originalHeightInput);
		[ targetWidthInput.value, targetHeightInput.value ] = [ targetHeightInput.value, targetWidthInput.value ];
		resetSiblings(targetWidthInput, targetHeightInput);
		[ negativeWidthInput.value, negativeHeightInput.value ] = [ negativeHeightInput.value, negativeWidthInput.value ];
		resetSiblings(negativeWidthInput, negativeHeightInput);
	}

	function executeResetHiRes(): void {
		[ hiResWidthInput.value, hiResHeightInput.value ] = [ widthInput.value, heightInput.value ];
		resetSiblings(hiResWidthInput, hiResHeightInput);
		hiResStrengthInput.value = 0.5;
		resetSiblings(hiResStrengthInput);
	}

	function executeResetSizeEmbed(): void {
		[ originalWidthInput.value, originalHeightInput.value ] = [ widthInput.value, heightInput.value ];
		resetSiblings(originalWidthInput, originalHeightInput);
		[ targetWidthInput.value, targetHeightInput.value ] = [ widthInput.value, heightInput.value ];
		resetSiblings(targetWidthInput, targetHeightInput);
		[ negativeWidthInput.value, negativeHeightInput.value ] = [ widthInput.value, heightInput.value ];
		resetSiblings(negativeWidthInput, negativeHeightInput);
	}

	async function executeCopyParams() {
		const parameters = createTaskData();
		// TODO: This should be rethinked.
		parameters.positivePrompt = undefined;
		parameters.negativePrompt = undefined;
		await navigator.clipboard.writeText(JSON.stringify(parameters, null, "\t"));
	}

	async function executePasteParams() {
		const paramsData = JSON.parse(await navigator.clipboard.readText());
		applyParameters(paramsData);
	}

	function createTaskData(): GenParam {
		const taskData = ParamUtil.duplicateSDGen(defaultGenParam);
		for (const input of inputs) {
			let target = taskData;
			let key = input.getAttribute("SDTarget");
			const parts = key.split("/");
			key = parts.pop();
			for (const part of parts) {
				target = target[part] = target[part] || {};
			}
			const type = input.getAttribute("SDType");
			switch (type) {
				case "bool":
					target[key] = input.checked;
					break;
				case "int":
					target[key] = parseInt(input.value);
					break;
				case "float":
					target[key] = parseFloat(input.value);
					break;
				case "string":
					target[key] = input.value;
					break;
				case "nest":
					target[key] = input.value || null;
					break;
			}
		}
		return taskData;
	}

	// The parameters in the UI, with the combined prompt split into its parts.
	function collectTaskData(): GenParam {
		const taskData = createTaskData();
		const input = cleanString(taskData.combinedPrompt);
		delete taskData.combinedPrompt;
		let result: GenParam = null;
		commandEngine.init(taskData, submitted => result = submitted);
		commandEngine.handleBlock(input);
		return result || taskData;
	}

	let commandEngine: SDCommandEngine;

	interface SourceInfo {
		path: string;
		positivePrompt: string;
		negativePrompt: string;
		width: number;
		height: number;
	}

	async function addAll(randomize: boolean): Promise<void> {
		const taskData = createTaskData();
		const input = cleanString(taskData.combinedPrompt);
		delete taskData.combinedPrompt;
		const sources = collectSources();
		try {
			const result = await SDConnector.generateTasks(taskData, input, sources);
			renderGenerated(result.entries);
			if (randomize) {
				applyParameters({ seed: result.seed });
			}
		} catch (error) {
			console.warn("Unable to submit generation.");
			console.trace(error);
		}
	}

	function collectSources(): SourceInfo[] {
		const result: SourceInfo[] = [];
		for (const task of selectionInOrder()) {
			const genData = genDataByID.get(task.ID);
			if (genData) {
				result.push({
					path: `${SDConnector.project}/${genData.imageName.split("?")[0]}`,
					positivePrompt: genData.taskData.positivePrompt,
					negativePrompt: genData.taskData.negativePrompt,
					width: genData.taskData.width,
					height: genData.taskData.height
				});
			}
		}
		return result;
	}

	async function submitTask(taskData: GenParam): Promise<void> {
		try {
			await SDConnector.generate(taskData);
		} catch (error) {
			console.warn("Unable to submit generation.");
			console.trace(error);
		}
	}

	function renderGenerated(entries: GenData[]): void {
		for (const genData of entries) {
			const existing = wrappers.get(genData.ID);
			if (existing) {
				genDataByID.set(genData.ID, genData);
				existing.update(genData);
				continue;
			}
			genDataByID.set(genData.ID, genData);
			const task = new GenTask(container, genData);
			wrappers.set(genData.ID, task);
			container.insertBefore(task.wrapper, container.firstChild);
		}
		updatePolling();
	}

	function renderHistory(history: GenData[]): void {
		const seen = new Set<number>();
		let previous: HTMLElement = null;
		// newest first, the server appends in creation order
		for (let i = history.length; i-- > 0;) {
			const genData = history[i];
			seen.add(genData.ID);
			genDataByID.set(genData.ID, genData);
			let task = wrappers.get(genData.ID);
			if (task) {
				task.update(genData);
			} else {
				task = new GenTask(container, genData);
				wrappers.set(genData.ID, task);
			}
			const anchor = previous ? previous.nextElementSibling : container.firstChild;
			if (task.wrapper != anchor) {
				container.insertBefore(task.wrapper, anchor);
			}
			previous = task.wrapper;
		}
		for (const [ ID, task ] of wrappers) {
			if (!seen.has(ID)) {
				if (task.wrapper.parentNode == container) {
					container.removeChild(task.wrapper);
				}
				wrappers.delete(ID);
				genDataByID.delete(ID);
				selectedIDs.delete(ID);
			}
		}
	}

	export function toggleSelection(genData: GenData): boolean {
		if (selectedIDs.has(genData.ID)) {
			selectedIDs.delete(genData.ID);
		} else {
			selectedIDs.add(genData.ID);
		}
		selectionAnchor = genData.ID;
		return selectedIDs.has(genData.ID);
	}

	export function addSelection(genData: GenData): void {
		selectedIDs.add(genData.ID);
		selectionAnchor = genData.ID;
	}

	// Select only the clicked image, or deselect it when it already is the
	// single selected one.
	export function selectExclusive(genData: GenData): boolean {
		const wasOnly = selectedIDs.size == 1 && selectedIDs.has(genData.ID);
		if (wasOnly) {
			selectedIDs.delete(genData.ID);
			wrappers.get(genData.ID).wrapper.classList.remove("selected");
		} else {
			applySelection(new Set([ genData.ID ]));
		}
		selectionAnchor = genData.ID;
		return !wasOnly;
	}

	// Select every image between the anchor and the clicked one.
	export function selectRange(genData: GenData): void {
		const IDs = allSelectionIDs();
		const from = IDs.indexOf(selectionAnchor);
		const to = IDs.indexOf(genData.ID);
		if (from < 0 || to < 0) {
			applySelection(new Set([ genData.ID ]));
		} else {
			const next = new Set<number>();
			const start = Math.min(from, to);
			const end = Math.max(from, to);
			for (let i = start; i <= end; ++i) {
				next.add(IDs[i]);
			}
			applySelection(next);
		}
		selectionAnchor = genData.ID;
	}

	export function clearSelection(): void {
		selectedIDs.clear();
		selectionAnchor = null;
		for (const [ ID, task ] of wrappers) {
			task.wrapper.classList.remove("selected");
		}
	}

	function removeSelection(): void {
		const tasks = selectionInOrder();
		if (tasks.length == 0) {
			return;
		}
		const IDs: number[] = [];
		for (const task of tasks) {
			IDs.push(task.ID);
			if (task.wrapper.parentNode == container) {
				container.removeChild(task.wrapper);
			}
			wrappers.delete(task.ID);
			genDataByID.delete(task.ID);
			selectedIDs.delete(task.ID);
		}
		selectionAnchor = null;
		SDConnector.removeGens(IDs);
		updatePolling();
	}

	export function removeTask(ID: number): void {
		const task = wrappers.get(ID);
		if (task) {
			if (task.wrapper.parentNode == container) {
				container.removeChild(task.wrapper);
			}
			wrappers.delete(ID);
			genDataByID.delete(ID);
			selectedIDs.delete(ID);
		}
		SDConnector.removeGen(ID);
		updatePolling();
	}

	function allSelectionIDs(): number[] {
		const result: number[] = [];
		for (const child of container.children) {
			if (child.classList.contains("imageWrapper")) {
				result.push(entryID(child));
			}
		}
		return result;
	}

	function applySelection(IDs: Set<number>): void {
		selectedIDs.clear();
		for (const [ ID, task ] of wrappers) {
			if (IDs.has(ID)) {
				selectedIDs.add(ID);
				task.wrapper.classList.add("selected");
			} else {
				task.wrapper.classList.remove("selected");
			}
		}
	}

	function entryID(element: Element): number {
		for (const [ ID, task ] of wrappers) {
			if (task.wrapper == element) {
				return ID;
			}
		}
		return null;
	}

	function selectionInOrder(): GenTask[] {
		const result: GenTask[] = [];
		for (const child of container.children) {
			for (const [ ID, task ] of wrappers) {
				if (task.wrapper == child && selectedIDs.has(ID)) {
					result.push(task);
				}
			}
		}
		return result;
	}

	// Move the selection itself one image over, keeping the set together.
	// It shrinks where the block runs off the edge.
	function shiftSelection(vertical: boolean, forward: boolean): void {
		const next = new Set<number>();
		for (const ID of selectedIDs) {
			const neighbor = neighborOf(wrappers.get(ID).wrapper, vertical, forward);
			if (neighbor) {
				next.add(entryID(neighbor));
			}
		}
		if (next.size) {
			applySelection(next);
		}
	}

	// Grow the selection by one image at the leading edge.
	function expandSelection(vertical: boolean, forward: boolean): void {
		const tasks = selectionInOrder();
		if (tasks.length == 0) {
			return;
		}
		const edge = forward ? tasks[tasks.length - 1] : tasks[0];
		const neighbor = neighborOf(edge.wrapper, vertical, forward);
		if (neighbor) {
			selectedIDs.add(entryID(neighbor));
			neighbor.classList.add("selected");
		}
	}

	// Move the selected images one step in the project order. Vertical steps
	// travel the flat distance to the image on the neighbouring line.
	function moveSelection(vertical: boolean, forward: boolean): void {
		const tasks = selectionInOrder();
		if (tasks.length == 0) {
			return;
		}
		if (vertical) {
			if (forward) {
				tasks.reverse();
			}
			const movement = forward ? Movement.PREV : Movement.NEXT;
			for (const task of tasks) {
				const wrapper = task.wrapper;
				const target = neighborOf(wrapper, true, forward);
				if (target == null) {
					continue;
				}
				const steps = Math.abs(flatIndex(target) - flatIndex(wrapper));
				for (let i = 0; i < steps; ++i) {
					const neighbor = forward ? wrapper.nextElementSibling : wrapper.previousElementSibling;
					if (neighbor == null) {
						break;
					}
					SDConnector.moveGen(task.ID, movement);
					if (forward) {
						container.insertBefore(neighbor, wrapper);
					} else {
						container.insertBefore(wrapper, neighbor);
					}
				}
			}
			return;
		}
		if (forward) {
			tasks.reverse();
		}
		const IDs: number[] = [];
		for (const task of tasks) {
			IDs.push(task.ID);
			const neighbor = forward ? task.wrapper.nextElementSibling : task.wrapper.previousElementSibling;
			if (neighbor == null) {
				continue;
			}
			if (forward) {
				container.insertBefore(neighbor, task.wrapper);
			} else {
				container.insertBefore(task.wrapper, neighbor);
			}
		}
		SDConnector.moveGens(IDs, forward ? "prev" : "next", 1);
	}

	// Toggle the full screen preview at the newest selected image.
	function togglePreview(): void {
		const full = document.querySelector(".FullScreen");
		if (full) {
			full.classList.remove("FullScreen");
			return;
		}
		for (const child of container.children) {
			if (child.classList.contains("imageWrapper") && child.classList.contains("selected")) {
				child.classList.add("FullScreen");
				return;
			}
		}
	}

	function neighborOf(wrapper: Element, vertical: boolean, forward: boolean): Element {
		if (vertical) {
			return verticalNeighbor(wrapper, forward);
		}
		const neighbor = forward ? wrapper.nextElementSibling : wrapper.previousElementSibling;
		if (neighbor && neighbor.classList.contains("imageWrapper")) {
			return neighbor;
		}
		return null;
	}

	function verticalNeighbor(wrapper: Element, forward: boolean): Element {
		const rows = measureRows();
		let column = -1;
		let index = -1;
		for (let i = 0; i < rows.length; ++i) {
			column = rows[i].indexOf(wrapper as HTMLElement);
			if (column >= 0) {
				index = i;
				break;
			}
		}
		if (index < 0) {
			return null;
		}
		const target = forward ? rows[index + 1] : rows[index - 1];
		if (target == null) {
			return null;
		}
		let best = null;
		let distance = Infinity;
		for (let i = 0; i < target.length; ++i) {
			if (Math.abs(i - column) < distance) {
				distance = Math.abs(i - column);
				best = target[i];
			}
		}
		if (best && best.classList.contains("imageWrapper")) {
			return best;
		}
		return null;
	}

	// Group the wrappers into visual lines by their vertical center.
	function measureRows(): HTMLElement[][] {
		const result: HTMLElement[][] = [];
		for (const child of container.children) {
			const row = result[result.length - 1];
			if (row && Math.abs(rowCenter(row) - rowCenter([ child ])) < 20) {
				row.push(child);
			} else {
				result.push([ child ]);
			}
		}
		return result;
	}

	function rowCenter(row: HTMLElement[]): number {
		return row[0].offsetTop + row[0].offsetHeight / 2;
	}

	function flatIndex(wrapper: Element): number {
		for (let i = 0; i < container.children.length; ++i) {
			if (container.children[i] == wrapper) {
				return i;
			}
		}
		return -1;
	}

	async function pollHistory(): Promise<void> {
		try {
			renderHistory(await SDConnector.getHistory());
			updatePolling();
		} catch (error) {
			console.warn("Unable to poll history.");
			console.trace(error);
		}
	}

	function runningTaskIDs(): number[] {
		const result: number[] = [];
		for (const [ ID, task ] of wrappers) {
			if (task.status == "pending" || task.status == "ongoing") {
				result.push(ID);
			}
		}
		return result;
	}

	function startPoll(): void {
		if (pollHandle != null) {
			return;
		}
		pollHandle = setInterval(() => {
			if (document.hidden == false) {
				pollStates();
			}
		}, pollInterval);
	}

	function stopPoll(): void {
		if (pollHandle != null) {
			clearInterval(pollHandle);
			pollHandle = null;
		}
	}

	function updatePolling(): void {
		if (runningTaskIDs().length == 0) {
			stopPoll();
		} else {
			startPoll();
		}
	}

	async function pollStates(): Promise<void> {
		if (polling) {
			return;
		}
		const IDs = runningTaskIDs();
		if (IDs.length == 0) {
			stopPoll();
			return;
		}
		polling = true;
		try {
			const states = await SDConnector.getTaskStates(IDs);
			for (const state of states) {
				const genData = genDataByID.get(state.ID);
				const task = wrappers.get(state.ID);
				if (genData && task) {
					genData.status = state.status;
					genData.imageName = state.imageName ?? genData.imageName;
					genData.genTime = state.genTime ?? genData.genTime;
					genData.progress = { seconds: state.seconds, percentage: state.percentage };
					task.update(genData);
				}
			}
		} catch (error) {
			console.warn("Unable to poll task states.");
			console.trace(error);
		}
		polling = false;
		updatePolling();
	}

	function initCollapsibleGroups() {
		const groups = document.querySelectorAll("[collapsible]");
		for (const group of groups) {
			const storageKey = `${group.id}-collapsed`;
			const storedState = localStorage.getItem(storageKey);
			if (storedState == "true") {
				group.classList.add("collapsed")
			} else if (storedState == "false") {
				group.classList.remove("collapsed")
			}
			group.firstElementChild.addEventListener("click", event => {
				if (group.classList.contains("collapsed")) {
					group.classList.remove("collapsed")
					localStorage.setItem(storageKey, "false")
				} else {
					group.classList.add("collapsed")
					localStorage.setItem(storageKey, "true")
				}
				event.stopPropagation();
			});
		}
	}

	function initCombinedInputs() {
		const rows = document.querySelectorAll("[combined]");
		for (const row of rows) {
			const slider: any = row.children[1];
			const numeric: any = row.children[2];
			slider.setAttribute("SDTarget", numeric.getAttribute("SDTarget"));
			slider.setAttribute("SDType", numeric.getAttribute("SDType"));
			numeric.min = slider.min;
			numeric.max = slider.max;
			numeric.step = slider.step;
			numeric.value = slider.value;
			slider.addEventListener("input", event => {
				numeric.value = slider.value;
			});
			numeric.addEventListener("input", event => {
				slider.value = numeric.value;
			});
		}
	}

	function initControlInterface() {
		inputs = document.querySelectorAll("[SDTarget]");
		container = document.getElementById("images");
		container.addEventListener("click", event => {
			if (event.target == container) {
				clearSelection();
			}
		});
		const nextSeedButton = document.getElementById("nextSeed");
		nextSeedButton.addEventListener("click", () => applyNextSeed());
		const randomizeCheckBox: any = document.getElementById("randomize");

		const swapResolutionButton = document.getElementById("swapResolution");
		swapResolutionButton.addEventListener("click", () => executeSwapResolution());
		const resetHiResButton = document.getElementById("resetHiRes");
		resetHiResButton.addEventListener("click", () => executeResetHiRes());
		const resetSizeEmbedButton = document.getElementById("resetSizeEmbed");
		resetSizeEmbedButton.addEventListener("click", () => executeResetSizeEmbed());

		const copyParamsButton = document.getElementById("copyParams");
		copyParamsButton.addEventListener("click", () => executeCopyParams());
		const pasteParamsButton = document.getElementById("pasteParams");
		pasteParamsButton.addEventListener("click", () => executePasteParams());

		const generateButton = document.getElementById("generate");
		generateButton.addEventListener("click", () => addAll(randomizeCheckBox.checked));
		const loadProjectButton = document.getElementById("loadProject");
		loadProjectButton.addEventListener("click", event => {
			const name = window.prompt("project name", SDConnector.project);
			if (name) {
				createProject(name);
			}
		});
		const reindexProjectButton = document.getElementById("reindexProject");
		reindexProjectButton.addEventListener("click", event => {
			reindexProject();
		});
		const assignParamsButton = document.getElementById("assignParams");
		assignParamsButton.addEventListener("click", event => {
			assignParams();
		});
		const renameProjectButton = document.getElementById("renameProject");
		renameProjectButton.addEventListener("click", event => {
			const name = window.prompt("new project name", SDConnector.project);
			if (name) {
				renameProject(name);
			}
		});
		projectList.addEventListener("change", event => {
			loadProject(projectList.value);
		});
		upscalerList.addEventListener("change", event => {
			if (upscalerList.value) {
				upscaleSelection(upscalerList.value);
			}
		});
		const importInput: any = document.createElement("input");
		importInput.type = "file";
		importInput.accept = "image/*";
		importInput.multiple = true;
		importInput.addEventListener("change", event => importSelectedImages(importInput));
		const importImagesButton = document.getElementById("importImages");
		importImagesButton.addEventListener("click", event => importInput.click());
		document.body.addEventListener("dragover", event => checkImageDrag(event));
		document.body.addEventListener("drop", event => importDroppedImages(event));

		const savePresetButton = document.getElementById("savePreset");
		savePresetButton.addEventListener("click", event => {
			const name = window.prompt("preset name");
			if (name) {
				savePreset(name);
			}
		});
		presetList.addEventListener("change", event => {
			const preset = presetsByName.get(presetList.value);
			if (preset) {
				applyParameters(preset);
			}
		});
	}

	function loadProject(projectName: string): void {
		window.location.href = `?p=${projectName}`;
	}

	async function createProject(name: string): Promise<void> {
		const IDs = Array.from(selectedIDs);
		if (IDs.length) {
			try {
				await SDConnector.createProject(name, IDs);
			} catch (error) {
				console.warn("Unable to create project.");
				console.trace(error);
			}
		}
		loadProject(name);
	}

	async function renameProject(name: string): Promise<void> {
		try {
			await SDConnector.renameProject(name);
		} catch (error) {
			console.warn("Unable to rename project.");
			console.trace(error);
			return;
		}
		loadProject(name);
	}

	async function reindexProject(): Promise<void> {
		try {
			await SDConnector.reindexProject();
		} catch (error) {
			console.warn("Unable to reindex project.");
			console.trace(error);
			return;
		}
		// Reindexing gives the entries new IDs, so the cached wrappers would keep
		// showing whatever entry held their ID before.
		wrappers.clear();
		genDataByID.clear();
		selectedIDs.clear();
		selectionAnchor = null;
		container.replaceChildren();
		pollHistory();
	}

	// Write the parameters currently in the UI onto the selected images.
	async function assignParams(): Promise<void> {
		const IDs = Array.from(selectedIDs);
		if (IDs.length == 0) {
			return;
		}
		try {
			await SDConnector.assignParams(IDs, collectTaskData());
		} catch (error) {
			console.warn("Unable to assign parameters.");
			console.trace(error);
			return;
		}
		await pollHistory();
		for (const ID of IDs) {
			const genData = genDataByID.get(ID);
			const task = wrappers.get(ID);
			if (genData && task) {
				task.refresh(genData);
			}
		}
		applySelection(new Set(IDs));
	}

	async function loadServer() {
		await loadSettings();
		await loadProjects();
		await loadUpscalers();
		await loadPresets();
		await pollHistory();
	}

	async function loadSettings() {
		try {
			const settings = await SDConnector.getSettings();
			addGroupsTo(settings.models, document.getElementById("model"));
			addGroupsTo(settings.models, document.getElementById("refinerModel"));
			addGroupsTo(settings.LoRAs, document.getElementById("LoRA0Model"));
			addGroupsTo(settings.LoRAs, document.getElementById("LoRA1Model"));
			addGroupsTo(settings.LoRAs, document.getElementById("LoRA2Model"));
			addGroupsTo(settings.controls, document.getElementById("control0Model"));
			addGroupsTo(settings.controls, document.getElementById("control1Model"));
			addGroupsTo(settings.controls, document.getElementById("control2Model"));
			addGroupsTo(settings.samplers, document.getElementById("sampler"));
			const combinedArea = document.getElementById("combined") as HTMLTextAreaElement;
			combinedArea.rows = settings.combinedLines;
			// const positiveArea = document.getElementById("positive") as HTMLTextAreaElement;
			// positiveArea.rows = settings.positiveLines;
			// const negativeArea = document.getElementById("negative") as HTMLTextAreaElement;
			// negativeArea.rows = settings.negativeLines;
			modelCatalogue = createCatalogue("models", settings.models, CKPTCatalogue);
			loraCatalogue = createCatalogue("LoRAs", settings.LoRAs, CKPTCatalogue);
			controlCatalogue = createCatalogue("controls", settings.controls, CKPTCatalogue);
			samplerCatalogue = createCatalogue("samplers", settings.samplers, SimpleCatalogue);
			commandEngine = new SDCommandEngine();
		} catch (error) {
			console.warn("Unable to load settings.");
			console.trace(error);
		}
	}

	function addGroupsTo(groups: any, target: HTMLElement): void {
		for (const key in groups) {
			const optgroup = document.createElement("optgroup");
			optgroup.label = key;
			const options = groups[key];
			addOptionsTo(options, optgroup);
			target.appendChild(optgroup);
		}
	}

	function addOptionsTo(options: any, target: HTMLElement): void {
		for (const key in options) {
			const option = document.createElement("option");
			option.textContent = key;
			option.value = options[key];
			target.appendChild(option);
		}
	}

	interface ProjectNode {
		path: string;
		items: string[];
		folders: Map<string, ProjectNode>;
	}

	function populateProjects(projects: string[]): void {
		if (projects.includes(SDConnector.project) == false) {
			projects.push(SDConnector.project);
		}
		appendProjectNode(buildProjectTree(projects), projectList);
		selectCurrentProject();
	}

	function buildProjectTree(projects: string[]): ProjectNode {
		const result: ProjectNode = { path: "", items: [], folders: new Map() };
		for (const project of projects) {
			const parts = project.split("/");
			parts.pop();
			let path = "";
			let node = result;
			for (const part of parts) {
				path = path ? `${path}/${part}` : part;
				let child = node.folders.get(part);
				if (child == null) {
					child = { path, items: [], folders: new Map() };
					node.folders.set(part, child);
				}
				node = child;
			}
			node.items.push(project);
		}
		return result;
	}

	function appendProjectNode(node: ProjectNode, target: HTMLElement): void {
		for (const item of node.items.sort()) {
			const option = document.createElement("option");
			option.textContent = item.slice(item.lastIndexOf("/") + 1);
			option.value = item;
			target.appendChild(option);
		}
		for (const name of Array.from(node.folders.keys()).sort()) {
			const child = node.folders.get(name);
			const group = document.createElement("optgroup");
			const depth = child.path.split("/").length - 1;
			group.label = "\u00A0\u00A0".repeat(depth) + name;
			projectList.appendChild(group);
			appendProjectNode(child, group);
		}
	}

	function selectCurrentProject(): void {
		projectList.value = SDConnector.project;
	}

	function createCatalogue(name: string, categories: any, CatalogueType: any): any {
		const map = { disabled: null };
		if (categories) {
			categories = Object.values(categories);
			for (const category of categories) {
				for (const key in category) {
					const dashed = key.replace(/[\s:+]+/g, "-");
					map[dashed] = category[key];
				}
			}
		}
		return new CatalogueType(name, map);
	}

	async function loadProjects() {
		try {
			populateProjects(await SDConnector.getProjects());
		} catch (error) {
			console.warn("Unable to load projects.");
			console.trace(error);
		}
	}

	async function loadUpscalers() {
		try {
			populateUpscalers(await SDConnector.getUpscalers());
		} catch (error) {
			console.warn("Unable to load upscalers.");
			console.trace(error);
		}
	}

	function populateUpscalers(upscalers: string[]): void {
		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = "select";
		upscalerList.appendChild(placeholder);
		for (const name of upscalers) {
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name;
			upscalerList.appendChild(option);
		}
	}

	async function loadPresets() {
		try {
			populatePresets(await SDConnector.getPresets());
		} catch (error) {
			console.warn("Unable to load presets.");
			console.trace(error);
		}
	}

	function populatePresets(presets: any): void {
		presetsByName.clear();
		presetList.innerHTML = "";
		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = "select";
		presetList.appendChild(placeholder);
		for (const name in presets) {
			presetsByName.set(name, presets[name]);
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name;
			presetList.appendChild(option);
		}
	}

	async function savePreset(presetName: string): Promise<void> {
		try {
			populatePresets(await SDConnector.savePreset(presetName, createTaskData()));
		} catch (error) {
			console.warn("Unable to save preset.");
			console.trace(error);
		}
	}

	async function upscaleSelection(model: string): Promise<void> {
		for (const ID of selectedIDs) {
			const genData = genDataByID.get(ID);
			if (genData) {
				const taskData = { ...genData.taskData as GenParam, type: "upscale" };
				taskData.sourceImage = `${SDConnector.project}/${genData.imageName.split("?")[0]}`;
				taskData.upscaleModel = model;
				await submitTask(taskData);
			}
		}
		upscalerList.value = "";
		pollHistory();
	}

	let importing = false;

	async function importSelectedImages(input: any): Promise<void> {
		await importImages(input.files);
		input.value = "";
	}

	async function importImages(files: FileList | File[]): Promise<void> {
		importing = true;
		document.body.style.pointerEvents = "none";
		document.body.style.opacity = "0.5";
		try {
			const images = [];
			for (let i = 0; i < files.length; ++i) {
				images.push(await readImage(files[i]));
			}
			if (images.length) {
				const entries = await SDConnector.importImages(images);
				renderGenerated(entries);
			}
		} catch (error) {
			console.warn("Unable to import images.");
			console.trace(error);
		} finally {
			importing = false;
			document.body.style.pointerEvents = "";
			document.body.style.opacity = "";
		}
	}

	function checkImageDrag(event: DragEvent): void {
		if (importing) {
			return;
		}
		if (Array.from(event.dataTransfer.types).indexOf("Files") >= 0) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}
	}

	function importDroppedImages(event: DragEvent): void {
		const files = collectImageFiles(event.dataTransfer.files);
		if (files.length == 0) {
			return;
		}
		event.preventDefault();
		if (importing) {
			return;
		}
		importImages(files);
	}

	function collectImageFiles(files: FileList): File[] {
		const result: File[] = [];
		for (let i = 0; i < files.length; ++i) {
			const file = files[i];
			if (file.type.startsWith("image/")) {
				result.push(file);
			}
		}
		return result;
	}

	function readImage(file: File): Promise<any> {
		return new Promise(resolve => {
			const reader = new FileReader();
			reader.addEventListener("load", event => {
				const url = String(reader.result);
				const data = url.split(",")[1];
				const metadata = readImageMetadata(data);
				const image = new Image();
				image.addEventListener("load", () => resolve({ data, width: image.naturalWidth, height: image.naturalHeight, metadata }));
				image.addEventListener("error", () => resolve({ data, width: 512, height: 512, metadata }));
				image.src = url;
			});
			reader.readAsDataURL(file);
		});
	}

	function readImageMetadata(data: string): ExtractedImageMetadata {
		try {
			return ImageMetadataUtil.extract(decodeBase64(data));
		} catch {
			return {};
		}
	}

	function decodeBase64(data: string): Uint8Array {
		const binary = atob(data);
		const result = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; ++i) {
			result[i] = binary.charCodeAt(i);
		}
		return result;
	}

	function initKeyboard(): void {
		document.addEventListener("keydown", event => {
			const target = event.target as HTMLElement;
			if (target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.tagName == "SELECT") {
				return;
			}
			if (event.key == " ") {
				togglePreview();
				event.preventDefault();
			} else if (event.key == "Backspace" || event.key == "Delete") {
				if (event.ctrlKey || event.metaKey) {
					removeSelection();
					event.preventDefault();
				}
			} else if (event.key == "ArrowLeft" || event.key == "ArrowRight" || event.key == "ArrowUp" || event.key == "ArrowDown") {
				if (document.querySelector(".FullScreen")) {
					return;
				}
				const vertical = event.key == "ArrowUp" || event.key == "ArrowDown";
				const forward = event.key == "ArrowRight" || event.key == "ArrowDown";
				if (event.shiftKey) {
					expandSelection(vertical, forward);
				} else if (event.ctrlKey || event.metaKey) {
					moveSelection(vertical, forward);
				} else {
					shiftSelection(vertical, forward);
				}
				event.preventDefault();
			}
		});
	}

	async function initWakeLock() {
		try {
			await navigator.wakeLock.request("screen");
		} catch (error) {
			console.warn("Locking screen failed.");
		}
	}

	initCollapsibleGroups();
	initCombinedInputs();
	initControlInterface();
	initKeyboard();
	loadServer();
	initWakeLock();
}