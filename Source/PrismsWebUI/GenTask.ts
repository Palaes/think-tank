/// <reference path="Movement.ts" />
/// <reference path="GenParam.ts" />
/// <reference path="UIUtil.ts" />
/// <reference path="SDConnector.ts" />
/// <reference path="SDControl.ts" />

namespace TaskUtil {
	const touchDevice = window.matchMedia("(hover: none)").matches;

	function addFlexStyle(element: HTMLElement, taskData: GenParam): void {
		const width = taskData.width || 512;
		const height = taskData.height || 512;
		let minWidth = Math.max(150, 150 * width / height);
		let maxWidth = Math.min(800, 500 * width / height);
		let initialWidth = Math.max(250, 250 * width / height, Math.sqrt(80000 * width / height));
		initialWidth = Math.max(minWidth, Math.min(maxWidth, initialWidth));
		maxWidth = Math.max(initialWidth, 800 * width / height);
		element.style.width = `${initialWidth}px`;
		element.style.maxWidth = `${maxWidth}px`;
		element.style.minHeight = `135px`;
		element.style.aspectRatio = `${width} / ${height}`;
		element.style.flexGrow = `${initialWidth}`;
		element.style.flexShrink = `${initialWidth}`;
	}

	function addHeader(container: HTMLElement, parent: HTMLElement, taskData: GenParam, moveCallback: any, removeCallback: any): void {
		const header = document.createElement("div");
		header.classList.add("itemHeader");
		parent.appendChild(header);

		UIUtil.addCopyPromptIcon(header, taskData, event => {
			SDControl.applyParameters({
				positivePrompt: taskData.positivePrompt,
				negativePrompt: taskData.negativePrompt
			});
			event.stopPropagation();
		});

		UIUtil.addCopySeedIcon(header, taskData, event => {
			SDControl.applyParameters({
				seed: taskData.seed
			});
			event.stopPropagation();
		});

		UIUtil.addCopyParamIcon(header, taskData, event => {
			SDControl.applyParameters({
				...taskData,
				combinedPrompt: undefined,
				positivePrompt: undefined,
				negativePrompt: undefined,
				batchCount: undefined,
				seed: undefined
			});
			event.stopPropagation();
		});

		UIUtil.addIconSpacer(header);

		if (moveCallback) {
			UIUtil.addNextIcon(header, event => {
				const prev = parent.previousElementSibling;
				if (prev) {
					if (prev.classList.contains("imageWrapper")) {
						moveCallback(Movement.NEXT);
						container.insertBefore(parent, prev);
					} else if (prev.classList.contains("error")) {
						container.insertBefore(parent, prev);
					}
				}
				event.stopPropagation();
			});

			UIUtil.addPrevIcon(header, event => {
				const next = parent.nextElementSibling;
				if (next) {
					if (next.classList.contains("imageWrapper")) {
						moveCallback(Movement.PREV);
						container.insertBefore(next, parent);
					} else if (next.classList.contains("error")) {
						container.insertBefore(next, parent);
					}
				}
				event.stopPropagation();
			});
		}

		if (removeCallback) {
			UIUtil.addRemoveIcon(header, event => {
				removeCallback();
				event.stopPropagation();
			});
		}
	}

	function createGenericWrapper(container: HTMLElement, taskData: GenParam, moveCallback: any, removeCallback: any): HTMLElement {
		const result = document.createElement("div");
		addFlexStyle(result, taskData);
		addHeader(container, result, taskData, moveCallback, removeCallback);
		return result;
	}

	// TODO: It might be worth creating this callback only once.
	function addClickHandler(target: HTMLElement, taskData: GenParam): void {
		target.addEventListener("click", event => {
			SDControl.applyParameters(taskData);
			event.stopPropagation();
		});
	}

	// Pick the wrapper for a catalogue entry by its status.
	export function createWrapper(container: HTMLElement, genData: GenData): HTMLElement {
		switch (genData.status) {
			case "pending":
				return createWaitingWrapper(container, genData);
			case "ongoing":
				return createRunningWrapper(container, genData);
			case "error":
				return createErrorWrapper(container, genData);
		}
		return createImageWrapper(container, genData);
	}

	export function createWaitingWrapper(container: HTMLElement, genData: GenData): HTMLElement {
		const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
		result.classList.add("itemWrapper");

		const content = document.createElement("div");
		content.classList.add("itemContent");
		content.textContent = UIUtil.waitingText(genData.taskData);
		addClickHandler(content, genData.taskData);
		result.appendChild(content);

		return result;
	}

	export function createRunningWrapper(container: HTMLElement, genData: GenData): HTMLElement {
		const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
		result.classList.add("itemWrapper");
		result.classList.add("running");

		const content = document.createElement("div");
		content.classList.add("itemContent");
		addClickHandler(content, genData.taskData);
		result.appendChild(content);

		content.innerText = UIUtil.runningText(progressOf(genData).seconds, progressOf(genData).percentage, genData.taskData);

		return result;
	}

	export function updateRunningWrapper(wrapper: HTMLElement, genData: GenData): void {
		const content = wrapper.querySelector(".itemContent") as HTMLElement;
		if (content) {
			content.innerText = UIUtil.runningText(progressOf(genData).seconds, progressOf(genData).percentage, genData.taskData);
		}
	}

	export function createErrorWrapper(container: HTMLElement, genData: GenData): HTMLElement {
		const result = createGenericWrapper(container, genData.taskData, null, () => SDControl.removeTask(genData.ID));
		result.classList.add("itemWrapper");
		result.classList.add("error");

		const content = document.createElement("div");
		content.classList.add("itemContent");
		content.textContent = UIUtil.errorText(genData.taskData);
		addClickHandler(content, genData.taskData);
		result.appendChild(content);

		return result;
	}

	export function createImageWrapper(container: HTMLElement, genData: GenData): HTMLElement {
		const result = createGenericWrapper(container, genData.taskData, (movement: Movement) => SDConnector.moveGen(genData.ID, movement), () => SDControl.removeTask(genData.ID));
		result.classList.add("imageWrapper");

		const image = document.createElement("img");
		image.src = SDConnector.imageURL(genData.imageName);
		result.appendChild(image);

		const content = document.createElement("div");
		content.classList.add("itemContent");
		content.textContent = UIUtil.imageText(genData.genTime / 1000, genData.taskData);
		addClickHandler(content, genData.taskData);
		result.firstChild.appendChild(content);

		result.addEventListener("click", event => {
			event.stopPropagation();
			if (touchDevice) {
				const selected = SDControl.toggleSelection(genData);
				result.classList.toggle("selected", selected);
				return;
			}
			if (event.shiftKey) {
				SDControl.selectRange(genData);
				return;
			}
			if (event.ctrlKey || event.metaKey) {
				const selected = SDControl.toggleSelection(genData);
				result.classList.toggle("selected", selected);
				return;
			}
			if (event.altKey) {
				toggleFullScreen(result);
				return;
			}
			const selected = SDControl.selectExclusive(genData);
			result.classList.toggle("selected", selected);
		});

		document.addEventListener("keydown", event => {
			if (result.classList.contains("FullScreen")) {
				if (event.key == "ArrowLeft") {
					const prevElement = result.previousElementSibling;
					if (prevElement) {
						if (prevElement.classList.contains("imageWrapper")) {
							prevElement.classList.add("FullScreen");
							result.classList.remove("FullScreen");
							event.stopImmediatePropagation();
							event.preventDefault();
						}
					}
				} else if (event.key == "ArrowRight") {
					const nextElement = result.nextElementSibling;
					if (nextElement) {
						if (nextElement.classList.contains("imageWrapper")) {
							nextElement.classList.add("FullScreen");
							result.classList.remove("FullScreen");
							event.stopImmediatePropagation();
							event.preventDefault();
						}
					}
				}
			}
		});

		return result;
	}

	function toggleFullScreen(result: HTMLElement): void {
		if (result.classList.contains("FullScreen")) {
			result.classList.remove("FullScreen");
		} else {
			result.classList.add("FullScreen");
		}
	}

	function progressOf(genData: GenData): TaskProgress {
		return genData.progress || { seconds: 0, percentage: 0 };
	}
}

// A view of one catalogue entry, rebuilt in place when its status changes.
class GenTask {
	public readonly ID: number;
	public status: JobStatus;
	public wrapper: HTMLElement;

	private container: HTMLElement;

	public constructor(container: HTMLElement, genData: GenData) {
		this.container = container;
		this.ID = genData.ID;
		this.status = null;
		this.wrapper = null;
		this.update(genData);
	}

	public update(genData: GenData): void {
		if (genData.status === this.status) {
			if (genData.status == "ongoing") {
				TaskUtil.updateRunningWrapper(this.wrapper, genData);
			}
			return;
		}
		this.refresh(genData);
	}

	public refresh(genData: GenData): void {
		const next = TaskUtil.createWrapper(this.container, genData);
		if (this.wrapper) {
			this.container.replaceChild(next, this.wrapper);
		}
		this.wrapper = next;
		this.status = genData.status;
	}
}
