/// <reference path="AgoraStreamer.ts" />
/// <reference path="ModelUtil.ts" />
/// <reference path="ArkUtil.ts" />
/// <reference path="PromptUtil.ts" />
/// <reference path="TodoUtil.ts" />
/// <reference path="ChatUtil.ts" />
/// <reference path="ParamsUtil.ts" />
/// <reference path="ProcessUtil.ts" />
/// <reference path="WorkshopUtil.ts" />
/// <reference path="MemoryUtil.ts" />
/// <reference path="../Workshops/DreamWorkshop.ts" />

namespace AgoraUtil {
	export async function initialize(): Promise<void> {
		await ArkUtil.initialize();
		await ChatUtil.initialize();
		await ModelUtil.initialize();
		await WorkshopUtil.initialize();
	}

	export async function loadModels(): Promise<ModelMeta[]> {
		return ModelUtil.getModelOptions();
	}

	export async function loadArks(): Promise<string[]> {
		return ArkUtil.getArkNames();
	}

	export async function loadChats(): Promise<ChatMeta[]> {
		return ChatUtil.getChatMetas();
	}

	export async function createChat(): Promise<ChatMeta> {
		return ChatUtil.createChat();
	}

	export async function copyChat(sourceID: string, title: string): Promise<ChatMeta> {
		return ChatUtil.copyChat(sourceID, title);
	}

	export async function clearChat(chatID: string, remember: boolean, response: any): Promise<void> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
			if (remember) {
				// this may stream
				await ProcessUtil.remember(params);
			} else {
				await ProcessUtil.forget(params);
			}
			// maybe this should be optimized
			await ChatUtil.clearChat(chatID);
			await ProcessUtil.update(params);
		} finally {
			AgoraStreamer.end(chatID);
			lock.release();
		}
	}

	export async function deleteChat(chatID: string, remember: boolean, response: any): Promise<void> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
			if (remember) {
				// this may stream
				await ProcessUtil.remember(params);
			} else {
				await ProcessUtil.forget(params);
			}
			// maybe this should be optimized
			await ChatUtil.clearChat(chatID);
			await ProcessUtil.update(params);
			await ChatUtil.deleteChat(chatID);
		} finally {
			AgoraStreamer.end(chatID);
			lock.release();
		}
	}

	// Handles every block or drops the chat's memories, then moves the whole active context into the archive.
	export async function archiveChat(chatID: string, remember: boolean, response: any): Promise<void> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
			await ProcessUtil.archive(params, remember);
		} finally {
			AgoraStreamer.end(chatID);
			lock.release();
		}
	}

	export async function readGlobalSettings(): Promise<GlobalSettings> {
		return ChatUtil.readGlobalSettings();
	}

	export async function editGlobalSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings> {
		return ChatUtil.editGlobalSettings(settings);
	}

	export async function readChatSettings(chatID: string): Promise<ChatSettings> {
		return ChatUtil.readChatSettings(chatID);
	}

	export async function editChatSettings(chatID: string, overrides: Partial<ChatSettings>): Promise<ChatSettings> {
		return ChatUtil.editChatSettings(chatID, overrides);
	}

	export async function readArkSettings(arkName: string): Promise<ArkSettings> {
		return ArkUtil.readArkSettings(arkName);
	}

	export async function editArkSettings(arkName: string, overrides: Partial<ArkSettings>): Promise<ArkSettings> {
		return ArkUtil.editArkSettings(arkName, overrides);
	}

	export async function getCombinedSettings(chatID: string): Promise<any> {
		return ParamsUtil.getCombinedSettings(chatID);
	}

	export async function readContext(chatID: string): Promise<ContextEntry[]> {
		return ChatUtil.readContext(chatID);
	}

	export async function editContext(chatID: string, index: number, entries: ContextEntry[]): Promise<ContextEntry[]> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(chatID, null);
			const context = await ChatUtil.editContext(chatID, index, entries);
			// the active context changed
			await ProcessUtil.update(params);
			return context;
		} finally {
			lock.release();
		}
	}

	export async function popMessage(chatID: string, role: string, shallow: boolean): Promise<any> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = await ParamsUtil.getCombinedParams(chatID, null);
			const context = await ChatUtil.popMessage(chatID, role, shallow);
			// the active context changed
			await ProcessUtil.update(params);
			return context;
		} finally {
			lock.release();
		}
	}

	export async function sendMessage(chatID: string, content: string, images: string[], documents: string[], response: any): Promise<void> {
		const lock = await Mutex.lock(chatID);
		try {
			const settings = await ChatUtil.readChatSettings(chatID);
			if (settings.archived) {
				const handler = new AgoraStreamer(chatID, response);
				handler.streamInfo("Message sending to archived chat disabled.");
				return;
			}
			const params = await ParamsUtil.getCombinedParams(chatID, new AgoraStreamer(chatID, response));
			if (content == null) {
				await ProcessUtil.replyMessage(params);
			} else {
				await ProcessUtil.sendMessage(params, "user", params.process.userName, content, images, documents);
			}
		} finally {
			AgoraStreamer.end(chatID);
			lock.release();
		}
	}

	export function raiseHand(chatID: string): void {
		AgoraStreamer.raiseHand(chatID);
	}

	export function abortChat(chatID: string): void {
		AgoraStreamer.abort(chatID);
	}

	// support codes for settings UI

	export async function readRawGlobalSettings(): Promise<GlobalSettings> {
		return ChatUtil.readRawGlobalSettings();
	}

	export async function readRawChatSettings(chatID: string): Promise<ChatSettings> {
		return ChatUtil.readRawChatSettings(chatID);
	}

	export async function readRawArkSettings(arkName: string): Promise<ArkSettings> {
		return ArkUtil.readRawArkSettings(arkName);
	}

	export async function createArk(name: string): Promise<string> {
		const result = await ArkUtil.createArk(name);
		await DreamWorkshop.scheduleArk(name);
		return result;
	}

	export async function removeArk(name: string): Promise<string> {
		await WorkshopUtil.removeSchedule(`dream-${name}`);
		return ArkUtil.removeArk(name);
	}

	export async function setContextEntry(chatID: string, index: number, entry: ContextEntry): Promise<ContextEntry[]> {
		AgoraStreamer.abort(chatID);
		const lock = await Mutex.lock(chatID);
		try {
			const params = entry == null ? null : await ParamsUtil.getCombinedParams(chatID, null);
			const context = await ChatUtil.setContextEntry(chatID, index, entry);
			if (params) {
				await ProcessUtil.update(params);
			}
			return context;
		} finally {
			lock.release();
		}
	}

	export async function listPrompts(): Promise<PromptListing> {
		return PromptUtil.listPrompts();
	}

	export async function readPrompt(arkName: string, name: string): Promise<string> {
		return PromptUtil.readPrompt(arkName, name);
	}

	export async function writePrompt(arkName: string, name: string, content: string): Promise<string> {
		return PromptUtil.writePrompt(arkName, name, content);
	}

	export async function listDocuments(): Promise<DocumentInfo[]> {
		return DocumentWorkshop.listDocuments();
	}

	export async function createDocument(): Promise<DocumentInfo> {
		return DocumentWorkshop.createDocument();
	}

	export async function renameDocument(oldName: string, newName: string): Promise<DocumentInfo> {
		return DocumentWorkshop.renameDocument(oldName, newName);
	}

	export async function readDocumentEntry(name: string): Promise<DocumentEntry> {
		return DocumentWorkshop.readCatalogueEntry(name);
	}

	export async function writeDocumentEntry(name: string, entry: DocumentEntry): Promise<DocumentEntry> {
		return DocumentWorkshop.writeCatalogueEntry(name, entry);
	}

	export async function readDocumentFile(name: string, ext: string): Promise<string> {
		return DocumentWorkshop.readDocument(name, ext);
	}

	export async function writeDocumentFile(name: string, ext: string, content: string): Promise<string> {
		return DocumentWorkshop.writeDocument(name, ext, content);
	}

	export async function summarizeDocument(name: string, response: any): Promise<DocumentEntry> {
		return summarizeWith(response, params => DocumentWorkshop.summarizeDocument(params, name));
	}

	export async function uploadDocument(ext: string, data: string): Promise<DocumentInfo> {
		return DocumentWorkshop.uploadDocument(ext, data);
	}

	export async function removeDocument(name: string): Promise<string> {
		return DocumentWorkshop.removeDocument(name);
	}

	export async function listMemories(arkName: string): Promise<string[]> {
		return MemoryUtil.listMemories(arkName);
	}

	export async function readMemoryEntry(arkName: string, name: string): Promise<MemoryEntry> {
		return MemoryUtil.readCatalogueEntry(arkName, name);
	}

	export async function writeMemoryEntry(arkName: string, name: string, entry: MemoryEntry): Promise<MemoryEntry> {
		return MemoryUtil.writeCatalogueEntry(arkName, name, entry);
	}

	export async function readMemoryFile(arkName: string, name: string): Promise<string> {
		return MemoryUtil.readMemoryFile(arkName, name);
	}

	export async function writeMemoryFile(arkName: string, name: string, content: string): Promise<string> {
		return MemoryUtil.writeMemoryFile(arkName, name, content);
	}

	export async function createMemory(arkName: string): Promise<string> {
		return MemoryUtil.createMemory(arkName);
	}

	export async function removeMemory(arkName: string, name: string): Promise<string> {
		return MemoryUtil.removeMemory(arkName, name);
	}

	export async function listModels(): Promise<string[]> {
		return ModelUtil.getModelNames();
	}

	export async function readModel(name: string): Promise<ModelSettings> {
		return ModelUtil.readModel(name);
	}

	export async function writeModel(name: string, model: ModelSettings): Promise<ModelSettings> {
		return ModelUtil.writeModel(name, model);
	}

	export async function createModel(name: string): Promise<string> {
		return ModelUtil.createModel(name);
	}

	export async function renameModel(oldName: string, newName: string): Promise<string> {
		return ModelUtil.renameModel(oldName, newName);
	}

	export async function removeModel(name: string): Promise<string> {
		return ModelUtil.removeModel(name);
	}

	export async function listImages(): Promise<string[]> {
		return ImageWorkshop.listImages();
	}

	export async function readImageEntry(name: string): Promise<any> {
		return ImageWorkshop.readCatalogueEntry(name);
	}

	export async function writeImageEntry(name: string, entry: any): Promise<any> {
		return ImageWorkshop.writeCatalogueEntry(name, entry);
	}

	export async function uploadImage(ext: string, data: string): Promise<any> {
		return ImageWorkshop.uploadImage(ext, data);
	}

	export async function renameImage(oldName: string, newName: string): Promise<string> {
		return ImageWorkshop.renameImage(oldName, newName);
	}

	export async function removeImage(name: string): Promise<string> {
		return ImageWorkshop.removeImage(name);
	}

	export async function summarizeImage(name: string, response: any): Promise<ImageCatalogueEntry> {
		return summarizeWith(response, params => ImageWorkshop.summarizeImage(params, name));
	}

	export async function listTodos(): Promise<string[]> {
		return TodoUtil.listTodos();
	}

	export async function readTodo(name: string): Promise<string> {
		return TodoUtil.readTodo(name);
	}

	export async function writeTodo(name: string, content: string): Promise<string> {
		return TodoUtil.writeTodo(name, content);
	}

	export async function createTodo(name: string): Promise<string> {
		return TodoUtil.createTodo(name);
	}

	export async function renameTodo(oldName: string, newName: string): Promise<string> {
		return TodoUtil.renameTodo(oldName, newName);
	}

	export async function removeTodo(name: string): Promise<string> {
		return TodoUtil.removeTodo(name);
	}

	export async function listIdeas(): Promise<{ ideas: IdeaWorkshopInfo[], inbox: string[] }> {
		return { ideas: await IdeaWorkshop.listIdeas(), inbox: await IdeaWorkshop.listInboxNames() };
	}

	export async function createIdea(name: string, description: string): Promise<string> {
		return IdeaWorkshop.createIdea(name, description);
	}

	export async function renameIdea(oldName: string, newName: string): Promise<string> {
		return IdeaWorkshop.renameIdea(oldName, newName);
	}

	export async function renameIdeaEntry(name: string, key: string, title: string): Promise<string> {
		return IdeaWorkshop.renameEntry(name, key, title);
	}

	export async function removeIdea(name: string): Promise<string> {
		return IdeaWorkshop.removeIdea(name);
	}

	export async function readIdeaSettings(): Promise<IdeaSettings> {
		const settings: any = await IdeaWorkshop.readSettings();
		delete settings.lastIndex;
		delete settings.prompt;
		return settings;
	}

	export async function writeIdeaSettings(setting: Partial<IdeaSettings>): Promise<IdeaSettings> {
		const clean: any = { ...setting };
		delete clean.lastIndex;
		delete clean.prompt;
		const result: any = await IdeaWorkshop.editSettings(clean);
		delete result.lastIndex;
		delete result.prompt;
		return result;
	}

	export async function readIdeaSummary(name: string): Promise<string> {
		const summary = await IdeaWorkshop.readSummary(name);
		return summary ?? "";
	}

	export async function writeIdeaSummary(name: string, content: string): Promise<string> {
		return IdeaWorkshop.writeSummary(name, content);
	}

	export async function readIdeaDescription(name: string): Promise<string> {
		return IdeaWorkshop.readDescriptionFile(name);
	}

	export async function writeIdeaDescription(name: string, content: string): Promise<string> {
		return IdeaWorkshop.writeDescription(name, content);
	}

	export async function readIdeaCatalogue(name: string): Promise<IdeaCatalogue> {
		return IdeaWorkshop.readCatalogue(name);
	}

	export async function writeIdeaCatalogue(name: string, catalogue: IdeaCatalogue): Promise<IdeaCatalogue> {
		return IdeaWorkshop.writeCatalogue(name, catalogue);
	}

	export async function readIdeaEntry(name: string, key: string): Promise<string> {
		return IdeaWorkshop.readIdeaEntry(name, key);
	}

	export async function writeIdeaEntry(name: string, key: string, content: string): Promise<string> {
		return IdeaWorkshop.writeIdeaEntry(name, key, content);
	}

	export async function readIdeaInbox(name: string): Promise<string> {
		return IdeaWorkshop.readInbox(name);
	}

	export async function writeIdeaInbox(name: string, content: string): Promise<string> {
		return IdeaWorkshop.writeInbox(name, content);
	}

	export async function uploadIdeaInbox(data: string, sort: boolean, ext: string): Promise<any> {
		const name = ext ? await IdeaWorkshop.uploadInboxImage(ext, data) : await IdeaWorkshop.uploadInbox(data);
		if (name == null) {
			return null;
		}
		if (sort) {
			return { name, report: await IdeaWorkshop.sortInboxItem(name) };
		}
		return { name, report: null };
	}

	export async function removeIdeaInbox(name: string): Promise<string> {
		return IdeaWorkshop.removeInbox(name);
	}

	export async function summarizeIdea(name: string, key: string, response: any): Promise<any> {
		if (key) {
			return summarizeWith(response, params => IdeaWorkshop.summarizeEntry(params, name, key));
		}
		return summarizeWith(response, params => IdeaWorkshop.regenerateSummaries(params, [ name ]));
	}

	async function summarizeWith<Type>(response: any, task: (params: CombinedParams) => Promise<Type>): Promise<Type> {
		const silentID = `summarize-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
		const streamer = new AgoraStreamer(silentID, response);
		try {
			const params = await ParamsUtil.getGlobalParams(streamer);
			return await task(params);
		} finally {
			AgoraStreamer.end(silentID);
		}
	}
}
