import * as vscode from "vscode";
import { ComfyClient, PromptFileItem } from "./comfyClient";

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
