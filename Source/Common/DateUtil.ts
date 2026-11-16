interface DateParts {
	year: string;
	month: string;
	day: string;
	hours: string;
	minutes: string;
	seconds: string;
}

namespace DateUtil {
	export function toUTCParts(time: number): DateParts {
		const date = new Date(time);
		return {
			year: String(date.getUTCFullYear()),
			month: String(1 + date.getUTCMonth()).padStart(2, "0"),
			day: String(date.getUTCDate()).padStart(2, "0"),
			hours: String(date.getUTCHours()).padStart(2, "0"),
			minutes: String(date.getUTCMinutes()).padStart(2, "0"),
			seconds: String(date.getUTCSeconds()).padStart(2, "0")
		};
	}

	export function toLocalParts(time: number): DateParts {
		const date = new Date(time);
		return {
			year: String(date.getFullYear()),
			month: String(1 + date.getMonth()).padStart(2, "0"),
			day: String(date.getDate()).padStart(2, "0"),
			hours: String(date.getHours()).padStart(2, "0"),
			minutes: String(date.getMinutes()).padStart(2, "0"),
			seconds: String(date.getSeconds()).padStart(2, "0")
		};
	}

	export function toUTCDate(time: number): string {
		const { year, month, day } = toUTCParts(time);
		return `${year}-${month}-${day}`;
	}

	export function toLocalDate(time: number): string {
		const { year, month, day } = toLocalParts(time);
		return `${year}-${month}-${day}`;
	}

	export function toUTCTime(time: number): string {
		const { hours, minutes } = toUTCParts(time);
		return `${hours}:${minutes}`;
	}

	export function toLocalTime(time: number): string {
		const { hours, minutes } = toLocalParts(time);
		return `${hours}:${minutes}`;
	}

	export function toUTCFull(time: number): string {
		const { year, month, day, hours, minutes } = toUTCParts(time);
		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	export function toLocalFull(time: number): string {
		const { year, month, day, hours, minutes } = toLocalParts(time);
		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	// When strings are the shared relative and sparse-absolute date vocabulary,
	export function parseWhen(value: string): WhenValue {
		const delta = value.match(/^(\d+)([A-Za-z]+)$/);
		if (delta) {
			return DateUtil.parseDelta(Number(delta[1]), delta[2]);
		}
		return DateUtil.parseAbsolute(value);
	}

	export function formatWhen(when: WhenValue): string {
		if (when == null) {
			return null;
		}
		if (when.hasTime) {
			const { hours, minutes, seconds } = DateUtil.toLocalParts(when.time);
			return `${DateUtil.toLocalDate(when.time)}-${hours}:${minutes}:${seconds}`;
		}
		return DateUtil.toLocalDate(when.time);
	}

	// Reads back a stored when string, a date with an optional time.
	export function whenTime(value: string): number {
		if (value == null) {
			return null;
		}
		const parts = value.split("-");
		const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		if (parts.length == 4) {
			const time = parts[3].split(":");
			date.setHours(Number(time[0]), Number(time[1]), Number(time[2] ?? 0));
		}
		return date.getTime();
	}

	// Counts whole repeats from the when's own time, so the phase never drifts.
	export function advanceWhen(value: string, repeat: string, now: number): string {
		const match = repeat.match(/^(\d+)([A-Za-z]+)$/);
		if (match == null) {
			return value;
		}
		const count = Number(match[1]);
		const unit = match[2];
		const start = DateUtil.whenTime(value);
		if (start == null) {
			return value;
		}
		const step = DateUtil.unitMillis(count, unit);
		let passed = 0;
		if (step) {
			passed = Math.floor((now - start) / step) + 1;
		} else {
			// months and years have no fixed length, so count those one at a time
			passed = 1;
			while (DateUtil.stepDate(start, count, unit, passed + 1) <= now) {
				++passed;
			}
		}
		return DateUtil.formatWhen({ time: DateUtil.stepDate(start, count, unit, passed), hasTime: true });
	}

	// The plain delta form of the when vocabulary, as milliseconds.
	export function durationMillis(value: string): number {
		const delta = value?.match(/^(\d+)([A-Za-z]+)$/);
		if (delta == null) {
			return null;
		}
		return DateUtil.unitMillis(Number(delta[1]), delta[2]);
	}

	// Rounds up to the next whole minute, the usual anchor for a recurring schedule.
	export function nextMinute(now: number): number {
		return now - now % 60000 + 60000;
	}

	// The when vocabulary accepts single letters and full words, in either case.
	export function resolveUnit(unit: string): string {
		const lower = unit.toLowerCase();
		if (lower == "y" || lower == "year" || lower == "years") {
			return "year";
		}
		if (unit == "M" || lower == "month" || lower == "months") {
			return "month";
		}
		if (lower == "w" || lower == "week" || lower == "weeks") {
			return "week";
		}
		if (lower == "d" || lower == "day" || lower == "days") {
			return "day";
		}
		if (lower == "h" || lower == "hour" || lower == "hours") {
			return "hour";
		}
		if (unit == "m" || lower == "minute" || lower == "minutes") {
			return "minute";
		}
		if (lower == "s" || lower == "second" || lower == "seconds") {
			return "second";
		}
		return null;
	}

	export function parseDelta(count: number, unit: string): WhenValue {
		const resolved = DateUtil.resolveUnit(unit);
		const date = new Date();
		if (resolved == "year") {
			date.setFullYear(date.getFullYear() + count);
			return { time: date.getTime(), hasTime: false };
		}
		if (resolved == "month") {
			date.setMonth(date.getMonth() + count);
			return { time: date.getTime(), hasTime: false };
		}
		if (resolved == "week") {
			date.setDate(date.getDate() + 7 * count);
			return { time: date.getTime(), hasTime: false };
		}
		if (resolved == "day") {
			date.setDate(date.getDate() + count);
			return { time: date.getTime(), hasTime: false };
		}
		if (resolved == "hour") {
			date.setHours(date.getHours() + count);
			return { time: date.getTime(), hasTime: true };
		}
		if (resolved == "minute") {
			date.setMinutes(date.getMinutes() + count);
			return { time: date.getTime(), hasTime: true };
		}
		if (resolved == "second") {
			date.setSeconds(date.getSeconds() + count);
			return { time: date.getTime(), hasTime: true };
		}
		return null;
	}

	export function parseAbsolute(value: string): WhenValue {
		const parts = value.split("-");
		const time = parts[parts.length - 1].match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
		let hours = 0;
		let minutes = 0;
		let seconds = 0;
		let hasTime = false;
		if (time) {
			hours = Number(time[1]);
			minutes = Number(time[2]);
			seconds = Number(time[3] ?? 0);
			hasTime = true;
			parts.pop();
		}
		let year = null;
		let month = null;
		let day = null;
		if (parts.length == 3) {
			year = Number(parts[0]);
			month = Number(parts[1]);
			day = Number(parts[2]);
		} else if (parts.length == 2 && parts[0].length == 4) {
			year = Number(parts[0]);
			month = Number(parts[1]);
			day = 1;
		} else if (parts.length == 2) {
			year = new Date().getFullYear();
			month = Number(parts[0]);
			day = Number(parts[1]);
		} else {
			return null;
		}
		const date = new Date(year, month - 1, day, hours, minutes, seconds);
		if (isNaN(date.getTime())) {
			return null;
		}
		return { time: date.getTime(), hasTime };
	}

	export function unitMillis(count: number, unit: string): number {
		const resolved = DateUtil.resolveUnit(unit);
		if (resolved == "week") {
			return 7 * 86400000 * count;
		}
		if (resolved == "day") {
			return 86400000 * count;
		}
		if (resolved == "hour") {
			return 3600000 * count;
		}
		if (resolved == "minute") {
			return 60000 * count;
		}
		if (resolved == "second") {
			return 1000 * count;
		}
		return null;
	}

	export function stepDate(start: number, count: number, unit: string, passed: number): number {
		const resolved = DateUtil.resolveUnit(unit);
		const date = new Date(start);
		if (resolved == "year") {
			date.setFullYear(date.getFullYear() + count * passed);
		} else if (resolved == "month") {
			date.setMonth(date.getMonth() + count * passed);
		} else if (resolved == "week") {
			date.setDate(date.getDate() + 7 * count * passed);
		} else if (resolved == "day") {
			date.setDate(date.getDate() + count * passed);
		} else if (resolved == "hour") {
			date.setHours(date.getHours() + count * passed);
		} else if (resolved == "minute") {
			date.setMinutes(date.getMinutes() + count * passed);
		} else if (resolved == "second") {
			date.setSeconds(date.getSeconds() + count * passed);
		}
		return date.getTime();
	}
}

class DateGapHandler {
	private prevTime = 0;
	private lastTime = 0;
	private lastDate: string;
	private prevGap: number;
	private lastGap: number;
	private precision: number;

	public constructor(lastGap: number, prevGap: number, precision: number) {
		this.lastGap = lastGap;
		this.prevGap = prevGap;
		this.precision = precision;
	}

	public check(currTime: number): any {
		const currDate = DateUtil.toLocalDate(currTime);
		if (this.lastDate == currDate) {
			if (currTime - this.prevTime > this.prevGap || currTime - this.lastTime > this.lastGap) {
				this.prevTime = currTime;
				this.lastTime = currTime;
				return {
					time: DateUtil.toLocalTime(currTime - currTime % this.precision)
				};
			}
		} else {
			this.prevTime = currTime;
			this.lastTime = currTime;
			this.lastDate = currDate;
			return {
				date: currDate,
				time: DateUtil.toLocalTime(currTime - currTime % this.precision)
			};
		}
		this.prevTime = currTime;
		return {};
	}
}

interface WhenValue {
	time: number;
	hasTime: boolean;
}