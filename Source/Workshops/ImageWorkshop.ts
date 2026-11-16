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

type ImageUploadMode = "raw" | "save" | "describe";

interface ImageSettings {
	enabled: boolean;
	upload: ImageUploadMode;
	prompt: string;
	convertLargeCommand: string;
	convertSmallCommand: string;
}

interface ImageCatalogueEntry {
	time: number;
	ext: string;
	title: string;
	short: string;
	long: string;
}

interface ImageDescription {
	title: string;
	short: string;
	long: string;
}

interface ImageFiles {
	original: string;
	large: string;
	small: string;
}

namespace ImageWorkshop {
	export const rootPath = SettingsUtil.getLocation("/ThinkTank/Agora/Images");
	export const settingsPath = NodeUtil.getPath(rootPath, "settings.json");
	export const cataloguePath = NodeUtil.getPath(rootPath, "catalogue.json");
	export const storagePath = NodeUtil.getPath(rootPath, "Images");

	export const defaultSettings: ImageSettings = {
		enabled: true,
		upload: "describe",
		prompt: "Describe this image, plain text, no formatting.\nUse this template:\n\nTitle: [short title]\nShort: [one line summary]\n[detailed description]",
		convertLargeCommand: "",
		convertSmallCommand: ""
	};

	export function getActions(params: CombinedParams): Dict<Dict<ActionCallback>> {
		if (params.image.enabled) {
			return {
				image: {
					list: listAction,
					search: searchAction,
					view: viewAction
				}
			};
		}
		return {};
	}

	export async function initialize(): Promise<void> {
		const commands = await detectCommands();
		await LibraryUtil.ensure(rootPath, { ...defaultSettings, ...commands });
		await WorkshopUtil.scheduleEvery("image-main", "1d");
	}

	export async function readSettings(): Promise<ImageSettings> {
		return SettingsUtil.read(settingsPath, defaultSettings);
	}

	export async function editSettings(overrides: Partial<ImageSettings>): Promise<ImageSettings> {
		return SettingsUtil.edit(settingsPath, overrides, defaultSettings);
	}

	export async function getPromptParts(params: CombinedParams): Promise<PromptPart[]> {
		if (params.image.enabled == false) {
			return [];
		}
		return [{
			variable: "ACTIONS",
			description: "Image actions",
			content: `Image Actions:
List stored images:
@image-list
Search images by words:
@image-search <words>
View an image by name:
@image-view <name>`
		}];
	}

	export async function listAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const catalogueData = await LibraryUtil.readEntries<ImageCatalogueEntry>(cataloguePath);
		const parts = [];
		for (const key in catalogueData) {
			const entry = catalogueData[key];
			parts.push(`image: ${key} description: ${entry.short}`)
		}
		const content = parts.join("\n");
		return { type: "message", time: Date.now(), role: "env", name: "images-list", content };
	}

	export async function searchAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		// TODO: Implement.
		return null;
	}

	export async function viewAction(params: CombinedParams, entry: ContextEntry, args: string): Promise<ContextEntry> {
		const name = args.trim();
		let key = name;
		let item = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
		if (item == null) {
			key = ImageWorkshop.parseFileName(name).name;
			item = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, key);
		}
		if (item) {
			return { type: "image", name: `${key}.original.${item.ext}`, content: item.long };
		}
		return { type: "message", time: Date.now(), role: "env", name: "image-read", content: "missing image" };
	}

	export async function readImage(name: string): Promise<string> {
		const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
		if (entry) {
			return readRAW(name, entry.ext);
		}
		return null;
	}

	export async function readRAW(name: string, ext: string): Promise<string> {
		if (ext == null) {
			return null;
		}
		const files = getFileNames(name, ext);
		try {
			const path = NodeUtil.getPath(storagePath, files.large);
			const data = await NodeUtil.readFilePromise(path);
			return data.toString("base64");
		} catch {
			// may not exist
		}
		try {
			const path = NodeUtil.getPath(storagePath, files.original);
			const data = await NodeUtil.readFilePromise(path);
			return data.toString("base64");
		} catch {
			// may not exist
		}
		return null;
	}

	export async function onWakeUp(params: any): Promise<void> {
		const settings = await readSettings();
		if (settings.enabled) {
			// TODO: Implement folder cleanup.
		}
	}

	export async function processImage(params: CombinedParams, entry: ContextEntry): Promise<ContextEntry> {
		const settings = await readSettings();
		const { ext, data } = parseContent(entry.content);
		if (settings.upload == "raw") {
			return { ...entry, content: data };
		}
		const parts = await LibraryUtil.nextParts(cataloguePath);
		const name = `${parts.year}-${parts.month}-${parts.day}-${parts.padded}`;
		const time = parts.time;
		if (settings.upload == "save") {
			const short = "An uploaded image.";
			const long = "An uploaded image.";
			await saveImage(name, ext, data);
			await LibraryUtil.setEntry(cataloguePath, name, { time, ext, short, long });
			return { type: "image", name: `${name}.original.${ext}`, content: long };
		}
		params.handler.streamInfo("Describing image:");
		const { title, short, long } = await describeContent(params, data);
		const base = `${name}-${title}`;
		await saveImage(base, ext, data);
		await LibraryUtil.setEntry(cataloguePath, base, { time, ext, title, short, long });
		return { type: "image", name: `${base}.original.${ext}`, content: long };
	}

	export async function convertArkImage(params: CombinedParams, entry: ContextEntry, template: TranscriptTemplate, needsImage: boolean): Promise<ChatMessage> {
		if (entry.name == "raw") {
			if (needsImage) {
				return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template), images: [ entry.content ]};
			}
			// an excluded raw image keeps only its header
			return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template) };
		}
		if (needsImage) {
			const file = ImageWorkshop.parseFileName(entry.name);
			// a legacy entry names only the catalogue key, so the ext comes from there
			const ext = file.ext ?? (await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, file.name))?.ext;
			const image = await readRAW(file.name, ext);
			if (image) {
				return { role: "user", content: ContextUtil.entryToText({ ...entry, content: "" }, template), images: [ image ]};
			}
		}
		return { role: "user", content: ContextUtil.entryToText(entry, template) };
	}

	export function parseContent(content: string): { ext: string, data: string } {
		const match = content.match(/^ext=([^\n]+)\ndata=([\s\S]+)/);
		if (match) {
			return { ext: match[1], data: match[2] };
		}
		return { ext: "png", data: content };
	}

	// Raw image entries carry only the base64 data, so the type is read from it.
	export function detectExt(data: string): string {
		if (data.startsWith("/9j/")) {
			return "jpeg";
		}
		if (data.startsWith("iVBOR")) {
			return "png";
		}
		if (data.startsWith("R0lGOD")) {
			return "gif";
		}
		if (data.startsWith("UklGR")) {
			return "webp";
		}
		return "png";
	}

	export function getFileNames(name: string, ext: string): ImageFiles {
		return {
			original: `${name}.original.${ext}`,
			large: `${name}.large.${ext}`,
			small: `${name}.small.${ext}`
		};
	}

	export async function saveImage(name: string, ext: string, data: string): Promise<ImageFiles> {
		const settings = await readSettings();
		await NodeUtil.makeDirPromise(storagePath, { recursive: true });
		const files = getFileNames(name, ext);
		const originalPath = NodeUtil.getPath(storagePath, files.original);
		await NodeUtil.writeFilePromise(originalPath, Buffer.from(data, "base64"));
		if (settings.convertLargeCommand) {
			const largePath = NodeUtil.getPath(storagePath, files.large);
			await convertImage(settings.convertLargeCommand, originalPath, largePath);
		}
		if (settings.convertSmallCommand) {
			const smallPath = NodeUtil.getPath(storagePath, files.small);
			await convertImage(settings.convertSmallCommand, originalPath, smallPath);
		}
		return files;
	}

	export async function describeImage(params: CombinedParams, name: string, ext: string): Promise<string> {
		const image = await readRAW(name, ext);
		if (image == null) {
			return null;
		}
		const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
		const described = await describeContent(params, image);
		await LibraryUtil.setEntry(cataloguePath, name, { ...entry, title: described.title, short: described.short, long: described.long });
		return described.short;
	}

	// Regenerates the catalogue description from the stored image.
	export async function summarizeImage(params: CombinedParams, name: string): Promise<ImageCatalogueEntry> {
		const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
		if (entry == null) {
			return null;
		}
		const image = await readRAW(name, entry.ext);
		if (image == null) {
			return null;
		}
		const described = await describeContent(params, image);
		const result = { ...entry, title: described.title, short: described.short, long: described.long };
		const newName = LibraryUtil.buildName(entry.time, described.title);
		if (newName != name && await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, newName) == null) {
			await moveEntryFiles(name, newName, entry.ext);
			await LibraryUtil.removeEntry(cataloguePath, name);
			await LibraryUtil.setEntry(cataloguePath, newName, result);
			return result;
		}
		await LibraryUtil.setEntry(cataloguePath, name, result);
		return result;
	}

	export async function describeContent(params: CombinedParams, data: string): Promise<ImageDescription> {
		const values = await generateDescription(params, data);
		const title = resolveName(values.title) || "Untitled";
		const short = values.short || "An uploaded image.";
		const long = values.long.trim();
		return { title, short, long };
	}

	// The stored file is `<name>.<variant>.<ext>`; a legacy entry may carry only the key.
	export function parseFileName(fileName: string): { name: string, ext: string } {
		const dot = (fileName ?? "").lastIndexOf(".");
		if (dot < 0) {
			return { name: fileName, ext: null };
		}
		const ext = fileName.slice(dot + 1);
		const base = fileName.slice(0, dot);
		const variant = base.match(/^(.*)\.(original|large|small)$/);
		if (variant) {
			return { name: variant[1], ext };
		}
		return { name: base, ext };
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
		const prompt = params.image.prompt;
		const context: ChatMessage[] = [ { role: "user", images: [ data ]} ];
		const model = ModelUtil.resolve(params, params.generate.visionModel);
		const fields = {
			title: { name: "Title", description: "short title" },
			short: { name: "Short", description: "one line summary" },
			long: { name: null, description: "detailed description of the image" }
		};
		return GenerateUtil.generateFields(params, model, prompt, context, fields);
	}

	// The description replaces the image when the model cannot see it.
	export async function describeEntry(entry: ContextEntry, template: TranscriptTemplate): Promise<string> {
		return ContextUtil.entryToText(entry, template);
	}

	export async function detectCommands(): Promise<Partial<ImageSettings>> {
		if (await NodeUtil.executeProcess("sips", "", "--help")) {
			return {
				convertLargeCommand: "sips -Z 1536 {{input}} --out {{output}}",
				convertSmallCommand: "sips -Z 768 {{input}} --out {{output}}"
			};
		}
		if (await NodeUtil.executeProcess("ffmpeg", "", "-version")) {
			return {
				convertLargeCommand: "ffmpeg -i {{input}} -vf scale=1536:1536:force_original_aspect_ratio=decrease {{output}}",
				convertSmallCommand: "ffmpeg -i {{input}} -vf scale=768:768:force_original_aspect_ratio=decrease {{output}}"
			};
		}
		if (await NodeUtil.executeProcess("magick", "", "-version")) {
			return {
				convertLargeCommand: "magick {{input}} -resize 1536x1536 {{output}}",
				convertSmallCommand: "magick {{input}} -resize 768x768 {{output}}"
			};
		}
		return {
			convertLargeCommand: null,
			convertSmallCommand: null
		};
	}

	export async function convertImage(command: string, inputPath: string, outputPath: string): Promise<void> {
		const args = [];
		for (const part of command.split(" ")) {
			args.push(part
				.replace("{{input}}", inputPath)
				.replace("{{output}}", outputPath));
		}
		await NodeUtil.executeProcess(args[0], "", ...args.slice(1));
	}

	// support codes for settings UI

	export async function listImages(): Promise<string[]> {
		const catalogueData = await LibraryUtil.readEntries<ImageCatalogueEntry>(cataloguePath);
		const result = [];
		for (const name in catalogueData) {
			result.push(name);
		}
		result.sort();
		return result;
	}

	export async function readCatalogueEntry(name: string): Promise<ImageCatalogueEntry> {
		return LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
	}

	export async function writeCatalogueEntry(name: string, entry: ImageCatalogueEntry): Promise<ImageCatalogueEntry> {
		await LibraryUtil.setEntry(cataloguePath, name, entry);
		return entry;
	}

	// A fresh upload under the library index, ready to be described.
	export async function saveUpload(ext: string, data: string): Promise<string> {
		const { year, month, day, time, padded } = await LibraryUtil.nextParts(cataloguePath);
		const name = `${year}-${month}-${day}-${padded}`;
		await saveImage(name, ext, data);
		await LibraryUtil.setEntry(cataloguePath, name, { time, ext, title: "", short: "", long: "" });
		return name;
	}

	// A fresh upload under the library index, the derived versions beside it.
	export async function uploadImage(ext: string, data: string): Promise<ImageCatalogueEntry> {
		const name = await ImageWorkshop.saveUpload(ext, data);
		return LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
	}

	// Every file moves beside the entry, a missing derived one is not an error.
	export async function renameImage(oldName: string, newName: string): Promise<string> {
		const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, oldName);
		if (entry == null) {
			return null;
		}
		const name = LibraryUtil.buildName(entry.time, newName);
		if (name != oldName && await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name)) {
			return null;
		}
		await moveEntryFiles(oldName, name, entry.ext);
		await LibraryUtil.removeEntry(cataloguePath, oldName);
		await LibraryUtil.setEntry(cataloguePath, name, entry);
		return name;
	}

	async function moveEntryFiles(oldName: string, newName: string, ext: string): Promise<void> {
		const oldFiles = getFileNames(oldName, ext);
		const newFiles = getFileNames(newName, ext);
		await moveFile(oldFiles.original, newFiles.original);
		await moveFile(oldFiles.large, newFiles.large);
		await moveFile(oldFiles.small, newFiles.small);
	}

	export async function removeImage(name: string): Promise<string> {
		const entry = await LibraryUtil.getEntry<ImageCatalogueEntry>(cataloguePath, name);
		const files = getFileNames(name, entry.ext);
		await removeFile(files.original);
		await removeFile(files.large);
		await removeFile(files.small);
		await LibraryUtil.removeEntry(cataloguePath, name);
		return name;
	}

	export async function moveFile(from: string, to: string): Promise<void> {
		try {
			await NodeUtil.renamePromise(NodeUtil.getPath(storagePath, from), NodeUtil.getPath(storagePath, to));
		} catch {
			// the derived file may not exist
		}
	}

	export async function removeFile(file: string): Promise<void> {
		try {
			await NodeUtil.removePromise(NodeUtil.getPath(storagePath, file));
		} catch {
			// may not exist
		}
	}
}
