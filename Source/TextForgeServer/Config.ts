/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/SettingsUtil.ts" />

namespace TextForgeServerConfig {
	export function getRootPath(): string {
		return SettingsUtil.getLocation("/ThinkTank/TextForge");
	}

	export function getSettingsPath(): string {
		return NodeUtil.getPath(getRootPath(), "settings.json");
	}

	export function getFilePath(location: string): string {
		if (NodeUtil.path.isAbsolute(location)) {
			return location;
		}
		return NodeUtil.getPath(getRootPath(), location);
	}
}
