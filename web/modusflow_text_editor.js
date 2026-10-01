import { app } from "../../scripts/app.js";

// ModusFlow Text Editor — positive/negative prompts with category-filtered save/load

app.registerExtension({
    name: "modusflow.TextEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowTextEditor") {

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
                }
                if (negativeWidget) {
                    negativeWidget.label = "Negative";
                    attachCommentShortcuts(negativeWidget);
                }

                // ── Negative widget height control ────────────────────────────────
                // ComfyUI's new frontend uses _arrangeWidgets() which checks:
                //   if widget.computeSize  → computedHeight = computeSize()[1] + 4  (FIXED)
                //   else if computeLayoutSize → goes into flexible pool, grows with node
                // The multiline textarea widget has computeLayoutSize (flexible) by default,
                // which causes it to expand when the node is tall or when zooming.
                //
                // Fix: add computeSize to make it take the FIXED path.
                // The Vue component then sets element.style.height from computedHeight
                // inside a CSS-scaled container — no scale multiplication needed here.
                const NEG_H = 80;

                if (negativeWidget) {
                    negativeWidget.computeSize = function() {
                        return [0, NEG_H];
                    };
                    // Disable the native textarea resize handle; the height is managed above.
                    requestAnimationFrame(() => {
                        const ta = negativeWidget.inputEl || negativeWidget.element;
                        if (ta) { ta.style.resize = "none"; ta.style.overflow = "auto"; }
                    });
                }

                // ── Prompt cache ──────────────────────────────────────────────────
                node._allPrompts    = [];
                node._savedCategory = undefined;

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

                // Move type_filter and category_filter to appear right before saved_prompt
                if (dropdownWidget) {
                    const dropIdx = node.widgets.indexOf(dropdownWidget);
                    const typeIdx = node.widgets.indexOf(typeWidget);
                    const catIdx  = node.widgets.indexOf(categoryWidget);
                    if (dropIdx >= 0) {
                        node.widgets.splice(catIdx, 1);
                        node.widgets.splice(typeIdx, 1);
                        node.widgets.splice(dropIdx, 0, typeWidget, categoryWidget);
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

                // Auto-populate on first creation
                requestAnimationFrame(() => refreshPrompts(node));

                return r;
            };

            // ── onConfigure (workflow load / paste) ───────────────────────────────
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(config) {
                if (onConfigure) onConfigure.apply(this, arguments);
                const vals = config?.widgets_values;
                if (!vals) return;
                const cw = this.widgets?.find(w => w.name === "prompt_category");
                if (cw && vals[4] !== undefined) {
                    cw.value = vals[4];
                    if (cw.inputEl) cw.inputEl.value = vals[4];
                }
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