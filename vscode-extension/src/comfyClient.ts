import * as vscode from "vscode";

export interface ModusFlowConfig {
    ollama_url?: string;
    ollama_model?: string;
    ollama_timeout?: number;
    prompts_save_directory?: string;
    prompt_style?: string;
    syntax_theme?: string;
}

export interface PromptFileItem {
    filename: string;
    category?: string;
    positive?: string;
    negative?: string;
    type?: string;
}

export interface LoraMetadata {
    modelId?: number | string;
    modelName?: string;
    creator?: string;
    trainedWords?: string[];
    description?: string;
    images?: string[];
}

export interface CanvasNodeInfo {
    id: string;
    title: string;
    positive: string;
    negative: string;
    prompt_style: string;
    is_selected?: boolean;
    timestamp?: number;
}

export class ComfyClient {
    private getBaseUrl(): string {
        const cfg = vscode.workspace.getConfiguration("modusflow");
        let url = cfg.get<string>("comfyUrl", "http://127.0.0.1:8188").trim();
        return url.replace(/\/+$/, "");
    }

    async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const resp = await fetch(url, options);
        if (!resp.ok) {
            throw new Error(`ComfyUI API error: ${resp.status} ${resp.statusText}`);
        }
        return (await resp.json()) as T;
    }

    async testConnection(): Promise<{ online: boolean; message: string }> {
        try {
            const res = await this.fetchJson<{ success: boolean; data?: ModusFlowConfig }>("/modusflow/get_config");
            if (res && res.success) {
                return { online: true, message: `Connected to ComfyUI at ${this.getBaseUrl()}` };
            }
            return { online: false, message: "ComfyUI responded but ModusFlow endpoints were not found." };
        } catch (e: any) {
            return { online: false, message: `Failed to connect: ${e.message}` };
        }
    }

    async getConfig(): Promise<ModusFlowConfig> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: ModusFlowConfig }>("/modusflow/get_config");
            return res.data || {};
        } catch {
            return {};
        }
    }

    async listPrompts(): Promise<PromptFileItem[]> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: PromptFileItem[] }>("/modusflow/list_prompts");
            return res.data || [];
        } catch {
            return [];
        }
    }

    async loadPrompt(filename: string): Promise<PromptFileItem | null> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: PromptFileItem }>("/modusflow/load_prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            });
            return res.data || null;
        } catch {
            return null;
        }
    }

    async savePrompt(payload: { filename: string; category?: string; positive: string; negative: string }): Promise<boolean> {
        try {
            const res = await this.fetchJson<{ success: boolean }>("/modusflow/save_prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            return !!res.success;
        } catch {
            return false;
        }
    }

    async listWildcards(): Promise<string[]> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: string[] }>("/modusflow/wildcards/list");
            return res.data || [];
        } catch {
            return [];
        }
    }

    async loadWildcard(filename: string): Promise<string> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: string }>("/modusflow/wildcards/load", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            });
            return res.data || "";
        } catch {
            return "";
        }
    }

    async listLoras(): Promise<string[]> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: string[] }>("/modusflow/get_loras");
            return res.data || [];
        } catch {
            return [];
        }
    }

    async getLoraMetadata(name: string): Promise<LoraMetadata | null> {
        try {
            const res = await this.fetchJson<{ success: boolean; data: LoraMetadata }>(`/modusflow/get_lora_metadata?name=${encodeURIComponent(name)}`);
            return res.data || null;
        } catch {
            return null;
        }
    }

    async refineSelection(text: string, action: string, model?: string, promptStyle?: string): Promise<{ success: boolean; refined_text?: string; choices?: string[]; message?: string }> {
        const payload: any = {
            text,
            action,
            style: promptStyle || vscode.workspace.getConfiguration("modusflow").get("defaultPromptStyle", "Tags (SDXL / Pony)")
        };
        if (model) payload.model = model;

        try {
            return await this.fetchJson<{ success: boolean; refined_text?: string; choices?: string[]; message?: string }>("/modusflow/refine_selection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async queuePrompt(): Promise<{ success: boolean; prompt_id?: string; message?: string }> {
        try {
            const res = await this.fetchJson<{ prompt_id?: string; error?: any }>("/prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ client_id: "modusflow-vscode" })
            });
            if (res.prompt_id) {
                return { success: true, prompt_id: res.prompt_id };
            }
            return { success: false, message: res.error ? JSON.stringify(res.error) : "Failed to queue" };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }

    async getActiveCanvasNode(): Promise<CanvasNodeInfo | null> {
        try {
            const res = await this.fetchJson<{ success: boolean; data?: CanvasNodeInfo; nodes?: CanvasNodeInfo[] }>("/modusflow/canvas/active_node");
            return res?.data || null;
        } catch {
            return null;
        }
    }

    async pushPromptToCanvas(payload: { node_id?: string | number; positive: string; negative?: string; prompt_style?: string }): Promise<boolean> {
        try {
            const res = await this.fetchJson<{ success: boolean; message?: string }>("/modusflow/canvas/push_prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            return !!res.success;
        } catch {
            return false;
        }
    }
}
