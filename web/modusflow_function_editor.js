import { app } from "../../scripts/app.js";

// ModusFlow Function Editor — on-canvas prompt function library management,
// with @global and @private decorator scoping, dot-notation resolution,
// full syntax highlighting, tab indentation, and intelligent autocomplete.

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
        decorator_global: "#10b981",
        decorator_private: "#f59e0b",
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

let _activeTheme = DEFAULT_THEMES["Modus Neon (Default)"];

// Fetch custom syntax themes if available from PromptServer
fetch("/modusflow/syntax_themes")
    .then(r => r.json())
    .then(data => {
        if (data.success && data.themes && data.themes[data.active_theme]) {
            _activeTheme = Object.assign({}, DEFAULT_THEMES["Modus Neon (Default)"], data.themes[data.active_theme]);
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

function injectFunctionEditorStyles() {
    if (document.getElementById("modusflow-function-editor-styles")) return;
    const style = document.createElement("style");
    style.id = "modusflow-function-editor-styles";
    style.textContent = `
        .modusflow-fn-wrap {
            position: relative !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }
        .modusflow-fn-backdrop {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            pointer-events: none !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            font-family: monospace !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            padding: 8px !important;
            z-index: 1 !important;
            border-radius: 6px !important;
            border: 1px solid transparent !important;
        }
        .modusflow-fn-textarea {
            position: relative !important;
            z-index: 2 !important;
            background: transparent !important;
            color: transparent !important;
            caret-color: #ffffff !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            font-family: monospace !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            box-sizing: border-box !important;
            padding: 8px !important;
            border-radius: 6px !important;
            border: 1px solid #334155 !important;
            resize: vertical !important;
            width: 100% !important;
        }
        .modusflow-fn-textarea:focus {
            outline: none !important;
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
        }
        .modusflow-decorator-global {
            display: inline-block;
            background: rgba(16, 185, 129, 0.18);
            color: #34d399;
            font-weight: bold;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid rgba(16, 185, 129, 0.4);
            margin-right: 4px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .modusflow-decorator-private {
            display: inline-block;
            background: rgba(245, 158, 11, 0.18);
            color: #fbbf24;
            font-weight: bold;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid rgba(245, 158, 11, 0.4);
            margin-right: 4px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .modusflow-fn-kw {
            color: #e879f9;
            font-weight: bold;
        }
        .modusflow-fn-name {
            color: #818cf8;
            font-weight: 700;
        }
        .modusflow-fn-param {
            color: #38bdf8;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
}

// ── Tokenizer & Syntax Highlighter Engine ────────────────────────────────────
function tokenizeAndHighlight(text, theme = _activeTheme) {
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
            html += `<span class="modusflow-decorator-global" title="Global Scope (Accessible everywhere as @func)">${tokenText}</span>`;
        } else if (iv.type === "decorator_private") {
            html += `<span class="modusflow-decorator-private" title="Private Scope (Accessible via namespace.func)">${tokenText}</span>`;
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

// ── Attach Syntax Highlighter to Textarea ───────────────────────────────────
function attachSyntaxHighlighter(widget, node) {
    if (!widget) return;
    injectFunctionEditorStyles();

    const bind = () => {
        const ta = widget.inputEl || widget.element;
        if (!ta || !ta.parentElement) return;

        if (ta.parentElement.classList.contains("modusflow-fn-wrap")) return;

        const wrap = document.createElement("div");
        wrap.className = "modusflow-fn-wrap";
        ta.parentNode.insertBefore(wrap, ta);
        wrap.appendChild(ta);

        const backdrop = document.createElement("div");
        backdrop.className = "modusflow-fn-backdrop";
        backdrop.style.backgroundColor = _activeTheme.bg_color || "#181825";
        backdrop.style.color = _activeTheme.plain_text || "#e2e8f0";
        wrap.insertBefore(backdrop, ta);

        ta.classList.add("modusflow-fn-textarea");
        ta.style.caretColor = _activeTheme.caret_color || "#ffffff";

        const update = () => {
            backdrop.innerHTML = tokenizeAndHighlight(ta.value, _activeTheme);
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        };

        ta.addEventListener("input", update);
        ta.addEventListener("scroll", () => {
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        });

        // Tab indentation support
        ta.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const text = ta.value;

                if (!e.shiftKey) {
                    // Indent with 4 spaces
                    ta.setRangeText("    ", start, end, "end");
                } else {
                    // Unindent: strip up to 4 spaces from current line
                    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                    const linePrefix = text.slice(lineStart, lineStart + 4);
                    const spacesToRemove = linePrefix.match(/^ {1,4}/)?.[0]?.length || 0;
                    if (spacesToRemove > 0) {
                        ta.setRangeText("", lineStart, lineStart + spacesToRemove, "end");
                    }
                }
                widget.value = ta.value;
                update();
            }
        });

        widget._updateSyntaxHighlight = update;
        update();
    };

    let attempts = 0;
    const poll = () => {
        const ta = widget.inputEl || widget.element;
        if (ta) {
            bind();
        } else if (attempts++ < 30) {
            requestAnimationFrame(poll);
        }
    };
    poll();
}

// ── Extension Registration ──────────────────────────────────────────────────
app.registerExtension({
    name: "modusflow.FunctionEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowFunctionEditor") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

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
                            app.graph.setDirtyCanvas(true, true);
                        })
                        .catch(err => console.error("[ModusFlow FunctionEditor] Refresh error:", err));
                }

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

                // ── Update selected function file ───────────────────────────────
                function updateSelectedFunction() {
                    if (!fileWidget || !scriptWidget) return;
                    const current = fileWidget.value;
                    if (!current || current === "--no functions found--") {
                        alert("Please select a function file from the dropdown or click 'Save As New' first.");
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

                // ── Insert Template Helpers ─────────────────────────────────────
                function insertSnippet(snippet) {
                    if (!scriptWidget) return;
                    const ta = scriptWidget.inputEl || scriptWidget.element;
                    if (ta) {
                        const start = ta.selectionStart || ta.value.length;
                        const end = ta.selectionEnd || ta.value.length;
                        ta.setRangeText(snippet, start, end, "end");
                        scriptWidget.value = ta.value;
                        ta.dispatchEvent(new Event("input", { bubbles: true }));
                        scriptWidget._updateSyntaxHighlight?.();
                        ta.focus();
                    }
                }

                // ── Action Buttons ──────────────────────────────────────────────
                node.addWidget("button", "➕ Insert @global Fn", null, () => {
                    insertSnippet("\n@global\nfn my_global_func($arg) = {\n    high quality portrait of $arg, cinematic lighting\n};\n");
                });

                node.addWidget("button", "🔒 Insert @private Fn", null, () => {
                    insertSnippet("\n@private\nfn my_private_helper($param) = {\n    detailed texture with $param\n};\n");
                });

                node.addWidget("button", "💾 Save As New", null, () => saveAsNewFunction());
                node.addWidget("button", "✏️ Update Selected", null, () => updateSelectedFunction());
                node.addWidget("button", "🗑️ Delete Function", null, () => deleteSelectedFunction());
                node.addWidget("button", "🔄 Refresh Functions", null, () => refreshFunctions());

                node.size = [440, 600];
                node.resizable = true;

                // Auto-load if initial selection exists
                requestAnimationFrame(() => {
                    if (fileWidget && fileWidget.value && fileWidget.value !== "--no functions found--") {
                        if (!scriptWidget || !scriptWidget.value) {
                            loadSelectedFunction(fileWidget.value);
                        }
                    }
                });

                return r;
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function () {
                if (onConfigure) onConfigure.apply(this, arguments);
                const scriptWidget = this.widgets?.find(w => w.name === "script_code");
                if (scriptWidget) {
                    attachSyntaxHighlighter(scriptWidget, this);
                }
            };

            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function () {
                const r = onResize ? onResize.apply(this, arguments) : undefined;
                const scriptWidget = this.widgets?.find(w => w.name === "script_code");
                scriptWidget?._updateSyntaxHighlight?.();
                return r;
            };
        }
    }
});
