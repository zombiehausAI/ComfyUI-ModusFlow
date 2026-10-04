import { app } from "../../scripts/app.js";

// ModusFlow Text Editor — positive/negative prompts with category-filtered save/load & syntax highlighting

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
        plain_text: "#ffffff",
        caret_color: "#ffffff",
        bg_color: "#09090b"
    }
};

let THEMES = { ...DEFAULT_THEMES };
const MONOSPACE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function getThemeOptions() {
    const names = Object.keys(THEMES);
    if (!names.includes("Off (Plain Text)")) {
        names.push("Off (Plain Text)");
    }
    return names;
}

function getThemeByName(name) {
    if (THEMES[name]) return THEMES[name];
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
                if (app.graph && app.graph._nodes) {
                    for (const n of app.graph._nodes) {
                        if (n.type === "ModusFlowTextEditor") {
                            const tw = n.widgets?.find(w => w.name === "syntax_theme");
                            if (tw) tw.options.values = getThemeOptions();
                            const pw = n.widgets?.find(w => w.name === "positive");
                            const nw = n.widgets?.find(w => w.name === "negative");
                            pw?._updateSyntaxHighlight?.();
                            nw?._updateSyntaxHighlight?.();
                        }
                    }
                }
            }
        })
        .catch(err => console.debug("[ModusFlow] Theme fetch:", err.message));
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

function estimateTokens(text) {
    if (!text) return { words: 0, tokens: 0, chunks: 0 };
    const clean = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(?:^|\n)\s*(?:#|\/\/)[^\n]*/g, "")
        .trim();
    if (!clean) return { words: 0, tokens: 0, chunks: 0 };

    const words = clean.split(/\s+/).filter(Boolean);
    const punctuation = (clean.match(/[,.:;!?()\[\]{}]/g) || []).length;
    const tokens = Math.max(words.length, Math.round(words.length * 1.25 + punctuation * 0.5));
    const chunks = Math.ceil(tokens / 75);
    return { words: words.length, tokens, chunks };
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

    // Priority order of syntax tokens:
    // 1. Comments: /* ... */ or // ... or # ...
    addMatches(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|#[^\r\n]*/g, "comment");
    // 2. LoRA tags: <lora:...>
    addMatches(/<lora:[^>\r\n]+>/gi, "lora");
    // 3. Prompt Variables: $name = value; or $name
    addMatches(/\$[a-zA-Z0-9_-]+(?:\s*=\s*[^;\r\n]+;?)?/g, "variable");
    // 4. Curator placeholders: {curator}, {curator2}, etc.
    addMatches(/\{curator\d*\}/gi, "curator");
    // 5. Shuffle syntax: {shuffle:...}
    addMatches(/\{shuffle:[^}]+\}/gi, "shuffle");
    // 6. Pick-N & Ranges: {2$$...}, {1-3$$...}
    addMatches(/\{\s*\d+(?:-\d+)?\$\$[^}]+\}/g, "choice");
    // 7. Weighted Odds: {80::a|20::b}
    addMatches(/\{\s*\d+::[^}]+\}/g, "choice");
    // 8. Dynamic Choices: {a|b|c}
    addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");
    // 9. Wildcards: __name__ or __folder/name__
    addMatches(/__[a-zA-Z0-9_/-]+__/g, "wildcard");
    // 10. Attention Weights: (tag:1.3)
    addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

    intervals.sort((a, b) => a.start - b.start);

    let html = "";
    let cursor = 0;

    for (const iv of intervals) {
        if (iv.start > cursor) {
            html += escapeHtml(text.slice(cursor, iv.start));
        }
        const tokenText = escapeHtml(text.slice(iv.start, iv.end));
        const color = theme[iv.type] || theme.plain_text || "#e2e8f0";
        html += `<span style="color: ${color};">${tokenText}</span>`;
        cursor = iv.end;
    }

    if (cursor < text.length) {
        html += escapeHtml(text.slice(cursor));
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

        const tokenBadge = document.createElement("div");
        tokenBadge.className = "modusflow-token-badge";
        tokenBadge.title = "Estimated words / CLIP tokens (75-token chunks)";
        parent.appendChild(tokenBadge);

        function render() {
            const stats = estimateTokens(ta.value || "");
            if (stats.tokens > 0) {
                tokenBadge.style.display = "block";
                tokenBadge.textContent = `${stats.words}w · ~${stats.tokens} tok (${stats.chunks} chunk${stats.chunks > 1 ? 's' : ''})`;
                if (stats.tokens > 75) {
                    tokenBadge.classList.add("token-warning");
                } else {
                    tokenBadge.classList.remove("token-warning");
                }
            } else {
                tokenBadge.style.display = "none";
            }

            const currentThemeName = node._currentSyntaxTheme ||
                                    (node.properties && node.properties.syntax_theme) ||
                                    (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_syntax_theme")) ||
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

function setNodeTheme(node, themeName) {
    node._currentSyntaxTheme = themeName;
    node.properties = node.properties || {};
    node.properties["syntax_theme"] = themeName;
    try {
        localStorage.setItem("modusflow_syntax_theme", themeName);
    } catch (_) {}

    const theme = getThemeByName(themeName);
    const pw = node.widgets?.find(w => w.name === "positive");
    const nw = node.widgets?.find(w => w.name === "negative");
    pw?._applyTheme?.(theme);
    nw?._applyTheme?.(theme);
}

// ── Autocomplete System: Wildcards, Variables, Curator & LoRAs ───────────────
let _cachedWildcards = null;
let _cachedLoras = null;

function fetchWildcardList(force = false) {
    if (_cachedWildcards && !force) return Promise.resolve(_cachedWildcards);
    return fetch("/modusflow/wildcards/list")
        .then(r => r.json())
        .then(data => {
            if (data.success && Array.isArray(data.data)) {
                _cachedWildcards = data.data;
            } else {
                _cachedWildcards = [];
            }
            return _cachedWildcards;
        })
        .catch(err => {
            console.debug("[ModusFlow Autocomplete] Wildcard fetch:", err.message);
            return _cachedWildcards || [];
        });
}

function fetchLoraList(force = false) {
    if (_cachedLoras && !force) return Promise.resolve(_cachedLoras);
    return fetch("/modusflow/get_loras")
        .then(r => r.json())
        .then(data => {
            if (data.success && Array.isArray(data.data)) {
                _cachedLoras = data.data.map(name => name.replace(/\.(safetensors|pt|ckpt|bin)$/i, ""));
            } else {
                _cachedLoras = [];
            }
            return _cachedLoras;
        })
        .catch(err => {
            console.debug("[ModusFlow Autocomplete] LoRA fetch:", err.message);
            return _cachedLoras || [];
        });
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

const DEFAULT_VARIABLE_HINTS = [
    { name: "subject", desc: "Subject variable" },
    { name: "style", desc: "Style variable" },
    { name: "lighting", desc: "Lighting variable" },
    { name: "quality", desc: "Quality boost variable" },
    { name: "details", desc: "Details variable" },
    { name: "outfit", desc: "Apparel variable" }
];

function extractPromptVariables(node) {
    const vars = new Set();
    const pw = node?.widgets?.find(w => w.name === "positive");
    const nw = node?.widgets?.find(w => w.name === "negative");
    const fullText = ((pw?.value || "") + "\n" + (nw?.value || ""));

    const defRegex = /^\s*\$([a-zA-Z0-9_]+)\s*=/gm;
    let m;
    while ((m = defRegex.exec(fullText)) !== null) {
        vars.add(m[1]);
    }
    const refRegex = /\$([a-zA-Z0-9_]+)/g;
    while ((m = refRegex.exec(fullText)) !== null) {
        vars.add(m[1]);
    }
    return Array.from(vars).sort();
}

function detectTrigger(text, cursor) {
    if (cursor <= 0 || !text) return null;
    const sub = text.slice(0, cursor);

    // 1. Wildcards: __name (preceded by start of line, whitespace, or punctuation)
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

    // 2. Variables: $name (must not be preceded by $)
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
    const loraMatch = sub.match(/(?:^|[\s,.:;!?([{\"])(<(?:lora:)?([a-zA-Z0-9_.\/-]*))$/i);
    if (loraMatch) {
        return {
            type: "lora",
            fullToken: loraMatch[1],
            query: loraMatch[2] || "",
            replaceStart: cursor - loraMatch[1].length,
            replaceEnd: cursor
        };
    }

    return null;
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
            return `<lora:${item.name}:1.0> `;
        default:
            return `${item.name} `;
    }
}

function getSuggestions(trigger, node) {
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

    if (trigger.type === "variable") {
        const definedVars = extractPromptVariables(node);
        let items = [];
        if (definedVars.length > 0) {
            const filtered = definedVars.filter(v => !q || v.toLowerCase().includes(q));
            items = filtered.map(name => ({
                name,
                badge: "VAR",
                badgeClass: "badge-variable",
                desc: "Defined variable"
            }));
        }
        const defaults = DEFAULT_VARIABLE_HINTS.filter(d => !q || d.name.toLowerCase().includes(q));
        for (const def of defaults) {
            if (!items.some(it => it.name === def.name)) {
                items.push({
                    name: def.name,
                    badge: "VAR",
                    badgeClass: "badge-variable",
                    desc: def.desc
                });
            }
        }
        return items;
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
                fetchWildcardList().then(() => checkTriggerAndSuggest());
                return;
            }
            if (trigger.type === "lora" && !_cachedLoras) {
                fetchLoraList().then(() => checkTriggerAndSuggest());
                return;
            }

            currentTrigger = trigger;
            activeItems = getSuggestions(trigger, node);
            selectedIndex = 0;
            if (activeItems.length > 0) {
                renderMenu();
            } else {
                closeMenu();
            }
        }

        ta.addEventListener("input", checkTriggerAndSuggest);

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

// ── Negative Prompt Baseline Presets ─────────────────────────────────────────
const NEGATIVE_PRESETS = {
    "--select negative preset--": "",
    "SDXL Quality Standard": "ugly, deformed, bad anatomy, bad eyes, blurry, low quality, oversaturated, plastic, cartoon, watermark, signature",
    "Pony Score Baseline": "score_6, score_5, score_4, score_3, score_2, score_1, source_pony, source_furry, ugly, bad anatomy, blurry",
    "Photorealistic Clean": "cgi, 3d render, illustration, cartoon, anime, artificial, fake, plastic skin, oversaturated, watermark, signature, blurry, lowres, deformed",
    "Anime / 2D Quality": "photorealistic, realistic, 3d, realistic skin, bad anatomy, deformed, mutated, extra limbs, poorly drawn hands, missing fingers, lowres, blurry",
    "Flux / Chroma Minimal": "blurry, low quality, distortion"
};

// ── Prompt History / Session Snapshot (localStorage) ─────────────────────────
const HISTORY_KEY = "modusflow_prompt_history";
const MAX_HISTORY = 15;

function pushPromptHistory(node, label) {
    try {
        const pw = node.widgets?.find(w => w.name === "positive");
        const nw = node.widgets?.find(w => w.name === "negative");
        const pos = pw?.value || "";
        const neg = nw?.value || "";
        if (!pos.trim() && !neg.trim()) return;

        const raw = localStorage.getItem(HISTORY_KEY);
        let list = raw ? JSON.parse(raw) : [];
        if (list.length > 0 && list[0].positive === pos && list[0].negative === neg) {
            return;
        }
        const entry = {
            id: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            date: new Date().toLocaleDateString(),
            label: label || (pos.slice(0, 35) + (pos.length > 35 ? "..." : "")),
            positive: pos,
            negative: neg
        };
        list.unshift(entry);
        if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn("[ModusFlow TextEditor] History save error:", e);
    }
}

function showHistoryDialog(node) {
    let list = [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        list = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    if (!list.length) {
        alert("Prompt session history is currently empty.");
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 580px; max-height: 80vh; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #cdd6f4; font-family: sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa;">🕒 Prompt Session History</h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const listContainer = document.createElement("div");
    listContainer.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 8px; max-height: 420px;";

    list.forEach((item, index) => {
        const row = document.createElement("div");
        row.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.15s ease;";
        row.onmouseenter = () => row.style.borderColor = "#89b4fa";
        row.onmouseleave = () => row.style.borderColor = "#313244";

        const preview = item.positive ? item.positive.slice(0, 100) : "(empty positive)";
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a6adc8; margin-bottom: 4px;">
                <span style="font-weight: bold; color: #cba6f7;">#${index + 1} · ${item.label || "Snapshot"} (${item.time} - ${item.date})</span>
                <span>${item.positive.length} chars</span>
            </div>
            <div style="font-size: 12px; color: #cdd6f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${preview}
            </div>
        `;

        row.onclick = () => {
            if (confirm("Restore this prompt snapshot?")) {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                if (pw) {
                    pw.value = item.positive;
                    if (pw.inputEl) pw.inputEl.value = item.positive;
                    pw._updateSyntaxHighlight?.();
                }
                if (nw) {
                    nw.value = item.negative;
                    if (nw.inputEl) nw.inputEl.value = item.negative;
                    nw._updateSyntaxHighlight?.();
                }
                overlay.remove();
            }
        };
        listContainer.appendChild(row);
    });

    dialog.appendChild(listContainer);

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: space-between; margin-top: 8px;";
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear History";
    clearBtn.style.cssText = "background: #313244; color: #f38ba8; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer;";
    clearBtn.onclick = () => {
        if (confirm("Clear all prompt history?")) {
            localStorage.removeItem(HISTORY_KEY);
            overlay.remove();
        }
    };
    footer.appendChild(clearBtn);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── Prompt Prettifier & Deduplicator ─────────────────────────────────────────
function prettifyPromptText(text) {
    if (!text || typeof text !== "string") return "";
    const lines = text.split("\n");
    const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
            return line;
        }
        const rawTags = line.split(",");
        const seen = new Set();
        const uniqueTags = [];
        for (const raw of rawTags) {
            const tag = raw.trim();
            if (!tag) continue;
            const lower = tag.toLowerCase();
            if (!seen.has(lower)) {
                seen.add(lower);
                uniqueTags.push(tag);
            }
        }
        return uniqueTags.join(", ");
    });
    return newLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function prettifyNodePrompts(node) {
    const pw = node.widgets?.find(w => w.name === "positive");
    const nw = node.widgets?.find(w => w.name === "negative");
    let changed = false;
    if (pw && pw.value) {
        const cleaned = prettifyPromptText(pw.value);
        if (cleaned !== pw.value) {
            pw.value = cleaned;
            if (pw.inputEl) pw.inputEl.value = cleaned;
            pw._updateSyntaxHighlight?.();
            changed = true;
        }
    }
    if (nw && nw.value) {
        const cleaned = prettifyPromptText(nw.value);
        if (cleaned !== nw.value) {
            nw.value = cleaned;
            if (nw.inputEl) nw.inputEl.value = cleaned;
            nw._updateSyntaxHighlight?.();
            changed = true;
        }
    }
    if (changed) {
        pushPromptHistory(node, "Prettified / Deduplicated");
    }
}

// ── Negative Preset Application ──────────────────────────────────────────────
function applyNegativePreset(node, presetKey) {
    if (!presetKey || presetKey === "--select negative preset--") return;
    const nw = node.widgets?.find(w => w.name === "negative");
    const npWidget = node.widgets?.find(w => w.name === "negative_presets");
    const presetVal = NEGATIVE_PRESETS[presetKey];
    if (!presetVal || !nw) return;

    const current = (nw.value || "").trim();
    if (!current) {
        nw.value = presetVal;
        if (nw.inputEl) nw.inputEl.value = presetVal;
        nw._updateSyntaxHighlight?.();
    } else {
        if (confirm("Replace existing negative prompt with preset?\n\n(Click 'OK' to replace, or 'Cancel' to append)")) {
            nw.value = presetVal;
            if (nw.inputEl) nw.inputEl.value = presetVal;
            nw._updateSyntaxHighlight?.();
        } else {
            const combined = `${current}, ${presetVal}`;
            nw.value = combined;
            if (nw.inputEl) nw.inputEl.value = combined;
            nw._updateSyntaxHighlight?.();
        }
    }
    pushPromptHistory(node, "Negative Preset: " + presetKey);
    if (npWidget) npWidget.value = "--select negative preset--";
}

// ── Client-Side Prompt Resolver & Preview Modal ──────────────────────────────
function resolvePromptClientSide(text, seed, weightMode) {
    if (!text || typeof text !== "string") return "";

    let s = (seed && seed > 0) ? seed : Math.floor(Math.random() * 10000000);
    function nextRng() {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    }

    // 1. Strip block and line comments
    let res = text.replace(/\/\*[\s\S]*?\*\//g, "");
    res = res.replace(/^\s*(?:#|\/\/).*$/gm, "");
    res = res.replace(/(?<!https:)(?<!http:)\s+\/\/.*$/gm, "");
    res = res.replace(/\s+#\s+.*$/gm, "");

    // 2. Resolve {shuffle: a, b, c}
    res = res.replace(/\{shuffle:\s*([^{}]+)\}/gi, (_, group) => {
        const items = group.split(",").map(x => x.trim()).filter(Boolean);
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(nextRng() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items.join(", ");
    });

    // 3. Resolve dynamic choices {a|b|c} or {2$$a|b|c}
    for (let pass = 0; pass < 10; pass++) {
        if (!/\{([^{}]+)\}/.test(res)) break;
        res = res.replace(/\{([^{}]+)\}/g, (_, content) => {
            let spec = null;
            let body = content;
            if (content.includes("$$")) {
                const parts = content.split("$$", 2);
                spec = parts[0].trim();
                body = parts[1].trim();
            }
            const opts = body.split("|").map(x => x.trim()).filter(Boolean);
            if (!opts.length) return "";
            let k = 1;
            if (spec) {
                const parsedK = parseInt(spec, 10);
                if (!isNaN(parsedK)) k = Math.max(1, Math.min(parsedK, opts.length));
            }
            const picked = [];
            const pool = [...opts];
            for (let i = 0; i < k && pool.length > 0; i++) {
                const idx = Math.floor(nextRng() * pool.length);
                picked.push(pool[idx]);
                pool.splice(idx, 1);
            }
            return picked.join(", ");
        });
    }

    // 4. Weight mode handling
    if (weightMode && (weightMode.startsWith("Strip") || weightMode.includes("Chroma") || weightMode.includes("Flux"))) {
        res = res.replace(/\(([^():]+):([0-9.]+)\)/g, "$1");
        res = res.replace(/\(([a-zA-Z0-9_\s\-]+)\)/g, "$1");
    }

    // 5. Clean duplicate commas and spaces
    res = res.replace(/,\s*,+/g, ", ");
    res = res.replace(/^[,\s]+/, "").trim();
    return res;
}

function showResolvedPreviewModal(node) {
    const pw = node.widgets?.find(w => w.name === "positive");
    const nw = node.widgets?.find(w => w.name === "negative");
    const sw = node.widgets?.find(w => w.name === "seed");
    const wm = node.widgets?.find(w => w.name === "weight_mode");

    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 620px; max-height: 85vh; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #cdd6f4; font-family: sans-serif;";

    let currentSeed = (sw && sw.value) ? parseInt(sw.value, 10) : 0;
    const mode = wm?.value || "Pass-Through";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="margin: 0; font-size: 16px; color: #a6e3a1;">🔍 Resolved Prompt Preview</h3>
            <span style="font-size: 11px; background: #313244; color: #cba6f7; padding: 2px 8px; border-radius: 10px;">${mode.split("(")[0].trim()}</span>
        </div>
    `;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const controls = document.createElement("div");
    controls.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 12px;";
    controls.innerHTML = "<span>Seed:</span>";

    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = currentSeed;
    seedInput.style.cssText = "background: #1e1e2e; border: 1px solid #313244; color: #cdd6f4; padding: 4px 8px; border-radius: 6px; width: 120px;";

    const rerollBtn = document.createElement("button");
    rerollBtn.textContent = "🎲 Re-roll Seed";
    rerollBtn.style.cssText = "background: #313244; color: #f9e2af; border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer;";

    controls.appendChild(seedInput);
    controls.appendChild(rerollBtn);
    dialog.appendChild(controls);

    const posBox = document.createElement("div");
    posBox.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    posBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a6e3a1; font-weight: bold;">
            <span>POSITIVE PROMPT (RESOLVED)</span>
            <button id="mf-copy-pos" style="background: none; border: none; color: #89b4fa; cursor: pointer; font-size: 11px;">📋 Copy</button>
        </div>
        <textarea id="mf-pos-res" readonly style="width: 100%; height: 130px; background: #11111b; border: 1px solid #313244; border-radius: 6px; color: #cdd6f4; font-family: monospace; font-size: 12px; padding: 8px; resize: vertical; box-sizing: border-box;"></textarea>
    `;
    dialog.appendChild(posBox);

    const negBox = document.createElement("div");
    negBox.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    negBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #f38ba8; font-weight: bold;">
            <span>NEGATIVE PROMPT (RESOLVED)</span>
            <button id="mf-copy-neg" style="background: none; border: none; color: #89b4fa; cursor: pointer; font-size: 11px;">📋 Copy</button>
        </div>
        <textarea id="mf-neg-res" readonly style="width: 100%; height: 75px; background: #11111b; border: 1px solid #313244; border-radius: 6px; color: #cdd6f4; font-family: monospace; font-size: 12px; padding: 8px; resize: vertical; box-sizing: border-box;"></textarea>
    `;
    dialog.appendChild(negBox);

    function updatePreview() {
        const activeSeed = parseInt(seedInput.value, 10) || 0;
        const resPos = resolvePromptClientSide(pw?.value || "", activeSeed, mode);
        const resNeg = resolvePromptClientSide(nw?.value || "", activeSeed, mode);
        dialog.querySelector("#mf-pos-res").value = resPos;
        dialog.querySelector("#mf-neg-res").value = resNeg;
    }

    seedInput.oninput = updatePreview;
    rerollBtn.onclick = () => {
        seedInput.value = Math.floor(Math.random() * 1000000000);
        updatePreview();
    };

    posBox.querySelector("#mf-copy-pos").onclick = () => {
        navigator.clipboard?.writeText(dialog.querySelector("#mf-pos-res").value);
        alert("Positive prompt copied to clipboard!");
    };
    negBox.querySelector("#mf-copy-neg").onclick = () => {
        navigator.clipboard?.writeText(dialog.querySelector("#mf-neg-res").value);
        alert("Negative prompt copied to clipboard!");
    };

    updatePreview();
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

app.registerExtension({
    name: "modusflow.TextEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowTextEditor") {

            fetchThemes();
            fetchWildcardList();
            fetchLoraList();

            // ── onNodeCreated ─────────────────────────────────────────────────────
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                // Locate Python-registered widgets
                const positiveWidget = node.widgets?.find(w => w.name === "positive");
                const negativeWidget  = node.widgets?.find(w => w.name === "negative");
                const dropdownWidget  = node.widgets?.find(w => w.name === "saved_prompt");

                if (positiveWidget) {
                    positiveWidget.label = "Positive";
                    attachCommentShortcuts(positiveWidget);
                    attachSyntaxHighlighter(positiveWidget, node);
                    attachAutocomplete(positiveWidget, node);
                }
                if (negativeWidget) {
                    negativeWidget.label = "Negative";
                    attachCommentShortcuts(negativeWidget);
                    attachSyntaxHighlighter(negativeWidget, node);
                    attachAutocomplete(negativeWidget, node);
                }

                // ── Negative widget height control ────────────────────────────────
                const NEG_H = 80;
                if (negativeWidget) {
                    negativeWidget.computeSize = function() {
                        return [0, NEG_H];
                    };
                    requestAnimationFrame(() => {
                        const ta = negativeWidget.inputEl || negativeWidget.element;
                        if (ta) { ta.style.resize = "none"; ta.style.overflow = "auto"; }
                    });
                }

                // ── Prompt cache ──────────────────────────────────────────────────
                node._allPrompts    = [];
                node._savedCategory = undefined;

                // ── Syntax Theme combo selector ───────────────────────────────────
                const initialTheme = node.properties?.["syntax_theme"] ||
                                     (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_syntax_theme")) ||
                                     "Modus Neon (Default)";
                node._currentSyntaxTheme = initialTheme;

                const themeWidget = node.addWidget(
                    "combo",
                    "syntax_theme",
                    initialTheme,
                    (value) => setNodeTheme(node, value),
                    { values: getThemeOptions() }
                );
                themeWidget.label = "Syntax Theme";

                // ── Type filter combo (All vs Prompts vs Songs) ──────────────────
                const typeWidget = node.addWidget(
                    "combo",
                    "type_filter",
                    "--all types--",
                    () => applyFilter(node),
                    { values: ["--all types--", "prompts", "songs"] }
                );
                typeWidget.label = "Type";

                // ── Category filter combo ─────────────────────────────────────────
                const categoryWidget = node.addWidget(
                    "combo",
                    "category_filter",
                    "--all categories--",
                    () => applyFilter(node),
                    { values: ["--all categories--"] }
                );
                categoryWidget.label = "Category";

                // Move theme, type, and category filters to appear right before saved_prompt
                if (dropdownWidget) {
                    const dropIdx = node.widgets.indexOf(dropdownWidget);
                    const themeIdx = node.widgets.indexOf(themeWidget);
                    const typeIdx  = node.widgets.indexOf(typeWidget);
                    const catIdx   = node.widgets.indexOf(categoryWidget);
                    if (dropIdx >= 0) {
                        const items = [
                            { w: themeWidget, idx: themeIdx },
                            { w: typeWidget,  idx: typeIdx },
                            { w: categoryWidget, idx: catIdx }
                        ].sort((a, b) => b.idx - a.idx);

                        for (const it of items) {
                            if (it.idx >= 0) node.widgets.splice(it.idx, 1);
                        }

                        const newDropIdx = node.widgets.indexOf(dropdownWidget);
                        node.widgets.splice(newDropIdx, 0, themeWidget, typeWidget, categoryWidget);
                    }
                }

                // ── Prompt dropdown → load on select ─────────────────────────────
                if (dropdownWidget) {
                    dropdownWidget.callback = function(value) {
                        if (value && value !== "--select prompt--" && value !== "--no prompts found--") {
                            loadPrompt(node, value);
                        }
                    };
                }

                // ── Category text entry (for saving/updating prompts) ─────────────
                const promptCategoryWidget = node.addWidget(
                    "text",
                    "prompt_category",
                    "",
                    () => {},
                    {}
                );
                promptCategoryWidget.label = "Prompt Category";

                // ── Negative Presets Combo ────────────────────────────────────────
                const negPresetWidget = node.addWidget(
                    "combo",
                    "negative_presets",
                    "--select negative preset--",
                    (value) => applyNegativePreset(node, value),
                    { values: Object.keys(NEGATIVE_PRESETS) }
                );
                negPresetWidget.label = "Negative Presets";

                // ── Action buttons ────────────────────────────────────────────────
                node.addWidget("button", "Save Prompt",       null, () => showSaveDialog(node));
                node.addWidget("button", "Update Selected",   null, () => updatePrompt(node));
                node.addWidget("button", "Refresh List",      null, () => refreshPrompts(node));
                node.addWidget("button", "Prettify / Dedupe", null, () => prettifyNodePrompts(node));
                node.addWidget("button", "Preview Resolved",  null, () => showResolvedPreviewModal(node));
                node.addWidget("button", "Prompt History",    null, () => showHistoryDialog(node));

                // ── Initial size ──────────────────────────────────────────────────
                node.size = [540, 840];
                node.resizable = true;

                requestAnimationFrame(() => refreshPrompts(node));

                return r;
            };

            // ── onConfigure (workflow load / paste) ───────────────────────────────
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(config) {
                if (onConfigure) onConfigure.apply(this, arguments);

                if (this.properties?.syntax_theme) {
                    const tw = this.widgets?.find(w => w.name === "syntax_theme");
                    if (tw) tw.value = this.properties.syntax_theme;
                    setNodeTheme(this, this.properties.syntax_theme);
                } else {
                    const tw = this.widgets?.find(w => w.name === "syntax_theme");
                    if (tw && tw.value) {
                        setNodeTheme(this, tw.value);
                    }
                }

                const vals = config?.widgets_values;
                if (!vals) return;
                const cw = this.widgets?.find(w => w.name === "prompt_category");
                if (cw && vals[4] !== undefined) {
                    cw.value = vals[4];
                    if (cw.inputEl) cw.inputEl.value = vals[4];
                }

                const pw = this.widgets?.find(w => w.name === "positive");
                const nw = this.widgets?.find(w => w.name === "negative");
                if (pw) {
                    attachCommentShortcuts(pw);
                    attachSyntaxHighlighter(pw, this);
                    attachAutocomplete(pw, this);
                }
                if (nw) {
                    attachCommentShortcuts(nw);
                    attachSyntaxHighlighter(nw, this);
                    attachAutocomplete(nw, this);
                }
            };

            // ── onResize ──────────────────────────────────────────────────────────
            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function(size) {
                const r = onResize ? onResize.apply(this, arguments) : undefined;
                const pw = this.widgets?.find(w => w.name === "positive");
                const nw = this.widgets?.find(w => w.name === "negative");
                pw?._updateSyntaxHighlight?.();
                nw?._updateSyntaxHighlight?.();
                return r;
            };

            // ── onSerialize ───────────────────────────────────────────────────────
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                if (onSerialize) onSerialize.apply(this, arguments);
            };

            // ── Helper: set widget value AND update the visible textarea ──────────
            function setTextValue(widget, value) {
                if (!widget) return;
                widget.value = value;
                if (widget.inputEl) widget.inputEl.value = value;
                widget._updateSyntaxHighlight?.();
            }

            // ── Helper: Attach comment keyboard shortcuts (Ctrl+/, Ctrl+Shift+/, Shift+Alt+A) ──
            function attachCommentShortcuts(widget) {
                if (!widget) return;
                const bindEl = (ta) => {
                    if (!ta || ta._hasCommentHandler) return;
                    ta._hasCommentHandler = true;

                    ta.addEventListener("keydown", (e) => {
                        const isMac = navigator.platform && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
                        const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

                        // 1. Toggle Line Comment: Ctrl+/ or Cmd+/
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
                            return;
                        }

                        // 2. Toggle Block Comment: Ctrl+Shift+/ or Shift+Alt+A or Cmd+Shift+/
                        const isBlockShortcut = (ctrlOrCmd && e.shiftKey && (e.key === "/" || e.code === "Slash" || e.key === "?")) ||
                                               (e.shiftKey && e.altKey && (e.key === "a" || e.key === "A" || e.code === "KeyA"));

                        if (isBlockShortcut) {
                            e.preventDefault();
                            e.stopPropagation();

                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const text = ta.value;

                            if (start === end) {
                                ta.setRangeText("/*  */", start, end, "end");
                                ta.selectionStart = start + 3;
                                ta.selectionEnd = start + 3;
                                widget.value = ta.value;
                                widget._updateSyntaxHighlight?.();
                                return;
                            }

                            const selected = text.slice(start, end);
                            const trimmed = selected.trim();

                            if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
                                const unwrapped = selected.replace(/^\s*\/\*\s?/, "").replace(/\s?\*\/\s*$/, "");
                                ta.setRangeText(unwrapped, start, end, "select");
                            } else {
                                const wrapped = `/* ${selected} */`;
                                ta.setRangeText(wrapped, start, end, "select");
                            }
                            widget.value = ta.value;
                            widget._updateSyntaxHighlight?.();
                            return;
                        }

                        // 3. Tag Weight Stepping: Ctrl+Up / Ctrl+Down (or Cmd+Up/Down on Mac)
                        if (ctrlOrCmd && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                            e.preventDefault();
                            e.stopPropagation();

                            const isUp = e.key === "ArrowUp";
                            const delta = isUp ? 0.05 : -0.05;
                            const text = ta.value;
                            let start = ta.selectionStart;
                            let end = ta.selectionEnd;

                            // If no selection, expand to tag under cursor or surrounding parenthesis
                            if (start === end) {
                                let openParen = -1;
                                for (let i = start - 1; i >= 0; i--) {
                                    if (text[i] === "(") { openParen = i; break; }
                                    if (text[i] === ")" || text[i] === "\n") break;
                                }
                                let closeParen = -1;
                                if (openParen !== -1) {
                                    for (let i = end; i < text.length; i++) {
                                        if (text[i] === ")") { closeParen = i; break; }
                                        if (text[i] === "(" || text[i] === "\n") break;
                                    }
                                }

                                if (openParen !== -1 && closeParen !== -1) {
                                    start = openParen;
                                    end = closeParen + 1;
                                } else {
                                    let tagStart = start;
                                    while (tagStart > 0 && text[tagStart - 1] !== "," && text[tagStart - 1] !== "\n") {
                                        tagStart--;
                                    }
                                    let tagEnd = end;
                                    while (tagEnd < text.length && text[tagEnd] !== "," && text[tagEnd] !== "\n") {
                                        tagEnd++;
                                    }
                                    while (tagStart < tagEnd && /\s/.test(text[tagStart])) tagStart++;
                                    while (tagEnd > tagStart && /\s/.test(text[tagEnd - 1])) tagEnd--;
                                    if (tagStart < tagEnd) {
                                        start = tagStart;
                                        end = tagEnd;
                                    }
                                }
                            }

                            if (start < end) {
                                const selected = text.slice(start, end);
                                const wm = selected.match(/^\((.+):([0-9.]+)\)$/);
                                const sm = selected.match(/^\((.+)\)$/);

                                let newText = selected;
                                if (wm) {
                                    const baseTag = wm[1].trim();
                                    const currW = parseFloat(wm[2]);
                                    let newW = Math.round((currW + delta) * 100) / 100;
                                    newW = Math.max(0.05, Math.min(2.5, newW));
                                    if (Math.abs(newW - 1.0) < 0.001) {
                                        newText = baseTag;
                                    } else {
                                        newText = `(${baseTag}:${newW.toFixed(2).replace(/\.?0+$/, "")})`;
                                    }
                                } else if (sm) {
                                    const baseTag = sm[1].trim();
                                    let newW = Math.round((1.0 + delta) * 100) / 100;
                                    if (Math.abs(newW - 1.0) < 0.001) {
                                        newText = baseTag;
                                    } else {
                                        newText = `(${baseTag}:${newW.toFixed(2).replace(/\.?0+$/, "")})`;
                                    }
                                } else {
                                    const baseTag = selected.trim();
                                    let newW = Math.round((1.0 + delta) * 100) / 100;
                                    newText = `(${baseTag}:${newW.toFixed(2).replace(/\.?0+$/, "")})`;
                                }

                                ta.setRangeText(newText, start, end, "select");
                                widget.value = ta.value;
                                widget._updateSyntaxHighlight?.();
                            }
                            return;
                        }
                    });
                };

                if (widget.inputEl) bindEl(widget.inputEl);
                requestAnimationFrame(() => {
                    const ta = widget.inputEl || widget.element;
                    if (ta) bindEl(ta);
                });
            }

            // ── Load a JSON prompt file into the text boxes ───────────────────────
            function loadPrompt(node, filename) {
                fetch("/modusflow/load_prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        setTextValue(node.widgets?.find(w => w.name === "positive"),        data.data.positive || "");
                        setTextValue(node.widgets?.find(w => w.name === "negative"),         data.data.negative || "");
                        setTextValue(node.widgets?.find(w => w.name === "prompt_category"),  data.data.category || "");
                        pushPromptHistory(node, "Loaded: " + filename);
                        app.graph.setDirtyCanvas(true, true);
                    } else {
                        console.error("[ModusFlow] Load error:", data.message);
                    }
                })
                .catch(err => console.error("[ModusFlow] Load error:", err.message));
            }

            // ── Filter saved_prompt dropdown by type AND category ─────────────────
            function applyFilter(node) {
                const dw = node.widgets?.find(w => w.name === "saved_prompt");
                const cw = node.widgets?.find(w => w.name === "category_filter");
                const tw = node.widgets?.find(w => w.name === "type_filter");
                if (!dw) return;

                const category = cw ? cw.value : "--all categories--";
                const selectedType = tw ? tw.value : "--all types--";
                const all = node._allPrompts || [];

                let filtered = all;

                // 1. Filter by Type
                if (selectedType === "prompts") {
                    filtered = filtered.filter(p => !p.type || p.type === "prompt");
                } else if (selectedType === "songs") {
                    filtered = filtered.filter(p => p.type === "song" || p.type === "ace_song");
                }

                // 2. Filter by Category
                if (category && category !== "--all categories--") {
                    filtered = filtered.filter(p => (p.category || "") === category);
                }

                const filenames = filtered.map(p => p.filename);

                dw.options.values = filenames.length
                    ? ["--select prompt--", ...filenames]
                    : ["--no prompts found--"];

                if (!dw.options.values.includes(dw.value)) {
                    dw.value = dw.options.values[0];
                }
                app.graph.setDirtyCanvas(true, true);
            }

            // ── Fetch prompt list; rebuild category combo + dropdown ───────────────
            function refreshPrompts(node) {
                const dw = node.widgets?.find(w => w.name === "saved_prompt");
                const cw = node.widgets?.find(w => w.name === "category_filter");
                if (!dw) return;

                fetch("/modusflow/list_prompts")
                    .then(r => r.json())
                    .then(data => {
                        if (!data.success) return;
                        node._allPrompts = data.data;

                        const cats = [...new Set(
                            data.data.map(p => (p.category || "").trim()).filter(Boolean)
                        )].sort();

                        if (cw) {
                            const target = (node._savedCategory !== undefined)
                                ? node._savedCategory
                                : cw.value;
                            node._savedCategory = undefined;

                            cw.options.values = ["--all categories--", ...cats];
                            cw.value = cw.options.values.includes(target) ? target : "--all categories--";
                        }
                        fetchWildcardList(true);
                        fetchLoraList(true);
                        applyFilter(node);
                    })
                    .catch(err => console.error("[ModusFlow] Refresh error:", err.message));
            }

            // ── Save current text to a new file ───────────────────────────────────
            function showSaveDialog(node) {
                const pw  = node.widgets?.find(w => w.name === "positive");
                const nw  = node.widgets?.find(w => w.name === "negative");
                const pcw = node.widgets?.find(w => w.name === "prompt_category");
                if (!pw) return;

                const filename = prompt("Filename (without extension):");
                if (!filename?.trim()) return;
                const category = (pcw?.value || "").trim();

                fetch("/modusflow/save_prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: filename.trim(),
                        type: "prompt",
                        category: category,
                        positive: pw.value || "",
                        negative: nw?.value || ""
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert("Saved: " + filename.trim() + ".json");
                        pushPromptHistory(node, "Saved: " + filename.trim());
                        refreshPrompts(node);
                    }
                    else alert("Save failed: " + data.message);
                })
                .catch(err => alert("Save error: " + err.message));
            }

            // ── Overwrite the currently selected prompt ───────────────────────────
            function updatePrompt(node) {
                const pw  = node.widgets?.find(w => w.name === "positive");
                const nw  = node.widgets?.find(w => w.name === "negative");
                const dw  = node.widgets?.find(w => w.name === "saved_prompt");
                const pcw = node.widgets?.find(w => w.name === "prompt_category");

                const selected = dw?.value;
                if (!selected || selected === "--select prompt--" || selected === "--no prompts found--") {
                    alert("Select a saved prompt from the dropdown first.");
                    return;
                }
                if (!confirm('Overwrite "' + selected + '" with the current text?')) return;

                const base     = selected.replace(/\.json$/i, "");
                const category = (pcw?.value || "").trim();

                fetch("/modusflow/save_prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: base, type: "prompt", category, positive: pw?.value || "", negative: nw?.value || "" })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert('"' + selected + '" updated.');
                        pushPromptHistory(node, "Updated: " + selected);
                    }
                    else alert("Update failed: " + data.message);
                })
                .catch(err => alert("Update error: " + err.message));
            }
        }
    }
});