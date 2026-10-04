import * as vscode from "vscode";
import { ComfyClient } from "./comfyClient";

export class ModusFlowHoverProvider implements vscode.HoverProvider {
    constructor(private client: ComfyClient) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // 1. Check LoRA hover
        const loraRange = document.getWordRangeAtPosition(position, /<lora:[^>]+>/);
        if (loraRange) {
            const text = document.getText(loraRange);
            const match = /<lora:([^:>]+)(?::([^>]+))?>/.exec(text);
            if (match) {
                const loraName = match[1];
                const weight = match[2] || "1.0";
                const meta = await this.client.getLoraMetadata(loraName);

                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                md.supportHtml = true;
                md.appendMarkdown(`### 🎨 LoRA: \`${loraName}\`\n\n`);
                md.appendMarkdown(`- **Weight:** \`${weight}\`\n`);
                if (meta) {
                    if (meta.modelName) md.appendMarkdown(`- **Title:** ${meta.modelName}\n`);
                    if (meta.creator) md.appendMarkdown(`- **Creator:** ${meta.creator}\n`);
                    if (meta.trainedWords && meta.trainedWords.length > 0) {
                        md.appendMarkdown(`\n**Trained Trigger Words:**\n`);
                        meta.trainedWords.forEach(w => md.appendMarkdown(`\`${w}\` `));
                        md.appendMarkdown(`\n\n`);
                    }
                    if (meta.images && meta.images.length > 0) {
                        md.appendMarkdown(`\n![Preview](${meta.images[0]})\n`);
                    }
                } else {
                    md.appendMarkdown(`\n*(Civitai metadata not cached or offline)*\n`);
                }
                return new vscode.Hover(md, loraRange);
            }
        }

        // 2. Check Variable hover: $var
        const varRange = document.getWordRangeAtPosition(position, /\$[a-zA-Z0-9_]+/);
        if (varRange) {
            const varName = document.getText(varRange);
            const fullText = document.getText();
            const defRegex = new RegExp(`\\${varName}\\s*=\\s*([^;]+);`);
            const defMatch = defRegex.exec(fullText);

            const md = new vscode.MarkdownString();
            md.appendMarkdown(`### 📦 Prompt Variable: \`${varName}\`\n\n`);
            if (defMatch) {
                md.appendMarkdown(`**Assigned Value:**\n\`\`\`\n${defMatch[1].trim()}\n\`\`\`\n`);
            } else {
                md.appendMarkdown(`*Variable referenced without a definition header (\`${varName} = ...;\`)*`);
            }
            return new vscode.Hover(md, varRange);
        }

        return null;
    }
}
