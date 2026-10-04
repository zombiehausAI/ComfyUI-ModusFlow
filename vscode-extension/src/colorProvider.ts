import * as vscode from "vscode";

interface NamedColor {
    name: string;
    r: number;
    g: number;
    b: number;
}

const PROMPT_COLOR_PALETTE: NamedColor[] = [
    { name: "pure black", r: 0, g: 0, b: 0 },
    { name: "deep charcoal", r: 35, g: 35, b: 35 },
    { name: "slate grey", r: 112, g: 128, b: 144 },
    { name: "silver grey", r: 192, g: 192, b: 192 },
    { name: "pure white", r: 255, g: 255, b: 255 },
    { name: "crimson red", r: 220, g: 20, b: 60 },
    { name: "vibrant ruby red", r: 224, g: 17, b: 95 },
    { name: "scarlet red", r: 255, g: 36, b: 0 },
    { name: "burgundy wine", r: 128, g: 0, b: 32 },
    { name: "burnt orange", r: 204, g: 85, b: 0 },
    { name: "warm amber gold", r: 255, g: 191, b: 0 },
    { name: "neon neon yellow", r: 255, g: 255, b: 0 },
    { name: "forest emerald green", r: 4, g: 99, b: 7 },
    { name: "mint sage green", r: 152, g: 255, b: 152 },
    { name: "electric neon cyan", r: 0, g: 255, b: 255 },
    { name: "deep sapphire blue", r: 15, g: 82, b: 186 },
    { name: "midnight navy blue", r: 0, g: 0, b: 128 },
    { name: "vibrant neon purple", r: 176, g: 38, b: 255 },
    { name: "pastel lavender", r: 230, g: 230, b: 250 },
    { name: "hot magenta pink", r: 255, g: 0, b: 144 },
    { name: "blush rose pink", r: 255, g: 182, b: 193 }
];

export function resolveNearestColorName(r: number, g: number, b: number): string {
    let bestDist = Infinity;
    let bestName = "custom color";
    for (const c of PROMPT_COLOR_PALETTE) {
        const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            bestName = c.name;
        }
    }
    return bestName;
}

export class ModusFlowColorProvider implements vscode.DocumentColorProvider, vscode.HoverProvider {
    provideDocumentColors(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.ColorInformation[]> {
        const text = document.getText();
        const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
        const result: vscode.ColorInformation[] = [];
        let match: RegExpExecArray | null;

        while ((match = hexRegex.exec(text)) !== null) {
            const hex = match[1];
            let r = 0, g = 0, b = 0;
            if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16) / 255;
                g = parseInt(hex.substring(2, 4), 16) / 255;
                b = parseInt(hex.substring(4, 6), 16) / 255;
            } else if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16) / 255;
                g = parseInt(hex[1] + hex[1], 16) / 255;
                b = parseInt(hex[2] + hex[2], 16) / 255;
            }

            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            result.push(new vscode.ColorInformation(
                new vscode.Range(startPos, endPos),
                new vscode.Color(r, g, b, 1.0)
            ));
        }

        return result;
    }

    provideColorPresentations(
        color: vscode.Color,
        _context: { document: vscode.TextDocument; range: vscode.Range },
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.ColorPresentation[]> {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        return [new vscode.ColorPresentation(hex)];
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position, /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
        if (!range) return null;

        const hexText = document.getText(range);
        const raw = hexText.replace("#", "");
        let r = 0, g = 0, b = 0;
        if (raw.length === 6) {
            r = parseInt(raw.substring(0, 2), 16);
            g = parseInt(raw.substring(2, 4), 16);
            b = parseInt(raw.substring(4, 6), 16);
        } else if (raw.length === 3) {
            r = parseInt(raw[0] + raw[0], 16);
            g = parseInt(raw[1] + raw[1], 16);
            b = parseInt(raw[2] + raw[2], 16);
        }

        const naturalName = resolveNearestColorName(r, g, b);
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`### 🎨 ModusFlow Color Inspector\n\n`);
        md.appendMarkdown(`- **Hex:** \`${hexText}\`\n`);
        md.appendMarkdown(`- **RGB:** \`rgb(${r}, ${g}, ${b})\`\n`);
        md.appendMarkdown(`- **Natural Prompt Name:** **\`${naturalName}\`** *(recommended for diffusion)*\n\n`);
        md.appendMarkdown(`*Diffusion models understand natural descriptive terms better than raw hex codes.*`);

        return new vscode.Hover(md, range);
    }
}
