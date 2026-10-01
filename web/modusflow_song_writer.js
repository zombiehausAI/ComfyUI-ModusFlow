import { app } from "../../scripts/app.js";

// ModusFlow Song Writer & Lyric Studio — save/load songs with category filtering

app.registerExtension({
    name: "modusflow.SongWriter",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowSongWriter") {

            // ── onNodeCreated ─────────────────────────────────────────────────────
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                // Locate Python-registered widgets
                const titleWidget      = node.widgets?.find(w => w.name === "title");
                const genreWidget      = node.widgets?.find(w => w.name === "genre");
                const vocalWidget      = node.widgets?.find(w => w.name === "vocal_style");
                const moodWidget       = node.widgets?.find(w => w.name === "mood");
                const templateWidget   = node.widgets?.find(w => w.name === "template");
                const lyricsWidget     = node.widgets?.find(w => w.name === "lyrics");
                const dropdownWidget   = node.widgets?.find(w => w.name === "saved_song");
                const addStyleWidget   = node.widgets?.find(w => w.name === "additional_style");
                const negStyleWidget   = node.widgets?.find(w => w.name === "negative_style");

                // Song list cache
                node._allSongs       = [];
                node._savedCategory  = undefined;

                // ── Category filter combo ─────────────────────────────────────────
                const categoryWidget = node.addWidget(
                    "combo",
                    "category_filter",
                    "--all categories--",
                    (v) => applyFilter(node, v),
                    { values: ["--all categories--"] }
                );
                categoryWidget.label = "Category";

                // Move category_filter to appear right before saved_song
                if (dropdownWidget) {
                    const dropIdx = node.widgets.indexOf(dropdownWidget);
                    const catIdx  = node.widgets.indexOf(categoryWidget);
                    if (dropIdx >= 0 && catIdx > dropIdx) {
                        node.widgets.splice(catIdx, 1);
                        node.widgets.splice(dropIdx, 0, categoryWidget);
                    }
                }

                // ── Song dropdown callback → load on select ───────────────────────
                if (dropdownWidget) {
                    dropdownWidget.callback = function(value) {
                        if (value && value !== "--select song--" && value !== "--no songs found--") {
                            loadSong(node, value);
                        }
                    };
                }

                // ── Category text entry (for saving/updating songs) ───────────────
                const songCategoryWidget = node.addWidget(
                    "text",
                    "song_category",
                    "Song",
                    () => {},
                    {}
                );
                songCategoryWidget.label = "Song Category";

                // ── Action buttons ────────────────────────────────────────────────
                node.addWidget("button", "💾 Save Song",     null, () => showSaveDialog(node));
                node.addWidget("button", "✏️ Update Selected", null, () => updateSong(node));
                node.addWidget("button", "🔄 Refresh List",    null, () => refreshSongs(node));

                // ── Initial size & responsiveness ─────────────────────────────────
                node.size = [540, 720];
                node.resizable = true;

                // Auto-populate song list on first creation
                requestAnimationFrame(() => refreshSongs(node));

                return r;
            };

            // ── onConfigure (workflow load / paste) ───────────────────────────────
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(config) {
                if (onConfigure) onConfigure.apply(this, arguments);
                const vals = config?.widgets_values;
                if (!vals) return;

                // Restore custom added widgets if present in serialized state
                const cfw = this.widgets?.find(w => w.name === "category_filter");
                const scw = this.widgets?.find(w => w.name === "song_category");

                // Check serialized category
                if (this._serializedCategory !== undefined && cfw) {
                    cfw.value = this._serializedCategory;
                }
                if (this._serializedSongCategory !== undefined && scw) {
                    scw.value = this._serializedSongCategory;
                    if (scw.inputEl) scw.inputEl.value = this._serializedSongCategory;
                }
            };

            // ── onSerialize ───────────────────────────────────────────────────────
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                if (onSerialize) onSerialize.apply(this, arguments);
                const cfw = this.widgets?.find(w => w.name === "category_filter");
                const scw = this.widgets?.find(w => w.name === "song_category");
                if (cfw) this._serializedCategory = cfw.value;
                if (scw) this._serializedSongCategory = scw.value;
            };

            // ── Helper: set widget value AND update DOM input if available ────────
            function setWidgetValue(widget, value) {
                if (!widget) return;
                widget.value = value;
                if (widget.inputEl) widget.inputEl.value = value;
            }

            // ── Load a song JSON file from backend ────────────────────────────────
            function loadSong(node, filename) {
                fetch("/modusflow/song/load", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.data) {
                        const s = data.data;
                        if (s.title !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "title"), s.title);
                        if (s.genre !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "genre"), s.genre);
                        if (s.vocal_style !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "vocal_style"), s.vocal_style);
                        if (s.mood !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "mood"), s.mood);
                        if (s.template !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "template"), s.template);
                        if (s.lyrics !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "lyrics"), s.lyrics);
                        if (s.additional_style !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "additional_style"), s.additional_style);
                        if (s.negative_style !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "negative_style"), s.negative_style);
                        if (s.category !== undefined) setWidgetValue(node.widgets?.find(w => w.name === "song_category"), s.category);

                        app.graph.setDirtyCanvas(true, true);
                    } else {
                        console.error("[ModusFlow SongWriter] Load error:", data.message);
                    }
                })
                .catch(err => console.error("[ModusFlow SongWriter] Load error:", err.message));
            }

            // ── Filter saved_song dropdown by category ────────────────────────────
            function applyFilter(node, category) {
                const dw = node.widgets?.find(w => w.name === "saved_song");
                if (!dw) return;
                const all = node._allSongs || [];
                const filenames = (!category || category === "--all categories--")
                    ? all.map(p => p.filename)
                    : all.filter(p => (p.category || "Song") === category).map(p => p.filename);

                dw.options.values = filenames.length
                    ? ["--select song--", ...filenames]
                    : ["--no songs found--"];

                if (!dw.options.values.includes(dw.value)) {
                    dw.value = dw.options.values[0];
                }
                app.graph.setDirtyCanvas(true, true);
            }

            // ── Fetch song list; rebuild category combo + dropdown ────────────────
            function refreshSongs(node) {
                const dw = node.widgets?.find(w => w.name === "saved_song");
                const cw = node.widgets?.find(w => w.name === "category_filter");
                if (!dw) return;

                fetch("/modusflow/song/list")
                    .then(r => r.json())
                    .then(data => {
                        if (!data.success) return;
                        node._allSongs = data.data;

                        const cats = [...new Set(
                            data.data.map(p => (p.category || "Song").trim()).filter(Boolean)
                        )].sort();

                        if (cw) {
                            const target = (node._savedCategory !== undefined)
                                ? node._savedCategory
                                : cw.value;
                            node._savedCategory = undefined;

                            cw.options.values = ["--all categories--", ...cats];
                            cw.value = cw.options.values.includes(target) ? target : "--all categories--";
                        }
                        applyFilter(node, cw ? cw.value : "--all categories--");
                    })
                    .catch(err => console.error("[ModusFlow SongWriter] Refresh error:", err.message));
            }

            // ── Save current song to a new JSON file ──────────────────────────────
            function showSaveDialog(node) {
                const tw  = node.widgets?.find(w => w.name === "title");
                const gw  = node.widgets?.find(w => w.name === "genre");
                const vw  = node.widgets?.find(w => w.name === "vocal_style");
                const mw  = node.widgets?.find(w => w.name === "mood");
                const tmw = node.widgets?.find(w => w.name === "template");
                const lw  = node.widgets?.find(w => w.name === "lyrics");
                const aw  = node.widgets?.find(w => w.name === "additional_style");
                const nw  = node.widgets?.find(w => w.name === "negative_style");
                const scw = node.widgets?.find(w => w.name === "song_category");

                const defaultName = (tw?.value || "").trim().replace(/[\\/:*?"<>|]/g, "_") || "My Song";
                const filename = prompt("Filename (without extension):", defaultName);
                if (!filename?.trim()) return;

                const category = (scw?.value || "").trim() || "Song";

                fetch("/modusflow/song/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: filename.trim(),
                        category: category,
                        title: tw?.value || "",
                        genre: gw?.value || "",
                        vocal_style: vw?.value || "",
                        mood: mw?.value || "",
                        template: tmw?.value || "",
                        lyrics: lw?.value || "",
                        additional_style: aw?.value || "",
                        negative_style: nw?.value || ""
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert("Song saved: " + filename.trim() + ".json");
                        refreshSongs(node);
                    } else {
                        alert("Save failed: " + data.message);
                    }
                })
                .catch(err => alert("Save error: " + err.message));
            }

            // ── Overwrite the currently selected song ─────────────────────────────
            function updateSong(node) {
                const tw  = node.widgets?.find(w => w.name === "title");
                const gw  = node.widgets?.find(w => w.name === "genre");
                const vw  = node.widgets?.find(w => w.name === "vocal_style");
                const mw  = node.widgets?.find(w => w.name === "mood");
                const tmw = node.widgets?.find(w => w.name === "template");
                const lw  = node.widgets?.find(w => w.name === "lyrics");
                const aw  = node.widgets?.find(w => w.name === "additional_style");
                const nw  = node.widgets?.find(w => w.name === "negative_style");
                const dw  = node.widgets?.find(w => w.name === "saved_song");
                const scw = node.widgets?.find(w => w.name === "song_category");

                const selected = dw?.value;
                if (!selected || selected === "--select song--" || selected === "--no songs found--") {
                    alert("Select a saved song from the dropdown first.");
                    return;
                }
                if (!confirm('Overwrite "' + selected + '" with current lyrics and styles?')) return;

                const base = selected.replace(/\.json$/i, "");
                const category = (scw?.value || "").trim() || "Song";

                fetch("/modusflow/song/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: base,
                        category: category,
                        title: tw?.value || "",
                        genre: gw?.value || "",
                        vocal_style: vw?.value || "",
                        mood: mw?.value || "",
                        template: tmw?.value || "",
                        lyrics: lw?.value || "",
                        additional_style: aw?.value || "",
                        negative_style: nw?.value || ""
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert('"' + selected + '" updated.');
                    } else {
                        alert("Update failed: " + data.message);
                    }
                })
                .catch(err => alert("Update error: " + err.message));
            }
        }
    }
});
