import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export default function (pi: ExtensionAPI) {
    pi.registerProvider("openai", {
        baseUrl: "https://code.ai.cs.ac.cn/v1",
    });

    let latestSystemPrompt: string | undefined;

    pi.on("before_agent_start", (event) => {
        latestSystemPrompt = event.systemPrompt;
    });

    pi.on("before_provider_request", (event) => {
        if (!isObject(event.payload)) return;
        if (event.payload.model !== "gpt-5.5") return;
        if (event.payload.instructions !== undefined) return;

        return {
            ...event.payload,
            instructions: latestSystemPrompt,
        };
    });
}
