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
    `;
    document.head.appendChild(styleEl);
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

        function render() {
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

app.registerExtension({
    name: "modusflow.TextEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowTextEditor") {

            fetchThemes();

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
                }
                if (negativeWidget) {
                    negativeWidget.label = "Negative";
                    attachCommentShortcuts(negativeWidget);
                    attachSyntaxHighlighter(negativeWidget, node);
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

                // ── Action buttons ────────────────────────────────────────────────
                node.addWidget("button", "Save Prompt",     null, () => showSaveDialog(node));
                node.addWidget("button", "Update Selected", null, () => updatePrompt(node));
                node.addWidget("button", "Refresh List",    null, () => refreshPrompts(node));

                // ── Initial size ──────────────────────────────────────────────────
                node.size = [520, 750];
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
                    if (data.success) { alert("Saved: " + filename.trim() + ".json"); refreshPrompts(node); }
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
                    if (data.success) alert('"' + selected + '" updated.');
                    else alert("Update failed: " + data.message);
                })
                .catch(err => alert("Update error: " + err.message));
            }
        }
    }
});