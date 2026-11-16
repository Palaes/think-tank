/// <reference path="../Common/StreamUtil.ts" />

class StreamChannel {
	protected byLine: boolean;

	protected constructor(byLine: boolean) {
		this.byLine = byLine;
	}

	protected async * readstream(stream: any): AsyncGenerator<string> {
		if (this.byLine) {
			for await (const line of StreamUtil.byLine(StreamUtil.asIterable(stream))) {
				if (line == "") {
					break;
				} else {
					yield line;
				}
			}
		} else {
			let input = "";
			for await (const line of StreamUtil.byLine(StreamUtil.asIterable(stream))) {
				if (line == "[[NEXT]]") {
					yield input;
					input = "";
				} else if (line == "[[END]]") {
					yield input;
					break;
				} else {
					input += line;
					input += "\n";
				}
			}
			if (input) {
				yield input;
			}
		}
	}
}
