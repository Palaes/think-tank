/// <reference path="./DTGenParam.ts" />

// Builds the metadata written into images and normalises the catalogue entries
// it is derived from. Used by the server, which owns the files.

namespace GenMetadata {

	// The parameters block, the body of the gear icon tooltip in the UI.
	export function describe(taskData: DTHGenParam): string {
		const result: string[] = [];
		result.push(`Seed: ${text(taskData.seed)}`);
		result.push(`Model: ${text(taskData.model)}`);
		if (taskData.refiner_model) {
			result.push(`Refiner Model: ${text(taskData.refiner_model)}`);
			result.push(`Refiner Start: ${text(taskData.refiner_start)}`);
		}
		addLoRAs(result, taskData.loras || []);
		addControls(result, taskData.controls || []);
		result.push(`Sampler: ${text(taskData.sampler)}`);
		result.push(`Steps: ${text(taskData.steps)}`);
		result.push(`CFG: ${text(taskData.guidance_scale)}`);
		result.push(`Shift: ${text(taskData.shift)}`);
		result.push(`SSS: ${text(taskData.stochastic_sampling_gamma)}`);
		// a strength below the plain default means the image was made from another
		if (taskData.strength != null && taskData.strength != 1) {
			result.push(`Strength: ${text(taskData.strength)}`);
		}
		result.push(`Width: ${text(taskData.width)}`);
		result.push(`Height: ${text(taskData.height)}`);
		if (taskData.hires_fix) {
			result.push(`HR Width: ${text(taskData.hires_fix_width)}`);
			result.push(`HR Height: ${text(taskData.hires_fix_height)}`);
			result.push(`HR Strength: ${text(taskData.hires_fix_strength)}`);
		}
		return result.join("\n");
	}

	function addLoRAs(result: string[], loras: DTHLoRAParam[]): void {
		let index = 0;
		for (const lora of loras) {
			if (lora == null) {
				continue;
			}
			result.push(`${ordinal(index)} LoRA File: ${text(lora.file)}`);
			result.push(`${ordinal(index)} LoRA Weight: ${text(lora.weight)}`);
			++index;
		}
	}

	function addControls(result: string[], controls: DTHControlParam[]): void {
		let index = 0;
		for (const control of controls) {
			if (control == null) {
				continue;
			}
			result.push(`${ordinal(index)} Control File: ${text(control.file)}`);
			result.push(`${ordinal(index)} Control Weight: ${text(control.weight)}`);
			++index;
		}
	}

	function ordinal(index: number): string {
		switch (index) {
			case 0:
				return "First";
			case 1:
				return "Second";
			case 2:
				return "Third";
		}
		return `${index + 1}.`;
	}

	// The prompt with its negative lines appended, as the UI combines them.
	export function combine(taskData: DTHGenParam): string {
		const result: string[] = [];
		addLines(result, taskData.prompt, "");
		addLines(result, taskData.negative_prompt, "- ");
		return result.join("\n");
	}

	// The whole config, written where Draw Things keeps its own.
	export function toJSON(taskData: DTHGenParam): string {
		return JSON.stringify(taskData, null, "\t");
	}

	// The image description: the combined prompt, then the parameters on the next line.
	export function describeImage(taskData: DTHGenParam): string {
		const prompt = combine(taskData);
		if (prompt) {
			return `${prompt}\n${describe(taskData)}`;
		}
		return describe(taskData);
	}

	// Makes an entry carry the values the UI would send for it.
	// The secondary size fields only say something while their stage is enabled.
	export function normalize(taskData: DTHGenParam): void {
		if (!taskData.hires_fix) {
			taskData.hires_fix_width = taskData.width;
			taskData.hires_fix_height = taskData.height;
			taskData.hires_fix_strength = 0.5;
		}
		// the image ends up on the larger of the two stages
		const width = Math.max(taskData.width || 0, taskData.hires_fix_width || 0);
		const height = Math.max(taskData.height || 0, taskData.hires_fix_height || 0);
		if (width && height) {
			if (taskData.custom_size_embed == null) {
				// foreign metadata carries no flag, its sizes differ only when it was on
				taskData.custom_size_embed = hasOwnSizeEmbed(taskData, width, height);
			}
			if (!taskData.custom_size_embed) {
				taskData.original_width = width;
				taskData.original_height = height;
				taskData.target_width = width;
				taskData.target_height = height;
				taskData.negative_original_width = width;
				taskData.negative_original_height = height;
			}
		}
		taskData.loras = (taskData.loras || []).filter(item => item != null);
		taskData.controls = (taskData.controls || []).filter(item => item != null);
		// Source images are not tracked, a path goes stale on any rename or
		// reindex. In the future we might keep the original generation as a
		// nested `original` block of parameters instead.
		delete (taskData as any).sourceImage;
	}

	function hasOwnSizeEmbed(taskData: DTHGenParam, width: number, height: number): boolean {
		return differs(taskData.original_width, width)
			|| differs(taskData.original_height, height)
			|| differs(taskData.target_width, width)
			|| differs(taskData.target_height, height)
			|| differs(taskData.negative_original_width, width)
			|| differs(taskData.negative_original_height, height);
	}

	function differs(value: number, expected: number): boolean {
		return value != null && value != expected;
	}

	function addLines(result: string[], source: string, prefix: string): void {
		for (const line of (source || "").split(/\n+/)) {
			if (line) {
				result.push(prefix + line);
			}
		}
	}

	function text(value: any): string {
		if (value === undefined || value === null) {
			return "";
		}
		return String(value);
	}
}
