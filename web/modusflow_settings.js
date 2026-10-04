import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/**
 * ModusFlow Settings Extension
 * Integrates ModusFlow configuration directly into ComfyUI's native Settings panel,
 * provides a persistent menu button, and ensures reliable bootstrapping across frontend versions.
 */

// ── Shared / Fallback ModusFlow Settings Dialog ───────────────────────────────
function openModusFlowSettingsDialog() {
    if (typeof window.modusflowShowSettings === "function") {
        window.modusflowShowSettings();
        return;
    }

    const existing = document.getElementById("modusflow-settings-modal");
    if (existing) {
        existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "modusflow-settings-modal";
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10006; backdrop-filter: blur(5px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #45475a; border-radius: 12px; padding: 22px; width: 620px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.8); color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-y: auto;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 10px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 8px;">⚙️ <span>ModusFlow Studio &amp; AI Settings</span></h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "display: flex; flex-direction: column; gap: 14px;";

    const mkSection = (title) => {
        const sec = document.createElement("div");
        sec.style.cssText = "font-size: 11px; font-weight: 700; color: #89b4fa; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #313244; padding-bottom: 4px; margin-top: 4px;";
        sec.textContent = title;
        body.appendChild(sec);
    };

    const mkField = (label, el, hint = "") => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
        const lbl = document.createElement("label");
        lbl.style.cssText = "font-size: 12px; font-weight: 600; color: #cdd6f4;";
        lbl.textContent = label;
        row.appendChild(lbl);
        row.appendChild(el);
        if (hint) {
            const h = document.createElement("div");
            h.style.cssText = "font-size: 11px; color: #6c7086; line-height: 1.3;";
            h.textContent = hint;
            row.appendChild(h);
        }
        body.appendChild(row);
        return el;
    };

    const mkInput = (val, placeholder = "", type = "text") => {
        const input = document.createElement("input");
        input.type = type;
        input.value = val || "";
        input.placeholder = placeholder;
        input.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none;";
        input.onfocus = () => { input.style.borderColor = "#89b4fa"; };
        input.onblur = () => { input.style.borderColor = "#313244"; };
        return input;
    };

    (async () => {
        let cfg = {
            ollama_url: "http://127.0.0.1:11434",
            ollama_timeout: 120,
            cloud_api_url: "https://openrouter.ai/api/v1",
            cloud_api_key: "",
            cloud_model: "deepseek/deepseek-chat",
            civitai_api_key: "",
            prompts_save_directory: ""
        };
        try {
            const resp = await fetch("/modusflow/get_config");
            if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.data) cfg = Object.assign(cfg, data.data);
            }
        } catch (_) {}

        mkSection("1. Local Ollama AI LLM");
        const ollamaUrlInput = mkField("Local Ollama Server URL", mkInput(cfg.ollama_url, "http://127.0.0.1:11434"), "Endpoint for local Ollama instance (default: http://127.0.0.1:11434)");

        const timeoutInput = mkField("Ollama Timeout (seconds)", mkInput(cfg.ollama_timeout || 120, "120", "number"), "Timeout before canceling long LLM completions.");

        mkSection("2. Cloud LLMs (OpenAI, OpenRouter, Groq, DeepSeek)");
        const cloudUrlInput = mkField("Cloud API Base URL", mkInput(cfg.cloud_api_url, "https://openrouter.ai/api/v1"), "OpenAI-compatible chat completions endpoint");
        const cloudKeyInput = mkField("Cloud API Key", mkInput(cfg.cloud_api_key, "sk-...", "password"), "API key for OpenRouter or OpenAI cloud models");
        const cloudModelInput = mkField("Default Cloud Model", mkInput(cfg.cloud_model, "deepseek/deepseek-chat"), "e.g. deepseek/deepseek-chat, anthropic/claude-3.5-sonnet, openai/gpt-4o-mini");

        mkSection("3. Prompt Studio Defaults & Storage");
        const civitaiKeyInput = mkField("Civitai API Key", mkInput(cfg.civitai_api_key, "API Key"), "Used for high-resolution LoRA cards and metadata previews");
        const saveDirInput = mkField("Prompts Directory Override", mkInput(cfg.prompts_save_directory, "Leave blank for default: BASE_DIR/saved_prompts"), "Custom storage folder for prompt presets");

        const footer = document.createElement("div");
        footer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #313244; padding-top: 12px; margin-top: 8px;";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 7px 14px; color: #a6adc8; font-size: 12px; cursor: pointer;";
        cancelBtn.onclick = () => overlay.remove();

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "💾 Save & Apply Settings";
        saveBtn.style.cssText = "background: #89b4fa; border: none; border-radius: 6px; padding: 7px 16px; color: #11111b; font-size: 12px; font-weight: 700; cursor: pointer;";

        saveBtn.onclick = async () => {
            saveBtn.textContent = "⏳ Saving...";
            saveBtn.disabled = true;

            const payload = {
                ollama_url: (ollamaUrlInput.value || "").trim().replace(/\/+$/, ""),
                ollama_timeout: parseInt(timeoutInput.value, 10) || 120,
                cloud_api_url: (cloudUrlInput.value || "").trim().replace(/\/+$/, ""),
                cloud_api_key: (cloudKeyInput.value || "").trim(),
                cloud_model: (cloudModelInput.value || "").trim(),
                civitai_api_key: (civitaiKeyInput.value || "").trim(),
                prompts_save_directory: (saveDirInput.value || "").trim()
            };

            try {
                const resp = await fetch("/modusflow/save_config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const res = await resp.json();
                if (res.success) {
                    overlay.remove();
                } else {
                    alert("Failed to save settings: " + res.message);
                }
            } catch (err) {
                alert("Save error: " + err.message);
            } finally {
                saveBtn.textContent = "💾 Save & Apply Settings";
                saveBtn.disabled = false;
            }
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        dialog.appendChild(body);
        dialog.appendChild(footer);
    })();

    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

if (!window.modusflowShowSettings) {
    window.modusflowShowSettings = openModusFlowSettingsDialog;
}

// ── Persistent ComfyUI Menu Button ───────────────────────────────────────────
function attachComfyMenuButton() {
    if (document.getElementById("modusflow-sidebar-btn")) return;
    const comfyMenu = document.querySelector(".comfy-menu") || document.querySelector("#comfy-menu");
    if (comfyMenu) {
        const btn = document.createElement("button");
        btn.id = "modusflow-sidebar-btn";
        btn.type = "button";
        btn.textContent = "⚙️ ModusFlow";
        btn.title = "Open ModusFlow Studio & AI Configuration";
        btn.style.cssText = "font-weight: 600; color: #89b4fa; border: 1px solid rgba(137, 180, 250, 0.4); margin: 2px 0;";
        btn.onclick = (e) => {
            e.preventDefault();
            openModusFlowSettingsDialog();
        };
        comfyMenu.appendChild(btn);
    }
}

// ── Extension Registration ───────────────────────────────────────────────────
app.registerExtension({
    name: "ModusFlow.Settings",

    async setup() {
        attachComfyMenuButton();
        setTimeout(attachComfyMenuButton, 1000);
        setTimeout(attachComfyMenuButton, 3000);

        const getSettingsManager = () => {
            return app.ui?.settings || app.settings;
        };

        let attempts = 0;
        const maxAttempts = 25;

        const tryRegisterSettings = async () => {
            const sm = getSettingsManager();
            if (!sm || typeof sm.addSetting !== "function") {
                if (++attempts <= maxAttempts) {
                    setTimeout(tryRegisterSettings, 200);
                }
                return;
            }

            // Guard against duplicate registration
            if (sm._modusflowRegistered) {
                return;
            }
            sm._modusflowRegistered = true;

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

            // Fetch current Ollama status and models for the dropdown
            let ollamaModels = [];
            let ollamaOnline = false;
            let ollamaTestedUrl = "";

            const refreshOllamaStatus = async () => {
                try {
                    const resp = await api.fetchApi("/modusflow/ollama_status");
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.success && data.available && Array.isArray(data.models)) {
                            ollamaModels = data.models;
                            ollamaOnline = true;
                            ollamaTestedUrl = data.url || "";
                            return data;
                        }
                        ollamaTestedUrl = data.tested_url || "";
                    }
                } catch (_) {}
                ollamaOnline = false;
                return { available: false, models: [], tested_url: ollamaTestedUrl };
            };

            await refreshOllamaStatus();

            // 0. Dedicated ModusFlow Settings Dialog Launcher
            sm.addSetting({
                id: "ModusFlow.OpenStudioSettings",
                category: ["ModusFlow", "Studio & AI"],
                name: "ModusFlow: Dedicated Configuration Dialog",
                type: () => {
                    const wrap = document.createElement("div");
                    wrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = "⚙️ Open ModusFlow Settings Dialog";
                    btn.style.cssText = "background: #1e1e2e; color: #89b4fa; border: 1px solid #89b4fa; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.2s ease;";
                    btn.onmouseenter = () => { btn.style.background = "#89b4fa"; btn.style.color = "#11111b"; };
                    btn.onmouseleave = () => { btn.style.background = "#1e1e2e"; btn.style.color = "#89b4fa"; };
                    btn.onclick = () => {
                        openModusFlowSettingsDialog();
                    };

                    wrap.appendChild(btn);
                    return wrap;
                },
                defaultValue: null,
                tooltip: "Click to open the comprehensive floating ModusFlow configuration window",
                sortOrder: 100
            });

            // 1. Ollama Server URL (Local)
            sm.addSetting({
                id: "ModusFlow.OllamaURL",
                category: ["ModusFlow", "Local Ollama"],
                name: "ModusFlow: Local Ollama URL",
                type: "text",
                defaultValue: serverConfig.ollama_url || "http://127.0.0.1:11434",
                tooltip: "Endpoint for local Ollama instance (default: http://127.0.0.1:11434)",
                sortOrder: 50,
                onChange: (newVal, oldVal) => {
                    if (newVal !== undefined && oldVal !== undefined && newVal !== oldVal) {
                        const clean = newVal.trim().replace(/(\d+\.\d+\.\d+\.\d+)\.(?=:|/|$)/, "$1");
                        queueSave("ollama_url", clean);
                        refreshOllamaStatus();
                    }
                }
            });

            // 1b. Ollama Prompt Enhancement Model for Text Editor (Dropdown)
            sm.addSetting({
                id: "ModusFlow.OllamaEnhanceModel",
                category: ["ModusFlow", "Local Ollama"],
                name: "ModusFlow: Text Editor Ollama Model",
                type: "combo",
                defaultValue: ollamaModels.length ? ollamaModels[0] : "s1gnature/deepseek-r1-uncensored:8b",
                options: (val) => {
                    if (ollamaModels.length > 0) {
                        return ollamaModels;
                    }
                    return val ? [val] : ["--no models found--"];
                },
                tooltip: "Dropdown of local Ollama models for Text Editor one-click AI prompt enhancement",
                sortOrder: 46
            });

            // 1c. Quick Check Ollama Status Button
            sm.addSetting({
                id: "ModusFlow.OllamaCheckStatus",
                category: ["ModusFlow", "Local Ollama"],
                name: "ModusFlow: Check Ollama Status",
                type: () => {
                    const wrap = document.createElement("div");
                    wrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = "🔍 Check Status / Refresh";
                    btn.style.cssText = "background: #1e1e2e; color: #89b4fa; border: 1px solid #45475a; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease;";

                    const statusSpan = document.createElement("span");
                    statusSpan.style.cssText = "font-size: 12px; color: #a6adc8;";
                    statusSpan.textContent = ollamaOnline ? `🟢 Online (${ollamaModels.length} models detected)` : "⚪ Click to test connection";

                    btn.onmouseenter = () => { btn.style.background = "#313244"; btn.style.borderColor = "#89b4fa"; };
                    btn.onmouseleave = () => { btn.style.background = "#1e1e2e"; btn.style.borderColor = "#45475a"; };

                    btn.onclick = async () => {
                        btn.textContent = "⏳ Testing...";
                        const data = await refreshOllamaStatus();
                        btn.textContent = "🔍 Check Status / Refresh";

                        if (data && data.available) {
                            statusSpan.textContent = `🟢 Online (${data.models.length} models detected)`;
                            statusSpan.style.color = "#a6e3a1";
                            alert(`🟢 Ollama is Online!\n\nConnected to: ${data.url}\n\nAvailable Models (${data.models.length}):\n• ${data.models.join("\n• ")}`);
                        } else {
                            statusSpan.textContent = `🔴 Offline`;
                            statusSpan.style.color = "#f38ba8";
                            alert(`🔴 Ollama is Offline\n\nTried URL: ${data?.tested_url || 'configured URL'}\nError: ${data?.error || 'Connection failed'}\n\nPlease check your Ollama URL in settings and ensure 'ollama serve' is running.`);
                        }
                    };

                    wrap.appendChild(btn);
                    wrap.appendChild(statusSpan);
                    return wrap;
                },
                defaultValue: null,
                tooltip: "Click to immediately test connection to Ollama and refresh available models",
                sortOrder: 44
            });

            // 2. Ollama Request Timeout
            sm.addSetting({
                id: "ModusFlow.OllamaTimeout",
                category: ["ModusFlow", "Local Ollama"],
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
            sm.addSetting({
                id: "ModusFlow.OllamaCloudURL",
                category: ["ModusFlow", "Ollama Cloud"],
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
            sm.addSetting({
                id: "ModusFlow.OllamaCloudKey",
                category: ["ModusFlow", "Ollama Cloud"],
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
            sm.addSetting({
                id: "ModusFlow.CloudAPIURL",
                category: ["ModusFlow", "Cloud LLMs"],
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
            sm.addSetting({
                id: "ModusFlow.CloudAPIKey",
                category: ["ModusFlow", "Cloud LLMs"],
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
            sm.addSetting({
                id: "ModusFlow.CloudModel",
                category: ["ModusFlow", "Cloud LLMs"],
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
            sm.addSetting({
                id: "ModusFlow.CivitaiKey",
                category: ["ModusFlow", "Civitai"],
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
            sm.addSetting({
                id: "ModusFlow.PromptsSaveDirectory",
                category: ["ModusFlow", "Storage"],
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
        };

        tryRegisterSettings();
    }
});
