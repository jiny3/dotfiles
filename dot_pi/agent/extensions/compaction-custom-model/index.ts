import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
	compact,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const CONFIG_KEY = "compactionModel";
const STATUS_KEY = "compaction-custom-model";
const GLOBAL_SETTINGS_PATH = join(process.env.HOME ?? "", ".pi", "agent", "settings.json");
const PROJECT_SETTINGS_PATH = join(".pi", "settings.json");

interface Config {
	enabled: boolean;
	model: string;
	fallbackModels: string[];
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
}

const DEFAULT_CONFIG: Config = { enabled: true, model: "", fallbackModels: [] };

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readSettings(path: string): Partial<Config> {
	if (!existsSync(path)) return {};
	try {
		const raw = (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)[CONFIG_KEY];
		if (typeof raw === "string") return { model: raw.trim() };
		if (!isRecord(raw)) return {};
		const c: Partial<Config> = {};
		if (typeof raw.enabled === "boolean") c.enabled = raw.enabled;
		if (typeof raw.model === "string") c.model = raw.model.trim();
		if (Array.isArray(raw.fallbackModels)) c.fallbackModels = raw.fallbackModels.filter((s: unknown) => typeof s === "string");
		if (typeof raw.thinkingLevel === "string") c.thinkingLevel = raw.thinkingLevel as Config["thinkingLevel"];
		return c;
	} catch {
		return {};
	}
}

function loadConfig(ctx: ExtensionContext): Config {
	let c = { ...DEFAULT_CONFIG, ...readSettings(GLOBAL_SETTINGS_PATH) };
	if (ctx.isProjectTrusted()) c = { ...c, ...readSettings(join(ctx.cwd, PROJECT_SETTINGS_PATH)) };
	return { ...c, fallbackModels: c.fallbackModels ?? [] };
}

function resolveModel(ctx: ExtensionContext, spec: string): Model<Api> | undefined {
	const s = spec.trim();
	if (!s) return undefined;
	const i = s.indexOf("/");
	if (i > 0) return ctx.modelRegistry.find(s.slice(0, i), s.slice(i + 1));
	const all = ctx.modelRegistry.getAll();
	const exact = all.filter((m) => m.id === s);
	if (exact.length === 1) return exact[0];
	const lower = s.toLowerCase();
	const ci = all.filter((m) => m.id.toLowerCase() === lower || m.name.toLowerCase() === lower);
	return ci.length === 1 ? ci[0] : undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		const config = loadConfig(ctx);
		if (!config.enabled || (!config.model && config.fallbackModels.length === 0)) return;

		const candidates = [config.model, ...config.fallbackModels].filter(Boolean);
		const tried = new Set<string>();
		let lastError = "";

		for (const spec of candidates) {
			if (tried.has(spec)) continue;
			tried.add(spec);

			const model = resolveModel(ctx, spec);
			if (!model) continue;

			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
			if (!auth.ok || !auth.apiKey) continue;

			ctx.ui.setStatus(STATUS_KEY, `compacting ${model.provider}/${model.id}`);
			try {
				const result = await compact(
					event.preparation,
					model,
					auth.apiKey,
					auth.headers,
					undefined,
					event.signal,
					config.thinkingLevel,
				);
				ctx.ui.notify(`Compacted with ${model.provider}/${model.id}`, "info");
				return { compaction: result };
			} catch (error) {
				if (event.signal.aborted) return { cancel: true };
				lastError = `${model.provider}/${model.id}: ${error instanceof Error ? error.message : String(error)}`;
			} finally {
				ctx.ui.setStatus(STATUS_KEY, undefined);
			}
		}
		if (lastError) ctx.ui.notify(`All compaction models failed. Last error: ${lastError}`, "warning");
		// All failed - return undefined to let pi use default compaction
	});
}
