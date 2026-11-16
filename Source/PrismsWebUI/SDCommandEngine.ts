/// <reference path="../Language/BaseCommandEngine.ts" />
/// <reference path="../PrismsLibrary/CommonUtil.ts" />
/// <reference path="GenParam.ts" />
/// <reference path="Catalogue.ts" />

type GenHandler = (taskData: GenParam) => void;

class SDCommandEngine extends BaseCommandEngine {
	private initial: GenParam;
	private current: GenParam;
	private positive: string;
	private negative: string;
	private handler: GenHandler;

	public constructor() {
		super();
		this.commands = {
			...this.buildAPIMap(),
			...this.buildCustomMap()
		};
	}

	public init(taskData: GenParam, handler: GenHandler): void {
		this.initial = ParamUtil.duplicateSDGen(taskData);
		this.current = ParamUtil.duplicateSDGen(taskData);
		this.positive = taskData.positivePrompt;
		this.negative = taskData.negativePrompt;
		this.handler = handler;
	}

	private buildAPIMap(): CommandMap {
		const result = {};
		for (const key in defaultGenParam) {
			switch (typeof defaultGenParam[key]) {
				case "string":
					result[key] = (parameters: ParameterList) => this.current[key] = parameters.nextString();
					break;
				case "number":
					result[key] = (parameters: ParameterList) => this.current[key] = parameters.nextFloat();
					break;
				case "boolean":
					result[key] = (parameters: ParameterList) => this.current[key] = parameters.nextBool();
					break;
			}
		}
		return result;
	}

	private buildCustomMap(): CommandMap {
		return {
			generate: this.handleGenerate,
			defaults: this.handleDefaults,
			reset: this.handleReset,
			empty: this.handleEmpty,
			model: this.createStandardHandler(
				"model", modelCatalogue, undefined
			),
			refinerModel: this.createStandardHandler(
				"refinerModel", modelCatalogue, undefined
			),
			lora: this.handleLoRA,
			control: this.handleControl,
			sampler: this.createStandardHandler(
				"sampler", samplerCatalogue, undefined
			),
			seed: this.handleSeed,
			seedMode: this.createStandardHandler(
				"seedMode", seedModeCatalogue, undefined
			),
			size: this.handleSize,
			aspect: this.handleAspect,
			enableHiRes: this.createStandardHandler(
				"hiRes", "const", true
			),
			setHiRes: this.createStandardHandler(
				"hiRes", "const", true,
				"hiResWidth", "int", undefined,
				"hiResHeight", "int", undefined,
				"hiResStrength", "float", undefined
			),
			disableHiRes: this.createStandardHandler(
				"hiRes", "const", false
			)
		};
	}

	private createStandardHandler(...targets): CommandHandler {
		return (parameterList) => {
			let i = 0;
			while (i < targets.length) {
				const key = targets[i++];
				const type = targets[i++];
				const fallback = targets[i++];
				if (type instanceof SimpleCatalogue) {
					this.current[key] = type.get(parameterList.nextString(fallback))
				} else if (type == "const") {
					this.current[key] = fallback;
				} else if (type == "string") {
					this.current[key] = parameterList.nextString(fallback);
				} else if (type == "float") {
					this.current[key] = parameterList.nextFloat(fallback);
				} else if (type == "int") {
					this.current[key] = parameterList.nextInt(fallback);
				} else {
					this.current[key] = fallback;
				}
			}
		};
	}

	private handleDefaults = (parameters: ParameterList) => {
		ParamUtil.overrideGen(this.current, defaultGenParam);
	}

	private handleReset = (parameters: ParameterList) => {
		ParamUtil.overrideGen(this.current, this.initial);
	}

	private handleEmpty = (parameters: ParameterList) => {
		this.positive = "";
		this.negative = "";
	}

	private handleLoRA = (parameters: ParameterList) => {
		const index = parameters.nextInt();
		if (index < 1) {
			throw "LoRA indexing should start from 1.";
		}
		this.current.loras[index - 1] = {
			file: loraCatalogue.get(parameters.nextString()),
			weight: parameters.nextFloat(1)
		}
	}

	private handleControl = (parameters: ParameterList) => {
		const index = parameters.nextInt();
		if (index < 1) {
			throw "Control indexing should start from 1.";
		}
		this.current.controls[index - 1] = {
			file: controlCatalogue.get(parameters.nextString()),
			weight: parameters.nextFloat(1),
			priority: parameters.nextString("balanced"),
			start: parameters.nextFloat(0),
			end: parameters.nextFloat(1)
		};
	}

	private handleSeed = (parameters: ParameterList) => {
		this.current.seed = parameters.nextInt(XSRandom.next(this.current.seed));
	}

	private handleSize = (parameters: ParameterList) => {
		this.current.width = parameters.nextInt();
		this.current.height = parameters.nextInt();
	}

	private swapHorizontal(target: GenParam, widthKey: string, heightKey: string) {
		const width = target[widthKey];
		const height = target[heightKey];
		target[widthKey] = Math.max(width, height);
		target[heightKey] = Math.min(width, height);
	}

	private swapVertical(target: GenParam, widthKey: string, heightKey: string) {
		const width = target[widthKey];
		const height = target[heightKey];
		target[widthKey] = Math.min(width, height);
		target[heightKey] = Math.max(width, height);
	}

	public matchAspect(target: GenParam, aspect: string): void {
		if (aspect == "horizontal") {
			this.swapHorizontal(target, "width", "height");
			this.swapHorizontal(target, "hiResWidth", "hiResHeight");
			this.swapHorizontal(target, "originalWidth", "originalHeight");
			this.swapHorizontal(target, "targetWidth", "targetHeight");
			this.swapHorizontal(target, "negativeWidth", "negativeHeight");
		} else if (aspect == "vertical") {
			this.swapVertical(target, "width", "height");
			this.swapVertical(target, "hiResWidth", "hiResHeight");
			this.swapVertical(target, "originalWidth", "originalHeight");
			this.swapVertical(target, "targetWidth", "targetHeight");
			this.swapVertical(target, "negativeWidth", "negativeHeight");
		} else {
			throw "Aspect should be horizontal or vertical.";
		}
	}

	private handleAspect = (parameters: ParameterList) => {
		this.matchAspect(this.current, parameters.nextString());
	}

	private handleGenerate = (parameters: ParameterList) => {
		if (typeof this.negative == "string") {
			this.current.negativePrompt = this.negative;
			this.negative = null;
		}
		if (typeof this.positive == "string") {
			this.current.positivePrompt = this.positive;
			this.positive = null;
		}
		this.handler(ParamUtil.duplicateSDGen(this.current));
	}

	protected override handlePositive(line: string): void {
		if (this.positive) {
			this.positive += "\n";
			this.positive += line;
		} else {
			this.positive = line;
		}
	}

	protected override handleNegative(line: string): void {
		if (this.negative) {
			this.negative += "\n";
			this.negative += line;
		} else {
			this.negative = line;
		}
	}

	protected override handleEnd(): void {
		if (typeof this.negative == "string") {
			this.current.negativePrompt = this.negative;
			this.negative = null;
		}
		if (this.positive) {
			this.current.positivePrompt = this.positive;
			this.positive = null;
			this.handler(ParamUtil.duplicateSDGen(this.current));
		}
	}
}