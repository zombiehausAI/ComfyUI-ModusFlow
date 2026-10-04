import * as vscode from "vscode";
import { ComfyClient } from "./comfyClient";
import { NEGATIVE_PEDALS, AESTHETIC_RIBBON, prettifyAndDedupe, convertStyle } from "./editorTools";

export class ModusFlowStudioPanel {
    public static currentPanel: ModusFlowStudioPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _client: ComfyClient;
    private _disposables: vscode.Disposable[] = [];

    private _activeFilename: string = "New_Prompt.json";
    private _activeCategory: string = "General";
    private _positiveText: string = "";
    private _negativeText: string = "";
    private _promptStyle: "tags" | "expressions" = "tags";

    public static createOrShow(extensionUri: vscode.Uri, client: ComfyClient, initialData?: { filename?: string; category?: string; positive?: string; negative?: string }): void {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (ModusFlowStudioPanel.currentPanel) {
            ModusFlowStudioPanel.currentPanel._panel.reveal(column);
            if (initialData) {
                ModusFlowStudioPanel.currentPanel.loadData(initialData);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "modusflowStudio",
            "ModusFlow Studio Cockpit",
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, "resources")]
            }
        );

        ModusFlowStudioPanel.currentPanel = new ModusFlowStudioPanel(panel, extensionUri, client, initialData);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, client: ComfyClient, initialData?: { filename?: string; category?: string; positive?: string; negative?: string }) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._client = client;

        if (initialData) {
            this._activeFilename = initialData.filename || "New_Prompt.json";
            this._activeCategory = initialData.category || "General";
            this._positiveText = initialData.positive || "";
            this._negativeText = initialData.negative || "";
        }

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case "updateContent":
                    this._positiveText = msg.positive || "";
                    this._negativeText = msg.negative || "";
                    this._activeFilename = msg.filename || this._activeFilename;
                    this._activeCategory = msg.category || this._activeCategory;
                    this._promptStyle = msg.promptStyle || this._promptStyle;
                    break;

                case "savePrompt":
                    await this._handleSave(msg);
                    break;

                case "pushToCanvas":
                    await this._handlePushToCanvas(msg);
                    break;

                case "queuePrompt":
                    await this._handleQueue();
                    break;

                case "enhanceOllama":
                    await this._handleEnhanceOllama();
                    break;

                case "prettify":
                    this._positiveText = prettifyAndDedupe(this._positiveText);
                    this._negativeText = prettifyAndDedupe(this._negativeText);
                    this._panel.webview.postMessage({
                        type: "syncContent",
                        positive: this._positiveText,
                        negative: this._negativeText
                    });
                    vscode.window.showInformationMessage("🧹 Normalized commas and removed duplicate tags.");
                    break;

                case "convertStyle":
                    const toStyle = msg.targetStyle as "tags" | "expressions";
                    this._positiveText = convertStyle(this._positiveText, toStyle);
                    if (toStyle === "expressions") {
                        // Strip weights from negative as well
                        this._negativeText = convertStyle(this._negativeText, "expressions");
                    }
                    this._promptStyle = toStyle;
                    this._panel.webview.postMessage({
                        type: "syncContent",
                        positive: this._positiveText,
                        negative: this._negativeText,
                        promptStyle: this._promptStyle
                    });
                    break;
            }
        }, null, this._disposables);
    }

    public loadData(data: { filename?: string; category?: string; positive?: string; negative?: string }): void {
        if (data.filename) this._activeFilename = data.filename;
        if (data.category) this._activeCategory = data.category;
        if (data.positive !== undefined) this._positiveText = data.positive;
        if (data.negative !== undefined) this._negativeText = data.negative;

        this._panel.webview.postMessage({
            type: "syncContent",
            filename: this._activeFilename,
            category: this._activeCategory,
            positive: this._positiveText,
            negative: this._negativeText,
            promptStyle: this._promptStyle
        });
    }

    private async _handleSave(msg: any): Promise<void> {
        const filename = (msg.filename || this._activeFilename).trim();
        const category = (msg.category || this._activeCategory).trim();
        const positive = msg.positive !== undefined ? msg.positive : this._positiveText;
        const negative = msg.negative !== undefined ? msg.negative : this._negativeText;

        const success = await this._client.savePrompt({
            filename: filename.endsWith(".json") ? filename : `${filename}.json`,
            category,
            positive,
            negative
        });

        if (success) {
            vscode.window.showInformationMessage(`✅ Prompt saved: ${filename}`);
        } else {
            vscode.window.showErrorMessage(`Failed to save prompt "${filename}"`);
        }
    }

    private async _handlePushToCanvas(msg: any): Promise<void> {
        const activeNode = await this._client.getActiveCanvasNode();
        const success = await this._client.pushPromptToCanvas({
            node_id: activeNode?.id,
            positive: msg.positive !== undefined ? msg.positive : this._positiveText,
            negative: msg.negative !== undefined ? msg.negative : this._negativeText,
            prompt_style: msg.promptStyle || this._promptStyle
        });
        if (success) {
            vscode.window.showInformationMessage(`🚀 Pushed prompt to ComfyUI canvas node ${activeNode ? '#' + activeNode.id : ''}!`);
        } else {
            vscode.window.showErrorMessage("Failed to push prompt to ComfyUI canvas node. Is ComfyUI running?");
        }
    }

    private async _handleQueue(): Promise<void> {
        vscode.window.showInformationMessage("🚀 Queuing generation prompt in ComfyUI...");
        const res = await this._client.queuePrompt();
        if (res.success) {
            vscode.window.showInformationMessage(`✅ Queued prompt! ID: ${res.prompt_id}`);
        } else {
            vscode.window.showErrorMessage(`Failed to queue prompt: ${res.message}`);
        }
    }

    private async _handleEnhanceOllama(): Promise<void> {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "ModusFlow: Enhancing prompt with Ollama AI...",
            cancellable: false
        }, async () => {
            const res = await this._client.refineSelection(this._positiveText, "expand", undefined, this._promptStyle === "tags" ? "Tags (SDXL / Pony)" : "Expressions (Flux / SD3)");
            if (res.success && res.refined_text) {
                this._positiveText = res.refined_text;
                this._panel.webview.postMessage({
                    type: "syncContent",
                    positive: this._positiveText,
                    negative: this._negativeText
                });
                vscode.window.showInformationMessage("✨ Enhanced prompt with Ollama!");
            } else {
                vscode.window.showErrorMessage(`Ollama enhancement failed: ${res.message || "No response"}`);
            }
        });
    }

    public dispose(): void {
        ModusFlowStudioPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _update(): void {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        const pedalsJson = JSON.stringify(NEGATIVE_PEDALS);
        const ribbonJson = JSON.stringify(AESTHETIC_RIBBON);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ModusFlow Studio Cockpit</title>
    <style>
        :root {
            --bg-base: #13141f;
            --bg-card: #1c1d2e;
            --bg-input: #10111a;
            --border-color: #2e3148;
            --accent-cyan: #00f0ff;
            --accent-magenta: #ff007f;
            --accent-purple: #9d4edd;
            --accent-green: #00ff88;
            --accent-yellow: #ffd60a;
            --text-main: #f0f2f5;
            --text-muted: #8b92a5;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            padding: 16px;
            overflow-x: hidden;
        }

        .studio-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .meta-fields {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }

        .meta-label {
            font-weight: 600;
            color: var(--accent-cyan);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        input[type="text"], select {
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="text"]:focus, select:focus {
            border-color: var(--accent-cyan);
        }

        .actions-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        button.btn {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease-in-out;
        }
        button.btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
            border-color: var(--border-color) !important;
            box-shadow: none !important;
        }
        button.btn:hover:not(:disabled) {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
        }
        button.btn-primary {
            background: linear-gradient(135deg, #0088cc, #00f0ff);
            color: #050b14;
            font-weight: 600;
            border: none;
        }
        button.btn-primary:hover {
            box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
        }
        button.btn-queue {
            background: linear-gradient(135deg, #ff007f, #9d4edd);
            color: #ffffff;
            font-weight: 600;
            border: none;
        }
        button.btn-queue:hover {
            box-shadow: 0 0 15px rgba(255, 0, 127, 0.4);
        }

        /* Ribbon bar */
        .aesthetic-ribbon {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            overflow-x: auto;
        }
        .ribbon-title {
            font-size: 11px;
            font-weight: bold;
            color: var(--accent-purple);
            text-transform: uppercase;
            white-space: nowrap;
        }

        /* Editors layout */
        .editors-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 12px;
        }
        @media (max-width: 800px) {
            .editors-container { grid-template-columns: 1fr; }
        }

        .editor-pane {
            display: flex;
            flex-direction: column;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        .pane-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--border-color);
        }
        .pane-title {
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pane-title.positive { color: var(--accent-cyan); }
        .pane-title.negative { color: var(--accent-magenta); }

        .syntax-wrapper {
            position: relative;
            width: 100%;
            height: 340px;
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
            transition: border-color 0.2s;
        }
        .syntax-wrapper:focus-within {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
        }

        .syntax-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 10px;
            box-sizing: border-box;
            font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.5;
            letter-spacing: 0px;
            tab-size: 4;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            overflow-y: scroll;
            overflow-x: hidden;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            color: var(--text-main);
            z-index: 1;
            scrollbar-width: none;
        }
        .syntax-backdrop::-webkit-scrollbar {
            display: none;
        }

        textarea {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            padding: 10px;
            box-sizing: border-box;
            font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.5;
            letter-spacing: 0px;
            tab-size: 4;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            background: transparent !important;
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
            caret-color: #00f0ff !important;
            border: none;
            resize: none;
            outline: none;
            overflow-y: scroll;
            overflow-x: hidden;
            z-index: 2;
        }

        textarea::selection {
            background: rgba(0, 240, 255, 0.3) !important;
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
        }
        textarea::-moz-selection {
            background: rgba(0, 240, 255, 0.3) !important;
            color: transparent !important;
        }

        /* Pedalboard Rack */
        .pedalboard-rack {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            flex-wrap: wrap;
        }
        .pedal-btn {
            background: #181926;
            border: 1px solid #363a4f;
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 600;
            color: #a5adcb;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pedal-btn.active {
            background: rgba(255, 0, 127, 0.15);
            border-color: var(--accent-magenta);
            color: #ff79c6;
            box-shadow: 0 0 10px rgba(255, 0, 127, 0.3);
        }
        .pedal-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #494d64;
        }
        .pedal-btn.active .pedal-dot {
            background: var(--accent-magenta);
            box-shadow: 0 0 6px var(--accent-magenta);
        }

        /* Status & LoRA Deck */
        .footer-stats {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 14px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 11px;
            color: var(--text-muted);
        }
        .token-counter {
            font-weight: 600;
            color: var(--accent-yellow);
        }
        .lora-deck {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .lora-tag {
            background: rgba(157, 78, 221, 0.2);
            border: 1px solid var(--accent-purple);
            color: #e0aaff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
    </style>
</head>
<body>
    <div class="studio-header">
        <div class="meta-fields">
            <span class="meta-label">File:</span>
            <input type="text" id="filenameInput" value="${this._activeFilename}" style="width: 220px;" />
            <span class="meta-label">Category:</span>
            <input type="text" id="categoryInput" value="${this._activeCategory}" style="width: 140px;" />
            <span class="meta-label">Style:</span>
            <select id="styleSelect">
                <option value="tags" ${this._promptStyle === "tags" ? "selected" : ""}>🏷️ Tags (SDXL / Pony)</option>
                <option value="expressions" ${this._promptStyle === "expressions" ? "selected" : ""}>✍️ Expressions (Flux / SD3)</option>
            </select>
            <span class="meta-label">Theme:</span>
            <select id="themeSelect">
                <option value="Modus Neon (Default)" selected>Modus Neon</option>
                <option value="Cyberpunk 2077">Cyberpunk 2077</option>
                <option value="Monokai Pro">Monokai Pro</option>
                <option value="Dracula Night">Dracula Night</option>
                <option value="Nord Frost">Nord Frost</option>
                <option value="Solarized Dark">Solarized Dark</option>
                <option value="High Contrast">High Contrast</option>
                <option value="Off">Off (Plain Text)</option>
            </select>
        </div>
        <div class="actions-group">
            <button class="btn" id="undoBtn" title="Undo (Ctrl+Z)" disabled>↩ Undo</button>
            <button class="btn" id="redoBtn" title="Redo (Ctrl+Y / Ctrl+Shift+Z)" disabled>↪ Redo</button>
            <button class="btn btn-primary" id="saveBtn">💾 Save Prompt</button>
            <button class="btn" id="pushCanvasBtn" title="Push this prompt directly to the connected ComfyUI canvas node">📤 Push to Canvas</button>
            <button class="btn" id="enhanceBtn">✨ Enhance with Ollama</button>
            <button class="btn" id="prettifyBtn">🧹 Prettify / Dedupe</button>
            <button class="btn btn-queue" id="queueBtn">🚀 Queue ComfyUI</button>
        </div>
    </div>

    <!-- Aesthetic Ribbon -->
    <div class="aesthetic-ribbon">
        <span class="ribbon-title">⚡ Aesthetic Ribbon:</span>
        <select id="filmStockSelect">
            <option value="">🎞️ Film Stocks...</option>
        </select>
        <select id="opticsSelect">
            <option value="">🔍 Optics & Lenses...</option>
        </select>
        <select id="lightingSelect">
            <option value="">💡 Lighting Rigs...</option>
        </select>
        <select id="cameraSelect">
            <option value="">📷 Camera Systems...</option>
        </select>
        <button class="btn" id="swapPromptsBtn" style="margin-left: auto;">⇄ Swap Prompts</button>
    </div>

    <!-- Dual Editors -->
    <div class="editors-container">
        <!-- Positive -->
        <div class="editor-pane">
            <div class="pane-header">
                <span class="pane-title positive">✦ POSITIVE PROMPT</span>
                <span id="posStats" style="font-size: 11px; color: var(--text-muted);">0w · 0 tok</span>
            </div>
            <div class="syntax-wrapper">
                <div class="syntax-backdrop" id="posBackdrop"></div>
                <textarea id="positiveArea" spellcheck="false" placeholder="Enter positive prompt tags or expressions...">${this._positiveText}</textarea>
            </div>
            <div class="lora-deck" id="loraDeck" style="margin-top: 8px;"></div>
        </div>

        <!-- Negative -->
        <div class="editor-pane">
            <div class="pane-header">
                <span class="pane-title negative">🚫 NEGATIVE PROMPT</span>
                <span id="negStats" style="font-size: 11px; color: var(--text-muted);">0w · 0 tok</span>
            </div>
            <!-- Negative Pedalboard Guard Rack -->
            <div class="pedalboard-rack" id="pedalboardRack">
                <button class="pedal-btn" data-pedal="quality"><span class="pedal-dot"></span>✦ Quality</button>
                <button class="pedal-btn" data-pedal="anatomy"><span class="pedal-dot"></span>🚫 Anatomy</button>
                <button class="pedal-btn" data-pedal="cgi"><span class="pedal-dot"></span>🎨 3D Guard</button>
                <button class="pedal-btn" data-pedal="watermark"><span class="pedal-dot"></span>💧 Watermark</button>
            </div>
            <div class="syntax-wrapper">
                <div class="syntax-backdrop" id="negBackdrop"></div>
                <textarea id="negativeArea" spellcheck="false" placeholder="Enter negative prompts or click pedal guards above...">${this._negativeText}</textarea>
            </div>
        </div>
    </div>

    <!-- Footer Stats -->
    <div class="footer-stats">
        <div>ModusFlow Studio Cockpit | ComfyUI Active Pipeline Sync</div>
        <div class="token-counter" id="totalTokenBadge">Ready</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const pedalsData = ${pedalsJson};
        const ribbonData = ${ribbonJson};

        const posArea = document.getElementById("positiveArea");
        const negArea = document.getElementById("negativeArea");
        const posBackdrop = document.getElementById("posBackdrop");
        const negBackdrop = document.getElementById("negBackdrop");
        const filenameInput = document.getElementById("filenameInput");
        const categoryInput = document.getElementById("categoryInput");
        const styleSelect = document.getElementById("styleSelect");
        const themeSelect = document.getElementById("themeSelect");
        const loraDeck = document.getElementById("loraDeck");

        // ── Syntax Highlighting Engine ──────────────────────────────────────
        const SYNTAX_THEMES = {
            "Modus Neon (Default)": {
                comment: "#6b7280",
                choice: "#c084fc",
                shuffle: "#f472b6",
                wildcard: "#fbbf24",
                variable: "#38bdf8",
                weight: "#34d399",
                curator: "#4ade80",
                lora: "#f87171",
                plain_text: "#e2e8f0"
            },
            "Cyberpunk 2077": {
                comment: "#71717a",
                choice: "#e879f9",
                shuffle: "#ff007f",
                wildcard: "#facc15",
                variable: "#00f0ff",
                weight: "#22c55e",
                curator: "#39ff14",
                lora: "#ff0055",
                plain_text: "#f3f4f6"
            },
            "Monokai Pro": {
                comment: "#727072",
                choice: "#ffd866",
                shuffle: "#ff6188",
                wildcard: "#fc9867",
                variable: "#78dce8",
                weight: "#a9dc76",
                curator: "#ab9df2",
                lora: "#ff6188",
                plain_text: "#fcfcfa"
            },
            "Dracula Night": {
                comment: "#6272a4",
                choice: "#bd93f9",
                shuffle: "#ff79c6",
                wildcard: "#f1fa8c",
                variable: "#8be9fd",
                weight: "#50fa7b",
                curator: "#50fa7b",
                lora: "#ff5555",
                plain_text: "#f8f8f2"
            },
            "Nord Frost": {
                comment: "#616e88",
                choice: "#b48ead",
                shuffle: "#d08770",
                wildcard: "#ebcb8b",
                variable: "#88c0d0",
                weight: "#a3be8c",
                curator: "#8fbcbb",
                lora: "#bf616a",
                plain_text: "#eceff4"
            },
            "Solarized Dark": {
                comment: "#586e75",
                choice: "#6c71c4",
                shuffle: "#d33682",
                wildcard: "#b58900",
                variable: "#268bd2",
                weight: "#859900",
                curator: "#2aa198",
                lora: "#dc322f",
                plain_text: "#93a1a1"
            },
            "High Contrast": {
                comment: "#888888",
                choice: "#df80ff",
                shuffle: "#ff3399",
                wildcard: "#ffcc00",
                variable: "#00eeff",
                weight: "#00ff66",
                curator: "#66ff33",
                lora: "#ff3333",
                plain_text: "#ffffff"
            },
            "Off": {
                comment: "#e2e8f0",
                choice: "#e2e8f0",
                shuffle: "#e2e8f0",
                wildcard: "#e2e8f0",
                variable: "#e2e8f0",
                weight: "#e2e8f0",
                curator: "#e2e8f0",
                lora: "#e2e8f0",
                plain_text: "#e2e8f0"
            }
        };

        function escapeHtml(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function tokenizeToHtml(text, themeName) {
            if (!text) return "";
            const theme = SYNTAX_THEMES[themeName] || SYNTAX_THEMES["Modus Neon (Default)"];
            if (themeName === "Off") {
                let esc = escapeHtml(text);
                if (text.endsWith("\n")) esc += "<br>&nbsp;";
                return esc;
            }

            const intervals = [];
            const addMatches = (regex, type) => {
                let m;
                while ((m = regex.exec(text)) !== null) {
                    const start = m.index;
                    const end = start + m[0].length;
                    if (!intervals.some(iv => (start < iv.end && end > iv.start))) {
                        intervals.push({ start, end, type });
                    }
                }
            };

            // 0. Section banners: // [Name] or # [Name] or /* [Name] */
            addMatches(/(?:\/\/|#|\/\*)\s*\[[^\]\r\n]+\](?:\s*\*\/)?/g, "section_header");
            // 1. Block comments: /* ... */
            addMatches(/\/\*[\s\S]*?\*\//g, "comment");
            // 2. Hex colors: #RRGGBB or #RGB
            addMatches(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "hex_color");
            // 3. Line comments: // ... or # ...
            addMatches(/(?:\/\/|#)[^\r\n]*/g, "comment");
            // 4. LoRA tags: <lora:...>
            addMatches(/<lora:[^>\r\n]+>/gi, "lora");
            // 5. Prompt variables: $name
            addMatches(/\$[a-zA-Z0-9_-]+(?:\s*=\s*[^;\r\n]+;?)?/g, "variable");
            // 6. Curator placeholders: {curator}, {curator2}
            addMatches(/\{curator\d*\}/gi, "curator");
            // 7. Shuffles: {shuffle:...}
            addMatches(/\{shuffle:[^}]+\}/gi, "shuffle");
            // 8. Pick-N & Ranges: {2$$...}, {1-3$$...}
            addMatches(/\{\s*\d+(?:-\d+)?\$\$[^}]+\}/g, "choice");
            // 9. Weighted odds: {80::a|20::b}
            addMatches(/\{\s*\d+::[^}]+\}/g, "choice");
            // 10. Dynamic choices: {a|b|c}
            addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");
            // 11. Wildcards: __name__
            addMatches(/__[a-zA-Z0-9_/-]+__/g, "wildcard");
            // 12. Attention weights: (tag:1.3)
            addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

            // 13. Rainbow Parentheses & Unclosed Parens
            const RAINBOW_COLORS = ["#38bdf8", "#c084fc", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];
            const isExcluded = pos => intervals.some(iv => pos >= iv.start && pos < iv.end && iv.type === "comment");
            const pStack = [];

            for (let i = 0; i < text.length; i++) {
                if (isExcluded(i)) continue;
                const ch = text[i];
                if (ch === "(") {
                    pStack.push({ index: i, depth: pStack.length });
                } else if (ch === ")") {
                    if (pStack.length > 0) {
                        const open = pStack.pop();
                        const color = RAINBOW_COLORS[open.depth % RAINBOW_COLORS.length];
                        intervals.push({ start: open.index, end: open.index + 1, type: "rainbow_paren", color });
                        intervals.push({ start: i, end: i + 1, type: "rainbow_paren", color });
                    } else {
                        intervals.push({ start: i, end: i + 1, type: "unmatched_paren" });
                    }
                }
            }

            while (pStack.length > 0) {
                const unclosed = pStack.pop();
                intervals.push({ start: unclosed.index, end: unclosed.index + 1, type: "unclosed_paren" });
            }

            intervals.sort((a, b) => a.start - b.start);

            let html = "";
            let cursor = 0;

            for (const iv of intervals) {
                if (iv.start > cursor) {
                    html += escapeHtml(text.slice(cursor, iv.start));
                }
                const tokenText = escapeHtml(text.slice(iv.start, iv.end));

                if (iv.type === "section_header") {
                    html += '<span style="color: #38bdf8; font-weight: bold; background: rgba(56, 189, 248, 0.15); border-radius: 3px; padding: 1px 4px;">' + tokenText + '</span>';
                } else if (iv.type === "rainbow_paren") {
                    html += '<span style="color: ' + iv.color + '; font-weight: bold;">' + tokenText + '</span>';
                } else if (iv.type === "unclosed_paren" || iv.type === "unmatched_paren") {
                    html += '<span style="background: rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 2px; text-decoration: underline wavy #ef4444; font-weight: bold;">' + tokenText + '</span>';
                } else if (iv.type === "hex_color") {
                    const rawHex = text.slice(iv.start, iv.end);
                    html += '<span style="color: ' + rawHex + '; font-weight: bold; background: ' + rawHex + '26; border-radius: 3px; box-shadow: 0 0 0 1px ' + rawHex + '88; text-decoration: underline dotted ' + rawHex + ';">' + tokenText + '</span>';
                } else if (iv.type === "weight") {
                    const raw = text.slice(iv.start, iv.end);
                    const wMatch = raw.match(/:(-?\\d+(?:\\.\\d+)?)\\)$/);
                    const w = wMatch ? parseFloat(wMatch[1]) : 1.0;
                    const baseColor = theme.weight || "#34d399";
                    let extra = "";
                    if (w > 1.0) {
                        const glowSpread = Math.min(14, Math.round((w - 1.0) * 12));
                        extra = 'font-weight: 600; text-shadow: 0 0 ' + glowSpread + 'px rgba(251, 191, 36, 0.7); background: rgba(245, 158, 11, 0.2); border-radius: 3px; padding: 0 2px;';
                    } else if (w < 1.0 && w >= 0) {
                        extra = 'opacity: 0.6;';
                    }
                    html += '<span style="color: ' + baseColor + '; ' + extra + '">' + tokenText + '</span>';
                } else {
                    const color = theme[iv.type] || theme.plain_text || "#e2e8f0";
                    html += '<span style="color: ' + color + ';">' + tokenText + '</span>';
                }
                cursor = iv.end;
            }

            if (cursor < text.length) {
                html += escapeHtml(text.slice(cursor));
            }

            if (text.endsWith("\n")) {
                html += "<br>&nbsp;";
            }

            return html;
        }

        function renderAllSyntax() {
            const themeName = themeSelect ? themeSelect.value : "Modus Neon (Default)";
            posBackdrop.innerHTML = tokenizeToHtml(posArea.value, themeName);
            negBackdrop.innerHTML = tokenizeToHtml(negArea.value, themeName);
            syncScroll(posArea, posBackdrop);
            syncScroll(negArea, negBackdrop);
        }

        function syncScroll(ta, bd) {
            bd.scrollTop = ta.scrollTop;
            bd.scrollLeft = ta.scrollLeft;
        }

        posArea.addEventListener("scroll", () => syncScroll(posArea, posBackdrop));
        negArea.addEventListener("scroll", () => syncScroll(negArea, negBackdrop));
        themeSelect.addEventListener("change", renderAllSyntax);

        // Populate Aesthetic Ribbon selects
        function populateSelect(elemId, items) {
            const el = document.getElementById(elemId);
            items.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.tag;
                opt.textContent = item.label;
                el.appendChild(opt);
            });
            el.addEventListener("change", () => {
                if (el.value) {
                    insertPositive(el.value);
                    el.selectedIndex = 0;
                }
            });
        }
        populateSelect("filmStockSelect", ribbonData.filmStocks);
        populateSelect("opticsSelect", ribbonData.optics);
        populateSelect("lightingSelect", ribbonData.lighting);
        populateSelect("cameraSelect", ribbonData.cameras);

        function insertPositive(text) {
            const val = posArea.value.trim();
            posArea.value = val ? val + ", " + text : text;
            notifyContent();
            updateUI();
        }

        function updateUI() {
            // Update token counts
            const posWords = (posArea.value.match(/\\b[\\w'-]+\\b/g) || []).length;
            const posTok = Math.ceil(posWords * 1.25);
            document.getElementById("posStats").textContent = posWords + "w · ~" + posTok + " tok";

            const negWords = (negArea.value.match(/\\b[\\w'-]+\\b/g) || []).length;
            const negTok = Math.ceil(negWords * 1.25);
            document.getElementById("negStats").textContent = negWords + "w · ~" + negTok + " tok";

            const totalTokens = posTok + negTok;
            document.getElementById("totalTokenBadge").textContent = "Total: " + totalTokens + " tok (Est. CLIP)";

            // Update Pedalboard state
            const style = styleSelect.value;
            const negText = negArea.value;
            document.querySelectorAll(".pedal-btn").forEach(btn => {
                const pedalKey = btn.getAttribute("data-pedal");
                const pedal = pedalsData[pedalKey];
                if (pedal) {
                    const tagActive = negText.includes(pedal.tags) || negText.includes(pedal.expressions);
                    btn.classList.toggle("active", tagActive);
                }
            });

            // Update LoRA deck
            loraDeck.innerHTML = "";
            const loraMatches = posArea.value.match(/<lora:[^>]+>/g) || [];
            loraMatches.forEach(lora => {
                const badge = document.createElement("span");
                badge.className = "lora-tag";
                badge.textContent = lora;
                loraDeck.appendChild(badge);
            });

            // Update live syntax highlighting
            renderAllSyntax();
        }

        // Toggle pedal
        document.querySelectorAll(".pedal-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const pedalKey = btn.getAttribute("data-pedal");
                const pedal = pedalsData[pedalKey];
                const style = styleSelect.value;
                const snippet = style === "expressions" ? pedal.expressions : pedal.tags;
                const altSnippet = style === "expressions" ? pedal.tags : pedal.expressions;

                let text = negArea.value;
                if (text.includes(snippet) || text.includes(altSnippet)) {
                    text = text.replace(snippet, "").replace(altSnippet, "").replace(/,\\s*,/g, ",").replace(/^\\s*,\\s*/, "").replace(/\\s*,\\s*$/, "").trim();
                } else {
                    const trimmed = text.trim();
                    text = trimmed ? snippet + ", " + trimmed : snippet;
                }
                negArea.value = text;
                notifyContent();
                updateUI();
            });
        });

        // ── Undo / Redo History Stack ──────────────────────────────────────
        const undoBtn = document.getElementById("undoBtn");
        const redoBtn = document.getElementById("redoBtn");
        let historyStack = [];
        let historyIndex = -1;
        const MAX_HISTORY = 60;
        let isApplyingHistory = false;

        function pushHistory() {
            if (isApplyingHistory) return;
            const state = {
                pos: posArea.value,
                neg: negArea.value,
                style: styleSelect.value
            };

            if (historyIndex >= 0) {
                const top = historyStack[historyIndex];
                if (top.pos === state.pos && top.neg === state.neg && top.style === state.style) {
                    return;
                }
            }

            historyStack = historyStack.slice(0, historyIndex + 1);
            historyStack.push(state);
            if (historyStack.length > MAX_HISTORY) {
                historyStack.shift();
            } else {
                historyIndex++;
            }
            updateUndoRedoButtons();
        }

        function updateUndoRedoButtons() {
            undoBtn.disabled = historyIndex <= 0;
            redoBtn.disabled = historyIndex >= historyStack.length - 1;
        }

        function doUndo() {
            if (historyIndex > 0) {
                historyIndex--;
                applyHistoryState(historyStack[historyIndex]);
            }
        }

        function doRedo() {
            if (historyIndex < historyStack.length - 1) {
                historyIndex++;
                applyHistoryState(historyStack[historyIndex]);
            }
        }

        function applyHistoryState(state) {
            if (!state) return;
            isApplyingHistory = true;
            posArea.value = state.pos;
            negArea.value = state.neg;
            if (state.style) styleSelect.value = state.style;
            isApplyingHistory = false;
            updateUndoRedoButtons();
            notifyContent();
            updateUI();
        }

        undoBtn.addEventListener("click", doUndo);
        redoBtn.addEventListener("click", doRedo);

        // Standard Keyboard Shortcuts: Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
        window.addEventListener("keydown", (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            if (ctrlOrCmd && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key === "z" && !e.shiftKey) {
                    e.preventDefault();
                    doUndo();
                } else if (key === "y" || (key === "z" && e.shiftKey)) {
                    e.preventDefault();
                    doRedo();
                }
            }
        });

        // ── Input & Event Listeners ─────────────────────────────────────────
        function notifyContent() {
            vscode.postMessage({
                command: "updateContent",
                filename: filenameInput.value,
                category: categoryInput.value,
                promptStyle: styleSelect.value,
                positive: posArea.value,
                negative: negArea.value
            });
        }

        let inputTimer = null;
        function handleInput() {
            notifyContent();
            updateUI();
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => {
                pushHistory();
            }, 350);
        }

        posArea.addEventListener("input", handleInput);
        negArea.addEventListener("input", handleInput);
        filenameInput.addEventListener("input", notifyContent);
        categoryInput.addEventListener("input", notifyContent);

        styleSelect.addEventListener("change", () => {
            pushHistory();
            vscode.postMessage({
                command: "convertStyle",
                targetStyle: styleSelect.value
            });
        });

        document.getElementById("saveBtn").addEventListener("click", () => {
            vscode.postMessage({
                command: "savePrompt",
                filename: filenameInput.value,
                category: categoryInput.value,
                positive: posArea.value,
                negative: negArea.value
            });
        });

        document.getElementById("pushCanvasBtn").addEventListener("click", () => {
            vscode.postMessage({
                command: "pushToCanvas",
                positive: posArea.value,
                negative: negArea.value,
                promptStyle: styleSelect.value
            });
        });

        document.getElementById("enhanceBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "enhanceOllama" });
        });

        document.getElementById("prettifyBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "prettify" });
        });

        document.getElementById("queueBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "queuePrompt" });
        });

        document.getElementById("swapPromptsBtn").addEventListener("click", () => {
            pushHistory();
            const tmp = posArea.value;
            posArea.value = negArea.value;
            negArea.value = tmp;
            pushHistory();
            notifyContent();
            updateUI();
        });

        window.addEventListener("message", event => {
            const msg = event.data;
            if (msg.type === "syncContent") {
                if (msg.filename) filenameInput.value = msg.filename;
                if (msg.category) categoryInput.value = msg.category;
                if (msg.positive !== undefined) posArea.value = msg.positive;
                if (msg.negative !== undefined) negArea.value = msg.negative;
                if (msg.promptStyle) styleSelect.value = msg.promptStyle;
                pushHistory();
                updateUI();
            }
        });

        updateUI();
        pushHistory();
    </script>
</body>
</html>`;
    }
}
