import * as vscode from "vscode";

/**
 * Adjusts the attention weight of the tag under the cursor or selection by delta (+0.05 or -0.05).
 * e.g. tag -> (tag:1.05) -> (tag:1.1) -> ...
 * Stepping down to 1.0 unwraps to clean plain text.
 */
export function stepTagWeight(editor: vscode.TextEditor, delta: number): void {
    const document = editor.document;
    const selection = editor.selection;

    let targetRange: vscode.Range = selection;
    let targetText = "";

    if (!selection.isEmpty) {
        targetRange = selection;
        targetText = document.getText(selection).trim();
    } else {
        // Expand to tag or parenthesized expression around cursor
        const line = document.lineAt(selection.active.line);
        const lineText = line.text;
        const cursorCol = selection.active.character;

        // Check if inside (word:weight)
        const parenRegex = /\(([^():]+):([0-9.]+)\)/g;
        let match: RegExpExecArray | null;
        let found = false;

        while ((match = parenRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (cursorCol >= start && cursorCol <= end) {
                targetRange = new vscode.Range(selection.active.line, start, selection.active.line, end);
                targetText = match[0];
                found = true;
                break;
            }
        }

        if (!found) {
            // Find comma-delimited tag or word boundary
            let start = cursorCol;
            while (start > 0 && lineText[start - 1] !== "," && lineText[start - 1] !== "(" && lineText[start - 1] !== "\n") {
                start--;
            }
            let end = cursorCol;
            while (end < lineText.length && lineText[end] !== "," && lineText[end] !== ")" && lineText[end] !== "\n") {
                end++;
            }
            targetRange = new vscode.Range(selection.active.line, start, selection.active.line, end);
            targetText = lineText.substring(start, end).trim();
        }
    }

    if (!targetText) {
        return;
    }

    let newText = targetText;
    const weightMatch = targetText.match(/^\((.+):([0-9.]+)\)$/);

    if (weightMatch) {
        const coreTag = weightMatch[1].trim();
        const currentWeight = parseFloat(weightMatch[2]);
        const newWeight = Math.round((currentWeight + delta) * 100) / 100;

        if (newWeight <= 1.0 && delta < 0) {
            newText = coreTag;
        } else {
            newText = `(${coreTag}:${newWeight.toFixed(2).replace(/\.?0+$/, "")})`;
        }
    } else {
        if (delta > 0) {
            newText = `(${targetText}:1.05)`;
        } else {
            newText = `(${targetText}:0.95)`;
        }
    }

    editor.edit(editBuilder => {
        editBuilder.replace(targetRange, newText);
    });
}

/**
 * Prettifies tags: eliminates duplicate tags, normalizes whitespace and comma punctuation,
 * while preserving comments and section markers.
 */
export function prettifyAndDedupe(text: string): string {
    const lines = text.split("\n");
    const resultLines: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed === "") {
            resultLines.push(line);
            continue;
        }

        const tags = line.split(",").map(t => t.trim()).filter(t => t.length > 0);
        const seen = new Set<string>();
        const deduped: string[] = [];

        for (const tag of tags) {
            const key = tag.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(tag);
            }
        }

        if (deduped.length > 0) {
            resultLines.push(deduped.join(", "));
        }
    }

    return resultLines.join("\n");
}

/**
 * Toggles Exploded Mode (one tag per line, indented) vs Collapsed Mode (inline comma-separated).
 */
export function toggleExplodeCollapse(editor: vscode.TextEditor): void {
    const document = editor.document;
    const fullText = document.getText();
    const isExploded = fullText.includes("\n  ") || /,\s*\n\s+/.test(fullText);

    let newText: string;
    if (isExploded) {
        // Collapse: join consecutive indented lines
        const lines = fullText.split("\n");
        const out: string[] = [];
        let tagBuffer: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed === "") {
                if (tagBuffer.length > 0) {
                    out.push(tagBuffer.join(", "));
                    tagBuffer = [];
                }
                out.push(line);
            } else {
                const subTags = trimmed.split(",").map(s => s.trim()).filter(s => s.length > 0);
                tagBuffer.push(...subTags);
            }
        }
        if (tagBuffer.length > 0) {
            out.push(tagBuffer.join(", "));
        }
        newText = out.join("\n");
    } else {
        // Explode: format each comma-separated tag onto its own line indented by 2 spaces
        const lines = fullText.split("\n");
        const out: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed === "") {
                out.push(line);
            } else {
                const tags = line.split(",").map(t => t.trim()).filter(t => t.length > 0);
                for (let i = 0; i < tags.length; i++) {
                    const comma = i < tags.length - 1 ? "," : "";
                    out.push(`  ${tags[i]}${comma}`);
                }
            }
        }
        newText = out.join("\n");
    }

    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(fullText.length)
    );

    editor.edit(editBuilder => {
        editBuilder.replace(fullRange, newText);
    });
}

/**
 * Bidirectional prompt style converter: Tags <-> Expressions.
 */
export function convertStyle(text: string, toStyle: "tags" | "expressions"): string {
    const lines = text.split("\n");
    const out: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed === "") {
            out.push(line);
            continue;
        }

        if (toStyle === "expressions") {
            // Strip numerical attention weights (e.g. (masterpiece:1.2) -> masterpiece)
            let converted = line.replace(/\(([^():]+):[0-9.]+\)/g, "$1");
            // Normalize spaces
            converted = converted.replace(/\s*,\s*/g, ", ").trim();
            out.push(converted);
        } else {
            // Convert prose sentences to comma-delimited keyword tags
            let converted = line.replace(/[.!?;]/g, ",");
            converted = converted.replace(/\s*,\s*/g, ", ");
            converted = converted.replace(/,+/g, ",");
            out.push(converted.trim());
        }
    }

    return out.join("\n");
}

/**
 * Toggles a Negative Guard Pedal in the negative prompt section.
 */
export const NEGATIVE_PEDALS = {
    quality: {
        label: "Quality",
        tags: "(worst quality, low quality, normal quality:1.4)",
        expressions: "worst quality, low quality, normal quality"
    },
    anatomy: {
        label: "Anatomy",
        tags: "(bad anatomy, bad hands, missing fingers, extra digits:1.3)",
        expressions: "bad anatomy, bad hands, missing fingers, extra digits"
    },
    cgi: {
        label: "3D Guard",
        tags: "(cgi, 3d render, cartoon, illustration:1.2)",
        expressions: "cgi, 3d render, cartoon, illustration"
    },
    watermark: {
        label: "Watermark",
        tags: "(watermark, text, signature, username:1.2)",
        expressions: "watermark, text, signature, username"
    }
};

export function toggleNegativePedal(editor: vscode.TextEditor, pedalKey: keyof typeof NEGATIVE_PEDALS, promptStyle: "tags" | "expressions"): void {
    const document = editor.document;
    const text = document.getText();
    const pedal = NEGATIVE_PEDALS[pedalKey];
    if (!pedal) return;

    const guardSnippet = promptStyle === "expressions" ? pedal.expressions : pedal.tags;
    const altSnippet = promptStyle === "expressions" ? pedal.tags : pedal.expressions;

    const negMarkerIdx = text.search(/# ── Negative Prompt[^\n]*\n?/i);
    if (negMarkerIdx === -1) {
        // No negative section found, append it
        const newText = text + `\n\n# ── Negative Prompt ───────────────────────\n${guardSnippet}\n`;
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        editor.edit(editBuilder => editBuilder.replace(fullRange, newText));
        return;
    }

    const afterNegIdx = text.indexOf("\n", negMarkerIdx) + 1;
    const negSection = text.substring(afterNegIdx);

    const hasSnippet = negSection.includes(guardSnippet) || negSection.includes(altSnippet);

    let updatedNeg: string;
    if (hasSnippet) {
        // Remove pedal
        updatedNeg = negSection
            .replace(guardSnippet, "")
            .replace(altSnippet, "")
            .replace(/,\s*,/g, ",")
            .replace(/^\s*,\s*/g, "")
            .replace(/\s*,\s*$/g, "")
            .trim();
    } else {
        // Add pedal to negative prompt
        const trimmed = negSection.trim();
        updatedNeg = trimmed ? `${guardSnippet}, ${trimmed}` : guardSnippet;
    }

    const fullRange = new vscode.Range(document.positionAt(afterNegIdx), document.positionAt(text.length));
    editor.edit(editBuilder => editBuilder.replace(fullRange, updatedNeg + "\n"));
}

/**
 * Aesthetic Ribbon curated presets for 1-click prompt injection.
 */
export const AESTHETIC_RIBBON = {
    filmStocks: [
        { label: "Kodak Portra 400", tag: "shot on 35mm Kodak Portra 400, warm film grain, organic colors" },
        { label: "Cinestill 800T", tag: "Cinestill 800T, tungsten balanced, halation glow around highlights" },
        { label: "Fujifilm Velvia 50", tag: "Fujifilm Velvia 50, vivid rich saturation, deep contrasts" },
        { label: "Ilford HP5 Plus", tag: "Ilford HP5 Plus, high contrast black and white, gritty street grain" },
        { label: "Polaroid 600", tag: "vintage Polaroid 600 instant film, faded tones, light leak" }
    ],
    optics: [
        { label: "85mm f/1.2 Portrait", tag: "shot on 85mm f/1.2 lens, creamy bokeh, shallow depth of field" },
        { label: "24mm f/1.4 Wide", tag: "24mm f/1.4 wide angle lens, expansive perspective, dramatic framing" },
        { label: "50mm Anamorphic", tag: "50mm anamorphic lens, cinematic 2.39:1 aspect, oval bokeh, horizontal blue flare" },
        { label: "100mm Macro", tag: "100mm macro lens, ultra microscopic detail, razor sharp focal plane" }
    ],
    lighting: [
        { label: "Rembrandt Lighting", tag: "dramatic Rembrandt lighting, triangular cheek highlight, rich chiaroscuro shadows" },
        { label: "Volumetric God Rays", tag: "volumetric god rays, atmospheric haze, beam of sunlight" },
        { label: "Cyberpunk Neon", tag: "vibrant neon backlighting, cyan and magenta rim light, dark moody ambiance" },
        { label: "Golden Hour", tag: "golden hour sunlight, warm amber glow, long soft shadows" }
    ],
    cameras: [
        { label: "Hasselblad H6D-100c", tag: "shot on Hasselblad H6D-100c medium format, 100 megapixel absurd detail" },
        { label: "ARRI Alexa Mini LF", tag: "shot on ARRI Alexa Mini LF, cinematic Hollywood color science, natural skin tones" },
        { label: "Leica M11", tag: "shot on Leica M11 rangefinder, Leica Summilux lens sharpness" }
    ]
};
