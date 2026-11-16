/// <reference path="./InputDisabler.ts" />
/// <reference path="../Common/TextEditor.ts" />

type SendState = "idle" | "active" | "raised" | "aborted";

class ChatInput {
	private parent: AgoraUI;

	private messageInput: HTMLTextAreaElement;
	private tryAgainButton: HTMLButtonElement;
	private editLastButton: HTMLButtonElement;
	private attachButton: HTMLButtonElement;
	private sendButton: HTMLButtonElement;

	private state: SendState = "idle";
	private archived = false;

	private attachInput: HTMLInputElement;
	private documents: string[] = [];
	private images: string[] = [];

	public constructor(
		parent: AgoraUI,
		messageInput: HTMLTextAreaElement,
		tryAgainButton: HTMLButtonElement,
		editLastButton: HTMLButtonElement,
		attachButton: HTMLButtonElement,
		sendButton: HTMLButtonElement
	) {
		this.parent = parent;
		this.messageInput = messageInput;
		this.tryAgainButton = tryAgainButton;
		this.editLastButton = editLastButton;
		this.attachButton = attachButton;
		this.sendButton = sendButton;

		const disabler = this.parent.getDisabler();

		disabler.addInput(tryAgainButton);
		disabler.addInput(editLastButton);
		disabler.addInput(attachButton);

		disabler.addInput(sendButton, () => this.updateSend());

		this.tryAgainButton.addEventListener("click", this.onTryAgain);
		this.editLastButton.addEventListener("click", this.onEditLast);
		this.attachButton.addEventListener("click", this.onAttach);
		this.sendButton.addEventListener("click", this.onSend);
		this.messageInput.addEventListener("keydown", this.onKeyDown);
		TextEditor.bind(this.messageInput);

		this.attachInput = document.createElement("input");
		this.attachInput.type = "file";
		this.attachInput.multiple = true;
		this.attachInput.addEventListener("change", this.onFileSelect);

		window.addEventListener("dragover", this.onDragOver);
		window.addEventListener("drop", this.onDrop);

		this.updateSend();
	}

	private onTryAgain = async () => {
		await this.parent.onTryAgain();
	}

	private onKeyDown = (event: KeyboardEvent) => {
		// the editor chords belong to the text area
		if (TextEditor.isChord(event)) {
			return;
		}
		if (event.key == "ArrowUp" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			this.onEditLast();
			return;
		}
		if (event.key == "ArrowDown" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			this.onTryAgain();
			return;
		}
		if (event.key == "Enter" && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			this.onSend();
		}
	}

	// TODO: Implement disabler here.
	private onEditLast = async () => {
		await this.parent.onEditLast();
	}

	private onAttach = async () => {
		if (this.images.length || this.documents.length) {
			this.clearAttached();
		} else {
			this.attachInput.click();
		}
	};

	private onDragOver = (event: DragEvent) => {
		if (event.dataTransfer.types.includes("Files")) {
			event.preventDefault();
		}
	};

	private onDrop = (event: DragEvent) => {
		if (event.dataTransfer.files.length == 0) {
			return;
		}
		event.preventDefault();
		this.addFiles(event.dataTransfer.files);
	};

	private onSend = async () => {
		if (this.archived) {
			return;
		}
		if (this.state == "active") {
			this.state = "raised";
			this.updateSend();
			await this.parent.raiseHand();
			return;
		}
		if (this.state == "raised") {
			this.state = "aborted";
			this.updateSend();
			await this.parent.abort();
			return;
		}
		if (this.state == "aborted") {
			return;
		}
		const content = this.messageInput.value;
		const documents = this.documents;
		const images = this.images;
		this.clearMessage();
		this.clearAttached();
		this.state = "active";
		this.updateSend();
		try {
			await this.parent.onSend(content, images, documents);
		} finally {
			this.state = "idle";
			this.updateSend();
		}
	};

	private updateSend(): void {
		if (this.archived || this.state == "idle") {
			this.sendButton.textContent = "send";
			this.sendButton.classList.remove("stop");
		} else if (this.state == "active") {
			this.sendButton.textContent = "hand";
			this.sendButton.classList.remove("stop");
		} else {
			this.sendButton.textContent = "stop";
			this.sendButton.classList.add("stop");
		}
	}

	private onFileSelect = async () => {
		this.addFiles(this.attachInput.files);
	}

	private addFiles(files: FileList): void {
		for (const file of files) {
			if (file.type.startsWith("image/")) {
				const reader = new FileReader();
				reader.addEventListener("load", event => this.onImageRead(file.name, file.type, event.target ? event.target.result : null));
				reader.readAsDataURL(file);
			} else {
				const reader = new FileReader();
				reader.addEventListener("load", event => this.onDocumentRead(file.name, file.type, event.target ? event.target.result : null));
				reader.readAsText(file);
			}
		}
	}

	// The original extension wins over the MIME subtype, so a markdown file
	// stays `.md` instead of becoming `.markdown`.
	private static detectExtension(name: string, type: string): string {
		const dot = (name ?? "").lastIndexOf(".");
		if (dot > 0 && dot < name.length - 1) {
			return name.slice(dot + 1).toLowerCase();
		}
		return type.split("/")[1] ?? type;
	}

	private onImageRead(name: string, type: string, data: any): void {
		if (typeof data == "string") {
			const ext = ChatInput.detectExtension(name, type);
			this.images.push(`ext=${ext}\ndata=${data.split(",")[1]}`);
			this.updateAttached();
		}
	}

	private onDocumentRead(name: string, type: string, data: any): void {
		if (typeof data == "string") {
			const ext = ChatInput.detectExtension(name, type);
			this.documents.push(`ext=${ext}\ndata=${data}`);
			this.updateAttached();
		}
	}

	private clearMessage(): void {
		this.messageInput.value = "";
	}

	public begin(): void {
		this.state = "active";
		this.updateSend();
	}

	public end(): void {
		this.state = "idle";
		this.updateSend();
	}

	// An archived chat keeps its transcript but cannot take messages.
	public setArchived(archived: boolean): void {
		this.archived = archived;
		if (archived) {
			this.state = "idle";
		}
		this.updateSend();
		if (archived) {
			this.sendButton.disabled = true;
			this.sendButton.style.pointerEvents = "none";
			this.sendButton.style.cursor = "default";
			this.sendButton.style.opacity = "0.5";
		} else {
			this.sendButton.disabled = false;
			this.sendButton.style.pointerEvents = "";
			this.sendButton.style.cursor = "";
			this.sendButton.style.opacity = "";
		}
	}

	// Restores a removed user message into the input, attachments included.
	public setMessage(message: UserMessageData): void {
		this.messageInput.value = message.content ?? "";
		this.attachInput.value = "";
		this.images = message.images ?? [];
		this.documents = message.documents ?? [];
		this.updateAttached();
	}

	private updateAttached(): void {
		const count = this.images.length + this.documents.length;
		if (count) {
			this.attachButton.textContent = `remove (${count})`;
		} else {
			this.attachButton.textContent = "attach";
		}
	}

	private clearAttached(): void {
		this.attachButton.textContent = "attach";
		this.attachInput.value = "";
		this.documents = [];
		this.images = [];
	}
}