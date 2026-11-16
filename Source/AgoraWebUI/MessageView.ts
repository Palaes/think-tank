/// <reference path="../Common/TextUtil.ts" />
/// <reference path="./LinkUtil.ts" />
/// <reference path="./ServerTypes.ts" />

class MessageView {
	private static readonly documentLineCount = 10;
	private static readonly documentLineLength = 300;
	private static readonly legacyImageExts = [ "jpeg", "png" ];

	private chatMessage: ContextEntry;
	private wrapperElement: HTMLElement;
	private labelElement: HTMLElement;
	private contentElement: HTMLElement = null;
	private imageElement: HTMLImageElement = null;
	private imageLink: HTMLAnchorElement = null;
	private tailElement: Text;
	private hasHeader = false;
	private pendingText = "";
	private legacyImageIndex = 0;
	private imageFailed = false;
	private imageTriedFull = false;

	public constructor(chatMessage: ContextEntry, extraContent = "") {
		this.chatMessage = chatMessage;

		this.wrapperElement = document.createElement("span");
		this.wrapperElement.classList.add("messageWrapper");
		this.wrapperElement.classList.add(`type-${chatMessage.type}`);
		if (chatMessage.role) {
			this.wrapperElement.classList.add(`role-${chatMessage.role}`);
		}
		if (chatMessage.name == "raw") {
			this.wrapperElement.classList.add("data-raw");
		}

		// Raw images are rendered from their base64 content instead of as text,
		// saved images from their small variant in the image library.
		const isRawImage = chatMessage.type == "image" && chatMessage.name == "raw";
		const isSavedImage = chatMessage.type == "image" && chatMessage.name != "raw";
		if (isRawImage) {
			this.imageElement = document.createElement("img");
			this.imageElement.src = "data:image;base64," + chatMessage.content;
			this.wrapperElement.appendChild(this.imageElement);
		} else if (isSavedImage) {
			this.imageLink = document.createElement("a");
			this.imageLink.target = "_blank";
			this.imageElement = document.createElement("img");
			this.imageLink.appendChild(this.imageElement);
			this.wrapperElement.appendChild(this.imageLink);
		}

		const label = this.labelText(chatMessage);
		if (label) {
			this.labelElement = document.createElement("span");
			this.labelElement.classList.add("messageHeader");
			this.labelElement.innerText = label;
			this.wrapperElement.appendChild(this.labelElement);
		}

		this.hasHeader = label != "" || extraContent != "";
		if (extraContent) {
			if (label) {
				this.wrapperElement.appendChild(document.createTextNode("\n"));
			}
			this.wrapperElement.appendChild(document.createTextNode(extraContent));
		}

		this.tailElement = document.createTextNode("\n\n");
		this.wrapperElement.appendChild(this.tailElement);

		// The image is resolved only after the tail exists, so a fast failure can
		// still place the fallback text before it.
		if (isSavedImage) {
			this.renderImage();
		}
		// Raw images are rendered by the <img> element alone, so they get no content block.
		if (!isRawImage && !isSavedImage) {
			if (chatMessage.type == "document") {
				if (this.isRawDocument(chatMessage) || chatMessage.content) {
					this.renderDocument(chatMessage);
				} else {
					this.setupDocument(chatMessage);
				}
			} else {
				this.renderText(chatMessage.content);
			}
		}
	}

	private labelText(chatMessage: ContextEntry): string {
		// Info blocks are pure narration, so they carry no header of their own.
		if (chatMessage.role == "info") {
			return "";
		}
		if (chatMessage.type == "message") {
			return chatMessage.name ? `### ${chatMessage.name}:` : "";
		}
		return "";
	}

	private isRawDocument(chatMessage: ContextEntry): boolean {
		return chatMessage.type == "document" && chatMessage.name == "raw";
	}

	// Raw documents are shortened; saved documents carry their long description.
	private entryTitle(chatMessage: ContextEntry): string {
		if (this.isRawDocument(chatMessage)) {
			return "RAW Document";
		}
		return chatMessage.name;
	}

	private entryContent(chatMessage: ContextEntry): string {
		if (this.isRawDocument(chatMessage)) {
			return this.shortenDocument(chatMessage.content);
		}
		return chatMessage.content;
	}

	private shortenDocument(content: string): string {
		return TextUtil.shortifyTextNicely(content, MessageView.documentLineCount, MessageView.documentLineLength);
	}

	// The context stores the whole original file name; the thumbnail is its
	// small variant. Older entries carried both names in the content.
	private renderImage(): void {
		const files = this.resolveImageFiles();
		if (files == null) {
			this.renderLegacyImage();
			return;
		}
		this.imageLink.href = `/ui/images/${encodeURIComponent(files.original)}`;
		this.imageElement.onerror = () => {
			if (this.imageTriedFull == false && files.original != files.small) {
				this.imageTriedFull = true;
				this.imageElement.src = `/ui/images/${encodeURIComponent(files.original)}`;
			} else {
				this.failImage();
			}
		};
		this.imageElement.src = `/ui/images/${encodeURIComponent(files.small)}`;
	}

	private resolveImageFiles(): { small: string, original: string } {
		const name = this.chatMessage.name;
		if (name && name.indexOf(".original.") >= 0) {
			return { small: name.replace(".original.", ".small."), original: name };
		}
		if (this.isImageFileName(name)) {
			const dot = name.lastIndexOf(".");
			return { small: `${name.slice(0, dot)}.small${name.slice(dot)}`, original: name };
		}
		const lines = this.chatMessage.content.split("\n");
		if (this.isImageFileName(lines[0])) {
			const small = lines[0];
			const original = this.isImageFileName(lines[1]) ? lines[1] : small;
			return { small, original };
		}
		return null;
	}

	private isImageFileName(name: string): boolean {
		return /\.(jpeg|png|webp|gif)$/i.test(name ?? "");
	}

	// Entries saved before the file names were stored name only the catalogue
	// entry, so the variants are tried by their two known extensions.
	private renderLegacyImage(): void {
		if (this.legacyImageIndex >= MessageView.legacyImageExts.length) {
			this.failImage();
			return;
		}
		const ext = MessageView.legacyImageExts[this.legacyImageIndex];
		const small = `${this.chatMessage.name}.small.${ext}`;
		const original = `${this.chatMessage.name}.original.${ext}`;
		this.imageElement.onerror = () => {
			++this.legacyImageIndex;
			this.renderLegacyImage();
		};
		this.imageElement.src = `/ui/images/${encodeURIComponent(small)}`;
		this.imageLink.href = `/ui/images/${encodeURIComponent(original)}`;
	}

	// A missing image falls back to the document shape: name and description.
	private failImage(): void {
		this.imageFailed = true;
		this.imageElement.onerror = null;
		if (this.imageLink) {
			this.imageLink.remove();
		} else {
			this.imageElement.remove();
		}
		this.renderDocument(this.chatMessage);
	}

	public getMessage(): ContextEntry {
		return this.chatMessage;
	}

	public getElement(): HTMLElement {
		return this.wrapperElement;
	}

	// Replaces the content with freshly rendered, linkified text.
	private renderText(text: string): void {
		if (text == "") {
			return;
		}
		this.ensureContent();
		this.contentElement.textContent = "";
		appendTextSegments(this.contentElement, linkifyText(text));
	}

	// Document blocks lead with a bold title and a blank line before the body.
	private renderDocument(chatMessage: ContextEntry): void {
		this.renderEntryText(this.entryTitle(chatMessage), this.entryContent(chatMessage));
	}

	// A streamed document gets the title first and appends its body chunks.
	private setupDocument(chatMessage: ContextEntry): void {
		this.ensureContent();
		this.contentElement.textContent = "";
		const title = this.entryTitle(chatMessage);
		if (title) {
			const titleElement = document.createElement("strong");
			titleElement.classList.add("messageTitle");
			titleElement.textContent = title;
			this.contentElement.appendChild(titleElement);
			this.contentElement.appendChild(document.createTextNode("\n\n"));
		}
	}

	private renderEntryText(title: string, content: string): void {
		if (title == "" && content == "") {
			return;
		}
		this.ensureContent();
		this.contentElement.textContent = "";
		if (title) {
			const titleElement = document.createElement("strong");
			titleElement.classList.add("messageTitle");
			titleElement.textContent = title;
			this.contentElement.appendChild(titleElement);
			this.contentElement.appendChild(document.createTextNode("\n\n"));
		}
		appendTextSegments(this.contentElement, linkifyText(content));
	}

	// Appends what is safe to show, holding back a possible unfinished link.
	private renderPending(): void {
		this.ensureContent();
		const hold = pendingLinkStart(this.pendingText);
		appendTextSegments(this.contentElement, linkifyText(this.pendingText.slice(0, hold)));
		this.pendingText = this.pendingText.slice(hold);
	}

	private ensureContent(): void {
		if (this.contentElement == null) {
			this.contentElement = document.createElement("span");
			this.contentElement.classList.add("messageContent");
			if (this.hasHeader) {
				this.wrapperElement.insertBefore(document.createTextNode("\n\n"), this.tailElement);
			}
			this.wrapperElement.insertBefore(this.contentElement, this.tailElement);
		}
	}

	// Renders text held back while waiting for a link to complete.
	public flush(): void {
		if (this.contentElement && this.pendingText) {
			appendTextSegments(this.contentElement, linkifyText(this.pendingText));
			this.pendingText = "";
		}
	}

	public appendChunk(chunk: string): void {
		// Streamed entries arrive empty, so accumulate on the message to keep getMessage() in sync.
		this.chatMessage.content += chunk;
		if (this.chatMessage.type == "image") {
			if (this.chatMessage.name == "raw") {
				this.imageElement.src = "data:image;base64," + this.chatMessage.content;
			} else if (this.imageFailed) {
				this.renderDocument(this.chatMessage);
			}
			return;
		}
		// Documents re-render as their long description streams in.
		if (this.chatMessage.type == "document") {
			if (this.isRawDocument(this.chatMessage)) {
				this.renderDocument(this.chatMessage);
			} else {
				this.pendingText += chunk;
				this.renderPending();
			}
			return;
		}
		// Text is accumulated and appended, never read back from the DOM.
		this.pendingText += chunk;
		this.renderPending();
	}
}
