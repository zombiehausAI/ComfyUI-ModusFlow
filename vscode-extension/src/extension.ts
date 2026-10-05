import * as vscode from "vscode";
import { ComfyClient } from "./comfyClient";
import { ModusFlowColorProvider } from "./colorProvider";
import { ModusFlowHoverProvider } from "./hoverProvider";
import { ModusFlowCompletionProvider } from "./completionProvider";
import { PromptsTreeProvider, WildcardsTreeProvider, ConnectedCanvasNodeProvider, SongsTreeProvider, LorasTreeProvider, PromptTreeItem } from "./treeViews";
import { runOllamaRefinerAction } from "./ollamaRefiner";
import { ModusFlowStudioPanel } from "./studioWebview";
import { TokenCounterStatusBar } from "./tokenCounter";
import { stepTagWeight, prettifyAndDedupe, toggleExplodeCollapse, convertStyle, toggleNegativePedal, AESTHETIC_RIBBON } from "./editorTools";

function extractPromptFromText(text: string): { positive: string; negative: string } {
    let positive = text;
    let negative = "";

    const posMarker = text.search(/# ── Positive Prompt[^\n]*\n?/i);
    const negMarker = text.search(/# ── Negative Prompt[^\n]*\n?/i);

    if (posMarker !== -1 && negMarker !== -1) {
        if (posMarker < negMarker) {
            const afterPos = text.indexOf("\n", posMarker) + 1;
            positive = text.substring(afterPos, negMarker).trim();
            const afterNeg = text.indexOf("\n", negMarker) + 1;
            negative = text.substring(afterNeg).trim();
        } else {
            const afterNeg = text.indexOf("\n", negMarker) + 1;
            negative = text.substring(afterNeg, posMarker).trim();
            const afterPos = text.indexOf("\n", posMarker) + 1;
            positive = text.substring(afterPos).trim();
        }
    } else if (posMarker !== -1) {
        const afterPos = text.indexOf("\n", posMarker) + 1;
        positive = text.substring(afterPos).trim();
    }
    return { positive, negative };
}

class ModusFlowFileSystemProvider implements vscode.FileSystemProvider {
    private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;
    private fileCache = new Map<string, Uint8Array>();

    constructor(private client: ComfyClient) {}

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        let content = this.fileCache.get(uri.toString());
        if (!content) {
            content = await this.fetchContent(uri);
        }
        return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: content.length
        };
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let content = this.fileCache.get(uri.toString());
        if (!content) {
            content = await this.fetchContent(uri);
        }
        return content;
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
        this.fileCache.set(uri.toString(), content);
        const text = new TextDecoder().decode(content);
        const path = uri.path;

        if (path.startsWith("/prompts/")) {
            const rawFilename = path.replace(/^\/prompts\//, "");
            const baseName = decodeURIComponent(rawFilename).replace(/\.(prompt|mfprompt|modusprompt|json)$/i, "");
            const jsonFilename = `${baseName}.json`;

            let category = "General";
            const catMatch = text.match(/\/\*\s*Category:\s*(.*?)(?:\s*\||\s*\*\/)/i);
            if (catMatch && catMatch[1]) {
                category = catMatch[1].trim() || "General";
            }

            const { positive, negative } = extractPromptFromText(text);

            const ok = await this.client.savePrompt({
                filename: jsonFilename,
                category,
                positive,
                negative
            });

            if (ok) {
                vscode.window.setStatusBarMessage(`✅ Saved prompt "${jsonFilename}" to ComfyUI`, 4000);
            } else {
                vscode.window.showErrorMessage(`Failed to save prompt "${jsonFilename}" to ComfyUI`);
            }
        } else if (path.startsWith("/wildcards/")) {
            const rawFilename = path.replace(/^\/wildcards\//, "");
            const name = decodeURIComponent(rawFilename).replace(/\.txt$/i, "");
            try {
                const res = await this.client.fetchJson<{ success: boolean; message?: string }>("/modusflow/wildcards/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: name, content: text })
                });
                if (res && res.success) {
                    vscode.window.setStatusBarMessage(`✅ Saved wildcard "${name}.txt" to ComfyUI`, 4000);
                } else {
                    vscode.window.showErrorMessage(`Failed to save wildcard: ${res?.message || "Unknown error"}`);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to save wildcard: ${err.message}`);
            }
        }

        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    readDirectory(): [string, vscode.FileType][] {
        return [];
    }

    createDirectory(): void {}

    delete(uri: vscode.Uri): void {
        this.fileCache.delete(uri.toString());
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    }

    rename(): void {}

    clearCache(uri?: vscode.Uri): void {
        if (uri) {
            this.fileCache.delete(uri.toString());
        } else {
            this.fileCache.clear();
        }
    }

    private async fetchContent(uri: vscode.Uri): Promise<Uint8Array> {
        const path = uri.path;
        let text = "";

        if (path.startsWith("/prompts/")) {
            const rawFilename = path.replace(/^\/prompts\//, "");
            const baseName = decodeURIComponent(rawFilename).replace(/\.(prompt|mfprompt|modusprompt|json)$/i, "");
            if (baseName.startsWith("Canvas_Node_")) {
                const activeNode = await this.client.getActiveCanvasNode();
                if (activeNode) {
                    text = [
                        `/* Category: Canvas | Style: ${activeNode.prompt_style || "Tags (SDXL / Pony)"} */`,
                        "",
                        `# ── Positive Prompt ───────────────────────`,
                        activeNode.positive || "",
                        "",
                        `# ── Negative Prompt ───────────────────────`,
                        activeNode.negative || ""
                    ].join("\n");
                }
            } else {
                const jsonFilename = `${baseName}.json`;
                const data = await this.client.loadPrompt(jsonFilename);
                if (data) {
                    text = [
                        `/* Category: ${data.category || 'General'} | File: ${jsonFilename} */`,
                        "",
                        `# ── Positive Prompt ───────────────────────`,
                        data.positive || "",
                        "",
                        `# ── Negative Prompt ───────────────────────`,
                        data.negative || ""
                    ].join("\n");
                }
            }
        } else if (path.startsWith("/wildcards/")) {
            const rawFilename = path.replace(/^\/wildcards\//, "");
            const name = decodeURIComponent(rawFilename).replace(/\.txt$/i, "");
            text = await this.client.loadWildcard(name);
        }

        const encoded = new TextEncoder().encode(text);
        this.fileCache.set(uri.toString(), encoded);
        return encoded;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const client = new ComfyClient();
    const fsProvider = new ModusFlowFileSystemProvider(client);
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider("modusflow", fsProvider, { isCaseSensitive: true })
    );

    // ── Status Bar Item ───────────────────────────────────────────────────────
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "modusflow.connect";
    statusBarItem.text = "$(plug) ModusFlow: Connecting...";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    async function updateConnectionStatus() {
        const res = await client.testConnection();
        if (res.online) {
            statusBarItem.text = "$(check) ModusFlow: Online";
            statusBarItem.tooltip = res.message;
            statusBarItem.color = new vscode.ThemeColor("terminal.ansiGreen");
        } else {
            statusBarItem.text = "$(x) ModusFlow: Offline";
            statusBarItem.tooltip = res.message;
            statusBarItem.color = new vscode.ThemeColor("terminal.ansiRed");
        }
    }
    updateConnectionStatus();

    // ── Tree Views ────────────────────────────────────────────────────────────
    const promptsProvider = new PromptsTreeProvider(client);
    vscode.window.registerTreeDataProvider("modusflow.promptsView", promptsProvider);

    const wildcardsProvider = new WildcardsTreeProvider(client);
    vscode.window.registerTreeDataProvider("modusflow.wildcardsView", wildcardsProvider);

    const songsProvider = new SongsTreeProvider(client);
    vscode.window.registerTreeDataProvider("modusflow.songsView", songsProvider);

    const lorasProvider = new LorasTreeProvider(client);
    vscode.window.registerTreeDataProvider("modusflow.lorasView", lorasProvider);

    const activeNodeProvider = new ConnectedCanvasNodeProvider(client);
    vscode.window.registerTreeDataProvider("modusflow.activeNodeView", activeNodeProvider);

    // Periodically poll active node to keep sidebar in sync with ComfyUI canvas
    const activeNodeTimer = setInterval(() => {
        activeNodeProvider.refresh();
    }, 3500);
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(activeNodeTimer)));

    // ── Language Providers ────────────────────────────────────────────────────
    const docSelector: vscode.DocumentSelector = [
        { scheme: "file", language: "modusprompt" },
        { scheme: "untitled", language: "modusprompt" },
        { scheme: "modusflow", language: "modusprompt" },
        { pattern: "**/*.{prompt,mfprompt,modusprompt}" }
    ];

    const colorProvider = new ModusFlowColorProvider();
    context.subscriptions.push(
        vscode.languages.registerColorProvider(docSelector, colorProvider),
        vscode.languages.registerHoverProvider(docSelector, colorProvider),
        vscode.languages.registerHoverProvider(docSelector, new ModusFlowHoverProvider(client)),
        vscode.languages.registerCompletionItemProvider(docSelector, new ModusFlowCompletionProvider(client), "_", "<", "{", "!", "@", "$", "|")
    );

    // ── Commands ──────────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand("modusflow.connect", async () => {
            const res = await client.testConnection();
            if (res.online) {
                vscode.window.showInformationMessage(`🟢 ${res.message}`);
            } else {
                vscode.window.showErrorMessage(`🔴 ${res.message}`);
            }
            updateConnectionStatus();
            promptsProvider.refresh();
            wildcardsProvider.refresh();
            lorasProvider.refresh();
            songsProvider.refresh();
            activeNodeProvider.refresh();
        }),

        vscode.commands.registerCommand("modusflow.refreshPrompts", () => {
            fsProvider.clearCache();
            promptsProvider.refresh();
            wildcardsProvider.refresh();
            lorasProvider.refresh();
            songsProvider.refresh();
            activeNodeProvider.refresh();
            vscode.window.showInformationMessage("🔄 ModusFlow library & canvas node refreshed");
        }),

        vscode.commands.registerCommand("modusflow.refreshLoras", () => {
            lorasProvider.refresh();
            vscode.window.showInformationMessage("🔄 ModusFlow LoRA library refreshed");
        }),

        vscode.commands.registerCommand("modusflow.insertLoraSnippet", async (loraName?: string) => {
            if (!loraName) {
                const list = await client.listLoras();
                if (!list || list.length === 0) {
                    vscode.window.showInformationMessage("No LoRAs found in ComfyUI.");
                    return;
                }
                const picked = await vscode.window.showQuickPick(list, { placeHolder: "Select a LoRA to insert" });
                if (!picked) return;
                loraName = picked;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage("Open a document to insert the LoRA into.");
                return;
            }

            const meta = await client.getLoraMetadata(loraName);
            const tag = `<lora:${loraName}:0.8>`;

            if (meta && meta.trainedWords && meta.trainedWords.length > 0) {
                const triggers = meta.trainedWords.slice(0, 5).join(", ");
                const choice = await vscode.window.showQuickPick([
                    { label: `Insert LoRA Tag`, detail: tag, action: "tag" },
                    { label: `Insert LoRA + Trigger Words`, detail: `${tag}, ${triggers}`, action: "both" },
                    { label: `Insert Trigger Words Only`, detail: triggers, action: "triggers" }
                ], { placeHolder: `LoRA "${loraName}" has trained trigger words:` });

                if (!choice) return;

                let insertText = tag;
                if (choice.action === "both") {
                    insertText = `${tag}, ${triggers}`;
                } else if (choice.action === "triggers") {
                    insertText = triggers;
                }

                editor.edit(eb => {
                    eb.insert(editor.selection.active, insertText);
                });
            } else {
                editor.edit(eb => {
                    eb.insert(editor.selection.active, tag);
                });
            }
        }),

        vscode.commands.registerCommand("modusflow.insertWildcardSnippet", async (wcName?: string) => {
            if (!wcName) {
                const list = await client.listWildcards();
                if (!list || list.length === 0) {
                    vscode.window.showInformationMessage("No wildcards / lists found in ComfyUI.");
                    return;
                }
                const picked = await vscode.window.showQuickPick(list, { placeHolder: "Select a wildcard / list to insert" });
                if (!picked) return;
                wcName = picked;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage("Open a document to insert the wildcard into.");
                return;
            }
            editor.edit(eb => {
                eb.insert(editor.selection.active, `__${wcName}__`);
            });
        }),

        vscode.commands.registerCommand("modusflow.refreshSongs", () => {
            songsProvider.refresh();
            vscode.window.showInformationMessage("🔄 ModusFlow song library refreshed");
        }),

        vscode.commands.registerCommand("modusflow.pushActivePrompt", async () => {
            const editor = vscode.window.activeTextEditor;
            let positive = "";
            let negative = "";

            if (editor) {
                const text = editor.document.getText();
                const extracted = extractPromptFromText(text);
                positive = extracted.positive;
                negative = extracted.negative;
            } else {
                vscode.window.showWarningMessage("No active prompt editor open to push from.");
                return;
            }

            const activeNode = await client.getActiveCanvasNode();
            const res = await client.pushPromptToCanvas({
                node_id: activeNode?.id,
                positive,
                negative
            });

            if (res) {
                vscode.window.showInformationMessage(`🚀 Pushed prompt to canvas node ${activeNode ? '#' + activeNode.id : ''}!`);
                activeNodeProvider.refresh();
            } else {
                vscode.window.showErrorMessage("Failed to push prompt to ComfyUI canvas node. Is ComfyUI running?");
            }
        }),

        vscode.commands.registerCommand("modusflow.pullActivePrompt", async () => {
            const node = await client.getActiveCanvasNode();
            if (!node || !node.id) {
                vscode.window.showWarningMessage("No active ModusFlowTextEditor node found on the ComfyUI canvas.");
                return;
            }

            const promptText = [
                `/* Category: Canvas | Style: ${node.prompt_style || "Tags (SDXL / Pony)"} */`,
                "",
                `# ── Positive Prompt ───────────────────────`,
                node.positive || "",
                "",
                `# ── Negative Prompt ───────────────────────`,
                node.negative || ""
            ].join("\n");

            const uri = vscode.Uri.from({
                scheme: "modusflow",
                path: `/prompts/Canvas_Node_${node.id}.prompt`
            });
            fsProvider.clearCache(uri);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });
            if (doc.getText() !== promptText) {
                const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
                await editor.edit(eb => eb.replace(fullRange, promptText));
            }
            vscode.window.showInformationMessage(`📥 Pulled prompt from canvas node #${node.id}!`);
        }),

        vscode.commands.registerCommand("modusflow.queueGeneration", async () => {
            vscode.window.showInformationMessage("🚀 Sending generation prompt to ComfyUI...");
            const res = await client.queuePrompt();
            if (res.success) {
                vscode.window.showInformationMessage(`✅ Queued prompt! (ID: ${res.prompt_id})`);
            } else {
                vscode.window.showErrorMessage(`Failed to queue: ${res.message}`);
            }
        }),

        vscode.commands.registerCommand("modusflow.openPromptFile", async (filename: string) => {
            const baseName = filename.replace(/\.json$/i, "");
            const uri = vscode.Uri.from({
                scheme: "modusflow",
                path: `/prompts/${baseName}.prompt`
            });
            try {
                fsProvider.clearCache(uri);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (err: any) {
                vscode.window.showErrorMessage(`Could not open prompt: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand("modusflow.assignPromptCategory", async (arg?: PromptTreeItem | vscode.Uri) => {
            let filename = "";
            let currentCategory = "General";

            if (arg && "filename" in arg && typeof arg.filename === "string") {
                filename = arg.filename;
                currentCategory = arg.promptCategory || "General";
            } else if (arg && arg instanceof vscode.Uri) {
                const raw = arg.path.replace(/^\/prompts\//, "");
                filename = decodeURIComponent(raw).replace(/\.(prompt|mfprompt|modusprompt)$/i, ".json");
            } else if (vscode.window.activeTextEditor) {
                const docUri = vscode.window.activeTextEditor.document.uri;
                if (docUri.path.startsWith("/prompts/")) {
                    const raw = docUri.path.replace(/^\/prompts\//, "");
                    filename = decodeURIComponent(raw).replace(/\.(prompt|mfprompt|modusprompt)$/i, ".json");
                    const docText = vscode.window.activeTextEditor.document.getText();
                    const m = docText.match(/\/\*\s*Category:\s*(.*?)(?:\s*\||\s*\*\/)/i);
                    if (m && m[1]) currentCategory = m[1].trim() || "General";
                }
            }

            if (!filename) {
                const promptList = await client.listPrompts();
                if (!promptList || promptList.length === 0) {
                    vscode.window.showInformationMessage("No saved prompts found in ComfyUI.");
                    return;
                }
                const picked = await vscode.window.showQuickPick(
                    promptList.map(p => ({
                        label: p.filename,
                        description: `[Category: ${p.category || "General"}]`,
                        item: p
                    })),
                    { placeHolder: "Select a prompt to assign category" }
                );
                if (!picked) return;
                filename = picked.item.filename;
                currentCategory = picked.item.category || "General";
            }

            const promptList = await client.listPrompts();
            const existingCategories = [...new Set(promptList.map(p => (p.category || "General").trim()).filter(Boolean))].sort();

            const CREATE_NEW_LABEL = "$(plus) Create new category...";
            const pickItems = [
                CREATE_NEW_LABEL,
                ...existingCategories
            ];

            const pickedCat = await vscode.window.showQuickPick(pickItems, {
                placeHolder: `Assign category for "${filename}" (Current: ${currentCategory})`
            });
            if (!pickedCat) return;

            let targetCategory = pickedCat;
            if (pickedCat === CREATE_NEW_LABEL) {
                const customCat = await vscode.window.showInputBox({
                    prompt: `Enter new category name for "${filename}"`,
                    placeHolder: "e.g. Cyberpunk, Landscapes, Anime Characters"
                });
                if (!customCat?.trim()) return;
                targetCategory = customCat.trim();
            }

            const promptData = await client.loadPrompt(filename);
            const positive = promptData?.positive || "";
            const negative = promptData?.negative || "";

            const success = await client.savePrompt({
                filename,
                category: targetCategory,
                positive,
                negative
            });

            if (success) {
                vscode.window.showInformationMessage(`✅ Assigned "${filename}" to category "${targetCategory}"`);
                promptsProvider.refresh();

                // If active editor is this prompt, update header comment in place
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.path.includes(encodeURIComponent(filename.replace(/\.json$/i, "")))) {
                    const fullText = editor.document.getText();
                    let updatedText = fullText.replace(
                        /\/\*\s*Category:\s*(.*?)(?:\s*\||\s*\*\/)/i,
                        `/* Category: ${targetCategory} |`
                    );
                    if (updatedText === fullText && !fullText.includes("/* Category:")) {
                        updatedText = `/* Category: ${targetCategory} | File: ${filename} */\n\n` + fullText;
                    }
                    if (updatedText !== fullText) {
                        const wholeRange = new vscode.Range(0, 0, editor.document.lineCount, 0);
                        await editor.edit(editBuilder => editBuilder.replace(wholeRange, updatedText));
                    }
                }
            } else {
                vscode.window.showErrorMessage(`Failed to assign category to "${filename}"`);
            }
        }),

        vscode.commands.registerCommand("modusflow.openWildcardFile", async (filename: string) => {
            const name = filename.replace(/\.txt$/i, "");
            const uri = vscode.Uri.from({
                scheme: "modusflow",
                path: `/wildcards/${name}.txt`
            });
            try {
                fsProvider.clearCache(uri);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (err: any) {
                vscode.window.showErrorMessage(`Could not open wildcard: ${err.message}`);
            }
        }),

        // ── Ollama Refiner Commands ──
        vscode.commands.registerCommand("modusflow.refineSelectionExpand", () => runOllamaRefinerAction(client, "expand")),
        vscode.commands.registerCommand("modusflow.refineSelectionSynonyms", () => runOllamaRefinerAction(client, "synonyms")),
        vscode.commands.registerCommand("modusflow.refineSelectionWrapChoice", () => runOllamaRefinerAction(client, "wrap_choice")),
        vscode.commands.registerCommand("modusflow.refineSelectionIntensify", () => runOllamaRefinerAction(client, "intensify")),
        vscode.commands.registerCommand("modusflow.refineSelectionSimplify", () => runOllamaRefinerAction(client, "simplify")),
        vscode.commands.registerCommand("modusflow.refineSelectionProsify", () => runOllamaRefinerAction(client, "prosify")),
        vscode.commands.registerCommand("modusflow.refineSelectionTagify", () => runOllamaRefinerAction(client, "tagify")),

        // ── Pop-Out Studio Cockpit Webview ──
        vscode.commands.registerCommand("modusflow.openStudio", async () => {
            const editor = vscode.window.activeTextEditor;
            let initialData: any = undefined;

            if (editor) {
                const text = editor.document.getText();
                let filename = "New_Prompt.json";
                let category = "General";
                let positive = text;
                let negative = "";

                if (editor.document.fileName) {
                    filename = editor.document.fileName.split(/[\\/]/).pop()?.replace(/\.prompt$/i, ".json") || filename;
                }

                const catMatch = text.match(/\/\*\s*Category:\s*(.*?)(?:\s*\||\s*\*\/)/i);
                if (catMatch && catMatch[1]) category = catMatch[1].trim();

                const posMarker = text.search(/# ── Positive Prompt[^\n]*\n?/i);
                const negMarker = text.search(/# ── Negative Prompt[^\n]*\n?/i);
                if (posMarker !== -1 && negMarker !== -1) {
                    const afterPos = text.indexOf("\n", posMarker) + 1;
                    positive = text.substring(afterPos, negMarker).trim();
                    const afterNeg = text.indexOf("\n", negMarker) + 1;
                    negative = text.substring(afterNeg).trim();
                }

                initialData = { filename, category, positive, negative };
            }

            ModusFlowStudioPanel.createOrShow(context.extensionUri, client, initialData);
        }),

        vscode.commands.registerCommand("modusflow.openPromptInStudio", async (filename: string) => {
            const data = await client.loadPrompt(filename);
            if (data) {
                ModusFlowStudioPanel.createOrShow(context.extensionUri, client, {
                    filename,
                    category: data.category || "General",
                    positive: data.positive || "",
                    negative: data.negative || ""
                });
            }
        }),

        vscode.commands.registerCommand("modusflow.openSongFile", async (filename: string) => {
            const song = await client.loadSong(filename);
            if (song) {
                ModusFlowStudioPanel.createOrShowSong(context.extensionUri, client, song);
            } else {
                vscode.window.showErrorMessage(`Could not load song file: ${filename}`);
            }
        }),

        vscode.commands.registerCommand("modusflow.openSongwriterStudio", () => {
            ModusFlowStudioPanel.createOrShowSong(context.extensionUri, client, {
                filename: "New_Song.json",
                title: "New Song",
                genre: "Synthwave",
                vocal_style: "Female lead, expressive",
                mood: "Atmospheric, energetic"
            });
        }),

        // ── Native Editor Prompt Tools & Keybindings ──
        vscode.commands.registerCommand("modusflow.stepWeightUp", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) stepTagWeight(editor, 0.05);
        }),

        vscode.commands.registerCommand("modusflow.stepWeightDown", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) stepTagWeight(editor, -0.05);
        }),

        vscode.commands.registerCommand("modusflow.prettify", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const fullText = editor.document.getText();
                const deduped = prettifyAndDedupe(fullText);
                const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(fullText.length));
                editor.edit(eb => eb.replace(fullRange, deduped));
                vscode.window.showInformationMessage("🧹 Normalized commas and deduplicated tags.");
            }
        }),

        vscode.commands.registerCommand("modusflow.explodeCollapse", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) toggleExplodeCollapse(editor);
        }),

        vscode.commands.registerCommand("modusflow.convertStyleTags", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const fullText = editor.document.getText();
                const converted = convertStyle(fullText, "tags");
                const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(fullText.length));
                editor.edit(eb => eb.replace(fullRange, converted));
                vscode.window.showInformationMessage("🏷️ Converted prompt to Tags format.");
            }
        }),

        vscode.commands.registerCommand("modusflow.convertStyleExpressions", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const fullText = editor.document.getText();
                const converted = convertStyle(fullText, "expressions");
                const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(fullText.length));
                editor.edit(eb => eb.replace(fullRange, converted));
                vscode.window.showInformationMessage("✍️ Converted prompt to Expressions (natural prose) format.");
            }
        }),

        vscode.commands.registerCommand("modusflow.togglePedalQuality", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) toggleNegativePedal(editor, "quality", "tags");
        }),
        vscode.commands.registerCommand("modusflow.togglePedalAnatomy", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) toggleNegativePedal(editor, "anatomy", "tags");
        }),
        vscode.commands.registerCommand("modusflow.togglePedalCgi", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) toggleNegativePedal(editor, "cgi", "tags");
        }),
        vscode.commands.registerCommand("modusflow.togglePedalWatermark", () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) toggleNegativePedal(editor, "watermark", "tags");
        }),

        vscode.commands.registerCommand("modusflow.insertAestheticRibbon", async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const allPresets = [
                ...AESTHETIC_RIBBON.filmStocks.map(p => ({ label: `🎞️ ${p.label}`, detail: p.tag, tag: p.tag })),
                ...AESTHETIC_RIBBON.optics.map(p => ({ label: `🔍 ${p.label}`, detail: p.tag, tag: p.tag })),
                ...AESTHETIC_RIBBON.lighting.map(p => ({ label: `💡 ${p.label}`, detail: p.tag, tag: p.tag })),
                ...AESTHETIC_RIBBON.cameras.map(p => ({ label: `📷 ${p.label}`, detail: p.tag, tag: p.tag }))
            ];

            const picked = await vscode.window.showQuickPick(allPresets, {
                placeHolder: "Select an Aesthetic Ribbon visual descriptor preset to insert..."
            });

            if (picked) {
                editor.edit(eb => {
                    eb.insert(editor.selection.active, picked.tag);
                });
            }
        }),

        vscode.commands.registerCommand("modusflow.showTokenInfo", () => {
            vscode.window.showInformationMessage("ModusFlow Token Estimator: Models CLIP 75-token boundaries and checks for unbalanced parentheses.");
        })
    );

    // ── Live Token Counter Status Bar ──────────────────────────────────────────
    const tokenCounter = new TokenCounterStatusBar();
    context.subscriptions.push(tokenCounter);
}

export function deactivate() {}
