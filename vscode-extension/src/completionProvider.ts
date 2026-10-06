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
                item.detail = "ModusFlow Wildcard / List";
                item.documentation = new vscode.MarkdownString(`Inserts random line or structured list from \`${wc}\``);
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

        // 3. ModusFlow Block & Control Flow autocomplete: {case..., {for..., {repeat..., {choice...
        if (linePrefix.endsWith("{") || /\{[a-zA-Z0-9_]*$/.test(linePrefix)) {
            const caseItem = new vscode.CompletionItem("case", vscode.CompletionItemKind.Snippet);
            caseItem.detail = "ModusFlow CASE Statement";
            caseItem.documentation = new vscode.MarkdownString("Pattern-matches an active variable against branches.\n\n`{case $var => 'a': outputA | default: outputB}`");
            caseItem.insertText = new vscode.SnippetString("case \\$${1:variable} => \"${2:optionA}\": ${3:resultA} | default: ${4:resultDefault}}");
            items.push(caseItem);

            const forItem = new vscode.CompletionItem("for", vscode.CompletionItemKind.Snippet);
            forItem.detail = "ModusFlow For-Loop";
            forItem.documentation = new vscode.MarkdownString("Iterates through array, list, or dictionary keys.\n\n`{for $item in $list => $item}`");
            forItem.insertText = new vscode.SnippetString("for \\$${1:item} in \\$${2:list} => \\$${1:item}}");
            items.push(forItem);

            const repeatItem = new vscode.CompletionItem("repeat", vscode.CompletionItemKind.Snippet);
            repeatItem.detail = "ModusFlow Repeat Loop";
            repeatItem.documentation = new vscode.MarkdownString("Repeats an expression N times.\n\n`{repeat 3 => detail, }`");
            repeatItem.insertText = new vscode.SnippetString("repeat ${1:3} => ${2:prompt_detail}, }");
            items.push(repeatItem);

            const ternaryItem = new vscode.CompletionItem("ternary", vscode.CompletionItemKind.Snippet);
            ternaryItem.detail = "ModusFlow Inline Conditional";
            ternaryItem.documentation = new vscode.MarkdownString("Inline if-then-else ternary conditional.\n\n`{$style == 'anime' ? vibrant : realistic}`");
            ternaryItem.insertText = new vscode.SnippetString("\\$${1:variable} == \"${2:value}\" ? ${3:true_prompt} : ${4:false_prompt}}");
            items.push(ternaryItem);

            const choiceItem = new vscode.CompletionItem("choice", vscode.CompletionItemKind.Snippet);
            choiceItem.detail = "ModusFlow Dynamic Choice {a|b|c}";
            choiceItem.insertText = new vscode.SnippetString("${1:option1} | ${2:option2} | ${3:option3}}");
            items.push(choiceItem);

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

        // 4. File Imports: @import(...)
        if (linePrefix.endsWith("@") || /@[a-zA-Z]*$/.test(linePrefix)) {
            const imp = new vscode.CompletionItem("@import", vscode.CompletionItemKind.Keyword);
            imp.detail = "Import external prompt or list file";
            imp.documentation = new vscode.MarkdownString("Imports data structures or text from another prompt/JSON/text file.\n\n`@import(\"file.json\")`");
            imp.insertText = new vscode.SnippetString("import(\"${1:filename.json}\")");
            items.push(imp);

            const fn = new vscode.CompletionItem("@macro", vscode.CompletionItemKind.Snippet);
            fn.detail = "Invoke Defined Macro / Function";
            fn.insertText = new vscode.SnippetString("${1:macroName}(${2:args})");
            items.push(fn);
        }

        // 5. Pipe Filters: | upper, | lower, | title, | trim
        if (linePrefix.includes("|") && /\|\s*[a-zA-Z]*$/.test(linePrefix)) {
            const filters = [
                { name: "upper", desc: "Convert string to UPPERCASE" },
                { name: "lower", desc: "Convert string to lowercase" },
                { name: "title", desc: "Convert string to Title Case" },
                { name: "trim", desc: "Trim surrounding whitespace" }
            ];
            for (const f of filters) {
                const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Function);
                item.detail = `Filter: ${f.desc}`;
                item.insertText = f.name;
                items.push(item);
            }
        }

        // 6. Built-in Functions: range, rand
        if (/\b(ra[a-z]*)$/.test(linePrefix)) {
            const rangeItem = new vscode.CompletionItem("range", vscode.CompletionItemKind.Function);
            rangeItem.detail = "range(start, end, [step])";
            rangeItem.documentation = new vscode.MarkdownString("Generates a sequence array of numbers from start to end.");
            rangeItem.insertText = new vscode.SnippetString("range(${1:1}, ${2:10})");
            items.push(rangeItem);

            const randItem = new vscode.CompletionItem("rand", vscode.CompletionItemKind.Function);
            randItem.detail = "rand(min, max)";
            randItem.documentation = new vscode.MarkdownString("Generates a pseudo-random integer between min and max inclusive.");
            randItem.insertText = new vscode.SnippetString("rand(${1:1}, ${2:100})");
            items.push(randItem);
        }

        // 7. Prompt Snippet Macros: !cine, !photo, !anime, !neg
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
