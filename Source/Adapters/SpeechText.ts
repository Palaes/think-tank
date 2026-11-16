namespace SpeechText {
	// Kept for speech: Latin letters and accents, digits, sentence punctuation,
	// maths signs, e-mail addresses, and the three major currencies.
	const speakable = /[^\p{Script=Latin}\p{M}0-9\s.,!?;:'"()\[\]\/%&*+\-=…–—$€£@]/gu;

	// Voices do not agree on the remaining currency symbols, so they are spelled out.
	const currency = /[₠₡₢₣₤₥₦₧₨₩₪₫₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿¤¥¢]/g;

	// A part that matches any of these is treated as code and skipped.
	const codePatterns = [
		/\bclass\s+\w+\s*(?:extends\s+\w+\s*)?\{/,
		/\b(?:if|for|while|switch|catch)\s*\(/,
		/\b(?:var|let|const)\s+\w+\s*=/,
		/\bfunction\s+\w*\s*\(/,
		/\breturn\s+[^.;]+;/,
		/\w+\.\w+\([^)]*\)\s*;/,
		/^\s*(?:import|export|from)\s+\w/,
		/^\s*(?:public|private|protected|static)\s+\w/,
		/=>/,
		/[{}]\s*$/,
		// Python is found by declarations, colon lines and indented bodies.
		/\b(?:async\s+)?def\s+\w+\s*\(/,
		/^\s*class\s+\w+\s*(?:\([^)]*\))?\s*:/m,
		/^\s*(?:if|elif|else|for|while|with|try|except|finally)\b[^\n]*:[^\n]*\n[ \t]+\S/m,
		/^\s*[a-zA-Z_]\w*\s*=\s*[^=]/m,
		/\bself\.\w+/,
		/^\s*print\s*\(/m
	];

	// A nose is the dash between the eyes and the mouth, it is only decoration.
	const noses = [
		{ from: ":'-", to: ":'" },
		{ from: ":-", to: ":" },
		{ from: "=-", to: ":" },
		{ from: ";-", to: ";" }
	];

	// Everything that counts as a face, longest first so a longer one wins.
	const smileys = [
		":'(", "T-T", "T_T", ";_;", "-_-", "o_O", "^_^", "(=)", "(:)", "x-D", "X-D",
		":)", "(:", "=)", "(=",
		":(", "):", "=(", ")=",
		":D", "=D", ":d", "=d",
		"XD", "xd",
		":P", ":p",
		";)",
		":O",
		":S",
		":/",
		"D:",
		":3",
		"<3"
	];

	// The voice sometimes reads the face itself, so removal is the prepared path.
	// Replacement is kept for reference, it gave every face a sound.
	//
	// const smileySounds = [
	// 	{ from: ":D", to: "Haha!" },
	// 	{ from: "=D", to: "Haha!" },
	// 	{ from: ":d", to: "Haha!" },
	// 	{ from: "=d", to: "Haha!" },
	// 	{ from: "XD", to: "Hahaha!" },
	// 	{ from: "xd", to: "Hahaha!" },
	// 	{ from: ":P", to: "Hehe." },
	// 	{ from: ":p", to: "Hehe." },
	// 	{ from: ";)", to: "Hehe." },
	// 	{ from: ":O", to: "Oh!" },
	// 	{ from: ":S", to: "Hmm." },
	// 	{ from: ":/", to: "Hmm." },
	// 	{ from: "D:", to: "Oh no!" },
	// 	{ from: ":'(", to: "Oh..." },
	// 	{ from: "T-T", to: "Nooo!" },
	// 	{ from: "T_T", to: "Nooo!" },
	// 	{ from: ";_;", to: "Nooo!" },
	// 	{ from: "-_-", to: "Mm." },
	// 	{ from: "o_O", to: "Huh?" },
	// 	{ from: "^_^", to: "Heehee." },
	// 	{ from: ":3", to: "Heehee." },
	// 	{ from: "<3", to: "Aww." }
	// ];

	export function normalize(text: string): string {
		text = text.replace(/–/g, " ... ");
		text = text.replace(currency, " tac ");
		text = removeSmileys(text);
		text = text.replace(speakable, " ");
		return text.replace(/\s+/g, " ").trim();
	}

	export function isCode(text: string): boolean {
		for (const pattern of codePatterns) {
			if (pattern.test(text)) {
				return true;
			}
		}
		return false;
	}

	function removeSmileys(text: string): string {
		for (const nose of noses) {
			text = text.split(nose.from).join(nose.to);
		}
		for (const smiley of smileys) {
			text = text.split(smiley).join(" ... ");
		}
		return text;
	}
}