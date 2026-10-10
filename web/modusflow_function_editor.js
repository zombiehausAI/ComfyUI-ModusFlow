import { app } from "../../scripts/app.js";

// ModusFlow Function Editor — on-canvas prompt function library management,
// with @global and @private decorator scoping, dot-notation resolution,
// full syntax highlighting, intelligent autocomplete, and a floating Pop-Out Editor Studio.

// ── Built-in Syntax Themes ───────────────────────────────────────────────────
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
        decorator_global: "#34d399",
        decorator_private: "#fbbf24",
        plain_text: "#e2e8f0",
        caret_color: "#ffffff",
        bg_color: "#181825"
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
        decorator_global: "#00f0ff",
        decorator_private: "#ff007f",
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
        decorator_global: "#a9dc76",
        decorator_private: "#fc9867",
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
        decorator_global: "#50fa7b",
        decorator_private: "#ffb86c",
        plain_text: "#f8f8f2",
        caret_color: "#f8f8f2",
        bg_color: "#1e1f29"
    }
};

let THEMES = { ...DEFAULT_THEMES };
const MONOSPACE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function getActiveTheme() {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("modusflow_syntax_theme") : null;
    if (saved && THEMES[saved]) return THEMES[saved];
    return THEMES["Modus Neon (Default)"] || Object.values(THEMES)[0];
}

// Fetch custom syntax themes if available from PromptServer
fetch("/modusflow/syntax_themes")
    .then(r => r.json())
    .then(data => {
        if (data.success && data.data && data.data.themes) {
            THEMES = { ...DEFAULT_THEMES, ...data.data.themes };
        }
    })
    .catch(() => {});

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function injectSyntaxStyles() {
    let styleEl = document.getElementById("modusflow-function-editor-styles");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "modusflow-function-editor-styles";
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
        .modusflow-fn-syntax-ta {
            background: transparent !important;
            background-color: transparent !important;
            box-sizing: border-box !important;
        }
        .modusflow-fn-syntax-ta::selection {
            background: rgba(99, 102, 241, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-fn-syntax-ta::-moz-selection {
            background: rgba(99, 102, 241, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-fn-syntax-backdrop {
            position: absolute;
            pointer-events: none;
            overflow: hidden;
            box-sizing: border-box;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            user-select: none;
            -webkit-user-select: none;
            border-radius: 6px;
            z-index: 0 !important;
        }
        .modusflow-fn-popout-ta::selection {
            background: rgba(99, 102, 241, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-fn-popout-ta::-moz-selection {
            background: rgba(99, 102, 241, 0.35) !important;
            color: transparent !important;
        }
        .modusflow-decorator-global {
            display: inline-block;
            background: rgba(16, 185, 129, 0.18);
            color: #34d399;
            font-weight: bold;
            padding: 1px 5px;
            border-radius: 4px;
            border: 1px solid rgba(16, 185, 129, 0.4);
            margin-right: 2px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .modusflow-decorator-private {
            display: inline-block;
            background: rgba(245, 158, 11, 0.18);
            color: #fbbf24;
            font-weight: bold;
            padding: 1px 5px;
            border-radius: 4px;
            border: 1px solid rgba(245, 158, 11, 0.4);
            margin-right: 2px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .modusflow-fn-badge {
            position: absolute;
            bottom: 4px;
            right: 8px;
            font-size: 11px;
            line-height: 1.2;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.85);
            color: #94a3b8;
            border: 1px solid rgba(255, 255, 255, 0.12);
            pointer-events: none;
            z-index: 10;
            font-family: ui-monospace, SFMono-Regular, monospace;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            user-select: none;
        }
        /* ── Autocomplete Menu ── */
        .modusflow-fn-autocomplete-menu {
            position: absolute;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 8px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.1);
            max-height: 230px;
            overflow-y: auto;
            z-index: 10002;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            display: none;
            box-sizing: border-box;
            padding: 4px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
        }
        .modusflow-fn-autocomplete-item {
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
        .modusflow-fn-autocomplete-item:hover,
        .modusflow-fn-autocomplete-item.is-selected {
            background: rgba(99, 102, 241, 0.28);
            color: #ffffff;
        }
        .modusflow-fn-autocomplete-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 3px;
            letter-spacing: 0.5px;
            flex-shrink: 0;
            text-transform: uppercase;
        }
        .badge-fn-global { background: rgba(16, 185, 129, 0.25); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.5); }
        .badge-fn-private { background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); }
        .badge-fn-kw { background: rgba(232, 121, 249, 0.25); color: #e879f9; border: 1px solid rgba(232, 121, 249, 0.5); }
        .badge-fn-var { background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); }
        .badge-fn-list { background: rgba(251, 191, 36, 0.25); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.5); }

        /* ── Pop-Out Studio Window ── */
        .modusflow-fn-popout-window {
            position: fixed;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            background: #181825;
            border: 1px solid #45475a;
            border-radius: 12px;
            box-shadow: 0 25px 65px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.1);
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #cdd6f4;
            min-width: min(700px, calc(100vw - 20px));
            min-height: min(520px, calc(100vh - 20px));
            max-width: calc(100vw - 20px);
            max-height: calc(100vh - 20px);
            resize: both;
            box-sizing: border-box;
        }
        .modusflow-fn-popout-window.is-maximized {
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            border-radius: 0 !important;
            resize: none !important;
        }
        .modusflow-fn-popout-window.is-minimized {
            width: 320px !important;
            height: 44px !important;
            min-width: 0 !important;
            min-height: 0 !important;
            resize: none !important;
            border-radius: 22px !important;
            bottom: 24px !important;
            right: 24px !important;
            top: auto !important;
            left: auto !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        }
        .modusflow-fn-popout-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 14px;
            background: #1e1e2e;
            border-bottom: 1px solid #313244;
            user-select: none;
            cursor: grab;
            gap: 10px;
            flex-shrink: 0;
        }
        .modusflow-fn-popout-header:active {
            cursor: grabbing;
        }
        .modusflow-fn-popout-toolbar {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #181825;
            border-bottom: 1px solid #313244;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .modusflow-fn-popout-btn {
            background: #1e1e2e;
            border: 1px solid #313244;
            border-radius: 5px;
            padding: 4px 8px;
            color: #cdd6f4;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-family: inherit;
        }
        .modusflow-fn-popout-btn:hover {
            border-color: #818cf8;
            background: #28283d;
            color: #ffffff;
        }
        .modusflow-fn-popout-body {
            display: flex;
            flex: 1;
            overflow: hidden;
            padding: 10px;
            box-sizing: border-box;
            background: #11111b;
            position: relative;
        }
        .modusflow-fn-popout-editor-box {
            position: relative;
            flex: 1;
            display: flex;
            overflow: hidden;
            border-radius: 8px;
            border: 1px solid #313244;
            background: #181825;
        }
        .modusflow-fn-popout-ta {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: 12px;
            border: none;
            outline: none;
            resize: none;
            background: transparent;
            color: transparent;
            font-family: ${MONOSPACE_FONT};
            font-size: 14px;
            line-height: 1.5;
            tab-size: 4;
            white-space: pre-wrap;
            word-wrap: break-word;
            box-sizing: border-box;
            z-index: 2;
        }
        .modusflow-fn-popout-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow: hidden;
            box-sizing: border-box;
            font-family: ${MONOSPACE_FONT};
            font-size: 14px;
            line-height: 1.5;
            tab-size: 4;
            pointer-events: none;
            z-index: 1;
        }
    `;
    document.head.appendChild(styleEl);
}

// ── Tokenizer & Syntax Highlighter Engine ────────────────────────────────────
function tokenizeAndHighlight(text, theme = getActiveTheme()) {
    if (!text) return "";
    const intervals = [];

    const addMatches = (regex, type) => {
        let m;
        while ((m = regex.exec(text)) !== null) {
            intervals.push({ start: m.index, end: m.index + m[0].length, type: type });
        }
    };

    // 1. Block Comments /* ... */
    addMatches(/\/\*[\s\S]*?\*\//g, "comment");

    // 2. Line Comments // ... and # ...
    addMatches(/(?<!https:)(?<!http:)\/\/[^\r\n]*/g, "comment");
    addMatches(/#[^\r\n]*/g, "comment");

    // 3. Decorators: @global and @private
    addMatches(/@global\b/gi, "decorator_global");
    addMatches(/@private\b/gi, "decorator_private");

    // 4. Function definitions: fn name($arg) or def name($arg)
    addMatches(/\b(?:fn|def)\b/g, "keyword");

    // 5. Control Flow & Loop Keywords
    addMatches(/\b(?:repeat|for|in|case|switch|return)\b/g, "keyword");

    // 6. Dot notation function calls: name.method(...)
    addMatches(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+(?=\s*\()/g, "function");

    // 7. Macro function invocations: @name(...)
    addMatches(/@[a-zA-Z0-9_]+(?=\s*\()/g, "function");

    // 8. Variables: $varname
    addMatches(/(?<!\$)\$[a-zA-Z0-9_]+/g, "variable");

    // 9. Dynamic Choices: {all$$...} or {a|b|c}
    addMatches(/\{all\$\$[^{}]*\}/gi, "choice");
    addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");

    // 10. Wildcards: __name__ or __all$$name__
    addMatches(/__(?:(?:\d+(?:-\d+)?|all|\*)\$\$)?([a-zA-Z0-9_\-/]+)__/g, "wildcard");

    // 11. Attention weights: (tag:1.2)
    addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

    // 12. Strings: "..." or '...'
    addMatches(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "shuffle");

    // Sort intervals by start position, prioritizing longer spans
    intervals.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
    });

    let html = "";
    let cursor = 0;

    for (const iv of intervals) {
        if (iv.start < cursor) continue;
        if (iv.start > cursor) {
            html += `<span style="color: ${theme.plain_text || '#e2e8f0'};">${escapeHtml(text.slice(cursor, iv.start))}</span>`;
        }
        const tokenText = escapeHtml(text.slice(iv.start, iv.end));

        if (iv.type === "decorator_global") {
            html += `<span class="modusflow-decorator-global" title="Global Scope (Accessible as @func)">${tokenText}</span>`;
        } else if (iv.type === "decorator_private") {
            html += `<span class="modusflow-decorator-private" title="Private Scope (Accessible as namespace.func)">${tokenText}</span>`;
        } else if (iv.type === "keyword") {
            const color = theme.keyword || "#e879f9";
            html += `<span style="color: ${color}; font-weight: bold;">${tokenText}</span>`;
        } else if (iv.type === "function") {
            const color = theme.function || "#818cf8";
            html += `<span style="color: ${color}; font-weight: 600;">${tokenText}</span>`;
        } else if (iv.type === "variable") {
            const color = theme.variable || "#38bdf8";
            html += `<span style="color: ${color}; font-weight: 600;">${tokenText}</span>`;
        } else if (iv.type === "comment") {
            const color = theme.comment || "#6b7280";
            html += `<span style="color: ${color}; font-style: italic;">${tokenText}</span>`;
        } else if (iv.type === "choice") {
            const color = theme.choice || "#c084fc";
            html += `<span style="color: ${color}; font-weight: 500;">${tokenText}</span>`;
        } else if (iv.type === "wildcard") {
            const color = theme.wildcard || "#fbbf24";
            html += `<span style="color: ${color}; font-weight: 600;">${tokenText}</span>`;
        } else if (iv.type === "weight") {
            const color = theme.weight || "#34d399";
            html += `<span style="color: ${color}; font-weight: bold;">${tokenText}</span>`;
        } else if (iv.type === "shuffle") {
            const color = theme.shuffle || "#f472b6";
            html += `<span style="color: ${color};">${tokenText}</span>`;
        } else {
            const color = theme.plain_text || "#e2e8f0";
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

// ── Autocomplete System ──────────────────────────────────────────────────────
let _cachedWildcards = null;

function fetchWildcardList() {
    if (_cachedWildcards) return Promise.resolve(_cachedWildcards);
    return fetch("/modusflow/wildcards/list")
        .then(r => r.json())
        .then(data => {
            _cachedWildcards = (data.success && Array.isArray(data.data)) ? data.data : [];
            return _cachedWildcards;
        })
        .catch(() => _cachedWildcards || []);
}

function detectTrigger(text, cursor) {
    if (cursor <= 0 || !text) return null;
    const sub = text.slice(0, cursor);

    // 1. Decorators and functions: @name
    const atMatch = sub.match(/(?:^|[\s,.:;!?([{\"])(@([a-zA-Z0-9_]*))$/);
    if (atMatch) {
        return {
            type: "decorator",
            fullToken: atMatch[1],
            query: atMatch[2] || "",
            replaceStart: cursor - atMatch[1].length,
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

    // 3. Wildcards: __name
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

    // 4. Function keyword snippet: fn or def
    const fnMatch = sub.match(/(?:^|\n)[ \t]*(fn|def)$/i);
    if (fnMatch) {
        return {
            type: "fn_keyword",
            fullToken: fnMatch[1],
            query: fnMatch[1],
            replaceStart: cursor - fnMatch[1].length,
            replaceEnd: cursor
        };
    }

    // 5. Loop snippet: repeat or for
    const loopMatch = sub.match(/(?:^|\n)[ \t]*(repeat|for)$/i);
    if (loopMatch) {
        return {
            type: "loop_keyword",
            fullToken: loopMatch[1],
            query: loopMatch[1],
            replaceStart: cursor - loopMatch[1].length,
            replaceEnd: cursor
        };
    }

    return null;
}

function getSuggestions(trigger, currentScript = "") {
    const q = (trigger.query || "").toLowerCase();

    if (trigger.type === "decorator") {
        const items = [
            { name: "@global", badge: "SCOPE", badgeClass: "badge-fn-global", desc: "Export globally as @func and namespace.func" },
            { name: "@private", badge: "SCOPE", badgeClass: "badge-fn-private", desc: "Keep private to namespace.func only" }
        ];

        // Parse local function names from current script
        const fnMatches = currentScript.matchAll(/(?:fn|def)\s+([a-zA-Z0-9_]+)/g);
        for (const m of fnMatches) {
            if (m[1] && !items.some(it => it.name === `@${m[1]}`)) {
                items.push({
                    name: `@${m[1]}()`,
                    badge: "FN",
                    badgeClass: "badge-fn-kw",
                    desc: "Call local macro function"
                });
            }
        }

        return items.filter(it => !q || it.name.toLowerCase().includes(q));
    }

    if (trigger.type === "fn_keyword") {
        return [
            {
                name: "fn name($arg) = {\n    \n};",
                insertText: "fn name($arg) = {\n    $arg\n};",
                badge: "TEMPLATE",
                badgeClass: "badge-fn-kw",
                desc: "Macro function block"
            }
        ];
    }

    if (trigger.type === "loop_keyword") {
        return [
            {
                name: "repeat(count) { ... }",
                insertText: "repeat(3) {\n    \n}",
                badge: "LOOP",
                badgeClass: "badge-fn-kw",
                desc: "Repeat generation loop"
            },
            {
                name: "for $item in $list { ... }",
                insertText: "for $item in $list {\n    $item\n}",
                badge: "LOOP",
                badgeClass: "badge-fn-kw",
                desc: "Iterate across list/items"
            }
        ];
    }

    if (trigger.type === "variable") {
        return [
            { name: "$lens", badge: "VAR", badgeClass: "badge-fn-var", desc: "Camera focal length parameter" },
            { name: "$lighting", badge: "VAR", badgeClass: "badge-fn-var", desc: "Lighting atmosphere" },
            { name: "$subject", badge: "VAR", badgeClass: "badge-fn-var", desc: "Subject prompt" }
        ].filter(v => !q || v.name.toLowerCase().includes(q));
    }

    if (trigger.type === "wildcard") {
        const list = _cachedWildcards || [];
        return list
            .filter(w => !q || w.toLowerCase().includes(q))
            .map(w => ({
                name: `__${w}__`,
                badge: "LIST",
                badgeClass: "badge-fn-list",
                desc: "Wildcard list file"
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
        lineHeight: lineHeight
    };
}

function attachAutocomplete(ta, getScriptText) {
    if (!ta || !ta.parentElement || ta._hasFnAutocomplete) return;
    ta._hasFnAutocomplete = true;

    fetchWildcardList();

    const parent = ta.parentElement;
    const parentPos = window.getComputedStyle(parent).position;
    if (parentPos === "static") {
        parent.style.position = "relative";
    }

    const menu = document.createElement("div");
    menu.className = "modusflow-fn-autocomplete-menu";
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
        activeItems.forEach((item, idx) => {
            const row = document.createElement("div");
            row.className = "modusflow-fn-autocomplete-item" + (idx === selectedIndex ? " is-selected" : "");
            row.innerHTML = `
                <span style="font-weight: 600; white-space: nowrap;">${escapeHtml(item.name)}</span>
                <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; color: #94a3b8; font-style: italic;">${escapeHtml(item.desc || '')}</span>
                    <span class="modusflow-fn-autocomplete-badge ${item.badgeClass || ''}">${escapeHtml(item.badge || '')}</span>
                </span>
            `;
            row.onmousedown = (e) => {
                e.preventDefault();
                insertSelection(item);
            };
            menu.appendChild(row);
        });
        menu.style.display = activeItems.length > 0 ? "block" : "none";
    }

    function insertSelection(item) {
        if (!currentTrigger) return;
        const insert = item.insertText || item.name;
        const before = ta.value.slice(0, currentTrigger.replaceStart);
        const after = ta.value.slice(currentTrigger.replaceEnd);
        ta.value = before + insert + after;
        const newCursor = currentTrigger.replaceStart + insert.length;
        ta.setSelectionRange(newCursor, newCursor);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        closeMenu();
        ta.focus();
    }

    function positionMenu() {
        if (!currentTrigger) return;
        const coords = getCaretCoordinates(ta, currentTrigger.replaceStart);
        const parentW = parent.clientWidth || 400;
        const parentH = parent.clientHeight || 300;
        const menuWidth = Math.min(320, parentW - 20);

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

    ta.addEventListener("input", () => {
        const cursor = ta.selectionStart;
        currentTrigger = detectTrigger(ta.value, cursor);
        if (!currentTrigger) {
            closeMenu();
            return;
        }

        const scriptContent = typeof getScriptText === "function" ? getScriptText() : ta.value;
        activeItems = getSuggestions(currentTrigger, scriptContent);
        if (activeItems.length === 0) {
            closeMenu();
            return;
        }

        selectedIndex = 0;
        positionMenu();
        renderMenu();
    });

    ta.addEventListener("keydown", (e) => {
        if (menu.style.display === "block" && activeItems.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % activeItems.length;
                renderMenu();
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + activeItems.length) % activeItems.length;
                renderMenu();
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertSelection(activeItems[selectedIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                closeMenu();
                return;
            }
        }
    });

    ta.addEventListener("blur", () => {
        setTimeout(closeMenu, 150);
    });
}

// ── On-Canvas Syntax Highlighter Attachment ──────────────────────────────────
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
        backdrop.className = "modusflow-fn-syntax-backdrop";
        backdrop.style.backgroundColor = getActiveTheme().bg_color || "#181825";
        backdrop.style.color = getActiveTheme().plain_text || "#e2e8f0";
        parent.insertBefore(backdrop, ta);

        ta.classList.add("modusflow-fn-syntax-ta");
        ta.style.position = "relative";
        ta.style.zIndex = "1";
        ta.style.setProperty("background", "transparent", "important");
        ta.style.setProperty("background-color", "transparent", "important");
        ta.style.caretColor = getActiveTheme().caret_color || "#ffffff";
        ta.style.fontFamily = MONOSPACE_FONT;
        ta.style.fontSize = "13px";
        ta.style.lineHeight = "1.4";
        ta.style.tabSize = "4";
        ta.style.overflowY = "auto";
        ta.style.overflowX = "hidden";
        ta.style.whiteSpace = "pre-wrap";
        ta.style.wordBreak = "break-word";
        ta.style.overflowWrap = "break-word";
        ta.style.boxSizing = "border-box";

        const badge = document.createElement("div");
        badge.className = "modusflow-fn-badge";
        parent.appendChild(badge);

        function syncGeometry() {
            if (!ta || !backdrop) return;
            backdrop.style.top = ta.offsetTop + "px";
            backdrop.style.left = ta.offsetLeft + "px";
            backdrop.style.width = ta.offsetWidth + "px";
            backdrop.style.height = ta.offsetHeight + "px";

            const cs = window.getComputedStyle(ta);
            const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
            const borderRight = parseFloat(cs.borderRightWidth) || 0;
            const scrollbarWidth = Math.max(0, ta.offsetWidth - ta.clientWidth - borderLeft - borderRight);

            backdrop.style.fontFamily = MONOSPACE_FONT;
            backdrop.style.fontSize = cs.fontSize || "13px";
            backdrop.style.lineHeight = cs.lineHeight || "1.4";
            backdrop.style.letterSpacing = cs.letterSpacing || "normal";
            backdrop.style.wordSpacing = cs.wordSpacing || "normal";
            backdrop.style.whiteSpace = "pre-wrap";
            backdrop.style.wordBreak = cs.wordBreak || "break-word";
            backdrop.style.overflowWrap = cs.overflowWrap || "break-word";
            backdrop.style.tabSize = "4";
            backdrop.style.boxSizing = cs.boxSizing || "border-box";

            backdrop.style.paddingTop = cs.paddingTop;
            backdrop.style.paddingBottom = cs.paddingBottom;
            backdrop.style.paddingLeft = cs.paddingLeft;
            backdrop.style.paddingRight = (parseFloat(cs.paddingRight) || 0) + scrollbarWidth + "px";

            backdrop.style.border = cs.border;
            backdrop.style.borderColor = "transparent";
            backdrop.style.borderStyle = cs.borderStyle;
            backdrop.style.borderWidth = cs.borderWidth;
            backdrop.style.borderRadius = cs.borderRadius;

            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        }

        function updateMetrics(val) {
            const safeVal = val || "";
            const lines = safeVal.split("\n");
            const fnCount = (safeVal.match(/(?:fn|def)\s+[a-zA-Z0-9_]+/g) || []).length;
            const globalCount = (safeVal.match(/@global/gi) || []).length;
            const privateCount = (safeVal.match(/@private/gi) || []).length;

            let desc = `${fnCount} fn (${lines.length} lines)`;
            if (globalCount > 0 || privateCount > 0) {
                desc += ` [${globalCount} global, ${privateCount} private]`;
            }
            badge.textContent = desc;
        }

        const update = () => {
            syncGeometry();
            const theme = getActiveTheme();
            backdrop.style.backgroundColor = theme.bg_color || "#181825";
            backdrop.style.color = theme.plain_text || "#e2e8f0";
            backdrop.innerHTML = tokenizeAndHighlight(ta.value, theme);
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
            updateMetrics(ta.value);

            if (ta.offsetWidth > 0 && ta.offsetHeight > 0) {
                ta.style.setProperty("color", "transparent", "important");
                backdrop.style.display = "block";
            } else {
                ta.style.removeProperty("color");
                ta.style.color = theme.plain_text || "#e2e8f0";
            }
        };

        ta.addEventListener("input", update);
        ta.addEventListener("scroll", () => {
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        }, { passive: true });
        ta.addEventListener("focus", update);
        ta.addEventListener("click", update);
        ta.addEventListener("keyup", update);

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                update();
            });
            ro.observe(ta);
        }

        // Tab indentation and comment toggle
        ta.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                if (!e.shiftKey) {
                    ta.setRangeText("    ", start, end, "end");
                } else {
                    const text = ta.value;
                    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                    const linePrefix = text.slice(lineStart, lineStart + 4);
                    const spacesToRemove = linePrefix.match(/^ {1,4}/)?.[0]?.length || 0;
                    if (spacesToRemove > 0) {
                        ta.setRangeText("", lineStart, lineStart + spacesToRemove, "end");
                    }
                }
                widget.value = ta.value;
                update();
            } else if ((e.ctrlKey || e.metaKey) && e.key === "/") {
                e.preventDefault();
                const start = ta.selectionStart;
                const text = ta.value;
                const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                let lineEnd = text.indexOf("\n", start);
                if (lineEnd === -1) lineEnd = text.length;
                const line = text.slice(lineStart, lineEnd);
                if (line.trim().startsWith("//")) {
                    const newLine = line.replace("// ", "").replace("//", "");
                    ta.setRangeText(newLine, lineStart, lineEnd, "select");
                } else {
                    ta.setRangeText("// " + line, lineStart, lineEnd, "select");
                }
                widget.value = ta.value;
                update();
            }
        });

        attachAutocomplete(ta, () => ta.value);

        widget._updateSyntaxHighlight = update;
        setTimeout(update, 20);
        setTimeout(update, 100);
        setTimeout(update, 350);
    };

    bind();
}

// ── Floating Pop-Out Studio Window ───────────────────────────────────────────
function showFunctionPopoutStudio(node) {
    injectSyntaxStyles();

    if (node._popoutStudioEl && document.body.contains(node._popoutStudioEl)) {
        if (node._popoutStudioEl.classList.contains("is-minimized")) {
            node._popoutStudioEl.classList.remove("is-minimized");
        }
        node._popoutStudioEl.style.zIndex = String(++window._popoutZIndex || 10001);
        node._popoutStudioEl.querySelector("textarea")?.focus();
        return;
    }

    const scriptWidget = node.widgets?.find(w => w.name === "script_code");
    const fileWidget = node.widgets?.find(w => w.name === "function_file");
    const nsWidget = node.widgets?.find(w => w.name === "namespace");
    if (!scriptWidget) return;

    const win = document.createElement("div");
    win.className = "modusflow-fn-popout-window";
    node._popoutStudioEl = win;

    let z = typeof window._popoutZIndex === "number" ? ++window._popoutZIndex : 10001;
    window._popoutZIndex = z;
    win.style.zIndex = String(z);

    const defW = Math.min(1080, Math.floor(window.innerWidth * 0.88));
    const defH = Math.min(760, Math.floor(window.innerHeight * 0.85));
    const defTop = Math.max(30, Math.floor((window.innerHeight - defH) / 2));
    const defLeft = Math.max(30, Math.floor((window.innerWidth - defW) / 2));

    win.style.top = `${defTop}px`;
    win.style.left = `${defLeft}px`;
    win.style.width = `${defW}px`;
    win.style.height = `${defH}px`;

    // ── Header Bar ──
    const header = document.createElement("div");
    header.className = "modusflow-fn-popout-header";

    const titleGroup = document.createElement("div");
    titleGroup.style.cssText = "display: flex; align-items: center; gap: 8px; min-width: 0;";
    titleGroup.innerHTML = `
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #818cf8; box-shadow: 0 0 8px #818cf8; flex-shrink: 0;"></div>
        <span style="font-weight: 700; font-size: 13px; color: #cdd6f4; white-space: nowrap;">ModusFlow Function Studio</span>
        <span style="font-size: 11px; color: #818cf8; background: rgba(129, 140, 248, 0.15); border: 1px solid rgba(129, 140, 248, 0.3); padding: 1px 7px; border-radius: 10px; white-space: nowrap;">#${node.id} ${escapeHtml(node.title || "Function Editor")}</span>
    `;

    const metricsGroup = document.createElement("div");
    metricsGroup.style.cssText = "display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 12px;";
    const fnStatPill = document.createElement("span");
    fnStatPill.style.cssText = "font-size: 11px; font-family: ui-monospace, monospace; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 4px; color: #34d399;";
    metricsGroup.appendChild(fnStatPill);

    const winControls = document.createElement("div");
    winControls.style.cssText = "display: flex; align-items: center; gap: 6px; flex-shrink: 0;";

    const minBtn = document.createElement("button");
    minBtn.className = "modusflow-fn-popout-btn";
    minBtn.innerHTML = "—";
    minBtn.title = "Minimize to floating dock";
    minBtn.onclick = () => win.classList.toggle("is-minimized");

    const maxBtn = document.createElement("button");
    maxBtn.className = "modusflow-fn-popout-btn";
    maxBtn.innerHTML = "⇱";
    maxBtn.title = "Maximize / Fullscreen";
    maxBtn.onclick = () => win.classList.toggle("is-maximized");

    const dockBtn = document.createElement("button");
    dockBtn.className = "modusflow-fn-popout-btn";
    dockBtn.style.cssText = "color: #f38ba8; border-color: rgba(243, 139, 168, 0.4);";
    dockBtn.innerHTML = "✕ Dock";
    dockBtn.title = "Close Pop-Out and dock back to canvas node";
    dockBtn.onclick = () => {
        win.remove();
        node._popoutStudioEl = null;
    };

    winControls.appendChild(minBtn);
    winControls.appendChild(maxBtn);
    winControls.appendChild(dockBtn);

    header.appendChild(titleGroup);
    header.appendChild(metricsGroup);
    header.appendChild(winControls);
    win.appendChild(header);

    // ── Draggable Window Logic ──
    let isDragging = false;
    let startX, startY, startTop, startLeft;
    header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button") || e.target.closest("input") || win.classList.contains("is-maximized")) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTop = win.offsetTop;
        startLeft = win.offsetLeft;
        const onMouseMove = (ev) => {
            if (!isDragging) return;
            win.style.top = `${startTop + (ev.clientY - startY)}px`;
            win.style.left = `${startLeft + (ev.clientX - startX)}px`;
        };
        const onMouseUp = () => {
            isDragging = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });

    // ── Toolbar Ribbon ──
    const toolbar = document.createElement("div");
    toolbar.className = "modusflow-fn-popout-toolbar";

    const fileSelect = document.createElement("select");
    fileSelect.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #818cf8; font-size: 11px; padding: 4px 8px; outline: none; cursor: pointer; max-width: 180px;";
    if (fileWidget && fileWidget.options && fileWidget.options.values) {
        fileWidget.options.values.forEach(f => {
            const opt = document.createElement("option");
            opt.value = f;
            opt.textContent = f;
            if (f === fileWidget.value) opt.selected = true;
            fileSelect.appendChild(opt);
        });
    }

    const nsInput = document.createElement("input");
    nsInput.type = "text";
    nsInput.placeholder = "Namespace (e.g. camera)";
    nsInput.value = (nsWidget && nsWidget.value) ? nsWidget.value : "camera";
    nsInput.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #38bdf8; font-size: 11px; padding: 4px 8px; width: 130px; outline: none;";
    nsInput.oninput = () => {
        if (nsWidget) {
            nsWidget.value = nsInput.value;
            app.graph.setDirtyCanvas(true, true);
        }
    };

    const addGlobalBtn = document.createElement("button");
    addGlobalBtn.className = "modusflow-fn-popout-btn";
    addGlobalBtn.innerHTML = "➕ @global";
    addGlobalBtn.onclick = () => insertSnippet("\n@global\nfn my_global_func($arg) = {\n    high quality portrait of $arg, cinematic lighting\n};\n");

    const addPrivateBtn = document.createElement("button");
    addPrivateBtn.className = "modusflow-fn-popout-btn";
    addPrivateBtn.innerHTML = "🔒 @private";
    addPrivateBtn.onclick = () => insertSnippet("\n@private\nfn my_private_helper($param) = {\n    subtle accent of $param\n};\n");

    const addLoopBtn = document.createElement("button");
    addLoopBtn.className = "modusflow-fn-popout-btn";
    addLoopBtn.innerHTML = "🔁 Loop";
    addLoopBtn.onclick = () => insertSnippet("\nrepeat(3) {\n    individual wearing {vintage|modern} clothing,\n}\n");

    const saveBtn = document.createElement("button");
    saveBtn.className = "modusflow-fn-popout-btn";
    saveBtn.innerHTML = "💾 Save As";
    saveBtn.onclick = () => node._saveAsNewFunction?.();

    const updateBtn = document.createElement("button");
    updateBtn.className = "modusflow-fn-popout-btn";
    updateBtn.innerHTML = "✏️ Overwrite";
    updateBtn.onclick = () => node._updateSelectedFunction?.();

    toolbar.appendChild(fileSelect);
    toolbar.appendChild(nsInput);
    toolbar.appendChild(addGlobalBtn);
    toolbar.appendChild(addPrivateBtn);
    toolbar.appendChild(addLoopBtn);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(updateBtn);
    win.appendChild(toolbar);

    // ── Editor Body Pane ──
    const body = document.createElement("div");
    body.className = "modusflow-fn-popout-body";

    const editorBox = document.createElement("div");
    editorBox.className = "modusflow-fn-popout-editor-box";

    const popBackdrop = document.createElement("div");
    popBackdrop.className = "modusflow-fn-popout-backdrop";
    popBackdrop.style.backgroundColor = getActiveTheme().bg_color || "#181825";
    popBackdrop.style.color = getActiveTheme().plain_text || "#e2e8f0";

    const popTa = document.createElement("textarea");
    popTa.className = "modusflow-fn-popout-ta";
    popTa.value = scriptWidget.value || "";
    popTa.style.caretColor = getActiveTheme().caret_color || "#ffffff";

    editorBox.appendChild(popBackdrop);
    editorBox.appendChild(popTa);
    body.appendChild(editorBox);
    win.appendChild(body);

    function updatePopMetrics(val) {
        const safeVal = val || "";
        const lines = safeVal.split("\n").length;
        const globalCount = (safeVal.match(/@global/gi) || []).length;
        const privateCount = (safeVal.match(/@private/gi) || []).length;
        const totalFn = (safeVal.match(/(?:fn|def)\s+[a-zA-Z0-9_]+/g) || []).length;
        fnStatPill.textContent = `${totalFn} fn • ${lines} lines (${globalCount} global, ${privateCount} private)`;
    }

    function renderPopout() {
        const theme = getActiveTheme();
        popBackdrop.style.backgroundColor = theme.bg_color || "#181825";
        popBackdrop.style.color = theme.plain_text || "#e2e8f0";
        popBackdrop.innerHTML = tokenizeAndHighlight(popTa.value, theme);
        popBackdrop.scrollTop = popTa.scrollTop;
        popBackdrop.scrollLeft = popTa.scrollLeft;
        updatePopMetrics(popTa.value);
    }

    function insertSnippet(snippet) {
        const start = popTa.selectionStart || popTa.value.length;
        const end = popTa.selectionEnd || popTa.value.length;
        popTa.setRangeText(snippet, start, end, "end");
        popTa.dispatchEvent(new Event("input", { bubbles: true }));
        popTa.focus();
    }

    // Bidirectional synchronization: Pop-out <-> Canvas node
    popTa.addEventListener("input", () => {
        scriptWidget.value = popTa.value;
        const nodeTa = scriptWidget.inputEl || scriptWidget.element;
        if (nodeTa) {
            nodeTa.value = popTa.value;
        }
        scriptWidget._updateSyntaxHighlight?.();
        renderPopout();
        app.graph.setDirtyCanvas(true, true);
    });

    popTa.addEventListener("scroll", () => {
        popBackdrop.scrollTop = popTa.scrollTop;
        popBackdrop.scrollLeft = popTa.scrollLeft;
    });

    // Tab indentation in pop-out
    popTa.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = popTa.selectionStart;
            const end = popTa.selectionEnd;
            if (!e.shiftKey) {
                popTa.setRangeText("    ", start, end, "end");
            } else {
                const text = popTa.value;
                const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                const linePrefix = text.slice(lineStart, lineStart + 4);
                const spacesToRemove = linePrefix.match(/^ {1,4}/)?.[0]?.length || 0;
                if (spacesToRemove > 0) {
                    popTa.setRangeText("", lineStart, lineStart + spacesToRemove, "end");
                }
            }
            popTa.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });

    attachAutocomplete(popTa, () => popTa.value);

    // Node -> Popout sync hook
    node._syncPopoutFromNode = () => {
        if (popTa && popTa.value !== scriptWidget.value) {
            popTa.value = scriptWidget.value || "";
            renderPopout();
        }
        if (fileSelect && fileWidget) {
            fileSelect.value = fileWidget.value;
        }
        if (nsInput && nsWidget) {
            nsInput.value = nsWidget.value;
        }
    };

    fileSelect.onchange = () => {
        if (fileWidget) {
            fileWidget.value = fileSelect.value;
            node._loadSelectedFunction?.(fileSelect.value);
        }
    };

    document.body.appendChild(win);
    renderPopout();
    popTa.focus();
}

// ── Extension Registration ──────────────────────────────────────────────────
app.registerExtension({
    name: "modusflow.FunctionEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowFunctionEditor") {

            function setupFunctionEditorNode(node) {
                if (node._fnEditorInitialized) return;
                node._fnEditorInitialized = true;

                const fileWidget = node.widgets?.find(w => w.name === "function_file");
                const nsWidget = node.widgets?.find(w => w.name === "namespace");
                const scriptWidget = node.widgets?.find(w => w.name === "script_code");

                if (scriptWidget) {
                    attachSyntaxHighlighter(scriptWidget, node);
                }

                function setTextareaValue(widget, val) {
                    if (!widget) return;
                    widget.value = val;
                    const ta = widget.inputEl || widget.element;
                    if (ta) {
                        ta.value = val;
                        ta.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                    widget._updateSyntaxHighlight?.();
                    node._syncPopoutFromNode?.();
                }

                // ── Load selected function file ─────────────────────────────────
                function loadSelectedFunction(filename) {
                    if (!filename || filename === "--no functions found--") return;
                    fetch("/modusflow/functions/load", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: filename })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && scriptWidget) {
                            setTextareaValue(scriptWidget, data.data || "");
                            if (nsWidget && (!nsWidget.value || nsWidget.value === "default" || nsWidget.value === "camera")) {
                                nsWidget.value = data.filename;
                            }
                        }
                    })
                    .catch(err => console.debug("[ModusFlow FunctionEditor] Load error:", err));
                }
                node._loadSelectedFunction = loadSelectedFunction;

                // ── Refresh list of function files ──────────────────────────────
                function refreshFunctions(selectName = null) {
                    if (!fileWidget) return;
                    fetch("/modusflow/functions/list")
                        .then(r => r.json())
                        .then(data => {
                            const files = (data.success && Array.isArray(data.data) && data.data.length > 0)
                                ? data.data
                                : ["--no functions found--"];

                            fileWidget.options.values = files;
                            if (selectName && files.includes(selectName)) {
                                fileWidget.value = selectName;
                            } else if (!files.includes(fileWidget.value)) {
                                fileWidget.value = files[0];
                            }
                            if (fileWidget.value && fileWidget.value !== "--no functions found--") {
                                loadSelectedFunction(fileWidget.value);
                            }
                            node._syncPopoutFromNode?.();
                            app.graph.setDirtyCanvas(true, true);
                        })
                        .catch(err => console.error("[ModusFlow FunctionEditor] Refresh error:", err));
                }
                node._refreshFunctions = refreshFunctions;

                if (fileWidget) {
                    const origCallback = fileWidget.callback;
                    fileWidget.callback = function (val) {
                        if (origCallback) origCallback.apply(this, arguments);
                        loadSelectedFunction(val);
                    };
                }

                // ── Save as a new function file ─────────────────────────────────
                function saveAsNewFunction() {
                    if (!scriptWidget) return;
                    let filename = prompt("Enter new function library name (e.g. camera, lighting, styles):");
                    if (!filename || !filename.trim()) return;

                    filename = filename.trim().replace(/\.(mf|txt)$/i, "");
                    if (!filename) return;

                    fetch("/modusflow/functions/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            filename: filename,
                            content: scriptWidget.value || ""
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert("Saved function library: " + data.filename + ".mf");
                            refreshFunctions(data.filename);
                        } else {
                            alert("Save failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Save error: " + err.message));
                }
                node._saveAsNewFunction = saveAsNewFunction;

                // ── Update selected function file ───────────────────────────────
                function updateSelectedFunction() {
                    if (!fileWidget || !scriptWidget) return;
                    const current = fileWidget.value;
                    if (!current || current === "--no functions found--") {
                        alert("Please select a function file from the dropdown or click 'Save As' first.");
                        return;
                    }

                    if (!confirm('Overwrite "' + current + '" with current script?')) return;

                    fetch("/modusflow/functions/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            filename: current,
                            content: scriptWidget.value || ""
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert('"' + current + '" updated successfully.');
                        } else {
                            alert("Update failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Update error: " + err.message));
                }
                node._updateSelectedFunction = updateSelectedFunction;

                // ── Delete selected function file ───────────────────────────────
                function deleteSelectedFunction() {
                    if (!fileWidget) return;
                    const current = fileWidget.value;
                    if (!current || current === "--no functions found--") {
                        alert("No function file selected to delete.");
                        return;
                    }

                    if (!confirm('Permanently delete function file "' + current + '"?')) return;

                    fetch("/modusflow/functions/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: current })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert('Deleted: "' + current + '"');
                            setTextareaValue(scriptWidget, "");
                            refreshFunctions();
                        } else {
                            alert("Delete failed: " + data.message);
                        }
                    })
                    .catch(err => alert("Delete error: " + err.message));
                }
                node._deleteSelectedFunction = deleteSelectedFunction;

                // ── Action Buttons ──────────────────────────────────────────────
                node.addWidget("button", "⛶ Pop Out Editor", null, () => showFunctionPopoutStudio(node));
                node.addWidget("button", "💾 Save As New", null, () => saveAsNewFunction());
                node.addWidget("button", "✏️ Update Selected", null, () => updateSelectedFunction());
                node.addWidget("button", "🗑️ Delete Function", null, () => deleteSelectedFunction());
                node.addWidget("button", "🔄 Refresh Functions", null, () => refreshFunctions());

                node.size = [440, 580];
                node.resizable = true;

                // Initial auto-load if dropdown has a selection
                requestAnimationFrame(() => {
                    if (fileWidget && fileWidget.value && fileWidget.value !== "--no functions found--") {
                        if (!scriptWidget || !scriptWidget.value) {
                            loadSelectedFunction(fileWidget.value);
                        }
                    }
                });
            }

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                setupFunctionEditorNode(this);
                return r;
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function () {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
                setupFunctionEditorNode(this);
                return r;
            };

            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function () {
                const r = onResize ? onResize.apply(this, arguments) : undefined;
                const scriptWidget = this.widgets?.find(w => w.name === "script_code");
                scriptWidget?._updateSyntaxHighlight?.();
                return r;
            };

            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function (_, options) {
                const r = getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;
                options.push({
                    content: "⛶ Pop Out Function Studio",
                    callback: () => showFunctionPopoutStudio(this)
                });
                return r;
            };
        }
    }
});
