import * as vscode from "vscode";

export class TokenCounterStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private disposable: vscode.Disposable;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = "modusflow.showTokenInfo";

        const subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(() => this.update(), this, subscriptions);
        vscode.workspace.onDidChangeTextDocument(() => this.update(), this, subscriptions);

        this.disposable = vscode.Disposable.from(...subscriptions, this.statusBarItem);
        this.update();
    }

    public update(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || (editor.document.languageId !== "modusprompt" && !editor.document.fileName.endsWith(".prompt") && editor.document.uri.scheme !== "modusflow")) {
            this.statusBarItem.hide();
            return;
        }

        const text = editor.document.getText();
        if (!text) {
            this.statusBarItem.hide();
            return;
        }

        // Count words
        const words = text.match(/\b[\w'-]+\b/g) || [];
        const wordCount = words.length;

        // Estimate CLIP tokens: ~1.2 tokens per word + special symbols and tags
        let estimatedTokens = 0;
        for (const w of words) {
            estimatedTokens += Math.max(1, Math.ceil(w.length / 4));
        }
        const punctuationCount = (text.match(/[,.:;!?_()<{}]/g) || []).length;
        estimatedTokens += Math.floor(punctuationCount * 0.5);

        const currentChunk = Math.floor(estimatedTokens / 75) + 1;
        const chunkProgress = (estimatedTokens % 75) || 75;

        // Check for unclosed parentheses
        let openParens = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === "(") openParens++;
            else if (text[i] === ")") openParens--;
        }

        let badge = `$(symbol-keyword) ${wordCount}w · ${estimatedTokens} tok (${chunkProgress}/75 Ch.${currentChunk})`;
        if (openParens > 0) {
            badge = `$(warning) ${openParens} unclosed ( ) | ` + badge;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        } else if (openParens < 0) {
            badge = `$(warning) ${Math.abs(openParens)} extra ) | ` + badge;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }

        this.statusBarItem.text = badge;
        this.statusBarItem.tooltip = [
            `ModusFlow Token Estimator:`,
            `• Words: ${wordCount}`,
            `• Estimated CLIP Tokens: ${estimatedTokens}`,
            `• Active CLIP Chunk: Chunk ${currentChunk} (${chunkProgress}/75 tokens)`,
            openParens !== 0 ? `\n⚠️ Unbalanced Parentheses detected!` : ""
        ].filter(Boolean).join("\n");

        this.statusBarItem.show();
    }

    public dispose(): void {
        this.disposable.dispose();
    }
}
