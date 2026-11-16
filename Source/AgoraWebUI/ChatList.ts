/// <reference path="./CollapseGroup.ts" />

// What the caller should load once the list has been re-coloured.
interface ChatRefresh {
	// the chat the selection had to move to, to be loaded in full
	select: ChatMeta;
	// the kept selection gained unread content, to be loaded as a diff
	unread: boolean;
}

class ChatList {
	private parent: AgoraUI;
	private container: HTMLElement;
	private groups: Map<string, CollapseGroup> = new Map();
	private buttons: Map<string, HTMLButtonElement> = new Map();
	private metas: Map<string, ChatMeta> = new Map();
	private selected: string = null;

	public constructor(parent: AgoraUI, container: HTMLElement) {
		this.parent = parent;
		this.container = container;
	}

	// Full build. The selection is the chat the user looked at last.
	public async loadChatList(): Promise<ChatMeta> {
		const chatList = await AgoraAPI.chats() ?? [];
		chatList.sort((a, b) => b.created - a.created);
		this.container.innerHTML = "";
		this.groups.clear();
		this.buttons.clear();
		this.metas.clear();
		for (const chatMeta of chatList) {
			this.metas.set(chatMeta.chatID, chatMeta);
		}
		this.selected = this.pickSelected(chatList);
		for (const chatMeta of chatList) {
			this.createButton(chatMeta);
		}
		this.expandGroup(this.selected);
		return this.metas.get(this.selected) ?? null;
	}

	// Difference pass. The states are read from the fresh metas first, then
	// applied, and the caller is told what has to load afterwards.
	public async refreshChatList(): Promise<ChatRefresh> {
		const chatList = await AgoraAPI.chats();
		if (chatList == null) {
			return null;
		}
		chatList.sort((a, b) => b.created - a.created);
		const selectedBefore = this.selected;
		const seen = new Set<string>();
		for (const chatMeta of chatList) {
			seen.add(chatMeta.chatID);
			this.applyMeta(chatMeta);
		}
		for (const chatID of Array.from(this.metas.keys())) {
			if (seen.has(chatID) == false) {
				this.removeButton(chatID);
			}
		}
		if (this.metas.has(this.selected) == false) {
			this.selected = this.pickSelected(chatList);
		}
		this.paintAll();
		if (this.selected != selectedBefore) {
			return { select: this.metas.get(this.selected) ?? null, unread: false };
		}
		// Reading the context marks the chat viewed on the server, so the next
		// fetch is what stops the diff, not any local bookkeeping.
		return { select: null, unread: this.isUnread(this.metas.get(this.selected)) };
	}

	public getMeta(chatID: string): ChatMeta {
		return this.metas.get(chatID);
	}

	// The user has now seen the chat, so its red goes at once. The next poll
	// brings the server's own mark back in line.
	public clearUnread(chatID: string): void {
		const chatMeta = this.metas.get(chatID);
		if (chatMeta) {
			chatMeta.viewed = chatMeta.updated;
		}
		this.paintChat(chatID);
	}

	public selectChat(chatID: string): void {
		const previous = this.selected;
		this.selected = chatID;
		this.expandGroup(chatID);
		if (previous != null) {
			this.paintChat(previous);
		}
		this.paintChat(chatID);
	}

	// The group of the chat the selection moved to is opened, to reveal it.
	private expandGroup(chatID: string): void {
		const button = this.buttons.get(chatID);
		if (button == null) {
			return;
		}
		button["group"]?.expand();
	}

	// The chat the user looked at last.
	private pickSelected(chatList: ChatMeta[]): string {
		let result = null;
		let viewed = -1;
		for (const chatMeta of chatList) {
			if (chatMeta.viewed > viewed) {
				viewed = chatMeta.viewed;
				result = chatMeta.chatID;
			}
		}
		return result;
	}

	private isUnread(chatMeta: ChatMeta): boolean {
		return chatMeta != null && chatMeta.viewed < chatMeta.updated;
	}

	// A group turns red while any chat inside it is unread.
	private isGroupUnread(groupName: string): boolean {
		let result = false;
		for (const chatMeta of this.metas.values()) {
			if (this.groupName(chatMeta.title) == groupName && this.isUnread(chatMeta)) {
				result = true;
				break;
			}
		}
		return result;
	}

	// Painting is a pure function of the pair, so the four styles cannot drift.
	// Unread and selected are independent; together they mean the red background.
	private paintChat(chatID: string): void {
		const button = this.buttons.get(chatID);
		if (button == null) {
			return;
		}
		const chatMeta = this.metas.get(chatID);
		const unread = this.isUnread(chatMeta);
		button.classList.toggle("unread", unread);
		button.classList.toggle("selected", chatID == this.selected);
		const group = button["group"];
		if (group) {
			group.setUnread(this.isGroupUnread(this.groupName(chatMeta.title)));
		}
	}

	private paintAll(): void {
		for (const chatID of this.buttons.keys()) {
			this.paintChat(chatID);
		}
	}

	private applyMeta(chatMeta: ChatMeta): void {
		const button = this.buttons.get(chatMeta.chatID);
		const previous = this.metas.get(chatMeta.chatID);
		this.metas.set(chatMeta.chatID, chatMeta);
		if (button == null) {
			this.createButton(chatMeta);
			return;
		}
		// the click handler reads the current meta through this, not its closure
		button["meta"] = chatMeta;
		if (previous == null || previous.title != chatMeta.title) {
			button.innerText = this.shortTitle(chatMeta.title);
		}
	}

	private createButton(chatMeta: ChatMeta): void {
		const groupName = this.groupName(chatMeta.title);
		const group = groupName ? this.getGroup(groupName) : null;
		const button = document.createElement("button");
		button.innerText = this.shortTitle(chatMeta.title);
		button["chatID"] = chatMeta.chatID;
		button["meta"] = chatMeta;
		button["group"] = group;
		button.addEventListener("click", () => this.parent.onChatClick(button["chatID"]));
		if (group) {
			group.content.appendChild(button);
			// the list is built newest first, so every following chat moves the
			// group down, and it settles at the date of its oldest chat
			group.moveToEnd();
		} else {
			this.container.appendChild(button);
		}
		this.buttons.set(chatMeta.chatID, button);
		this.paintChat(chatMeta.chatID);
	}

	private removeButton(chatID: string): void {
		this.buttons.get(chatID)?.remove();
		this.buttons.delete(chatID);
		this.metas.delete(chatID);
	}

	// The title is grouped by the part before the last, when it has one.
	private groupName(title: string): string {
		const parts = title.split(/\s*[/–—]+\s*/);
		return parts[parts.length - 2];
	}

	private shortTitle(title: string): string {
		const parts = title.split(/\s*[/–—]+\s*/);
		return parts[parts.length - 1];
	}

	private getGroup(groupName: string): CollapseGroup {
		let group = this.groups.get(groupName);
		if (group == null) {
			group = new CollapseGroup(this.container, groupName);
			this.groups.set(groupName, group);
		}
		return group;
	}
}
