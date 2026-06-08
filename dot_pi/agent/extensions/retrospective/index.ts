import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getAgentDir, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionCommandContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { Box, Container, Markdown, Text } from "@earendil-works/pi-tui";

const COMMAND_NAME = "retro";
const RETRO_SUMMARY_MESSAGE_TYPE = "retrospective-summary";
const SUMMARY_PREVIEW_LINES = 80;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CHILD_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TEXT_CHARS = 2_000;
const MAX_TOOL_RESULT_CHARS = 1_200;
const MAX_JSON_CHARS = 1_500;
const MAX_REPORT_CHARS_FOR_SUMMARY = 12_000;

type Frontmatter = Record<string, string>;

type Practice = {
	id: string;
	title: string;
	filePath: string;
	content: string;
	frontmatter: Frontmatter;
};

type RetroCliOptions = {
	allBranches?: boolean;
	concurrency?: number;
	bestPracticesDir?: string;
	outputDir?: string;
	outputBaseDir?: string;
	model?: string;
	childTimeoutMs?: number;
	showSummaryInTui?: boolean;
};

type RetroSettings = {
	allBranches?: boolean;
	concurrency?: number;
	bestPracticesDir?: string;
	outputBaseDir?: string;
	model?: string;
	childTimeoutMs?: number;
	showSummaryInTui?: boolean;
};

type ResolvedRetroOptions = {
	allBranches: boolean;
	concurrency: number;
	bestPracticesDir?: string;
	outputDir?: string;
	outputBaseDir: string;
	model?: string;
	childTimeoutMs: number;
	showSummaryInTui: boolean;
};

type ChildRunResult = {
	ok: boolean;
	output: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		turns: number;
	};
};

type PracticeReport = {
	practice: Practice;
	path: string;
	status: string;
	confidence: string;
	score?: string;
	ok: boolean;
	error?: string;
	usage: ChildRunResult["usage"];
};

type RetrospectiveSummaryMeta = {
	summaryPath: string;
	runDir: string;
	reportCount: number;
	totalCost: number;
	summaryGeneratedByModel: boolean;
};

type RetrospectiveSummaryDetails = RetrospectiveSummaryMeta & {
	// Stored in message details so the TUI can render the full report without injecting it into LLM context.
	summary: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function timestampForPath(date = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		"_",
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join("");
}

function sanitizeFileName(value: string): string {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return sanitized || "untitled";
}

function truncate(value: string, maxChars: number): string {
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function stringifyCompact(value: unknown, maxChars = MAX_JSON_CHARS): string {
	let text: string;
	try {
		const json = JSON.stringify(value);
		text = json === undefined ? String(value) : json;
	} catch {
		text = String(value);
	}
	return truncate(text, maxChars);
}

function normalizePathArg(raw: string | undefined, cwd: string): string | undefined {
	if (!raw) return undefined;
	const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;
	return path.isAbsolute(withoutAt) ? withoutAt : path.resolve(cwd, withoutAt);
}

function parseArgs(args: string): RetroCliOptions {
	const options: RetroCliOptions = {};

	const parts = args.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
	for (let i = 0; i < parts.length; i++) {
		const raw = parts[i].replace(/^"|"$/g, "");
		if (raw === "--all-branches") {
			options.allBranches = true;
			continue;
		}
		if (raw === "--current-branch") {
			options.allBranches = false;
			continue;
		}
		if (raw === "--concurrency" && parts[i + 1]) {
			options.concurrency = Number(parts[++i].replace(/^"|"$/g, ""));
			continue;
		}
		if (raw.startsWith("--concurrency=")) {
			options.concurrency = Number(raw.slice("--concurrency=".length));
			continue;
		}
		if (raw === "--bestpractices" && parts[i + 1]) {
			options.bestPracticesDir = parts[++i].replace(/^"|"$/g, "");
			continue;
		}
		if (raw.startsWith("--bestpractices=")) {
			options.bestPracticesDir = raw.slice("--bestpractices=".length);
			continue;
		}
		if (raw === "--output" && parts[i + 1]) {
			options.outputDir = parts[++i].replace(/^"|"$/g, "");
			continue;
		}
		if (raw.startsWith("--output=")) {
			options.outputDir = raw.slice("--output=".length);
			continue;
		}
		if (raw === "--output-base" && parts[i + 1]) {
			options.outputBaseDir = parts[++i].replace(/^"|"$/g, "");
			continue;
		}
		if (raw.startsWith("--output-base=")) {
			options.outputBaseDir = raw.slice("--output-base=".length);
			continue;
		}
		if (raw === "--model" && parts[i + 1]) {
			options.model = parts[++i].replace(/^"|"$/g, "");
			continue;
		}
		if (raw.startsWith("--model=")) {
			options.model = raw.slice("--model=".length);
			continue;
		}
		if (raw === "--tui") {
			options.showSummaryInTui = true;
			continue;
		}
		if (raw === "--no-tui") {
			options.showSummaryInTui = false;
			continue;
		}
		if (raw === "--child-timeout-ms" && parts[i + 1]) {
			options.childTimeoutMs = Number(parts[++i].replace(/^"|"$/g, ""));
			continue;
		}
		if (raw.startsWith("--child-timeout-ms=")) {
			options.childTimeoutMs = Number(raw.slice("--child-timeout-ms=".length));
			continue;
		}
	}

	if (options.concurrency !== undefined) {
		options.concurrency = normalizeConcurrency(options.concurrency);
	}
	if (options.childTimeoutMs !== undefined) {
		options.childTimeoutMs = normalizeTimeoutMs(options.childTimeoutMs);
	}
	return options;
}

function normalizeConcurrency(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONCURRENCY;
	return Math.max(1, Math.min(8, Math.floor(parsed)));
}

function normalizeTimeoutMs(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_CHILD_TIMEOUT_MS;
	return Math.max(1_000, Math.floor(parsed));
}

function readJsonObject(filePath: string): Record<string, unknown> {
	try {
		if (!fs.existsSync(filePath)) return {};
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
		return isObject(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function directoryExists(dir: string): boolean {
	try {
		return fs.statSync(dir).isDirectory();
	} catch {
		return false;
	}
}

function findNearestProjectSettingsPath(cwd: string): string | undefined {
	let current = cwd;
	while (true) {
		const candidate = path.join(current, ".pi", "settings.json");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
		const parent = path.dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

function getRetrospectiveSection(settings: Record<string, unknown>): Record<string, unknown> {
	const section = settings.retrospective;
	return isObject(section) ? section : {};
}

function resolveConfiguredPath(value: unknown, baseDir: string, cwd: string): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	const raw = value.trim();
	if (raw === "~") return os.homedir();
	if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
	if (path.isAbsolute(raw)) return raw;
	if (raw === ".pi" || raw.startsWith(`.pi${path.sep}`) || raw.startsWith(".pi/")) {
		return path.resolve(cwd, raw);
	}
	return path.resolve(baseDir, raw);
}

function normalizeSettings(raw: Record<string, unknown>, baseDir: string, cwd: string): RetroSettings {
	const settings: RetroSettings = {};
	if (typeof raw.allBranches === "boolean") settings.allBranches = raw.allBranches;
	if (raw.concurrency !== undefined) settings.concurrency = normalizeConcurrency(raw.concurrency);
	if (typeof raw.model === "string" && raw.model.trim()) settings.model = raw.model.trim();
	if (raw.childTimeoutMs !== undefined) settings.childTimeoutMs = normalizeTimeoutMs(raw.childTimeoutMs);
	if (typeof raw.showSummaryInTui === "boolean") settings.showSummaryInTui = raw.showSummaryInTui;

	const bestPracticesDir = resolveConfiguredPath(raw.bestPracticesDir, baseDir, cwd);
	if (bestPracticesDir) settings.bestPracticesDir = bestPracticesDir;

	const outputBaseDir = resolveConfiguredPath(raw.outputBaseDir, baseDir, cwd);
	if (outputBaseDir) settings.outputBaseDir = outputBaseDir;

	return settings;
}

function loadRetrospectiveSettings(cwd: string): RetroSettings {
	const globalSettingsPath = path.join(getAgentDir(), "settings.json");
	const globalSettings = normalizeSettings(
		getRetrospectiveSection(readJsonObject(globalSettingsPath)),
		getAgentDir(),
		cwd,
	);

	const projectSettingsPath = findNearestProjectSettingsPath(cwd);
	if (!projectSettingsPath) return globalSettings;

	const projectSettings = normalizeSettings(
		getRetrospectiveSection(readJsonObject(projectSettingsPath)),
		path.dirname(projectSettingsPath),
		cwd,
	);
	return { ...globalSettings, ...projectSettings };
}

function resolveRetroOptions(cwd: string, args: string): ResolvedRetroOptions {
	const settings = loadRetrospectiveSettings(cwd);
	const cli = parseArgs(args);

	const outputBaseDir = cli.outputBaseDir
		? normalizePathArg(cli.outputBaseDir, cwd)
		: settings.outputBaseDir ?? path.join(cwd, ".pi", "retrospectives");

	return {
		allBranches: cli.allBranches ?? settings.allBranches ?? false,
		concurrency: normalizeConcurrency(cli.concurrency ?? settings.concurrency ?? DEFAULT_CONCURRENCY),
		bestPracticesDir: cli.bestPracticesDir ? normalizePathArg(cli.bestPracticesDir, cwd) : settings.bestPracticesDir,
		outputDir: cli.outputDir ? normalizePathArg(cli.outputDir, cwd) : undefined,
		outputBaseDir,
		model: cli.model ?? settings.model,
		childTimeoutMs: normalizeTimeoutMs(cli.childTimeoutMs ?? settings.childTimeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS),
		showSummaryInTui: cli.showSummaryInTui ?? settings.showSummaryInTui ?? true,
	};
}

function findNearestBestPracticesDir(cwd: string): string | undefined {
	let current = cwd;
	while (true) {
		const candidate = path.join(current, ".pi", "bestpractices");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}

	const homeCandidate = path.join(os.homedir(), ".pi", "bestpractices");
	if (fs.existsSync(homeCandidate) && fs.statSync(homeCandidate).isDirectory()) return homeCandidate;
	return undefined;
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
	if (!content.startsWith("---\n")) return { frontmatter: {}, body: content };
	const end = content.indexOf("\n---", 4);
	if (end < 0) return { frontmatter: {}, body: content };

	const raw = content.slice(4, end).trim();
	const frontmatter: Frontmatter = {};
	for (const line of raw.split("\n")) {
		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!match) continue;
		frontmatter[match[1]] = match[2].trim().replace(/^"|"$/g, "");
	}

	return { frontmatter, body: content.slice(end + 5).replace(/^\n/, "") };
}

function titleFromContent(content: string, fallback: string): string {
	const match = content.match(/^#\s+(.+)$/m);
	return match?.[1]?.trim() || fallback;
}

async function loadPractices(dir: string): Promise<Practice[]> {
	const entries = await fsp.readdir(dir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => path.join(dir, entry.name))
		.sort();

	const practices: Practice[] = [];
	for (const filePath of files) {
		const content = await fsp.readFile(filePath, "utf8");
		const { frontmatter } = parseFrontmatter(content);
		if (frontmatter.enabled?.toLowerCase() === "false") continue;

		const fallbackId = path.basename(filePath, ".md");
		const id = sanitizeFileName(frontmatter.id || fallbackId);
		const title = frontmatter.title || titleFromContent(content, fallbackId);
		practices.push({ id, title, filePath, content, frontmatter });
	}
	return practices;
}

function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (!isObject(part)) return "";
				if (part.type === "text" && typeof part.text === "string") return part.text;
				if (part.type === "image") return "[image]";
				if (part.type === "thinking" && typeof part.thinking === "string") return `[thinking] ${part.thinking}`;
				return stringifyCompact(part, 500);
			})
			.filter(Boolean)
			.join("\n");
	}
	return stringifyCompact(content);
}

function assistantParts(message: Record<string, unknown>): { text: string; toolCalls: Array<{ id?: string; name: string; args: unknown }> } {
	const content = Array.isArray(message.content) ? message.content : [];
	const textParts: string[] = [];
	const toolCalls: Array<{ id?: string; name: string; args: unknown }> = [];

	for (const part of content) {
		if (!isObject(part)) continue;
		if (part.type === "text" && typeof part.text === "string") {
			textParts.push(part.text);
			continue;
		}
		if (part.type === "thinking" && typeof part.thinking === "string") {
			textParts.push(`[thinking] ${truncate(part.thinking, 600)}`);
			continue;
		}
		if (part.type === "toolCall") {
			const name = typeof part.name === "string" ? part.name : "unknown";
			const id = typeof part.id === "string" ? part.id : undefined;
			const args = isObject(part.arguments) ? part.arguments : part.arguments;
			toolCalls.push({ id, name, args });
		}
	}

	return { text: textParts.join("\n"), toolCalls };
}

function buildRetrospectiveTranscript(entries: SessionEntry[], meta: { cwd: string; sessionFile?: string; sessionId?: string; mode: string }): string {
	const toolCallArgs = new Map<string, { name: string; args: unknown }>();
	const readFiles = new Set<string>();
	const modifiedFiles = new Set<string>();
	const bashCommands: string[] = [];
	let toolCallCount = 0;
	let largeResultCount = 0;
	let userMessageCount = 0;
	let assistantMessageCount = 0;

	const lines: string[] = [];
	lines.push("# Session Retrospective Transcript");
	lines.push("");
	lines.push(`- CWD: ${meta.cwd}`);
	if (meta.sessionFile) lines.push(`- Session file: ${meta.sessionFile}`);
	if (meta.sessionId) lines.push(`- Session id: ${meta.sessionId}`);
	lines.push(`- Scope: ${meta.mode}`);
	lines.push(`- Entries serialized: ${entries.length}`);
	lines.push("");
	lines.push("## Timeline");

	for (const entry of entries) {
		if (entry.type === "message") {
			const message = (entry as any).message as Record<string, unknown>;
			const role = typeof message.role === "string" ? message.role : "unknown";

			if (role === "user") {
				userMessageCount++;
				lines.push("");
				lines.push(`### Entry ${entry.id} · user · ${entry.timestamp}`);
				lines.push(truncate(contentToText(message.content), MAX_TEXT_CHARS));
				continue;
			}

			if (role === "assistant") {
				assistantMessageCount++;
				const { text, toolCalls } = assistantParts(message);
				lines.push("");
				lines.push(`### Entry ${entry.id} · assistant · ${entry.timestamp}`);
				if (message.provider || message.model || message.stopReason) {
					lines.push(
						`Model: ${String(message.provider ?? "?")}/${String(message.model ?? "?")} · stopReason: ${String(message.stopReason ?? "?")}`,
					);
				}
				if (text.trim()) {
					lines.push("");
					lines.push(truncate(text, MAX_TEXT_CHARS));
				}
				if (toolCalls.length > 0) {
					lines.push("");
					lines.push("Tool calls:");
					for (const call of toolCalls) {
						toolCallCount++;
						if (call.id) toolCallArgs.set(call.id, { name: call.name, args: call.args });
						if (call.name === "read" && isObject(call.args)) {
							const p = typeof call.args.path === "string" ? call.args.path : undefined;
							if (p) readFiles.add(p);
						}
						if ((call.name === "edit" || call.name === "write") && isObject(call.args)) {
							const p = typeof call.args.path === "string" ? call.args.path : undefined;
							if (p) modifiedFiles.add(p);
						}
						if (call.name === "bash" && isObject(call.args) && typeof call.args.command === "string") {
							bashCommands.push(call.args.command);
						}
						lines.push(`- ${call.name}${call.id ? ` (${call.id})` : ""}: ${stringifyCompact(call.args)}`);
					}
				}
				continue;
			}

			if (role === "toolResult") {
				const toolName = typeof message.toolName === "string" ? message.toolName : "unknown";
				const toolCallId = typeof message.toolCallId === "string" ? message.toolCallId : undefined;
				const args = toolCallId ? toolCallArgs.get(toolCallId)?.args : undefined;
				const text = contentToText(message.content);
				const isLarge = text.length > MAX_TOOL_RESULT_CHARS || text.includes("[Output truncated");
				if (isLarge) largeResultCount++;
				lines.push("");
				lines.push(`### Entry ${entry.id} · toolResult:${toolName} · ${entry.timestamp}`);
				lines.push(`- isError: ${String(message.isError ?? false)}`);
				if (args) lines.push(`- args: ${stringifyCompact(args)}`);
				lines.push(`- outputChars: ${text.length}`);
				lines.push("");
				lines.push(truncate(text, MAX_TOOL_RESULT_CHARS));
				continue;
			}

			if (role === "custom") {
				lines.push("");
				lines.push(`### Entry ${entry.id} · custom:${String(message.customType ?? "unknown")} · ${entry.timestamp}`);
				lines.push(truncate(contentToText(message.content), 1_000));
				continue;
			}
		}

		if (entry.type === "compaction") {
			const compaction = entry as any;
			lines.push("");
			lines.push(`### Entry ${entry.id} · compaction · ${entry.timestamp}`);
			lines.push(`- tokensBefore: ${String(compaction.tokensBefore ?? "unknown")}`);
			lines.push(truncate(String(compaction.summary ?? ""), MAX_TEXT_CHARS));
			continue;
		}

		if (entry.type === "branch_summary") {
			const branch = entry as any;
			lines.push("");
			lines.push(`### Entry ${entry.id} · branch_summary · ${entry.timestamp}`);
			lines.push(truncate(String(branch.summary ?? ""), MAX_TEXT_CHARS));
			continue;
		}

		if (entry.type === "custom_message") {
			const custom = entry as any;
			lines.push("");
			lines.push(`### Entry ${entry.id} · custom_message:${String(custom.customType ?? "unknown")} · ${entry.timestamp}`);
			lines.push(truncate(contentToText(custom.content), 1_000));
			continue;
		}

		if ((entry as any).message?.role === "bashExecution") {
			const bash = (entry as any).message;
			bashCommands.push(String(bash.command ?? ""));
			lines.push("");
			lines.push(`### Entry ${entry.id} · bashExecution · ${entry.timestamp}`);
			lines.push(`- command: ${String(bash.command ?? "")}`);
			lines.push(`- exitCode: ${String(bash.exitCode ?? "unknown")}`);
			lines.push(`- truncated: ${String(bash.truncated ?? false)}`);
			if (bash.fullOutputPath) lines.push(`- fullOutputPath: ${String(bash.fullOutputPath)}`);
			lines.push(truncate(String(bash.output ?? ""), MAX_TOOL_RESULT_CHARS));
		}
	}

	const summary = [
		"# Session Retrospective Transcript",
		"",
		"## Observed Signals",
		`- User messages: ${userMessageCount}`,
		`- Assistant messages: ${assistantMessageCount}`,
		`- Tool calls observed: ${toolCallCount}`,
		`- Large/truncated tool results: ${largeResultCount}`,
		`- Files read: ${readFiles.size ? Array.from(readFiles).slice(0, 30).join(", ") : "none observed"}`,
		`- Files modified: ${modifiedFiles.size ? Array.from(modifiedFiles).slice(0, 30).join(", ") : "none observed"}`,
		`- Bash commands: ${bashCommands.length ? bashCommands.slice(0, 30).map((cmd) => `\`${cmd.replace(/`/g, "'")}\``).join(", ") : "none observed"}`,
		"",
	];

	return `${summary.join("\n")}\n${lines.slice(2).join("\n")}`;
}

async function ensureDir(dir: string): Promise<void> {
	await fsp.mkdir(dir, { recursive: true });
}

async function mapWithConcurrency<TIn, TOut>(items: TIn[], concurrency: number, fn: (item: TIn, index: number) => Promise<TOut>): Promise<TOut[]> {
	const results = new Array<TOut>(items.length);
	let next = 0;
	const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
		while (true) {
			const index = next++;
			if (index >= items.length) return;
			results[index] = await fn(items[index], index);
		}
	});
	await Promise.all(workers);
	return results;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) return { command: process.execPath, args };
	return { command: "pi", args };
}

async function runChildPi(prompt: string, cwd: string, options: { model?: string; timeoutMs?: number }): Promise<ChildRunResult> {
	const args = [
		"--mode",
		"json",
		"-p",
		"--no-session",
		"--no-tools",
		"--no-context-files",
		"--no-skills",
		"--no-prompt-templates",
	];
	if (options.model) args.push("--model", options.model);

	const invocation = getPiInvocation(args);
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
	let output = "";
	let stderr = "";
	let timedOut = false;

	return await new Promise<ChildRunResult>((resolve) => {
		const proc = spawn(invocation.command, invocation.args, {
			cwd,
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, PI_RETRO_CHILD: "1" },
		});

		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
			setTimeout(() => {
				if (!proc.killed) proc.kill("SIGKILL");
			}, 5_000).unref();
		}, options.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS);
		timeout.unref();

		let stdoutBuffer = "";
		const processLine = (line: string) => {
			if (!line.trim()) return;
			let event: any;
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}

			if (event.type !== "message_end" || !event.message || event.message.role !== "assistant") return;
			usage.turns++;
			const msgUsage = event.message.usage;
			if (msgUsage) {
				usage.input += msgUsage.input || 0;
				usage.output += msgUsage.output || 0;
				usage.cacheRead += msgUsage.cacheRead || 0;
				usage.cacheWrite += msgUsage.cacheWrite || 0;
				usage.cost += msgUsage.cost?.total || 0;
			}

			const parts = Array.isArray(event.message.content) ? event.message.content : [];
			const text = parts
				.filter((part: unknown) => isObject(part) && part.type === "text" && typeof part.text === "string")
				.map((part: any) => part.text)
				.join("\n");
			if (text.trim()) output = text;
			if (event.message.errorMessage) stderr += `\n${event.message.errorMessage}`;
		};

		proc.stdout.on("data", (data) => {
			stdoutBuffer += data.toString();
			const lines = stdoutBuffer.split("\n");
			stdoutBuffer = lines.pop() ?? "";
			for (const line of lines) processLine(line);
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("error", (error) => {
			stderr += `\n${error.message}`;
		});

		proc.on("close", (code) => {
			clearTimeout(timeout);
			if (stdoutBuffer.trim()) processLine(stdoutBuffer);
			resolve({ ok: code === 0 && !timedOut && Boolean(output.trim()), output, stderr, exitCode: code, timedOut, usage });
		});

		proc.stdin.write(prompt);
		proc.stdin.end();
	});
}

function buildPracticeReviewPrompt(practice: Practice, transcript: string): string {
	return `你是一个 Pi coding session 复盘 reviewer。你只负责用一个最佳实践文件审查一次 session。\n\n你的第一步必须是相关性门控（relevance gate）。\n\n如果该最佳实践和本次 session 无关，你必须提前结束，只输出 skipped report，不要给泛泛建议。\n如果相关，你再输出完整复盘报告。\n\n相关标准：满足任一条件即可 relevant：\n- session 中出现了该最佳实践直接指导的行为；\n- session 中出现了违反该最佳实践的行为；\n- session 中有明显“本该使用该实践但没有使用”的 missed opportunity；\n- 用户、agent、工具调用、文件修改、验证动作与该实践主题有关；\n- 该实践能产出具体、可执行、基于证据的反馈。\n\n无关标准：只有以下情况才 irrelevant：\n- transcript 中没有任何可用于评价该实践的行为；\n- 强行评价只能产生泛泛建议；\n- 没有证据能支撑“做得好 / 做得不好”。\n\n模糊情况：如果不确定，标记 relevant，但 confidence: low。\n\n硬性规则：\n- 不要修改任何项目/source 文件。\n- 只依据 transcript 和该最佳实践判断。\n- 引用证据时尽量写 entry id、工具名、命令或文件路径。\n- 每个负面发现必须包含 better example。\n- 输出必须是 Markdown，并在开头包含 YAML frontmatter。\n\n如果 irrelevant，输出格式：\n---\npracticeId: ${practice.id}\nstatus: irrelevant\nconfidence: high|medium|low\nscore: null\n---\n\n# ${practice.title} Retrospective\n\n## Status\nSkipped: irrelevant to this session.\n\n## Reason\n...\n\n## Evidence Checked\n- ...\n\n如果 relevant，输出格式：\n---\npracticeId: ${practice.id}\nstatus: relevant\nconfidence: high|medium|low\nscore: 0-5\n---\n\n# ${practice.title} Retrospective\n\n## Relevance\n为什么相关。\n\n## What went well\n- Evidence: ...\n  Why it was good: ...\n\n## What did not go well\n- Evidence: ...\n  Why this violated the practice: ...\n  Better example:\n  \`\`\`text\n  ...\n  \`\`\`\n\n## Missed opportunities\n- ...\n\n## Summary\n...\n\n---\n\n# Best Practice File\n\nPath: ${practice.filePath}\n\n${practice.content}\n\n---\n\n# Session Transcript\n\n${transcript}\n`;
}

function extractReportMeta(markdown: string): { status: string; confidence: string; score?: string } {
	const { frontmatter } = parseFrontmatter(markdown);
	return {
		status: frontmatter.status || "unknown",
		confidence: frontmatter.confidence || "unknown",
		score: frontmatter.score && frontmatter.score !== "null" ? frontmatter.score : undefined,
	};
}

function failureReport(practice: Practice, error: string): string {
	return `---\npracticeId: ${practice.id}\nstatus: failed\nconfidence: low\nscore: null\n---\n\n# ${practice.title} Retrospective\n\n## Status\nFailed to generate report.\n\n## Error\n${error}\n`;
}

function buildSummaryPrompt(reports: PracticeReport[], reportContents: Array<{ report: PracticeReport; content: string }>): string {
	const table = reports
		.map((report) => `- ${report.practice.id}: status=${report.status}, confidence=${report.confidence}, score=${report.score ?? "-"}, path=${report.path}`)
		.join("\n");
	const contents = reportContents
		.map(({ report, content }) => `\n\n---\n\n# Report: ${report.practice.id}\n\n${truncate(content, MAX_REPORT_CHARS_FOR_SUMMARY)}`)
		.join("");

	return `你是 coding session 复盘总结器。请根据多个 best-practice reviewer 的报告，生成一个总报告。\n\n要求：\n- 使用简体中文。\n- 不要发明报告里没有的事实。\n- status=irrelevant 的实践不参与平均分，但要列入 Skipped Practices。\n- 优先总结可执行改进项。\n- 如果某些 report failed，要在风险里说明。\n\n输出 Markdown，结构如下：\n\n# Session Retrospective Summary\n\n## Overall Score\n只基于 relevant 且有 score 的报告计算，给出 x/5；如果无法计算就写 N/A。\n\n## Reviewed Practices\n表格：Practice | Status | Score | Confidence | Report。\n\n## Top Wins\n1. ...\n\n## Top Improvement Areas\n### 1. ...\n- Evidence: ...\n- Better next time: ...\n\n## Repeated Patterns\n- Good patterns:\n- Bad patterns:\n\n## Action Items for Next Sessions\n- [ ] ...\n\n## Skipped Practices\n- ...\n\n## Failed Reports / Residual Risks\n- ...\n\n---\n\n# Report Index\n${table}\n\n# Report Contents\n${contents}\n`;
}

function deterministicSummary(reports: PracticeReport[], runDir: string): string {
	const relevant = reports.filter((r) => r.status === "relevant" && r.score !== undefined);
	const scores = relevant
		.map((r) => Number(r.score))
		.filter((score) => Number.isFinite(score));
	const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "N/A";

	const rows = reports
		.map((report) => `| ${report.practice.id} | ${report.status} | ${report.score ?? "-"} | ${report.confidence} | [report](${path.relative(runDir, report.path)}) |`)
		.join("\n");
	const skipped = reports.filter((report) => report.status === "irrelevant");
	const failed = reports.filter((report) => !report.ok || report.status === "failed");

	return `# Session Retrospective Summary\n\n## Overall Score\n\n${average === "N/A" ? "N/A" : `${average}/5`}\n\n## Reviewed Practices\n\n| Practice | Status | Score | Confidence | Report |\n|---|---:|---:|---:|---|\n${rows}\n\n## Top Wins\n\n请查看各 practice 报告中的 \`What went well\`。自动汇总模型未成功运行，因此这里保留索引式总结。\n\n## Top Improvement Areas\n\n请查看各 practice 报告中的 \`What did not go well\` 和 \`Missed opportunities\`。\n\n## Action Items for Next Sessions\n\n- [ ] 阅读 relevant 报告中的 better example，并挑选 1-3 条写入下一次工作前的提醒。\n\n## Skipped Practices\n\n${skipped.length ? skipped.map((report) => `- ${report.practice.id}: irrelevant`).join("\n") : "None"}\n\n## Failed Reports / Residual Risks\n\n${failed.length ? failed.map((report) => `- ${report.practice.id}: ${report.error ?? "failed"}`).join("\n") : "None"}\n`;
}

function currentModelId(ctx: { model?: any }, override?: string): string | undefined {
	if (override) return override;
	const model = ctx.model;
	if (!model || !model.provider || !model.id) return undefined;
	return `${model.provider}/${model.id}`;
}

function summaryPreview(summary: string): string {
	const lines = summary.trim().split("\n");
	if (lines.length <= SUMMARY_PREVIEW_LINES) return summary;
	return [
		...lines.slice(0, SUMMARY_PREVIEW_LINES),
		"",
		`… ${lines.length - SUMMARY_PREVIEW_LINES} more lines. Expand this message to view the full retrospective summary.`,
	].join("\n");
}

function renderRetrospectiveSummaryMessage(message: { content?: unknown; details?: unknown }, options: { expanded?: boolean }, theme: any) {
	const details = isObject(message.details) ? (message.details as Partial<RetrospectiveSummaryDetails>) : {};
	const summary =
		typeof details.summary === "string"
			? details.summary
			: typeof message.content === "string"
				? message.content
				: message.content === undefined
					? ""
					: contentToText(message.content);
	const isExpanded = Boolean(options.expanded);
	const displayedSummary = isExpanded ? summary : summaryPreview(summary);
	const mdTheme = getMarkdownTheme();

	const headerLines = [
		theme.fg("toolTitle", theme.bold("Session Retrospective Summary")),
		theme.fg("dim", `Reports: ${details.reportCount ?? "?"}`),
	];
	if (typeof details.summaryPath === "string") headerLines.push(theme.fg("dim", `Summary: ${details.summaryPath}`));
	if (typeof details.runDir === "string") headerLines.push(theme.fg("dim", `Run dir: ${details.runDir}`));
	if (typeof details.totalCost === "number" && details.totalCost > 0) {
		headerLines.push(theme.fg("dim", `Estimated child cost: $${details.totalCost.toFixed(4)}`));
	}
	if (details.summaryGeneratedByModel === false) {
		headerLines.push(theme.fg("warning", "Summary model failed; displaying deterministic fallback."));
	}

	const container = new Container();
	container.addChild(new Text(headerLines.join("\n"), 0, 0));
	container.addChild(new Markdown(displayedSummary, 0, 1, mdTheme));
	if (!isExpanded && summary.trim().split("\n").length > SUMMARY_PREVIEW_LINES) {
		container.addChild(new Text(theme.fg("dim", "Expand to view the full retrospective in TUI."), 0, 0));
	}

	const box = new Box(1, 1, (text: string) => theme.bg("customMessageBg", text));
	box.addChild(container);
	return box;
}

function sendSummaryToTui(pi: ExtensionAPI, summary: string, meta: RetrospectiveSummaryMeta, ctx: ExtensionCommandContext): void {
	if (!ctx.hasUI) return;

	pi.sendMessage({
		customType: RETRO_SUMMARY_MESSAGE_TYPE,
		content: `Retrospective summary saved to ${meta.summaryPath}`,
		display: true,
		details: { ...meta, summary } satisfies RetrospectiveSummaryDetails,
	});
}

export default function retrospectiveExtension(pi: ExtensionAPI) {
	pi.registerMessageRenderer(RETRO_SUMMARY_MESSAGE_TYPE, renderRetrospectiveSummaryMessage);

	pi.registerCommand(COMMAND_NAME, {
		description: "Review current session against .pi/bestpractices and render the final summary in TUI; defaults via settings.json retrospective.*",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();

			const options = resolveRetroOptions(ctx.cwd, args);
			const bestPracticesDir = options.bestPracticesDir ?? findNearestBestPracticesDir(ctx.cwd);
			if (!bestPracticesDir) {
				ctx.ui.notify("No .pi/bestpractices directory found", "error");
				return;
			}
			if (!directoryExists(bestPracticesDir)) {
				ctx.ui.notify(`Best practices directory does not exist: ${bestPracticesDir}`, "error");
				return;
			}

			const practices = await loadPractices(bestPracticesDir);
			if (practices.length === 0) {
				ctx.ui.notify(`No enabled Markdown best practices found in ${bestPracticesDir}`, "warning");
				return;
			}

			const sessionId = ctx.sessionManager.getSessionId?.() ?? "session";
			const runDir = options.outputDir ?? path.join(options.outputBaseDir, `${timestampForPath()}_${sanitizeFileName(sessionId)}`);
			const reportsDir = path.join(runDir, "reports");
			await ensureDir(reportsDir);

			const entries = options.allBranches ? ctx.sessionManager.getEntries() : ctx.sessionManager.getBranch();
			const transcript = buildRetrospectiveTranscript(entries, {
				cwd: ctx.cwd,
				sessionFile: ctx.sessionManager.getSessionFile?.(),
				sessionId,
				mode: options.allBranches ? "all entries" : "current branch",
			});
			const transcriptPath = path.join(runDir, "transcript.md");
			await fsp.writeFile(transcriptPath, transcript, "utf8");

			const model = currentModelId(ctx, options.model);
			ctx.ui.setStatus("retro", `reviewing 0/${practices.length}`);
			ctx.ui.notify(`Retro started: ${practices.length} practices, concurrency ${options.concurrency}`, "info");

			let completed = 0;
			const reports = await mapWithConcurrency(practices, options.concurrency, async (practice) => {
				const reportPath = path.join(reportsDir, `${practice.id}.md`);
				const prompt = buildPracticeReviewPrompt(practice, transcript);
				const result = await runChildPi(prompt, ctx.cwd, { model, timeoutMs: options.childTimeoutMs });

				let content = result.output.trim();
				let ok = result.ok;
				let error: string | undefined;
				if (!ok) {
					error = result.timedOut ? "child reviewer timed out" : result.stderr.trim() || `child reviewer exited with code ${result.exitCode}`;
					content = failureReport(practice, error);
				}

				await fsp.writeFile(reportPath, `${content}\n`, "utf8");
				const meta = extractReportMeta(content);
				completed++;
				ctx.ui.setStatus("retro", `reviewing ${completed}/${practices.length}`);

				return {
					practice,
					path: reportPath,
					status: meta.status,
					confidence: meta.confidence,
					score: meta.score,
					ok,
					error,
					usage: result.usage,
				} satisfies PracticeReport;
			});

			ctx.ui.setStatus("retro", "summarizing");
			const reportContents = await Promise.all(
				reports.map(async (report) => ({ report, content: await fsp.readFile(report.path, "utf8") })),
			);
			const summaryPrompt = buildSummaryPrompt(reports, reportContents);
			const summaryResult = await runChildPi(summaryPrompt, ctx.cwd, { model, timeoutMs: options.childTimeoutMs });
			const summary = summaryResult.ok ? summaryResult.output.trim() : deterministicSummary(reports, runDir);
			const summaryPath = path.join(runDir, "summary.md");
			await fsp.writeFile(summaryPath, `${summary}\n`, "utf8");

			const totalCost = [...reports.map((r) => r.usage.cost), summaryResult.usage.cost].reduce((sum, value) => sum + value, 0);
			ctx.ui.setStatus("retro", undefined);
			ctx.ui.notify(`Retro saved: ${summaryPath}${totalCost ? ` · $${totalCost.toFixed(4)}` : ""}`, "info");
			if (options.showSummaryInTui) {
				sendSummaryToTui(pi, summary, {
					summaryPath,
					runDir,
					reportCount: reports.length,
					totalCost,
					summaryGeneratedByModel: summaryResult.ok,
				}, ctx);
			}
		},
	});
}
