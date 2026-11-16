/// <reference path="../Common/NodeUtil.ts" />
/// <reference path="../Common/FetchUtil.ts" />
/// <reference path="../Common/TextUtil.ts" />

/// <reference path="WebAdapter.ts" />
/// <reference path="OllamaAdapter.ts" />

namespace WebService {
	const adapters = {
		"default": OllamaAdapter,
		"ollama": OllamaAdapter
	};

	export async function search(params: WebSearchParams, query: string): Promise<string> {
		const adapter = adapters[params.APIType] ?? adapters["default"];
		const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
		const input = adapter.createSearchRequestBody(params, query);
		const data = await fetchData(`${params.APIHost}/web_search`, "POST", headers, input);
		const results = adapter.processSearchResponseData(params, data);
		return formatSearchResult(results, params.maxLength);
	}

	function formatSearchResult(results: any, maxLength: number): string {
		return results.map((result: any) => {
			const cleaned = TextUtil.normalizeAll(result.content);
			const shortened = TextUtil.shortifyLineNicely(cleaned, maxLength);
			return `Title: ${result.title}\nLink: ${result.url}\nContent:\n${shortened}`;
		}).join("\n\n");
	}

	export async function fetch(params: WebFetchParams, url: string): Promise<string> {
		const adapter = adapters[params.APIType] ?? adapters["default"];
		const headers = { Authorization: `Bearer ${params.APIKey}`, ...CTJSON };
		const input = adapter.createFetchRequestBody(params, url);
		const data = await fetchData(`${params.APIHost}/web_fetch`, "POST", headers, input);
		const results = adapter.processFetchResponseData(params, data);
		return formatFetchResult(results, params.maxLength);
	}

	function formatFetchResult(result: any, maxLength: number): string {
		const cleaned = TextUtil.normalizeAll(result.content);
		const shortened = TextUtil.shortifyLineNicely(cleaned, maxLength);
		const links = result.links.join("\n");
		return `Title: ${result.title}\nContent:\n${shortened}\nLinks:\n${links}`;
	}
}