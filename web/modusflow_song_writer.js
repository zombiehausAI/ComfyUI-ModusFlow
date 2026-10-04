import { app } from "../../scripts/app.js";

// ModusFlow Song Writer & Lyric Studio — Popout Cockpit & Canvas Integration

app.registerExtension({
    name: "modusflow.SongWriter",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowSongWriter") {

            // ── Global Stylesheet Injection ───────────────────────────────────────
            if (!document.getElementById("modusflow-songwriter-styles")) {
                const styleEl = document.createElement("style");
                styleEl.id = "modusflow-songwriter-styles";
                styleEl.textContent = `
                    .modusflow-sw-window {
                        position: fixed;
                        display: flex;
                        flex-direction: column;
                        background: #181825;
                        border: 1px solid #313244;
                        border-radius: 12px;
                        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
                        z-index: 10002;
                        min-width: 860px;
                        min-height: 560px;
                        overflow: hidden;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        color: #cdd6f4;
                        user-select: none;
                        transition: opacity 0.15s ease, transform 0.15s ease;
                    }
                    .modusflow-sw-window.is-minimized {
                        height: 44px !important;
                        min-height: 44px !important;
                        overflow: hidden;
                    }
                    .modusflow-sw-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 8px 14px;
                        background: #11111b;
                        border-bottom: 1px solid #313244;
                        cursor: move;
                    }
                    .modusflow-sw-title {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                        font-weight: 700;
                        color: #cdd6f4;
                        letter-spacing: 0.3px;
                    }
                    .modusflow-sw-badge {
                        background: rgba(137, 180, 250, 0.15);
                        border: 1px solid rgba(137, 180, 250, 0.35);
                        color: #89b4fa;
                        font-size: 11px;
                        font-weight: 600;
                        padding: 2px 8px;
                        border-radius: 12px;
                    }
                    .modusflow-sw-stats {
                        font-size: 11px;
                        color: #a6adc8;
                        font-family: ui-monospace, monospace;
                    }
                    .modusflow-sw-actions {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .modusflow-sw-btn {
                        background: #1e1e2e;
                        border: 1px solid #313244;
                        color: #cdd6f4;
                        border-radius: 6px;
                        padding: 4px 9px;
                        font-size: 11px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        font-family: inherit;
                        transition: all 0.12s ease;
                        white-space: nowrap;
                    }
                    .modusflow-sw-btn:hover {
                        background: #313244;
                        border-color: #89b4fa;
                        color: #ffffff;
                    }
                    .modusflow-sw-btn:disabled {
                        opacity: 0.4 !important;
                        cursor: not-allowed !important;
                        border-color: #313244 !important;
                    }
                    .modusflow-sw-btn-primary {
                        background: linear-gradient(135deg, #89b4fa, #b4befe);
                        color: #11111b;
                        border: none;
                        font-weight: 700;
                    }
                    .modusflow-sw-btn-primary:hover {
                        background: linear-gradient(135deg, #b4befe, #cba6f7);
                        color: #11111b;
                    }
                    .modusflow-sw-btn-accent {
                        background: rgba(243, 139, 168, 0.15);
                        border-color: rgba(243, 139, 168, 0.4);
                        color: #f38ba8;
                    }
                    .modusflow-sw-btn-accent:hover {
                        background: #f38ba8;
                        color: #11111b;
                    }
                    .modusflow-sw-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 7px 12px;
                        background: #181825;
                        border-bottom: 1px solid #313244;
                        flex-wrap: wrap;
                    }
                    .modusflow-sw-body {
                        display: flex;
                        flex: 1;
                        min-height: 0;
                        overflow: hidden;
                        background: #181825;
                    }
                    .modusflow-sw-pane {
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                        padding: 10px 14px;
                    }
                    .modusflow-sw-pane-left {
                        flex: 1.5;
                        border-right: 1px solid #313244;
                    }
                    .modusflow-sw-pane-right {
                        flex: 1.1;
                        background: #14141f;
                        overflow-y: auto;
                    }
                    .modusflow-sw-pane-head {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                        font-weight: 700;
                        color: #89b4fa;
                        letter-spacing: 0.5px;
                        margin-bottom: 6px;
                    }
                    .modusflow-sw-ribbon {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        flex-wrap: wrap;
                        padding: 4px 0 8px 0;
                    }
                    .modusflow-sw-chip {
                        background: #11111b;
                        border: 1px solid #313244;
                        color: #a6adc8;
                        border-radius: 4px;
                        padding: 2px 7px;
                        font-size: 10px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.1s ease;
                    }
                    .modusflow-sw-chip:hover {
                        background: #313244;
                        border-color: #89b4fa;
                        color: #89b4fa;
                        transform: translateY(-1px);
                    }
                    .modusflow-sw-editor-wrap {
                        position: relative;
                        flex: 1;
                        min-height: 0;
                        border: 1px solid #313244;
                        border-radius: 8px;
                        background: #11111b;
                        overflow: hidden;
                    }
                    .modusflow-sw-backdrop {
                        position: absolute;
                        inset: 0;
                        padding: 10px;
                        margin: 0;
                        overflow: auto;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        color: #cdd6f4;
                        pointer-events: none;
                        font-family: inherit;
                        font-size: inherit;
                        line-height: 1.5;
                        box-sizing: border-box;
                        z-index: 1;
                    }
                    .modusflow-sw-textarea {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        height: 100%;
                        padding: 10px;
                        margin: 0;
                        border: none;
                        outline: none;
                        background: transparent;
                        color: transparent;
                        -webkit-text-fill-color: transparent;
                        caret-color: #89b4fa;
                        resize: none;
                        font-family: inherit;
                        font-size: inherit;
                        line-height: 1.5;
                        box-sizing: border-box;
                        z-index: 2;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    .modusflow-sw-textarea::selection {
                        background: rgba(137, 180, 250, 0.35);
                        color: transparent;
                    }
                    .modusflow-sw-section-tag {
                        color: #cba6f7;
                        font-weight: 800;
                        background: rgba(203, 166, 247, 0.12);
                        border-radius: 3px;
                        padding: 1px 4px;
                    }
                    .modusflow-sw-cue-tag {
                        color: #a6e3a1;
                        font-style: italic;
                    }
                    .modusflow-sw-chord-tag {
                        color: #fab387;
                        font-weight: 700;
                    }
                    .modusflow-sw-comment-tag {
                        color: #6c7086;
                        font-style: italic;
                    }
                    .modusflow-sw-input {
                        width: 100%;
                        background: #11111b;
                        border: 1px solid #313244;
                        border-radius: 6px;
                        color: #cdd6f4;
                        font-size: 11px;
                        padding: 5px 8px;
                        outline: none;
                        box-sizing: border-box;
                        transition: border-color 0.15s ease;
                    }
                    .modusflow-sw-input:focus {
                        border-color: #89b4fa;
                    }
                    .modusflow-sw-label {
                        font-size: 10px;
                        font-weight: 700;
                        color: #a6adc8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-top: 8px;
                        margin-bottom: 3px;
                    }
                    .modusflow-sw-toast {
                        position: absolute;
                        bottom: 16px;
                        right: 16px;
                        background: #11111b;
                        border: 1px solid #89b4fa;
                        color: #89b4fa;
                        padding: 6px 14px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: 600;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                        z-index: 10010;
                        pointer-events: none;
                        opacity: 0;
                        transform: translateY(6px);
                        transition: all 0.2s ease;
                    }
                    .modusflow-sw-toast.show {
                        opacity: 1;
                        transform: translateY(0);
                    }
                `;
                document.head.appendChild(styleEl);
            }

            // ── Toast notification helper ─────────────────────────────────────────
            function showSwToast(msg, parentEl) {
                let toast = parentEl?.querySelector(".modusflow-sw-toast");
                if (!toast) {
                    toast = document.createElement("div");
                    toast.className = "modusflow-sw-toast";
                    (parentEl || document.body).appendChild(toast);
                }
                toast.textContent = msg;
                toast.classList.add("show");
                clearTimeout(toast._timer);
                toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
            }

            // ── Escape HTML utility ───────────────────────────────────────────────
            function escapeHtml(str) {
                return (str || "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            // ── Lyric syntax tokenizer ────────────────────────────────────────────
            function tokenizeLyricsToHtml(text) {
                if (!text) return "";
                const tokens = [];
                const addMatches = (regex, type) => {
                    let m;
                    while ((m = regex.exec(text)) !== null) {
                        tokens.push({ start: m.index, end: m.index + m[0].length, type, raw: m[0] });
                    }
                };

                // Section Headers: [Verse 1], [Chorus], [Bridge], [Intro], etc.
                addMatches(/\[[^\]\r\n]+\]/g, "section");
                // Backing vocals / performance cues: (backing vocals), (harmonica solo), etc.
                addMatches(/\([^\)\r\n]+\)/g, "cue");
                // Musical chord tags or timing: {chorus}, {120bpm}, {C#m}
                addMatches(/\{[^\}\r\n]+\}/g, "chord");
                // Comments: // ... or # ...
                addMatches(/(?:\/\/|#)[^\r\n]*/g, "comment");

                // Filter overlaps
                tokens.sort((a, b) => a.start - b.start || b.end - a.end);
                const nonOverlapping = [];
                let lastEnd = 0;
                for (const t of tokens) {
                    if (t.start >= lastEnd) {
                        nonOverlapping.push(t);
                        lastEnd = t.end;
                    }
                }

                let html = "";
                let cursor = 0;
                for (const t of nonOverlapping) {
                    if (t.start > cursor) {
                        html += escapeHtml(text.slice(cursor, t.start));
                    }
                    const body = escapeHtml(t.raw);
                    if (t.type === "section") {
                        html += `<span class="modusflow-sw-section-tag">${body}</span>`;
                    } else if (t.type === "cue") {
                        html += `<span class="modusflow-sw-cue-tag">${body}</span>`;
                    } else if (t.type === "chord") {
                        html += `<span class="modusflow-sw-chord-tag">${body}</span>`;
                    } else if (t.type === "comment") {
                        html += `<span class="modusflow-sw-comment-tag">${body}</span>`;
                    }
                    cursor = t.end;
                }
                if (cursor < text.length) {
                    html += escapeHtml(text.slice(cursor));
                }
                if (text.endsWith("\n")) {
                    html += "<br>&nbsp;";
                }
                return html;
            }

            // ── Popout Songwriter Studio Window ───────────────────────────────────
            function showPopoutSongwriterStudio(node) {
                if (node._swStudioEl && document.body.contains(node._swStudioEl)) {
                    if (node._swStudioEl.classList.contains("is-minimized")) {
                        node._swStudioEl.classList.remove("is-minimized");
                    }
                    const currentZ = parseInt(node._swStudioEl.style.zIndex || "10002", 10);
                    node._swStudioEl.style.zIndex = String(currentZ + 1);
                    node._swStudioEl.querySelector("textarea")?.focus();
                    showSwToast("Songwriter Studio brought to front", node._swStudioEl);
                    return;
                }

                const titleWidget = node.widgets?.find(w => w.name === "title");
                const genreWidget = node.widgets?.find(w => w.name === "genre");
                const vocalWidget = node.widgets?.find(w => w.name === "vocal_style");
                const moodWidget = node.widgets?.find(w => w.name === "mood");
                const tmplWidget = node.widgets?.find(w => w.name === "template");
                const lyricsWidget = node.widgets?.find(w => w.name === "lyrics");
                const addStyleWidget = node.widgets?.find(w => w.name === "additional_style");
                const negStyleWidget = node.widgets?.find(w => w.name === "negative_style");
                const savedSongWidget = node.widgets?.find(w => w.name === "saved_song");
                const catFilterWidget = node.widgets?.find(w => w.name === "category_filter");
                const songCatWidget = node.widgets?.find(w => w.name === "song_category");

                if (!lyricsWidget) return;

                const win = document.createElement("div");
                win.className = "modusflow-sw-window";
                node._swStudioEl = win;

                let z = typeof window._swPopoutZIndex === "number" ? ++window._swPopoutZIndex : 10002;
                window._swPopoutZIndex = z;
                win.style.zIndex = String(z);

                const defW = Math.min(1240, Math.floor(window.innerWidth * 0.92));
                const defH = Math.min(840, Math.floor(window.innerHeight * 0.88));
                const defTop = Math.max(30, Math.floor((window.innerHeight - defH) / 2));
                const defLeft = Math.max(30, Math.floor((window.innerWidth - defW) / 2));

                let savedRect = null;
                try {
                    const raw = localStorage.getItem("modusflow_songwriter_geometry");
                    if (raw) savedRect = JSON.parse(raw);
                } catch (_) {}

                if (savedRect && savedRect.width && savedRect.height) {
                    win.style.top = savedRect.top;
                    win.style.left = savedRect.left;
                    win.style.width = savedRect.width;
                    win.style.height = savedRect.height;
                } else {
                    win.style.top = `${defTop}px`;
                    win.style.left = `${defLeft}px`;
                    win.style.width = `${defW}px`;
                    win.style.height = `${defH}px`;
                }

                // ── Header Bar with Dragging ──────────────────────────────────────────
                const header = document.createElement("div");
                header.className = "modusflow-sw-header";

                const titleGroup = document.createElement("div");
                titleGroup.className = "modusflow-sw-title";
                titleGroup.innerHTML = `
                    <span>🎵 Songwriter &amp; Lyric Studio</span>
                    <span class="modusflow-sw-badge">#${node.id || "Song"} ${escapeHtml(titleWidget?.value || "Untitled")}</span>
                    <span class="modusflow-sw-stats" id="mf-sw-stats-header">0 words • ~0:00</span>
                `;

                const winActions = document.createElement("div");
                winActions.className = "modusflow-sw-actions";

                const queueBtn = document.createElement("button");
                queueBtn.className = "modusflow-sw-btn modusflow-sw-btn-primary";
                queueBtn.innerHTML = "🚀 Queue";
                queueBtn.title = "Queue Generation (Ctrl+Enter)";
                queueBtn.onclick = () => {
                    const q = document.getElementById("queue-button");
                    if (q) q.click();
                    else app.queuePrompt?.(0);
                    showSwToast("🚀 Prompt Queued!", win);
                };

                const minBtn = document.createElement("button");
                minBtn.className = "modusflow-sw-btn";
                minBtn.innerHTML = "🗕";
                minBtn.title = "Minimize Studio";
                minBtn.onclick = () => win.classList.toggle("is-minimized");

                const maxBtn = document.createElement("button");
                maxBtn.className = "modusflow-sw-btn";
                maxBtn.innerHTML = "⛶";
                maxBtn.title = "Maximize / Restore";
                maxBtn.onclick = () => {
                    if (win._isMaximized) {
                        win.style.top = win._preMaxTop || `${defTop}px`;
                        win.style.left = win._preMaxLeft || `${defLeft}px`;
                        win.style.width = win._preMaxW || `${defW}px`;
                        win.style.height = win._preMaxH || `${defH}px`;
                        win._isMaximized = false;
                    } else {
                        win._preMaxTop = win.style.top;
                        win._preMaxLeft = win.style.left;
                        win._preMaxW = win.style.width;
                        win._preMaxH = win.style.height;
                        win.style.top = "10px";
                        win.style.left = "10px";
                        win.style.width = "calc(100vw - 20px)";
                        win.style.height = "calc(100vh - 20px)";
                        win._isMaximized = true;
                    }
                };

                const closeBtn = document.createElement("button");
                closeBtn.className = "modusflow-sw-btn modusflow-sw-btn-accent";
                closeBtn.innerHTML = "✕ Dock";
                closeBtn.title = "Close Popout Studio and dock to canvas";
                closeBtn.onclick = () => closePopoutStudio();

                winActions.appendChild(queueBtn);
                winActions.appendChild(minBtn);
                winActions.appendChild(maxBtn);
                winActions.appendChild(closeBtn);

                header.appendChild(titleGroup);
                header.appendChild(winActions);
                win.appendChild(header);

                // Dragging handler
                let isDragging = false;
                let dragOffX = 0;
                let dragOffY = 0;

                header.addEventListener("mousedown", (e) => {
                    if (e.target.closest("button") || e.target.closest("select")) return;
                    isDragging = true;
                    dragOffX = e.clientX - win.offsetLeft;
                    dragOffY = e.clientY - win.offsetTop;
                    const onMove = (ev) => {
                        if (!isDragging) return;
                        const nx = Math.max(10, Math.min(window.innerWidth - 120, ev.clientX - dragOffX));
                        const ny = Math.max(10, Math.min(window.innerHeight - 50, ev.clientY - dragOffY));
                        win.style.left = `${nx}px`;
                        win.style.top = `${ny}px`;
                    };
                    const onUp = () => {
                        isDragging = false;
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                        try {
                            localStorage.setItem("modusflow_songwriter_geometry", JSON.stringify({
                                top: win.style.top,
                                left: win.style.left,
                                width: win.style.width,
                                height: win.style.height
                            }));
                        } catch (_) {}
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                });

                // ── Workspace Toolbar ────────────────────────────────────────────────
                const toolbar = document.createElement("div");
                toolbar.className = "modusflow-sw-toolbar";

                function addToolBtn(iconText, title, onClick, extraStyle = "") {
                    const btn = document.createElement("button");
                    btn.className = "modusflow-sw-btn";
                    if (extraStyle) btn.style.cssText += extraStyle;
                    btn.innerHTML = iconText;
                    btn.title = title;
                    btn.onclick = (e) => {
                        e.preventDefault();
                        onClick();
                    };
                    toolbar.appendChild(btn);
                    return btn;
                }

                // Category selector
                const catSel = document.createElement("select");
                catSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #89b4fa; font-size: 11px; font-weight: 600; padding: 4px 6px; outline: none; cursor: pointer; max-width: 130px;";
                catSel.title = "Song Category Filter";

                // Song selector
                const songSel = document.createElement("select");
                songSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #a6e3a1; font-size: 11px; font-weight: 600; padding: 4px 6px; outline: none; cursor: pointer; max-width: 170px;";
                songSel.title = "Select Saved Song";

                function populateSwSongDropdowns() {
                    const all = node._allSongs || [];
                    const cats = [...new Set(all.map(s => (s.category || "Song").trim()).filter(Boolean))].sort();

                    const savedCat = catFilterWidget?.value || "--all categories--";
                    catSel.innerHTML = "";
                    const allOpt = document.createElement("option");
                    allOpt.value = "--all categories--";
                    allOpt.textContent = "📁 All Categories";
                    catSel.appendChild(allOpt);
                    cats.forEach(c => {
                        const opt = document.createElement("option");
                        opt.value = c;
                        opt.textContent = `📂 ${c}`;
                        if (c === savedCat) opt.selected = true;
                        catSel.appendChild(opt);
                    });

                    const curCat = catSel.value;
                    const filtered = (!curCat || curCat === "--all categories--")
                        ? all
                        : all.filter(s => (s.category || "Song") === curCat);

                    songSel.innerHTML = "";
                    if (!filtered.length) {
                        const emptyOpt = document.createElement("option");
                        emptyOpt.value = "--no songs found--";
                        emptyOpt.textContent = "No Songs Found";
                        songSel.appendChild(emptyOpt);
                    } else {
                        const defOpt = document.createElement("option");
                        defOpt.value = "--select song--";
                        defOpt.textContent = "Select Song...";
                        songSel.appendChild(defOpt);
                        filtered.forEach(s => {
                            const opt = document.createElement("option");
                            opt.value = s.filename;
                            opt.textContent = s.filename;
                            if (s.filename === savedSongWidget?.value) opt.selected = true;
                            songSel.appendChild(opt);
                        });
                    }
                }

                catSel.onchange = () => {
                    if (catFilterWidget) catFilterWidget.value = catSel.value;
                    populateSwSongDropdowns();
                };

                songSel.onchange = () => {
                    const val = songSel.value;
                    if (val && val !== "--select song--" && val !== "--no songs found--") {
                        loadSong(node, val);
                        if (savedSongWidget) savedSongWidget.value = val;
                        syncPopoutFromNode();
                    }
                };

                toolbar.appendChild(catSel);
                toolbar.appendChild(songSel);

                addToolBtn("💾 Save", "Save song preset to file", () => showSaveDialog(node));
                addToolBtn("🗂️ Update", "Update selected song file", () => updateSong(node));
                addToolBtn("🔄 Refresh", "Refresh saved songs list", () => {
                    refreshSongs(node);
                    setTimeout(populateSwSongDropdowns, 200);
                });

                const sep1 = document.createElement("div");
                sep1.style.cssText = "width: 1px; height: 18px; background: #313244; margin: 0 4px;";
                toolbar.appendChild(sep1);

                // Undo / Redo controls
                const undoBtn = addToolBtn("↩ Undo", "Undo last lyric/style change (Ctrl+Z)", () => doPopoutUndo());
                const redoBtn = addToolBtn("↪ Redo", "Redo last change (Ctrl+Y / Ctrl+Shift+Z)", () => doPopoutRedo());

                // Typography Controls
                const POPOUT_FONT_FAMILIES = {
                    "Monospace": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    "JetBrains Mono": "'JetBrains Mono', Consolas, Monaco, monospace",
                    "Fira Code": "'Fira Code', 'Cascadia Code', Consolas, monospace",
                    "Clean Sans": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    "Editorial Serif": "'Georgia', 'Cambria', 'Times New Roman', serif"
                };

                let savedFontKey = "Monospace";
                try {
                    const sf = localStorage.getItem("modusflow_songwriter_font_family");
                    if (sf && POPOUT_FONT_FAMILIES[sf]) savedFontKey = sf;
                } catch (_) {}

                let savedFontSize = 14;
                try {
                    const rawSz = localStorage.getItem("modusflow_songwriter_font_size");
                    if (rawSz) savedFontSize = parseInt(rawSz, 10) || 14;
                } catch (_) {}
                savedFontSize = Math.max(10, Math.min(32, savedFontSize));

                const fontSel = document.createElement("select");
                fontSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #cdd6f4; font-size: 11px; padding: 4px 6px; outline: none; cursor: pointer; max-width: 130px;";
                fontSel.title = "Select Songwriter Font Family";
                Object.keys(POPOUT_FONT_FAMILIES).forEach(k => {
                    const opt = document.createElement("option");
                    opt.value = k;
                    opt.textContent = k;
                    if (k === savedFontKey) opt.selected = true;
                    fontSel.appendChild(opt);
                });

                const sizeGroup = document.createElement("div");
                sizeGroup.style.cssText = "display: inline-flex; align-items: center; background: #11111b; border: 1px solid #313244; border-radius: 5px; overflow: hidden;";

                const sizeDecBtn = document.createElement("button");
                sizeDecBtn.className = "modusflow-sw-btn";
                sizeDecBtn.style.cssText = "border: none; border-radius: 0; padding: 3px 6px; font-size: 11px; font-weight: bold; background: transparent;";
                sizeDecBtn.textContent = "A-";
                sizeDecBtn.title = "Decrease font size";

                const sizeSel = document.createElement("select");
                sizeSel.style.cssText = "background: transparent; border: none; color: #89b4fa; font-size: 11px; font-weight: 600; padding: 3px 4px; outline: none; cursor: pointer;";
                [11, 12, 13, 14, 15, 16, 18, 20, 22, 24].forEach(sz => {
                    const opt = document.createElement("option");
                    opt.value = sz;
                    opt.textContent = `${sz}px`;
                    if (sz === savedFontSize) opt.selected = true;
                    sizeSel.appendChild(opt);
                });

                const sizeIncBtn = document.createElement("button");
                sizeIncBtn.className = "modusflow-sw-btn";
                sizeIncBtn.style.cssText = "border: none; border-radius: 0; padding: 3px 6px; font-size: 11px; font-weight: bold; background: transparent;";
                sizeIncBtn.textContent = "A+";
                sizeIncBtn.title = "Increase font size";

                sizeGroup.appendChild(sizeDecBtn);
                sizeGroup.appendChild(sizeSel);
                sizeGroup.appendChild(sizeIncBtn);

                toolbar.appendChild(fontSel);
                toolbar.appendChild(sizeGroup);

                addToolBtn("🦙 Ollama AI", "Generate or refine lyrics with Ollama LLM", () => {
                    const eb = node.widgets?.find(w => w.name && w.name.includes("ai_mode"));
                    if (eb) {
                        eb.value = eb.value === "disabled" ? "generate_all" : "disabled";
                        eb.callback?.(eb.value);
                        showSwToast(`AI Mode: ${eb.value}`, win);
                    }
                });

                addToolBtn("🧹 Prettify", "Prettify structure and normalize line spacing", () => {
                    if (lyricsTa) {
                        lyricsTa.value = lyricsTa.value
                            .replace(/\r\n/g, "\n")
                            .replace(/\n{3,}/g, "\n\n")
                            .trim();
                        onLyricsInput();
                        pushPopoutHistory();
                        showSwToast("✨ Structure Prettified", win);
                    }
                });

                win.appendChild(toolbar);

                // ── Workspace Dual Pane Body ─────────────────────────────────────────
                const body = document.createElement("div");
                body.className = "modusflow-sw-body";

                // Left Pane: Lyric Editor
                const leftPane = document.createElement("div");
                leftPane.className = "modusflow-sw-pane modusflow-sw-pane-left";

                const leftHead = document.createElement("div");
                leftHead.className = "modusflow-sw-pane-head";
                leftHead.innerHTML = `
                    <span>LYRICS &amp; SONG STRUCTURE</span>
                    <span id="mf-sw-left-stats" style="font-weight: normal; color: #a6adc8; font-family: ui-monospace, monospace;">0 lines • 0 words</span>
                `;
                leftPane.appendChild(leftHead);

                // Section Ribbon
                const ribbon = document.createElement("div");
                ribbon.className = "modusflow-sw-ribbon";

                const sections = [
                    "[Intro]",
                    "[Verse 1]",
                    "[Verse 2]",
                    "[Pre-Chorus]",
                    "[Chorus]",
                    "[Hook]",
                    "[Bridge]",
                    "[Solo]",
                    "[Outro]",
                    "(Backing Vocals)"
                ];

                function insertSectionTag(tag) {
                    if (!lyricsTa) return;
                    const start = lyricsTa.selectionStart;
                    const end = lyricsTa.selectionEnd;
                    const val = lyricsTa.value;
                    const prefix = (start > 0 && val[start - 1] !== "\n") ? "\n\n" : "";
                    const suffix = "\n";
                    const insertText = `${prefix}${tag}${suffix}`;
                    lyricsTa.value = val.slice(0, start) + insertText + val.slice(end);
                    const newPos = start + insertText.length;
                    lyricsTa.setSelectionRange(newPos, newPos);
                    lyricsTa.focus();
                    onLyricsInput();
                    pushPopoutHistory();
                }

                sections.forEach(tag => {
                    const chip = document.createElement("button");
                    chip.className = "modusflow-sw-chip";
                    chip.textContent = tag;
                    chip.title = `Insert ${tag} at cursor`;
                    chip.onclick = (e) => {
                        e.preventDefault();
                        insertSectionTag(tag);
                    };
                    ribbon.appendChild(chip);
                });
                leftPane.appendChild(ribbon);

                // Editor wrapper
                const editorWrap = document.createElement("div");
                editorWrap.className = "modusflow-sw-editor-wrap";

                const lyricsBackdrop = document.createElement("div");
                lyricsBackdrop.className = "modusflow-sw-backdrop";

                const lyricsTa = document.createElement("textarea");
                lyricsTa.className = "modusflow-sw-textarea";
                lyricsTa.spellcheck = false;
                lyricsTa.placeholder = "Write lyrics here...\n\n[Verse 1]\nYour verses start here\n\n[Chorus]\nSing the chorus loud\n\n(backing vocals)";
                lyricsTa.value = lyricsWidget.value || "";

                editorWrap.appendChild(lyricsBackdrop);
                editorWrap.appendChild(lyricsTa);
                leftPane.appendChild(editorWrap);

                // Right Pane: Musical Style & Song Metadata
                const rightPane = document.createElement("div");
                rightPane.className = "modusflow-sw-pane modusflow-sw-pane-right";

                const rightHead = document.createElement("div");
                rightHead.className = "modusflow-sw-pane-head";
                rightHead.innerHTML = `<span>MUSICAL STYLE &amp; ARRANGEMENT</span>`;
                rightPane.appendChild(rightHead);

                function createField(labelText, value, onChange, placeholder = "") {
                    const lbl = document.createElement("div");
                    lbl.className = "modusflow-sw-label";
                    lbl.textContent = labelText;
                    const inp = document.createElement("input");
                    inp.type = "text";
                    inp.className = "modusflow-sw-input";
                    inp.value = value || "";
                    inp.placeholder = placeholder;
                    inp.oninput = () => onChange(inp.value);
                    rightPane.appendChild(lbl);
                    rightPane.appendChild(inp);
                    return inp;
                }

                const titleInp = createField("Song Title", titleWidget?.value, (v) => {
                    if (titleWidget) setWidgetValue(titleWidget, v);
                    titleGroup.querySelector(".modusflow-sw-badge").textContent = `#${node.id} ${v || "Untitled"}`;
                }, "Song title...");

                const genreInp = createField("Genre / Music Style", genreWidget?.value, (v) => {
                    if (genreWidget) setWidgetValue(genreWidget, v);
                }, "e.g. Synthwave, Modern Rock, Acoustic Ballad");

                const vocalInp = createField("Vocal Style", vocalWidget?.value, (v) => {
                    if (vocalWidget) setWidgetValue(vocalWidget, v);
                }, "e.g. Expressive female lead, Husky male, Ethereal choir");

                const moodInp = createField("Mood / Atmosphere", moodWidget?.value, (v) => {
                    if (moodWidget) setWidgetValue(moodWidget, v);
                }, "e.g. Melancholic, Euphoric, Energetic, Haunting");

                // Style Quick Chips (Pedals)
                const styleChipsLbl = document.createElement("div");
                styleChipsLbl.className = "modusflow-sw-label";
                styleChipsLbl.textContent = "Musical Style Pedals (Click to add)";
                rightPane.appendChild(styleChipsLbl);

                const stylePedalsWrap = document.createElement("div");
                stylePedalsWrap.className = "modusflow-sw-ribbon";

                const stylePedals = [
                    "Studio Master",
                    "Analog Warmth",
                    "Clear Vocals",
                    "Punchy 808",
                    "Driving Bass",
                    "Epic Reverb",
                    "Acoustic Live",
                    "Atmospheric Strings"
                ];

                stylePedals.forEach(p => {
                    const chip = document.createElement("button");
                    chip.className = "modusflow-sw-chip";
                    chip.textContent = `+ ${p}`;
                    chip.onclick = (e) => {
                        e.preventDefault();
                        if (addStyleTa) {
                            const cur = addStyleTa.value.trim();
                            if (!cur.includes(p)) {
                                addStyleTa.value = cur ? `${cur}, ${p}` : p;
                                if (addStyleWidget) setWidgetValue(addStyleWidget, addStyleTa.value);
                                showSwToast(`Added style: ${p}`, win);
                            }
                        }
                    };
                    stylePedalsWrap.appendChild(chip);
                });
                rightPane.appendChild(stylePedalsWrap);

                // Additional Style (Positive Prompt)
                const addStyleLbl = document.createElement("div");
                addStyleLbl.className = "modusflow-sw-label";
                addStyleLbl.textContent = "Additional Musical Style (Positive Prompt)";
                const addStyleTa = document.createElement("textarea");
                addStyleTa.className = "modusflow-sw-input";
                addStyleTa.style.cssText += "height: 60px; resize: vertical; font-family: inherit;";
                addStyleTa.value = addStyleWidget?.value || "";
                addStyleTa.placeholder = "e.g. 120 bpm, bright electric piano, soaring guitar lead...";
                addStyleTa.oninput = () => {
                    if (addStyleWidget) setWidgetValue(addStyleWidget, addStyleTa.value);
                };
                rightPane.appendChild(addStyleLbl);
                rightPane.appendChild(addStyleTa);

                // Negative Style (Negative Prompt)
                const negStyleLbl = document.createElement("div");
                negStyleLbl.className = "modusflow-sw-label";
                negStyleLbl.textContent = "Negative Style (Exclude)";
                const negStyleTa = document.createElement("textarea");
                negStyleTa.className = "modusflow-sw-input";
                negStyleTa.style.cssText += "height: 48px; resize: vertical; font-family: inherit;";
                negStyleTa.value = negStyleWidget?.value || "";
                negStyleTa.placeholder = "e.g. harsh distortion, out of tune, muffled vocals, clipping...";
                negStyleTa.oninput = () => {
                    if (negStyleWidget) setWidgetValue(negStyleWidget, negStyleTa.value);
                };
                rightPane.appendChild(negStyleLbl);
                rightPane.appendChild(negStyleTa);

                body.appendChild(leftPane);
                body.appendChild(rightPane);
                win.appendChild(body);
                document.body.appendChild(win);

                // ── Typography Application ───────────────────────────────────────────
                function applySwTypography(sz, fontKey) {
                    savedFontSize = Math.max(10, Math.min(32, sz));
                    savedFontKey = POPOUT_FONT_FAMILIES[fontKey] ? fontKey : "Monospace";
                    const cssFamily = POPOUT_FONT_FAMILIES[savedFontKey];

                    lyricsBackdrop.style.fontSize = `${savedFontSize}px`;
                    lyricsBackdrop.style.fontFamily = cssFamily;
                    lyricsTa.style.fontSize = `${savedFontSize}px`;
                    lyricsTa.style.fontFamily = cssFamily;

                    if (sizeSel && sizeSel.value !== String(savedFontSize)) sizeSel.value = String(savedFontSize);
                    if (fontSel && fontSel.value !== savedFontKey) fontSel.value = savedFontKey;

                    try {
                        localStorage.setItem("modusflow_songwriter_font_size", String(savedFontSize));
                        localStorage.setItem("modusflow_songwriter_font_family", savedFontKey);
                    } catch (_) {}
                    onLyricsInput();
                }

                fontSel.onchange = () => applySwTypography(savedFontSize, fontSel.value);
                sizeSel.onchange = () => applySwTypography(parseInt(sizeSel.value, 10) || 14, savedFontKey);
                sizeDecBtn.onclick = (e) => { e.preventDefault(); applySwTypography(savedFontSize - 1, savedFontKey); };
                sizeIncBtn.onclick = (e) => { e.preventDefault(); applySwTypography(savedFontSize + 1, savedFontKey); };

                // ── Undo / Redo History Stack ────────────────────────────────────────
                const MAX_SW_UNDO = 60;
                let swUndoStack = [];
                let swRedoStack = [];
                let isApplyingHistory = false;

                function getSwState() {
                    return {
                        lyrics: lyricsTa ? lyricsTa.value : "",
                        start: lyricsTa ? lyricsTa.selectionStart : 0,
                        end: lyricsTa ? lyricsTa.selectionEnd : 0
                    };
                }

                function updateUndoRedoButtons() {
                    if (undoBtn) {
                        undoBtn.disabled = swUndoStack.length <= 1;
                        undoBtn.style.opacity = swUndoStack.length <= 1 ? "0.4" : "1";
                    }
                    if (redoBtn) {
                        redoBtn.disabled = swRedoStack.length === 0;
                        redoBtn.style.opacity = swRedoStack.length === 0 ? "0.4" : "1";
                    }
                }

                function pushPopoutHistory() {
                    if (isApplyingHistory) return;
                    const cur = getSwState();
                    if (swUndoStack.length > 0) {
                        const top = swUndoStack[swUndoStack.length - 1];
                        if (top.lyrics === cur.lyrics) return;
                    }
                    swUndoStack.push(cur);
                    if (swUndoStack.length > MAX_SW_UNDO) swUndoStack.shift();
                    swRedoStack = [];
                    updateUndoRedoButtons();
                }

                function doPopoutUndo() {
                    if (swUndoStack.length <= 1) return;
                    const cur = swUndoStack.pop();
                    swRedoStack.push(cur);
                    const target = swUndoStack[swUndoStack.length - 1];
                    isApplyingHistory = true;
                    if (lyricsTa) {
                        lyricsTa.value = target.lyrics;
                        lyricsTa.setSelectionRange(target.start, target.end);
                    }
                    onLyricsInput();
                    isApplyingHistory = false;
                    updateUndoRedoButtons();
                    showSwToast("↩ Undone", win);
                }

                function doPopoutRedo() {
                    if (swRedoStack.length === 0) return;
                    const next = swRedoStack.pop();
                    swUndoStack.push(next);
                    isApplyingHistory = true;
                    if (lyricsTa) {
                        lyricsTa.value = next.lyrics;
                        lyricsTa.setSelectionRange(next.start, next.end);
                    }
                    onLyricsInput();
                    isApplyingHistory = false;
                    updateUndoRedoButtons();
                    showSwToast("↪ Redone", win);
                }

                let swDebounce = null;
                function onLyricsInput() {
                    const text = lyricsTa.value;
                    lyricsBackdrop.innerHTML = tokenizeLyricsToHtml(text);
                    lyricsBackdrop.scrollTop = lyricsTa.scrollTop;
                    lyricsBackdrop.scrollLeft = lyricsTa.scrollLeft;

                    if (lyricsWidget) {
                        setWidgetValue(lyricsWidget, text);
                        app.graph?.setDirtyCanvas(true, true);
                    }

                    // Word and timing stats
                    const words = (text.trim().match(/\S+/g) || []).length;
                    const lines = text.split("\n").filter(l => l.trim().length > 0).length;
                    // Approximate ~130 WPM singing tempo
                    const totalSec = Math.round((words / 130) * 60);
                    const mins = Math.floor(totalSec / 60);
                    const secs = totalSec % 60;
                    const timeStr = `~${mins}:${secs < 10 ? "0" : ""}${secs}`;

                    const headerStats = document.getElementById("mf-sw-stats-header");
                    if (headerStats) headerStats.textContent = `${words} words • ${timeStr}`;

                    const leftStats = document.getElementById("mf-sw-left-stats");
                    if (leftStats) leftStats.textContent = `${lines} lines • ${words} words • ${timeStr}`;

                    clearTimeout(swDebounce);
                    swDebounce = setTimeout(pushPopoutHistory, 320);
                }

                lyricsTa.addEventListener("input", onLyricsInput);
                lyricsTa.addEventListener("scroll", () => {
                    lyricsBackdrop.scrollTop = lyricsTa.scrollTop;
                    lyricsBackdrop.scrollLeft = lyricsTa.scrollLeft;
                });

                // Keyboard shortcuts (Undo/Redo, Queue)
                const handleSwShortcuts = (e) => {
                    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
                    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
                    if (ctrlOrCmd && !e.altKey) {
                        const k = e.key.toLowerCase();
                        if (k === "z" && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            doPopoutUndo();
                            return true;
                        } else if (k === "y" || (k === "z" && e.shiftKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            doPopoutRedo();
                            return true;
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            queueBtn.click();
                            return true;
                        }
                    }
                    return false;
                };

                lyricsTa.addEventListener("keydown", handleSwShortcuts);
                win.addEventListener("keydown", handleSwShortcuts);

                function syncPopoutFromNode() {
                    if (lyricsTa && lyricsWidget) lyricsTa.value = lyricsWidget.value || "";
                    if (titleInp && titleWidget) titleInp.value = titleWidget.value || "";
                    if (genreInp && genreWidget) genreInp.value = genreWidget.value || "";
                    if (vocalInp && vocalWidget) vocalInp.value = vocalWidget.value || "";
                    if (moodInp && moodWidget) moodInp.value = moodWidget.value || "";
                    if (addStyleTa && addStyleWidget) addStyleTa.value = addStyleWidget.value || "";
                    if (negStyleTa && negStyleWidget) negStyleTa.value = negStyleWidget.value || "";
                    onLyricsInput();
                }

                node._syncPopoutFromNode = syncPopoutFromNode;

                function closePopoutStudio() {
                    try {
                        localStorage.setItem("modusflow_songwriter_geometry", JSON.stringify({
                            top: win.style.top,
                            left: win.style.left,
                            width: win.style.width,
                            height: win.style.height
                        }));
                    } catch (_) {}
                    win.remove();
                    node._swStudioEl = null;
                }

                // Initial setup
                populateSwSongDropdowns();
                applySwTypography(savedFontSize, savedFontKey);
                onLyricsInput();
                pushPopoutHistory();
                lyricsTa.focus();
                showSwToast("🎵 Songwriter Studio Opened!", win);
            }

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

                // Locate AI widgets
                const aiModeWidget        = node.widgets?.find(w => w.name === "ai_mode");
                const aiProviderWidget    = node.widgets?.find(w => w.name === "ai_provider");
                const ollamaModelWidget   = node.widgets?.find(w => w.name === "ollama_model");
                const cloudModelWidget    = node.widgets?.find(w => w.name === "cloud_model");
                const topicWidget         = node.widgets?.find(w => w.name === "topic_or_subject");
                const webSearchWidget     = node.widgets?.find(w => w.name === "web_search");
                const structureWidget     = node.widgets?.find(w => w.name === "structure_guide");
                const tempWidget          = node.widgets?.find(w => w.name === "temperature");
                const seedWidget          = node.widgets?.find(w => w.name === "seed");

                // Song list cache
                node._allSongs       = [];
                node._savedCategory  = undefined;

                // ── Popout Studio Cockpit Button ──────────────────────────────────────
                const popoutStudioBtn = node.addWidget("button", "🎵 Popout Songwriter Studio", null, () => {
                    showPopoutSongwriterStudio(node);
                });

                // Move Popout button to the very top of the node widgets
                if (popoutStudioBtn) {
                    const bIdx = node.widgets.indexOf(popoutStudioBtn);
                    if (bIdx > 0) {
                        node.widgets.splice(bIdx, 1);
                        node.widgets.unshift(popoutStudioBtn);
                    }
                }

                // ── Refresh Ollama Models Button ──────────────────────────────
                const refreshModelsBtn = node.addWidget("button", "🔄 Refresh Models", null, async () => {
                    try {
                        const res = await fetch("/modusflow/refresh_ollama_models").then(r => r.json());
                        if (res.success && Array.isArray(res.data) && ollamaModelWidget) {
                            ollamaModelWidget.options.values = res.data;
                            if (!res.data.includes(ollamaModelWidget.value)) {
                                ollamaModelWidget.value = res.data[0] || "";
                            }
                            app.graph.setDirtyCanvas(true, true);
                        }
                    } catch (e) {
                        console.error("[ModusFlow SongWriter] Refresh models error:", e);
                    }
                });

                // Move refreshModelsBtn right after ollama_model
                if (ollamaModelWidget && refreshModelsBtn) {
                    const mIdx = node.widgets.indexOf(ollamaModelWidget);
                    const bIdx = node.widgets.indexOf(refreshModelsBtn);
                    if (mIdx >= 0 && bIdx > mIdx) {
                        node.widgets.splice(bIdx, 1);
                        node.widgets.splice(mIdx + 1, 0, refreshModelsBtn);
                    }
                }

                // ── Helper to cleanly show/hide widgets in LiteGraph & ComfyUI ──
                function setWidgetVisible(widget, visible) {
                    if (!widget) return;
                    if (widget.originalType === undefined) {
                        widget.originalType = widget.type;
                    }
                    if (widget.originalComputeSize === undefined) {
                        widget.originalComputeSize = widget.computeSize;
                    }

                    widget.hidden = !visible;
                    widget.type = visible ? widget.originalType : "hidden";

                    if (visible) {
                        if (widget.originalComputeSize) {
                            widget.computeSize = widget.originalComputeSize;
                        } else {
                            delete widget.computeSize;
                        }
                        if (widget.inputEl) {
                            widget.inputEl.hidden = false;
                            widget.inputEl.style.display = "";
                            if (widget.inputEl.parentElement && widget.inputEl.parentElement.classList.contains("comfy-multiline-input")) {
                                widget.inputEl.parentElement.hidden = false;
                                widget.inputEl.parentElement.style.display = "";
                            }
                        }
                    } else {
                        widget.computeSize = () => [0, -4];
                        if (widget.inputEl) {
                            widget.inputEl.hidden = true;
                            widget.inputEl.style.display = "none";
                            if (widget.inputEl.parentElement && widget.inputEl.parentElement.classList.contains("comfy-multiline-input")) {
                                widget.inputEl.parentElement.hidden = true;
                                widget.inputEl.parentElement.style.display = "none";
                            }
                        }
                    }
                }

                // ── Dynamic AI Widget Visibility ──────────────────────────────
                const toggleAiWidgets = () => {
                    const isAiEnabled = Boolean(aiModeWidget && aiModeWidget.value && aiModeWidget.value !== "disabled");
                    const provider = String(aiProviderWidget ? aiProviderWidget.value : "Ollama (Local)");
                    const isCloud = provider.startsWith("Cloud");

                    const seedControlWidget = node.widgets?.find(w => w.name === "control_after_generate" || w.label === "control after generate");

                    // Base AI controls (only shown when ai_mode is enabled)
                    setWidgetVisible(aiProviderWidget, isAiEnabled);
                    setWidgetVisible(topicWidget, isAiEnabled);
                    setWidgetVisible(webSearchWidget, isAiEnabled);
                    setWidgetVisible(structureWidget, isAiEnabled);
                    setWidgetVisible(tempWidget, isAiEnabled);
                    setWidgetVisible(seedWidget, isAiEnabled);
                    setWidgetVisible(seedControlWidget, isAiEnabled);

                    // Provider-dependent controls
                    setWidgetVisible(ollamaModelWidget, isAiEnabled && !isCloud);
                    setWidgetVisible(refreshModelsBtn, isAiEnabled && !isCloud);
                    setWidgetVisible(cloudModelWidget, isAiEnabled && isCloud);

                    // Adjust canvas node height smoothly to fit visible widgets
                    if (node.computeSize) {
                        const minSize = node.computeSize();
                        const targetHeight = Math.max(minSize[1] + 16, isAiEnabled ? 760 : 460);
                        const targetWidth = Math.max(560, node.size ? node.size[0] : 560);
                        node.setSize([targetWidth, targetHeight]);
                    }

                    node.setDirtyCanvas?.(true, true);
                    app.graph?.setDirtyCanvas(true, true);
                };

                node._toggleAiWidgets = toggleAiWidgets;

                if (aiModeWidget) {
                    const origModeCb = aiModeWidget.callback;
                    aiModeWidget.callback = function() {
                        const ret = origModeCb?.apply(this, arguments);
                        toggleAiWidgets();
                        return ret;
                    };
                }

                if (aiProviderWidget) {
                    const origProvCb = aiProviderWidget.callback;
                    aiProviderWidget.callback = function() {
                        const ret = origProvCb?.apply(this, arguments);
                        toggleAiWidgets();
                        return ret;
                    };
                }

                // Initial pass on creation
                toggleAiWidgets();
                requestAnimationFrame(toggleAiWidgets);
                setTimeout(toggleAiWidgets, 50);

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
                node.size = [560, 500];
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

                const cfw = this.widgets?.find(w => w.name === "category_filter");
                const scw = this.widgets?.find(w => w.name === "song_category");

                if (this._serializedCategory !== undefined && cfw) {
                    cfw.value = this._serializedCategory;
                }
                if (this._serializedSongCategory !== undefined && scw) {
                    scw.value = this._serializedSongCategory;
                    if (scw.inputEl) scw.inputEl.value = this._serializedSongCategory;
                }

                this._toggleAiWidgets?.();
                setTimeout(() => this._toggleAiWidgets?.(), 20);
                setTimeout(() => this._toggleAiWidgets?.(), 100);
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

                        node._syncPopoutFromNode?.();
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
