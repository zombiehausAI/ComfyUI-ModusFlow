import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/**
 * ModusFlow Settings Extension
 * Integrates ModusFlow configuration directly into ComfyUI's native Settings panel.
 */

app.registerExtension({
    name: "ModusFlow.Settings",

    async setup() {
        if (!app.ui?.settings?.addSetting) {
            return;
        }

        // Fetch current configuration from backend
        let serverConfig = {
            ollama_url: "http://127.0.0.1:11434",
            ollama_timeout: 120,
            ollama_cloud_url: "",
            ollama_cloud_api_key: "",
            cloud_api_url: "https://openrouter.ai/api/v1",
            cloud_api_key: "",
            cloud_model: "deepseek/deepseek-chat",
            civitai_api_key: "",
            prompts_save_directory: ""
        };

        try {
            const resp = await api.fetchApi("/modusflow/get_config");
            if (resp.ok) {
                const res = await resp.json();
                if (res.success && res.data) {
                    serverConfig = Object.assign(serverConfig, res.data);
                }
            }
        } catch (e) {
            console.warn("[ModusFlow Settings] Could not fetch server config:", e);
        }

        // Debounced saver to prevent rapid POST spam during typing
        let saveTimeout = null;
        const pendingChanges = {};

        const commitChanges = async () => {
            const payload = Object.assign({}, pendingChanges);
            for (const k of Object.keys(pendingChanges)) {
                delete pendingChanges[k];
            }
            try {
                await api.fetchApi("/modusflow/save_config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.error("[ModusFlow Settings] Failed to save config to server:", err);
            }
        };

        const queueSave = (key, val) => {
            pendingChanges[key] = val;
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(commitChanges, 400);
        };

        // 1. Ollama Server URL (Local)
        app.ui.settings.addSetting({
            id: "ModusFlow.OllamaURL",
            category: ["ModusFlow", "Local Ollama", "OllamaURL"],
            name: "ModusFlow: Local Ollama URL",
            type: "text",
            defaultValue: serverConfig.ollama_url || "http://127.0.0.1:11434",
            tooltip: "Endpoint for local Ollama instance (default: http://127.0.0.1:11434)",
            sortOrder: 50,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("ollama_url", newVal);
                }
            }
        });

        // 1b. Ollama Prompt Enhancement Model for Text Editor
        app.ui.settings.addSetting({
            id: "ModusFlow.OllamaEnhanceModel",
            category: ["ModusFlow", "Local Ollama", "OllamaEnhanceModel"],
            name: "ModusFlow: Text Editor Ollama Model",
            type: "text",
            defaultValue: "llama3.2",
            tooltip: "Model name for Text Editor one-click AI prompt enhancement (e.g. llama3.2, mistral, qwen2.5)",
            sortOrder: 45
        });

        // 2. Ollama Request Timeout
        app.ui.settings.addSetting({
            id: "ModusFlow.OllamaTimeout",
            category: ["ModusFlow", "Local Ollama", "OllamaTimeout"],
            name: "ModusFlow: Ollama Timeout (seconds)",
            type: "number",
            defaultValue: serverConfig.ollama_timeout || 120,
            tooltip: "Timeout in seconds for Ollama requests (default: 120)",
            sortOrder: 40,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("ollama_timeout", Number(newVal) || 120);
                }
            }
        });

        // 3. Ollama Cloud URL
        app.ui.settings.addSetting({
            id: "ModusFlow.OllamaCloudURL",
            category: ["ModusFlow", "Ollama Cloud", "OllamaCloudURL"],
            name: "ModusFlow: Ollama Cloud URL",
            type: "text",
            defaultValue: serverConfig.ollama_cloud_url || "",
            tooltip: "Endpoint for remote/cloud Ollama server (e.g. https://ollama.yourdomain.com)",
            sortOrder: 35,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("ollama_cloud_url", newVal);
                }
            }
        });

        // 4. Ollama Cloud API Key / Token
        app.ui.settings.addSetting({
            id: "ModusFlow.OllamaCloudKey",
            category: ["ModusFlow", "Ollama Cloud", "OllamaCloudKey"],
            name: "ModusFlow: Ollama Cloud API Key / Token",
            type: "text",
            defaultValue: serverConfig.ollama_cloud_api_key || "",
            tooltip: "Bearer token or API key for remote/cloud Ollama instance",
            sortOrder: 34,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("ollama_cloud_api_key", newVal);
                }
            }
        });

        // 5. Cloud LLM API URL (OpenAI / OpenRouter / Groq / DeepSeek)
        app.ui.settings.addSetting({
            id: "ModusFlow.CloudAPIURL",
            category: ["ModusFlow", "Cloud LLMs", "CloudAPIURL"],
            name: "ModusFlow: Cloud LLM Base URL",
            type: "text",
            defaultValue: serverConfig.cloud_api_url || "https://openrouter.ai/api/v1",
            tooltip: "OpenAI-compatible chat completions base URL (default: https://openrouter.ai/api/v1)",
            sortOrder: 30,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("cloud_api_url", newVal);
                }
            }
        });

        // 6. Cloud LLM API Key
        app.ui.settings.addSetting({
            id: "ModusFlow.CloudAPIKey",
            category: ["ModusFlow", "Cloud LLMs", "CloudAPIKey"],
            name: "ModusFlow: Cloud LLM API Key",
            type: "text",
            defaultValue: serverConfig.cloud_api_key || "",
            tooltip: "API key for OpenAI, OpenRouter, Groq, or DeepSeek cloud models",
            sortOrder: 29,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("cloud_api_key", newVal);
                }
            }
        });

        // 7. Default Cloud Model
        app.ui.settings.addSetting({
            id: "ModusFlow.CloudModel",
            category: ["ModusFlow", "Cloud LLMs", "CloudModel"],
            name: "ModusFlow: Default Cloud Model",
            type: "text",
            defaultValue: serverConfig.cloud_model || "deepseek/deepseek-chat",
            tooltip: "Default cloud model ID (e.g. deepseek/deepseek-chat, anthropic/claude-3.5-sonnet, openai/gpt-4o-mini)",
            sortOrder: 28,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("cloud_model", newVal);
                }
            }
        });

        // 8. Civitai API Key
        app.ui.settings.addSetting({
            id: "ModusFlow.CivitaiKey",
            category: ["ModusFlow", "Civitai", "CivitaiKey"],
            name: "ModusFlow: Civitai API Key",
            type: "text",
            defaultValue: serverConfig.civitai_api_key || "",
            tooltip: "API key for fetching Civitai LoRA preview images and metadata",
            sortOrder: 20,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("civitai_api_key", newVal);
                }
            }
        });

        // 9. Prompts Save Directory Override
        app.ui.settings.addSetting({
            id: "ModusFlow.PromptsSaveDirectory",
            category: ["ModusFlow", "Storage", "PromptsSaveDirectory"],
            name: "ModusFlow: Prompts Directory Override",
            type: "text",
            defaultValue: serverConfig.prompts_save_directory || "",
            tooltip: "Custom directory to save prompt JSON files. Leave empty for default: BASE_DIR/saved_prompts",
            sortOrder: 10,
            onChange: (newVal, oldVal) => {
                if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                    queueSave("prompts_save_directory", newVal);
                }
            }
        });
    }
});
