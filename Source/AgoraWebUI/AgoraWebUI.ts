/// <reference path="./Interface.ts" />
/// <reference path="./InputDisabler.ts" />
/// <reference path="./ChatList.ts" />
/// <reference path="./MenuView.ts" />
/// <reference path="./ContextView.ts" />
/// <reference path="./ChatInput.ts" />
/// <reference path="./SpeechPlayer.ts" />
/// <reference path="../Common/FontUtil.ts" />

class AgoraUI {
	public bindAction(name: string, handler: any, useDisabler: boolean) {
		const button = document.getElementById(name);
		if (button) {
			button.addEventListener("click", handler);
			if (useDisabler) {
				this.disabler.addInput(button);
			}
		}
	}

	private disabler: InputDisabler;
	private chatList: ChatList;
	private menuView: MenuView;
	private contextView: ContextView;
	private chatInput: ChatInput;
	private chatTitle: HTMLElement;
	private menuButton: HTMLButtonElement;
	private speechPlayer = new SpeechPlayer();
	private chatMeta: ChatMeta;
	private combinedSettings: AgoraSettings = {};
	private chatPollInterval = 60000;

	// A view-owning operation blocks the UI and pauses the poll. Operations
	// queue behind each other, a poll tick only defers itself.
	private running = false;
	private pendingPoll = false;
	private tail: Promise<void> = Promise.resolve();

	public getChatMeta(): ChatMeta {
		return this.chatMeta;
	}

	public getDisabler(): InputDisabler {
		return this.disabler;
	}

	public async init() {
		FontUtil.applyChat();
		this.disabler = new InputDisabler();

		this.chatList = new ChatList(
			this,
			document.getElementById("chatList")
		);

		this.menuView = new MenuView(
			this,
			document.getElementById("menuBar")
		);

		this.bindAction("createButton", this.createChat, false);
		this.bindAction("renameButton", this.renameChat, true);
		this.bindAction("copyButton", this.copyChat, true);
		this.bindAction("clearButton", this.clearChat, true);
		this.bindAction("deleteButton", this.deleteChat, true);

		this.contextView = new ContextView(
			document.getElementById("contentWrapper"),
			document.getElementById("chatContent")
		);

		this.chatInput = new ChatInput(
			this,
			document.getElementById("messageInput") as HTMLTextAreaElement,
			document.getElementById("tryAgainButton") as HTMLButtonElement,
			document.getElementById("editLastButton") as HTMLButtonElement,
			document.getElementById("attachButton") as HTMLButtonElement,
			document.getElementById("sendButton") as HTMLButtonElement
		);

		this.chatTitle = document.getElementById("chatTitle");
		this.menuButton = document.getElementById("menuButton") as HTMLButtonElement;
		this.buildFontSelect();

		this.chatTitle.addEventListener("click", event => {
			event.stopPropagation();
			this.toggleSidebar("chatList");
		});

		this.menuButton.addEventListener("click", event => {
			event.stopPropagation();
			this.toggleSidebar("menu");
		});

		// a click on the main area slides the sidebars back in, on mobile
		document.getElementById("main").addEventListener("click", event => {
			if (this.isNarrow() && this.isAnySidebarOpen()) {
				event.stopPropagation();
				this.hideSidebars();
			}
		});

		this.applySidebarDefaults();
		await this.loadInitial();
		this.startChatPoll();
	}

	// the header offers the chat font, separate from the editor font
	private buildFontSelect(): void {
		const panel = document.getElementById("titlePanel");
		if (panel == null) {
			return;
		}
		const select = document.createElement("select");
		select.id = "fontSelect";
		for (const family of FontUtil.getFamilies()) {
			const option = document.createElement("option");
			option.innerText = family;
			option.value = family;
			select.appendChild(option);
		}
		select.value = FontUtil.readChat();
		select.addEventListener("change", () => FontUtil.writeChat(select.value));
		panel.insertBefore(select, this.menuButton);
	}

	// blockAll  fast, global or chat related: everything held back, no dim
	// blockLoad slow context load: list, title and context held back, the
	//           context dimmed, settings and the input panel stay live
	// blockRun  slow generation: list and title held back, the rest stays live
	private setBlockMode(mode: string): void {
		document.body.classList.remove("blockAll");
		document.body.classList.remove("blockLoad");
		document.body.classList.remove("blockRun");
		if (mode) {
			document.body.classList.add(mode);
		}
	}

	// A queued operation runs once everything before it has finished.
	private runBlocked(mode: string, action: () => Promise<void>): Promise<void> {
		const run = this.tail.then(() => this.enter(mode, action));
		this.tail = run.then(() => {}, () => {});
		return run;
	}

	private async enter(mode: string, action: () => Promise<void>): Promise<void> {
		this.running = true;
		this.setBlockMode(mode);
		try {
			await action();
		} finally {
			this.setBlockMode(null);
			this.running = false;
			if (this.pendingPoll) {
				this.pendingPoll = false;
				this.pollChatList();
			}
		}
	}

	private isNarrow(): boolean {
		return window.innerWidth <= 850;
	}

	private applySidebarDefaults(): void {
		if (this.isNarrow()) {
			this.setSidebar("chatList", false);
			this.setSidebar("menu", false);
			return;
		}
		// medium opens none, wide opens the chat list, widest opens both
		const chatList = this.readSidebarState("chatList") ?? window.innerWidth > 1100;
		const menu = this.readSidebarState("menu") ?? window.innerWidth > 1400;
		this.setSidebar("chatList", chatList);
		this.setSidebar("menu", menu);
	}

	private readSidebarState(name: string): boolean {
		const stored = localStorage.getItem(`sidebar.${name}`);
		if (stored) {
			return stored == "1";
		}
		return null;
	}

	private toggleSidebar(name: string): void {
		const open = !document.body.classList.contains(`${name}Visible`);
		if (open && this.isNarrow()) {
			// the narrow layout shows one panel at a time
			const other = name == "chatList" ? "menu" : "chatList";
			this.setSidebar(other, false);
		}
		this.setSidebar(name, open);
		if (this.isNarrow()) {
			return;
		}
		localStorage.setItem(`sidebar.${name}`, open ? "1" : "0");
	}

	private setSidebar(name: string, open: boolean): void {
		if (open) {
			document.body.classList.add(`${name}Visible`);
			document.body.classList.remove(`${name}Hidden`);
		} else {
			document.body.classList.add(`${name}Hidden`);
			document.body.classList.remove(`${name}Visible`);
		}
	}

	private isAnySidebarOpen(): boolean {
		return document.body.classList.contains("chatListVisible") || document.body.classList.contains("menuVisible");
	}

	private hideSidebars(): void {
		this.setSidebar("chatList", false);
		this.setSidebar("menu", false);
	}

	// The first block: build the list, land on the chat the user saw last, and
	// render it. Only then does the poll start.
	private async loadInitial(): Promise<void> {
		await this.runBlocked("blockAll", () => this.selectAndLoad());
	}

	// Reloads the list, creates a chat when there is none, and loads the pick.
	private async selectAndLoad(): Promise<void> {
		this.setBlockMode("blockAll");
		let chatMeta = await this.chatList.loadChatList();
		if (chatMeta == null) {
			await AgoraAPI.create();
			chatMeta = await this.chatList.loadChatList();
		}
		if (chatMeta) {
			this.setBlockMode("blockLoad");
			await this.loadChat(chatMeta);
		}
	}

	// Full load, for a chat that was not on screen.
	private async loadChat(chatMeta: ChatMeta): Promise<void> {
		this.chatMeta = chatMeta;
		this.disabler.selectGroup(chatMeta.chatID);
		this.chatList.selectChat(chatMeta.chatID);
		await this.menuView.loadMenu(chatMeta.chatID);
		await this.contextView.loadContext(chatMeta.chatID);
		await this.refreshTitle();
		if (this.isNarrow()) {
			this.hideSidebars();
		}
	}

	// Diffed load, for a chat already on screen that gained content. The
	// settings are cheap and are refreshed along with the context.
	private async updateChat(chatMeta: ChatMeta): Promise<void> {
		await this.menuView.loadMenu(chatMeta.chatID);
		await this.contextView.loadDiff(chatMeta.chatID);
		await this.refreshTitle();
	}

	private async pollChatList(): Promise<void> {
		if (this.running) {
			this.pendingPoll = true;
			return;
		}
		await this.runBlocked("blockAll", async () => {
			const refresh = await this.chatList.refreshChatList();
			if (refresh == null) {
				return;
			}
			// the list is coloured now; only the current chat is brought up to
			// date, in full when the selection moved and diffed when it grew
			if (refresh.select) {
				this.setBlockMode("blockLoad");
				await this.loadChat(refresh.select);
			} else if (refresh.unread && this.chatMeta != null) {
				this.setBlockMode("blockLoad");
				await this.updateChat(this.chatMeta);
			}
		});
	}

	private startChatPoll(): void {
		setInterval(() => {
			if (document.hidden == false) {
				this.pollChatList();
			}
		}, this.chatPollInterval);
	}

	// A click acknowledges the chat that was on screen and the one clicked, the
	// selection moves at once, and only then does anything load.
	public async onChatClick(chatID: string): Promise<void> {
		const chatMeta = this.chatList.getMeta(chatID);
		if (chatMeta == null) {
			return;
		}
		const previous = this.chatMeta;
		const reselect = previous == null || previous.chatID != chatID;
		if (reselect) {
			this.chatList.selectChat(chatID);
		}
		// moving the selection away from a chat acknowledges that chat and
		// stops its speech at once, before the new chat loads
		if (reselect && previous != null) {
			this.speechPlayer.stop();
			this.chatList.clearUnread(previous.chatID);
			await AgoraAPI.silence(previous.chatID);
		}
		this.chatList.clearUnread(chatID);
		if (reselect) {
			await this.runBlocked("blockLoad", () => this.loadChat(chatMeta));
		} else {
			await this.runBlocked("blockLoad", () => this.updateChat(chatMeta));
		}
	}

	public createChat = async () => {
		const chatMeta = await AgoraAPI.create();
		if (chatMeta) {
			await this.runBlocked("blockAll", () => this.selectAndLoad());
		}
	}

	public renameChat = async () => {
		const title = prompt("Enter new chat title:", this.chatTitle.innerText);
		if (title) {
			await this.runBlocked("blockAll", async () => {
				await this.saveSettings(this.chatMeta.chatID, null, { title });
				await this.chatList.loadChatList();
			});
		}
	}

	public copyChat = async () => {
		const title = prompt("Enter new chat title:", this.chatTitle.innerText);
		if (title) {
			await this.runBlocked("blockAll", async () => {
				const newChatMeta = await AgoraAPI.copy(this.chatMeta.chatID, title);
				if (newChatMeta) {
					await this.selectAndLoad();
				}
			});
		}
	}

	public clearChat = async () => {
		const chatID = this.chatMeta.chatID;
		const title = this.chatMeta.title;
		const confirmed = confirm(`Are you sure you want to clear ${title}?`);
		if (confirmed) {
			await this.runBlocked("blockLoad", async () => {
				this.disabler.disableGroup(chatID);
				const remember = confirm("Do you wish the Ark to remember the conversation?");
				const onChunk = (chunk: string) => {
					return this.contextView.appendChunk(chunk);
				};
				await AgoraAPI.clear(chatID, remember, onChunk);
				await this.contextView.loadContext(chatID);
				this.disabler.enableGroup(chatID);
			});
		}
	}

	public deleteChat = async () => {
		const chatID = this.chatMeta.chatID;
		const title = this.chatMeta.title;
		const confirmed = confirm(`Are you sure you want to delete ${title}?`);
		if (confirmed) {
			await this.runBlocked("blockAll", async () => {
				this.disabler.disableGroup(chatID);
				const remember = confirm("Do you wish the Ark to remember the conversation?");
				const onChunk = (chunk: string) => {
					return this.contextView.appendChunk(chunk);
				};
				await AgoraAPI.delete(chatID, remember, onChunk);
				await this.selectAndLoad();
				this.disabler.enableGroup(chatID);
			});
		}
	}

	public onArchive = async () => {
		const chatID = this.chatMeta.chatID;
		const title = this.chatMeta.title;
		const confirmed = confirm(`Archive ${title}?`);
		if (confirmed) {
			await this.runBlocked("blockLoad", async () => {
				this.disabler.disableGroup(chatID);
				const remember = confirm("Do you wish the Ark to remember the conversation?");
				const onChunk = (chunk: string) => {
					return this.contextView.appendChunk(chunk);
				};
				await AgoraAPI.archive(chatID, remember, onChunk);
				await this.refreshTitle();
				await this.contextView.loadContext(chatID);
				await this.chatList.loadChatList();
				this.disabler.enableGroup(chatID);
			});
		}
	}

	public async saveSettings(chatID: string, arkName: string, settings: AgoraSettings): Promise<AgoraSettings> {
		const result = await AgoraAPI.settings(chatID, arkName, false, settings);
		await this.refreshTitle();
		return result;
	}

	// the title panel reads the resolved settings, not any single layer
	public async refreshTitle(): Promise<void> {
		const combined = await AgoraAPI.settings(this.chatMeta.chatID, null, true, null);
		this.combinedSettings = combined ?? {};
		this.chatInput.setArchived(this.combinedSettings.archived == true);
		this.chatTitle.innerText = combined.title ?? this.chatMeta.title;
		this.menuButton.innerText = `${combined.process?.arkName ?? ""} – ${combined.generate?.mainModel ?? ""}`;
		if (this.combinedSettings.tts?.enabled == false) {
			this.speechPlayer.stop();
		}
	}

	// A new message means a new audio request. The player opens it inside the
	// click, so the audio context is allowed to start.
	private startSpeech(chatID: string): void {
		if (this.combinedSettings.tts?.enabled == false) {
			return;
		}
		const url = `${AgoraAPI.baseURL}/api/listen?chatID=${encodeURIComponent(chatID)}&time=${Date.now()}`;
		this.speechPlayer.start(url);
	}

	public async onEditLast(): Promise<void> {
		const chatID = this.chatMeta.chatID;
		this.speechPlayer.stop();
		await this.runBlocked("blockAll", async () => {
			this.disabler.disableGroup(chatID);
			const message = await AgoraAPI.popMessage(chatID, "user", false);
			this.contextView.removeMessage("user", false);
			if (message && message.content != null) {
				this.chatInput.setMessage(message);
			}
			this.disabler.enableGroup(chatID);
		});
	}

	public async onTryAgain(): Promise<void> {
		const chatID = this.chatMeta.chatID;
		this.speechPlayer.prepare();
		this.speechPlayer.stop();
		await this.runBlocked("blockRun", async () => {
			this.disabler.disableGroup(chatID);
			await AgoraAPI.popMessage(chatID, "ark", true);
			this.contextView.removeMessage("ark", true);
			this.chatInput.begin();
			try {
				this.startSpeech(chatID);
				const onChunk = (chunk: string) => {
					return this.contextView.appendChunk(chunk);
				};
				await AgoraAPI.send(chatID, null, null, null, onChunk);
				this.contextView.flush();
			} finally {
				this.chatInput.end();
				this.disabler.enableGroup(chatID);
			}
		});
	}

	public async onCopyContent(): Promise<void> {
		const contents = this.contextView.getContent();
		await navigator.clipboard.writeText(contents);
	}

	// the rendered chat, filed in the document library
	public async onSaveDocument(): Promise<void> {
		const contents = this.contextView.getContent();
		const document = await AgoraAPI.createDocument();
		if (document) {
			await AgoraAPI.writeDocumentFile(document.name, document.ext, contents);
			alert(`Saved as document ${document.name}.`);
		}
	}

	public async onSend(content: string, images: string[], documents: string[]): Promise<void> {
		const chatID = this.chatMeta.chatID;
		this.startSpeech(chatID);
		await this.runBlocked("blockRun", async () => {
			this.disabler.disableGroup(chatID);
			const onChunk = (chunk: string) => {
				return this.contextView.appendChunk(chunk);
			};
			await AgoraAPI.send(chatID, content, images, documents, onChunk);
			this.contextView.flush();
			this.disabler.enableGroup(chatID);
		});
	}

	public async raiseHand(): Promise<void> {
		await AgoraAPI.hand(this.chatMeta.chatID);
	}

	public async abort(): Promise<void> {
		this.speechPlayer.stop();
		await AgoraAPI.abort(this.chatMeta.chatID);
	}
}

new AgoraUI().init();
