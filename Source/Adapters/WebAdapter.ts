/// <reference path="../Common/NodeUtil.ts" />

interface WebSearchParams {
	APIType: string;
	APIHost: string;
	APIKey: string;
	maxCount: number;
	maxLength: number;
}

interface WebFetchParams {
	APIType: string;
	APIHost: string;
	APIKey: string;
	maxLength: number;
}

interface WebAdapter {
	createSearchRequestBody(params: WebSearchParams, query: string): any;
	processSearchResponseData(params: WebSearchParams, data: any): { url: string, title: string, content: string }[];
	createFetchRequestBody(params: WebFetchParams, url: string): any;
	processFetchResponseData(params: WebFetchParams, data: any): { title: string, links: string[], content: string };
}