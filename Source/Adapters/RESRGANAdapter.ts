/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="./ImageSRAdapter.ts" />

namespace RESRGANAdapter {
	export async function listModels(params: ImageSRParams): Promise<string[]> {
		const result: string[] = [];
		try {
			for (const name of NodeUtil.readDirSync(getModelsPath(params))) {
				if (name.endsWith(".param")) {
					result.push(name.substring(0, name.length - ".param".length));
				}
			}
		} catch {
			// The models directory may be missing
		}
		result.sort();
		return result;
	}

	export async function upscale(params: ImageSRParams, inputPath: string, outputPath: string): Promise<string> {
		await NodeUtil.executeProcess(
			params.APITool,
			"",
			"-i", inputPath,
			"-o", outputPath,
			"-m", getModelsPath(params),
			"-n", params.model
		);
		const buffer = NodeUtil.readFileSync(outputPath);
		return buffer.toString("base64");
	}

	// the release archive keeps its models in a nested folder, while a manual
	// install may place the files directly in the configured directory
	function getModelsPath(params: ImageSRParams): string {
		if (params.modelsPath == null) {
			return null;
		}
		if (hasModelFiles(params.modelsPath)) {
			return params.modelsPath;
		}
		const nestedPath = NodeUtil.getPath(params.modelsPath, "models");
		if (hasModelFiles(nestedPath)) {
			return nestedPath;
		}
		return params.modelsPath;
	}

	function hasModelFiles(path: string): boolean {
		try {
			for (const name of NodeUtil.readDirSync(path)) {
				if (name.endsWith(".param")) {
					return true;
				}
			}
		} catch {
			// The models directory may be missing
		}
		return false;
	}
}