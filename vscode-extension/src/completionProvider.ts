import * as vscode from "vscode";
import { ComfyClient } from "./comfyClient";

export class ModusFlowCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private client: ComfyClient) {}

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const items: vscode.CompletionItem[] = [];

        // 1. Wildcard autocomplete: __...
        if (linePrefix.endsWith("__") || /__[a-zA-Z0-9_/.-]*$/.test(linePrefix)) {
            const wildcards = await this.client.listWildcards();
            for (const wc of wildcards) {
                const item = new vscode.CompletionItem(`__${wc}__`, vscode.CompletionItemKind.Function);
                item.detail = "ModusFlow Wildcard";
                item.documentation = new vscode.MarkdownString(`Inserts random line from wildcard list: \`${wc}\``);
                item.insertText = `__${wc}__`;
                items.push(item);
            }
        }

        // 2. LoRA autocomplete: <lora:...
        if (linePrefix.includes("<lora:") || linePrefix.endsWith("<lora")) {
            const loras = await this.client.listLoras();
            for (const lora of loras) {
                const item = new vscode.CompletionItem(lora, vscode.CompletionItemKind.Module);
                item.detail = "Installed LoRA Model";
                item.insertText = new vscode.SnippetString(`${lora}:\${1:0.8}>`);
                items.push(item);
            }
        }

        // 3. Curator tag autocomplete: {curator...
        if (linePrefix.endsWith("{") || linePrefix.endsWith("{cur") || linePrefix.endsWith("{list") || linePrefix.endsWith("{item")) {
            const c1 = new vscode.CompletionItem("curator", vscode.CompletionItemKind.Variable);
            c1.detail = "ModusFlow List Curator Primary Trait";
            c1.insertText = "curator}";
            items.push(c1);

            const c2 = new vscode.CompletionItem("curator2", vscode.CompletionItemKind.Variable);
            c2.detail = "ModusFlow List Curator Secondary Trait";
            c2.insertText = "curator2}";
            items.push(c2);

            const c3 = new vscode.CompletionItem("shuffle", vscode.CompletionItemKind.Keyword);
            c3.detail = "ModusFlow Tag Shuffle Block";
            c3.insertText = new vscode.SnippetString("shuffle: ${1:tag1}, ${2:tag2}, ${3:tag3}}");
            items.push(c3);
        }

        // 4. Prompt Snippet Macros: !cine, !photo, !anime, !neg
        if (linePrefix.endsWith("!") || /![a-z]*$/.test(linePrefix)) {
            const mCine = new vscode.CompletionItem("!cine", vscode.CompletionItemKind.Snippet);
            mCine.detail = "Macro: Cinematic Lighting & Composition";
            mCine.insertText = "cinematic film still, 35mm photograph, anamorphic lens flare, moody volumetric atmosphere, rim lighting, 8k resolution, photorealistic, masterpiece";
            items.push(mCine);

            const mPhoto = new vscode.CompletionItem("!photo", vscode.CompletionItemKind.Snippet);
            mPhoto.detail = "Macro: Photorealistic Studio Portrait";
            mPhoto.insertText = "award-winning studio portrait photography, 85mm f/1.4 lens, natural skin texture, subsurface scattering, soft catchlights, intricate details, Hasselblad";
            items.push(mPhoto);

            const mAnime = new vscode.CompletionItem("!anime", vscode.CompletionItemKind.Snippet);
            mAnime.detail = "Macro: Modern Anime Aesthetic";
            mAnime.insertText = "masterpiece anime artwork, vibrant color saturation, Makoto Shinkai aesthetic, luminous celestial lighting, clean linework, cel shaded";
            items.push(mAnime);

            const mNeg = new vscode.CompletionItem("!neg", vscode.CompletionItemKind.Snippet);
            mNeg.detail = "Macro: Universal High-Quality Negative Preset";
            mNeg.insertText = "blurry, low quality, worst quality, distorted, extra limbs, bad anatomy, duplicate, jpeg artifacts, signature, watermark, username";
            items.push(mNeg);
        }

        return items;
    }
}
