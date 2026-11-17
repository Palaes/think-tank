/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/ServerUtil.ts" />

/// <reference path="../Adapters/TTSService.ts" />

/// <reference path="AgoraUtil.ts" />
/// <reference path="SpeechUtil.ts" />
/// <reference path="ParamsUtil.ts" />

namespace AgoraServer {
	export async function handleModels(requestData: any, response: any): Promise<ModelMeta[]> {
		return AgoraUtil.loadModels();
	}

	export async function handleArks(requestData: any, response: any): Promise<string[]> {
		return AgoraUtil.loadArks();
	}

	export async function handleChats(requestData: any, response: any): Promise<ChatMeta[]> {
		return AgoraUtil.loadChats();
	}

	export async function handleCreate(requestData: any, response: any): Promise<ChatMeta> {
		return AgoraUtil.createChat();
	}

	export async function handleCopy(requestData: any, response: any): Promise<ChatMeta> {
		if (requestData.chatID) {
			return AgoraUtil.copyChat(requestData.chatID, requestData.title);
		}
		return null;
	}

	export async function handleClear(requestData: any, response: any): Promise<void> {
		if (requestData.chatID) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.clearChat(requestData.chatID, requestData.remember, response);
			response.end();
		}
	}

	export async function handleDelete(requestData: any, response: any): Promise<void> {
		if (requestData.chatID) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.deleteChat(requestData.chatID, requestData.remember, response);
			response.end();
		}
	}

	export async function handleArchive(requestData: any, response: any): Promise<void> {
		if (requestData.chatID) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.archiveChat(requestData.chatID, requestData.remember, response);
			response.end();
		}
	}

	export async function handleSettings(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			if (requestData.setting) {
				const edited = await AgoraUtil.editChatSettings(requestData.chatID, requestData.setting);
				if (requestData.combine) {
					return AgoraUtil.getCombinedSettings(requestData.chatID);
				}
				return edited;
			}
			if (requestData.combine) {
				return AgoraUtil.getCombinedSettings(requestData.chatID);
			}
			return AgoraUtil.readChatSettings(requestData.chatID);
		}
		if (requestData.arkName) {
			if (requestData.setting) {
				return AgoraUtil.editArkSettings(requestData.arkName, requestData.setting);
			}
			return AgoraUtil.readArkSettings(requestData.arkName);
		}
		if (requestData.setting) {
			return AgoraUtil.editGlobalSettings(requestData.setting);
		}
		return AgoraUtil.readGlobalSettings();
	}

	export async function handleTranscript(requestData: any, response: any): Promise<string> {
		if (requestData.chatID) {
			return AgoraUtil.getTranscript(requestData.chatID);
		}
		return null;
	}

	export async function handleContext(requestData: any, response: any): Promise<ContextEntry[]> {
		if (requestData.chatID) {
			if (requestData.messages == null) {
				if (requestData.index == null) {
					return AgoraUtil.readContext(requestData.chatID)
				}
			}
			return AgoraUtil.editContext(requestData.chatID, requestData.index ?? Infinity, requestData.messages || []);
		}
		return null;
	}

	export async function handlePop(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			return AgoraUtil.popMessage(requestData.chatID, requestData.role, requestData.shallow);
		}
		return null;
	}

	export async function handleSend(requestData: any, response: any): Promise<void> {
		if (requestData.chatID) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.sendMessage(requestData.chatID, requestData.content, requestData.images ?? [], requestData.documents ?? [], response);
			response.end();
		}
	}

	export async function handleHand(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			AgoraUtil.raiseHand(requestData.chatID);
			return { success: true };
		}
		return null;
	}

	export async function handleAbort(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			AgoraUtil.abortChat(requestData.chatID);
			return { success: true };
		}
		return null;
	}

	export async function handleSpeech(requestData: any, response: any): Promise<void> {
		if (requestData.text) {
			await TTSService.synthesize(TTSService.defaultSettings, requestData.text, response);
		} else {
			response.writeHead(400, CTTEXT);
			response.end("text missing");
		}
	}

	// The audio element keeps this response open and speech is written into it.
	export async function handleListen(requestData: any, response: any, request: any): Promise<void> {
		const url = new URL("http://" + request.headers.host + request.url);
		const chatID = url.searchParams.get("chatID");
		if (chatID) {
			SpeechUtil.open(chatID, TTSService.defaultSettings, response);
			ParamsUtil.getCombinedSettings(chatID).then(settings => SpeechUtil.configure(chatID, settings.tts));
			return;
		}
		response.writeHead(400, CTTEXT);
		response.end("chatID missing");
	}

	export async function handleSilence(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			SpeechUtil.abort(requestData.chatID);
			return { success: true };
		}
		return null;
	}

	// support codes for settings UI

	export async function handleRawSettings(requestData: any, response: any): Promise<any> {
		if (requestData.chatID) {
			return AgoraUtil.readRawChatSettings(requestData.chatID);
		}
		if (requestData.arkName) {
			return AgoraUtil.readRawArkSettings(requestData.arkName);
		}
		return AgoraUtil.readRawGlobalSettings();
	}

	export async function handleContextEntry(requestData: any, response: any): Promise<ContextEntry[]> {
		return AgoraUtil.setContextEntry(requestData.chatID, requestData.index, requestData.entry);
	}

	export async function handlePrompts(requestData: any, response: any): Promise<PromptListing> {
		return AgoraUtil.listPrompts();
	}

	export async function handlePrompt(requestData: any, response: any): Promise<string> {
		if (requestData.content == null) {
			return AgoraUtil.readPrompt(requestData.arkName, requestData.name);
		}
		return AgoraUtil.writePrompt(requestData.arkName, requestData.name, requestData.content);
	}

	export async function handleDocuments(requestData: any, response: any): Promise<DocumentInfo[]> {
		return AgoraUtil.listDocuments();
	}

	export async function handleDocument(requestData: any, response: any): Promise<any> {
		if (requestData.summarize) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.summarizeDocument(requestData.name, response);
			response.end();
			return;
		}
		if (requestData.create) {
			return AgoraUtil.createDocument();
		}
		if (requestData.upload) {
			return AgoraUtil.uploadDocument(requestData.ext, requestData.data);
		}
		if (requestData.rename) {
			return AgoraUtil.renameDocument(requestData.oldName, requestData.newName);
		}
		if (requestData.remove) {
			return AgoraUtil.removeDocument(requestData.name);
		}
		if (requestData.kind == "entry") {
			if (requestData.entry == null) {
				return AgoraUtil.readDocumentEntry(requestData.name);
			}
			return AgoraUtil.writeDocumentEntry(requestData.name, requestData.entry);
		}
		if (requestData.content == null) {
			return AgoraUtil.readDocumentFile(requestData.name, requestData.ext);
		}
		return AgoraUtil.writeDocumentFile(requestData.name, requestData.ext, requestData.content);
	}

	export async function handleMemories(requestData: any, response: any): Promise<string[]> {
		return AgoraUtil.listMemories(requestData.arkName);
	}

	export async function handleMemory(requestData: any, response: any): Promise<any> {
		if (requestData.create) {
			return AgoraUtil.createMemory(requestData.arkName);
		}
		if (requestData.remove) {
			return AgoraUtil.removeMemory(requestData.arkName, requestData.name);
		}
		if (requestData.kind == "entry") {
			if (requestData.entry == null) {
				return AgoraUtil.readMemoryEntry(requestData.arkName, requestData.name);
			}
			return AgoraUtil.writeMemoryEntry(requestData.arkName, requestData.name, requestData.entry);
		}
		if (requestData.content == null) {
			return AgoraUtil.readMemoryFile(requestData.arkName, requestData.name);
		}
		return AgoraUtil.writeMemoryFile(requestData.arkName, requestData.name, requestData.content);
	}

	export async function handleModelList(requestData: any, response: any): Promise<string[]> {
		return AgoraUtil.listModels();
	}

	export async function handleModel(requestData: any, response: any): Promise<any> {
		if (requestData.create) {
			return AgoraUtil.createModel(requestData.name);
		}
		if (requestData.rename) {
			return AgoraUtil.renameModel(requestData.oldName, requestData.newName);
		}
		if (requestData.remove) {
			return AgoraUtil.removeModel(requestData.name);
		}
		if (requestData.model == null) {
			return AgoraUtil.readModel(requestData.name);
		}
		return AgoraUtil.writeModel(requestData.name, requestData.model);
	}

	export async function handleImages(requestData: any, response: any): Promise<string[]> {
		return AgoraUtil.listImages();
	}

	export async function handleImage(requestData: any, response: any): Promise<any> {
		if (requestData.summarize) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.summarizeImage(requestData.name, response);
			response.end();
			return;
		}
		if (requestData.upload) {
			return AgoraUtil.uploadImage(requestData.ext, requestData.data);
		}
		if (requestData.rename) {
			return AgoraUtil.renameImage(requestData.oldName, requestData.newName);
		}
		if (requestData.remove) {
			return AgoraUtil.removeImage(requestData.name);
		}
		if (requestData.entry == null) {
			return AgoraUtil.readImageEntry(requestData.name);
		}
		return AgoraUtil.writeImageEntry(requestData.name, requestData.entry);
	}

	export async function handleTodos(requestData: any, response: any): Promise<string[]> {
		return AgoraUtil.listTodos();
	}

	export async function handleTodo(requestData: any, response: any): Promise<any> {
		if (requestData.create) {
			return AgoraUtil.createTodo(requestData.name);
		}
		if (requestData.rename) {
			return AgoraUtil.renameTodo(requestData.oldName, requestData.newName);
		}
		if (requestData.remove) {
			return AgoraUtil.removeTodo(requestData.name);
		}
		if (requestData.content == null) {
			return AgoraUtil.readTodo(requestData.name);
		}
		return AgoraUtil.writeTodo(requestData.name, requestData.content);
	}

	export async function handleIdeas(requestData: any, response: any): Promise<any> {
		return AgoraUtil.listIdeas();
	}

	export async function handleIdea(requestData: any, response: any): Promise<any> {
		if (requestData.summarize) {
			response.writeHead(200, CTTEXT);
			await AgoraUtil.summarizeIdea(requestData.name, requestData.key, response);
			response.end();
			return;
		}
		if (requestData.create) {
			return { name: await AgoraUtil.createIdea(requestData.name, requestData.description) };
		}
		if (requestData.upload) {
			return AgoraUtil.uploadIdeaInbox(requestData.data, requestData.sort, requestData.ext);
		}
		if (requestData.rename) {
			if (requestData.key) {
				return { name: await AgoraUtil.renameIdeaEntry(requestData.name, requestData.key, requestData.title) };
			}
			return { name: await AgoraUtil.renameIdea(requestData.oldName, requestData.newName) };
		}
		if (requestData.remove) {
			if (requestData.inbox) {
				return { name: await AgoraUtil.removeIdeaInbox(requestData.name) };
			}
			return { name: await AgoraUtil.removeIdea(requestData.name) };
		}
		if (requestData.kind == "settings") {
			if (requestData.setting == null) {
				return AgoraUtil.readIdeaSettings();
			}
			return AgoraUtil.writeIdeaSettings(requestData.setting);
		}
		if (requestData.kind == "summary") {
			if (requestData.content == null) {
				return AgoraUtil.readIdeaSummary(requestData.name);
			}
			return AgoraUtil.writeIdeaSummary(requestData.name, requestData.content);
		}
		if (requestData.kind == "description") {
			if (requestData.content == null) {
				return AgoraUtil.readIdeaDescription(requestData.name);
			}
			return AgoraUtil.writeIdeaDescription(requestData.name, requestData.content);
		}
		if (requestData.kind == "catalogue") {
			if (requestData.content == null) {
				return AgoraUtil.readIdeaCatalogue(requestData.name);
			}
			return AgoraUtil.writeIdeaCatalogue(requestData.name, requestData.content);
		}
		if (requestData.kind == "entry") {
			if (requestData.content == null) {
				return AgoraUtil.readIdeaEntry(requestData.name, requestData.key);
			}
			return AgoraUtil.writeIdeaEntry(requestData.name, requestData.key, requestData.content);
		}
		if (requestData.kind == "inbox") {
			if (requestData.content == null) {
				return AgoraUtil.readIdeaInbox(requestData.name);
			}
			return AgoraUtil.writeIdeaInbox(requestData.name, requestData.content);
		}
		return null;
	}

	export async function handleArk(requestData: any, response: any): Promise<string> {
		if (requestData.create) {
			return AgoraUtil.createArk(requestData.name);
		}
		if (requestData.remove) {
			return AgoraUtil.removeArk(requestData.name);
		}
		return null;
	}
}

let agoraPort = 8091;
for (let i = 0; i < process.argv.length; ++i) {
	if (process.argv[i] == "--port" && i + 1 < process.argv.length) {
		agoraPort = parseInt(process.argv[i + 1]) || agoraPort;
	}
}

AgoraUtil.initialize();
startServer(
	agoraPort,
	{ route: "/api/arks", handler: AgoraServer.handleArks },
	{ route: "/api/models", handler: AgoraServer.handleModels },
	{ route: "/api/chats", handler: AgoraServer.handleChats },
	{ route: "/api/create", handler: AgoraServer.handleCreate },
	{ route: "/api/copy", handler: AgoraServer.handleCopy },
	{ route: "/api/clear", handler: AgoraServer.handleClear },
	{ route: "/api/delete", handler: AgoraServer.handleDelete },
	{ route: "/api/archive", handler: AgoraServer.handleArchive },

	// support codes for settings UI

	{ route: "/api/content/raw", handler: AgoraServer.handleRawSettings },
	{ route: "/api/content/context", handler: AgoraServer.handleContextEntry },
	{ route: "/api/content/prompts", handler: AgoraServer.handlePrompts },
	{ route: "/api/content/prompt", handler: AgoraServer.handlePrompt },
	{ route: "/api/content/ark", handler: AgoraServer.handleArk },
	{ route: "/api/content/documents", handler: AgoraServer.handleDocuments },
	{ route: "/api/content/document", handler: AgoraServer.handleDocument },
	{ route: "/api/content/memories", handler: AgoraServer.handleMemories },
	{ route: "/api/content/memory", handler: AgoraServer.handleMemory },
	{ route: "/api/content/models", handler: AgoraServer.handleModelList },
	{ route: "/api/content/model", handler: AgoraServer.handleModel },
	{ route: "/api/content/images", handler: AgoraServer.handleImages },
	{ route: "/api/content/image", handler: AgoraServer.handleImage },
	{ route: "/api/content/todos", handler: AgoraServer.handleTodos },
	{ route: "/api/content/todo", handler: AgoraServer.handleTodo },
	{ route: "/api/content/ideas", handler: AgoraServer.handleIdeas },
	{ route: "/api/content/idea", handler: AgoraServer.handleIdea },
	{ route: "/api/settings", handler: AgoraServer.handleSettings },
	{ route: "/api/context", handler: AgoraServer.handleContext },
	{ route: "/api/transcript", handler: AgoraServer.handleTranscript },
	{ route: "/api/pop", handler: AgoraServer.handlePop },
	{ route: "/api/send", handler: AgoraServer.handleSend },
	{ route: "/api/speech", handler: AgoraServer.handleSpeech },
	{ route: "/api/listen", handler: AgoraServer.handleListen },
	{ route: "/api/silence", handler: AgoraServer.handleSilence },
	{ route: "/api/hand", handler: AgoraServer.handleHand },
	{ route: "/api/abort", handler: AgoraServer.handleAbort },

	{ route: "/ui/images/", dir: SettingsUtil.getLocation("/ThinkTank/Agora/Images/Images/") },

	{ route: "/ui/content/", dir: "./web/content/" },
	{ route: "/ui/", dir: "./web/agora-ui/" }
);