import { app } from "../../scripts/app.js";

// ModusFlow List Curator — on-canvas wildcard viewing, editing, saving, updating, and deleting

app.registerExtension({
    name: "modusflow.ListCurator",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowListCurator") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                const listWidget = node.widgets?.find(w => w.name === "wildcard_list");
                const entriesWidget = node.widgets?.find(w => w.name === "custom_entries");

                if (entriesWidget) {
                    entriesWidget.label = "List Entries (1 per line)";
                }

                // ── Helper: Set textarea value cleanly ─────────────────────────────
                function setTextareaValue(widget, value) {
                    if (!widget) return;
                    widget.value = value;
                    if (widget.inputEl) widget.inputEl.value = value;
                    if (widget.element) widget.element.value = value;
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
        }
    }
});
