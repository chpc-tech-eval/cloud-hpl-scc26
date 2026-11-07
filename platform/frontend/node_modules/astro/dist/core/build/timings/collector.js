import { AsyncLocalStorage } from "node:async_hooks";
export const ACTIVITY_BUCKETS = 22;
// Comfortably more than the report prints, so the cap never decides what is shown.
const MAX_ROWS = 50;
/** Wall-clock time covered by possibly overlapping intervals, which summing would count twice. */
class IntervalUnion {
	intervals = [];
	add(start, end) {
		this.intervals.push([start, end]);
	}
	merged() {
		const sorted = [...this.intervals].sort((a, b) => a[0] - b[0]);
		const merged = [];
		for (const [start, end] of sorted) {
			const last = merged.at(-1);
			if (last && start <= last[1]) {
				last[1] = Math.max(last[1], end);
			} else {
				merged.push([start, end]);
			}
		}
		return merged;
	}
	get duration() {
		return this.merged().reduce((total, [start, end]) => total + (end - start), 0);
	}
	activity(window) {
		const slots = new Array(ACTIVITY_BUCKETS).fill(0);
		const width = window / ACTIVITY_BUCKETS;
		if (width <= 0) return slots;
		for (const [start, end] of this.merged()) {
			const first = Math.max(0, Math.floor(start / width));
			const last = Math.min(ACTIVITY_BUCKETS - 1, Math.floor(end / width));
			for (let slot = first; slot <= last; slot++) {
				const overlap = Math.min(end, (slot + 1) * width) - Math.max(start, slot * width);
				if (overlap > 0) slots[slot] += overlap / width;
			}
		}
		return slots.map((value) => Math.min(value, 1));
	}
}
class Tally {
	calls = 0;
	wall = new IntervalUnion();
	add(start, end) {
		this.calls++;
		this.wall.add(start, end);
	}
	toStat(name, window) {
		return {
			name,
			total: this.wall.duration,
			calls: this.calls,
			activity: this.wall.activity(window)
		};
	}
}
class GroupedTally extends Tally {
	children = new Map();
	addChild(child, start, end) {
		this.add(start, end);
		tallyOf(this.children, child, Tally).add(start, end);
	}
	toGroupedStat(name, window) {
		return {
			...this.toStat(name, window),
			children: toSortedStats(this.children, window)
		};
	}
}
function tallyOf(map, key, Kind) {
	let tally = map.get(key);
	if (!tally) {
		tally = new Kind();
		map.set(key, tally);
	}
	return tally;
}
function toSortedStats(map, window) {
	return [...map].map(([name, tally]) => tally.toStat(name, window)).sort((a, b) => b.total - a.total);
}
function toSortedGroupedStats(map, window) {
	return [...map].map(([name, tally]) => tally.toGroupedStat(name, window)).sort((a, b) => b.total - a.total);
}
function section(entries, wall) {
	return {
		entries: entries.slice(0, MAX_ROWS),
		count: entries.length,
		wallDuration: wall.duration
	};
}
function byDuration(records) {
	return [...records].sort((a, b) => b.duration - a.duration);
}
function percentile(sorted, fraction) {
	if (sorted.length === 0) return 0;
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
export class BuildTimingsCollector {
	origin = performance.now();
	spans = [];
	currentSpan = new AsyncLocalStorage();
	plugins = new Map();
	modules = new Map();
	integrations = new Map();
	markdownPlugins = new Map();
	mdxPlugins = new Map();
	languages = new Map();
	pages = [];
	images = [];
	compiledFiles = [];
	markdownFiles = 0;
	pluginWall = new IntervalUnion();
	moduleWall = new IntervalUnion();
	pageWall = new IntervalUnion();
	pageRenderWall = new IntervalUnion();
	imageWall = new IntervalUnion();
	markdownWall = new IntervalUnion();
	compilerWall = new IntervalUnion();
	highlightWall = new IntervalUnion();
	async span(name, fn) {
		const span = {
			id: this.spans.length,
			parentId: this.currentSpan.getStore() ?? null,
			name,
			start: performance.now() - this.origin,
			duration: 0
		};
		this.spans.push(span);
		try {
			return await this.currentSpan.run(span.id, fn);
		} finally {
			span.duration = performance.now() - this.origin - span.start;
		}
	}
	record(kind, name, duration, meta) {
		const end = performance.now() - this.origin;
		const start = end - duration;
		switch (kind) {
			case "vite-hook":
				this.pluginWall.add(start, end);
				tallyOf(this.plugins, name, GroupedTally).addChild(meta?.hook, start, end);
				if (meta?.module) {
					this.moduleWall.add(start, end);
					tallyOf(this.modules, meta.module, GroupedTally).addChild(name, start, end);
				}
				break;
			case "integration":
				tallyOf(this.integrations, name, GroupedTally).addChild(meta?.hook, start, end);
				break;
			case "page":
				this.pageWall.add(start, end);
				this.pages.push({
					name,
					route: meta?.route,
					duration,
					cached: Boolean(meta?.cached)
				});
				break;
			case "page-render":
				this.pageRenderWall.add(start, end);
				break;
			case "image":
				this.imageWall.add(start, end);
				this.images.push({
					name,
					duration,
					cached: Boolean(meta?.cached)
				});
				break;
			case "markdown-plugin":
				tallyOf(this.markdownPlugins, name, Tally).add(start, end);
				break;
			case "mdx-plugin":
				tallyOf(this.mdxPlugins, name, Tally).add(start, end);
				break;
			case "markdown-file":
				this.markdownWall.add(start, end);
				this.markdownFiles++;
				break;
			case "highlight":
				this.highlightWall.add(start, end);
				tallyOf(this.languages, name, Tally).add(start, end);
				break;
			case "astro-compile":
				this.compilerWall.add(start, end);
				this.compiledFiles.push({
					name,
					duration
				});
				break;
		}
	}
	toData(context) {
		const window = performance.now() - this.origin;
		const sortedPageDurations = this.pages.map((page) => page.duration).sort((a, b) => a - b);
		const languages = toSortedStats(this.languages, window);
		return {
			...context,
			totalDuration: window,
			spans: this.spans,
			plugins: section(toSortedGroupedStats(this.plugins, window), this.pluginWall),
			modules: section(toSortedGroupedStats(this.modules, window), this.moduleWall),
			integrations: toSortedGroupedStats(this.integrations, window),
			pages: {
				...section(byDuration(this.pages), this.pageWall),
				cached: this.pages.filter((page) => page.cached).length,
				median: percentile(sortedPageDurations, .5),
				p95: percentile(sortedPageDurations, .95),
				renderDuration: this.pageRenderWall.duration,
				renderActivity: this.pageRenderWall.activity(window)
			},
			images: {
				...section(byDuration(this.images), this.imageWall),
				cached: this.images.filter((image) => image.cached).length
			},
			markdown: {
				plugins: [...toSortedStats(this.markdownPlugins, window).map((stat) => ({
					...stat,
					pipeline: "markdown"
				})), ...toSortedStats(this.mdxPlugins, window).map((stat) => ({
					...stat,
					pipeline: "mdx"
				}))].sort((a, b) => b.total - a.total),
				files: this.markdownFiles,
				wallDuration: this.markdownWall.duration
			},
			highlight: {
				...section(languages, this.highlightWall),
				blocks: languages.reduce((sum, language) => sum + language.calls, 0)
			},
			compiler: section(byDuration(this.compiledFiles), this.compilerWall)
		};
	}
}
