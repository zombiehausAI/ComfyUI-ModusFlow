import * as vscode from "vscode";
import { ComfyClient, SongFileItem } from "./comfyClient";
import { NEGATIVE_PEDALS, AESTHETIC_RIBBON, prettifyAndDedupe, convertStyle } from "./editorTools";

function escapeHtml(str: string): string {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export const SONG_SECTIONS = [
    "[Intro]",
    "[Verse 1]",
    "[Verse 2]",
    "[Verse 3]",
    "[Pre-Chorus]",
    "[Chorus]",
    "[Hook]",
    "[Bridge]",
    "[Solo]",
    "[Outro]",
    "(Backing Vocals)"
];

export const SONG_STYLE_PEDALS = [
    "Studio Master",
    "Analog Warmth",
    "Clear Vocals",
    "Punchy 808",
    "Driving Bass",
    "Epic Reverb",
    "Acoustic Live",
    "Atmospheric Strings"
];

export class ModusFlowStudioPanel {
    public static currentPanel: ModusFlowStudioPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _client: ComfyClient;
    private _disposables: vscode.Disposable[] = [];

    private _studioMode: "prompt" | "songwriter" = "prompt";

    // Prompt state
    private _activeFilename: string = "New_Prompt.json";
    private _activeCategory: string = "General";
    private _positiveText: string = "";
    private _negativeText: string = "";
    private _promptStyle: "tags" | "expressions" = "tags";

    // Songwriter state
    private _songFilename: string = "New_Song.json";
    private _songCategory: string = "Song";
    private _songTitle: string = "My Song";
    private _songGenre: string = "Synthwave";
    private _songVocal: string = "Female lead, expressive";
    private _songMood: string = "Atmospheric, energetic";
    private _songLyrics: string = "";
    private _songAdditionalStyle: string = "";
    private _songNegativeStyle: string = "";

    public static createOrShow(
        extensionUri: vscode.Uri,
        client: ComfyClient,
        initialData?: { filename?: string; category?: string; positive?: string; negative?: string },
        initialSongData?: SongFileItem
    ): void {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (ModusFlowStudioPanel.currentPanel) {
            ModusFlowStudioPanel.currentPanel._panel.reveal(column);
            if (initialSongData) {
                ModusFlowStudioPanel.currentPanel.loadSongData(initialSongData);
            } else if (initialData) {
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

        ModusFlowStudioPanel.currentPanel = new ModusFlowStudioPanel(panel, extensionUri, client, initialData, initialSongData);
    }

    public static createOrShowSong(extensionUri: vscode.Uri, client: ComfyClient, songData: SongFileItem): void {
        ModusFlowStudioPanel.createOrShow(extensionUri, client, undefined, songData);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        client: ComfyClient,
        initialData?: { filename?: string; category?: string; positive?: string; negative?: string },
        initialSongData?: SongFileItem
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._client = client;

        if (initialSongData) {
            this._studioMode = "songwriter";
            this._songFilename = initialSongData.filename || "New_Song.json";
            this._songCategory = initialSongData.category || "Song";
            this._songTitle = initialSongData.title || "My Song";
            this._songGenre = initialSongData.genre || "Synthwave";
            this._songVocal = initialSongData.vocal_style || "Female lead, expressive";
            this._songMood = initialSongData.mood || "Atmospheric, energetic";
            this._songLyrics = initialSongData.lyrics || "";
            this._songAdditionalStyle = initialSongData.additional_style || "";
            this._songNegativeStyle = initialSongData.negative_style || "";
        } else if (initialData) {
            this._studioMode = "prompt";
            this._activeFilename = initialData.filename || "New_Prompt.json";
            this._activeCategory = initialData.category || "General";
            this._positiveText = initialData.positive || "";
            this._negativeText = initialData.negative || "";
        }

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case "switchMode":
                    this._studioMode = msg.mode === "songwriter" ? "songwriter" : "prompt";
                    break;

                case "updateContent":
                    this._positiveText = msg.positive || "";
                    this._negativeText = msg.negative || "";
                    this._activeFilename = msg.filename || this._activeFilename;
                    this._activeCategory = msg.category || this._activeCategory;
                    this._promptStyle = msg.promptStyle || this._promptStyle;
                    break;

                case "updateSongContent":
                    this._songLyrics = msg.lyrics || "";
                    this._songAdditionalStyle = msg.additional_style || "";
                    this._songNegativeStyle = msg.negative_style || "";
                    this._songTitle = msg.title || this._songTitle;
                    this._songGenre = msg.genre || this._songGenre;
                    this._songVocal = msg.vocal_style || this._songVocal;
                    this._songMood = msg.mood || this._songMood;
                    this._songCategory = msg.category || this._songCategory;
                    this._songFilename = msg.filename || this._songFilename;
                    break;

                case "savePrompt":
                    await this._handleSave(msg);
                    break;

                case "saveSong":
                    await this._handleSaveSong(msg);
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
        this._studioMode = "prompt";
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
            promptStyle: this._promptStyle,
            studioMode: this._studioMode
        });
    }

    public loadSongData(song: SongFileItem): void {
        this._studioMode = "songwriter";
        if (song.filename) this._songFilename = song.filename;
        if (song.category) this._songCategory = song.category;
        if (song.title !== undefined) this._songTitle = song.title;
        if (song.genre !== undefined) this._songGenre = song.genre;
        if (song.vocal_style !== undefined) this._songVocal = song.vocal_style;
        if (song.mood !== undefined) this._songMood = song.mood;
        if (song.lyrics !== undefined) this._songLyrics = song.lyrics;
        if (song.additional_style !== undefined) this._songAdditionalStyle = song.additional_style;
        if (song.negative_style !== undefined) this._songNegativeStyle = song.negative_style;

        this._panel.webview.postMessage({
            type: "syncSongContent",
            filename: this._songFilename,
            category: this._songCategory,
            title: this._songTitle,
            genre: this._songGenre,
            vocal_style: this._songVocal,
            mood: this._songMood,
            lyrics: this._songLyrics,
            additional_style: this._songAdditionalStyle,
            negative_style: this._songNegativeStyle,
            studioMode: this._studioMode
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

    private async _handleSaveSong(msg: any): Promise<void> {
        const filename = (msg.filename || this._songFilename).trim();
        const success = await this._client.saveSong({
            filename: filename.replace(/\.json$/i, ""),
            category: (msg.category || this._songCategory).trim() || "Song",
            title: msg.title || this._songTitle,
            genre: msg.genre || this._songGenre,
            vocal_style: msg.vocal_style || this._songVocal,
            mood: msg.mood || this._songMood,
            lyrics: msg.lyrics !== undefined ? msg.lyrics : this._songLyrics,
            additional_style: msg.additional_style !== undefined ? msg.additional_style : this._songAdditionalStyle,
            negative_style: msg.negative_style !== undefined ? msg.negative_style : this._songNegativeStyle
        });

        if (success) {
            vscode.window.showInformationMessage(`🎵 Song saved: ${filename}`);
        } else {
            vscode.window.showErrorMessage(`Failed to save song "${filename}"`);
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
            title: "ModusFlow: Enhancing with Ollama AI...",
            cancellable: false
        }, async () => {
            const isSong = this._studioMode === "songwriter";
            const targetText = isSong ? this._songLyrics : this._positiveText;
            const res = await this._client.refineSelection(
                targetText,
                "expand",
                undefined,
                isSong ? "Song Lyrics" : (this._promptStyle === "tags" ? "Tags (SDXL / Pony)" : "Expressions (Flux / SD3)")
            );
            if (res.success && res.refined_text) {
                if (isSong) {
                    this._songLyrics = res.refined_text;
                    this._panel.webview.postMessage({
                        type: "syncSongContent",
                        lyrics: this._songLyrics
                    });
                    vscode.window.showInformationMessage("✨ Enhanced lyrics with Ollama!");
                } else {
                    this._positiveText = res.refined_text;
                    this._panel.webview.postMessage({
                        type: "syncContent",
                        positive: this._positiveText,
                        negative: this._negativeText
                    });
                    vscode.window.showInformationMessage("✨ Enhanced prompt with Ollama!");
                }
            } else {
                vscode.window.showErrorMessage(`Ollama enhancement failed: ${res.message || "Unknown error"}`);
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
        this._panel.title = "ModusFlow Studio Cockpit";
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        const pedalsJson = JSON.stringify(NEGATIVE_PEDALS);
        const ribbonJson = JSON.stringify(AESTHETIC_RIBBON);
        const songSectionsJson = JSON.stringify(SONG_SECTIONS);
        const songPedalsJson = JSON.stringify(SONG_STYLE_PEDALS);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ModusFlow Studio Cockpit</title>
    <style>
        :root {
            --bg-base: #11111b;
            --bg-surface: #181825;
            --bg-input: #1e1e2e;
            --border-color: #313244;
            --border-highlight: #45475a;
            --text-main: #cdd6f4;
            --text-muted: #a6adc8;
            --accent-cyan: #89b4fa;
            --accent-magenta: #f38ba8;
            --accent-purple: #cba6f7;
            --accent-green: #a6e3a1;
            --accent-gold: #fab387;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }

        .mode-tab-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        .mode-tab-btn {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 8px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }
        .mode-tab-btn:hover {
            border-color: var(--accent-cyan);
            color: var(--text-main);
        }
        .mode-tab-btn.active {
            background: rgba(137, 180, 250, 0.18);
            border-color: var(--accent-cyan);
            color: var(--accent-cyan);
            box-shadow: 0 0 12px rgba(137, 180, 250, 0.25);
        }

        .studio-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-surface);
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 12px;
        }

        .meta-fields {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .meta-label {
            font-size: 11px;
            font-weight: bold;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        input[type="text"], select {
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
        }
        input[type="text"]:focus, select:focus {
            border-color: var(--accent-cyan);
        }

        .actions-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .btn {
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn:hover {
            border-color: var(--accent-cyan);
            color: #ffffff;
            background: #313244;
        }
        .btn:disabled {
            opacity: 0.4 !important;
            cursor: not-allowed !important;
            border-color: var(--border-color) !important;
        }
        .btn-primary {
            background: linear-gradient(135deg, #89b4fa, #b4befe);
            color: #11111b;
            border: none;
            font-weight: 700;
        }
        .btn-primary:hover {
            background: linear-gradient(135deg, #b4befe, #cba6f7);
            color: #11111b;
        }
        .btn-queue {
            background: linear-gradient(135deg, #a6e3a1, #94e2d5);
            color: #11111b;
            border: none;
            font-weight: 700;
        }

        .ribbon-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--bg-surface);
            padding: 8px 14px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        .ribbon-chip {
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 5px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.12s ease;
        }
        .ribbon-chip:hover {
            border-color: var(--accent-cyan);
            color: var(--accent-cyan);
            transform: translateY(-1px);
        }

        .editors-container {
            display: flex;
            gap: 16px;
            margin-bottom: 12px;
        }
        .editor-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-surface);
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            min-height: 460px;
        }
        .pane-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .pane-title {
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 0.5px;
        }
        .pane-title.positive { color: var(--accent-cyan); }
        .pane-title.negative { color: var(--accent-magenta); }
        .pane-title.lyrics { color: var(--accent-purple); }
        .pane-title.style { color: var(--accent-gold); }

        .syntax-wrapper {
            position: relative;
            flex: 1;
            min-height: 380px;
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }
        .syntax-wrapper:focus-within {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 10px rgba(137, 180, 250, 0.2);
        }

        .syntax-backdrop {
            position: absolute;
            inset: 0;
            padding: 10px;
            font-family: "JetBrains Mono", Consolas, monospace;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-y: scroll;
            overflow-x: hidden;
            pointer-events: none;
            user-select: none;
            color: var(--text-main);
            z-index: 1;
            scrollbar-width: none;
            box-sizing: border-box;
        }
        .syntax-backdrop::-webkit-scrollbar { display: none; }

        textarea {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            padding: 10px;
            font-family: "JetBrains Mono", Consolas, monospace;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            background: transparent !important;
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
            caret-color: var(--accent-cyan) !important;
            border: none;
            resize: none;
            outline: none;
            overflow-y: scroll;
            overflow-x: hidden;
            z-index: 2;
            box-sizing: border-box;
        }
        textarea.plain-mode {
            color: var(--text-main) !important;
            -webkit-text-fill-color: var(--text-main) !important;
        }
        textarea::selection {
            background: rgba(137, 180, 250, 0.3) !important;
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
        }

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
            background: rgba(243, 139, 168, 0.15);
            border-color: var(--accent-magenta);
            color: var(--accent-magenta);
            box-shadow: 0 0 10px rgba(243, 139, 168, 0.3);
        }
        .pedal-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #5b6078;
        }
        .pedal-btn.active .pedal-dot {
            background: var(--accent-magenta);
            box-shadow: 0 0 6px var(--accent-magenta);
        }

        .footer-stats {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: var(--text-muted);
            padding: 8px 12px;
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 6px;
        }
        .token-counter {
            font-family: ui-monospace, monospace;
            background: var(--bg-input);
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            color: var(--accent-cyan);
            font-weight: 600;
        }

        .lora-deck {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .lora-tag {
            background: rgba(203, 166, 247, 0.18);
            border: 1px solid var(--accent-purple);
            color: #cba6f7;
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
    <!-- Mode Tab Bar -->
    <div class="mode-tab-bar">
        <button class="mode-tab-btn ${this._studioMode === 'prompt' ? 'active' : ''}" id="modePromptBtn">🎨 Image Prompt Studio</button>
        <button class="mode-tab-btn ${this._studioMode === 'songwriter' ? 'active' : ''}" id="modeSongBtn">🎵 Songwriter &amp; Lyric Studio</button>
        <span style="margin-left: auto; font-size: 11px; color: var(--text-muted);">ComfyUI ModusFlow Extension</span>
    </div>

    <!-- Header Controls -->
    <div class="studio-header">
        <!-- Prompt Meta Fields -->
        <div class="meta-fields" id="promptMetaFields" style="${this._studioMode === 'prompt' ? '' : 'display: none;'}">
            <span class="meta-label">File:</span>
            <input type="text" id="filenameInput" value="${escapeHtml(this._activeFilename)}" style="width: 200px;" />
            <span class="meta-label">Category:</span>
            <input type="text" id="categoryInput" value="${escapeHtml(this._activeCategory)}" style="width: 130px;" />
            <span class="meta-label">Style:</span>
            <select id="styleSelect">
                <option value="tags" ${this._promptStyle === "tags" ? "selected" : ""}>🏷️ Tags (SDXL / Pony)</option>
                <option value="expressions" ${this._promptStyle === "expressions" ? "selected" : ""}>✍️ Expressions (Flux / SD3)</option>
            </select>
        </div>

        <!-- Songwriter Meta Fields -->
        <div class="meta-fields" id="songMetaFields" style="${this._studioMode === 'songwriter' ? '' : 'display: none;'}">
            <span class="meta-label">Title:</span>
            <input type="text" id="songTitleInput" value="${escapeHtml(this._songTitle)}" style="width: 140px;" placeholder="Song Title" />
            <span class="meta-label">Genre:</span>
            <input type="text" id="songGenreInput" value="${escapeHtml(this._songGenre)}" style="width: 120px;" placeholder="Genre" />
            <span class="meta-label">Vocal:</span>
            <input type="text" id="songVocalInput" value="${escapeHtml(this._songVocal)}" style="width: 130px;" placeholder="Vocal Style" />
            <span class="meta-label">Mood:</span>
            <input type="text" id="songMoodInput" value="${escapeHtml(this._songMood)}" style="width: 110px;" placeholder="Mood" />
            <span class="meta-label">File:</span>
            <input type="text" id="songFilenameInput" value="${escapeHtml(this._songFilename)}" style="width: 150px;" placeholder="song.json" />
        </div>

        <!-- Theme Selector -->
        <div style="display: flex; align-items: center; gap: 6px;">
            <span class="meta-label">Theme:</span>
            <select id="themeSelect">
                <option value="Modus Neon (Default)" selected>Modus Neon</option>
                <option value="Cyberpunk 2077">Cyberpunk 2077</option>
                <option value="Monokai Pro">Monokai Pro</option>
                <option value="Dracula Night">Dracula Night</option>
                <option value="Nord Frost">Nord Frost</option>
                <option value="Off">Off (Plain Text)</option>
            </select>
        </div>

        <!-- Action Buttons -->
        <div class="actions-group">
            <button class="btn" id="undoBtn" title="Undo (Ctrl+Z)" disabled>↩ Undo</button>
            <button class="btn" id="redoBtn" title="Redo (Ctrl+Y / Ctrl+Shift+Z)" disabled>↪ Redo</button>
            <button class="btn btn-primary" id="saveBtn">${this._studioMode === 'songwriter' ? '💾 Save Song' : '💾 Save Prompt'}</button>
            <button class="btn" id="pushCanvasBtn" title="Push directly to connected ComfyUI canvas node">📤 Push to Canvas</button>
            <button class="btn" id="enhanceBtn">✨ Ollama AI</button>
            <button class="btn" id="prettifyBtn">🧹 Prettify</button>
            <button class="btn btn-queue" id="queueBtn">🚀 Queue ComfyUI</button>
        </div>
    </div>

    <!-- Aesthetic Ribbon (Image Prompt Mode) -->
    <div class="ribbon-bar" id="aestheticRibbon" style="${this._studioMode === 'prompt' ? '' : 'display: none;'}">
        <span class="meta-label" style="color: var(--accent-cyan);">⚡ Aesthetic Ribbon:</span>
        <select id="filmStockSelect"><option value="">🎞️ Film Stocks...</option></select>
        <select id="opticsSelect"><option value="">🔍 Optics &amp; Lenses...</option></select>
        <select id="lightingSelect"><option value="">💡 Lighting Rigs...</option></select>
        <select id="cameraSelect"><option value="">📷 Camera Systems...</option></select>
        <button class="btn" id="swapPromptsBtn" style="margin-left: auto;">⇄ Swap Prompts</button>
    </div>

    <!-- Song Section Ribbon (Songwriter Mode) -->
    <div class="ribbon-bar" id="songSectionRibbon" style="${this._studioMode === 'songwriter' ? '' : 'display: none;'}">
        <span class="meta-label" style="color: var(--accent-purple);">🎵 Section Insert:</span>
        <div id="songSectionsWrap" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
    </div>

    <!-- Dual Editors: Image Prompt Mode -->
    <div class="editors-container" id="promptEditors" style="${this._studioMode === 'prompt' ? '' : 'display: none;'}">
        <!-- Positive -->
        <div class="editor-pane">
            <div class="pane-header">
                <span class="pane-title positive">✦ POSITIVE PROMPT</span>
                <span id="posStats" style="font-size: 11px; color: var(--text-muted);">0w · 0 tok</span>
            </div>
            <div class="syntax-wrapper">
                <div class="syntax-backdrop" id="posBackdrop"></div>
                <textarea id="positiveArea" spellcheck="false" placeholder="Enter positive prompt tags or expressions...">${escapeHtml(this._positiveText)}</textarea>
            </div>
            <div class="lora-deck" id="loraDeck" style="margin-top: 8px;"></div>
        </div>

        <!-- Negative -->
        <div class="editor-pane">
            <div class="pane-header">
                <span class="pane-title negative">🚫 NEGATIVE PROMPT</span>
                <span id="negStats" style="font-size: 11px; color: var(--text-muted);">0w · 0 tok</span>
            </div>
            <div class="pedalboard-rack" id="pedalboardRack">
                <button class="pedal-btn" data-pedal="quality"><span class="pedal-dot"></span>✦ Quality</button>
                <button class="pedal-btn" data-pedal="anatomy"><span class="pedal-dot"></span>🚫 Anatomy</button>
                <button class="pedal-btn" data-pedal="cgi"><span class="pedal-dot"></span>🎨 3D Guard</button>
                <button class="pedal-btn" data-pedal="watermark"><span class="pedal-dot"></span>💧 Watermark</button>
            </div>
            <div class="syntax-wrapper">
                <div class="syntax-backdrop" id="negBackdrop"></div>
                <textarea id="negativeArea" spellcheck="false" placeholder="Enter negative prompts or click pedal guards above...">${escapeHtml(this._negativeText)}</textarea>
            </div>
        </div>
    </div>

    <!-- Dual Editors: Songwriter Mode -->
    <div class="editors-container" id="songEditors" style="${this._studioMode === 'songwriter' ? '' : 'display: none;'}">
        <!-- Lyrics -->
        <div class="editor-pane" style="flex: 1.4;">
            <div class="pane-header">
                <span class="pane-title lyrics">🎵 LYRICS &amp; SONG STRUCTURE</span>
                <span id="lyricsStats" style="font-size: 11px; color: var(--text-muted);">0 lines · 0 words · ~0:00</span>
            </div>
            <div class="syntax-wrapper">
                <div class="syntax-backdrop" id="lyricsBackdrop"></div>
                <textarea id="lyricsArea" spellcheck="false" placeholder="Write lyrics here...\n\n[Verse 1]\nFirst line goes here\n\n[Chorus]\nSing it loud\n\n(backing vocals)">${escapeHtml(this._songLyrics)}</textarea>
            </div>
        </div>

        <!-- Musical Style & Pedals -->
        <div class="editor-pane" style="flex: 1.1;">
            <div class="pane-header">
                <span class="pane-title style">🎸 MUSICAL STYLE &amp; ARRANGEMENT</span>
                <span style="font-size: 11px; color: var(--text-muted);">ACE-Step / DiffRhythm</span>
            </div>
            <div class="pedalboard-rack" id="songPedalsRack"></div>
            <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); margin-top: 6px; margin-bottom: 4px;">ADDITIONAL MUSICAL STYLE</div>
            <div class="syntax-wrapper" style="min-height: 140px; height: 140px; margin-bottom: 10px;">
                <div class="syntax-backdrop" id="songAddStyleBackdrop"></div>
                <textarea id="songAddStyleArea" spellcheck="false" placeholder="e.g. 120 bpm, bright electric piano, soaring guitar lead, analog warmth...">${escapeHtml(this._songAdditionalStyle)}</textarea>
            </div>
            <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">NEGATIVE STYLE (EXCLUDE)</div>
            <div class="syntax-wrapper" style="min-height: 120px; height: 120px;">
                <div class="syntax-backdrop" id="songNegStyleBackdrop"></div>
                <textarea id="songNegStyleArea" spellcheck="false" placeholder="e.g. harsh distortion, clipping, muffled vocals, out of tune...">${escapeHtml(this._songNegativeStyle)}</textarea>
            </div>
        </div>
    </div>

    <!-- Footer Stats -->
    <div class="footer-stats">
        <div id="footerStatusText">ModusFlow Studio Cockpit | ComfyUI Active Pipeline Sync</div>
        <div class="token-counter" id="totalTokenBadge">Ready</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const pedalsData = ${pedalsJson};
        const ribbonData = ${ribbonJson};
        const songSectionsData = ${songSectionsJson};
        const songPedalsData = ${songPedalsJson};

        let currentMode = "${this._studioMode}";

        // Elements
        const modePromptBtn = document.getElementById("modePromptBtn");
        const modeSongBtn = document.getElementById("modeSongBtn");
        const promptMetaFields = document.getElementById("promptMetaFields");
        const songMetaFields = document.getElementById("songMetaFields");
        const aestheticRibbon = document.getElementById("aestheticRibbon");
        const songSectionRibbon = document.getElementById("songSectionRibbon");
        const promptEditors = document.getElementById("promptEditors");
        const songEditors = document.getElementById("songEditors");
        const saveBtn = document.getElementById("saveBtn");
        const themeSelect = document.getElementById("themeSelect");

        // Prompt inputs
        const filenameInput = document.getElementById("filenameInput");
        const categoryInput = document.getElementById("categoryInput");
        const styleSelect = document.getElementById("styleSelect");
        const posArea = document.getElementById("positiveArea");
        const negArea = document.getElementById("negativeArea");
        const posBackdrop = document.getElementById("posBackdrop");
        const negBackdrop = document.getElementById("negBackdrop");
        const posStats = document.getElementById("posStats");
        const negStats = document.getElementById("negStats");

        // Songwriter inputs
        const songTitleInput = document.getElementById("songTitleInput");
        const songGenreInput = document.getElementById("songGenreInput");
        const songVocalInput = document.getElementById("songVocalInput");
        const songMoodInput = document.getElementById("songMoodInput");
        const songFilenameInput = document.getElementById("songFilenameInput");
        const lyricsArea = document.getElementById("lyricsArea");
        const lyricsBackdrop = document.getElementById("lyricsBackdrop");
        const lyricsStats = document.getElementById("lyricsStats");
        const songAddStyleArea = document.getElementById("songAddStyleArea");
        const songAddStyleBackdrop = document.getElementById("songAddStyleBackdrop");
        const songNegStyleArea = document.getElementById("songNegStyleArea");
        const songNegStyleBackdrop = document.getElementById("songNegStyleBackdrop");

        // Mode Switching
        function setStudioMode(mode) {
            currentMode = mode;
            if (mode === "songwriter") {
                modeSongBtn.classList.add("active");
                modePromptBtn.classList.remove("active");
                promptMetaFields.style.display = "none";
                songMetaFields.style.display = "flex";
                aestheticRibbon.style.display = "none";
                songSectionRibbon.style.display = "flex";
                promptEditors.style.display = "none";
                songEditors.style.display = "flex";
                saveBtn.textContent = "💾 Save Song";
                document.getElementById("footerStatusText").textContent = "ModusFlow Songwriter Studio | Lyric & Musical Arrangement Mode";
            } else {
                modePromptBtn.classList.add("active");
                modeSongBtn.classList.remove("active");
                promptMetaFields.style.display = "flex";
                songMetaFields.style.display = "none";
                aestheticRibbon.style.display = "flex";
                songSectionRibbon.style.display = "none";
                promptEditors.style.display = "flex";
                songEditors.style.display = "none";
                saveBtn.textContent = "💾 Save Prompt";
                document.getElementById("footerStatusText").textContent = "ModusFlow Prompt Studio Cockpit | ComfyUI Active Pipeline Sync";
            }
            vscode.postMessage({ command: "switchMode", mode });
            renderAllSyntax();
            updateUI();
        }

        modePromptBtn.addEventListener("click", () => setStudioMode("prompt"));
        modeSongBtn.addEventListener("click", () => setStudioMode("songwriter"));

        // Populate Song Section Chips
        const songSectionsWrap = document.getElementById("songSectionsWrap");
        songSectionsData.forEach(sec => {
            const btn = document.createElement("button");
            btn.className = "ribbon-chip";
            btn.textContent = sec;
            btn.onclick = () => {
                const start = lyricsArea.selectionStart;
                const end = lyricsArea.selectionEnd;
                const val = lyricsArea.value;
                const prefix = (start > 0 && val[start - 1] !== "\\n") ? "\\n\\n" : "";
                const insertText = prefix + sec + "\\n";
                lyricsArea.value = val.slice(0, start) + insertText + val.slice(end);
                const newPos = start + insertText.length;
                lyricsArea.setSelectionRange(newPos, newPos);
                lyricsArea.focus();
                notifySongContent();
                pushHistory();
                updateUI();
                renderAllSyntax();
            };
            songSectionsWrap.appendChild(btn);
        });

        // Populate Song Musical Style Pedals
        const songPedalsRack = document.getElementById("songPedalsRack");
        songPedalsData.forEach(p => {
            const btn = document.createElement("button");
            btn.className = "pedal-btn";
            btn.innerHTML = '<span class="pedal-dot"></span>+ ' + escapeHtml(p);
            btn.onclick = () => {
                const cur = songAddStyleArea.value.trim();
                if (!cur.includes(p)) {
                    songAddStyleArea.value = cur ? cur + ", " + p : p;
                    notifySongContent();
                    pushHistory();
                    updateUI();
                    renderAllSyntax();
                }
            };
            songPedalsRack.appendChild(btn);
        });

        // Syntax Themes
        const SYNTAX_THEMES = {
            "Modus Neon (Default)": {
                comment: "#6c7086",
                lora: "#f38ba8",
                variable: "#89b4fa",
                curator: "#a6e3a1",
                shuffle: "#fab387",
                choice: "#cba6f7",
                wildcard: "#f9e2af",
                weight: "#f9e2af",
                plain_text: "#cdd6f4"
            },
            "Cyberpunk 2077": {
                comment: "#005577",
                lora: "#ff007f",
                variable: "#00f0ff",
                curator: "#ffe600",
                shuffle: "#ff7700",
                choice: "#a600ff",
                wildcard: "#00ff66",
                weight: "#ffe600",
                plain_text: "#d0f0ff"
            },
            "Dracula Night": {
                comment: "#6272a4",
                lora: "#ff79c6",
                variable: "#8be9fd",
                curator: "#50fa7b",
                shuffle: "#ffb86c",
                choice: "#bd93f9",
                wildcard: "#f1fa8c",
                weight: "#f1fa8c",
                plain_text: "#f8f8f2"
            },
            "Monokai Pro": {
                comment: "#727072",
                lora: "#ff6188",
                variable: "#78dce8",
                curator: "#a9dc76",
                shuffle: "#fc9867",
                choice: "#ab9df2",
                wildcard: "#ffd866",
                weight: "#ffd866",
                plain_text: "#fcfcfa"
            },
            "Nord Frost": {
                comment: "#4c566a",
                lora: "#bf616a",
                variable: "#88c0d0",
                curator: "#a3be8c",
                shuffle: "#d08770",
                choice: "#b48ead",
                wildcard: "#ebcb8b",
                weight: "#ebcb8b",
                plain_text: "#eceff4"
            }
        };

        function tokenizeToHtml(text, themeName) {
            if (!text) return "";
            const theme = SYNTAX_THEMES[themeName] || SYNTAX_THEMES["Modus Neon (Default)"];
            if (themeName === "Off") {
                let esc = escapeHtml(text);
                if (text.endsWith("\\n")) esc += "<br>&nbsp;";
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

            // Section headers: // [Name] or [Name]
            addMatches(/(?:\\/\\/|#|\\/\\*)\\s*\\[[^\\]\\r\\n]+\\](?:\\s*\\*\\/)?/g, "section_header");
            addMatches(/(?:^|(?<=[\\r\\n]))\\s*\\[[^\\]\\r\\n]+\\](?=\\s*(?:[\\r\\n]|$))/g, "section_header");
            // Backing vocals
            addMatches(/\\([^\\)\\r\\n]+\\)/g, "lyric_cue");
            // Block comments
            addMatches(/\\/\\*[\\s\\S]*?\\*\\//g, "comment");
            // Hex colors
            addMatches(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b/g, "hex_color");
            // Line comments
            addMatches(/(?:\\/\\/|#)[^\\r\\n]*/g, "comment");
            // LoRAs
            addMatches(/<lora:[^>\\r\\n]+>/gi, "lora");
            // Variables
            addMatches(/\\$[a-zA-Z0-9_-]+(?:\\s*=\\s*[^;\\r\\n]+;?)?/g, "variable");
            // Curator & dynamic choices
            addMatches(/\\{curator\\d*\\}/gi, "curator");
            addMatches(/\\{shuffle:[^}]+\\}/gi, "shuffle");
            addMatches(/\\{\\s*\\d+(?:-\\d+)?\\$\\$[^}]+\\}/g, "choice");
            addMatches(/\\{\\s*\\d+::[^}]+\\}/g, "choice");
            addMatches(/\\{[^{}]*\\|[^{}]*\\}/g, "choice");
            addMatches(/__[a-zA-Z0-9_/-]+__/g, "wildcard");
            addMatches(/\\([^():\\r\\n]+:\\s*-?\\d+(?:\\.\\d+)?\\)/g, "weight");

            intervals.sort((a, b) => a.start - b.start);

            let html = "";
            let cursor = 0;

            for (const iv of intervals) {
                if (iv.start < cursor) continue;
                if (iv.start > cursor) {
                    html += escapeHtml(text.slice(cursor, iv.start));
                }
                const tokenText = escapeHtml(text.slice(iv.start, iv.end));

                if (iv.type === "section_header") {
                    html += '<span style="color: #cba6f7; font-weight: bold; background: rgba(203, 166, 247, 0.16); border-radius: 3px; padding: 1px 4px;">' + tokenText + '</span>';
                } else if (iv.type === "lyric_cue") {
                    html += '<span style="color: #a6e3a1; font-style: italic;">' + tokenText + '</span>';
                } else if (iv.type === "hex_color") {
                    const rawHex = text.slice(iv.start, iv.end);
                    html += '<span style="color: ' + rawHex + '; font-weight: bold; background: ' + rawHex + '26; border-radius: 3px;">' + tokenText + '</span>';
                } else {
                    const color = theme[iv.type] || theme.plain_text || "#cdd6f4";
                    html += '<span style="color: ' + color + ';">' + tokenText + '</span>';
                }
                cursor = iv.end;
            }

            if (cursor < text.length) {
                html += escapeHtml(text.slice(cursor));
            }
            if (text.endsWith("\\n")) {
                html += "<br>&nbsp;";
            }
            return html;
        }

        function renderAllSyntax() {
            const themeName = themeSelect ? themeSelect.value : "Modus Neon (Default)";
            if (currentMode === "songwriter") {
                lyricsBackdrop.innerHTML = tokenizeToHtml(lyricsArea.value, themeName);
                songAddStyleBackdrop.innerHTML = tokenizeToHtml(songAddStyleArea.value, themeName);
                songNegStyleBackdrop.innerHTML = tokenizeToHtml(songNegStyleArea.value, themeName);
                syncScroll(lyricsArea, lyricsBackdrop);
                syncScroll(songAddStyleArea, songAddStyleBackdrop);
                syncScroll(songNegStyleArea, songNegStyleBackdrop);
            } else {
                posBackdrop.innerHTML = tokenizeToHtml(posArea.value, themeName);
                negBackdrop.innerHTML = tokenizeToHtml(negArea.value, themeName);
                syncScroll(posArea, posBackdrop);
                syncScroll(negArea, negBackdrop);
            }
        }

        function syncScroll(ta, bd) {
            bd.scrollTop = ta.scrollTop;
            bd.scrollLeft = ta.scrollLeft;
        }

        posArea.addEventListener("scroll", () => syncScroll(posArea, posBackdrop));
        negArea.addEventListener("scroll", () => syncScroll(negArea, negBackdrop));
        lyricsArea.addEventListener("scroll", () => syncScroll(lyricsArea, lyricsBackdrop));
        songAddStyleArea.addEventListener("scroll", () => syncScroll(songAddStyleArea, songAddStyleBackdrop));
        songNegStyleArea.addEventListener("scroll", () => syncScroll(songNegStyleArea, songNegStyleBackdrop));
        themeSelect.addEventListener("change", renderAllSyntax);

        // Populate Aesthetic Ribbon
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
                    const val = posArea.value.trim();
                    posArea.value = val ? val + ", " + el.value : el.value;
                    el.selectedIndex = 0;
                    notifyContent();
                    updateUI();
                    pushHistory();
                }
            });
        }
        populateSelect("filmStockSelect", ribbonData.filmStocks);
        populateSelect("opticsSelect", ribbonData.optics);
        populateSelect("lightingSelect", ribbonData.lighting);
        populateSelect("cameraSelect", ribbonData.cameras);

        // Negative Pedals
        document.querySelectorAll(".pedal-btn[data-pedal]").forEach(btn => {
            btn.addEventListener("click", () => {
                const pType = btn.getAttribute("data-pedal");
                const pTags = pedalsData[pType]?.tags || [];
                let neg = negArea.value;
                const hasAll = pTags.length && pTags.every(t => neg.includes(t));
                if (hasAll) {
                    pTags.forEach(t => { neg = neg.replace(t, ""); });
                    neg = neg.replace(/,\\s*,/g, ",").replace(/^\\s*,|\\s*,$/g, "").trim();
                } else {
                    const cleanTags = pTags.filter(t => !neg.includes(t)).join(", ");
                    neg = neg.trim() ? neg.trim() + ", " + cleanTags : cleanTags;
                }
                negArea.value = neg;
                notifyContent();
                updateUI();
                pushHistory();
            });
        });

        function updateUI() {
            if (currentMode === "songwriter") {
                const lText = lyricsArea.value;
                const words = (lText.trim().match(/\\S+/g) || []).length;
                const lines = lText.split("\\n").filter(l => l.trim().length > 0).length;
                const totalSec = Math.round((words / 130) * 60);
                const mins = Math.floor(totalSec / 60);
                const secs = totalSec % 60;
                lyricsStats.textContent = lines + " lines · " + words + " words · ~" + mins + ":" + (secs < 10 ? "0" : "") + secs;
                document.getElementById("totalTokenBadge").textContent = words + " lyrics words";
            } else {
                const pText = posArea.value;
                const nText = negArea.value;
                const pWords = (pText.trim().match(/\\S+/g) || []).length;
                const nWords = (nText.trim().match(/\\S+/g) || []).length;
                posStats.textContent = pWords + "w";
                negStats.textContent = nWords + "w";
                document.getElementById("totalTokenBadge").textContent = (pWords + nWords) + " total words";

                document.querySelectorAll(".pedal-btn[data-pedal]").forEach(btn => {
                    const pType = btn.getAttribute("data-pedal");
                    const pTags = pedalsData[pType]?.tags || [];
                    const active = pTags.length && pTags.every(t => nText.includes(t));
                    btn.classList.toggle("active", !!active);
                });
            }
            renderAllSyntax();
        }

        // Undo / Redo History
        const MAX_HISTORY = 40;
        let historyStack = [];
        let historyIndex = -1;
        let isUndoRedoAction = false;

        const undoBtn = document.getElementById("undoBtn");
        const redoBtn = document.getElementById("redoBtn");

        function getSnapshot() {
            return {
                mode: currentMode,
                pos: posArea.value,
                neg: negArea.value,
                lyrics: lyricsArea.value,
                addStyle: songAddStyleArea.value,
                negStyle: songNegStyleArea.value
            };
        }

        function updateHistoryButtons() {
            undoBtn.disabled = historyIndex <= 0;
            redoBtn.disabled = historyIndex >= historyStack.length - 1;
        }

        function pushHistory() {
            if (isUndoRedoAction) return;
            const current = getSnapshot();
            if (historyIndex >= 0) {
                const top = historyStack[historyIndex];
                if (top.pos === current.pos && top.neg === current.neg && top.lyrics === current.lyrics) return;
            }
            historyStack = historyStack.slice(0, historyIndex + 1);
            historyStack.push(current);
            if (historyStack.length > MAX_HISTORY) historyStack.shift();
            else historyIndex++;
            updateHistoryButtons();
        }

        function doUndo() {
            if (historyIndex <= 0) return;
            historyIndex--;
            applySnapshot(historyStack[historyIndex]);
            updateHistoryButtons();
        }

        function doRedo() {
            if (historyIndex >= historyStack.length - 1) return;
            historyIndex++;
            applySnapshot(historyStack[historyIndex]);
            updateHistoryButtons();
        }

        function applySnapshot(snap) {
            isUndoRedoAction = true;
            if (snap.mode && snap.mode !== currentMode) setStudioMode(snap.mode);
            posArea.value = snap.pos;
            negArea.value = snap.neg;
            lyricsArea.value = snap.lyrics;
            songAddStyleArea.value = snap.addStyle;
            songNegStyleArea.value = snap.negStyle;
            if (currentMode === "songwriter") notifySongContent();
            else notifyContent();
            updateUI();
            isUndoRedoAction = false;
        }

        undoBtn.addEventListener("click", doUndo);
        redoBtn.addEventListener("click", doRedo);

        function notifyContent() {
            vscode.postMessage({
                command: "updateContent",
                filename: filenameInput.value,
                category: categoryInput.value,
                positive: posArea.value,
                negative: negArea.value,
                promptStyle: styleSelect.value
            });
        }

        function notifySongContent() {
            vscode.postMessage({
                command: "updateSongContent",
                filename: songFilenameInput.value,
                category: "Song",
                title: songTitleInput.value,
                genre: songGenreInput.value,
                vocal_style: songVocalInput.value,
                mood: songMoodInput.value,
                lyrics: lyricsArea.value,
                additional_style: songAddStyleArea.value,
                negative_style: songNegStyleArea.value
            });
        }

        posArea.addEventListener("input", () => { notifyContent(); updateUI(); pushHistory(); });
        negArea.addEventListener("input", () => { notifyContent(); updateUI(); pushHistory(); });
        lyricsArea.addEventListener("input", () => { notifySongContent(); updateUI(); pushHistory(); });
        songAddStyleArea.addEventListener("input", () => { notifySongContent(); updateUI(); pushHistory(); });
        songNegStyleArea.addEventListener("input", () => { notifySongContent(); updateUI(); pushHistory(); });

        filenameInput.addEventListener("input", notifyContent);
        categoryInput.addEventListener("input", notifyContent);
        songTitleInput.addEventListener("input", notifySongContent);
        songGenreInput.addEventListener("input", notifySongContent);
        songVocalInput.addEventListener("input", notifySongContent);
        songMoodInput.addEventListener("input", notifySongContent);
        songFilenameInput.addEventListener("input", notifySongContent);

        styleSelect.addEventListener("change", () => {
            vscode.postMessage({ command: "convertStyle", targetStyle: styleSelect.value });
        });

        saveBtn.addEventListener("click", () => {
            if (currentMode === "songwriter") {
                vscode.postMessage({
                    command: "saveSong",
                    filename: songFilenameInput.value,
                    category: "Song",
                    title: songTitleInput.value,
                    genre: songGenreInput.value,
                    vocal_style: songVocalInput.value,
                    mood: songMoodInput.value,
                    lyrics: lyricsArea.value,
                    additional_style: songAddStyleArea.value,
                    negative_style: songNegStyleArea.value
                });
            } else {
                vscode.postMessage({
                    command: "savePrompt",
                    filename: filenameInput.value,
                    category: categoryInput.value,
                    positive: posArea.value,
                    negative: negArea.value
                });
            }
        });

        document.getElementById("pushCanvasBtn").addEventListener("click", () => {
            vscode.postMessage({
                command: "pushToCanvas",
                positive: currentMode === "songwriter" ? lyricsArea.value : posArea.value,
                negative: currentMode === "songwriter" ? songNegStyleArea.value : negArea.value,
                promptStyle: currentMode === "songwriter" ? "Song Lyrics" : styleSelect.value
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
                if (msg.studioMode) setStudioMode(msg.studioMode);
                if (msg.filename) filenameInput.value = msg.filename;
                if (msg.category) categoryInput.value = msg.category;
                if (msg.positive !== undefined) posArea.value = msg.positive;
                if (msg.negative !== undefined) negArea.value = msg.negative;
                if (msg.promptStyle) styleSelect.value = msg.promptStyle;
                pushHistory();
                updateUI();
                renderAllSyntax();
            } else if (msg.type === "syncSongContent") {
                setStudioMode("songwriter");
                if (msg.filename) songFilenameInput.value = msg.filename;
                if (msg.title !== undefined) songTitleInput.value = msg.title;
                if (msg.genre !== undefined) songGenreInput.value = msg.genre;
                if (msg.vocal_style !== undefined) songVocalInput.value = msg.vocal_style;
                if (msg.mood !== undefined) songMoodInput.value = msg.mood;
                if (msg.lyrics !== undefined) lyricsArea.value = msg.lyrics;
                if (msg.additional_style !== undefined) songAddStyleArea.value = msg.additional_style;
                if (msg.negative_style !== undefined) songNegStyleArea.value = msg.negative_style;
                pushHistory();
                updateUI();
                renderAllSyntax();
            }
        });

        updateUI();
        pushHistory();
    </script>
</body>
</html>`;
    }
}
