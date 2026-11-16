/// <reference path="../Common/Globals.ts" />

/// <reference path="ContextUtil.ts" />
/// <reference path="MemoryUtil.ts" />

interface MemorySelection {
	shorts: MemoryEntry[];
	expanded: MemoryEntry[];
}

// Lexical topic alignment without a corpus: cosine over sublinear term counts.
// The scores are symmetric, in 0..1, and ignore function words.
namespace TopicMatcher {
	const stopWordList = [
		"about", "after", "again", "against", "all", "almost", "along", "already", "also",
		"although", "always", "among", "an", "and", "another", "any", "anything", "are",
		"around", "as", "at", "be", "became", "because", "become", "been", "before",
		"being", "below", "between", "both", "but", "by", "can", "cannot", "could",
		"did", "do", "does", "doing", "done", "down", "during", "each", "either", "else",
		"enough", "even", "ever", "every", "for", "from", "further", "get", "got", "had",
		"has", "have", "having", "he", "her", "here", "him", "his", "how", "however",
		"i", "if", "in", "into", "is", "it", "its", "itself", "just", "least", "like",
		"likely", "may", "maybe", "me", "might", "more", "most", "must", "my", "never",
		"no", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
		"out", "over", "own", "perhaps", "quite", "rather", "really", "same", "shall", "she",
		"should", "since", "so", "some", "something", "still", "such", "than", "that", "the",
		"their", "them", "then", "there", "these", "they", "this", "those", "though",
		"through", "thus", "to", "too", "toward", "under", "until", "up", "upon", "us",
		"very", "was", "we", "well", "were", "what", "when", "where", "whether", "which",
		"while", "who", "why", "will", "with", "within", "without", "would", "you", "your"
	];

	const stopWords: Dict<boolean> = {};
	for (const word of stopWordList) {
		stopWords[word] = true;
	}

	const ageExponent = 3;
	const ageHalfDays = 3;
	const ageCoeff = 0.8;

	const topicExponent = 0.2;
	const topicCoeff = 1;

	const noiseExponent = 5;
	const noiseCoeff = 1;

	const weightCoeff = 0.5;

	const referenceEntries = 8;

	// How much text2 is related to text1, symmetric, in 0..1.
	export function scorePair(text1: string, text2: string): number {
		return scoreTerms(toTerms(text1), toTerms(text2));
	}

	// The same alignment for every text against one reference.
	export function scoreTexts(reference: string, texts: string[]): number[] {
		const terms = toTerms(reference);
		const result = [];
		for (const text of texts) {
			result.push(scoreTerms(terms, toTerms(text)));
		}
		return result;
	}

	// The selection metric for a set: random surfacing, a slight weight lift,
	// an age decay that halves at ten days, and the topic alignment.
	// Higher is better and the noise is drawn fresh on every call.
	export function scoreMemories(reference: string, entries: MemoryEntry[], now: number = Date.now()): number[] {
		let minWeight = Infinity;
		let maxWeight = -Infinity;
		for (const entry of entries) {
			const weight = entry.weight ?? 5;
			if (weight < minWeight) {
				minWeight = weight;
			}
			if (weight > maxWeight) {
				maxWeight = weight;
			}
		}
		const result = [];
		for (const entry of entries) {
			result.push(scoreMemory(entry, reference, minWeight, maxWeight, now));
		}
		return result;
	}

	// How strongly the topic changes at each boundary between entries, in 0..1,
	// comparing everything before the boundary with everything after it.
	export function scoreBlock(block: ContextEntry[]): number[] {
		const parts: Dict<number>[] = [];
		for (const entry of block) {
			parts.push(toTerms(entry.type == "message" ? entry.content : ""));
		}
		const prefixes: Dict<number>[] = [];
		let prefix: Dict<number> = {};
		for (const part of parts) {
			prefixes.push(prefix);
			prefix = mergeTerms(prefix, part);
		}
		const suffixes: Dict<number>[] = [];
		let suffix: Dict<number> = {};
		for (let i = parts.length - 1; i >= 0; --i) {
			suffix = mergeTerms(suffix, parts[i]);
			suffixes[i] = suffix;
		}
		const result = [];
		for (let i = 1; i < block.length; ++i) {
			const score = scoreTerms(prefixes[i], suffixes[i]);
			result.push(Math.max(0, 1 - score));
		}
		return result;
	}

	// Ranks memories by weight times the short's alignment, then returns the
	// strongest count of them in time order. A missing weight counts as 5.
	export function select(reference: string, entries: MemoryEntry[], count: number): MemoryEntry[] {
		const texts = [];
		for (const entry of entries) {
			texts.push(entry.short ?? "");
		}
		const scores = scoreTexts(reference, texts);
		const ranked = [];
		for (let i = 0; i < entries.length; ++i) {
			const weight = entries[i].weight ?? 5;
			ranked.push({ entry: entries[i], rank: weight * scores[i] });
		}
		ranked.sort((a, b) => b.rank - a.rank);
		const result = [];
		const limit = Math.max(0, Math.floor(count));
		for (const item of ranked) {
			if (result.length >= limit) {
				break;
			}
			result.push(item.entry);
		}
		result.sort((a, b) => a.start - b.start);
		return result;
	}

	// Splits the ranked memories into the ones to show in full and the ones to
	// show as a single line. Each group takes everything at or above its
	// threshold, then tops up to its minimum and stops at its maximum. The
	// shorts are counted from the entries the expanded ones left behind, and
	// both groups keep the caller's order, so the prompt reads shorts first.
	export function selectMemories(reference: string, entries: MemoryEntry[], time: number, expandedThreshold: number, expandedMin: number, expandedMax: number, shortThreshold: number, shortMin: number, shortMax: number): MemorySelection {
		const scores = scoreMemories(reference, entries, time);
		const ranked = [];
		for (let i = 0; i < entries.length; ++i) {
			ranked.push({ index: i, entry: entries[i], score: scores[i] });
		}
		ranked.sort((a, b) => b.score - a.score);
		const used = new Set<number>();
		const expandedItems = takeRanked(ranked, expandedThreshold, expandedMin, expandedMax, used);
		const shortItems = takeRanked(ranked, shortThreshold, shortMin, shortMax, used);
		expandedItems.sort((a, b) => a.index - b.index);
		shortItems.sort((a, b) => a.index - b.index);
		const expanded = [];
		for (const item of expandedItems) {
			expanded.push(item.entry);
		}
		const shorts = [];
		for (const item of shortItems) {
			shorts.push(item.entry);
		}
		return { shorts, expanded };
	}

	// The denser selection.
	export function selectVar1(reference: string, entries: MemoryEntry[], time: number): MemorySelection {
		return selectMemories(reference, entries, time, 0.9, 10, 30, 0.5, 100, 300);
	}

	// The more stable selection.
	export function selectVar2(reference: string, entries: MemoryEntry[], time: number): MemorySelection {
		return selectMemories(reference, entries, time, 0.8, 15, 25, 0.3, 150, 250);
	}

	// Selects the memories to load for the given context, matched against its
	// last few entries.
	export function selectMemoriesFor(activeContext: ContextEntry[], memories: MemoryEntry[]): MemorySelection {
		const parts = [];
		const first = Math.max(0, activeContext.length - referenceEntries);
		for (let i = first; i < activeContext.length; ++i) {
			parts.push(ContextUtil.entryToText(activeContext[i], ContextUtil.minimalTemplate));
		}
		return selectVar1(parts.join("\n"), memories, Date.now());
	}

	// The boundary with the strongest topic change whose preceding user and ark
	// content stays within minSize..maxSize, or -1 when no boundary qualifies.
	export function split(block: ContextEntry[], minSize: number, maxSize: number): number {
		const limits = scoreBlock(block);
		let size = 0;
		let best = -1;
		let bestScore = 0;
		for (let i = 1; i < block.length; ++i) {
			const entry = block[i - 1];
			if (entry.type == "message" && (entry.role == "user" || entry.role == "ark")) {
				size += entry.content.length;
			}
			if (size < minSize || size > maxSize) {
				continue;
			}
			if (best < 0 || limits[i - 1] > bestScore) {
				best = i;
				bestScore = limits[i - 1];
			}
		}
		return best;
	}

	// Lowercase word counts without the function words and the shortest tokens.
	function toTerms(text: string): Dict<number> {
		const result: Dict<number> = {};
		const words = (text ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [];
		for (const word of words) {
			if (word.length < 3) {
				continue;
			}
			if (stopWords[word]) {
				continue;
			}
			result[word] = (result[word] ?? 0) + 1;
		}
		return result;
	}

	// Each factor is a penalty: smaller penalty means a higher final score.
	function scoreMemory(entry: MemoryEntry, reference: string, minWeight: number, maxWeight: number, now: number): number {
		const noisePenalty = 1 - noiseCoeff * Math.pow(Math.random(), noiseExponent);
		const weightPenalty = 1 - weightCoeff * normalizeWeight(entry.weight ?? 5, minWeight, maxWeight);
		const agePenalty = 1 - ageCoeff * scoreAge(entry, now);
		const topicPenalty = 1 - topicCoeff * Math.pow(scorePair(reference, entry.short ?? ""), topicExponent);
		return 1 - noisePenalty * weightPenalty * agePenalty * topicPenalty;
	}

	// Halves at three days, so only the freshest memories stay near one.
	function scoreAge(entry: MemoryEntry, now: number): number {
		const days = Math.max(0, now - entry.end) / 86400000;
		return 1 / (1 + Math.pow(days / ageHalfDays, ageExponent));
	}

	function normalizeWeight(weight: number, minWeight: number, maxWeight: number): number {
		if (maxWeight == minWeight) {
			return 0;
		}
		return (weight - minWeight) / (maxWeight - minWeight);
	}

	// Takes the best unused entries in score order: all above the threshold,
	// topped up to the minimum and stopped at the maximum.
	function takeRanked(ranked: { index: number, entry: MemoryEntry, score: number }[], threshold: number, minCount: number, maxCount: number, used: Set<number>): { index: number, entry: MemoryEntry, score: number }[] {
		const result = [];
		const cap = Math.max(0, Math.floor(maxCount));
		const floor = Math.min(Math.max(0, Math.floor(minCount)), cap);
		for (const item of ranked) {
			if (result.length >= cap) {
				break;
			}
			if (used.has(item.index)) {
				continue;
			}
			if (item.score >= threshold) {
				result.push(item);
				used.add(item.index);
			}
		}
		for (const item of ranked) {
			if (result.length >= floor) {
				break;
			}
			if (used.has(item.index)) {
				continue;
			}
			result.push(item);
			used.add(item.index);
		}
		return result;
	}

	function mergeTerms(terms: Dict<number>, addition: Dict<number>): Dict<number> {
		const result = { ...terms };
		for (const term in addition) {
			result[term] = (result[term] ?? 0) + addition[term];
		}
		return result;
	}

	// Cosine of the sublinear term counts, so repeated words grow slowly.
	function scoreTerms(left: Dict<number>, right: Dict<number>): number {
		let dot = 0;
		let leftSize = 0;
		let rightSize = 0;
		for (const term in left) {
			const weight = 1 + Math.log(left[term]);
			leftSize += weight * weight;
			if (term in right) {
				dot += weight * (1 + Math.log(right[term]));
			}
		}
		for (const term in right) {
			const weight = 1 + Math.log(right[term]);
			rightSize += weight * weight;
		}
		if (leftSize == 0 || rightSize == 0) {
			return 0;
		}
		return dot / Math.sqrt(leftSize * rightSize);
	}
}
