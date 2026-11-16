/// <reference path="../Common/FetchUtil.ts" />
/// <reference path="./ServerTypes.ts" />

class AgoraAPI {
	public static readonly baseURL = `http://${location.hostname}:${location.port}`;

	public static async arks(): Promise<string[]> {
		return fetchData(`${this.baseURL}/api/arks`, "GET", null, null);
	}

	public static async models(): Promise<ModelMeta[]> {
		return fetchData(`${this.baseURL}/api/models`, "GET", null, null);
	}

	public static async chats(): Promise<ChatMeta[]> {
		return fetchData(`${this.baseURL}/api/chats`, "GET", null, null);
	}

	public static async create(): Promise<ChatMeta> {
		return fetchData(`${this.baseURL}/api/create`, "GET", null, null);
	}

	public static async copy(chatID: string, title: string): Promise<ChatMeta> {
		return fetchData(`${this.baseURL}/api/copy`, "POST", CTJSON, { chatID, title });
	}

	public static async settings(chatID: string, arkName: string, combined: boolean, setting: AgoraSettings): Promise<AgoraSettings> {
		return fetchData(`${this.baseURL}/api/settings`, "POST", CTJSON, { chatID, arkName, combine: combined, setting });
	}

	public static async readContext(chatID: string): Promise<ContextEntry[]> {
		return fetchData(`${this.baseURL}/api/context`, "POST", CTJSON, { chatID });
	}

	public static async editContext(chatID: string, index: number, messages: ContextEntry[]): Promise<ContextEntry[]> {
		return fetchData(`${this.baseURL}/api/context`, "POST", CTJSON, { chatID, index, messages });
	}

	public static async popMessage(chatID: string, role: string, shallow: boolean): Promise<UserMessageData> {
		return fetchData(`${this.baseURL}/api/pop`, "POST", CTJSON, { chatID, role, shallow });
	}

	public static async clear(chatID: string, remember: boolean, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/clear`, "POST", CTJSON, { chatID, remember }, { onChunk });
	}

	public static async delete(chatID: string, remember: boolean, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/delete`, "POST", CTJSON, { chatID, remember }, { onChunk });
	}

	public static async archive(chatID: string, remember: boolean, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/archive`, "POST", CTJSON, { chatID, remember }, { onChunk });
	}

	public static async send(chatID: string, content: string, images: string[], documents: string[], onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/send`, "POST", CTJSON, { chatID, content, images, documents }, { onChunk });
	}

	public static async hand(chatID: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/hand`, "POST", CTJSON, { chatID });
	}

	public static async abort(chatID: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/abort`, "POST", CTJSON, { chatID });
	}

	public static async silence(chatID: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/silence`, "POST", CTJSON, { chatID });
	}

	// support codes for settings UI
	public static async rawSettings(chatID: string, arkName: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/raw`, "POST", CTJSON, { chatID, arkName });
	}

	public static async setContext(chatID: string, index: number, entry: ContextEntry): Promise<ContextEntry[]> {
		return fetchData(`${this.baseURL}/api/content/context`, "POST", CTJSON, { chatID, index, entry });
	}

	public static async prompts(): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/prompts`, "GET", null, null);
	}

	public static async readPrompt(arkName: string, name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/prompt`, "POST", CTJSON, { arkName, name });
	}

	public static async writePrompt(arkName: string, name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/prompt`, "POST", CTJSON, { arkName, name, content });
	}

	public static async documents(): Promise<any[]> {
		return fetchData(`${this.baseURL}/api/content/documents`, "GET", null, null);
	}

	public static async createDocument(): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { create: true });
	}

	public static async renameDocument(oldName: string, newName: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { rename: true, oldName, newName });
	}

	public static async readDocumentEntry(name: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, kind: "entry" });
	}

	public static async writeDocumentEntry(name: string, entry: any): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, kind: "entry", entry });
	}

	public static async readDocumentFile(name: string, ext: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, ext, kind: "file" });
	}

	public static async writeDocumentFile(name: string, ext: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { name, ext, kind: "file", content });
	}

	public static async memories(arkName: string): Promise<string[]> {
		return fetchData(`${this.baseURL}/api/content/memories`, "POST", CTJSON, { arkName });
	}

	public static async readMemoryEntry(arkName: string, name: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "entry" });
	}

	public static async writeMemoryEntry(arkName: string, name: string, entry: any): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "entry", entry });
	}

	public static async readMemoryFile(arkName: string, name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "file" });
	}

	public static async writeMemoryFile(arkName: string, name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, kind: "file", content });
	}

	public static async createMemory(arkName: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, create: true });
	}

	public static async removeMemory(arkName: string, name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/memory`, "POST", CTJSON, { arkName, name, remove: true });
	}

	public static async modelList(): Promise<string[]> {
		return fetchData(`${this.baseURL}/api/content/models`, "GET", null, null);
	}

	public static async readModel(name: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/model`, "POST", CTJSON, { name });
	}

	public static async writeModel(name: string, model: any): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/model`, "POST", CTJSON, { name, model });
	}

	public static async createModel(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { create: true, name });
	}

	public static async renameModel(oldName: string, newName: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { rename: true, oldName, newName });
	}

	public static async removeModel(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/model`, "POST", CTJSON, { remove: true, name });
	}

	public static async imageList(): Promise<string[]> {
		return fetchData(`${this.baseURL}/api/content/images`, "GET", null, null);
	}

	public static async readImageEntry(name: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { name });
	}

	public static async writeImageEntry(name: string, entry: any): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { name, entry });
	}

	public static async todoList(): Promise<string[]> {
		return fetchData(`${this.baseURL}/api/content/todos`, "GET", null, null);
	}

	public static async readTodo(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { name });
	}

	public static async writeTodo(name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { name, content });
	}

	public static async createArk(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/ark`, "POST", CTJSON, { create: true, name });
	}

	public static async removeArk(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/ark`, "POST", CTJSON, { delete: true, name });
	}

	public static async uploadDocument(ext: string, data: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/document`, "POST", CTJSON, { upload: true, ext, data });
	}

	public static async removeDocument(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/document`, "POST", CTJSON, { remove: true, name });
	}

	public static async summarizeDocument(name: string, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/content/document`, "POST", CTJSON, { summarize: true, name }, { onChunk });
	}

	public static async uploadImage(ext: string, data: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/image`, "POST", CTJSON, { upload: true, ext, data });
	}

	public static async renameImage(oldName: string, newName: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/image`, "POST", CTJSON, { rename: true, oldName, newName });
	}

	public static async removeImage(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/image`, "POST", CTJSON, { remove: true, name });
	}

	public static async summarizeImage(name: string, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/content/image`, "POST", CTJSON, { summarize: true, name }, { onChunk });
	}

	public static async createTodo(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { create: true, name });
	}

	public static async renameTodo(oldName: string, newName: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { rename: true, oldName, newName });
	}

	public static async removeTodo(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/todo`, "POST", CTJSON, { remove: true, name });
	}

	public static async ideas(): Promise<IdeaListing> {
		return fetchData(`${this.baseURL}/api/content/ideas`, "GET", null, null);
	}

	public static async createIdea(name: string, description: string): Promise<{ name: string }> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { create: true, name, description });
	}

	public static async renameIdea(oldName: string, newName: string): Promise<{ name: string }> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { rename: true, oldName, newName });
	}

	public static async renameIdeaEntry(name: string, key: string, title: string): Promise<{ name: string }> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { rename: true, name, key, title });
	}

	public static async removeIdea(name: string): Promise<{ name: string }> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { remove: true, name });
	}

	public static async readIdeaSettings(): Promise<SettingsIdea> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { kind: "settings" });
	}

	public static async writeIdeaSettings(setting: SettingsIdea): Promise<SettingsIdea> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { kind: "settings", setting });
	}

	public static async readIdeaSummary(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "summary" });
	}

	public static async writeIdeaSummary(name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "summary", content });
	}

	public static async readIdeaDescription(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "description" });
	}

	public static async writeIdeaDescription(name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "description", content });
	}

	public static async readIdeaCatalogue(name: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "catalogue" });
	}

	public static async writeIdeaCatalogue(name: string, catalogue: any): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "catalogue", content: catalogue });
	}

	public static async readIdeaEntry(name: string, key: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, key, kind: "entry" });
	}

	public static async writeIdeaEntry(name: string, key: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, key, kind: "entry", content });
	}

	public static async readIdeaInbox(name: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "inbox" });
	}

	public static async writeIdeaInbox(name: string, content: string): Promise<string> {
		return fetchText(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { name, kind: "inbox", content });
	}

	public static async removeIdeaInbox(name: string): Promise<{ name: string }> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { remove: true, inbox: true, name });
	}

	public static async summarizeIdea(name: string, key: string, onChunk: StringProcessor): Promise<string> {
		return fetchByChunk(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { summarize: true, name, key }, { onChunk });
	}

	public static async uploadIdeaInbox(data: string, sort: boolean, ext: string): Promise<any> {
		return fetchData(`${this.baseURL}/api/content/idea`, "POST", CTJSON, { upload: true, data, sort, ext });
	}
}
