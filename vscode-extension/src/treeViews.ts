import * as vscode from "vscode";
import { ComfyClient, PromptFileItem, SongFileItem } from "./comfyClient";

export class PromptsTreeProvider implements vscode.TreeDataProvider<PromptTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<PromptTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private client: ComfyClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PromptTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
        if (!element) {
            const list = await this.client.listPrompts();
            const categories = new Map<string, PromptFileItem[]>();

            for (const item of list) {
                const cat = (item.category || "Uncategorized").trim();
                if (!categories.has(cat)) categories.set(cat, []);
                categories.get(cat)!.push(item);
            }

            const nodes: PromptTreeItem[] = [];
            for (const [cat, items] of categories.entries()) {
                nodes.push(new PromptTreeItem(
                    cat,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "category",
                    items
                ));
            }
            return nodes.sort((a, b) => a.label.localeCompare(b.label));
        }

        if (element.contextValue === "category" && element.childItems) {
            return element.childItems.map(p => {
                const item = new PromptTreeItem(
                    p.filename,
                    vscode.TreeItemCollapsibleState.None,
                    "promptFile"
                );
                item.description = p.positive ? p.positive.substring(0, 35) + "..." : "";
                item.tooltip = `Positive:\n${p.positive || ""}\n\nNegative:\n${p.negative || ""}`;
                item.command = {
                    command: "modusflow.openPromptFile",
                    title: "Open Prompt",
                    arguments: [p.filename]
                };
                return item;
            });
        }

        return [];
    }
}

export class PromptTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly childItems?: PromptFileItem[]
    ) {
        super(label, collapsibleState);
        if (contextValue === "category") {
            this.iconPath = new vscode.ThemeIcon("folder");
        } else {
            this.iconPath = new vscode.ThemeIcon("file-text");
        }
    }
}

export class WildcardsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private client: ComfyClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        const list = await this.client.listWildcards();
        return list.map(wc => {
            const item = new vscode.TreeItem(wc, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon("list-unordered");
            item.description = `__${wc}__`;
            item.command = {
                command: "modusflow.openWildcardFile",
                title: "Open Wildcard File",
                arguments: [wc]
            };
            return item;
        });
    }
}

export class ConnectedCanvasNodeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private _lastNodeInfo: any = null;

    constructor(private client: ComfyClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) return [];

        const node = await this.client.getActiveCanvasNode();
        this._lastNodeInfo = node;

        if (!node || !node.id) {
            const emptyItem = new vscode.TreeItem("No Canvas Node Connected", vscode.TreeItemCollapsibleState.None);
            emptyItem.description = "Select ModusFlowTextEditor in ComfyUI";
            emptyItem.iconPath = new vscode.ThemeIcon("radio-tower");
            emptyItem.tooltip = "Open ComfyUI in your browser and select or add a ModusFlow Text Editor node.";

            const refreshItem = new vscode.TreeItem("Check Connection / Refresh", vscode.TreeItemCollapsibleState.None);
            refreshItem.iconPath = new vscode.ThemeIcon("refresh");
            refreshItem.command = {
                command: "modusflow.refreshPrompts",
                title: "Refresh Canvas Node & Prompts"
            };

            return [emptyItem, refreshItem];
        }

        const headerItem = new vscode.TreeItem(`Node #${node.id}: ${node.title || "ModusFlow Text Editor"}`, vscode.TreeItemCollapsibleState.None);
        headerItem.description = `[${node.prompt_style || "Tags"}]`;
        headerItem.iconPath = new vscode.ThemeIcon("circuit-board");
        headerItem.tooltip = `Connected Node ID: ${node.id}\nTitle: ${node.title}\nStyle: ${node.prompt_style}`;

        const pushItem = new vscode.TreeItem("Push Active Editor to Canvas", vscode.TreeItemCollapsibleState.None);
        pushItem.iconPath = new vscode.ThemeIcon("cloud-upload");
        pushItem.description = `→ Node #${node.id}`;
        pushItem.command = {
            command: "modusflow.pushActivePrompt",
            title: "Push Prompt to Active Canvas Node"
        };

        const pullItem = new vscode.TreeItem("Pull Canvas Node to Editor", vscode.TreeItemCollapsibleState.None);
        pullItem.iconPath = new vscode.ThemeIcon("cloud-download");
        pullItem.description = `← Node #${node.id}`;
        pullItem.command = {
            command: "modusflow.pullActivePrompt",
            title: "Pull Prompt from Active Canvas Node"
        };

        const posSnippet = (node.positive || "").trim();
        const posItem = new vscode.TreeItem("Positive Prompt", vscode.TreeItemCollapsibleState.None);
        posItem.iconPath = new vscode.ThemeIcon("edit");
        posItem.description = posSnippet ? (posSnippet.length > 40 ? posSnippet.slice(0, 40) + "..." : posSnippet) : "(empty)";
        posItem.tooltip = `Positive Prompt (Node #${node.id}):\n${posSnippet}`;

        const negSnippet = (node.negative || "").trim();
        const negItem = new vscode.TreeItem("Negative Prompt", vscode.TreeItemCollapsibleState.None);
        negItem.iconPath = new vscode.ThemeIcon("shield");
        negItem.description = negSnippet ? (negSnippet.length > 40 ? negSnippet.slice(0, 40) + "..." : negSnippet) : "(empty)";
        negItem.tooltip = `Negative Prompt (Node #${node.id}):\n${negSnippet}`;

        return [headerItem, pushItem, pullItem, posItem, negItem];
    }
}

export class SongsTreeProvider implements vscode.TreeDataProvider<SongTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SongTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private client: ComfyClient) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SongTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SongTreeItem): Promise<SongTreeItem[]> {
        if (!element) {
            const list = await this.client.listSongs();
            const categories = new Map<string, SongFileItem[]>();

            for (const item of list) {
                const cat = (item.category || item.genre || "General").trim();
                if (!categories.has(cat)) categories.set(cat, []);
                categories.get(cat)!.push(item);
            }

            const nodes: SongTreeItem[] = [];
            for (const [cat, items] of categories.entries()) {
                nodes.push(new SongTreeItem(
                    cat,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "category",
                    items
                ));
            }
            return nodes.sort((a, b) => a.label.localeCompare(b.label));
        }

        if (element.contextValue === "category" && element.childItems) {
            return element.childItems.map(song => {
                const title = song.title || song.filename;
                const item = new SongTreeItem(
                    title,
                    vscode.TreeItemCollapsibleState.None,
                    "songFile"
                );
                item.description = song.genre ? `[${song.genre}]` : "";
                item.tooltip = `Song: ${song.title || song.filename}\nGenre: ${song.genre || "N/A"}\nVocals: ${song.vocal_style || "N/A"}\nMood: ${song.mood || "N/A"}`;
                item.command = {
                    command: "modusflow.openSongFile",
                    title: "Open Song in Songwriter Studio",
                    arguments: [song.filename]
                };
                return item;
            });
        }

        return [];
    }
}

export class SongTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly childItems?: SongFileItem[]
    ) {
        super(label, collapsibleState);
        if (contextValue === "category") {
            this.iconPath = new vscode.ThemeIcon("folder");
        } else {
            this.iconPath = new vscode.ThemeIcon("music");
        }
    }
}

