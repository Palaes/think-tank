/// <reference path="../Common/SettingsUtil.ts" />

namespace TextForgeConfig {
	export function getRCPath(): string {
		return SettingsUtil.getLocation("/ThinkTank/TextForge/textforgerc.tf");
	}
}
