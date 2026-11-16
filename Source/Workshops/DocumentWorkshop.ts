/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FileUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />
/// <reference path="../Common/DateUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="../AgoraServer/AgoraStreamer.ts" />
/// <reference path="../AgoraServer/ContextUtil.ts" />
/// <reference path="../ContentServer/LibraryUtil.ts" />
/// <reference path="../AgoraServer/GenerateUtil.ts" />
/// <reference path="../AgoraServer/ParamsUtil.ts" />

type DocumentUploadMode = "raw" | "save" | "describe";

interface DocumentSettings {
	enabled: boolean;
	upload: DocumentUploadMode;
	prompt: string;
	rawCount: number;
	rawLines: number;
	rawLength: number;
}

interface DocumentEntry {
	time: number;
	ext: string;
	title: string;
	short: string,
	long: string;
}

interface DocumentInfo {
	name: string;
	ext: string;
}

namespace DocumentWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Documents");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");
	export const cataloguePath = NodeUtil.getPath(rootPath, "catalogue.json");
	export const storagePath = NodeUtil.getPath(rootPath, "Documents");

	export const defaultSettings: DocumentSettings = {
		enabled: true,
		upload: "describe",
		prompt: "Describe this document, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
		rawCount: 3,
		rawLines: 10,
		rawLength: 200
	}

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.document.enabled) {
			return {
				document: {
					list: listAction,
					search: searchAction,
					read: readAction
				}
			};
		}
		return {};
	}

	export async function initialize(): Promise<void> {
		await LibraryUtil.ensure(DocumentWorkshop.rootPath, DocumentWorkshop.defaultSettings);
		await WorkshopUtil.scheduleEvery("document-main", "1h");
	}

	export async function readSettings(): Promise<DocumentSettings> {
		return SettingsUtil.read(DocumentWorkshop.settingsPath, DocumentWorkshop.defaultSettings);
	}

	export async function editSettings(overrides: Partial<DocumentSettings>): Promise<DocumentSettings> {
		return SettingsUtil.edit(DocumentWorkshop.settingsPath, overrides, DocumentWorkshop.defaultSettings);
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.document.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "Document actions",
			content: `Document Actions:
List stored documents:
@document-list
Search documents by words:
@document-search <words>
Read a document by name:
@document-read <name>`
		}];
	}

	export async function listAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const catalogueData = await LibraryUtil.readEntries<DocumentEntry>(DocumentWorkshop.cataloguePath);
		const parts = [];
		for (const key in catalogueData) {
			const entry = catalogueData[key];
			parts.push(`document: ${key} short: ${entry.short}`);
		}
		const content = parts.join("\n");
		return { type: "message", time: Date.now(), role: "env", name: "documents-list", content };
	}

	export async function searchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		// TODO: Implement search action.
		return null;
	}

	export async function readAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const name = args.trim();
		let key = name;
		let item = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name);
		if (item == null) {
			key = DocumentWorkshop.parseFileName(name).name;
			item = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, key);
		}
		if (item) {
			return { type: "document", name: `${key}.${item.ext}`, content: item.long };
		}
		return { type: "message", time: Date.now(), role: "env", name: "document-read", content: "missing document" };
	}

	export async function readDocument(name: string, ext: string = null): Promise<string> {
		if (ext == null) {
			const entry = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name);
			if (entry == null) {
				return null;
			}
			ext = entry.ext;
		}
		const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
		return FileUtil.readTextLocked(documentPath);
	}

	// Regenerates the catalogue description from the stored file.
	export async function summarizeDocument(params: CombinedParams, name: string): Promise<DocumentEntry> {
		const entry = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name);
		if (entry == null) {
			return null;
		}
		const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${entry.ext}`);
		const data = await FileUtil.readTextLocked(documentPath);
		if (data == null) {
			return null;
		}
		const { title, short, long } = await DocumentWorkshop.describeContent(params, data);
		const result = { ...entry, title, short, long };
		const newName = LibraryUtil.buildName(entry.time, title);
		if (newName != name && await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, newName) == null) {
			const newPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${newName}.${entry.ext}`);
			await NodeUtil.renamePromise(documentPath, newPath);
			await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, name);
			await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, newName, result);
			return result;
		}
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, result);
		return result;
	}

	export async function onWakeUp(params: any): Promise<void> {
		const settings = await DocumentWorkshop.readSettings();
		if (settings.enabled) {
			// TODO: Implement folder cleanup.
		}
	}

	export async function processDocument(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry> {
		const settings = await DocumentWorkshop.readSettings();
		const { ext, data } = DocumentWorkshop.parseContent(entry.content);
		if (settings.upload == "raw") {
			return { ...entry, content: data };
		}
		const parts = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
		const name = `${parts.year}-${parts.month}-${parts.day}-${parts.padded}`;
		const time = parts.time;
		if (settings.upload == "save") {
			const long = TextUtil.shortifyTextNicely(data, settings.rawLines, settings.rawLength);
			const short = "An uploaded document.";
			await DocumentWorkshop.saveDocument(name, ext, data);
			await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short, long });
			return { type: "document", name: `${name}.${ext}`, content: long };
		}
		params.handler.streamInfo("Describing document:")
		const { title, short, long } = await describeContent(params, data);
		const base = `${name}-${title}`;
		await DocumentWorkshop.saveDocument(base, ext, data);
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, base, { time, ext, title, short, long });
		return { type: "document", name: `${base}.${ext}`, content: long };
	}

	export async function convertArkDocument(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsDocument: boolean): Promise<ChatMessage> {
		if (entry.name == "raw") {
			if (needsDocument) {
				return { role: "user", content: ContextUtil.entryToText(entry, template) };
			}
			// an excluded raw document keeps only its header
			return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template) };
		}
		let content = entry.content;
		if (needsDocument) {
			const file = DocumentWorkshop.parseFileName(entry.name);
			const full = await DocumentWorkshop.readDocument(file.name, file.ext);
			if (full != null) {
				content = full;
			}
		}
		return { role: "user", content: ContextUtil.entryToText({ ...entry, content }, template) };
	}

	export function parseContent(content: string): { ext: string, data: string } {
		const match = content.match(/^ext=([^\n]+)\ndata=([\s\S]+)/);
		if (match) {
			return { ext: match[1], data: match[2] };
		}
		return { ext: "txt", data: content };
	}

	export async function saveDocument(name: string, ext: string, data: string): Promise<void> {
		await NodeUtil.makeDirPromise(DocumentWorkshop.storagePath, { recursive: true });
		const documentPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
		await FileUtil.writeTextLocked(documentPath, data);
	}

	export async function describeContent(params: CombinedParams, data: string) {
		const values = await DocumentWorkshop.generateDescription(params, data);
		const title = resolveName(values.title) || "Untitled";
		const short = values.short || "An uploaded document.";
		const long = values.long.trim();
		return { title, short, long };
	}

	// The stored file is `<name>.<ext>`; a legacy entry may carry only the key.
	export function parseFileName(fileName: string): { name: string, ext: string } {
		const dot = (fileName ?? "").lastIndexOf(".");
		if (dot < 0) {
			return { name: fileName, ext: null };
		}
		return { name: fileName.slice(0, dot), ext: fileName.slice(dot + 1) };
	}

	export function resolveName(name: string): string {
		const words = (name ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		const joined = words.join("-");
		if (joined.length <= 80) {
			return joined;
		}
		const cut = joined.slice(0, 80);
		const lastDash = cut.lastIndexOf("-");
		return lastDash < 0 ? cut : cut.slice(0, lastDash);
	}

	export async function generateDescription(params: CombinedParams, data: string): Promise<Dict<string>> {
		const prompt = params.document.prompt;
		const context: ChatMessage[] = [ { role: "user", content: data } ];
		const model = ModelUtil.resolve(params, params.generate.smallModel);
		const fields = {
			title: { name: "Title", description: "short title" },
			short: { name: "Short", description: "one line summary" },
			long: { name: null, description: "detailed description of the document" }
		};
		return GenerateUtil.generateFields(params, model, prompt, context, fields);
	}

	// support codes for settings UI

	export async function listDocuments(): Promise<DocumentInfo[]> {
		const catalogueData = await LibraryUtil.readEntries<DocumentEntry>(DocumentWorkshop.cataloguePath);
		const result = [];
		for (const name in catalogueData) {
			result.push({ name, ext: catalogueData[name].ext ?? "md" });
		}
		result.sort((a, b) => a.name < b.name ? -1 : 1);
		return result;
	}

	export async function readCatalogueEntry(name: string): Promise<DocumentEntry> {
		return LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name);
	}

	export async function writeCatalogueEntry(name: string, entry: DocumentEntry): Promise<DocumentEntry> {
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, entry);
		return entry;
	}

	export async function writeDocument(name: string, ext: string, content: string): Promise<string> {
		await DocumentWorkshop.saveDocument(name, ext, content);
		return content;
	}

	// A fresh document: an empty file under the standard name, and its entry.
	export async function createDocument(): Promise<DocumentInfo> {
		const { year, month, day, time, padded } = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
		const name = `${year}-${month}-${day}-${padded}`;
		const ext = "md";
		await DocumentWorkshop.saveDocument(name, ext, "");
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short: "", long: "" });
		return { name, ext };
	}

	// The typed name may carry an extension; the entry takes the dated name, the
	// file an extension, the typed one when given and the document's own otherwise.
	export async function renameDocument(oldName: string, newName: string): Promise<DocumentInfo> {
		const entry = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, oldName);
		if (entry == null) {
			return null;
		}
		const dot = newName.lastIndexOf(".");
		const typed = dot > 0 ? newName.slice(0, dot) : newName;
		const ext = dot > 0 ? newName.slice(dot + 1) : entry.ext;
		const name = LibraryUtil.buildName(entry.time, typed);
		if (name != oldName && await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name)) {
			return null;
		}
		const oldPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${oldName}.${entry.ext}`);
		const newPath = NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${ext}`);
		await NodeUtil.renamePromise(oldPath, newPath);
		await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, oldName);
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { ...entry, ext });
		return { name, ext };
	}

	// A fresh upload under the library index, its entry filed beside it.
	export async function uploadDocument(ext: string, data: string): Promise<DocumentInfo> {
		const { year, month, day, time, padded } = await LibraryUtil.nextParts(DocumentWorkshop.cataloguePath);
		const name = `${year}-${month}-${day}-${padded}`;
		await DocumentWorkshop.saveDocument(name, ext, data);
		await LibraryUtil.setEntry(DocumentWorkshop.cataloguePath, name, { time, ext, short: "", long: "" });
		return { name, ext };
	}

	export async function removeDocument(name: string): Promise<string> {
		const entry = await LibraryUtil.getEntry<DocumentEntry>(DocumentWorkshop.cataloguePath, name);
		if (entry) {
			try {
				await NodeUtil.removePromise(NodeUtil.getPath(DocumentWorkshop.storagePath, `${name}.${entry.ext}`));
			} catch {
				// may not exist
			}
		}
		await LibraryUtil.removeEntry(DocumentWorkshop.cataloguePath, name);
		return name;
	}
}
