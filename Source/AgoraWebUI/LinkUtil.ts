// Splits link-shaped text into anchors without ever reading the DOM back.
//
// Only explicit schemes and "www." hosts are recognized, so ordinary dotted
// text (abbreviations, file names, version numbers) stays plain. To recognize
// more forms, extend LINK_START and linkTokens together.
//
// Streaming note: a chunk can split a link in half, so pendingLinkStart()
// reports the trailing text that must not be rendered as plain text yet.

interface TextSegment {
	text?: string;
	link?: string;
}

const LINK_START = "(?:https?://|localhost://|\\d{1,3}(?:\\.\\d{1,3}){3}://|www\\.)";
const LINK_BODY = "[^\\s<>()\\[\\]{}\"']+";

const linkPattern = new RegExp(LINK_START + LINK_BODY, "gi");
const fullLinkPattern = new RegExp("^" + LINK_START + LINK_BODY + "$", "i");
const tokenPattern = new RegExp(LINK_START, "gi");

// Kept in sync with LINK_START; used to detect tokens that are still arriving.
const linkTokens = [ "http://", "https://", "localhost://", "www." ];

// A trailing IP or IP-scheme fragment, e.g. "192.168", "10.0.0.1:/".
const ipPartialPattern = /^(?=.*\d)[\d./:]+$/;

function trimLink(value: string): string {
	return value.replace(/[.,;:!]+$/, "");
}

// Splits plain text into text and link segments. Incomplete links (for example
// a bare "http://") stay plain because they have no body.
function linkifyText(value: string): TextSegment[] {
	const segments: TextSegment[] = [];
	let index = 0;
	linkPattern.lastIndex = 0;
	let match: RegExpExecArray;
	while ((match = linkPattern.exec(value)) != null) {
		if (match.index > index) {
			segments.push({ text: value.slice(index, match.index) });
		}
		const url = trimLink(match[0]);
		if (fullLinkPattern.test(url)) {
			segments.push({ link: url });
			index = match.index + url.length;
		} else {
			// not a usable link, leave it to the next plain run
			index = match.index;
		}
	}
	if (index < value.length) {
		segments.push({ text: value.slice(index) });
	}
	return segments;
}

// Index from which the value may be an unfinished link, or the length when the
// whole value is safe to render as is.
function pendingLinkStart(value: string): number {
	// Links never contain whitespace, so only the trailing run can be open.
	let start = value.length;
	while (start > 0 && !/\s/.test(value[start - 1])) {
		start--;
	}
	const tail = value.slice(start);
	// An early token can swallow later ones ("http://www.x"), so hold from the
	// first token in the run rather than the last.
	tokenPattern.lastIndex = 0;
	const tokenMatch = tokenPattern.exec(tail);
	if (tokenMatch) {
		return start + tokenMatch.index;
	}
	// A partial start token ("ht", "www", "localhos", ...) may still complete.
	// Only word starts count, so words ending in "h"/"w" are not held back.
	for (let index = 0; index < tail.length; index++) {
		if (index > 0 && /\w/.test(tail[index - 1])) {
			continue;
		}
		const part = tail.slice(index);
		if (linkTokens.some(token => token.startsWith(part))) {
			return start + index;
		}
	}
	// A partial IP, possibly followed by part of its scheme.
	if (ipPartialPattern.test(tail)) {
		return start;
	}
	return value.length;
}

function linkHref(url: string): string {
	return /^www\./i.test(url) ? `http://${url}` : url;
}

function createLinkElement(url: string): HTMLAnchorElement {
	const anchor = document.createElement("a");
	anchor.classList.add("messageLink");
	anchor.href = linkHref(url);
	anchor.target = "_blank";
	anchor.rel = "noopener noreferrer";
	anchor.textContent = url;
	return anchor;
}

// Appends segments as text nodes and anchors; the container is never read back.
function appendTextSegments(container: HTMLElement, segments: TextSegment[]): void {
	for (const segment of segments) {
		if (segment.link) {
			container.appendChild(createLinkElement(segment.link));
		} else if (segment.text) {
			container.appendChild(document.createTextNode(segment.text));
		}
	}
}
