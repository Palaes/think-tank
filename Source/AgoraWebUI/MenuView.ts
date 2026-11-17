/// <reference path="./CollapseGroup.ts" />

type SettingsLayer = "global" | "chat" | "ark";

interface SettingsRow {
	label: string;
	section: string;
	key: string;
}

class MenuView {
	private static readonly modelRows: { [ key: string ]: SettingsRow[] } = {
		global: [
			{ label: "main", section: "generate", key: "mainModel" },
			{ label: "vision", section: "generate", key: "visionModel" },
			{ label: "small", section: "generate", key: "smallModel" }
		],
		chat: [
			{ label: "main", section: "generate", key: "mainModel" },
			{ label: "vision", section: "generate", key: "visionModel" },
			{ label: "small", section: "generate", key: "smallModel" }
		],
		ark: [
			{ label: "main", section: "generate", key: "mainModel" },
			{ label: "vision", section: "generate", key: "visionModel" },
			{ label: "memory", section: "memory", key: "model" }
		]
	};

	private static readonly modelHints: { [ key: string ]: string } = {
		main: "Model used for generating chat responses.",
		vision: "Model used when chat has recent images.",
		memory: "Used to generate Ark memories."
	};

	private static readonly toggleRows: SettingsRow[] = [
		{ label: "clock", section: "process", key: "useClock" },
		{ label: "archive", section: "process", key: "useArchive" },
		{ label: "learn", section: "memory", key: "allowWrite" },
		{ label: "recall", section: "memory", key: "allowRead" },
		{ label: "ideas", section: "idea", key: "enabled" },
	];

	private static readonly globalToggleRows: SettingsRow[] = [
		{ label: "audio", section: "tts", key: "enabled" },
	];

	private static readonly temperatureValues = [ 0, 0.25, 0.5, 0.75, 1 ];

	private parent: AgoraUI;
	private container: HTMLElement;

	private globalModels: { [ key: string ]: HTMLSelectElement } = {};
	private chatModels: { [ key: string ]: HTMLSelectElement } = {};
	private arkModels: { [ key: string ]: HTMLSelectElement } = {};
	private globalToggles: { [ key: string ]: HTMLInputElement } = {};
	private chatToggles: { [ key: string ]: HTMLInputElement } = {};
	private arkToggles: { [ key: string ]: HTMLInputElement } = {};
	private buttonGroups: Map<CollapseGroup, HTMLElement> = new Map();
	private chatArk: HTMLSelectElement;
	private chatTemperature: HTMLSelectElement;
	private arkTemperature: HTMLSelectElement;

	private chatID: string;
	private arkName: string;
	private modelNames: string[] = [];
	// private models: { [ key: string ]: ModelSettings } = {};
	private globalSettings: AgoraSettings = {};
	private chatSettings: AgoraSettings = {};
	private arkSettings: AgoraSettings = {};

	public constructor(parent: AgoraUI, container: HTMLElement) {
		this.parent = parent;
		this.container = container;
		this.buildGlobalGroup();
		this.buildChatGroup();
		this.buildArkGroup();
	}

	public async loadMenu(chatID: string): Promise<void> {
		this.chatID = chatID;
		this.globalSettings = await AgoraAPI.settings(null, null, false, null) ?? {};
		this.chatSettings = await AgoraAPI.settings(chatID, null, false, null) ?? {};
		this.arkName = this.readValue(this.chatSettings, "process", "arkName") ?? this.readValue(this.globalSettings, "process", "arkName");
		this.arkSettings = await this.loadArkSettings(this.arkName);

		this.modelNames = await AgoraAPI.modelList() ?? [];
		this.fillOptions(await AgoraAPI.models(), await AgoraAPI.arks());
		this.applyGlobalLayer();
		this.applyChatLayer();
		this.applyArkLayer();
	}

	private buildGlobalGroup(): void {
		const group = new CollapseGroup(this.container, "Global Settings");
		this.addAction(group, "edit settings", () => this.openSettingsEditor("global"));
		this.addAction(group, "manage models", () => this.openModelEditor());
		this.addAction(group, "manage images", () => this.openImageEditor());
		this.addAction(group, "manage documents", () => this.openDocumentEditor());
		this.addAction(group, "manage todos", () => this.openTodoEditor());
		this.addAction(group, "manage ideas", () => this.openIdeaEditor());
		this.buildModelRows(group, "global", this.globalModels);
		this.buildToggleRows(group, "global", this.globalToggles, MenuView.globalToggleRows);
	}

	private buildChatGroup(): void {
		const group = new CollapseGroup(this.container, "Chat Settings");
		this.addAction(group, "edit settings", () => this.openSettingsEditor(this.chatID));
		this.addAction(group, "manage context", () => this.openContextEditor());
		this.addAction(group, "archive chat", () => this.parent.onArchive());
		this.addAction(group, "save chat", () => this.parent.onSaveDocument());
		this.addAction(group, "copy chat", () => this.parent.onCopyContent());
		this.chatArk = document.createElement("select");
		this.chatArk.addEventListener("change", this.onArkChange);
		this.addRow(group, "Ark", this.chatArk);
		this.buildModelRows(group, "chat", this.chatModels);
		this.chatTemperature = this.buildTemperatureRow(group, "chat");
		this.buildToggleRows(group, "chat", this.chatToggles);
	}

	// the context editor is its own page, opened for the chat on screen
	private openContextEditor(): void {
		window.open(`/ui/content/context.html?chat=${this.chatID}`, "_blank");
	}

	// the settings editor opens on the global layer or on the chat on screen
	private openSettingsEditor(chatID: string): void {
		window.open(`/ui/content/chats.html?chat=${chatID}`, "_blank");
	}

	// the ark editor opens on the ark in use
	private openArkEditor(): void {
		if (this.arkName) {
			window.open(`/ui/content/arks.html?ark=${this.arkName}`, "_blank");
		}
	}

	// the model editor opens on the model the chat runs
	private openModelEditor(): void {
		const model = this.readValue(this.chatSettings, "generate", "mainModel") ?? this.readValue(this.arkSettings, "generate", "mainModel") ?? this.readValue(this.globalSettings, "generate", "mainModel");
		if (model) {
			window.open(`/ui/content/models.html?model=${encodeURIComponent(this.findModelName(model))}`, "_blank");
			return;
		}
		window.open("/ui/content/models.html", "_blank");
	}

	// the resolved name is the raw key plus a variant, the editor lists raw keys
	private findModelName(model: string): string {
		if (this.modelNames.indexOf(model) >= 0) {
			return model;
		}
		let result = null;
		for (const name of this.modelNames) {
			if (model.startsWith(`${name} `)) {
				if (result == null || name.length > result.length) {
					result = name;
				}
			}
		}
		return result ?? model;
	}

	// the memory editor is per ark, so it follows the ark in use
	private openMemoryEditor(): void {
		if (this.arkName) {
			window.open(`/ui/content/memory.html?ark=${this.arkName}`, "_blank");
		}
	}

	// the remaining editors are pages of their own
	private openImageEditor(): void {
		window.open("/ui/content/images.html", "_blank");
	}

	private openDocumentEditor(): void {
		window.open("/ui/content/documents.html", "_blank");
	}

	private openTodoEditor(): void {
		window.open("/ui/content/todos.html", "_blank");
	}

	private openIdeaEditor(): void {
		window.open("/ui/content/ideas.html", "_blank");
	}

	private buildArkGroup(): void {
		const group = new CollapseGroup(this.container, "Ark Settings");
		this.addAction(group, "edit settings", () => this.openArkEditor());
		this.addAction(group, "manage memory", () => this.openMemoryEditor());
		this.buildModelRows(group, "ark", this.arkModels);
		this.arkTemperature = this.buildTemperatureRow(group, "ark");
		this.buildToggleRows(group, "ark", this.arkToggles);
	}

	private buildModelRows(group: CollapseGroup, layer: SettingsLayer, controls: { [ key: string ]: HTMLSelectElement }): void {
		for (const row of MenuView.modelRows[layer]) {
			const select = document.createElement("select");
			select.addEventListener("change", () => this.onModelChange(layer, row, select));
			controls[row.label] = select;
			this.addRow(group, row.label, select, MenuView.modelHints[row.label]);
		}
	}

	private async onModelChange(layer: SettingsLayer, row: SettingsRow, select: HTMLSelectElement): Promise<void> {
		await this.saveLayer(layer, this.buildPatch(row.section, row.key, select.value ? select.value : null));
	}

	private buildTemperatureRow(group: CollapseGroup, layer: SettingsLayer): HTMLSelectElement {
		const select = document.createElement("select");
		select.addEventListener("change", () => this.saveLayer(layer, this.buildPatch("generate", "temp", select.value ? Number(select.value) : null)));
		this.addRow(group, "temp", select);
		return select;
	}

	private buildToggleRows(group: CollapseGroup, layer: SettingsLayer, controls: { [ key: string ]: HTMLInputElement }, rows: SettingsRow[] = MenuView.toggleRows): void {
		for (const row of rows) {
			const input = document.createElement("input");
			input.type = "checkbox";
			input.addEventListener("change", () => this.saveToggle(layer, row, input));
			controls[row.label] = input;
			this.addRow(group, row.label, input);
		}
	}

	// on removes this layer's restriction, off forces one
	private saveToggle(layer: SettingsLayer, row: SettingsRow, input: HTMLInputElement): void {
		const value = input.checked ? null : false;
		this.saveLayer(layer, this.buildPatch(row.section, row.key, value));
	}

	private async loadArkSettings(arkName: string): Promise<AgoraSettings> {
		if (arkName) {
			return await AgoraAPI.settings(null, arkName, false, null) ?? {};
		}
		return {};
	}

	private async saveLayer(layer: SettingsLayer, settings: AgoraSettings): Promise<void> {
		if (layer == "ark" && this.arkName == null) {
			return;
		}
		const chatID = layer == "chat" ? this.chatID : null;
		const arkName = layer == "ark" ? this.arkName : null;
		const result = await this.parent.saveSettings(chatID, arkName, settings);
		if (layer == "global") {
			this.globalSettings = result;
			this.applyGlobalLayer();
		} else if (layer == "chat") {
			this.chatSettings = result;
			this.applyChatLayer();
		} else {
			this.arkSettings = result;
			this.applyArkLayer();
		}
	}

	private onArkChange = async () => {
		const arkName = this.chatArk.value ? this.chatArk.value : null;
		await this.saveLayer("chat", this.buildPatch("process", "arkName", arkName));
		this.arkName = arkName ?? this.readValue(this.globalSettings, "process", "arkName");
		this.arkSettings = await this.loadArkSettings(this.arkName);
		this.applyArkLayer();
	}

	private applyGlobalLayer(): void {
		this.applyModels("global", this.globalModels, this.globalSettings);
		this.applyToggles(this.globalToggles, this.globalSettings, MenuView.globalToggleRows);
	}

	private applyChatLayer(): void {
		this.applyModels("chat", this.chatModels, this.chatSettings);
		this.chatArk.value = this.readValue(this.chatSettings, "process", "arkName") ?? "";
		this.chatTemperature.value = this.valueText(this.readValue(this.chatSettings, "generate", "temp"));
		this.applyToggles(this.chatToggles, this.chatSettings);
	}

	private applyArkLayer(): void {
		this.applyModels("ark", this.arkModels, this.arkSettings);
		this.arkTemperature.value = this.valueText(this.readValue(this.arkSettings, "generate", "temp"));
		this.applyToggles(this.arkToggles, this.arkSettings);
	}

	private applyModels(layer: SettingsLayer, controls: { [ key: string ]: HTMLSelectElement }, settings: AgoraSettings): void {
		for (const row of MenuView.modelRows[layer]) {
			controls[row.label].value = this.readValue(settings, row.section, row.key) ?? "";
		}
	}

	private applyToggles(controls: { [ key: string ]: HTMLInputElement }, settings: AgoraSettings, rows: SettingsRow[] = MenuView.toggleRows): void {
		for (const row of rows) {
			// unset means no opinion, and a feature is enabled unless some layer denies it
			controls[row.label].checked = this.readValue(settings, row.section, row.key) ?? true;
		}
	}

	private buildPatch(section: string, key: string, value: any): AgoraSettings {
		const result: AgoraSettings = {};
		if (section == "process") {
			result.process = this.processPatch(key, value);
		} else if (section == "generate") {
			result.generate = this.generatePatch(key, value);
		} else if (section == "memory") {
			result.memory = this.memoryPatch(key, value);
		} else if (section == "tts") {
			result.tts = this.ttsPatch(key, value);
		} else {
			result.idea = this.ideaPatch(key, value);
		}
		return result;
	}

	private processPatch(key: string, value: any): SettingsProcess {
		const patch: SettingsProcess = {};
		patch[key] = value;
		return patch;
	}

	private generatePatch(key: string, value: any): SettingsGenerate {
		const patch: SettingsGenerate = {};
		patch[key] = value;
		return patch;
	}

	private memoryPatch(key: string, value: any): SettingsMemory {
		const patch: SettingsMemory = {};
		patch[key] = value;
		return patch;
	}

	private ttsPatch(key: string, value: any): SettingsTTS {
		const patch: SettingsTTS = {};
		patch[key] = value;
		return patch;
	}

	private ideaPatch(key: string, value: any): SettingsIdea {
		const patch: SettingsIdea = {};
		patch[key] = value;
		return patch;
	}

	private readValue(settings: AgoraSettings, section: string, key: string): any {
		const group = settings[section];
		if (group == null) {
			return null;
		}
		return group[key];
	}

	private fillOptions(models: ModelMeta[], arks: string[]): void {
		this.chatArk.innerHTML = "";
		this.chatArk.appendChild(this.buildUnsetOption());
		for (const arkName of arks) {
			this.chatArk.appendChild(this.buildOption(arkName, arkName));
		}
		for (const row of MenuView.modelRows.global) {
			this.fillModelSelect(this.globalModels[row.label], models);
		}
		for (const row of MenuView.modelRows.chat) {
			this.fillModelSelect(this.chatModels[row.label], models);
		}
		for (const row of MenuView.modelRows.ark) {
			this.fillModelSelect(this.arkModels[row.label], models);
		}
		this.fillTemperatureSelect(this.chatTemperature);
		this.fillTemperatureSelect(this.arkTemperature);
	}

	private fillModelSelect(select: HTMLSelectElement, models: ModelMeta[]): void {
		select.innerHTML = "";
		select.appendChild(this.buildUnsetOption());
		const groups = new Map<string, HTMLOptGroupElement>();
		for (const model of models) {
			if (model.group) {
				let group = groups.get(model.group);
				if (group == null) {
					group = document.createElement("optgroup");
					group.label = model.group;
					select.appendChild(group);
					groups.set(model.group, group);
				}
				group.appendChild(this.buildOption(model.name, model.display));
			} else {
				select.appendChild(this.buildOption(model.name, model.display));
			}
		}
	}

	private fillTemperatureSelect(select: HTMLSelectElement): void {
		select.innerHTML = "";
		select.appendChild(this.buildUnsetOption());
		for (const value of MenuView.temperatureValues) {
			select.appendChild(this.buildOption(String(value), String(value)));
		}
	}

	private buildOption(value: string, text: string): HTMLOptionElement {
		const option = document.createElement("option");
		option.innerText = text;
		option.value = value;
		return option;
	}

	private buildUnsetOption(): HTMLOptionElement {
		const option = document.createElement("option");
		option.innerText = "–";
		option.value = "";
		return option;
	}

	private valueText(value: number): string {
		if (value == null) {
			return "";
		}
		return String(value);
	}

	private nextRowID = 0;

	private addRow(group: CollapseGroup, label: string, control: HTMLElement, hint: string = null): void {
		const row = document.createElement("div");
		row.className = "settingRow";
		if (hint) {
			row.title = hint;
		}
		const text = document.createElement("label");
		text.innerText = label;
		// the label toggles a checkbox just like the box itself does
		if (control instanceof HTMLInputElement) {
			control.id = `setting-${++this.nextRowID}`;
			text.htmlFor = control.id;
		}
		row.appendChild(text);
		row.appendChild(control);
		group.content.appendChild(row);
	}

	private addAction(group: CollapseGroup, label: string, handler?: () => void): void {
		const button = document.createElement("button");
		button.innerText = label;
		if (handler) {
			button.addEventListener("click", handler);
		}
		this.getButtonGroup(group).appendChild(button);
	}

	// the group's buttons sit in one tight stack, their own padding is the gap
	private getButtonGroup(group: CollapseGroup): HTMLElement {
		let buttonGroup = this.buttonGroups.get(group);
		if (buttonGroup == null) {
			buttonGroup = document.createElement("div");
			buttonGroup.className = "buttonGroup";
			group.content.appendChild(buttonGroup);
			this.buttonGroups.set(group, buttonGroup);
		}
		return buttonGroup;
	}
}
