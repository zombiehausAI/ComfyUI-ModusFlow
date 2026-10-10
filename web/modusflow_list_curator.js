import { app } from "../../scripts/app.js";

// ModusFlow List Curator — on-canvas wildcard viewing, editing, saving, updating, deleting,
// with full syntax highlighting, comment shortcuts, and intelligent autocomplete.

// ── Built-in Syntax Themes (Fallbacks) ───────────────────────────────────────
const DEFAULT_THEMES = {
    "Modus Neon (Default)": {
        comment: "#6b7280",
        choice: "#c084fc",
        shuffle: "#f472b6",
        wildcard: "#fbbf24",
        variable: "#38bdf8",
        weight: "#34d399",
        curator: "#4ade80",
        lora: "#f87171",
        keyword: "#e879f9",
        function: "#818cf8",
        plain_text: "#e2e8f0",
        caret_color: "#ffffff",
        bg_color: "#181825"
    },
    "Tomorrow Night Eighties": {
        comment: "#999999",
        choice: "#cc99cc",
        shuffle: "#f99157",
        wildcard: "#ffcc66",
        variable: "#66cccc",
        weight: "#99cc99",
        curator: "#6699cc",
        lora: "#f2777a",
        keyword: "#cc99cc",
        function: "#6699cc",
        plain_text: "#cccccc",
        caret_color: "#cccccc",
        bg_color: "#2d2d2d"
    },
    "Cyberpunk 2077": {
        comment: "#71717a",
        choice: "#e879f9",
        shuffle: "#ff007f",
        wildcard: "#facc15",
        variable: "#00f0ff",
        weight: "#22c55e",
        curator: "#39ff14",
        lora: "#ff0055",
        keyword: "#ff007f",
        function: "#ffe600",
        plain_text: "#f3f4f6",
        caret_color: "#00f0ff",
        bg_color: "#0d0e15"
    },
    "Monokai Pro": {
        comment: "#727072",
        choice: "#ffd866",
        shuffle: "#ff6188",
        wildcard: "#fc9867",
        variable: "#78dce8",
        weight: "#a9dc76",
        curator: "#ab9df2",
        lora: "#ff6188",
        keyword: "#ff6188",
        function: "#a9dc76",
        plain_text: "#fcfcfa",
        caret_color: "#ffd866",
        bg_color: "#221f22"
    },
    "Dracula Night": {
        comment: "#6272a4",
        choice: "#bd93f9",
        shuffle: "#ff79c6",
        wildcard: "#f1fa8c",
        variable: "#8be9fd",
        weight: "#50fa7b",
        curator: "#50fa7b",
        lora: "#ff5555",
        keyword: "#ff79c6",
        function: "#50fa7b",
        plain_text: "#f8f8f2",
        caret_color: "#f8f8f2",
        bg_color: "#1e1f29"
    },
    "Nord Frost": {
        comment: "#616e88",
        choice: "#b48ead",
        shuffle: "#d08770",
        wildcard: "#ebcb8b",
        variable: "#88c0d0",
        weight: "#a3be8c",
        curator: "#8fbcbb",
        lora: "#bf616a",
        keyword: "#81a1c1",
        function: "#8fbcbb",
        plain_text: "#eceff4",
        caret_color: "#88c0d0",
        bg_color: "#242933"
    },
    "Solarized Dark": {
        comment: "#586e75",
        choice: "#6c71c4",
        shuffle: "#d33682",
        wildcard: "#b58900",
        variable: "#2aa198",
        weight: "#859900",
        curator: "#268bd2",
        lora: "#cb4b16",
        keyword: "#859900",
        function: "#268bd2",
        plain_text: "#93a1a1",
        caret_color: "#268bd2",
        bg_color: "#001e26"
    },
    "High Contrast": {
        comment: "#9ca3af",
        choice: "#d946ef",
        shuffle: "#ec4899",
        wildcard: "#eab308",
        variable: "#06b6d4",
        weight: "#10b981",
        curator: "#22c55e",
        lora: "#ef4444",
        keyword: "#d946ef",
        function: "#06b6d4",
        plain_text: "#ffffff",
        caret_color: "#ffffff",
        bg_color: "#09090b"
    }
};

let THEMES = { ...DEFAULT_THEMES };
const MONOSPACE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function getThemeByName(name) {
    if (THEMES[name]) return THEMES[name];
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("modusflow_syntax_theme") : null;
    if (saved && THEMES[saved]) return THEMES[saved];
    return THEMES["Modus Neon (Default)"] || Object.values(THEMES)[0];
}

let _themesFetched = false;
function fetchThemes(callback) {
    if (_themesFetched) return;
    fetch("/modusflow/syntax_themes")
        .then(r => r.json())
        .then(data => {
            if (data.success && data.data && data.data.themes) {
                THEMES = { ...DEFAULT_THEMES, ...data.data.themes };
                _themesFetched = true;
                if (callback) callback();
            }
        })
        .catch(err => console.debug("[ModusFlow ListCurator] Theme fetch:", err.message));
}

function injectSyntaxStyles() {
    if (document.getElementById("modusflow-syntax-style")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "modusflow-syntax-style";
    styleEl.textContent = `
        .modusflow-syntax-ta::selection {
            background: rgba(56, 189, 248, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-syntax-ta::-moz-selection {
            background: rgba(56, 189, 248, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-syntax-backdrop {
            position: absolute;
            pointer-events: none;
            overflow: hidden;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            user-select: none;
            -webkit-user-select: none;
        }
        .modusflow-section-banner {
            display: inline;
            background: linear-gradient(90deg, rgba(137, 180, 250, 0.25) 0%, rgba(203, 166, 247, 0.15) 100%);
            border-bottom: 2px solid #89b4fa;
            color: #89b4fa;
            font-weight: bold;
            letter-spacing: normal;
        }
        .modusflow-weight-token {
            border-radius: 3px;
            padding: 0 2px;
            transition: all 0.15s ease;
        }
        .modusflow-hex-pill {
            padding: 1px 5px;
            border-radius: 4px;
            font-family: inherit;
        }
        .modusflow-token-badge {
            position: absolute;
            bottom: 4px;
            right: 8px;
            font-size: 11px;
            line-height: 1.2;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.82);
            color: #94a3b8;
            border: 1px solid rgba(255, 255, 255, 0.12);
            pointer-events: none;
            z-index: 10;
            font-family: ui-monospace, SFMono-Regular, monospace;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            user-select: none;
            transition: all 0.2s ease;
        }
        .modusflow-token-badge.token-warning {
            color: #fbbf24;
            border-color: rgba(251, 191, 36, 0.5);
            background: rgba(45, 26, 10, 0.88);
        }
        /* ── Autocomplete Menu ── */
        .modusflow-autocomplete-menu {
            position: absolute;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 8px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.1);
            max-height: 230px;
            overflow-y: auto;
            z-index: 1000;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            display: none;
            box-sizing: border-box;
            padding: 4px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
        }
        .modusflow-autocomplete-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            color: #cbd5e1;
            transition: background 0.12s ease, color 0.12s ease;
            user-select: none;
        }
        .modusflow-autocomplete-item:hover,
        .modusflow-autocomplete-item.selected {
            background: rgba(56, 189, 248, 0.22);
            color: #ffffff;
            outline: 1px solid rgba(56, 189, 248, 0.45);
        }
        .modusflow-ac-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            font-weight: 500;
        }
        .modusflow-ac-hint {
            font-size: 10px;
            color: #94a3b8;
            margin-left: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 140px;
        }
        .modusflow-ac-badge {
            font-size: 9px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            flex-shrink: 0;
        }
        .modusflow-ac-badge.badge-wildcard {
            background: rgba(251, 191, 36, 0.18);
            color: #fbbf24;
            border: 1px solid rgba(251, 191, 36, 0.4);
        }
        .modusflow-ac-badge.badge-variable {
            background: rgba(56, 189, 248, 0.18);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.4);
        }
        .modusflow-ac-badge.badge-lora {
            background: rgba(248, 113, 113, 0.18);
            color: #f87171;
            border: 1px solid rgba(248, 113, 113, 0.4);
        }
        .modusflow-ac-badge.badge-curator {
            background: rgba(74, 222, 128, 0.18);
            color: #4ade80;
            border: 1px solid rgba(74, 222, 128, 0.4);
        }
        .modusflow-ac-badge.badge-system {
            background: rgba(192, 132, 252, 0.18);
            color: #c084fc;
            border: 1px solid rgba(192, 132, 252, 0.4);
        }
        .modusflow-ac-empty {
            padding: 8px 12px;
            font-size: 11px;
            color: #94a3b8;
            font-style: italic;
            text-align: center;
        }
    `;
    document.head.appendChild(styleEl);
}

function estimateListStats(text) {
    if (!text) return { totalLines: 0, activeItems: 0, words: 0 };
    const lines = text.split("\n");
    const active = lines.filter(l => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("#") && !t.startsWith("//") && !t.startsWith("/*");
    });
    const words = text.split(/\s+/).filter(Boolean).length;
    return { totalLines: lines.length, activeItems: active.length, words };
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tokenizeAndHighlight(text, theme) {
    if (!text) return "";
    if (!theme || theme === "Off (Plain Text)") {
        return escapeHtml(text);
    }

    const intervals = [];

    const addMatches = (regex, type) => {
        let m;
        regex.lastIndex = 0;
        while ((m = regex.exec(text)) !== null) {
            const start = m.index;
            const end = start + m[0].length;
            if (start === end) {
                regex.lastIndex++;
                continue;
            }
            const collides = intervals.some(iv => (start < iv.end && end > iv.start));
            if (!collides) {
                intervals.push({ start, end, type });
            }
        }
    };

    // Priority order of syntax tokens (matching ModusFlow Text Editor):
    // 0. Section Banners & Directives: [ALL], [Section Name], // [Section], /* [Section] */, #mode: all
    addMatches(/(?:\/\/|#|\/\*)\s*\[[^\]\r\n]+\](?:\s*\*\/)?/g, "section_header");
    addMatches(/(?:^|(?<=[\r\n]))\s*\[[^\]\r\n]+\](?=\s*(?:[\r\n]|$))/g, "section_header");
    addMatches(/(?:^|(?<=[\r\n]))\s*#(?:mode\s*:\s*)?all\b/gi, "section_header");
    // 1. Comments: /* ... */
    addMatches(/\/\*[\s\S]*?\*\//g, "comment");
    // 2. Hex colors: #RRGGBB or #RGB
    addMatches(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "hex_color");
    // 3. Comments (Line): // ... or # ...
    addMatches(/\/\/[^\r\n]*|#[^\r\n]*/g, "comment");
    // 4. LoRA tags: <lora:...>
    addMatches(/<lora:[^>\r\n]+>/gi, "lora");

    // 4.5 CASE Statements: {$var: val1 => result1 | * => default} or {case $var: ...}
    const addCaseMatches = () => {
        let ci = 0;
        const cn = text.length;
        while (ci < cn) {
            const isCasePrefix = text.slice(ci, ci + 6).toLowerCase() === "{case ";
            const isVarPrefix = text.slice(ci, ci + 2) === "{$";
            if (isCasePrefix || isVarPrefix) {
                const cStart = ci;
                ci += isCasePrefix ? 6 : 2;
                let cDepth = 1;
                while (ci < cn && cDepth > 0) {
                    const ch = text[ci];
                    if (ch === "{") cDepth++;
                    else if (ch === "}") cDepth--;
                    ci++;
                }
                if (cDepth === 0) {
                    const block = text.slice(cStart, ci);
                    const inner = block.slice(1, -1);
                    if (inner.includes(":") && inner.includes("=>")) {
                        const collides = intervals.some(iv => (cStart < iv.end && ci > iv.start));
                        if (!collides) {
                            intervals.push({ start: cStart, end: ci, type: "case_statement" });
                        }
                    }
                }
            } else {
                ci++;
            }
        }
    };
    addCaseMatches();

    // 4.6 Ternary Conditionals: {$var==val?true:false}
    const addTernaryMatches = () => {
        let ti = 0;
        const tn = text.length;
        while (ti < tn) {
            if (text.slice(ti, ti + 2) === "{$") {
                const tStart = ti;
                ti += 2;
                let tDepth = 1;
                while (ti < tn && tDepth > 0) {
                    const ch = text[ti];
                    if (ch === "{") tDepth++;
                    else if (ch === "}") tDepth--;
                    ti++;
                }
                if (tDepth === 0) {
                    const block = text.slice(tStart, ti);
                    const inner = block.slice(1, -1);
                    let hasQ = false;
                    let id = 0;
                    for (let idx = 0; idx < inner.length; idx++) {
                        const c = inner[idx];
                        if (c === "{") id++;
                        else if (c === "}") id--;
                        else if (c === "?" && id === 0) {
                            hasQ = true;
                            break;
                        }
                    }
                    if (hasQ && !inner.includes("=>")) {
                        const collides = intervals.some(iv => (tStart < iv.end && ti > iv.start));
                        if (!collides) {
                            intervals.push({ start: tStart, end: ti, type: "ternary" });
                        }
                    }
                }
            } else {
                ti++;
            }
        }
    };
    addTernaryMatches();

    // 4.7 Inline Negative Injections: {!neg: ...}
    addMatches(/\{!neg:[^}]+\}/gi, "inline_neg");
    // 4.8 Environment & Workflow Macros: %seed%, %date%, %sampler%, %steps%, etc.
    addMatches(/%[a-zA-Z0-9_]+%/g, "macro");

    // 4.9 Function & Macro Definitions: fn name(...) or def name(...)
    const addFuncDefMatches = () => {
        const re = /\b(fn|def)\s+([a-zA-Z0-9_]+)/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            const kwStart = m.index;
            const kwEnd = kwStart + m[1].length;
            const fnStart = m.index + m[0].indexOf(m[2]);
            const fnEnd = fnStart + m[2].length;
            if (!intervals.some(iv => kwStart < iv.end && kwEnd > iv.start)) {
                intervals.push({ start: kwStart, end: kwEnd, type: "keyword" });
            }
            if (!intervals.some(iv => fnStart < iv.end && fnEnd > iv.start)) {
                intervals.push({ start: fnStart, end: fnEnd, type: "function" });
            }
        }
    };
    addFuncDefMatches();

    // 4.10 Imports: @import and as
    addMatches(/@import\b/g, "keyword");
    // 4.11 Macro Invocations: @functionName(...) or @macroName
    addMatches(/@[a-zA-Z0-9_]+/g, "function");

    // 4.12 Loops & Flow Keywords
    addMatches(/\brepeat\b(?=\s*[\(\{])/g, "keyword");
    addMatches(/\bfor\b(?=\s+(?:\[[^\]]+\]|\$[a-zA-Z0-9_]+(?:\s*,\s*\$[a-zA-Z0-9_]+)?)\s+in\b)/g, "keyword");
    addMatches(/(?<=\bfor\s+(?:\[[^\]]+\]|\$[a-zA-Z0-9_]+(?:\s*,\s*\$[a-zA-Z0-9_]+)?)\s+)in\b/g, "keyword");
    addMatches(/\bas\b(?=\s+\$[a-zA-Z0-9_]+)/g, "keyword");
    addMatches(/\b(switch|return)\b(?=[\s(:])/g, "keyword");
    addMatches(/\bcase\b(?=[\s:$])/g, "keyword");

    // 4.13 Built-in Functions: all(...), range(...), rand(...)
    addMatches(/\b(all|range|rand)\b(?=\s*[\(\{])/gi, "function");

    // 5. Pick-N & Ranges: {2$$...}, {1-3$$...}, {all$$...}
    addMatches(/\{\s*(?:\d+(?:-\d+)?|all|\*)\$\$[^}]+\}/gi, "choice");
    // 5.5 Weighted Odds: {80::a|20::b}
    addMatches(/\{\s*\d+::[^}]+\}/g, "choice");
    // 5.6 Dynamic Choices: {a|b|c}
    addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");

    // 6. Prompt Variables: Synced Tuples, Multiline Blocks, Piped Filters, or $name = value
    addMatches(/\[\s*(?<!\$)\$[a-zA-Z0-9_]+(?:\s*,\s*(?<!\$)\$[a-zA-Z0-9_]+)*\s*\]\s*=\s*\{[^{}]+\};?/g, "variable");
    addMatches(/(?<!\$)\$[a-zA-Z0-9_]+\s*=\s*(?:"""[\s\S]*?"""|'''[\s\S]*?''')[;\s]*/g, "variable");
    addMatches(/(?<!\$)\$[a-zA-Z0-9_]+(?:\[\d+\])*(?:\.[a-zA-Z0-9_]+\b(?!\s*[\(\{]))*/g, "variable");

    // 6.1 Methods & Properties on objects/lists: .keys(), .values(), .items(), .length, .size()
    addMatches(/(?<=\.)(?:[a-zA-Z0-9_]+\b(?=\s*[\(\{])|length\b)/g, "function");
    // 6.2 Pipe Filters: | upper, | lower, | title, etc.
    addMatches(/(?<=(?:\$[a-zA-Z0-9_.]+(?:\([^)]*\))?|\)|\])\s*\|\s*)([a-zA-Z0-9_]+)\b/g, "function");

    // 7. Curator placeholders: {curator}, {curator2}, etc.
    addMatches(/\{curator\d*\}/gi, "curator");
    // 7.1 Shuffle & Sequential syntax: {shuffle:...}, {seq:...}, {cycle:...}
    addMatches(/\{(?:shuffle|seq|cycle):[^}]+\}/gi, "shuffle");
    // 7.2 Numerical Ranges: {range:...}, {rand:...}
    addMatches(/\{(?:range|rand):[^}]+\}/gi, "choice");
    // 11. Wildcards: __name__ or __all$$name__ or __folder/name__
    addMatches(/__(?:(?:\d+(?:-\d+)?|all|\*)\$\$)?([a-zA-Z0-9_\-/]+)__/g, "wildcard");
    // 12. Attention Weights: (tag:1.3)
    addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

    // 13. Rainbow & Matching Parentheses + Unclosed Warning
    const RAINBOW_PAREN_COLORS = ["#38bdf8", "#c084fc", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];
    const isExcluded = (pos) => intervals.some(iv => pos >= iv.start && pos < iv.end);
    const pStack = [];

    for (let i = 0; i < text.length; i++) {
        if (isExcluded(i)) continue;
        const ch = text[i];
        if (ch === "(") {
            pStack.push({ index: i, depth: pStack.length });
        } else if (ch === ")") {
            if (pStack.length > 0) {
                const open = pStack.pop();
                const color = RAINBOW_PAREN_COLORS[open.depth % RAINBOW_PAREN_COLORS.length];
                if (!isExcluded(open.index) && !isExcluded(i)) {
                    intervals.push({ start: open.index, end: open.index + 1, type: "rainbow_paren", color });
                    intervals.push({ start: i, end: i + 1, type: "rainbow_paren", color });
                }
            } else if (!isExcluded(i)) {
                intervals.push({ start: i, end: i + 1, type: "unmatched_paren" });
            }
        }
    }

    while (pStack.length > 0) {
        const unclosed = pStack.pop();
        if (!isExcluded(unclosed.index)) {
            intervals.push({ start: unclosed.index, end: unclosed.index + 1, type: "unclosed_paren" });
        }
    }

    intervals.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
    });

    let html = "";
    let cursor = 0;

    for (const iv of intervals) {
        if (iv.start < cursor) {
            continue;
        }
        if (iv.start > cursor) {
            html += `<span style="color: ${theme.plain_text || '#e2e8f0'};">${escapeHtml(text.slice(cursor, iv.start))}</span>`;
        }
        const tokenText = escapeHtml(text.slice(iv.start, iv.end));
        if (iv.type === "section_header") {
            html += `<span class="modusflow-section-banner">${tokenText}</span>`;
        } else if (iv.type === "rainbow_paren") {
            html += `<span style="color: ${iv.color}; font-weight: bold;">${tokenText}</span>`;
        } else if (iv.type === "unclosed_paren" || iv.type === "unmatched_paren") {
            html += `<span style="background: rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 2px; text-decoration: underline wavy #ef4444; font-weight: bold;" title="${iv.type === 'unclosed_paren' ? 'Unclosed opening parenthesis!' : 'Unmatched closing parenthesis!'}">${tokenText}</span>`;
        } else if (iv.type === "hex_color") {
            const rawHex = text.slice(iv.start, iv.end);
            html += `<span class="modusflow-hex-pill" data-hex="${rawHex}" style="color: ${rawHex}; font-weight: bold; background: ${rawHex}33; text-decoration: underline dotted ${rawHex};" title="Hex Color: ${rawHex}">${tokenText}</span>`;
        } else if (iv.type === "weight") {
            const raw = text.slice(iv.start, iv.end);
            const wMatch = raw.match(/:(-?\d+(?:\.\d+)?)\)$/);
            const w = wMatch ? parseFloat(wMatch[1]) : 1.0;
            const baseColor = theme.weight || "#fde047";
            let extraStyle = "";
            let title = `Weight: ${w.toFixed(2)}`;
            if (w > 1.0) {
                const glowSpread = Math.min(12, Math.round((w - 1.0) * 10));
                const glowAlpha = Math.min(0.9, 0.25 + (w - 1.0) * 0.45);
                const bgAlpha = Math.min(0.35, (w - 1.0) * 0.22);
                extraStyle = `font-weight: bold; text-shadow: 0 0 ${glowSpread}px rgba(251, 191, 36, ${glowAlpha}); background: rgba(245, 158, 11, ${bgAlpha});`;
                if (w > 1.6) title += " ⚠️ High attention weight (> 1.6)";
            } else if (w < 1.0 && w >= 0) {
                const opacity = Math.max(0.4, w * 0.9);
                extraStyle = `opacity: ${opacity}; filter: saturate(0.65);`;
                title += " (De-emphasized)";
            }
            html += `<span class="modusflow-weight-token" data-weight="${w}" style="color: ${baseColor}; ${extraStyle}" title="${title}">${tokenText}</span>`;
        } else if (iv.type === "case_statement") {
            const keywordColor = theme.keyword || theme.choice || "#cba6f7";
            const varColor = theme.variable || "#38bdf8";
            let innerHtml = tokenText;
            innerHtml = innerHtml.replace(/^(\{)(case\b)/i, (m, b, kw) => `${b}<span style="color: ${keywordColor}; font-weight: bold;">${kw}</span>`);
            innerHtml = innerHtml.replace(/(\$[a-zA-Z0-9_]+)/g, `<span style="color: ${varColor}; font-weight: 600;">$1</span>`);
            innerHtml = innerHtml.replace(/(=&gt;|=>)/g, `<span style="color: ${keywordColor}; font-weight: bold;">$1</span>`);
            html += `<span style="color: ${theme.choice || '#c084fc'}; font-weight: 500;" title="CASE Statement: ${tokenText}">${innerHtml}</span>`;
        } else if (iv.type === "ternary") {
            const keywordColor = theme.keyword || theme.choice || "#cba6f7";
            const varColor = theme.variable || "#38bdf8";
            let innerHtml = tokenText;
            innerHtml = innerHtml.replace(/(\$[a-zA-Z0-9_]+)/g, `<span style="color: ${varColor}; font-weight: 600;">$1</span>`);
            innerHtml = innerHtml.replace(/(\bin\b)/g, `<span style="color: ${keywordColor}; font-weight: bold;">$1</span>`);
            html += `<span style="color: ${theme.choice || '#c084fc'}; font-weight: 500;" title="Ternary Conditional: ${tokenText}">${innerHtml}</span>`;
        } else if (iv.type === "keyword") {
            const color = theme.keyword || theme.choice || "#cba6f7";
            html += `<span style="color: ${color}; font-weight: bold;" title="Keyword: ${tokenText}">${tokenText}</span>`;
        } else if (iv.type === "function") {
            const color = theme.function || theme.variable || "#818cf8";
            html += `<span style="color: ${color}; font-weight: 600;" title="Function: ${tokenText}">${tokenText}</span>`;
        } else if (iv.type === "inline_neg") {
            html += `<span style="color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px dashed rgba(248, 113, 113, 0.4); border-radius: 4px; padding: 0 4px; font-weight: 500;" title="Inline Negative Injection">${tokenText}</span>`;
        } else if (iv.type === "macro") {
            const color = theme.wildcard || theme.variable || "#38bdf8";
            html += `<span style="color: ${color}; font-weight: bold; background: rgba(56, 189, 248, 0.12); border-radius: 3px; padding: 0 2px;" title="Macro: ${tokenText}">${tokenText}</span>`;
        } else {
            const color = theme[iv.type] || theme.plain_text || "#e2e8f0";
            html += `<span style="color: ${color};">${tokenText}</span>`;
        }
        cursor = iv.end;
    }

    if (cursor < text.length) {
        html += `<span style="color: ${theme.plain_text || '#e2e8f0'};">${escapeHtml(text.slice(cursor))}</span>`;
    }

    if (text.endsWith("\n")) {
        html += "<br>&nbsp;";
    }

    return html;
}

function attachSyntaxHighlighter(widget, node) {
    if (!widget) return;
    injectSyntaxStyles();

    let attempts = 0;
    const bind = () => {
        const ta = widget.inputEl || widget.element;
        if (!ta || !ta.parentElement) {
            if (attempts++ < 30) requestAnimationFrame(bind);
            return;
        }
        if (ta._hasSyntaxHighlighter) return;
        ta._hasSyntaxHighlighter = true;

        const parent = ta.parentElement;
        const parentPos = window.getComputedStyle(parent).position;
        if (parentPos === "static") {
            parent.style.position = "relative";
        }

        const backdrop = document.createElement("div");
        backdrop.className = "modusflow-syntax-backdrop";
        parent.insertBefore(backdrop, ta);

        ta.classList.add("modusflow-syntax-ta");
        ta.style.position = "relative";
        ta.style.zIndex = "1";
        ta.style.fontFamily = MONOSPACE_FONT;
        ta.style.fontSize = "13px";
        ta.style.lineHeight = "1.4";
        ta.style.tabSize = "4";

        function syncGeometry() {
            if (!ta || !backdrop) return;
            backdrop.style.top = ta.offsetTop + "px";
            backdrop.style.left = ta.offsetLeft + "px";
            backdrop.style.width = ta.offsetWidth + "px";
            backdrop.style.height = ta.offsetHeight + "px";
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;

            const cs = window.getComputedStyle(ta);
            backdrop.style.fontFamily = MONOSPACE_FONT;
            backdrop.style.fontSize = cs.fontSize || "13px";
            backdrop.style.lineHeight = cs.lineHeight || "1.4";
            backdrop.style.padding = cs.padding;
            backdrop.style.border = cs.border;
            backdrop.style.borderColor = "transparent";
            backdrop.style.borderStyle = cs.borderStyle;
            backdrop.style.borderWidth = cs.borderWidth;
            backdrop.style.borderRadius = cs.borderRadius;
            backdrop.style.boxSizing = cs.boxSizing || "border-box";
            backdrop.style.letterSpacing = cs.letterSpacing;
            backdrop.style.tabSize = "4";
        }

        const listBadge = document.createElement("div");
        listBadge.className = "modusflow-token-badge";
        listBadge.title = "Active items / total lines in wildcard list";
        parent.appendChild(listBadge);

        function render() {
            const stats = estimateListStats(ta.value || "");
            if (stats.totalLines > 0 && (ta.value || "").trim().length > 0) {
                listBadge.style.display = "block";
                listBadge.textContent = `${stats.activeItems} item${stats.activeItems === 1 ? '' : 's'}` +
                    (stats.activeItems !== stats.totalLines ? ` (${stats.totalLines} lines)` : "");
            } else {
                listBadge.style.display = "none";
            }

            const currentThemeName = (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_syntax_theme")) ||
                                    "Modus Neon (Default)";

            if (currentThemeName === "Off (Plain Text)") {
                ta.style.color = "";
                ta.style.background = "";
                ta.style.caretColor = "";
                backdrop.style.display = "none";
                return;
            }

            const theme = getThemeByName(currentThemeName);
            backdrop.style.display = "block";
            ta.style.color = "transparent";
            ta.style.background = "transparent";
            ta.style.caretColor = theme.caret_color || "#ffffff";
            backdrop.style.backgroundColor = theme.bg_color || "#181825";
            backdrop.style.color = theme.plain_text || "#e2e8f0";

            backdrop.innerHTML = tokenizeAndHighlight(ta.value || "", theme);
            syncGeometry();
        }

        widget._updateSyntaxHighlight = render;
        widget._applyTheme = render;

        ta.addEventListener("input", render);
        ta.addEventListener("scroll", () => {
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        }, { passive: true });
        ta.addEventListener("focus", syncGeometry);
        ta.addEventListener("keyup", syncGeometry);
        ta.addEventListener("click", syncGeometry);

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                syncGeometry();
            });
            ro.observe(ta);
        }

        render();
    };

    bind();
}

// ── Comment Keyboard Shortcuts (Ctrl+/, Ctrl+Shift+/) ────────────────────────
function attachCommentShortcuts(widget) {
    if (!widget) return;
    const bindEl = (ta) => {
        if (!ta || ta._hasCommentHandler) return;
        ta._hasCommentHandler = true;

        ta.addEventListener("keydown", (e) => {
            const isMac = navigator.platform && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            // Toggle Line Comment: Ctrl+/ or Cmd+/
            if (ctrlOrCmd && !e.shiftKey && !e.altKey && (e.key === "/" || e.code === "Slash")) {
                e.preventDefault();
                e.stopPropagation();

                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const text = ta.value;

                const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                let lineEnd = text.indexOf("\n", end);
                if (lineEnd === -1) lineEnd = text.length;

                const selectedBlock = text.slice(lineStart, lineEnd);
                const lines = selectedBlock.split("\n");

                const nonBlankLines = lines.filter(l => l.trim().length > 0);
                const allCommented = nonBlankLines.length > 0 && nonBlankLines.every(l => {
                    const t = l.trim();
                    return t.startsWith("#") || t.startsWith("//");
                });

                let newLines;
                if (allCommented) {
                    newLines = lines.map(l => l.replace(/^(\s*)(?:#\s?|\/\/\s?)/, "$1"));
                } else {
                    newLines = lines.map(l => l.length > 0 ? `# ${l}` : l);
                }

                const newBlock = newLines.join("\n");
                ta.setRangeText(newBlock, lineStart, lineEnd, "select");
                widget.value = ta.value;
                widget._updateSyntaxHighlight?.();
            }
        });
    };

    let attempts = 0;
    const poll = () => {
        const ta = widget.inputEl || widget.element;
        if (ta) {
            bindEl(ta);
        } else if (attempts++ < 30) {
            requestAnimationFrame(poll);
        }
    };
    poll();
}

// ── Autocomplete System: Wildcards, LoRAs, Variables ──────────────────────────
let _cachedWildcards = null;
let _cachedLoras = null;
let _fetchingWildcardsPromise = null;
let _fetchingLorasPromise = null;

function fetchWildcardList(force = false) {
    if (_cachedWildcards && !force) return Promise.resolve(_cachedWildcards);
    if (_fetchingWildcardsPromise && !force) return _fetchingWildcardsPromise;
    _fetchingWildcardsPromise = fetch("/modusflow/wildcards/list")
        .then(r => r.json())
        .then(data => {
            _cachedWildcards = (data.success && Array.isArray(data.data)) ? data.data : [];
            return _cachedWildcards;
        })
        .catch(err => {
            console.debug("[ModusFlow ListCurator] Wildcard fetch:", err.message);
            return _cachedWildcards || [];
        })
        .finally(() => {
            _fetchingWildcardsPromise = null;
        });
    return _fetchingWildcardsPromise;
}

function fetchLoraList(force = false) {
    if (_cachedLoras && !force) return Promise.resolve(_cachedLoras);
    if (_fetchingLorasPromise && !force) return _fetchingLorasPromise;
    _fetchingLorasPromise = fetch("/modusflow/get_loras")
        .then(r => r.json())
        .then(data => {
            if (data.success && Array.isArray(data.data)) {
                _cachedLoras = data.data.map(name => name.replace(/\.(safetensors|pt|ckpt|bin)$/i, "").replace(/\\/g, "/"));
            } else {
                _cachedLoras = [];
            }
            return _cachedLoras;
        })
        .catch(err => {
            console.debug("[ModusFlow ListCurator] LoRA fetch:", err.message);
            return _cachedLoras || [];
        })
        .finally(() => {
            _fetchingLorasPromise = null;
        });
    return _fetchingLorasPromise;
}

const SYSTEM_VARS = [
    { name: "date", desc: "Current date (YYYY-MM-DD)" },
    { name: "time", desc: "Current time (HH-MM-SS)" },
    { name: "seed", desc: "Dynamic generation seed" },
    { name: "width", desc: "Latent / Image width" },
    { name: "height", desc: "Latent / Image height" },
    { name: "model", desc: "Active checkpoint model" },
    { name: "steps", desc: "Sampling steps" },
    { name: "cfg", desc: "CFG scale" }
];

const CURATOR_TAGS = [
    { name: "curator", desc: "Primary curator list item" },
    { name: "curator2", desc: "Curator item slot 2" },
    { name: "curator3", desc: "Curator item slot 3" },
    { name: "curator4", desc: "Curator item slot 4" },
    { name: "curator5", desc: "Curator item slot 5" },
    { name: "curator6", desc: "Curator item slot 6" }
];

function detectTrigger(text, cursor) {
    if (cursor <= 0 || !text) return null;
    const sub = text.slice(0, cursor);

    // 1. Wildcards: __name
    const wcMatch = sub.match(/(?:^|[\s,.:;!?([{\"])(__([a-zA-Z0-9_\/-]*))$/);
    if (wcMatch) {
        return {
            type: "wildcard",
            fullToken: wcMatch[1],
            query: wcMatch[2] || "",
            replaceStart: cursor - wcMatch[1].length,
            replaceEnd: cursor
        };
    }

    // 2. Variables: $name
    const varMatch = sub.match(/(?:^|[^\$a-zA-Z0-9_])(\$([a-zA-Z0-9_]*))$/);
    if (varMatch) {
        return {
            type: "variable",
            fullToken: varMatch[1],
            query: varMatch[2] || "",
            replaceStart: cursor - varMatch[1].length,
            replaceEnd: cursor
        };
    }

    // 3. System variables: %name
    const sysMatch = sub.match(/(?:^|[\s,.:;!?([{\"])(%([a-zA-Z0-9_]*))$/);
    if (sysMatch) {
        return {
            type: "system",
            fullToken: sysMatch[1],
            query: sysMatch[2] || "",
            replaceStart: cursor - sysMatch[1].length,
            replaceEnd: cursor
        };
    }

    // 4. Curator placeholders: {c or {curator
    const curMatch = sub.match(/(?:^|[\s,.:;!?([{\"])((\{c[a-zA-Z0-9_]*))$/i);
    if (curMatch) {
        return {
            type: "curator",
            fullToken: curMatch[1],
            query: curMatch[1].slice(1),
            replaceStart: cursor - curMatch[1].length,
            replaceEnd: cursor
        };
    }

    // 5. LoRA tag: <lora: or <l
    const loraMatch = sub.match(/(?:^|[\s,.:;!?([{\"])(<(?:lora:)?([a-zA-Z0-9_.\/\\-]*))$/i);
    if (loraMatch) {
        let q = (loraMatch[2] || "").replace(/\\/g, "/");
        if (/^l(ora)?$/i.test(q) && !loraMatch[1].includes(":")) {
            q = "";
        }
        return {
            type: "lora",
            fullToken: loraMatch[1],
            query: q,
            replaceStart: cursor - loraMatch[1].length,
            replaceEnd: cursor
        };
    }

    return null;
}

function normalizePathSeparatorsInTags(text) {
    if (!text || typeof text !== "string") return text;
    // 1. Normalize <lora:path\to\model:weight> -> <lora:path/to/model:weight>
    let result = text.replace(/(<lora:[^>\r\n]+>)/gi, (match) => {
        return match.replace(/\\/g, "/");
    });
    // 2. Normalize @import "path\to\file" or @import 'path\to\file' or @import("path\to\file")
    result = result.replace(/(@import\s*(?:\(\s*)?["'])([^"'\r\n]+)(["']\s*\)?)/gi, (match, prefix, pathStr, suffix) => {
        return prefix + pathStr.replace(/\\/g, "/") + suffix;
    });
    return result;
}

function formatReplacement(item, type) {
    switch (type) {
        case "wildcard":
            return `__${item.name}__ `;
        case "variable":
            return `$${item.name} `;
        case "system":
            return `%${item.name}% `;
        case "curator":
            return `{${item.name}} `;
        case "lora":
            return `<lora:${item.name.replace(/\\/g, "/")}:1.0> `;
        default:
            return `${item.name} `;
    }
}

function getSuggestions(trigger) {
    const q = (trigger.query || "").toLowerCase();

    if (trigger.type === "wildcard") {
        const list = _cachedWildcards || [];
        const filtered = list.filter(w => !q || w.toLowerCase().includes(q));
        filtered.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(q);
            const bStarts = b.toLowerCase().startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });
        return filtered.map(name => ({
            name,
            badge: "LIST",
            badgeClass: "badge-wildcard",
            desc: "Wildcard list"
        }));
    }

    if (trigger.type === "lora") {
        const list = _cachedLoras || [];
        const filtered = list.filter(l => !q || l.toLowerCase().includes(q));
        filtered.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(q);
            const bStarts = b.toLowerCase().startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });
        return filtered.map(name => ({
            name,
            badge: "LORA",
            badgeClass: "badge-lora",
            desc: "LoRA model"
        }));
    }

    if (trigger.type === "system") {
        return SYSTEM_VARS
            .filter(v => !q || v.name.toLowerCase().includes(q))
            .map(v => ({
                name: v.name,
                badge: "SYS",
                badgeClass: "badge-system",
                desc: v.desc
            }));
    }

    if (trigger.type === "curator") {
        return CURATOR_TAGS
            .filter(c => !q || c.name.toLowerCase().includes(q))
            .map(c => ({
                name: c.name,
                badge: "CUR",
                badgeClass: "badge-curator",
                desc: c.desc
            }));
    }

    return [];
}

function getCaretCoordinates(ta, position) {
    const div = document.createElement("div");
    const cs = window.getComputedStyle(ta);
    const props = [
        "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
        "fontSizeAdjust", "lineHeight", "fontFamily", "textAlign", "textTransform",
        "textIndent", "textDecoration", "letterSpacing", "wordSpacing", "tabSize"
    ];
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.wordWrap = "break-word";
    div.style.top = "0";
    div.style.left = "-9999px";
    for (const p of props) {
        div.style[p] = cs[p];
    }
    div.style.width = (ta.clientWidth || 300) + "px";
    div.textContent = ta.value.substring(0, position);
    const span = document.createElement("span");
    span.textContent = ta.value.substring(position) || ".";
    div.appendChild(span);
    document.body.appendChild(div);
    const top = span.offsetTop - ta.scrollTop + parseInt(cs.borderTopWidth || "0", 10);
    const left = span.offsetLeft - ta.scrollLeft + parseInt(cs.borderLeftWidth || "0", 10);
    const lineHeight = parseInt(cs.lineHeight, 10) || 18;
    document.body.removeChild(div);
    return {
        top: top + ta.offsetTop,
        left: left + ta.offsetLeft,
        lineHeight
    };
}

function attachAutocomplete(widget, node) {
    if (!widget) return;
    injectSyntaxStyles();

    let attempts = 0;
    const bind = () => {
        const ta = widget.inputEl || widget.element;
        if (!ta || !ta.parentElement) {
            if (attempts++ < 30) requestAnimationFrame(bind);
            return;
        }
        if (ta._hasAutocomplete) return;
        ta._hasAutocomplete = true;

        const parent = ta.parentElement;
        const parentPos = window.getComputedStyle(parent).position;
        if (parentPos === "static") {
            parent.style.position = "relative";
        }

        const menu = document.createElement("div");
        menu.className = "modusflow-autocomplete-menu";
        parent.appendChild(menu);

        let activeItems = [];
        let selectedIndex = 0;
        let currentTrigger = null;

        function closeMenu() {
            menu.style.display = "none";
            menu.innerHTML = "";
            activeItems = [];
            selectedIndex = 0;
            currentTrigger = null;
        }

        function renderMenu() {
            menu.innerHTML = "";
            if (activeItems.length === 0) {
                closeMenu();
                return;
            }

            const maxVisible = 25;
            const displayItems = activeItems.slice(0, maxVisible);

            displayItems.forEach((item, idx) => {
                const row = document.createElement("div");
                row.className = "modusflow-autocomplete-item" + (idx === selectedIndex ? " selected" : "");

                const badge = document.createElement("span");
                badge.className = "modusflow-ac-badge " + item.badgeClass;
                badge.textContent = item.badge;

                const label = document.createElement("span");
                label.className = "modusflow-ac-label";
                label.textContent = item.name;

                row.appendChild(badge);
                row.appendChild(label);

                if (item.desc) {
                    const desc = document.createElement("span");
                    desc.className = "modusflow-ac-hint";
                    desc.textContent = item.desc;
                    row.appendChild(desc);
                }

                row.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commitItem(item);
                });

                row.addEventListener("mouseenter", () => {
                    selectedIndex = idx;
                    updateSelectionHighlight();
                });

                menu.appendChild(row);
            });

            if (activeItems.length > maxVisible) {
                const more = document.createElement("div");
                more.className = "modusflow-ac-empty";
                more.textContent = `+${activeItems.length - maxVisible} more (type to filter)...`;
                menu.appendChild(more);
            }

            positionMenu();
            menu.style.display = "block";
            updateSelectionHighlight();
        }

        function updateSelectionHighlight() {
            const rows = menu.querySelectorAll(".modusflow-autocomplete-item");
            rows.forEach((r, idx) => {
                if (idx === selectedIndex) {
                    r.classList.add("selected");
                    r.scrollIntoView({ block: "nearest" });
                } else {
                    r.classList.remove("selected");
                }
            });
        }

        function positionMenu() {
            if (!currentTrigger) return;
            const coords = getCaretCoordinates(ta, currentTrigger.replaceStart);
            const menuWidth = 320;
            const parentW = parent.clientWidth || 480;
            const parentH = parent.clientHeight || 300;

            let left = coords.left;
            if (left + menuWidth > parentW - 10) {
                left = Math.max(8, parentW - menuWidth - 10);
            }
            if (left < 4) left = 4;

            let top = coords.top + coords.lineHeight + 4;
            const estMenuH = Math.min(220, activeItems.length * 32 + 20);
            if (top + estMenuH > parentH && coords.top - estMenuH > 4) {
                top = coords.top - estMenuH - 4;
            }

            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
            menu.style.width = `${menuWidth}px`;
        }

        function commitItem(item) {
            if (!currentTrigger) return;
            const replacement = formatReplacement(item, currentTrigger.type);
            ta.setRangeText(replacement, currentTrigger.replaceStart, currentTrigger.replaceEnd, "end");
            widget.value = ta.value;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            closeMenu();
        }

        function checkTriggerAndSuggest() {
            const trigger = detectTrigger(ta.value, ta.selectionStart);
            if (!trigger) {
                closeMenu();
                return;
            }

            if (trigger.type === "wildcard" && !_cachedWildcards) {
                fetchWildcardList().then(() => {
                    if (document.activeElement === ta) {
                        checkTriggerAndSuggest();
                    }
                });
                return;
            }
            if (trigger.type === "lora" && !_cachedLoras) {
                fetchLoraList().then(() => {
                    if (document.activeElement === ta) {
                        checkTriggerAndSuggest();
                    }
                });
                return;
            }

            currentTrigger = trigger;
            activeItems = getSuggestions(trigger);
            selectedIndex = 0;
            if (activeItems.length > 0) {
                renderMenu();
            } else {
                closeMenu();
            }
        }

        ta.addEventListener("input", checkTriggerAndSuggest);

        ta.addEventListener("paste", (e) => {
            const pasted = (e.clipboardData || window.clipboardData)?.getData("text");
            if (pasted && (/<lora:[^>\r\n]*\\/i.test(pasted) || /@import[^"'\r\n]*["'][^"'\r\n]*\\/i.test(pasted))) {
                e.preventDefault();
                const normalized = normalizePathSeparatorsInTags(pasted);
                if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
                    document.execCommand("insertText", false, normalized);
                } else {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    ta.setRangeText(normalized, start, end, "end");
                    widget.value = ta.value;
                    ta.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }
        });

        ta.addEventListener("blur", () => {
            const val = ta.value;
            const normalized = normalizePathSeparatorsInTags(val);
            if (normalized !== val) {
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                ta.value = normalized;
                widget.value = normalized;
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                try { ta.setSelectionRange(start, end); } catch (_) {}
            }
        });

        ta.addEventListener("keydown", (e) => {
            if (menu.style.display !== "none" && activeItems.length > 0) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedIndex = (selectedIndex + 1) % Math.min(activeItems.length, 25);
                    updateSelectionHighlight();
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedIndex = (selectedIndex - 1 + Math.min(activeItems.length, 25)) % Math.min(activeItems.length, 25);
                    updateSelectionHighlight();
                    return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitItem(activeItems[selectedIndex]);
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenu();
                    return;
                }
            }
        });

        ta.addEventListener("focus", () => {
            fetchWildcardList(true);
            fetchLoraList(true);
        });

        ta.addEventListener("blur", () => {
            setTimeout(closeMenu, 180);
        });

        ta.addEventListener("scroll", () => {
            if (menu.style.display !== "none") {
                positionMenu();
            }
        }, { passive: true });

        document.addEventListener("mousedown", (e) => {
            if (menu.style.display !== "none" && !menu.contains(e.target) && e.target !== ta) {
                closeMenu();
            }
        });
    };

    bind();
}

app.registerExtension({
    name: "modusflow.ListCurator",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowListCurator") {

            fetchThemes();
            fetchWildcardList();
            fetchLoraList();

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                const listWidget = node.widgets?.find(w => w.name === "wildcard_list");
                const entriesWidget = node.widgets?.find(w => w.name === "custom_entries");

                if (entriesWidget) {
                    entriesWidget.label = "List Entries (1 per line)";
                    attachCommentShortcuts(entriesWidget);
                    attachSyntaxHighlighter(entriesWidget, node);
                    attachAutocomplete(entriesWidget, node);
                }

                // ── Helper: Set textarea value cleanly and trigger syntax highlight ──
                function setTextareaValue(widget, value) {
                    if (!widget) return;
                    widget.value = value;
                    if (widget.inputEl) widget.inputEl.value = value;
                    if (widget.element) widget.element.value = value;
                    widget._updateSyntaxHighlight?.();
                    app.graph.setDirtyCanvas(true, true);
                }

                // ── Load selected wildcard file into textarea ──────────────────────
                function loadSelectedWildcard(filename) {
                    if (!filename || filename === "--no wildcards found--") return;
                    fetch("/modusflow/wildcards/load", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && entriesWidget) {
                            setTextareaValue(entriesWidget, data.data || "");
                        }
                    })
                    .catch(err => console.error("[ModusFlow ListCurator] Load error:", err));
                }

                // ── Refresh dropdown options from server ───────────────────────────
                function refreshWildcards(selectFilename = null) {
                    if (!listWidget) return;
                    fetchWildcardList(true);
                    fetchLoraList(true);
                    fetch("/modusflow/wildcards/list")
                        .then(res => res.json())
                        .then(data => {
                            if (!data.success) return;
                            const files = data.data || [];
                            listWidget.options.values = files.length ? files : ["--no wildcards found--"];
                            if (selectFilename && listWidget.options.values.includes(selectFilename)) {
                                listWidget.value = selectFilename;
                            } else if (!listWidget.options.values.includes(listWidget.value)) {
                                listWidget.value = listWidget.options.values[0];
                            }
                            if (listWidget.value && listWidget.value !== "--no wildcards found--") {
                                loadSelectedWildcard(listWidget.value);
                            }
                            app.graph.setDirtyCanvas(true, true);
                        })
                        .catch(err => console.error("[ModusFlow ListCurator] Refresh error:", err));
                }

                // ── Dropdown selection callback ────────────────────────────────────
                if (listWidget) {
                    const origCallback = listWidget.callback;
                    listWidget.callback = function (val) {
                        if (origCallback) origCallback.apply(this, arguments);
                        loadSelectedWildcard(val);
                    };
                }

                // ── Save as a new list ─────────────────────────────────────────────
                function saveAsNewList() {
                    if (!entriesWidget) return;
                    let filename = prompt("Enter new list name (e.g. hair_colors):");
                    if (!filename || !filename.trim()) return;

                    filename = filename.trim();
                    // Strip leading/trailing underscores if entered out of habit (e.g. __hair_colors__ -> hair_colors)
                    if (filename.startsWith("__") && filename.endsWith("__") && filename.length > 4) {
                        filename = filename.slice(2, -2).trim();
                    }
                    // Strip .txt if user entered it
                    if (filename.toLowerCase().endsWith(".txt")) {
                        filename = filename.slice(0, -4).trim();
                    }
                    if (!filename) return;

                    fetch("/modusflow/wildcards/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            filename: filename,
                            content: entriesWidget.value || ""
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert("Saved: " + data.filename + ".txt\n(Reference in prompts as __" + data.filename + "__)");
                            refreshWildcards(data.filename);
                        } else {
                            alert("Save failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Save error: " + err.message));
                }

                // ── Update the currently selected list ─────────────────────────────
                function updateSelectedList() {
                    if (!listWidget || !entriesWidget) return;
                    const current = listWidget.value;
                    if (!current || current === "--no wildcards found--") {
                        alert("Please select a list from the dropdown or click 'Save As New' first.");
                        return;
                    }

                    if (!confirm('Overwrite "' + current + '.txt" with the current lines?')) return;

                    fetch("/modusflow/wildcards/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            filename: current,
                            content: entriesWidget.value || ""
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert('"' + current + '.txt" updated successfully.');
                        } else {
                            alert("Update failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Update error: " + err.message));
                }

                // ── Delete the currently selected list ─────────────────────────────
                function deleteSelectedList() {
                    if (!listWidget) return;
                    const current = listWidget.value;
                    if (!current || current === "--no wildcards found--") {
                        alert("No list selected to delete.");
                        return;
                    }

                    if (!confirm('Are you sure you want to permanently delete "' + current + '.txt"?')) return;

                    fetch("/modusflow/wildcards/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: current })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert('Deleted: "' + current + '.txt"');
                            setTextareaValue(entriesWidget, "");
                            refreshWildcards();
                        } else {
                            alert("Delete failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Delete error: " + err.message));
                }

                // ── Action Buttons ─────────────────────────────────────────────────
                node.addWidget("button", "💾 Save As New", null, () => saveAsNewList());
                node.addWidget("button", "✏️ Update Selected", null, () => updateSelectedList());
                node.addWidget("button", "🗑️ Delete List", null, () => deleteSelectedList());
                node.addWidget("button", "🔄 Refresh Lists", null, () => refreshWildcards());

                node.size = [420, 560];
                node.resizable = true;

                // Initial auto-load if dropdown has a selection and textarea is empty
                requestAnimationFrame(() => {
                    if (listWidget && listWidget.value && (!entriesWidget || !entriesWidget.value)) {
                        loadSelectedWildcard(listWidget.value);
                    }
                });

                return r;
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function () {
                if (onConfigure) onConfigure.apply(this, arguments);
                const entriesWidget = this.widgets?.find(w => w.name === "custom_entries");
                if (entriesWidget) {
                    attachCommentShortcuts(entriesWidget);
                    attachSyntaxHighlighter(entriesWidget, this);
                    attachAutocomplete(entriesWidget, this);
                }
            };

            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function () {
                const r = onResize ? onResize.apply(this, arguments) : undefined;
                const entriesWidget = this.widgets?.find(w => w.name === "custom_entries");
                entriesWidget?._updateSyntaxHighlight?.();
                return r;
            };
        }
    }
});
