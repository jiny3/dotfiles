import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import {
    DEFAULT_MAX_BYTES,
    DEFAULT_MAX_LINES,
    formatSize,
    truncateHead,
    withFileMutationQueue,
    type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
    tavily,
    type TavilyClient,
    type TavilyCrawlOptions,
    type TavilyCrawlResponse,
    type TavilyExtractOptions,
    type TavilyExtractResponse,
    type TavilyMapOptions,
    type TavilyMapResponse,
    type TavilySearchOptions,
    type TavilySearchResponse,
} from "@tavily/core";
import { Type } from "typebox";

const API_KEYS_FILE = join(homedir(), ".pi", "agent", "extensions", "tavily", "API_KEYS");

let nextKeyIndex = 0;

type SearchDepth = "basic" | "advanced" | "fast" | "ultra-fast";
type ExtractDepth = "basic" | "advanced";
type ContentFormat = "markdown" | "text";

type KeyedResult<T> = {
    data: T;
    keyIndex: number;
    keyCount: number;
    attempts: number;
};

type SearchArgs = {
    query: string;
    search_depth?: SearchDepth;
    chunks_per_source?: number;
    max_results?: number;
    include_answer?: boolean;
    topic?: "general" | "news" | "finance";
    time_range?: "day" | "week" | "month" | "year";
    include_domains?: string[];
    exclude_domains?: string[];
    exact_match?: boolean;
};

type ExtractArgs = {
    urls: string[];
    extract_depth?: ExtractDepth;
    format?: ContentFormat;
    include_images?: boolean;
    query?: string;
    chunks_per_source?: number;
};

type CrawlArgs = {
    url: string;
    max_depth?: number;
    max_breadth?: number;
    limit?: number;
    instructions?: string;
    extract_depth?: ExtractDepth;
    format?: ContentFormat;
    select_paths?: string[];
    select_domains?: string[];
    exclude_paths?: string[];
    exclude_domains?: string[];
    allow_external?: boolean;
    include_images?: boolean;
};

type MapArgs = {
    url: string;
    max_depth?: number;
    max_breadth?: number;
    limit?: number;
    instructions?: string;
    select_paths?: string[];
    select_domains?: string[];
    exclude_paths?: string[];
    exclude_domains?: string[];
    allow_external?: boolean;
};

async function loadApiKeys(): Promise<string[]> {
    const content = await readFile(API_KEYS_FILE, "utf8").catch(() => {
        throw new Error(`Failed to read Tavily API keys file: ${API_KEYS_FILE}`);
    });

    const keys = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

    if (keys.length === 0) {
        throw new Error(`Tavily API keys file is empty: ${API_KEYS_FILE}`);
    }

    return [...new Set(keys)];
}

async function callWithKeyRotation<T>(
    operationName: string,
    run: (client: TavilyClient) => Promise<T>,
): Promise<KeyedResult<T>> {
    const keys = await loadApiKeys();
    const startIndex = nextKeyIndex % keys.length;
    nextKeyIndex = (nextKeyIndex + 1) % keys.length;

    let lastError = "unknown error";

    for (let offset = 0; offset < keys.length; offset += 1) {
        const keyIndex = (startIndex + offset) % keys.length;

        try {
            const client = tavily({ apiKey: keys[keyIndex], clientName: "pi-tavily" });
            const data = await run(client);
            nextKeyIndex = (keyIndex + 1) % keys.length;
            return { data, keyIndex, keyCount: keys.length, attempts: offset + 1 };
        } catch (error) {
            lastError = `key #${keyIndex + 1}: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    throw new Error(`Tavily ${operationName} failed after trying all API keys: ${lastError}`);
}

async function truncateOutput(fullOutput: string, fileName: string): Promise<{ text: string; fullOutputPath?: string }> {
    const truncation = truncateHead(fullOutput, {
        maxLines: DEFAULT_MAX_LINES,
        maxBytes: DEFAULT_MAX_BYTES,
    });

    if (!truncation.truncated) return { text: truncation.content };

    const tempDir = await mkdtemp(join(tmpdir(), "pi-tavily-"));
    const fullOutputPath = join(tempDir, fileName);

    await withFileMutationQueue(fullOutputPath, async () => {
        await writeFile(fullOutputPath, fullOutput, "utf8");
    });

    let text = truncation.content;
    text += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
    text += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    text += ` Full output saved to: ${fullOutputPath}]`;

    return { text, fullOutputPath };
}

function formatSearchResponse(data: TavilySearchResponse): string {
    const sections: string[] = [];

    if (data.answer) {
        sections.push(`## Answer\n${data.answer}`);
    }

    if (data.results.length > 0) {
        const lines = data.results.map((result, index) => {
            const item = [`### ${index + 1}. ${result.title ?? "(untitled)"}`];
            if (result.url) item.push(`URL: ${result.url}`);
            if (result.publishedDate) item.push(`Published: ${result.publishedDate}`);
            if (typeof result.score === "number") item.push(`Relevance: ${(result.score * 100).toFixed(1)}%`);
            if (result.content) item.push(`Snippet:\n${result.content}`);
            return item.join("\n");
        });

        sections.push(`## Search Results (${data.results.length} results)\n\n${lines.join("\n\n")}`);
    }

    return sections.length > 0 ? sections.join("\n\n") : "No Tavily results returned.";
}

function formatExtractResponse(data: TavilyExtractResponse): string {
    const sections: string[] = [];

    if (data.results.length > 0) {
        const lines = data.results.map((result, index) => {
            const title = result.title ? `${result.title} — ${result.url}` : result.url;
            return `### ${index + 1}. ${title}\n\n${result.rawContent}`;
        });
        sections.push(`## Extract Results (${data.results.length} pages)\n\n${lines.join("\n\n")}`);
    }

    if (data.failedResults.length > 0) {
        const lines = data.failedResults.map((result, index) => `${index + 1}. ${result.url}: ${result.error}`);
        sections.push(`## Failed Results (${data.failedResults.length})\n${lines.join("\n")}`);
    }

    return sections.length > 0 ? sections.join("\n\n") : "No Tavily extract results returned.";
}

function formatCrawlResponse(data: TavilyCrawlResponse): string {
    if (data.results.length === 0) return "No Tavily crawl results returned.";

    const lines = data.results.map((result, index) => `### ${index + 1}. ${result.url}\n\n${result.rawContent}`);
    return [`## Crawl Results (${data.results.length} pages)`, `Base URL: ${data.baseUrl}`, lines.join("\n\n")].join("\n\n");
}

function formatMapResponse(data: TavilyMapResponse): string {
    if (data.results.length === 0) return "No Tavily map results returned.";

    const lines = data.results.map((url, index) => `${index + 1}. ${url}`);
    return [`## Site Map (${data.results.length} URLs)`, `Base URL: ${data.baseUrl}`, lines.join("\n")].join("\n\n");
}

function buildSearchOptions(params: SearchArgs): TavilySearchOptions {
    const searchDepth = params.search_depth ?? "advanced";
    const options: TavilySearchOptions = {
        searchDepth,
        maxResults: params.max_results ?? 5,
        includeAnswer: params.include_answer ?? false,
        includeImages: false,
        includeUsage: true,
        timeout: 60,
    };

    if (searchDepth === "advanced") options.chunksPerSource = params.chunks_per_source ?? 3;
    if (params.topic) options.topic = params.topic;
    if (params.time_range) options.timeRange = params.time_range;
    if (params.include_domains?.length) options.includeDomains = params.include_domains;
    if (params.exclude_domains?.length) options.excludeDomains = params.exclude_domains;
    if (params.exact_match) options.exactMatch = true;

    return options;
}

function buildExtractOptions(params: ExtractArgs): TavilyExtractOptions {
    const options: TavilyExtractOptions = {
        extractDepth: params.extract_depth ?? "basic",
        format: params.format ?? "markdown",
        includeImages: params.include_images ?? false,
        includeUsage: true,
        timeout: 60,
    };

    if (params.query) options.query = params.query;
    if (params.chunks_per_source) options.chunksPerSource = params.chunks_per_source;

    return options;
}

function buildCrawlOptions(params: CrawlArgs): TavilyCrawlOptions {
    const options: TavilyCrawlOptions = {
        maxDepth: params.max_depth ?? 1,
        maxBreadth: params.max_breadth,
        limit: params.limit ?? 10,
        instructions: params.instructions,
        extractDepth: params.extract_depth ?? "basic",
        format: params.format ?? "markdown",
        selectPaths: params.select_paths,
        selectDomains: params.select_domains,
        excludePaths: params.exclude_paths,
        excludeDomains: params.exclude_domains,
        allowExternal: params.allow_external ?? false,
        includeImages: params.include_images ?? false,
        includeUsage: true,
        timeout: 150,
    };

    return options;
}

function buildMapOptions(params: MapArgs): TavilyMapOptions {
    return {
        maxDepth: params.max_depth ?? 1,
        maxBreadth: params.max_breadth,
        limit: params.limit ?? 50,
        instructions: params.instructions,
        selectPaths: params.select_paths,
        selectDomains: params.select_domains,
        excludePaths: params.exclude_paths,
        excludeDomains: params.exclude_domains,
        allowExternal: params.allow_external ?? false,
        includeUsage: true,
        timeout: 150,
    };
}

const SearchParams = Type.Object({
    query: Type.String({ description: "The web search query" }),
    search_depth: Type.Optional(
        StringEnum(["basic", "advanced", "fast", "ultra-fast"] as const, {
            description: "Latency/relevance mode. Default: advanced for stronger agent evidence.",
        }),
    ),
    chunks_per_source: Type.Optional(Type.Number({ description: "Relevant snippets per source for advanced search. Default: 3.", minimum: 1, maximum: 3 })),
    max_results: Type.Optional(Type.Number({ description: "Maximum number of results, 0-20. Default: 5.", minimum: 0, maximum: 20 })),
    include_answer: Type.Optional(Type.Boolean({ description: "Include Tavily's generated answer. Default: false; verify against sources." })),
    topic: Type.Optional(StringEnum(["general", "news", "finance"] as const, { description: "Search category. Default: general." })),
    time_range: Type.Optional(StringEnum(["day", "week", "month", "year"] as const, { description: "Filter by recent publish/update time." })),
    include_domains: Type.Optional(Type.Array(Type.String(), { description: "Only include these domains." })),
    exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude these domains." })),
    exact_match: Type.Optional(Type.Boolean({ description: "Require exact quoted phrases from query to match." })),
});

const ExtractParams = Type.Object({
    urls: Type.Array(Type.String(), { description: "URLs to extract clean content from.", minItems: 1 }),
    extract_depth: Type.Optional(StringEnum(["basic", "advanced"] as const, { description: "Extraction depth. Default: basic." })),
    format: Type.Optional(StringEnum(["markdown", "text"] as const, { description: "Output format. Default: markdown." })),
    include_images: Type.Optional(Type.Boolean({ description: "Include extracted image URLs. Default: false." })),
    query: Type.Optional(Type.String({ description: "Optional focus query for extraction." })),
    chunks_per_source: Type.Optional(Type.Number({ description: "Relevant chunks per source when query is provided.", minimum: 1, maximum: 3 })),
});

const CrawlParams = Type.Object({
    url: Type.String({ description: "Starting URL to crawl." }),
    max_depth: Type.Optional(Type.Number({ description: "Maximum crawl depth. Default: 1.", minimum: 0 })),
    max_breadth: Type.Optional(Type.Number({ description: "Maximum links followed per page." })),
    limit: Type.Optional(Type.Number({ description: "Maximum pages to return. Default: 10.", minimum: 1 })),
    instructions: Type.Optional(Type.String({ description: "Natural-language crawl instructions." })),
    extract_depth: Type.Optional(StringEnum(["basic", "advanced"] as const, { description: "Extraction depth. Default: basic." })),
    format: Type.Optional(StringEnum(["markdown", "text"] as const, { description: "Extracted content format. Default: markdown." })),
    select_paths: Type.Optional(Type.Array(Type.String(), { description: "Only crawl matching paths." })),
    select_domains: Type.Optional(Type.Array(Type.String(), { description: "Only crawl matching domains." })),
    exclude_paths: Type.Optional(Type.Array(Type.String(), { description: "Exclude matching paths." })),
    exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude matching domains." })),
    allow_external: Type.Optional(Type.Boolean({ description: "Allow external domains. Default: false." })),
    include_images: Type.Optional(Type.Boolean({ description: "Include image URLs. Default: false." })),
});

const MapParams = Type.Object({
    url: Type.String({ description: "Starting URL to map." }),
    max_depth: Type.Optional(Type.Number({ description: "Maximum traversal depth. Default: 1.", minimum: 0 })),
    max_breadth: Type.Optional(Type.Number({ description: "Maximum links followed per page." })),
    limit: Type.Optional(Type.Number({ description: "Maximum URLs to return. Default: 50.", minimum: 1 })),
    instructions: Type.Optional(Type.String({ description: "Natural-language mapping instructions." })),
    select_paths: Type.Optional(Type.Array(Type.String(), { description: "Only include matching paths." })),
    select_domains: Type.Optional(Type.Array(Type.String(), { description: "Only include matching domains." })),
    exclude_paths: Type.Optional(Type.Array(Type.String(), { description: "Exclude matching paths." })),
    exclude_domains: Type.Optional(Type.Array(Type.String(), { description: "Exclude matching domains." })),
    allow_external: Type.Optional(Type.Boolean({ description: "Allow external domains. Default: false." })),
});

export default function (pi: ExtensionAPI) {
    pi.registerTool({
        name: "tavily_search",
        label: "Tavily Search",
        description: `Search the web using Tavily. API keys are read from ${API_KEYS_FILE}. Defaults follow Tavily agent guidance: advanced search, 3 chunks per source, 5 results, no generated answer unless requested. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temp file when truncated.`,
        promptSnippet: "Search the web for current information via Tavily",
        promptGuidelines: [
            "Use tavily_search when the user asks for current information, recent events, web pages, external facts, documentation, APIs, or URLs not available in local files.",
            "Use tavily_search results with their source URLs; do not invent citations or claim web facts that are not supported by returned sources.",
            "Use tavily_search with search_depth 'advanced' for research, comparisons, and high-confidence answers; use 'basic', 'fast', or 'ultra-fast' only when latency or credit cost matters.",
            "Avoid include_answer unless the user needs a quick answer seed; always verify generated answers against returned sources.",
        ],
        parameters: SearchParams,
        async execute(_toolCallId, params: SearchArgs, signal, onUpdate) {
            if (signal?.aborted) throw new Error("Search cancelled");
            onUpdate?.({ content: [{ type: "text", text: `Searching web: ${params.query}` }] });

            const { data, keyIndex, keyCount, attempts } = await callWithKeyRotation("search", (client) =>
                client.search(params.query, buildSearchOptions(params)),
            );
            const { text, fullOutputPath } = await truncateOutput(formatSearchResponse(data), "search.md");

            return {
                content: [{ type: "text", text }],
                details: {
                    query: data.query ?? params.query,
                    resultCount: data.results.length,
                    responseTime: data.responseTime,
                    requestId: data.requestId,
                    credits: data.usage?.credits,
                    fullOutputPath,
                    keyIndex: keyIndex + 1,
                    keyCount,
                    attempts,
                    sources: data.results.map((result) => ({ title: result.title, url: result.url })),
                },
            };
        },
    });

    pi.registerTool({
        name: "tavily_extract",
        label: "Tavily Extract",
        description: `Extract clean page content from known URLs using Tavily. API keys are read from ${API_KEYS_FILE}. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temp file when truncated.`,
        promptSnippet: "Extract clean content from known URLs via Tavily",
        promptGuidelines: [
            "Use tavily_extract when the user provides specific URL(s) and asks to read, summarize, translate, compare, or inspect their contents.",
            "Prefer tavily_search first when the source URLs are unknown, then tavily_extract for the selected authoritative URLs.",
        ],
        parameters: ExtractParams,
        async execute(_toolCallId, params: ExtractArgs, signal, onUpdate) {
            if (signal?.aborted) throw new Error("Extract cancelled");
            onUpdate?.({ content: [{ type: "text", text: `Extracting ${params.urls.length} URL(s)` }] });

            const { data, keyIndex, keyCount, attempts } = await callWithKeyRotation("extract", (client) =>
                client.extract(params.urls, buildExtractOptions(params)),
            );
            const { text, fullOutputPath } = await truncateOutput(formatExtractResponse(data), "extract.md");

            return {
                content: [{ type: "text", text }],
                details: {
                    resultCount: data.results.length,
                    failedCount: data.failedResults.length,
                    responseTime: data.responseTime,
                    requestId: data.requestId,
                    credits: data.usage?.credits,
                    fullOutputPath,
                    keyIndex: keyIndex + 1,
                    keyCount,
                    attempts,
                    sources: data.results.map((result) => ({ title: result.title, url: result.url })),
                    failedSources: data.failedResults,
                },
            };
        },
    });

    pi.registerTool({
        name: "tavily_crawl",
        label: "Tavily Crawl",
        description: `Crawl a site from a starting URL and return extracted page content using Tavily. API keys are read from ${API_KEYS_FILE}. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temp file when truncated.`,
        promptSnippet: "Crawl a site and extract multiple pages via Tavily",
        promptGuidelines: [
            "Use tavily_crawl when the user asks to read many pages under a site, docs section, help center, or knowledge base.",
            "Use tavily_map before tavily_crawl when the user wants to understand site structure or select pages before reading content.",
            "Keep tavily_crawl limits small unless the user explicitly asks for broad coverage.",
        ],
        parameters: CrawlParams,
        async execute(_toolCallId, params: CrawlArgs, signal, onUpdate) {
            if (signal?.aborted) throw new Error("Crawl cancelled");
            onUpdate?.({ content: [{ type: "text", text: `Crawling: ${params.url}` }] });

            const { data, keyIndex, keyCount, attempts } = await callWithKeyRotation("crawl", (client) =>
                client.crawl(params.url, buildCrawlOptions(params)),
            );
            const { text, fullOutputPath } = await truncateOutput(formatCrawlResponse(data), "crawl.md");

            return {
                content: [{ type: "text", text }],
                details: {
                    baseUrl: data.baseUrl,
                    resultCount: data.results.length,
                    responseTime: data.responseTime,
                    requestId: data.requestId,
                    credits: data.usage?.credits,
                    fullOutputPath,
                    keyIndex: keyIndex + 1,
                    keyCount,
                    attempts,
                    sources: data.results.map((result) => ({ url: result.url })),
                },
            };
        },
    });

    pi.registerTool({
        name: "tavily_map",
        label: "Tavily Map",
        description: `Map a site from a starting URL and return discovered URLs using Tavily. API keys are read from ${API_KEYS_FILE}. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved to a temp file when truncated.`,
        promptSnippet: "Discover site structure and URLs via Tavily",
        promptGuidelines: [
            "Use tavily_map when the user asks what pages exist on a site, wants a site structure overview, or needs to choose URLs before extraction/crawling.",
            "Use tavily_extract after tavily_map when only a few selected URLs need full content.",
            "Use tavily_crawl after tavily_map when many discovered pages need content extraction.",
        ],
        parameters: MapParams,
        async execute(_toolCallId, params: MapArgs, signal, onUpdate) {
            if (signal?.aborted) throw new Error("Map cancelled");
            onUpdate?.({ content: [{ type: "text", text: `Mapping: ${params.url}` }] });

            const { data, keyIndex, keyCount, attempts } = await callWithKeyRotation("map", (client) =>
                client.map(params.url, buildMapOptions(params)),
            );
            const { text, fullOutputPath } = await truncateOutput(formatMapResponse(data), "map.md");

            return {
                content: [{ type: "text", text }],
                details: {
                    baseUrl: data.baseUrl,
                    resultCount: data.results.length,
                    responseTime: data.responseTime,
                    requestId: data.requestId,
                    credits: data.usage?.credits,
                    fullOutputPath,
                    keyIndex: keyIndex + 1,
                    keyCount,
                    attempts,
                    urls: data.results,
                },
            };
        },
    });
}
