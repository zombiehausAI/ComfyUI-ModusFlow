
        const vscode = acquireVsCodeApi();
        const pedalsData = {};
        const ribbonData = {};

        const posArea = document.getElementById("positiveArea");
        const negArea = document.getElementById("negativeArea");
        const posBackdrop = document.getElementById("posBackdrop");
        const negBackdrop = document.getElementById("negBackdrop");
        const filenameInput = document.getElementById("filenameInput");
        const categoryInput = document.getElementById("categoryInput");
        const styleSelect = document.getElementById("styleSelect");
        const themeSelect = document.getElementById("themeSelect");
        const loraDeck = document.getElementById("loraDeck");

        // ── Syntax Highlighting Engine ──────────────────────────────────────
        const SYNTAX_THEMES = {
            "Modus Neon (Default)": {
                comment: "#6b7280",
                choice: "#c084fc",
                shuffle: "#f472b6",
                wildcard: "#fbbf24",
                variable: "#38bdf8",
                weight: "#34d399",
                curator: "#4ade80",
                lora: "#f87171",
                plain_text: "#e2e8f0"
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
                plain_text: "#f3f4f6"
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
                plain_text: "#fcfcfa"
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
                plain_text: "#f8f8f2"
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
                plain_text: "#eceff4"
            },
            "Solarized Dark": {
                comment: "#586e75",
                choice: "#6c71c4",
                shuffle: "#d33682",
                wildcard: "#b58900",
                variable: "#268bd2",
                weight: "#859900",
                curator: "#2aa198",
                lora: "#dc322f",
                plain_text: "#93a1a1"
            },
            "High Contrast": {
                comment: "#888888",
                choice: "#df80ff",
                shuffle: "#ff3399",
                wildcard: "#ffcc00",
                variable: "#00eeff",
                weight: "#00ff66",
                curator: "#66ff33",
                lora: "#ff3333",
                plain_text: "#ffffff"
            },
            "Off": {
                comment: "#e2e8f0",
                choice: "#e2e8f0",
                shuffle: "#e2e8f0",
                wildcard: "#e2e8f0",
                variable: "#e2e8f0",
                weight: "#e2e8f0",
                curator: "#e2e8f0",
                lora: "#e2e8f0",
                plain_text: "#e2e8f0"
            }
        };

        function escapeHtml(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function tokenizeToHtml(text, themeName) {
            if (!text) return "";
            const theme = SYNTAX_THEMES[themeName] || SYNTAX_THEMES["Modus Neon (Default)"];
            if (themeName === "Off") {
                let esc = escapeHtml(text);
                if (text.endsWith("\n")) esc += "<br>&nbsp;";
                return esc;
            }

            const intervals = [];
            const addMatches = (regex, type) => {
                let m;
                while ((m = regex.exec(text)) !== null) {
                    const start = m.index;
                    const end = start + m[0].length;
                    if (!intervals.some(iv => (start < iv.end && end > iv.start))) {
                        intervals.push({ start, end, type });
                    }
                }
            };

            // 0. Section banners: // [Name] or # [Name] or /* [Name] */
            addMatches(/(?:\/\/|#|\/\*)\s*\[[^\]\r\n]+\](?:\s*\*\/)?/g, "section_header");
            // 1. Block comments: /* ... */
            addMatches(/\/\*[\s\S]*?\*\//g, "comment");
            // 2. Hex colors: #RRGGBB or #RGB
            addMatches(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "hex_color");
            // 3. Line comments: // ... or # ...
            addMatches(/(?:\/\/|#)[^\r\n]*/g, "comment");
            // 4. LoRA tags: <lora:...>
            addMatches(/<lora:[^>\r\n]+>/gi, "lora");
            // 5. Prompt variables: $name
            addMatches(/\$[a-zA-Z0-9_-]+(?:\s*=\s*[^;\r\n]+;?)?/g, "variable");
            // 6. Curator placeholders: {curator}, {curator2}
            addMatches(/\{curator\d*\}/gi, "curator");
            // 7. Shuffles: {shuffle:...}
            addMatches(/\{shuffle:[^}]+\}/gi, "shuffle");
            // 8. Pick-N & Ranges: {2$$...}, {1-3$$...}
            addMatches(/\{\s*\d+(?:-\d+)?\$\$[^}]+\}/g, "choice");
            // 9. Weighted odds: {80::a|20::b}
            addMatches(/\{\s*\d+::[^}]+\}/g, "choice");
            // 10. Dynamic choices: {a|b|c}
            addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");
            // 11. Wildcards: __name__
            addMatches(/__[a-zA-Z0-9_/-]+__/g, "wildcard");
            // 12. Attention weights: (tag:1.3)
            addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

            // 13. Rainbow Parentheses & Unclosed Parens
            const RAINBOW_COLORS = ["#38bdf8", "#c084fc", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];
            const isExcluded = pos => intervals.some(iv => pos >= iv.start && pos < iv.end && iv.type === "comment");
            const pStack = [];

            for (let i = 0; i < text.length; i++) {
                if (isExcluded(i)) continue;
                const ch = text[i];
                if (ch === "(") {
                    pStack.push({ index: i, depth: pStack.length });
                } else if (ch === ")") {
                    if (pStack.length > 0) {
                        const open = pStack.pop();
                        const color = RAINBOW_COLORS[open.depth % RAINBOW_COLORS.length];
                        intervals.push({ start: open.index, end: open.index + 1, type: "rainbow_paren", color });
                        intervals.push({ start: i, end: i + 1, type: "rainbow_paren", color });
                    } else {
                        intervals.push({ start: i, end: i + 1, type: "unmatched_paren" });
                    }
                }
            }

            while (pStack.length > 0) {
                const unclosed = pStack.pop();
                intervals.push({ start: unclosed.index, end: unclosed.index + 1, type: "unclosed_paren" });
            }

            intervals.sort((a, b) => a.start - b.start);

            let html = "";
            let cursor = 0;

            for (const iv of intervals) {
                if (iv.start > cursor) {
                    html += escapeHtml(text.slice(cursor, iv.start));
                }
                const tokenText = escapeHtml(text.slice(iv.start, iv.end));

                if (iv.type === "section_header") {
                    html += '<span style="color: #38bdf8; font-weight: bold; background: rgba(56, 189, 248, 0.15); border-radius: 3px; padding: 1px 4px;">' + tokenText + '</span>';
                } else if (iv.type === "rainbow_paren") {
                    html += '<span style="color: ' + iv.color + '; font-weight: bold;">' + tokenText + '</span>';
                } else if (iv.type === "unclosed_paren" || iv.type === "unmatched_paren") {
                    html += '<span style="background: rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 2px; text-decoration: underline wavy #ef4444; font-weight: bold;">' + tokenText + '</span>';
                } else if (iv.type === "hex_color") {
                    const rawHex = text.slice(iv.start, iv.end);
                    html += '<span style="color: ' + rawHex + '; font-weight: bold; background: ' + rawHex + '26; border-radius: 3px; box-shadow: 0 0 0 1px ' + rawHex + '88; text-decoration: underline dotted ' + rawHex + ';">' + tokenText + '</span>';
                } else if (iv.type === "weight") {
                    const raw = text.slice(iv.start, iv.end);
                    const wMatch = raw.match(/:(-?\\d+(?:\\.\\d+)?)\\)$/);
                    const w = wMatch ? parseFloat(wMatch[1]) : 1.0;
                    const baseColor = theme.weight || "#34d399";
                    let extra = "";
                    if (w > 1.0) {
                        const glowSpread = Math.min(14, Math.round((w - 1.0) * 12));
                        extra = 'font-weight: 600; text-shadow: 0 0 ' + glowSpread + 'px rgba(251, 191, 36, 0.7); background: rgba(245, 158, 11, 0.2); border-radius: 3px; padding: 0 2px;';
                    } else if (w < 1.0 && w >= 0) {
                        extra = 'opacity: 0.6;';
                    }
                    html += '<span style="color: ' + baseColor + '; ' + extra + '">' + tokenText + '</span>';
                } else {
                    const color = theme[iv.type] || theme.plain_text || "#e2e8f0";
                    html += '<span style="color: ' + color + ';">' + tokenText + '</span>';
                }
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

        function renderAllSyntax() {
            const themeName = themeSelect ? themeSelect.value : "Modus Neon (Default)";
            posBackdrop.innerHTML = tokenizeToHtml(posArea.value, themeName);
            negBackdrop.innerHTML = tokenizeToHtml(negArea.value, themeName);
            syncScroll(posArea, posBackdrop);
            syncScroll(negArea, negBackdrop);
        }

        function syncScroll(ta, bd) {
            bd.scrollTop = ta.scrollTop;
            bd.scrollLeft = ta.scrollLeft;
        }

        posArea.addEventListener("scroll", () => syncScroll(posArea, posBackdrop));
        negArea.addEventListener("scroll", () => syncScroll(negArea, negBackdrop));
        themeSelect.addEventListener("change", renderAllSyntax);

        // Populate Aesthetic Ribbon selects
        function populateSelect(elemId, items) {
            const el = document.getElementById(elemId);
            items.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item.tag;
                opt.textContent = item.label;
                el.appendChild(opt);
            });
            el.addEventListener("change", () => {
                if (el.value) {
                    insertPositive(el.value);
                    el.selectedIndex = 0;
                }
            });
        }
        populateSelect("filmStockSelect", ribbonData.filmStocks);
        populateSelect("opticsSelect", ribbonData.optics);
        populateSelect("lightingSelect", ribbonData.lighting);
        populateSelect("cameraSelect", ribbonData.cameras);

        function insertPositive(text) {
            const val = posArea.value.trim();
            posArea.value = val ? val + ", " + text : text;
            notifyContent();
            updateUI();
        }

        function updateUI() {
            // Update token counts
            const posWords = (posArea.value.match(/\\b[\\w'-]+\\b/g) || []).length;
            const posTok = Math.ceil(posWords * 1.25);
            document.getElementById("posStats").textContent = posWords + "w · ~" + posTok + " tok";

            const negWords = (negArea.value.match(/\\b[\\w'-]+\\b/g) || []).length;
            const negTok = Math.ceil(negWords * 1.25);
            document.getElementById("negStats").textContent = negWords + "w · ~" + negTok + " tok";

            const totalTokens = posTok + negTok;
            document.getElementById("totalTokenBadge").textContent = "Total: " + totalTokens + " tok (Est. CLIP)";

            // Update Pedalboard state
            const style = styleSelect.value;
            const negText = negArea.value;
            document.querySelectorAll(".pedal-btn").forEach(btn => {
                const pedalKey = btn.getAttribute("data-pedal");
                const pedal = pedalsData[pedalKey];
                if (pedal) {
                    const tagActive = negText.includes(pedal.tags) || negText.includes(pedal.expressions);
                    btn.classList.toggle("active", tagActive);
                }
            });

            // Update LoRA deck
            loraDeck.innerHTML = "";
            const loraMatches = posArea.value.match(/<lora:[^>]+>/g) || [];
            loraMatches.forEach(lora => {
                const badge = document.createElement("span");
                badge.className = "lora-tag";
                badge.textContent = lora;
                loraDeck.appendChild(badge);
            });

            // Update live syntax highlighting
            renderAllSyntax();
        }

        // Toggle pedal
        document.querySelectorAll(".pedal-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const pedalKey = btn.getAttribute("data-pedal");
                const pedal = pedalsData[pedalKey];
                const style = styleSelect.value;
                const snippet = style === "expressions" ? pedal.expressions : pedal.tags;
                const altSnippet = style === "expressions" ? pedal.tags : pedal.expressions;

                let text = negArea.value;
                if (text.includes(snippet) || text.includes(altSnippet)) {
                    text = text.replace(snippet, "").replace(altSnippet, "").replace(/,\\s*,/g, ",").replace(/^\\s*,\\s*/, "").replace(/\\s*,\\s*$/, "").trim();
                } else {
                    const trimmed = text.trim();
                    text = trimmed ? snippet + ", " + trimmed : snippet;
                }
                negArea.value = text;
                notifyContent();
                updateUI();
            });
        });

        // ── Undo / Redo History Stack ──────────────────────────────────────
        const undoBtn = document.getElementById("undoBtn");
        const redoBtn = document.getElementById("redoBtn");
        let historyStack = [];
        let historyIndex = -1;
        const MAX_HISTORY = 60;
        let isApplyingHistory = false;

        function pushHistory() {
            if (isApplyingHistory) return;
            const state = {
                pos: posArea.value,
                neg: negArea.value,
                style: styleSelect.value
            };

            if (historyIndex >= 0) {
                const top = historyStack[historyIndex];
                if (top.pos === state.pos && top.neg === state.neg && top.style === state.style) {
                    return;
                }
            }

            historyStack = historyStack.slice(0, historyIndex + 1);
            historyStack.push(state);
            if (historyStack.length > MAX_HISTORY) {
                historyStack.shift();
            } else {
                historyIndex++;
            }
            updateUndoRedoButtons();
        }

        function updateUndoRedoButtons() {
            undoBtn.disabled = historyIndex <= 0;
            redoBtn.disabled = historyIndex >= historyStack.length - 1;
        }

        function doUndo() {
            if (historyIndex > 0) {
                historyIndex--;
                applyHistoryState(historyStack[historyIndex]);
            }
        }

        function doRedo() {
            if (historyIndex < historyStack.length - 1) {
                historyIndex++;
                applyHistoryState(historyStack[historyIndex]);
            }
        }

        function applyHistoryState(state) {
            if (!state) return;
            isApplyingHistory = true;
            posArea.value = state.pos;
            negArea.value = state.neg;
            if (state.style) styleSelect.value = state.style;
            isApplyingHistory = false;
            updateUndoRedoButtons();
            notifyContent();
            updateUI();
        }

        undoBtn.addEventListener("click", doUndo);
        redoBtn.addEventListener("click", doRedo);

        // Standard Keyboard Shortcuts: Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
        window.addEventListener("keydown", (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            if (ctrlOrCmd && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key === "z" && !e.shiftKey) {
                    e.preventDefault();
                    doUndo();
                } else if (key === "y" || (key === "z" && e.shiftKey)) {
                    e.preventDefault();
                    doRedo();
                }
            }
        });

        // ── Input & Event Listeners ─────────────────────────────────────────
        function notifyContent() {
            vscode.postMessage({
                command: "updateContent",
                filename: filenameInput.value,
                category: categoryInput.value,
                promptStyle: styleSelect.value,
                positive: posArea.value,
                negative: negArea.value
            });
        }

        let inputTimer = null;
        function handleInput() {
            notifyContent();
            updateUI();
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => {
                pushHistory();
            }, 350);
        }

        posArea.addEventListener("input", handleInput);
        negArea.addEventListener("input", handleInput);
        filenameInput.addEventListener("input", notifyContent);
        categoryInput.addEventListener("input", notifyContent);

        styleSelect.addEventListener("change", () => {
            pushHistory();
            vscode.postMessage({
                command: "convertStyle",
                targetStyle: styleSelect.value
            });
        });

        document.getElementById("saveBtn").addEventListener("click", () => {
            vscode.postMessage({
                command: "savePrompt",
                filename: filenameInput.value,
                category: categoryInput.value,
                positive: posArea.value,
                negative: negArea.value
            });
        });

        document.getElementById("pushCanvasBtn").addEventListener("click", () => {
            vscode.postMessage({
                command: "pushToCanvas",
                positive: posArea.value,
                negative: negArea.value,
                promptStyle: styleSelect.value
            });
        });

        document.getElementById("enhanceBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "enhanceOllama" });
        });

        document.getElementById("prettifyBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "prettify" });
        });

        document.getElementById("queueBtn").addEventListener("click", () => {
            vscode.postMessage({ command: "queuePrompt" });
        });

        document.getElementById("swapPromptsBtn").addEventListener("click", () => {
            pushHistory();
            const tmp = posArea.value;
            posArea.value = negArea.value;
            negArea.value = tmp;
            pushHistory();
            notifyContent();
            updateUI();
        });

        window.addEventListener("message", event => {
            const msg = event.data;
            if (msg.type === "syncContent") {
                if (msg.filename) filenameInput.value = msg.filename;
                if (msg.category) categoryInput.value = msg.category;
                if (msg.positive !== undefined) posArea.value = msg.positive;
                if (msg.negative !== undefined) negArea.value = msg.negative;
                if (msg.promptStyle) styleSelect.value = msg.promptStyle;
                pushHistory();
                updateUI();
            }
        });

        updateUI();
        pushHistory();
    