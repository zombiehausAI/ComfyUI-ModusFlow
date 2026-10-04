import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ModusFlow Text Editor — positive/negative prompts with category-filtered save/load & syntax highlighting

// ── Connected Canvas Node Reporting ──────────────────────────────────────────
let _reportCanvasDebounce = null;
function reportCanvasNode(node, isSelected = true) {
    if (!node) return;
    clearTimeout(_reportCanvasDebounce);
    _reportCanvasDebounce = setTimeout(() => {
        try {
            const pw = node.widgets?.find(w => w.name === "positive");
            const nw = node.widgets?.find(w => w.name === "negative");
            const sw = node.widgets?.find(w => w.name === "prompt_style");
            const payload = {
                id: String(node.id),
                title: node.title || `Text Editor #${node.id}`,
                positive: pw?.value || "",
                negative: nw?.value || "",
                prompt_style: sw?.value || "Tags (SDXL / Pony)",
                is_selected: isSelected
            };
            if (typeof api !== "undefined" && api.fetchApi) {
                api.fetchApi("/modusflow/canvas/set_active_node", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            } else {
                fetch("/modusflow/canvas/set_active_node", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            }
        } catch (_) {}
    }, 120);
}

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
        .modusflow-health-badge {
            position: absolute;
            bottom: 4px;
            left: 8px;
            font-size: 11px;
            line-height: 1.2;
            padding: 2px 7px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.88);
            color: #fab387;
            border: 1px solid rgba(250, 179, 135, 0.4);
            z-index: 10;
            font-family: ui-monospace, SFMono-Regular, monospace;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            display: none;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
        }
        .modusflow-health-badge:hover {
            border-color: #fab387;
            background: rgba(45, 26, 10, 0.95);
        }
        @keyframes mfToastSlideIn {
            from { opacity: 0; transform: translateY(-12px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modusflow-pedal-bar {
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 5px;
            user-select: none;
            flex-wrap: wrap;
        }
        .modusflow-pedal-btn {
            background: rgba(30, 30, 46, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 5px;
            padding: 2px 8px;
            font-size: 11px;
            color: #a6adc8;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
            line-height: 1.3;
        }
        .modusflow-pedal-btn:hover {
            border-color: #89b4fa;
            color: #cdd6f4;
            background: rgba(30, 30, 46, 0.95);
        }
        .modusflow-pedal-btn.active {
            background: rgba(137, 180, 250, 0.22);
            border-color: #89b4fa;
            color: #89b4fa;
            font-weight: 600;
            box-shadow: 0 0 8px rgba(137, 180, 250, 0.3);
        }
        /* ── Section Banners ── */
        .modusflow-section-banner {
            display: block;
            margin: 6px 0 3px 0;
            padding: 3px 8px;
            background: linear-gradient(90deg, rgba(137, 180, 250, 0.16) 0%, rgba(203, 166, 247, 0.08) 60%, transparent 100%);
            border-left: 3px solid #89b4fa;
            border-radius: 0 4px 4px 0;
            color: #89b4fa;
            font-weight: 700;
            letter-spacing: 0.5px;
            font-size: 11px;
            text-transform: uppercase;
        }

        /* ── Waveform EQ Attention Bar ── */
        .modusflow-waveform-strip {
            position: absolute;
            bottom: 0px;
            left: 0px;
            right: 0px;
            height: 3px;
            display: flex;
            background: rgba(17, 17, 27, 0.6);
            z-index: 9;
            overflow: hidden;
            pointer-events: none;
        }
        .modusflow-waveform-chunk {
            flex: 1;
            height: 100%;
            border-right: 1px solid rgba(255, 255, 255, 0.15);
            position: relative;
            background: rgba(255, 255, 255, 0.03);
        }
        .modusflow-waveform-fill {
            height: 100%;
            background: #89b4fa;
            transition: width 0.2s ease;
        }
        .modusflow-waveform-fill.has-spike {
            background: linear-gradient(90deg, #89b4fa, #f59e0b);
            box-shadow: 0 0 6px rgba(245, 158, 11, 0.8);
        }

        /* ── Tag Studio Matrix ── */
        .modusflow-tag-studio-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 10px;
            background: #181825;
            border: 1px solid #313244;
            border-radius: 8px;
            min-height: 160px;
            max-height: 380px;
            overflow-y: auto;
            align-content: flex-start;
            box-sizing: border-box;
            user-select: none;
        }
        .modusflow-tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #1e1e2e;
            border: 1px solid #313244;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 12px;
            color: #cdd6f4;
            cursor: grab;
            transition: all 0.15s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .modusflow-tag-chip:hover {
            border-color: #89b4fa;
            background: #252538;
        }
        .modusflow-tag-chip.dragging {
            opacity: 0.4;
            border: 1px dashed #89b4fa;
        }
        .modusflow-tag-chip.drag-over {
            border-color: #f5c2e7;
            transform: scale(1.04);
        }
        .modusflow-tag-chip.muted {
            opacity: 0.45;
            text-decoration: line-through;
            border-style: dashed;
        }
        .modusflow-tag-handle {
            color: #6c7086;
            font-size: 11px;
            cursor: grab;
        }
        .modusflow-tag-cat-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .modusflow-tag-weight-btn {
            background: #313244;
            border: none;
            border-radius: 3px;
            color: #cdd6f4;
            width: 16px;
            height: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        .modusflow-tag-weight-btn:hover {
            background: #45475a;
            color: #89b4fa;
        }
        .modusflow-tag-btn-icon {
            background: none;
            border: none;
            color: #6c7086;
            cursor: pointer;
            padding: 0 2px;
            font-size: 11px;
            line-height: 1;
        }
        .modusflow-tag-btn-icon:hover {
            color: #f38ba8;
        }
        .modusflow-tag-add-input {
            background: #11111b;
            border: 1px dashed #45475a;
            border-radius: 6px;
            padding: 4px 8px;
            color: #cdd6f4;
            font-size: 12px;
            outline: none;
            width: 110px;
            transition: all 0.15s ease;
        }
        .modusflow-tag-add-input:focus {
            border-color: #89b4fa;
            width: 170px;
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
            z-index: 100030;
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
        /* ── Hex Color & Floating Inspector ── */
        .modusflow-hex-pill {
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .modusflow-hex-pill:hover {
            filter: brightness(1.2);
            box-shadow: 0 0 6px currentColor;
        }
        .modusflow-floating-card {
            animation: mfFadeIn 0.12s ease-out;
        }
        @keyframes mfFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ── ModusFlow Modal Overlays (Always on top of Studio & Canvas) ── */
        .modusflow-modal-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 100050 !important;
        }

        /* ── Pop-Out Floating Studio Window ── */
        .modusflow-popout-window {
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
            min-width: 650px;
            min-height: 480px;
            resize: both;
            box-sizing: border-box;
        }
        .modusflow-popout-window.is-maximized {
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            border-radius: 0 !important;
            resize: none !important;
        }
        .modusflow-popout-window.is-minimized {
            width: 340px !important;
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
        .modusflow-popout-header {
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
        .modusflow-popout-header:active {
            cursor: grabbing;
        }
        .modusflow-popout-toolbar {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #181825;
            border-bottom: 1px solid #313244;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        .modusflow-popout-btn {
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
        .modusflow-popout-btn:hover {
            border-color: #89b4fa;
            background: #28283d;
            color: #ffffff;
        }
        .modusflow-popout-body {
            display: flex;
            flex: 1;
            overflow: hidden;
            gap: 12px;
            padding: 12px;
            box-sizing: border-box;
            background: #11111b;
        }
        .modusflow-popout-pane {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
            min-width: 0;
            position: relative;
        }
        .modusflow-popout-editor-box {
            position: relative;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            border: 1px solid #313244;
            border-radius: 8px;
            overflow: hidden;
            background: #181825;
        }
        .modusflow-popout-ta {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            background: transparent;
            color: transparent;
            caret-color: #ffffff;
            font-family: var(--mf-popout-font-family, ui-monospace, SFMono-Regular, monospace);
            font-size: var(--mf-popout-font-size, 14px);
            line-height: 1.5;
            padding: 12px;
            border: none;
            outline: none;
            resize: none;
            position: relative;
            z-index: 1;
            tab-size: 4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .modusflow-popout-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            padding: 12px;
            font-family: var(--mf-popout-font-family, ui-monospace, SFMono-Regular, monospace);
            font-size: var(--mf-popout-font-size, 14px);
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            pointer-events: none;
            user-select: none;
            tab-size: 4;
            overflow: hidden;
            color: #cdd6f4;
            box-sizing: border-box;
        }

        /* ── Color Spectrum Studio & Sliders ── */
        .modusflow-spectrum-box {
            display: flex;
            gap: 16px;
            background: #1e1e2e;
            border: 1px solid #313244;
            border-radius: 10px;
            padding: 14px;
            box-sizing: border-box;
            flex-wrap: wrap;
        }
        .modusflow-hue-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 14px;
            border-radius: 7px;
            background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
            outline: none;
            cursor: pointer;
            margin: 6px 0;
        }
        .modusflow-hue-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #11111b;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
            cursor: pointer;
        }
    `;
    document.head.appendChild(styleEl);
}

// ── Color Hex Inspector & Natural Color Resolver ──────────────────────────────
const ARTISTIC_COLOR_PALETTE = [
    { name: "pure white", hex: "#ffffff" },
    { name: "ivory white", hex: "#fffff0" },
    { name: "warm cream", hex: "#fffdd0" },
    { name: "alabaster", hex: "#f2f0e6" },
    { name: "soft beige", hex: "#f5f5dc" },
    { name: "sand beige", hex: "#e2d2b4" },
    { name: "champagne gold", hex: "#f7e7ce" },
    { name: "pastel peach", hex: "#ffe5b4" },
    { name: "blush pink", hex: "#ffb6c1" },
    { name: "rose pink", hex: "#ff66cc" },
    { name: "hot pink", hex: "#ff1493" },
    { name: "vibrant magenta", hex: "#ff00ff" },
    { name: "fuchsia", hex: "#d9027d" },
    { name: "coral pink", hex: "#f88379" },
    { name: "salmon pink", hex: "#fa8072" },
    { name: "fiery coral", hex: "#ff6f61" },
    { name: "crimson red", hex: "#dc143c" },
    { name: "scarlet red", hex: "#ff2400" },
    { name: "ruby red", hex: "#9b111e" },
    { name: "blood red", hex: "#8a0303" },
    { name: "deep wine red", hex: "#722f37" },
    { name: "burgundy", hex: "#800020" },
    { name: "maroon", hex: "#800000" },
    { name: "terracotta", hex: "#e2725b" },
    { name: "burnt sienna", hex: "#e97451" },
    { name: "rust orange", hex: "#b7410e" },
    { name: "persimmon orange", hex: "#ec5800" },
    { name: "tangerine orange", hex: "#f28500" },
    { name: "amber orange", hex: "#ff7e00" },
    { name: "warm amber", hex: "#ffbf00" },
    { name: "marigold yellow", hex: "#e3a857" },
    { name: "mustard yellow", hex: "#ffdb58" },
    { name: "cadmium yellow", hex: "#fff600" },
    { name: "lemon yellow", hex: "#fff44f" },
    { name: "canary yellow", hex: "#ffef00" },
    { name: "chartreuse lime", hex: "#7fff00" },
    { name: "electric lime", hex: "#32cd32" },
    { name: "olive green", hex: "#808000" },
    { name: "moss green", hex: "#8a9a5b" },
    { name: "sage green", hex: "#9caf88" },
    { name: "mint green", hex: "#98ff98" },
    { name: "pistachio green", hex: "#93c572" },
    { name: "emerald green", hex: "#50c878" },
    { name: "forest green", hex: "#228b22" },
    { name: "deep pine green", hex: "#01796f" },
    { name: "jade green", hex: "#00a86b" },
    { name: "viridian", hex: "#40826d" },
    { name: "dark teal", hex: "#00565b" },
    { name: "rich teal", hex: "#008080" },
    { name: "cyan turquoise", hex: "#40e0d0" },
    { name: "aquamarine", hex: "#7fffd4" },
    { name: "electric cyan", hex: "#00ffff" },
    { name: "baby blue", hex: "#89cff0" },
    { name: "sky blue", hex: "#87ceeb" },
    { name: "cerulean blue", hex: "#007ba7" },
    { name: "cornflower blue", hex: "#6495ed" },
    { name: "cobalt blue", hex: "#0047ab" },
    { name: "royal blue", hex: "#4169e1" },
    { name: "ultramarine blue", hex: "#3f00ff" },
    { name: "deep sapphire blue", hex: "#0f52ba" },
    { name: "navy blue", hex: "#000080" },
    { name: "midnight blue", hex: "#191970" },
    { name: "dark indigo", hex: "#310062" },
    { name: "electric indigo", hex: "#4b0082" },
    { name: "periwinkle", hex: "#ccccff" },
    { name: "soft lavender", hex: "#e6e6fa" },
    { name: "lilac", hex: "#c8a2c8" },
    { name: "amethyst purple", hex: "#9966cc" },
    { name: "violet", hex: "#8f00ff" },
    { name: "deep plum", hex: "#701c45" },
    { name: "warm ochre", hex: "#cc7722" },
    { name: "raw sienna", hex: "#d68a59" },
    { name: "raw umber", hex: "#826644" },
    { name: "burnt umber", hex: "#8a3324" },
    { name: "sepia brown", hex: "#704214" },
    { name: "coffee brown", hex: "#4b3621" },
    { name: "chocolate brown", hex: "#3d1c02" },
    { name: "cool silver", hex: "#c0c0c0" },
    { name: "slate gray", hex: "#708090" },
    { name: "charcoal gray", hex: "#36454f" },
    { name: "graphite", hex: "#252525" },
    { name: "jet black", hex: "#0a0a0a" },
    { name: "metallic gold", hex: "#d4af37" },
    { name: "metallic bronze", hex: "#cd7f32" },
    { name: "metallic copper", hex: "#b87333" }
];

function normalizeHex(hex) {
    if (!hex) return "#000000";
    let clean = hex.trim();
    if (!clean.startsWith("#")) clean = "#" + clean;
    if (clean.length === 4) {
        clean = "#" + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
    }
    return clean.toLowerCase();
}

function hexToRgb(hex) {
    const full = normalizeHex(hex);
    const num = parseInt(full.slice(1), 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hsvToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}

function hexToHsv(hex) {
    const { r, g, b } = hexToRgb(hex);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = (max / 255) * 100;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return { h: Math.round(h < 0 ? h + 360 : h), s: Math.round(s), v: Math.round(v) };
}

function getNearestArtisticColor(hex) {
    const rgb = hexToRgb(hex);
    let best = ARTISTIC_COLOR_PALETTE[0];
    let minDist = Infinity;

    for (const item of ARTISTIC_COLOR_PALETTE) {
        const itemRgb = hexToRgb(item.hex);
        const rmean = (rgb.r + itemRgb.r) / 2;
        const dr = rgb.r - itemRgb.r;
        const dg = rgb.g - itemRgb.g;
        const db = rgb.b - itemRgb.b;
        const dist = Math.sqrt((((512 + rmean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rmean) * db * db) >> 8));
        if (dist < minDist) {
            minDist = dist;
            best = item;
        }
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    let modifier = "";
    if (hsl.s > 80 && hsl.l > 25 && hsl.l < 75 && !best.name.includes("electric") && !best.name.includes("vibrant")) {
        modifier = "vibrant ";
    } else if (hsl.l < 18 && !best.name.includes("black") && !best.name.includes("deep") && !best.name.includes("dark")) {
        modifier = "deep dark ";
    } else if (hsl.l > 82 && hsl.s > 20 && !best.name.includes("white") && !best.name.includes("pastel") && !best.name.includes("soft")) {
        modifier = "pale ";
    }

    return {
        matchedName: best.name,
        promptFriendlyName: modifier + best.name,
        targetHex: best.hex,
        rgb,
        hsl
    };
}

// ── Built-in Prompt Snippets (Macros) ─────────────────────────────────────────
const PROMPT_SNIPPETS = {
    "!cine": "cinematic lighting, 35mm photograph, 8k, volumetric god rays, atmospheric haze, shallow depth of field",
    "!photo": "raw photo, highly detailed, 85mm f/1.4 lens, natural skin texture, soft studio illumination",
    "!anime": "masterpiece anime artwork, vibrant colors, clean lineart, Makoto Shinkai aesthetic, detailed background",
    "!clean": "flawless details, sharp focus, 8k resolution, award-winning composition, pristine quality",
    "!cyber": "cyberpunk neon glow, rainy reflections, dark moody atmosphere, volumetric light, futuristic cityscape",
    "!portrait": "close-up portrait photography, sharp focus on eyes, dramatic rim lighting, creamy bokeh background",
    "!fantasy": "epic high fantasy illustration, ethereal lighting, enchanted atmosphere, concept art, octane render",
    "!neg": "worst quality, low quality, blurry, distorted, extra limbs, bad anatomy, artifacts, watermark",
    "!neg_pony": "score_4, score_3, score_2, score_1, source_pony, rating_explicit, worst quality, low quality",
    "!lighting": "dramatic chiaroscuro lighting, soft golden hour glow, cinematic rim light, ambient illumination",
    "!optics": "85mm prime lens, f/1.8 aperture, shallow depth of field, subtle film grain, natural distortion"
};

function estimateTokens(text) {
    if (!text) return { words: 0, tokens: 0, chunks: 0, currentChunk: 1, chunkProgress: 0, hasBreak: false };
    const clean = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(?:^|\n)\s*(?:#|\/\/)[^\n]*/g, "")
        .trim();
    if (!clean) return { words: 0, tokens: 0, chunks: 0, currentChunk: 1, chunkProgress: 0, hasBreak: false };

    const words = clean.split(/\s+/).filter(Boolean);
    const punctuation = (clean.match(/[,.:;!?()\[\]{}]/g) || []).length;
    const tokens = Math.max(words.length, Math.round(words.length * 1.25 + punctuation * 0.5));
    const chunks = Math.ceil(tokens / 75) || 1;
    const currentChunk = chunks;
    const chunkProgress = tokens > 0 ? ((tokens - 1) % 75) + 1 : 0;
    const hasBreak = /\bBREAK\b/.test(clean);
    return { words: words.length, tokens, chunks, currentChunk, chunkProgress, hasBreak };
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

function showStudioToast(message, type = "success", duration = 2600) {
    let container = document.getElementById("modusflow-studio-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "modusflow-studio-toast-container";
        container.style.cssText = "position: fixed; top: 24px; right: 28px; z-index: 100100; display: flex; flex-direction: column; gap: 8px; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `modusflow-studio-toast toast-${type}`;
    const icon = type === "error" ? "❌" : (type === "warning" ? "⚠️" : (type === "info" ? "ℹ️" : "✨"));
    const borderColor = type === "error" ? "#f38ba8" : (type === "warning" ? "#fab387" : (type === "info" ? "#89dceb" : "#89b4fa"));
    const glowColor = type === "error" ? "rgba(243,139,168,0.25)" : (type === "warning" ? "rgba(250,179,135,0.25)" : "rgba(137,180,250,0.25)");

    toast.style.cssText = `
        background: rgba(24, 24, 37, 0.94);
        border: 1px solid ${borderColor};
        border-radius: 8px;
        padding: 9px 15px;
        color: #cdd6f4;
        font-size: 13px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 10px ${glowColor};
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        animation: mfToastSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        max-width: 420px;
        line-height: 1.4;
    `;
    toast.innerHTML = `<span style="font-size: 15px; flex-shrink: 0;">${icon}</span><span style="font-weight: 500;">${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
        toast.style.transition = "all 0.25s ease";
        setTimeout(() => toast.remove(), 260);
    }, duration);
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
    // 0. Section Banners: // [Section Name] or # [Section Name] or /* [Section Name] */ or standalone [Section Name]
    addMatches(/(?:\/\/|#|\/\*)\s*\[[^\]\r\n]+\](?:\s*\*\/)?/g, "section_header");
    addMatches(/(?:^|(?<=[\r\n]))\s*\[[^\]\r\n]+\](?=\s*(?:[\r\n]|$))/g, "section_header");
    // 1. Comments: /* ... */
    addMatches(/\/\*[\s\S]*?\*\//g, "comment");
    // 2. Hex colors: #RRGGBB or #RGB (before line comments so #ff0000 is not marked as # comment)
    addMatches(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "hex_color");
    // 3. Comments (Line): // ... or # ...
    addMatches(/\/\/[^\r\n]*|#[^\r\n]*/g, "comment");
    // 4. LoRA tags: <lora:...>
    addMatches(/<lora:[^>\r\n]+>/gi, "lora");
    // 5. Prompt Variables: $name = value; or $name
    addMatches(/\$[a-zA-Z0-9_-]+(?:\s*=\s*[^;\r\n]+;?)?/g, "variable");
    // 6. Curator placeholders: {curator}, {curator2}, etc.
    addMatches(/\{curator\d*\}/gi, "curator");
    // 7. Shuffle syntax: {shuffle:...}
    addMatches(/\{shuffle:[^}]+\}/gi, "shuffle");
    // 8. Pick-N & Ranges: {2$$...}, {1-3$$...}
    addMatches(/\{\s*\d+(?:-\d+)?\$\$[^}]+\}/g, "choice");
    // 9. Weighted Odds: {80::a|20::b}
    addMatches(/\{\s*\d+::[^}]+\}/g, "choice");
    // 10. Dynamic Choices: {a|b|c}
    addMatches(/\{[^{}]*\|[^{}]*\}/g, "choice");
    // 11. Wildcards: __name__ or __folder/name__
    addMatches(/__[a-zA-Z0-9_/-]+__/g, "wildcard");
    // 12. Attention Weights: (tag:1.3)
    addMatches(/\([^():\r\n]+:\s*-?\d+(?:\.\d+)?\)/g, "weight");

    // 13. Rainbow & Matching Parentheses + Unclosed Warning
    const RAINBOW_PAREN_COLORS = ["#38bdf8", "#c084fc", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];
    const isExcluded = (pos) => intervals.some(iv => pos >= iv.start && pos < iv.end && iv.type === "comment");
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
            const raw = text.slice(iv.start, iv.end);
            const m = raw.match(/\[([^\]]+)\]/);
            const title = m ? m[1].trim() : raw;
            html += `<span class="modusflow-section-banner">§ ${escapeHtml(title)}</span>`;
        } else if (iv.type === "rainbow_paren") {
            html += `<span style="color: ${iv.color}; font-weight: bold;">${tokenText}</span>`;
        } else if (iv.type === "unclosed_paren" || iv.type === "unmatched_paren") {
            html += `<span style="background: rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 2px; text-decoration: underline wavy #ef4444; font-weight: bold;" title="${iv.type === 'unclosed_paren' ? 'Unclosed opening parenthesis!' : 'Unmatched closing parenthesis!'}">${tokenText}</span>`;
        } else if (iv.type === "hex_color") {
            const rawHex = text.slice(iv.start, iv.end);
            html += `<span class="modusflow-hex-pill" data-hex="${rawHex}" style="color: ${rawHex}; font-weight: bold; background: ${rawHex}26; border-radius: 3px; box-shadow: 0 0 0 1px ${rawHex}88; text-decoration: underline dotted ${rawHex};" title="Hex Color: ${rawHex} (Click to inspect or convert)">${tokenText}</span>`;
        } else if (iv.type === "weight") {
            const raw = text.slice(iv.start, iv.end);
            const wMatch = raw.match(/:(-?\d+(?:\.\d+)?)\)$/);
            const w = wMatch ? parseFloat(wMatch[1]) : 1.0;
            const baseColor = theme.weight || "#fde047";
            let extraStyle = "";
            let title = `Weight: ${w.toFixed(2)}`;
            if (w > 1.0) {
                const glowSpread = Math.min(14, Math.round((w - 1.0) * 12));
                const glowAlpha = Math.min(0.9, 0.25 + (w - 1.0) * 0.45);
                const bgAlpha = Math.min(0.3, (w - 1.0) * 0.22);
                extraStyle = `font-weight: 600; text-shadow: 0 0 ${glowSpread}px rgba(251, 191, 36, ${glowAlpha}); background: rgba(245, 158, 11, ${bgAlpha}); border-radius: 3px; padding: 0 3px;`;
                if (w > 1.5) {
                    title += " ⚠️ Strong attention weight (> 1.5)";
                }
            } else if (w < 1.0 && w >= 0) {
                const opacity = Math.max(0.4, w * 0.9);
                extraStyle = `opacity: ${opacity}; filter: saturate(0.65);`;
                title += " (De-emphasized)";
            }
            html += `<span class="modusflow-weight-token" data-weight="${w}" style="color: ${baseColor}; ${extraStyle}" title="${title}">${tokenText}</span>`;
        } else {
            const color = theme[iv.type] || theme.plain_text || "#e2e8f0";
            html += `<span style="color: ${color};">${tokenText}</span>`;
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

function countUnclosedParens(text) {
    if (!text) return 0;
    const clean = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(?:^|\n)\s*(?:#|\/\/)[^\n]*/g, "");
    let depth = 0;
    let unclosed = 0;
    for (let i = 0; i < clean.length; i++) {
        if (clean[i] === "(") depth++;
        else if (clean[i] === ")") {
            if (depth > 0) depth--;
            else unclosed++;
        }
    }
    return unclosed + depth;
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

        const healthBadge = document.createElement("div");
        healthBadge.className = "modusflow-health-badge";
        healthBadge.title = "Prompt Health & Deduplication";
        parent.appendChild(healthBadge);

        const waveformStrip = document.createElement("div");
        waveformStrip.className = "modusflow-waveform-strip";
        waveformStrip.title = "CLIP 75-token Chunk Attention Waveform";
        for (let c = 0; c < 3; c++) {
            const chunkEl = document.createElement("div");
            chunkEl.className = "modusflow-waveform-chunk";
            const fill = document.createElement("div");
            fill.className = "modusflow-waveform-fill";
            chunkEl.appendChild(fill);
            waveformStrip.appendChild(chunkEl);
        }
        parent.appendChild(waveformStrip);

        function render() {
            const stats = estimateTokens(ta.value || "");
            const unclosed = countUnclosedParens(ta.value || "");
            if (stats.tokens > 0 || unclosed > 0) {
                tokenBadge.style.display = "block";
                let textDesc = `${stats.words}w · ~${stats.tokens} tok (${stats.chunkProgress}/75 Ch.${stats.currentChunk})`;
                if (stats.hasBreak) {
                    textDesc += " · ⚡ BREAK";
                }
                if (unclosed > 0) {
                    textDesc += ` · ⚠️ ${unclosed} unclosed ( )`;
                    tokenBadge.classList.add("token-warning");
                } else if (stats.tokens > 75) {
                    tokenBadge.classList.add("token-warning");
                } else {
                    tokenBadge.classList.remove("token-warning");
                }
                tokenBadge.textContent = textDesc;
            } else {
                tokenBadge.style.display = "none";
            }

            // Prompt Health & Linter
            const textVal = ta.value || "";
            const rawTags = textVal
                .split(/[,\n]/)
                .map(t => t.trim().toLowerCase())
                .filter(t => t && !t.startsWith("#") && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("$"));
            const duplicates = [];
            const seenTags = new Set();
            for (const t of rawTags) {
                if (seenTags.has(t) && !duplicates.includes(t)) {
                    duplicates.push(t);
                }
                seenTags.add(t);
            }
            const heavyWeights = textVal.match(/\([^():\r\n]+:\s*(?:1\.[2-9]|[2-9]|\d{2,})(?:\.\d+)?\)/g) || [];

            // Update Waveform Strip
            const totalToks = stats.tokens || 0;
            const chunkDivs = waveformStrip.children;
            const hasHeavy = heavyWeights.length > 0;
            for (let i = 0; i < 3; i++) {
                const fill = chunkDivs[i]?.firstElementChild;
                if (!fill) continue;
                const startTok = i * 75;
                if (totalToks > startTok) {
                    const countInChunk = Math.min(75, totalToks - startTok);
                    const pct = Math.round((countInChunk / 75) * 100);
                    fill.style.width = `${pct}%`;
                    if (hasHeavy && i === 0) {
                        fill.classList.add("has-spike");
                    } else {
                        fill.classList.remove("has-spike");
                    }
                } else {
                    fill.style.width = "0%";
                    fill.classList.remove("has-spike");
                }
            }

            if (duplicates.length > 0 || heavyWeights.length > 0) {
                healthBadge.style.display = "block";
                if (duplicates.length > 0) {
                    healthBadge.textContent = `🟡 ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} [Fix]`;
                    healthBadge.title = `Duplicate tags detected: ${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? '...' : ''} (Click to auto-dedupe)`;
                    healthBadge.onclick = (e) => {
                        e.stopPropagation();
                        const before = ta.value;
                        const cleaned = prettifyPromptText(before);
                        if (cleaned !== before) {
                            ta.value = cleaned;
                            widget.value = cleaned;
                            render();
                            showStudioToast(`Removed ${duplicates.length} duplicate tag${duplicates.length > 1 ? 's' : ''}`);
                            pushPromptHistory(node, "Auto-deduped tags");
                        }
                    };
                } else {
                    healthBadge.textContent = `⚠️ ${heavyWeights.length} high weight (>1.6)`;
                    healthBadge.title = "High attention weights (>1.6) can distort or burn generations";
                    healthBadge.onclick = null;
                }
            } else {
                healthBadge.style.display = "none";
                healthBadge.onclick = null;
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

        ta.addEventListener("input", () => {
            render();
            reportCanvasNode(node, true);
        });
        ta.addEventListener("scroll", () => {
            backdrop.scrollTop = ta.scrollTop;
            backdrop.scrollLeft = ta.scrollLeft;
        }, { passive: true });
        ta.addEventListener("focus", syncGeometry);
        ta.addEventListener("keyup", (e) => {
            syncGeometry();
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
                inspectTokenAtCursor(ta, widget, node);
            }
        });
        ta.addEventListener("click", () => {
            syncGeometry();
            inspectTokenAtCursor(ta, widget, node);
        });

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
    fetch("/modusflow/save_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syntax_theme: themeName })
    }).catch(() => {});

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
        showStudioToast("Prompt session history is currently empty.", "info");
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

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
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

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
        showStudioToast("Positive prompt copied to clipboard!");
    };
    negBox.querySelector("#mf-copy-neg").onclick = () => {
        navigator.clipboard?.writeText(dialog.querySelector("#mf-neg-res").value);
        showStudioToast("Negative prompt copied to clipboard!");
    };

    updatePreview();
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── Ollama Local AI Enhancer ──────────────────────────────────────────────────
let _ollamaCheckPromise = null;
let _ollamaAvailable = false;
let _ollamaModels = [];
let _ollamaUrl = "";
let _ollamaError = "";

function updateOllamaButtonsOnGraph(available) {
    if (!app.graph || !app.graph._nodes) return;
    for (const n of app.graph._nodes) {
        if (n.type === "ModusFlowTextEditor") {
            const btn = n.widgets?.find(w => w.name && w.name.includes("Enhance with Ollama"));
            if (btn) {
                btn.name = available ? "✨ Enhance with Ollama" : "✨ Enhance with Ollama (Offline)";
            }
        }
    }
    app.graph?.setDirtyCanvas(true, true);
}

function checkOllamaStatus(force = false) {
    if (_ollamaCheckPromise && !force) return _ollamaCheckPromise;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = "/modusflow/ollama_status" + (force ? "?force=1" : "");
    _ollamaCheckPromise = fetch(url, { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
            clearTimeout(timer);
            if (data.success && data.available) {
                _ollamaAvailable = true;
                _ollamaModels = data.models || [];
                _ollamaUrl = data.url || "";
                _ollamaError = "";
            } else {
                _ollamaAvailable = false;
                _ollamaModels = data.models || [];
                _ollamaUrl = data.url || "";
                _ollamaError = data.error || data.message || "Ollama server unreachable";
            }
            updateOllamaButtonsOnGraph(_ollamaAvailable);
            return { available: _ollamaAvailable, models: _ollamaModels, url: _ollamaUrl, error: _ollamaError };
        })
        .catch(err => {
            clearTimeout(timer);
            _ollamaAvailable = false;
            _ollamaModels = [];
            _ollamaError = err.name === "AbortError" ? "Connection check timed out (5s)" : (err.message || "Failed to reach Ollama endpoint");
            updateOllamaButtonsOnGraph(false);
            return { available: false, models: [], url: _ollamaUrl, error: _ollamaError };
        });
    return _ollamaCheckPromise;
}

function showOllamaStatusModal(node, btn) {
    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.78); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 22px; width: 540px; max-width: 92vw; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 45px rgba(0,0,0,0.7); color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 10px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 8px;">🤖 <span>Ollama Status &amp; Models</span></h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "display: flex; flex-direction: column; gap: 14px;";

    const statusBox = document.createElement("div");
    statusBox.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;";
    body.appendChild(statusBox);

    const modelRow = document.createElement("div");
    modelRow.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
    const modelLabel = document.createElement("label");
    modelLabel.style.cssText = "font-size: 12px; font-weight: 600; color: #a6adc8;";
    modelLabel.textContent = "Enhancement Model:";
    modelRow.appendChild(modelLabel);

    const modelSelect = document.createElement("select");
    modelSelect.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 8px 10px; color: #cdd6f4; font-size: 13px; outline: none; cursor: pointer;";
    modelRow.appendChild(modelSelect);
    body.appendChild(modelRow);

    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap;";

    const testBtn = document.createElement("button");
    testBtn.textContent = "🔍 Check Status / Refresh";
    testBtn.style.cssText = "background: #313244; border: 1px solid #45475a; border-radius: 6px; padding: 7px 14px; color: #cdd6f4; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s ease;";
    testBtn.onmouseenter = () => { testBtn.style.background = "#45475a"; };
    testBtn.onmouseleave = () => { testBtn.style.background = "#313244"; };

    const enhanceNowBtn = document.createElement("button");
    enhanceNowBtn.textContent = "✨ Enhance Prompt Now";
    enhanceNowBtn.style.cssText = "background: #89b4fa; border: none; border-radius: 6px; padding: 7px 16px; color: #11111b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;";
    enhanceNowBtn.onmouseenter = () => { enhanceNowBtn.style.background = "#b4befe"; };
    enhanceNowBtn.onmouseleave = () => { enhanceNowBtn.style.background = "#89b4fa"; };

    actionRow.appendChild(testBtn);
    actionRow.appendChild(enhanceNowBtn);
    body.appendChild(actionRow);

    dialog.appendChild(body);
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    function updateView(st) {
        const isOnline = !!st.available;
        const urlStr = st.url || _ollamaUrl || "http://127.0.0.1:11434";
        const models = st.models || [];

        let currentSettingModel = app.ui?.settings?.getSettingValue?.("ModusFlow.OllamaEnhanceModel") ||
            (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_ollama_model")) ||
            "";

        statusBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600; color: #cdd6f4;">Status:</span>
                <span style="font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px; ${isOnline ? 'background: rgba(166, 227, 161, 0.2); color: #a6e3a1; border: 1px solid #a6e3a1;' : 'background: rgba(243, 139, 168, 0.2); color: #f38ba8; border: 1px solid #f38ba8;'}">
                    ${isOnline ? '🟢 Online (' + models.length + ' model' + (models.length === 1 ? '' : 's') + ')' : '🔴 Offline'}
                </span>
            </div>
            <div style="font-size: 12px; color: #a6adc8; display: flex; justify-content: space-between; align-items: center;">
                <span>Endpoint:</span>
                <code style="font-size: 11px; background: #181825; padding: 2px 6px; border-radius: 4px; color: #89b4fa;">${urlStr}</code>
            </div>
            ${!isOnline && st.error ? `
            <div style="font-size: 11px; color: #f38ba8; background: rgba(243, 139, 168, 0.1); border: 1px solid rgba(243, 139, 168, 0.3); border-radius: 4px; padding: 6px 8px; margin-top: 4px; line-height: 1.4;">
                <strong>Error:</strong> ${escapeHtml(st.error)}<br>
                <span style="color: #a6adc8;">Tip: Run 'ollama serve' or check the Ollama URL in ModusFlow settings. If connecting across LAN, set OLLAMA_HOST=0.0.0.0 on the host PC.</span>
            </div>` : ''}
        `;

        modelSelect.innerHTML = "";
        if (models.length > 0) {
            for (const m of models) {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                if (m === currentSettingModel) opt.selected = true;
                modelSelect.appendChild(opt);
            }
            if (!currentSettingModel || !models.includes(currentSettingModel)) {
                currentSettingModel = models[0];
                app.ui?.settings?.setSettingValue?.("ModusFlow.OllamaEnhanceModel", currentSettingModel);
                try { localStorage.setItem("modusflow_ollama_model", currentSettingModel); } catch (_) {}
            }
            modelSelect.disabled = false;
        } else {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = isOnline ? "-- No models found --" : "-- Ollama Offline --";
            modelSelect.appendChild(opt);
            modelSelect.disabled = true;
        }

        enhanceNowBtn.disabled = !isOnline;
        enhanceNowBtn.style.opacity = isOnline ? "1" : "0.5";
        enhanceNowBtn.style.cursor = isOnline ? "pointer" : "not-allowed";
    }

    modelSelect.onchange = (e) => {
        const val = e.target.value;
        if (val) {
            app.ui?.settings?.setSettingValue?.("ModusFlow.OllamaEnhanceModel", val);
            try { localStorage.setItem("modusflow_ollama_model", val); } catch (_) {}
            fetch("/modusflow/save_config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ollama_model: val })
            }).catch(() => {});
        }
    };

    testBtn.onclick = async () => {
        testBtn.textContent = "⏳ Checking...";
        testBtn.disabled = true;
        try {
            const st = await checkOllamaStatus(true);
            updateView(st);
        } finally {
            testBtn.textContent = "🔍 Check Status / Refresh";
            testBtn.disabled = false;
        }
    };

    enhanceNowBtn.onclick = () => {
        overlay.remove();
        enhancePromptWithOllama(node, btn);
    };

    document.body.appendChild(overlay);

    checkOllamaStatus(false).then(st => {
        updateView(st);
        if (!st.available) {
            testBtn.click();
        }
    });
}

async function enhancePromptWithOllama(node, btn) {
    const pw = node.widgets?.find(w => w.name === "positive");
    if (!pw || !pw.value || !pw.value.trim()) {
        showStudioToast("Please enter a positive prompt before enhancing.", "warning");
        return;
    }

    let status = await checkOllamaStatus(false);
    if (!status.available) {
        if (btn) btn.name = "⏳ Testing Ollama...";
        app.graph?.setDirtyCanvas(true, true);
        status = await checkOllamaStatus(true);
    }

    if (!status.available) {
        showOllamaStatusModal(node, btn);
        return;
    }

    let model = app.ui?.settings?.getSettingValue?.("ModusFlow.OllamaEnhanceModel") ||
        (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_ollama_model")) ||
        "";
    if (!model || !model.trim() || model === "-- none --" || model === "--no models found--") {
        model = status.models.length ? status.models[0] : "llama3.2";
    }

    const styleWidget = node.widgets?.find(w => w.name === "prompt_style");
    const styleVal = styleWidget?.value || "Tags (SDXL / Pony)";
    const isExpressions = styleVal.toLowerCase().includes("expression");
    const styleParam = isExpressions ? "expressions" : "tags";
    const styleLabel = isExpressions ? "Expressions" : "Tags";

    const origLabel = btn?.name || "✨ Enhance with Ollama";
    if (btn) btn.name = "⏳ Enhancing [" + styleLabel + "] (" + model + ")...";
    app.graph?.setDirtyCanvas(true, true);

    try {
        const resp = await fetch("/modusflow/enhance_prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: pw.value, model: model, style: styleParam })
        });
        const res = await resp.json();
        if (res.success && res.enhanced) {
            pushPromptHistory(node, "Pre-AI Enhancement");
            pw.value = res.enhanced;
            if (pw.inputEl) pw.inputEl.value = res.enhanced;
            pw._updateSyntaxHighlight?.();
            pushPromptHistory(node, "✨ Enhanced [" + styleLabel + "] with " + (res.model || model));
            showStudioToast("Prompt enhanced [" + styleLabel + "] with " + (res.model || model) + "!");
            app.graph?.setDirtyCanvas(true, true);
        } else {
            showStudioToast("Ollama enhancement failed: " + (res.message || "Unknown error"), "error");
        }
    } catch (err) {
        showStudioToast("Error calling Ollama: " + err.message, "error");
    } finally {
        if (btn) btn.name = origLabel;
        app.graph?.setDirtyCanvas(true, true);
    }
}

// ── Ollama Selection / Highlight Refinement & Synonyms Picker ────────────────
async function executeSelectionRefinement(action, selected, start, end, ta, widget, node, onInputCallback) {
    let status = await checkOllamaStatus(false);
    if (!status.available) {
        status = await checkOllamaStatus(true);
    }
    if (!status.available) {
        showStudioToast("Ollama server is offline. Check settings.", "error");
        showOllamaStatusModal(node);
        return;
    }

    let model = app.ui?.settings?.getSettingValue?.("ModusFlow.OllamaEnhanceModel") ||
        (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_ollama_model")) ||
        "";
    if (!model || !model.trim() || model === "-- none --" || model === "--no models found--") {
        model = status.models.length ? status.models[0] : "llama3.2";
    }

    const styleWidget = node.widgets?.find(w => w.name === "prompt_style");
    const styleVal = (styleWidget?.value || "Tags (SDXL / Pony)").toLowerCase();
    const styleParam = styleVal.includes("expression") ? "expressions" : "tags";

    const labelMap = {
        expand: "Expand Details",
        synonyms: "Visual Synonyms",
        wrap_choice: "Wrap Choices",
        intensify: "Intensify",
        simplify: "Simplify",
        prosify: "Prosify",
        tagify: "Tagify"
    };

    const actionLabel = labelMap[action] || action;
    const previewText = selected.length > 20 ? selected.slice(0, 18) + "..." : selected;
    showStudioToast(`⏳ Ollama [${actionLabel}]: "${previewText}"...`);

    const fullText = ta.value || "";
    const context = fullText.slice(Math.max(0, start - 120), Math.min(fullText.length, end + 120));

    try {
        const resp = await fetch("/modusflow/refine_selection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: selected,
                action: action,
                context: context,
                model: model,
                style: styleParam
            })
        });
        const res = await resp.json();
        if (!res.success) {
            showStudioToast("Ollama refinement failed: " + (res.message || "Unknown error"), "error");
            return;
        }

        if (action === "synonyms") {
            const rawOpts = res.options && res.options.length ? res.options : [res.result];
            showSynonymsPickerModal(selected, rawOpts, start, end, ta, widget, node, onInputCallback);
            return;
        }

        let replacement = res.result;
        if (action === "wrap_choice") {
            const rawOpts = res.options && res.options.length ? res.options : [res.result];
            const filteredOpts = [selected, ...rawOpts.filter(o => o.toLowerCase() !== selected.toLowerCase())].slice(0, 4);
            replacement = `{${filteredOpts.join("|")}}`;
        }

        pushPromptHistory(node, `Pre-Refine (${actionLabel}): ${selected}`);
        node._pushPopoutHistory?.();
        ta.setRangeText(replacement, start, end, "select");
        if (widget) {
            widget.value = ta.value;
            if (widget.inputEl && widget.inputEl !== ta) widget.inputEl.value = ta.value;
            widget._updateSyntaxHighlight?.();
        }
        pushPromptHistory(node, `Refined (${actionLabel}): ${selected}`);
        node._pushPopoutHistory?.();
        showStudioToast(`✓ Refined [${actionLabel}] with ${res.model || model}!`);
        if (typeof onInputCallback === "function") {
            onInputCallback();
        }
        app.graph?.setDirtyCanvas(true, true);
    } catch (err) {
        showStudioToast("Error refining with Ollama: " + err.message, "error");
    }
}

function showSynonymsPickerModal(selected, options, start, end, ta, widget, node, onInputCallback) {
    const existing = document.getElementById("modusflow-synonyms-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "modusflow-synonyms-modal";
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100060; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #45475a; border-radius: 12px; padding: 18px; width: 480px; max-width: 92vw; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.75); color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="margin: 0; font-size: 15px; color: #89b4fa; display: flex; align-items: center; gap: 6px;">🔄 Visual Alternatives</h3>
            <span style="font-size: 11px; background: rgba(137, 180, 250, 0.15); color: #89b4fa; padding: 1px 7px; border-radius: 10px;">"${escapeHtml(selected)}"</span>
        </div>
    `;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size: 11px; color: #a6adc8;";
    hint.textContent = "Click any alternative below to replace in-place, or wrap all into a dynamic choice:";
    dialog.appendChild(hint);

    const list = document.createElement("div");
    list.style.cssText = "display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto;";

    const replaceText = (replacement, desc) => {
        pushPromptHistory(node, `Pre-Alternative: ${selected}`);
        node._pushPopoutHistory?.();
        ta.setRangeText(replacement, start, end, "select");
        if (widget) {
            widget.value = ta.value;
            if (widget.inputEl && widget.inputEl !== ta) widget.inputEl.value = ta.value;
            widget._updateSyntaxHighlight?.();
        }
        pushPromptHistory(node, `${desc}: ${replacement}`);
        node._pushPopoutHistory?.();
        showStudioToast(`Applied: ${replacement}`);
        overlay.remove();
        if (typeof onInputCallback === "function") onInputCallback();
        app.graph?.setDirtyCanvas(true, true);
    };

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 8px 12px; color: #cdd6f4; font-size: 12px; text-align: left; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: space-between;";
        btn.innerHTML = `<span>${escapeHtml(opt)}</span><span style="font-size: 10px; color: #6c7086;">Click to swap</span>`;
        btn.onmouseenter = () => { btn.style.borderColor = "#89b4fa"; btn.style.background = "#2a2b3d"; btn.style.color = "#89b4fa"; };
        btn.onmouseleave = () => { btn.style.borderColor = "#313244"; btn.style.background = "#1e1e2e"; btn.style.color = "#cdd6f4"; };
        btn.onclick = () => replaceText(opt, "Alternative");
        list.appendChild(btn);
    });
    dialog.appendChild(list);

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #313244; padding-top: 10px; margin-top: 4px;";

    const wrapAllBtn = document.createElement("button");
    wrapAllBtn.style.cssText = "background: rgba(137, 180, 250, 0.15); border: 1px solid #89b4fa; border-radius: 6px; padding: 6px 12px; color: #89b4fa; font-size: 11px; font-weight: 600; cursor: pointer;";
    wrapAllBtn.innerHTML = `⚄ Wrap All as Choice {${options.length + 1} items}`;
    wrapAllBtn.onclick = () => {
        const allOpts = [selected, ...options.filter(o => o.toLowerCase() !== selected.toLowerCase())];
        replaceText(`{${allOpts.join("|")}}`, "Wrapped Choices");
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 6px 12px; color: #a6adc8; font-size: 11px; cursor: pointer;";
    cancelBtn.onclick = () => overlay.remove();

    footer.appendChild(wrapAllBtn);
    footer.appendChild(cancelBtn);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

function showOllamaSelectionMenu(x, y, selected, start, end, ta, widget, node, onInputCallback) {
    const existing = document.getElementById("modusflow-selection-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.id = "modusflow-selection-menu";
    menu.style.cssText = "position: fixed; z-index: 100020; background: #181825; border: 1px solid #45475a; border-radius: 9px; box-shadow: 0 16px 40px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255,255,255,0.1); padding: 6px; min-width: 270px; color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;";

    let posX = Math.min(window.innerWidth - 290, Math.max(10, x));
    let posY = Math.min(window.innerHeight - 380, Math.max(10, y));
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    const preview = selected.length > 22 ? selected.slice(0, 19) + "..." : selected;

    const head = document.createElement("div");
    head.style.cssText = "padding: 5px 8px 6px 8px; border-bottom: 1px solid #313244; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px;";
    head.innerHTML = `
        <div style="font-weight: 700; color: #89b4fa; display: flex; align-items: center; gap: 6px; font-size: 12px;">
            <span>🤖 Ollama: Refine Selection</span>
        </div>
        <span style="font-size: 11px; color: #f5c2e7; background: rgba(245, 194, 231, 0.12); padding: 1px 6px; border-radius: 4px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${escapeHtml(preview)}"</span>
    `;
    menu.appendChild(head);

    const items = [
        { action: "expand", icon: "✨", title: "Expand & Elaborate", desc: "Sensory, lighting & material details" },
        { action: "synonyms", icon: "🔄", title: "Visual Synonyms...", desc: "Browse 4-5 alternative choices" },
        { action: "wrap_choice", icon: "⚄", title: "Wrap as Dynamic Choice", desc: "Format as {original | opt1 | opt2}" },
        { action: "intensify", icon: "⚡", title: "Intensify & Elevate", desc: "Dramatic, striking & powerful phrasing" },
        { action: "simplify", icon: "✂️", title: "Simplify & Compact", desc: "Boil down to core visual keywords" },
        { action: "prosify", icon: "✍️", title: "Prosify (Fluent Sentences)", desc: "Natural English prose for Flux/SD3" },
        { action: "tagify", icon: "🏷️", title: "Tagify (Keyword Tags)", desc: "Comma visual tags for SDXL/Pony" }
    ];

    items.forEach(it => {
        const itemEl = document.createElement("div");
        itemEl.style.cssText = "padding: 6px 8px; border-radius: 5px; cursor: pointer; display: flex; flex-direction: column; gap: 1px; transition: all 0.12s ease;";
        itemEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #cdd6f4;">
                <span>${it.icon}</span>
                <span>${it.title}</span>
            </div>
            <div style="font-size: 10px; color: #6c7086; padding-left: 20px;">${it.desc}</div>
        `;
        itemEl.onmouseenter = () => {
            itemEl.style.background = "#313244";
            itemEl.querySelector("span:last-child").style.color = "#89b4fa";
        };
        itemEl.onmouseleave = () => {
            itemEl.style.background = "transparent";
            itemEl.querySelector("span:last-child").style.color = "#6c7086";
        };
        itemEl.onclick = (e) => {
            e.stopPropagation();
            menu.remove();
            executeSelectionRefinement(it.action, selected, start, end, ta, widget, node, onInputCallback);
        };
        menu.appendChild(itemEl);
    });

    const closeListener = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener("pointerdown", closeListener, true);
        }
    };
    setTimeout(() => {
        document.addEventListener("pointerdown", closeListener, true);
    }, 10);

    document.body.appendChild(menu);
}

function attachOllamaSelectionContextMenu(widgetOrEl, widget, node, onInputCallback) {
    const bind = (el) => {
        if (!el || el._hasOllamaContextMenu) return;
        el._hasOllamaContextMenu = true;
        el.addEventListener("contextmenu", (e) => {
            let start = el.selectionStart;
            let end = el.selectionEnd;
            let selected = (el.value || "").slice(start, end).trim();

            if (!selected) {
                let wStart = start;
                while (wStart > 0 && /[^\s,\n]/.test(el.value[wStart - 1])) wStart--;
                let wEnd = end;
                while (wEnd < el.value.length && /[^\s,\n]/.test(el.value[wEnd])) wEnd++;
                selected = (el.value || "").slice(wStart, wEnd).trim();
                if (selected) {
                    start = wStart;
                    end = wEnd;
                }
            }

            if (!selected) return;

            e.preventDefault();
            e.stopPropagation();
            showOllamaSelectionMenu(e.clientX, e.clientY, selected, start, end, el, widget, node, onInputCallback);
        });
    };

    if (widgetOrEl instanceof HTMLElement) {
        bind(widgetOrEl);
    } else if (widgetOrEl?.inputEl) {
        bind(widgetOrEl.inputEl);
    }
    requestAnimationFrame(() => {
        const el = widgetOrEl instanceof HTMLElement ? widgetOrEl : (widgetOrEl?.inputEl || widgetOrEl?.element);
        if (el) bind(el);
    });
}

// ── Convert Prompt Style (Tags ↔ Expressions / Pony ↔ Flux) ─────────────────
function convertPromptStyle(node, targetStyle) {
    const pw = node.widgets?.find(w => w.name === "positive");
    const nw = node.widgets?.find(w => w.name === "negative");
    const styleWidget = node.widgets?.find(w => w.name === "prompt_style");
    if (!pw) return;

    if (!targetStyle) {
        const cur = (styleWidget?.value || "").toLowerCase();
        targetStyle = cur.includes("expression") ? "Tags (SDXL / Pony)" : "Expressions (Flux / SD3)";
    }

    const isTargetExpressions = targetStyle.toLowerCase().includes("expression");

    if (isTargetExpressions) {
        prosifyPositivePrompt(node);
        if (nw && nw.value) {
            let neg = nw.value;
            neg = neg.replace(/\(([^():\r\n]+):\s*\d+(?:\.\d+)?\)/g, "$1");
            nw.value = neg;
            if (nw.inputEl) nw.inputEl.value = neg;
            nw._updateSyntaxHighlight?.();
        }
        if (styleWidget) styleWidget.value = "Expressions (Flux / SD3)";
        node.properties = node.properties || {};
        node.properties["prompt_style"] = "Expressions (Flux / SD3)";
        node._popoutSyncStyle?.("Expressions (Flux / SD3)");
        node._popoutSyncFromNode?.();
        showStudioToast("Converted to Expressions style (Flux/SD3 natural language)");
    } else {
        tagifyPositivePrompt(node);
        if (styleWidget) styleWidget.value = "Tags (SDXL / Pony)";
        node.properties = node.properties || {};
        node.properties["prompt_style"] = "Tags (SDXL / Pony)";
        node._popoutSyncStyle?.("Tags (SDXL / Pony)");
        node._popoutSyncFromNode?.();
        showStudioToast("Converted to Tags style (SDXL/Pony weighted tags)");
    }
    app.graph?.setDirtyCanvas(true, true);
}

// ── Dedicated ModusFlow Studio & AI Settings Modal ───────────────────────────
async function showModusFlowSettingsModal(node) {
    const existing = document.getElementById("modusflow-settings-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "modusflow-settings-modal";
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(5px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #45475a; border-radius: 12px; padding: 22px; width: 620px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.8); color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-y: auto;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 10px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 8px;">⚙️ <span>ModusFlow Studio &amp; AI Settings</span></h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    let cfg = {
        ollama_url: "http://127.0.0.1:11434",
        ollama_timeout: 120,
        cloud_api_url: "https://openrouter.ai/api/v1",
        cloud_api_key: "",
        cloud_model: "deepseek/deepseek-chat",
        civitai_api_key: "",
        prompts_save_directory: ""
    };
    try {
        const resp = await fetch("/modusflow/get_config");
        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.data) cfg = Object.assign(cfg, data.data);
        }
    } catch (_) {}

    const body = document.createElement("div");
    body.style.cssText = "display: flex; flex-direction: column; gap: 14px;";

    const mkSection = (title) => {
        const sec = document.createElement("div");
        sec.style.cssText = "font-size: 11px; font-weight: 700; color: #89b4fa; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #313244; padding-bottom: 4px; margin-top: 4px;";
        sec.textContent = title;
        body.appendChild(sec);
    };

    const mkField = (label, el, hint = "") => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
        const lbl = document.createElement("label");
        lbl.style.cssText = "font-size: 12px; font-weight: 600; color: #cdd6f4;";
        lbl.textContent = label;
        row.appendChild(lbl);
        row.appendChild(el);
        if (hint) {
            const h = document.createElement("div");
            h.style.cssText = "font-size: 11px; color: #6c7086; line-height: 1.3;";
            h.textContent = hint;
            row.appendChild(h);
        }
        body.appendChild(row);
        return el;
    };

    const mkInput = (val, placeholder = "", type = "text") => {
        const input = document.createElement("input");
        input.type = type;
        input.value = val || "";
        input.placeholder = placeholder;
        input.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none;";
        input.onfocus = () => { input.style.borderColor = "#89b4fa"; };
        input.onblur = () => { input.style.borderColor = "#313244"; };
        return input;
    };

    // 1. Local Ollama Settings
    mkSection("1. Local Ollama AI LLM");
    const ollamaUrlInput = mkField("Local Ollama Server URL", mkInput(cfg.ollama_url, "http://127.0.0.1:11434"), "Endpoint for local Ollama instance (default: http://127.0.0.1:11434)");

    const modelRow = document.createElement("div");
    modelRow.style.cssText = "display: flex; gap: 8px; align-items: flex-end;";

    const selWrap = document.createElement("div");
    selWrap.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 4px;";
    const selLbl = document.createElement("label");
    selLbl.style.cssText = "font-size: 12px; font-weight: 600; color: #cdd6f4;";
    selLbl.textContent = "Enhancement Model";
    selWrap.appendChild(selLbl);

    const modelSel = document.createElement("select");
    modelSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none; cursor: pointer;";
    selWrap.appendChild(modelSel);
    modelRow.appendChild(selWrap);

    const testBtn = document.createElement("button");
    testBtn.textContent = "🔍 Test / Refresh";
    testBtn.style.cssText = "background: #313244; border: 1px solid #45475a; border-radius: 6px; padding: 8px 12px; color: #89b4fa; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;";
    modelRow.appendChild(testBtn);
    body.appendChild(modelRow);

    const statusPill = document.createElement("div");
    statusPill.style.cssText = "font-size: 11px; padding: 5px 8px; border-radius: 5px; background: rgba(17, 17, 27, 0.8); border: 1px solid #313244; color: #a6adc8;";
    statusPill.textContent = "Checking Ollama status...";
    body.appendChild(statusPill);

    const updateOllamaUi = (st) => {
        modelSel.innerHTML = "";
        const curModel = app.ui?.settings?.getSettingValue?.("ModusFlow.OllamaEnhanceModel") || "";
        if (st.available && st.models?.length) {
            st.models.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                if (m === curModel) opt.selected = true;
                modelSel.appendChild(opt);
            });
            statusPill.innerHTML = `<span style="color: #a6e3a1; font-weight: bold;">🟢 Online</span> · Connected to ${escapeHtml(st.url)} (${st.models.length} models)`;
        } else {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "-- No models detected --";
            modelSel.appendChild(opt);
            statusPill.innerHTML = `<span style="color: #f38ba8; font-weight: bold;">🔴 Offline</span> · ${escapeHtml(st.error || 'Connection failed')}`;
        }
    };

    checkOllamaStatus(false).then(updateOllamaUi);
    testBtn.onclick = async () => {
        testBtn.textContent = "⏳ Testing...";
        testBtn.disabled = true;
        _ollamaUrl = (ollamaUrlInput.value || "").trim().replace(/\/+$/, "");
        const st = await checkOllamaStatus(true);
        updateOllamaUi(st);
        testBtn.textContent = "🔍 Test / Refresh";
        testBtn.disabled = false;
    };

    const timeoutInput = mkField("Ollama Timeout (seconds)", mkInput(cfg.ollama_timeout || 120, "120", "number"), "Timeout before canceling long LLM completions.");

    // 2. Cloud LLM Settings
    mkSection("2. Cloud LLMs (OpenAI, OpenRouter, Groq, DeepSeek)");
    const cloudUrlInput = mkField("Cloud API Base URL", mkInput(cfg.cloud_api_url, "https://openrouter.ai/api/v1"), "OpenAI-compatible chat completions endpoint");
    const cloudKeyInput = mkField("Cloud API Key", mkInput(cfg.cloud_api_key, "sk-...", "password"), "API key for OpenRouter or OpenAI cloud models");
    const cloudModelInput = mkField("Default Cloud Model", mkInput(cfg.cloud_model, "deepseek/deepseek-chat"), "e.g. deepseek/deepseek-chat, anthropic/claude-3.5-sonnet, openai/gpt-4o-mini");

    // 3. Studio & Storage Defaults
    mkSection("3. Prompt Studio Defaults & Storage");
    const civitaiKeyInput = mkField("Civitai API Key", mkInput(cfg.civitai_api_key, "API Key"), "Used for high-resolution LoRA cards and metadata previews");
    const saveDirInput = mkField("Prompts Directory Override", mkInput(cfg.prompts_save_directory, "Leave blank for default: BASE_DIR/saved_prompts"), "Custom storage folder for prompt presets");

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #313244; padding-top: 12px; margin-top: 8px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 7px 14px; color: #a6adc8; font-size: 12px; cursor: pointer;";
    cancelBtn.onclick = () => overlay.remove();

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 Save & Apply Settings";
    saveBtn.style.cssText = "background: #89b4fa; border: none; border-radius: 6px; padding: 7px 16px; color: #11111b; font-size: 12px; font-weight: 700; cursor: pointer;";

    saveBtn.onclick = async () => {
        saveBtn.textContent = "⏳ Saving...";
        saveBtn.disabled = true;

        const payload = {
            ollama_url: (ollamaUrlInput.value || "").trim().replace(/\/+$/, ""),
            ollama_timeout: parseInt(timeoutInput.value, 10) || 120,
            cloud_api_url: (cloudUrlInput.value || "").trim().replace(/\/+$/, ""),
            cloud_api_key: (cloudKeyInput.value || "").trim(),
            cloud_model: (cloudModelInput.value || "").trim(),
            civitai_api_key: (civitaiKeyInput.value || "").trim(),
            prompts_save_directory: (saveDirInput.value || "").trim()
        };

        if (modelSel.value) {
            payload.ollama_model = modelSel.value;
            app.ui?.settings?.setSettingValue?.("ModusFlow.OllamaEnhanceModel", modelSel.value);
            try { localStorage.setItem("modusflow_ollama_model", modelSel.value); } catch (_) {}
        }

        try {
            const resp = await fetch("/modusflow/save_config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const res = await resp.json();
            if (res.success) {
                showStudioToast("Settings saved successfully!");
                overlay.remove();
            } else {
                showStudioToast("Failed to save settings: " + res.message, "error");
            }
        } catch (err) {
            showStudioToast("Save error: " + err.message, "error");
        } finally {
            saveBtn.textContent = "💾 Save & Apply Settings";
            saveBtn.disabled = false;
        }
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}
window.modusflowShowSettings = showModusFlowSettingsModal;

// ── Quick Chips Modal ────────────────────────────────────────────────────────
const QUICK_CHIPS_DATA = {
    "💡 Lighting & Atmosphere": [
        "cinematic volumetric lighting", "golden hour sunlight", "dramatic rim lighting",
        "moody chiaroscuro", "soft studio lighting", "cyberpunk neon glow",
        "bioluminescent illumination", "god rays", "misty ambient fog", "dramatic backlighting"
    ],
    "📷 Optics & Framing": [
        "85mm f/1.4 portrait lens", "shallow depth of field", "anamorphic lens flare",
        "subtle creamy bokeh", "macro close-up photography", "wide-angle dynamic shot",
        "Dutch angle", "cinematic film grain 35mm", "low-angle heroic composition", "eye-level framing"
    ],
    "🎨 Style & Aesthetics": [
        "photorealistic RAW photo", "hyperdetailed textures", "award-winning photography",
        "editorial magazine cover", "octane render 8k", "tactile fabric weave",
        "subsurface scattering skin", "subtle skin pores", "film still aesthetic", "masterpiece quality"
    ],
    "🎭 Mood & Color Palette": [
        "monochromatic elegance", "desaturated film grading", "vibrant high contrast",
        "warm nostalgic tones", "cool blue shadows", "duotone cyberpunk palette",
        "pastel tones aesthetic", "moody atmospheric gloom"
    ]
};

function insertChipIntoPrompt(node, chipText) {
    const pw = node.widgets?.find(w => w.name === "positive");
    if (!pw) return;
    const ta = pw.inputEl || pw.element;
    const current = pw.value || "";

    if (ta && document.activeElement === ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = current.slice(0, start);
        const after = current.slice(end);

        let insert = chipText;
        if (before.trim() && !before.trim().endsWith(",")) insert = ", " + insert;
        if (after.trim() && !after.trim().startsWith(",")) insert = insert + ", ";

        ta.setRangeText(insert, start, end, "end");
        pw.value = ta.value;
    } else {
        let updated = current.trim();
        if (updated && !updated.endsWith(",")) {
            updated += ", " + chipText;
        } else if (updated) {
            updated += " " + chipText;
        } else {
            updated = chipText;
        }
        pw.value = updated;
        if (ta) ta.value = updated;
    }
    pw._updateSyntaxHighlight?.();
    pushPromptHistory(node, "Added chip: " + chipText);
    app.graph?.setDirtyCanvas(true, true);
}

function showQuickChipsModal(node) {
    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 620px; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #cdd6f4; font-family: sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa;">⚡ Quick Chips — Visual Tags</h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const searchInput = document.createElement("input");
    searchInput.placeholder = "Filter chips (e.g. lighting, lens, bokeh)...";
    searchInput.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 8px 12px; color: #cdd6f4; font-size: 13px; outline: none;";
    dialog.appendChild(searchInput);

    const bodyContainer = document.createElement("div");
    bodyContainer.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-height: 520px; padding-right: 4px;";

    function renderChips(filter = "") {
        bodyContainer.innerHTML = "";
        const q = filter.toLowerCase().trim();

        for (const [category, chips] of Object.entries(QUICK_CHIPS_DATA)) {
            const matching = chips.filter(c => !q || c.toLowerCase().includes(q));
            if (!matching.length) continue;

            const catSec = document.createElement("div");
            catSec.innerHTML = `<div style="font-size: 12px; font-weight: bold; color: #cba6f7; margin-bottom: 6px;">${category}</div>`;

            const chipGrid = document.createElement("div");
            chipGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";

            for (const chip of matching) {
                const btn = document.createElement("button");
                btn.textContent = chip;
                btn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 5px 10px; color: #cdd6f4; font-size: 12px; cursor: pointer; transition: all 0.15s ease;";
                btn.onmouseenter = () => { btn.style.borderColor = "#89b4fa"; btn.style.background = "#26263b"; };
                btn.onmouseleave = () => { btn.style.borderColor = "#313244"; btn.style.background = "#1e1e2e"; };

                btn.onclick = () => {
                    insertChipIntoPrompt(node, chip);
                    const origText = btn.textContent;
                    btn.textContent = "✓ Added";
                    btn.style.borderColor = "#a6e3a1";
                    btn.style.color = "#a6e3a1";
                    setTimeout(() => {
                        btn.textContent = origText;
                        btn.style.borderColor = "#313244";
                        btn.style.color = "#cdd6f4";
                    }, 800);
                };
                chipGrid.appendChild(btn);
            }

            catSec.appendChild(chipGrid);
            bodyContainer.appendChild(catSec);
        }
    }

    searchInput.oninput = () => renderChips(searchInput.value);
    renderChips();

    dialog.appendChild(bodyContainer);
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── Prompt Diff Viewer ────────────────────────────────────────────────────────
function computeTokenDiff(oldText, newText) {
    const oldTokens = (oldText || "").split(/([,\n]|\s+)/).filter(Boolean);
    const newTokens = (newText || "").split(/([,\n]|\s+)/).filter(Boolean);

    const diff = [];
    let i = 0, j = 0;
    while (i < oldTokens.length || j < newTokens.length) {
        if (i < oldTokens.length && j < newTokens.length && oldTokens[i] === newTokens[j]) {
            diff.push({ type: "same", text: oldTokens[i] });
            i++; j++;
        } else if (j < newTokens.length && (!oldTokens.slice(i, i + 6).includes(newTokens[j]))) {
            diff.push({ type: "add", text: newTokens[j] });
            j++;
        } else if (i < oldTokens.length) {
            diff.push({ type: "del", text: oldTokens[i] });
            i++;
        } else {
            diff.push({ type: "add", text: newTokens[j] });
            j++;
        }
    }
    return diff;
}

function showPromptDiffModal(node) {
    let list = [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        list = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    const pw = node.widgets?.find(w => w.name === "positive");
    const currentPos = pw?.value || "";

    const overlay = document.createElement("div");
    overlay.className = "modusflow-modal-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 680px; max-height: 85vh; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #cdd6f4; font-family: sans-serif;";

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
    header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa;">🔍 Prompt Diff Viewer</h3>';

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const selectorRow = document.createElement("div");
    selectorRow.style.cssText = "display: flex; align-items: center; gap: 10px; font-size: 12px;";
    selectorRow.innerHTML = '<span style="color: #a6adc8;">Compare current with:</span>';

    const select = document.createElement("select");
    select.style.cssText = "flex: 1; background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 6px 10px; color: #cdd6f4; outline: none;";

    if (list.length) {
        list.forEach((it, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            opt.textContent = `#${idx + 1} · ${it.label || "Snapshot"} (${it.time})`;
            select.appendChild(opt);
        });
    } else {
        const opt = document.createElement("option");
        opt.value = -1;
        opt.textContent = "-- No history snapshots available --";
        select.appendChild(opt);
    }
    selectorRow.appendChild(select);
    dialog.appendChild(selectorRow);

    const diffBox = document.createElement("div");
    diffBox.style.cssText = "overflow-y: auto; background: #11111b; border: 1px solid #313244; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 12px; line-height: 1.6; max-height: 400px; white-space: pre-wrap; word-break: break-word;";
    dialog.appendChild(diffBox);

    function updateDiff() {
        const idx = parseInt(select.value, 10);
        if (idx < 0 || !list[idx]) {
            diffBox.innerHTML = '<span style="color: #6c7086; font-style: italic;">No comparison target selected.</span>';
            return;
        }
        const target = list[idx].positive || "";
        const diffTokens = computeTokenDiff(target, currentPos);

        let out = "";
        for (const token of diffTokens) {
            const escaped = escapeHtml(token.text);
            if (token.type === "add") {
                out += `<span style="background: rgba(166, 227, 161, 0.22); color: #a6e3a1; font-weight: bold; border-radius: 2px; padding: 1px 3px;">+${escaped}</span>`;
            } else if (token.type === "del") {
                out += `<span style="background: rgba(243, 139, 168, 0.22); color: #f38ba8; text-decoration: line-through; border-radius: 2px; padding: 1px 3px;">-${escaped}</span>`;
            } else {
                out += `<span style="color: #cdd6f4;">${escaped}</span>`;
            }
        }
        diffBox.innerHTML = out || '<span style="color: #a6e3a1;">(No differences detected)</span>';
    }

    select.onchange = updateDiff;
    updateDiff();

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 6px;";

    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "Restore Target Snapshot";
    restoreBtn.style.cssText = "background: #313244; color: #89b4fa; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 12px;";
    restoreBtn.onclick = () => {
        const idx = parseInt(select.value, 10);
        if (idx >= 0 && list[idx]) {
            const item = list[idx];
            if (pw) {
                pw.value = item.positive || "";
                if (pw.inputEl) pw.inputEl.value = item.positive || "";
                pw._updateSyntaxHighlight?.();
            }
            const nw = node.widgets?.find(w => w.name === "negative");
            if (nw && item.negative !== undefined) {
                nw.value = item.negative || "";
                if (nw.inputEl) nw.inputEl.value = item.negative || "";
                nw._updateSyntaxHighlight?.();
            }
            pushPromptHistory(node, "Restored: " + (item.label || "Snapshot"));
            overlay.remove();
        }
    };
    footer.appendChild(restoreBtn);

    const legend = document.createElement("div");
    legend.style.cssText = "font-size: 11px; color: #a6adc8; display: flex; gap: 10px;";
    legend.innerHTML = '<span style="color: #a6e3a1;">● Added in current</span> <span style="color: #f38ba8;">● Removed from target</span>';
    footer.appendChild(legend);

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── Image Metadata Reader (PNG & WebP Drag & Drop) ───────────────────────────
function findBestModusFlowTextEditor(promptObj, workflowObj) {
    const candidates = new Map(); // id -> { id, promptNode, workflowNode, score: 0, positive: "", negative: "", seed: null, weight_mode: null }

    // 1. Collect from promptObj (ComfyUI execution graph)
    if (promptObj && typeof promptObj === "object") {
        for (const [id, node] of Object.entries(promptObj)) {
            if (!node || typeof node !== "object") continue;
            const cls = node.class_type || "";
            if (cls === "ModusFlowTextEditor") {
                const inputs = node.inputs || {};
                candidates.set(String(id), {
                    id: String(id),
                    promptNode: node,
                    workflowNode: null,
                    score: 1, // base score for being in execution graph
                    positive: typeof inputs.positive === "string" ? inputs.positive : "",
                    negative: typeof inputs.negative === "string" ? inputs.negative : "",
                    seed: (inputs.seed !== undefined && inputs.seed !== null) ? parseInt(inputs.seed, 10) : null,
                    weight_mode: typeof inputs.weight_mode === "string" ? inputs.weight_mode : null
                });
            }
        }
    }

    // 2. Collect from workflowObj (LiteGraph canvas graph)
    if (workflowObj && Array.isArray(workflowObj.nodes)) {
        for (const wfNode of workflowObj.nodes) {
            if (!wfNode || wfNode.type !== "ModusFlowTextEditor") continue;
            const id = String(wfNode.id);
            let cand = candidates.get(id);
            if (!cand) {
                cand = {
                    id: id,
                    promptNode: null,
                    workflowNode: wfNode,
                    score: 0,
                    positive: "",
                    negative: "",
                    seed: null,
                    weight_mode: null
                };
                candidates.set(id, cand);
            } else {
                cand.workflowNode = wfNode;
            }
        }
    }

    if (candidates.size === 0) return null;

    // 3. Analyze downstream connections in promptObj
    if (promptObj && typeof promptObj === "object") {
        for (const [consumerId, consumerNode] of Object.entries(promptObj)) {
            if (!consumerNode || !consumerNode.inputs) continue;
            const targetCls = (consumerNode.class_type || "").toLowerCase();
            const isSampler = targetCls.includes("sampler") || targetCls.includes("detailer");
            const isCond = targetCls.includes("conditioning") || targetCls.includes("clip") || targetCls.includes("pipe");
            const isSave = targetCls.includes("save") || targetCls.includes("preview");

            for (const [inputKey, val] of Object.entries(consumerNode.inputs)) {
                if (Array.isArray(val) && val.length >= 2) {
                    const sourceId = String(val[0]);
                    const cand = candidates.get(sourceId);
                    if (cand) {
                        cand.score += 20; // Connected to another node
                        if (isSampler) {
                            cand.score += 100; // Directly feeds sampler/detailer
                            if ((cand.seed === null || cand.seed === 0) && consumerNode.inputs.seed !== undefined) {
                                const s = parseInt(consumerNode.inputs.seed, 10);
                                if (!isNaN(s) && s > 0) cand.seed = s;
                            }
                        } else if (isCond) {
                            cand.score += 60; // Feeds conditioning/pipe/clip
                        } else if (isSave) {
                            cand.score += 30;
                        }
                    }
                }
            }
        }
    }

    // 4. Analyze output links in workflowObj
    if (workflowObj && Array.isArray(workflowObj.nodes)) {
        const linkMap = new Map();
        if (Array.isArray(workflowObj.links)) {
            for (const l of workflowObj.links) {
                if (Array.isArray(l) && l.length >= 5) {
                    linkMap.set(l[0], { originId: String(l[1]), targetId: String(l[3]) });
                }
            }
        }

        const nodeTypeMap = new Map();
        for (const n of workflowObj.nodes) {
            if (n && n.id !== undefined) nodeTypeMap.set(String(n.id), (n.type || "").toLowerCase());
        }

        for (const cand of candidates.values()) {
            if (!cand.workflowNode) continue;
            const outputs = cand.workflowNode.outputs || [];
            let activeLinks = 0;
            for (const out of outputs) {
                if (Array.isArray(out.links) && out.links.length > 0) {
                    activeLinks += out.links.length;
                    for (const lId of out.links) {
                        const linkInfo = linkMap.get(lId);
                        if (linkInfo) {
                            const targetType = nodeTypeMap.get(linkInfo.targetId) || "";
                            if (targetType.includes("sampler") || targetType.includes("detailer")) {
                                cand.score += 100;
                            } else if (targetType.includes("clip") || targetType.includes("pipe") || targetType.includes("cond")) {
                                cand.score += 50;
                            } else {
                                cand.score += 15;
                            }
                        }
                    }
                }
            }
            cand.score += activeLinks * 10;

            // Fallback for widgets_values if promptNode was not present
            if ((!cand.positive || !cand.negative) && Array.isArray(cand.workflowNode.widgets_values)) {
                const vals = cand.workflowNode.widgets_values;
                for (const wv of vals) {
                    if (typeof wv === "string" && wv.length > 5) {
                        if (!cand.positive) cand.positive = wv;
                        else if (!cand.negative && wv !== cand.positive) cand.negative = wv;
                    } else if (typeof wv === "number" && wv > 1000 && cand.seed === null) {
                        cand.seed = wv;
                    }
                }
            }
        }
    }

    // Bonus for meaningful prompt text length
    for (const cand of candidates.values()) {
        if (cand.positive && cand.positive.trim().length > 0) {
            cand.score += 10;
        }
    }

    const sorted = Array.from(candidates.values()).sort((a, b) => b.score - a.score);
    return sorted[0] || null;
}

function findConnectedClipTextEncode(promptObj, workflowObj) {
    if (!promptObj || typeof promptObj !== "object") return null;
    let posText = "";
    let negText = "";
    let seed = null;

    for (const [id, node] of Object.entries(promptObj)) {
        if (!node || typeof node !== "object") continue;
        const cls = (node.class_type || "").toLowerCase();
        if (cls.includes("sampler") && node.inputs) {
            if (node.inputs.seed !== undefined) seed = parseInt(node.inputs.seed, 10);

            const posRef = node.inputs.positive;
            if (Array.isArray(posRef)) {
                const posNode = promptObj[String(posRef[0])];
                if (posNode && posNode.inputs && posNode.inputs.text) {
                    posText = posNode.inputs.text;
                }
            }

            const negRef = node.inputs.negative;
            if (Array.isArray(negRef)) {
                const negNode = promptObj[String(negRef[0])];
                if (negNode && negNode.inputs && negNode.inputs.text) {
                    negText = negNode.inputs.text;
                }
            }
        }
    }

    if (posText || negText) {
        return { positive: posText, negative: negText, seed: seed };
    }
    return null;
}

function extractMetadataFromBuffer(buffer, filename) {
    const bytes = new Uint8Array(buffer);
    const result = { positive: "", negative: "", seed: null, weight_mode: null, source: "" };
    const decoder = new TextDecoder("utf-8");

    let promptObj = null;
    let workflowObj = null;
    let parametersStr = "";

    const readUint32BE = (offset) => {
        return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
    };

    // 1. PNG Parsing
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        let offset = 8;
        while (offset < bytes.length - 8) {
            const length = readUint32BE(offset);
            const chunkType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
            const dataOffset = offset + 8;

            if (chunkType === "tEXt" || chunkType === "iTXt") {
                let nullSep = -1;
                for (let i = dataOffset; i < dataOffset + length; i++) {
                    if (bytes[i] === 0) { nullSep = i; break; }
                }
                if (nullSep !== -1) {
                    const keyword = decoder.decode(bytes.subarray(dataOffset, nullSep));
                    let text = "";
                    if (chunkType === "tEXt") {
                        text = decoder.decode(bytes.subarray(nullSep + 1, dataOffset + length));
                    } else if (chunkType === "iTXt") {
                        let pos = nullSep + 3;
                        while (pos < dataOffset + length && bytes[pos] !== 0) pos++;
                        pos++;
                        while (pos < dataOffset + length && bytes[pos] !== 0) pos++;
                        pos++;
                        text = decoder.decode(bytes.subarray(pos, dataOffset + length));
                    }

                    if (keyword === "prompt") {
                        try { promptObj = JSON.parse(text); } catch (_) {}
                    } else if (keyword === "workflow") {
                        try { workflowObj = JSON.parse(text); } catch (_) {}
                    } else if (keyword === "parameters") {
                        parametersStr = text;
                    }
                }
            }
            offset += 12 + length;
        }
    } else {
        // 2. WebP RIFF or Raw Stream Parsing
        const rawString = decoder.decode(bytes);

        // Search for JSON prompt and workflow chunks in WebP/raw
        const promptIdx = rawString.indexOf('"ModusFlowTextEditor"');
        if (promptIdx !== -1) {
            const firstBrace = rawString.lastIndexOf("{", promptIdx);
            if (firstBrace !== -1) {
                // Try scanning forward for valid JSON
                for (let end = promptIdx + 50; end < Math.min(rawString.length, promptIdx + 50000); end += 500) {
                    const closeBrace = rawString.indexOf("}", end);
                    if (closeBrace === -1) break;
                    try {
                        const parsed = JSON.parse(rawString.slice(firstBrace, closeBrace + 1));
                        if (parsed && typeof parsed === "object") {
                            if (parsed.nodes) workflowObj = parsed;
                            else promptObj = parsed;
                            break;
                        }
                    } catch (_) {}
                }
            }
        }

        if (rawString.includes("Negative prompt:") || rawString.includes("Steps:")) {
            parametersStr = rawString;
        }
    }

    // Step A: Priority 1 — Tailored specifically for ModusFlowTextEditor (connected candidate)
    const bestEditor = findBestModusFlowTextEditor(promptObj, workflowObj);
    if (bestEditor && (bestEditor.positive || bestEditor.negative || bestEditor.seed !== null)) {
        result.positive = bestEditor.positive;
        result.negative = bestEditor.negative;
        result.seed = bestEditor.seed;
        result.weight_mode = bestEditor.weight_mode;
        result.source = `ModusFlowTextEditor (Node #${bestEditor.id} · Connected)`;
        return result;
    }

    // Step B: Priority 2 — Connected standard ComfyUI CLIP nodes
    const clipMeta = findConnectedClipTextEncode(promptObj, workflowObj);
    if (clipMeta && (clipMeta.positive || clipMeta.negative)) {
        result.positive = clipMeta.positive;
        result.negative = clipMeta.negative;
        result.seed = clipMeta.seed;
        result.source = "ComfyUI CLIPTextEncode";
        return result;
    }

    // Step C: Priority 3 — A1111 / WebUI / Forge Parameters
    if (parametersStr) {
        parseA1111Parameters(parametersStr, result);
        result.source = "A1111 Parameters";
        return result;
    }

    return result;
}

function parseA1111Parameters(text, result) {
    if (!text) return;
    const negMatch = text.match(/Negative prompt:\s*([\s\S]*?)(?=\nSteps:|\n[A-Z][a-zA-Z\s]+:|$)/i);
    const stepsMatch = text.match(/\nSteps:\s*[\s\S]*$/i);

    if (negMatch) {
        result.positive = text.slice(0, negMatch.index).trim();
        result.negative = negMatch[1].trim();
    } else if (stepsMatch) {
        result.positive = text.slice(0, stepsMatch.index).trim();
    } else {
        result.positive = text.trim();
    }

    const seedMatch = text.match(/\bSeed:\s*(\d+)/i);
    if (seedMatch) {
        result.seed = parseInt(seedMatch[1], 10);
    }
}

async function handleImageFileDrop(file, node) {
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const meta = extractMetadataFromBuffer(buffer, file.name);
        if (meta && (meta.positive || meta.negative || meta.seed !== null)) {
            const pw = node.widgets?.find(w => w.name === "positive");
            const nw = node.widgets?.find(w => w.name === "negative");
            const sw = node.widgets?.find(w => w.name === "seed");
            const wmw = node.widgets?.find(w => w.name === "weight_mode");

            if (pw && meta.positive !== undefined) {
                pw.value = meta.positive;
                if (pw.inputEl) pw.inputEl.value = meta.positive;
                pw._updateSyntaxHighlight?.();
            }
            if (nw && meta.negative !== undefined) {
                nw.value = meta.negative;
                if (nw.inputEl) nw.inputEl.value = meta.negative;
                nw._updateSyntaxHighlight?.();
            }
            if (sw && meta.seed !== null && meta.seed !== undefined) {
                sw.value = meta.seed;
                if (sw.inputEl) sw.inputEl.value = meta.seed;
            }
            if (wmw && meta.weight_mode && wmw.options?.values?.includes(meta.weight_mode)) {
                wmw.value = meta.weight_mode;
            }

            const sourceLabel = meta.source ? ` [${meta.source}]` : "";
            pushPromptHistory(node, `Dropped Image: ${file.name}${sourceLabel}`);
            app.graph?.setDirtyCanvas(true, true);
        }
    } catch (err) {
        console.warn("[ModusFlow TextEditor] Error parsing image metadata:", err);
    }
}

function attachImageDropHandlers(node) {
    const bindEl = (el) => {
        if (!el || el._hasDropHandler) return;
        el._hasDropHandler = true;

        el.addEventListener("dragover", (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
                el.style.outline = "2px dashed #89b4fa";
            }
        });

        el.addEventListener("dragleave", () => {
            el.style.outline = "";
        });

        el.addEventListener("drop", async (e) => {
            el.style.outline = "";
            if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
            const file = e.dataTransfer.files[0];
            if (!file.name.match(/\.(png|webp|jpg|jpeg)$/i)) return;

            e.preventDefault();
            e.stopPropagation();
            await handleImageFileDrop(file, node);
        });
    };

    requestAnimationFrame(() => {
        const pw = node.widgets?.find(w => w.name === "positive");
        const nw = node.widgets?.find(w => w.name === "negative");
        if (pw?.inputEl) bindEl(pw.inputEl);
        if (nw?.inputEl) bindEl(nw.inputEl);
        if (node.element) bindEl(node.element);
    });
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
                    setupTagStudio(positiveWidget, node);
                    attachOllamaSelectionContextMenu(positiveWidget, positiveWidget, node);
                }
                if (negativeWidget) {
                    negativeWidget.label = "Negative";
                    attachCommentShortcuts(negativeWidget);
                    attachSyntaxHighlighter(negativeWidget, node);
                    attachAutocomplete(negativeWidget, node);
                    attachNegativePedalboard(negativeWidget, node);
                    attachOllamaSelectionContextMenu(negativeWidget, negativeWidget, node);
                }

                // ── Negative widget height control ────────────────────────────────
                const NEG_H = 95;
                if (negativeWidget) {
                    negativeWidget.computeSize = function() {
                        return [0, NEG_H];
                    };
                    requestAnimationFrame(() => {
                        const ta = negativeWidget.inputEl || negativeWidget.element;
                        if (ta) { ta.style.resize = "none"; ta.style.overflow = "auto"; }
                    });
                }

                // Hook selection and initial registration with IDE
                const origOnSelected = node.onSelected;
                node.onSelected = function () {
                    origOnSelected?.apply(this, arguments);
                    reportCanvasNode(node, true);
                };
                setTimeout(() => reportCanvasNode(node, true), 300);

                // ── Prompt cache ──────────────────────────────────────────────────
                node._allPrompts    = [];
                node._savedCategory = undefined;

                // ── Syntax Theme combo selector ───────────────────────────────────
                const initialTheme = node.properties?.["syntax_theme"] ||
                                     (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_syntax_theme")) ||
                                     "Modus Neon (Default)";
                node._currentSyntaxTheme = initialTheme;

                // ── Prompt Style combo (Tags vs Expressions) ─────────────────────
                const initialStyle = node.properties?.["prompt_style"] ||
                    (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_default_prompt_style")) ||
                    "Tags (SDXL / Pony)";
                const styleWidget = node.addWidget(
                    "combo",
                    "prompt_style",
                    initialStyle,
                    (value) => {
                        node.properties = node.properties || {};
                        node.properties["prompt_style"] = value;
                        try {
                            localStorage.setItem("modusflow_default_prompt_style", value);
                        } catch (_) {}
                        fetch("/modusflow/save_config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt_style: value })
                        }).catch(() => {});
                        node._popoutSyncStyle?.(value);
                        app.graph?.setDirtyCanvas(true, true);
                    },
                    { values: ["Tags (SDXL / Pony)", "Expressions (Flux / SD3)"] }
                );
                styleWidget.label = "Prompt Style";

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

                // Move style, theme, type, and category filters to appear right before saved_prompt
                if (dropdownWidget) {
                    const dropIdx = node.widgets.indexOf(dropdownWidget);
                    const styleIdx = node.widgets.indexOf(styleWidget);
                    const themeIdx = node.widgets.indexOf(themeWidget);
                    const typeIdx  = node.widgets.indexOf(typeWidget);
                    const catIdx   = node.widgets.indexOf(categoryWidget);
                    if (dropIdx >= 0) {
                        const items = [
                            { w: styleWidget, idx: styleIdx },
                            { w: themeWidget, idx: themeIdx },
                            { w: typeWidget,  idx: typeIdx },
                            { w: categoryWidget, idx: catIdx }
                        ].sort((a, b) => b.idx - a.idx);

                        for (const it of items) {
                            if (it.idx >= 0) node.widgets.splice(it.idx, 1);
                        }

                        const newDropIdx = node.widgets.indexOf(dropdownWidget);
                        node.widgets.splice(newDropIdx, 0, styleWidget, themeWidget, typeWidget, categoryWidget);
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
                    (v) => {
                        if (node._popoutCategoryInput) node._popoutCategoryInput.value = v;
                    },
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
                node.addWidget("button", "⛶ Pop Out Studio",        null, () => showPopOutStudio(node));
                const enhanceBtn = node.addWidget("button", "✨ Enhance with Ollama", null, () => {
                    if (window.event?.shiftKey || window.event?.altKey || !_ollamaAvailable) {
                        showOllamaStatusModal(node, enhanceBtn);
                    } else {
                        enhancePromptWithOllama(node, enhanceBtn);
                    }
                });
                enhanceBtn.tooltip = "Enhance prompt with local Ollama LLM. Shift+Click or click when offline to check status & select model.";
                node.addWidget("button", "💾 Save Prompt",          null, () => showSaveDialog(node));
                node.addWidget("button", "🔄 Update Selected",      null, () => updatePrompt(node));
                node.addWidget("button", "🏷️ Set Category",         null, () => showAssignCategoryDialog(node));
                node.addWidget("button", "🛠️ Studio Tools ▾",      null, () => showStudioToolsMenu(node, window.event));

                checkOllamaStatus().then(st => {
                    if (!st.available && enhanceBtn) {
                        enhanceBtn.name = "✨ Enhance with Ollama (Offline)";
                        app.graph?.setDirtyCanvas(true, true);
                    }
                });

                attachImageDropHandlers(node);

                // ── Initial size ──────────────────────────────────────────────────
                node.size = [560, 605];
                node.resizable = true;

                requestAnimationFrame(() => refreshPrompts(node));

                return r;
            };

            // ── getExtraMenuOptions ───────────────────────────────────────────────
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                if (origGetExtraMenuOptions) origGetExtraMenuOptions.apply(this, arguments);
                options.push(
                    {
                        content: "⛶ Pop Out Prompt Studio (Floating / Fullscreen)",
                        callback: () => showPopOutStudio(this)
                    },
                    {
                        content: "⇄ Convert Style: Tags ↔ Expressions (Pony ↔ Flux)",
                        callback: () => convertPromptStyle(this)
                    },
                    {
                        content: "⚙️ ModusFlow Studio & AI Settings...",
                        callback: () => showModusFlowSettingsModal(this)
                    },
                    {
                        content: "🤖 Ollama Status & Model Settings...",
                        callback: () => showOllamaStatusModal(this, this.widgets?.find(w => w.name && w.name.includes("Enhance with Ollama")))
                    },
                    {
                        content: "🏷 Toggle Tag Studio Mode",
                        callback: () => toggleTagStudioMode(this)
                    },
                    {
                        content: "🎞 Visual Aesthetic Ribbon...",
                        callback: () => showAestheticRibbonModal(this)
                    },
                    {
                        content: "✍️ Prosify to Fluent Prose (Flux/SD3)",
                        callback: () => prosifyPositivePrompt(this)
                    },
                    {
                        content: "🏷 Tagify to Comma Tags (SDXL/Pony)",
                        callback: () => tagifyPositivePrompt(this)
                    },
                    {
                        content: "⚄ Permutation / Variation Grid...",
                        callback: () => showVariationGridModal(this)
                    },
                    {
                        content: "🎨 Active LoRA Deck & Weights...",
                        callback: () => showLoraDeckModal(this)
                    },
                    {
                        content: "🔍 Find & Replace (Ctrl+F)...",
                        callback: () => showFindReplaceBar(this)
                    },
                    {
                        content: "⇄ Swap Positive & Negative Prompts",
                        callback: () => swapPositiveNegative(this)
                    },
                    {
                        content: "◫ Explode Tags to Multi-Line",
                        callback: () => {
                            const pw = this.widgets?.find(w => w.name === "positive");
                            if (pw) explodeTagsToLines(pw);
                        }
                    },
                    {
                        content: "◫ Collapse Tags to Inline",
                        callback: () => {
                            const pw = this.widgets?.find(w => w.name === "positive");
                            if (pw) collapseTagsToInline(pw);
                        }
                    },
                    {
                        content: "🌈 Color Spectrum Studio & Pigment Resolver...",
                        callback: () => showColorPaletteModal(this)
                    },
                    {
                        content: "✨ Translate All Hex Codes in Prompt",
                        callback: () => translateAllHexInNode(this)
                    },
                    {
                        content: "📋 Copy Clean Prompt (No Comments)",
                        callback: () => copyCleanPrompt(this)
                    },
                    {
                        content: "📋 Copy Prompt JSON Payload",
                        callback: () => copyJsonPayload(this)
                    },
                    {
                        content: "◫ Toggle Side-by-Side / Stacked Layout",
                        callback: () => toggleNodeLayout(this)
                    }
                );
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

                if (this.properties?.prompt_style) {
                    const sw = this.widgets?.find(w => w.name === "prompt_style");
                    if (sw) sw.value = this.properties.prompt_style;
                }

                const cfw = this.widgets?.find(w => w.name === "category_filter");
                const pcw = this.widgets?.find(w => w.name === "prompt_category");

                if (this._serializedCategoryFilter !== undefined && cfw) {
                    cfw.value = this._serializedCategoryFilter;
                }
                if (this._serializedPromptCategory !== undefined && pcw) {
                    pcw.value = this._serializedPromptCategory;
                    if (pcw.inputEl) pcw.inputEl.value = this._serializedPromptCategory;
                }

                const pw = this.widgets?.find(w => w.name === "positive");
                const nw = this.widgets?.find(w => w.name === "negative");
                if (pw) {
                    attachCommentShortcuts(pw);
                    attachSyntaxHighlighter(pw, this);
                    attachAutocomplete(pw, this);
                    setupTagStudio(pw, this);
                    attachOllamaSelectionContextMenu(pw, pw, this);
                }
                if (nw) {
                    attachCommentShortcuts(nw);
                    attachSyntaxHighlighter(nw, this);
                    attachAutocomplete(nw, this);
                    attachNegativePedalboard(nw, this);
                    attachOllamaSelectionContextMenu(nw, nw, this);
                }
                setTimeout(() => reportCanvasNode(this, false), 500);
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
                const cfw = this.widgets?.find(w => w.name === "category_filter");
                const pcw = this.widgets?.find(w => w.name === "prompt_category");
                if (cfw) this._serializedCategoryFilter = cfw.value;
                if (pcw) this._serializedPromptCategory = pcw.value;
            };

            // ── onDropFile (Canvas file drop) ──────────────────────────────────────
            const origOnDropFile = nodeType.prototype.onDropFile;
            nodeType.prototype.onDropFile = function(file) {
                if (file && file.name && file.name.match(/\.(png|webp|jpg|jpeg)$/i)) {
                    handleImageFileDrop(file, this);
                    return true;
                }
                if (origOnDropFile) return origOnDropFile.apply(this, arguments);
                return false;
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

                        // 4. Front-Load Tag Hotkey: Alt+Home or Alt+ArrowLeft
                        if (e.altKey && !ctrlOrCmd && !e.shiftKey && (e.key === "Home" || e.code === "Home" || e.key === "ArrowLeft" || e.code === "ArrowLeft")) {
                            e.preventDefault();
                            e.stopPropagation();

                            const text = ta.value;
                            let start = ta.selectionStart;
                            let end = ta.selectionEnd;

                            if (start === end) {
                                let tagStart = start;
                                while (tagStart > 0 && text[tagStart - 1] !== "," && text[tagStart - 1] !== "\n") tagStart--;
                                let tagEnd = end;
                                while (tagEnd < text.length && text[tagEnd] !== "," && text[tagEnd] !== "\n") tagEnd++;
                                while (tagStart < tagEnd && /\s/.test(text[tagStart])) tagStart++;
                                while (tagEnd > tagStart && /\s/.test(text[tagEnd - 1])) tagEnd--;
                                start = tagStart;
                                end = tagEnd;
                            }

                            if (start < end) {
                                const tagToMove = text.slice(start, end).trim();
                                if (tagToMove) {
                                    let before = text.slice(0, start);
                                    let after = text.slice(end);

                                    if (before.endsWith(",")) {
                                        before = before.slice(0, -1);
                                    } else if (after.startsWith(",")) {
                                        after = after.slice(1);
                                    } else if (after.startsWith(" ,")) {
                                        after = after.replace(/^\s*,/, "");
                                    }

                                    let remaining = (before + after).replace(/,\s*,+/g, ", ").trim();
                                    remaining = remaining.replace(/^,\s*/, "").replace(/,\s*$/, "");

                                    const newText = remaining ? `${tagToMove}, ${remaining}` : tagToMove;
                                    ta.value = newText;
                                    widget.value = newText;
                                    ta.selectionStart = tagToMove.length + 2;
                                    ta.selectionEnd = tagToMove.length + 2;
                                    widget._updateSyntaxHighlight?.();
                                }
                            }
                            return;
                        }

                        // 5. Randomize Selection Hotkey: Alt+D
                        if (e.altKey && !ctrlOrCmd && !e.shiftKey && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
                            e.preventDefault();
                            e.stopPropagation();

                            const text = ta.value;
                            let start = ta.selectionStart;
                            let end = ta.selectionEnd;

                            if (start === end) {
                                const openBrace = text.lastIndexOf("{", start - 1);
                                const closeBrace = text.indexOf("}", end);
                                if (openBrace !== -1 && closeBrace !== -1 && openBrace < closeBrace) {
                                    start = openBrace;
                                    end = closeBrace + 1;
                                }
                            }

                            if (start < end) {
                                const targetText = text.slice(start, end);
                                const resolved = resolvePromptClientSide(targetText, Math.floor(Math.random() * 1000000));
                                if (resolved !== targetText) {
                                    ta.setRangeText(resolved, start, end, "select");
                                    widget.value = ta.value;
                                    widget._updateSyntaxHighlight?.();
                                }
                            }
                            return;
                        }

                        // 6. IDE Line Manipulation: Move Line Up (Alt+Up)
                        if (e.altKey && !ctrlOrCmd && !e.shiftKey && (e.key === "ArrowUp" || e.code === "ArrowUp")) {
                            e.preventDefault();
                            e.stopPropagation();
                            const text = ta.value;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;

                            const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                            let lineEnd = text.indexOf("\n", end);
                            if (lineEnd === -1) lineEnd = text.length;

                            if (lineStart > 0) {
                                const prevLineStart = text.lastIndexOf("\n", lineStart - 2) + 1;
                                const prevLine = text.slice(prevLineStart, lineStart - 1);
                                const currBlock = text.slice(lineStart, lineEnd);

                                const newText = text.slice(0, prevLineStart) + currBlock + "\n" + prevLine + text.slice(lineEnd);
                                ta.value = newText;
                                widget.value = newText;
                                const offset = prevLine.length + 1;
                                ta.selectionStart = start - offset;
                                ta.selectionEnd = end - offset;
                                widget._updateSyntaxHighlight?.();
                            }
                            return;
                        }

                        // 7. IDE Line Manipulation: Move Line Down (Alt+Down)
                        if (e.altKey && !ctrlOrCmd && !e.shiftKey && (e.key === "ArrowDown" || e.code === "ArrowDown")) {
                            e.preventDefault();
                            e.stopPropagation();
                            const text = ta.value;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;

                            const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                            let lineEnd = text.indexOf("\n", end);
                            if (lineEnd === -1) lineEnd = text.length;

                            if (lineEnd < text.length) {
                                let nextLineEnd = text.indexOf("\n", lineEnd + 1);
                                if (nextLineEnd === -1) nextLineEnd = text.length;
                                const nextLine = text.slice(lineEnd + 1, nextLineEnd);
                                const currBlock = text.slice(lineStart, lineEnd);

                                const newText = text.slice(0, lineStart) + nextLine + "\n" + currBlock + text.slice(nextLineEnd);
                                ta.value = newText;
                                widget.value = newText;
                                const offset = nextLine.length + 1;
                                ta.selectionStart = start + offset;
                                ta.selectionEnd = end + offset;
                                widget._updateSyntaxHighlight?.();
                            }
                            return;
                        }

                        // 8. IDE Line Manipulation: Duplicate Line Down (Shift+Alt+Down)
                        if (e.altKey && e.shiftKey && !ctrlOrCmd && (e.key === "ArrowDown" || e.code === "ArrowDown")) {
                            e.preventDefault();
                            e.stopPropagation();
                            const text = ta.value;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;

                            const lineStart = text.lastIndexOf("\n", start - 1) + 1;
                            let lineEnd = text.indexOf("\n", end);
                            if (lineEnd === -1) lineEnd = text.length;

                            const block = text.slice(lineStart, lineEnd);
                            const newText = text.slice(0, lineEnd) + "\n" + block + text.slice(lineEnd);
                            ta.value = newText;
                            widget.value = newText;
                            const offset = block.length + 1;
                            ta.selectionStart = start + offset;
                            ta.selectionEnd = end + offset;
                            widget._updateSyntaxHighlight?.();
                            return;
                        }

                        // 9. Send to Opposite Prompt: Ctrl+Shift+N
                        if (ctrlOrCmd && e.shiftKey && (e.key === "n" || e.key === "N" || e.code === "KeyN")) {
                            e.preventDefault();
                            e.stopPropagation();
                            sendSelectionToOppositeWidget(node, widget);
                            return;
                        }

                        // 10. Find & Replace: Ctrl+F or Ctrl+H
                        if (ctrlOrCmd && !e.shiftKey && !e.altKey && (e.key === "f" || e.key === "F" || e.key === "h" || e.key === "H")) {
                            e.preventDefault();
                            e.stopPropagation();
                            showFindReplaceBar(node);
                            return;
                        }

                        // 11. Prompt Snippets (Macros) on Tab
                        if (e.key === "Tab" && !e.shiftKey && !ctrlOrCmd && !e.altKey) {
                            const text = ta.value;
                            const pos = ta.selectionStart;
                            let wordStart = pos;
                            while (wordStart > 0 && /[!a-zA-Z0-9_-]/.test(text[wordStart - 1])) wordStart--;
                            const trigger = text.slice(wordStart, pos);
                            if (trigger.startsWith("!") && PROMPT_SNIPPETS[trigger.toLowerCase()]) {
                                e.preventDefault();
                                e.stopPropagation();
                                const expansion = PROMPT_SNIPPETS[trigger.toLowerCase()];
                                ta.setRangeText(expansion, wordStart, pos, "end");
                                widget.value = ta.value;
                                widget._updateSyntaxHighlight?.();
                                return;
                            }
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
                        if (node._popoutCategoryInput) {
                            node._popoutCategoryInput.value = data.data.category || "";
                        }
                        pushPromptHistory(node, "Loaded: " + filename);
                        node._popoutSyncFromNode?.();
                        app.graph.setDirtyCanvas(true, true);
                    } else {
                        console.error("[ModusFlow] Load error:", data.message);
                    }
                })
                .catch(err => console.error("[ModusFlow] Load error:", err.message));
            }

            // ── Filter saved_prompt dropdown by type AND category ─────────────────
            function applyFilter(node, selectFilename) {
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

                if (selectFilename && dw.options.values.includes(selectFilename)) {
                    dw.value = selectFilename;
                } else if (selectFilename && cw && cw.value !== "--all categories--") {
                    cw.value = "--all categories--";
                    return applyFilter(node, selectFilename);
                } else if (!dw.options.values.includes(dw.value)) {
                    dw.value = dw.options.values[0];
                }
                node._popoutSyncPromptsDropdown?.();
                app.graph.setDirtyCanvas(true, true);
            }

            // ── Fetch prompt list; rebuild category combo + dropdown ───────────────
            function refreshPrompts(node, selectFilename) {
                const dw = node.widgets?.find(w => w.name === "saved_prompt");
                const cw = node.widgets?.find(w => w.name === "category_filter");
                const tw = node.widgets?.find(w => w.name === "type_filter");
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
                        if (selectFilename && tw && tw.value === "songs") {
                            tw.value = "--all types--";
                        }
                        fetchWildcardList(true);
                        fetchLoraList(true);
                        applyFilter(node, selectFilename);
                    })
                    .catch(err => console.error("[ModusFlow] Refresh error:", err.message));
            }

            // ── Save current text to a new file with category assignment ──────────
            function showSaveDialog(node) {
                const pw  = node.widgets?.find(w => w.name === "positive");
                const nw  = node.widgets?.find(w => w.name === "negative");
                const pcw = node.widgets?.find(w => w.name === "prompt_category");
                if (!pw) return;

                const existing = document.getElementById("modusflow-save-modal");
                if (existing) existing.remove();

                const overlay = document.createElement("div");
                overlay.id = "modusflow-save-modal";
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.65); z-index: 100050; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";

                const modal = document.createElement("div");
                modal.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 10px; width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); overflow: hidden; color: #cdd6f4;";

                const hdr = document.createElement("div");
                hdr.style.cssText = "padding: 12px 16px; background: #11111b; border-bottom: 1px solid #313244; display: flex; align-items: center; justify-content: space-between;";
                hdr.innerHTML = `<span style="font-weight: 700; font-size: 13px; color: #89b4fa; display: flex; align-items: center; gap: 6px;">💾 Save Prompt Preset</span>`;
                const closeBtn = document.createElement("button");
                closeBtn.innerHTML = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 14px; cursor: pointer; padding: 2px 6px;";
                closeBtn.onclick = () => overlay.remove();
                hdr.appendChild(closeBtn);
                modal.appendChild(hdr);

                const body = document.createElement("div");
                body.style.cssText = "padding: 16px; display: flex; flex-direction: column; gap: 12px;";

                const fnGroup = document.createElement("div");
                fnGroup.innerHTML = `<label style="display: block; font-size: 11px; font-weight: 600; color: #a6adc8; margin-bottom: 4px;">Preset Filename</label>`;
                const fnInput = document.createElement("input");
                fnInput.type = "text";
                fnInput.placeholder = "e.g. Cyberpunk Warrior";
                fnInput.style.cssText = "width: 100%; box-sizing: border-box; background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none;";
                fnGroup.appendChild(fnInput);
                body.appendChild(fnGroup);

                const catGroup = document.createElement("div");
                catGroup.innerHTML = `<label style="display: block; font-size: 11px; font-weight: 600; color: #a6adc8; margin-bottom: 4px;">Category (assign to folder/group)</label>`;
                const catInput = document.createElement("input");
                catInput.type = "text";
                catInput.setAttribute("list", "mf-save-categories-list");
                catInput.placeholder = "e.g. Characters, Landscapes, Style...";
                catInput.value = (pcw?.value || "").trim();
                catInput.style.cssText = "width: 100%; box-sizing: border-box; background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none;";

                const allCats = [...new Set((node._allPrompts || []).map(p => (p.category || "").trim()).filter(Boolean))].sort();
                const datalist = document.createElement("datalist");
                datalist.id = "mf-save-categories-list";
                allCats.forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c;
                    datalist.appendChild(opt);
                });
                catGroup.appendChild(catInput);
                catGroup.appendChild(datalist);
                body.appendChild(catGroup);

                const footer = document.createElement("div");
                footer.style.cssText = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;";

                const cancelBtn = document.createElement("button");
                cancelBtn.textContent = "Cancel";
                cancelBtn.style.cssText = "background: #313244; border: none; border-radius: 6px; padding: 6px 14px; color: #cdd6f4; font-size: 12px; cursor: pointer;";
                cancelBtn.onclick = () => overlay.remove();

                const saveBtn = document.createElement("button");
                saveBtn.textContent = "Save Preset";
                saveBtn.style.cssText = "background: #89b4fa; border: none; border-radius: 6px; padding: 6px 16px; color: #11111b; font-size: 12px; font-weight: 600; cursor: pointer;";

                const doSave = () => {
                    let filename = fnInput.value.trim();
                    if (!filename) {
                        fnInput.style.borderColor = "#f38ba8";
                        fnInput.focus();
                        return;
                    }
                    if (filename.toLowerCase().endsWith(".json")) {
                        filename = filename.slice(0, -5).trim();
                    }
                    const category = catInput.value.trim();

                    if (pcw) {
                        pcw.value = category;
                        if (pcw.inputEl) pcw.inputEl.value = category;
                    }
                    if (node._popoutCategoryInput) {
                        node._popoutCategoryInput.value = category;
                    }

                    fetch("/modusflow/save_prompt", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            filename: filename,
                            type: "prompt",
                            category: category,
                            positive: pw.value || "",
                            negative: nw?.value || ""
                        })
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            const targetFile = filename + ".json";
                            showStudioToast("Saved: " + targetFile);
                            pushPromptHistory(node, "Saved: " + filename);
                            if (category) {
                                node._savedCategory = category;
                            }
                            overlay.remove();
                            refreshPrompts(node, targetFile);
                        } else {
                            showStudioToast("Save failed: " + data.message, "error");
                        }
                    })
                    .catch(err => showStudioToast("Save error: " + err.message, "error"));
                };

                saveBtn.onclick = doSave;
                fnInput.onkeydown = (e) => { if (e.key === "Enter") catInput.focus(); };
                catInput.onkeydown = (e) => { if (e.key === "Enter") doSave(); };

                footer.appendChild(cancelBtn);
                footer.appendChild(saveBtn);
                body.appendChild(footer);
                modal.appendChild(body);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                fnInput.focus();
            }

            // ── Overwrite the currently selected prompt ───────────────────────────
            function updatePrompt(node) {
                const pw  = node.widgets?.find(w => w.name === "positive");
                const nw  = node.widgets?.find(w => w.name === "negative");
                const dw  = node.widgets?.find(w => w.name === "saved_prompt");
                const pcw = node.widgets?.find(w => w.name === "prompt_category");

                const selected = dw?.value;
                if (!selected || selected === "--select prompt--" || selected === "--no prompts found--") {
                    showStudioToast("Select a saved prompt from the dropdown first.", "warning");
                    return;
                }
                if (!confirm('Overwrite "' + selected + '" with the current text and category?')) return;

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
                        showStudioToast('"' + selected + '" updated.');
                        pushPromptHistory(node, "Updated: " + selected);
                        if (category) {
                            node._savedCategory = category;
                        }
                        refreshPrompts(node, selected);
                    } else {
                        showStudioToast("Update failed: " + data.message, "error");
                    }
                })
                .catch(err => showStudioToast("Update error: " + err.message, "error"));
            }

            // ── Assign or re-assign category to the selected prompt ──────────────
            function showAssignCategoryDialog(node) {
                const dw  = node.widgets?.find(w => w.name === "saved_prompt");
                const pcw = node.widgets?.find(w => w.name === "prompt_category");
                const pw  = node.widgets?.find(w => w.name === "positive");
                const nw  = node.widgets?.find(w => w.name === "negative");

                const selected = dw?.value;
                if (!selected || selected === "--select prompt--" || selected === "--no prompts found--") {
                    showStudioToast("Select a saved prompt first to assign a category.", "warning");
                    return;
                }

                const currentCat = (pcw?.value || "").trim();
                const allCats = [...new Set((node._allPrompts || []).map(p => (p.category || "").trim()).filter(Boolean))].sort();
                const promptMsg = allCats.length
                    ? `Assign "${selected}" to category:\n(Existing: ${allCats.join(", ")})`
                    : `Assign "${selected}" to category:`;

                const newCat = prompt(promptMsg, currentCat);
                if (newCat === null) return;
                const trimmedCat = newCat.trim();

                if (pcw) {
                    pcw.value = trimmedCat;
                    if (pcw.inputEl) pcw.inputEl.value = trimmedCat;
                }
                if (node._popoutCategoryInput) {
                    node._popoutCategoryInput.value = trimmedCat;
                }

                const base = selected.replace(/\.json$/i, "");
                fetch("/modusflow/save_prompt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: base,
                        type: "prompt",
                        category: trimmedCat,
                        positive: pw?.value || "",
                        negative: nw?.value || ""
                    })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        showStudioToast(`Category updated to "${trimmedCat || "Uncategorized"}" for ${selected}`);
                        pushPromptHistory(node, `Categorized: ${selected} -> ${trimmedCat}`);
                        if (trimmedCat) node._savedCategory = trimmedCat;
                        refreshPrompts(node, selected);
                    } else {
                        showStudioToast("Failed to assign category: " + data.message, "error");
                    }
                })
                .catch(err => showStudioToast("Error assigning category: " + err.message, "error"));
            }

            // ── Floating Inspector Card (Hex Color & Prompt Variables) ────────────
            let _activeFloatingCard = null;

            function hideFloatingCard() {
                if (_activeFloatingCard) {
                    _activeFloatingCard.remove();
                    _activeFloatingCard = null;
                }
            }

            function inspectTokenAtCursor(ta, widget, node) {
                if (!ta) return;
                const pos = ta.selectionStart;
                const text = ta.value || "";

                // 1. Check for Hex Color at cursor
                let hStart = pos;
                while (hStart > 0 && /[#0-9a-fA-F]/.test(text[hStart - 1])) hStart--;
                let hEnd = pos;
                while (hEnd < text.length && /[0-9a-fA-F]/.test(text[hEnd])) hEnd++;
                const hexCandidate = text.slice(hStart, hEnd);

                if (/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/i.test(hexCandidate)) {
                    showColorInspectorCard(ta, widget, node, hexCandidate, hStart, hEnd);
                    return;
                }

                // 2. Check for Prompt Variable at cursor
                let vStart = pos;
                while (vStart > 0 && /[\$a-zA-Z0-9_-]/.test(text[vStart - 1])) vStart--;
                let vEnd = pos;
                while (vEnd < text.length && /[a-zA-Z0-9_-]/.test(text[vEnd])) vEnd++;
                const varCandidate = text.slice(vStart, vEnd);

                if (varCandidate.startsWith("$") && varCandidate.length > 1) {
                    showVariablePeekTooltip(ta, widget, node, varCandidate, vStart, vEnd);
                    return;
                }

                hideFloatingCard();
            }

            function showColorInspectorCard(ta, widget, node, hex, start, end) {
                hideFloatingCard();
                const info = getNearestArtisticColor(hex);
                const card = document.createElement("div");
                card.className = "modusflow-floating-card";
                card.style.cssText = `
                    position: fixed;
                    z-index: 10001;
                    background: #181825;
                    border: 1px solid #313244;
                    border-radius: 10px;
                    padding: 12px 14px;
                    box-shadow: 0 12px 28px rgba(0,0,0,0.65);
                    color: #cdd6f4;
                    font-family: ui-monospace, SFMono-Regular, monospace;
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 275px;
                `;

                const topRow = document.createElement("div");
                topRow.style.cssText = "display: flex; align-items: center; gap: 10px;";

                const swatch = document.createElement("div");
                swatch.style.cssText = `
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background-color: ${hex};
                    border: 2px solid rgba(255,255,255,0.25);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    flex-shrink: 0;
                `;

                const meta = document.createElement("div");
                meta.style.cssText = "display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;";
                meta.innerHTML = `
                    <div style="font-weight: bold; color: ${hex}; font-size: 13px;">${hex.toUpperCase()}</div>
                    <div style="font-size: 10px; color: #a6adc8;">rgb(${info.rgb.r}, ${info.rgb.g}, ${info.rgb.b}) · hsl(${info.hsl.h}°, ${info.hsl.s}%, ${info.hsl.l}%)</div>
                `;

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 14px; cursor: pointer; padding: 0 4px;";
                closeBtn.onclick = hideFloatingCard;

                topRow.appendChild(swatch);
                topRow.appendChild(meta);
                topRow.appendChild(closeBtn);
                card.appendChild(topRow);

                const matchBox = document.createElement("div");
                matchBox.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px;";
                matchBox.innerHTML = `
                    <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Natural Model Descriptor:</div>
                    <div style="font-size: 12px; font-weight: bold; color: #89b4fa;">"${info.promptFriendlyName}"</div>
                `;

                const convertBtn = document.createElement("button");
                convertBtn.textContent = `✨ Replace with "${info.promptFriendlyName}"`;
                convertBtn.style.cssText = "background: rgba(137, 180, 250, 0.15); border: 1px solid rgba(137, 180, 250, 0.4); border-radius: 4px; padding: 6px 8px; color: #89b4fa; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;";
                convertBtn.onmouseenter = () => { convertBtn.style.background = "rgba(137, 180, 250, 0.3)"; };
                convertBtn.onmouseleave = () => { convertBtn.style.background = "rgba(137, 180, 250, 0.15)"; };
                convertBtn.onclick = () => {
                    ta.setRangeText(info.promptFriendlyName, start, end, "end");
                    widget.value = ta.value;
                    widget._updateSyntaxHighlight?.();
                    hideFloatingCard();
                    showStudioToast(`Converted to "${info.promptFriendlyName}"`);
                };
                matchBox.appendChild(convertBtn);

                const convertAllBtn = document.createElement("button");
                convertAllBtn.textContent = "✨ Translate All Hex in Prompt";
                convertAllBtn.style.cssText = "background: #1e1e2e; border: 1px solid #45475a; border-radius: 4px; padding: 5px 8px; color: #cdd6f4; font-size: 10px; cursor: pointer; transition: all 0.15s ease;";
                convertAllBtn.onmouseenter = () => { convertAllBtn.style.borderColor = "#89b4fa"; convertAllBtn.style.color = "#89b4fa"; };
                convertAllBtn.onmouseleave = () => { convertAllBtn.style.borderColor = "#45475a"; convertAllBtn.style.color = "#cdd6f4"; };
                convertAllBtn.onclick = () => {
                    hideFloatingCard();
                    translateAllHexInNode(node);
                };
                matchBox.appendChild(convertAllBtn);
                card.appendChild(matchBox);

                const bottomRow = document.createElement("div");
                bottomRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 6px;";

                const pickerLabel = document.createElement("label");
                pickerLabel.style.cssText = "display: flex; align-items: center; gap: 4px; font-size: 11px; color: #a6adc8; cursor: pointer;";
                const colorInput = document.createElement("input");
                colorInput.type = "color";
                colorInput.value = normalizeHex(hex);
                colorInput.style.cssText = "width: 22px; height: 22px; padding: 0; border: none; border-radius: 4px; background: none; cursor: pointer;";
                colorInput.oninput = (e) => {
                    const newHex = e.target.value;
                    ta.setRangeText(newHex, start, end, "select");
                    widget.value = ta.value;
                    widget._updateSyntaxHighlight?.();
                    showColorInspectorCard(ta, widget, node, newHex, start, start + newHex.length);
                };
                pickerLabel.appendChild(colorInput);
                pickerLabel.appendChild(document.createTextNode("Pick"));
                bottomRow.appendChild(pickerLabel);

                const copyBtn = document.createElement("button");
                copyBtn.textContent = "📋 Copy Tag";
                copyBtn.style.cssText = "background: #313244; border: 1px solid #45475a; border-radius: 4px; padding: 4px 8px; color: #cdd6f4; font-size: 10px; cursor: pointer;";
                copyBtn.onclick = () => {
                    navigator.clipboard?.writeText(info.promptFriendlyName);
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => { copyBtn.textContent = "📋 Copy Tag"; }, 1500);
                };
                bottomRow.appendChild(copyBtn);
                card.appendChild(bottomRow);

                const rect = ta.getBoundingClientRect();
                card.style.top = Math.max(10, rect.top - 180) + "px";
                card.style.left = Math.min(window.innerWidth - 300, Math.max(10, rect.left + 20)) + "px";

                document.body.appendChild(card);
                _activeFloatingCard = card;
            }

            function showVariablePeekTooltip(ta, widget, node, varName, start, end) {
                hideFloatingCard();
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                const fullText = (pw?.value || "") + "\n" + (nw?.value || "");

                const reg = new RegExp(`^\\s*\\$${varName.slice(1)}\\s*=\\s*([^;\\r\\n]+)`, "m");
                const m = reg.exec(fullText);

                const card = document.createElement("div");
                card.className = "modusflow-floating-card";
                card.style.cssText = `
                    position: fixed;
                    z-index: 10001;
                    background: #181825;
                    border: 1px solid #313244;
                    border-radius: 8px;
                    padding: 10px 12px;
                    box-shadow: 0 10px 24px rgba(0,0,0,0.65);
                    color: #cdd6f4;
                    font-family: ui-monospace, SFMono-Regular, monospace;
                    font-size: 11px;
                    max-width: 320px;
                `;

                if (m) {
                    card.innerHTML = `
                        <div style="font-weight: bold; color: #38bdf8; margin-bottom: 4px;">Variable Definition:</div>
                        <div style="color: #a6e3a1; font-weight: 500; background: #11111b; padding: 6px 8px; border-radius: 4px; border: 1px solid #313244; word-break: break-word;">${escapeHtml(m[1].trim())}</div>
                    `;
                } else {
                    card.innerHTML = `
                        <div style="color: #f38ba8; font-weight: 500;">⚠️ <strong>${escapeHtml(varName)}</strong> not defined in header.</div>
                        <div style="color: #6c7086; font-size: 10px; margin-top: 4px;">Assign with <code>${escapeHtml(varName)} = value;</code></div>
                    `;
                }

                const rect = ta.getBoundingClientRect();
                card.style.top = Math.max(10, rect.top - 60) + "px";
                card.style.left = Math.min(window.innerWidth - 340, Math.max(10, rect.left + 20)) + "px";

                document.body.appendChild(card);
                _activeFloatingCard = card;
            }

            // ── Interactive LoRA Deck Modal ───────────────────────────────────────
            function showLoraDeckModal(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw) return;

                const overlay = document.createElement("div");
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

                const dialog = document.createElement("div");
                dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 560px; max-width: 92vw; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.7); color: #cdd6f4; font-family: sans-serif;";

                const header = document.createElement("div");
                header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
                header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #f87171; display: flex; align-items: center; gap: 8px;">🎨 <span>Active LoRA Deck &amp; Weight Steppers</span></h3>';

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
                closeBtn.onclick = () => overlay.remove();
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const listContainer = document.createElement("div");
                listContainer.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 10px; max-height: 520px;";

                function renderLoras() {
                    listContainer.innerHTML = "";
                    const pText = pw.value || "";
                    const loraRegex = /(?:\/\*\s*)?(<lora:([^:>]+)(?::([0-9.]+))?>)(?:\s*\*\/)?/gi;
                    const matches = [];
                    let m;
                    while ((m = loraRegex.exec(pText)) !== null) {
                        matches.push({
                            fullMatch: m[0],
                            tag: m[1],
                            name: m[2],
                            weight: parseFloat(m[3] || "1.0"),
                            isMuted: m[0].startsWith("/*")
                        });
                    }

                    if (matches.length === 0) {
                        listContainer.innerHTML = `
                            <div style="padding: 28px; text-align: center; color: #a6adc8; font-size: 13px;">
                                No LoRAs detected in prompt.<br><span style="font-size: 11px; color: #6c7086;">Add tags like <code>&lt;lora:my_model:1.0&gt;</code> to tune weights here.</span>
                            </div>
                        `;
                        return;
                    }

                    for (const item of matches) {
                        const card = document.createElement("div");
                        card.style.cssText = `
                            background: #11111b;
                            border: 1px solid ${item.isMuted ? '#45475a' : '#313244'};
                            border-radius: 8px;
                            padding: 10px 14px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 12px;
                            opacity: ${item.isMuted ? '0.6' : '1'};
                        `;

                        const infoCol = document.createElement("div");
                        infoCol.style.cssText = "flex: 1; min-width: 0;";
                        infoCol.innerHTML = `
                            <div style="font-size: 13px; font-weight: 600; color: ${item.isMuted ? '#a6adc8' : '#f87171'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                            <div style="font-size: 11px; color: #6c7086;">${item.isMuted ? 'Muted / Excluded' : 'Active in CLIP'}</div>
                        `;

                        const controlCol = document.createElement("div");
                        controlCol.style.cssText = "display: flex; align-items: center; gap: 6px;";

                        const minusBtn = document.createElement("button");
                        minusBtn.textContent = "-0.1";
                        minusBtn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; color: #cdd6f4; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;";
                        minusBtn.onclick = () => updateWeight(item, -0.1);

                        const weightVal = document.createElement("span");
                        weightVal.textContent = item.weight.toFixed(2);
                        weightVal.style.cssText = "font-family: monospace; font-size: 13px; font-weight: bold; width: 44px; text-align: center;";

                        const plusBtn = document.createElement("button");
                        plusBtn.textContent = "+0.1";
                        plusBtn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; color: #cdd6f4; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;";
                        plusBtn.onclick = () => updateWeight(item, 0.1);

                        const muteBtn = document.createElement("button");
                        muteBtn.textContent = item.isMuted ? "Unmute" : "Mute";
                        muteBtn.style.cssText = `background: ${item.isMuted ? '#a6e3a1' : '#313244'}; color: ${item.isMuted ? '#11111b' : '#cdd6f4'}; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer;`;
                        muteBtn.onclick = () => toggleMute(item);

                        controlCol.appendChild(minusBtn);
                        controlCol.appendChild(weightVal);
                        controlCol.appendChild(plusBtn);
                        controlCol.appendChild(muteBtn);

                        card.appendChild(infoCol);
                        card.appendChild(controlCol);
                        listContainer.appendChild(card);
                    }
                }

                function updateWeight(item, delta) {
                    let newW = Math.round((item.weight + delta) * 100) / 100;
                    newW = Math.max(0.0, Math.min(2.5, newW));
                    const newTag = `<lora:${item.name}:${newW.toFixed(2).replace(/\\.00$/, '')}>`;
                    const replacement = item.isMuted ? `/* ${newTag} */` : newTag;
                    pw.value = pw.value.replace(item.fullMatch, replacement);
                    if (pw.inputEl) pw.inputEl.value = pw.value;
                    pw._updateSyntaxHighlight?.();
                    renderLoras();
                }

                function toggleMute(item) {
                    let replacement;
                    if (item.isMuted) {
                        replacement = `<lora:${item.name}:${item.weight.toFixed(2).replace(/\\.00$/, '')}>`;
                    } else {
                        replacement = `/* <lora:${item.name}:${item.weight.toFixed(2).replace(/\\.00$/, '')}> */`;
                    }
                    pw.value = pw.value.replace(item.fullMatch, replacement);
                    if (pw.inputEl) pw.inputEl.value = pw.value;
                    pw._updateSyntaxHighlight?.();
                    renderLoras();
                }

                dialog.appendChild(listContainer);
                overlay.appendChild(dialog);
                overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
                document.body.appendChild(overlay);
                renderLoras();
            }

            // ── Floating Find & Replace Bar (Ctrl+F / Ctrl+H) ─────────────────────
            let _activeFindBar = null;

            function showFindReplaceBar(node) {
                if (_activeFindBar) {
                    _activeFindBar.focusInput();
                    return;
                }

                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw) return;

                const bar = document.createElement("div");
                bar.className = "modusflow-find-replace-bar";
                bar.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 40px;
                    z-index: 10002;
                    background: #181825;
                    border: 1px solid #313244;
                    border-radius: 10px;
                    padding: 10px 14px;
                    box-shadow: 0 16px 36px rgba(0,0,0,0.7);
                    color: #cdd6f4;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 360px;
                `;

                bar.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; color: #89b4fa; font-size: 13px;">🔍 Find &amp; Replace</span>
                        <button id="mf-fr-close" style="background: none; border: none; color: #6c7086; cursor: pointer; font-size: 14px;">✕</button>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <input id="mf-fr-find" placeholder="Find..." style="flex: 1; background: #11111b; border: 1px solid #313244; border-radius: 4px; padding: 5px 8px; color: #cdd6f4; font-size: 12px; outline: none;">
                        <span id="mf-fr-count" style="font-size: 11px; color: #a6adc8; min-width: 45px; text-align: center;">0 / 0</span>
                        <button id="mf-fr-prev" style="background: #313244; border: none; border-radius: 4px; padding: 4px 8px; color: #cdd6f4; cursor: pointer;">↑</button>
                        <button id="mf-fr-next" style="background: #313244; border: none; border-radius: 4px; padding: 4px 8px; color: #cdd6f4; cursor: pointer;">↓</button>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <input id="mf-fr-replace" placeholder="Replace with..." style="flex: 1; background: #11111b; border: 1px solid #313244; border-radius: 4px; padding: 5px 8px; color: #cdd6f4; font-size: 12px; outline: none;">
                        <button id="mf-fr-rep-one" style="background: #313244; border: 1px solid #45475a; border-radius: 4px; padding: 5px 8px; color: #cdd6f4; font-size: 11px; cursor: pointer;">Replace</button>
                        <button id="mf-fr-rep-all" style="background: #89b4fa; border: none; border-radius: 4px; padding: 5px 10px; color: #11111b; font-size: 11px; font-weight: bold; cursor: pointer;">All</button>
                    </div>
                    <div style="display: flex; gap: 14px; font-size: 11px; color: #a6adc8; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="mf-fr-case"> Match Case (Aa)</label>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="mf-fr-regex"> Regex (.*)</label>
                    </div>
                `;

                document.body.appendChild(bar);

                const findInput = bar.querySelector("#mf-fr-find");
                const repInput = bar.querySelector("#mf-fr-replace");
                const countEl = bar.querySelector("#mf-fr-count");
                const caseBox = bar.querySelector("#mf-fr-case");
                const regexBox = bar.querySelector("#mf-fr-regex");

                _activeFindBar = {
                    element: bar,
                    focusInput: () => findInput.focus()
                };

                function getMatches() {
                    const query = findInput.value;
                    if (!query) return [];
                    let flags = caseBox.checked ? "g" : "gi";
                    let regex;
                    try {
                        regex = regexBox.checked ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                    } catch (_) {
                        return [];
                    }

                    const matches = [];
                    const text = pw.value || "";
                    let m;
                    while ((m = regex.exec(text)) !== null) {
                        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
                    }
                    return matches;
                }

                let matchIdx = 0;
                function updateMatchState() {
                    const matches = getMatches();
                    countEl.textContent = matches.length ? `${matchIdx + 1} / ${matches.length}` : "0 / 0";
                }

                findInput.addEventListener("input", () => { matchIdx = 0; updateMatchState(); });
                caseBox.addEventListener("change", () => { matchIdx = 0; updateMatchState(); });
                regexBox.addEventListener("change", () => { matchIdx = 0; updateMatchState(); });

                bar.querySelector("#mf-fr-next").onclick = () => {
                    const matches = getMatches();
                    if (!matches.length) return;
                    matchIdx = (matchIdx + 1) % matches.length;
                    const cur = matches[matchIdx];
                    if (pw.inputEl) {
                        pw.inputEl.focus();
                        pw.inputEl.setSelectionRange(cur.start, cur.end);
                    }
                    updateMatchState();
                };

                bar.querySelector("#mf-fr-prev").onclick = () => {
                    const matches = getMatches();
                    if (!matches.length) return;
                    matchIdx = (matchIdx - 1 + matches.length) % matches.length;
                    const cur = matches[matchIdx];
                    if (pw.inputEl) {
                        pw.inputEl.focus();
                        pw.inputEl.setSelectionRange(cur.start, cur.end);
                    }
                    updateMatchState();
                };

                bar.querySelector("#mf-fr-rep-one").onclick = () => {
                    const matches = getMatches();
                    if (!matches.length) return;
                    const cur = matches[matchIdx];
                    const repVal = repInput.value;
                    pw.value = pw.value.slice(0, cur.start) + repVal + pw.value.slice(cur.end);
                    if (pw.inputEl) pw.inputEl.value = pw.value;
                    pw._updateSyntaxHighlight?.();
                    updateMatchState();
                };

                bar.querySelector("#mf-fr-rep-all").onclick = () => {
                    const query = findInput.value;
                    if (!query) return;
                    let flags = caseBox.checked ? "g" : "gi";
                    try {
                        const regex = regexBox.checked ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                        pw.value = (pw.value || "").replace(regex, repInput.value);
                        if (pw.inputEl) pw.inputEl.value = pw.value;
                        pw._updateSyntaxHighlight?.();
                        updateMatchState();
                    } catch (err) {
                        showStudioToast("Regex error: " + err.message, "error");
                    }
                };

                bar.querySelector("#mf-fr-close").onclick = () => {
                    bar.remove();
                    _activeFindBar = null;
                };

                findInput.focus();
            }

            // ── Swap Positive & Negative Prompts ──────────────────────────────────
            function swapPositiveNegative(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                if (!pw || !nw) return;

                pushPromptHistory(node, "Pre-Swap Prompts");
                const temp = pw.value || "";
                setTextValue(pw, nw.value || "");
                setTextValue(nw, temp);
                pushPromptHistory(node, "Swapped Positive & Negative");
                app.graph?.setDirtyCanvas(true, true);
            }

            // ── Send Selection Between Positive & Negative Prompts ────────────────
            function sendSelectionToOppositeWidget(node, currentWidget) {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                if (!pw || !nw) return;

                const source = currentWidget === nw ? nw : pw;
                const target = currentWidget === nw ? pw : nw;
                const ta = source.inputEl || source.element;
                if (!ta) return;

                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                let selected = ta.value.slice(start, end).trim();

                if (!selected) {
                    let tStart = start;
                    while (tStart > 0 && ta.value[tStart - 1] !== "," && ta.value[tStart - 1] !== "\n") tStart--;
                    let tEnd = end;
                    while (tEnd < ta.value.length && ta.value[tEnd] !== "," && ta.value[tEnd] !== "\n") tEnd++;
                    selected = ta.value.slice(tStart, tEnd).trim();
                    if (selected) {
                        ta.setRangeText("", tStart, tEnd, "end");
                    }
                } else {
                    ta.setRangeText("", start, end, "end");
                }

                if (!selected) return;

                source.value = ta.value.replace(/,\s*,+/g, ", ").replace(/^,\s*/, "").replace(/,\s*$/, "");
                if (source.inputEl) source.inputEl.value = source.value;
                source._updateSyntaxHighlight?.();

                let targetText = (target.value || "").trim();
                if (targetText && !targetText.endsWith(",")) targetText += ", ";
                else if (targetText && targetText.endsWith(",")) targetText += " ";
                targetText += selected;

                target.value = targetText;
                if (target.inputEl) target.inputEl.value = targetText;
                target._updateSyntaxHighlight?.();

                app.graph?.setDirtyCanvas(true, true);
            }

            // ── Tag Formatter: Explode to Lines & Collapse to Inline ──────────────
            function explodeTagsToLines(widget) {
                if (!widget || !widget.value) return;
                const text = widget.value;

                const tags = [];
                let cur = "";
                let parenDepth = 0;
                let braceDepth = 0;
                let inBlockComment = false;

                for (let i = 0; i < text.length; i++) {
                    if (!inBlockComment && text.startsWith("/*", i)) {
                        inBlockComment = true;
                    } else if (inBlockComment && text.startsWith("*/", i)) {
                        inBlockComment = false;
                    }

                    const ch = text[i];
                    if (!inBlockComment) {
                        if (ch === "(") parenDepth++;
                        else if (ch === ")" && parenDepth > 0) parenDepth--;
                        else if (ch === "{" || ch === "<") braceDepth++;
                        else if ((ch === "}" || ch === ">") && braceDepth > 0) braceDepth--;
                    }

                    if (ch === "," && parenDepth === 0 && braceDepth === 0 && !inBlockComment) {
                        if (cur.trim()) tags.push(cur.trim());
                        cur = "";
                    } else if (ch === "\n" && parenDepth === 0 && braceDepth === 0 && !inBlockComment) {
                        if (cur.trim()) tags.push(cur.trim());
                        cur = "";
                    } else {
                        cur += ch;
                    }
                }
                if (cur.trim()) tags.push(cur.trim());

                if (tags.length === 0) return;
                const exploded = tags.map(t => "    " + t + ",").join("\n");
                widget.value = exploded;
                if (widget.inputEl) widget.inputEl.value = exploded;
                widget._updateSyntaxHighlight?.();
            }

            function collapseTagsToInline(widget) {
                if (!widget || !widget.value) return;
                const lines = widget.value.split("\n");
                const preserved = [];

                for (let line of lines) {
                    let t = line.trim();
                    if (!t) continue;
                    if (t.startsWith("#") || t.startsWith("//") || (t.startsWith("$") && t.includes("="))) {
                        preserved.push(t);
                    } else {
                        if (t.endsWith(",")) t = t.slice(0, -1).trim();
                        if (t) preserved.push(t);
                    }
                }

                const collapsed = preserved.join(", ").replace(/,\s*,+/g, ", ");
                widget.value = collapsed;
                if (widget.inputEl) widget.inputEl.value = collapsed;
                widget._updateSyntaxHighlight?.();
            }

            function toggleTagFormat(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw || !pw.value) return;
                const text = pw.value;
                const lines = text.split("\n").filter(l => l.trim().length > 0);
                const isMultiLine = lines.length > 3 && lines.some(l => l.trim().endsWith(",") || l.startsWith("    "));

                if (isMultiLine) {
                    collapseTagsToInline(pw);
                } else {
                    explodeTagsToLines(pw);
                }
            }

            // ── Color Spectrum Studio & Pigment Palette Modal ─────────────────────
            function showColorPaletteModal(node, targetWidget = null, initialHex = "#38bdf8") {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                let activeTarget = targetWidget || pw;

                const overlay = document.createElement("div");
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

                const dialog = document.createElement("div");
                dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 680px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 50px rgba(0,0,0,0.75); color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-y: auto;";

                // Header
                const header = document.createElement("div");
                header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 10px;";
                header.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 6px;">🌈 Color Spectrum Studio &amp; Pigment Resolver</h3>
                    </div>
                `;

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
                closeBtn.onclick = () => overlay.remove();
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                // Top batch action
                const topBar = document.createElement("div");
                topBar.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;";

                const translateAllBtn = document.createElement("button");
                translateAllBtn.textContent = "✨ Translate All Existing Hex Codes in Prompt to Model Pigments";
                translateAllBtn.style.cssText = "background: rgba(137, 180, 250, 0.12); border: 1px solid rgba(137, 180, 250, 0.35); border-radius: 6px; padding: 6px 12px; color: #89b4fa; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;";
                translateAllBtn.onclick = () => {
                    translateAllHexInNode(node);
                    overlay.remove();
                };
                topBar.appendChild(translateAllBtn);

                dialog.appendChild(topBar);

                // Spectrum Section Box
                const spectrumBox = document.createElement("div");
                spectrumBox.className = "modusflow-spectrum-box";

                // Left: Canvas & Hue Slider
                const leftCol = document.createElement("div");
                leftCol.style.cssText = "display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 280px;";

                const canvas = document.createElement("canvas");
                canvas.width = 300;
                canvas.height = 160;
                canvas.style.cssText = "width: 100%; height: 160px; border-radius: 6px; cursor: crosshair; display: block; border: 1px solid #45475a;";
                const ctx = canvas.getContext("2d");
                leftCol.appendChild(canvas);

                const hueSlider = document.createElement("input");
                hueSlider.type = "range";
                hueSlider.min = "0";
                hueSlider.max = "360";
                hueSlider.className = "modusflow-hue-slider";
                leftCol.appendChild(hueSlider);

                // Eyedropper if supported
                if (window.EyeDropper) {
                    const eyeDropBtn = document.createElement("button");
                    eyeDropBtn.textContent = "👁️ Pick Color from Canvas / Screen";
                    eyeDropBtn.style.cssText = "background: #313244; border: 1px solid #45475a; border-radius: 6px; padding: 5px 10px; color: #cdd6f4; font-size: 11px; cursor: pointer; transition: all 0.15s ease; text-align: center;";
                    eyeDropBtn.onclick = async () => {
                        try {
                            const ed = new window.EyeDropper();
                            const res = await ed.open();
                            if (res && res.sRGBHex) {
                                setColor(res.sRGBHex);
                            }
                        } catch (_) {}
                    };
                    leftCol.appendChild(eyeDropBtn);
                }

                spectrumBox.appendChild(leftCol);

                // Right: Live Swatch & Model Translation
                const rightCol = document.createElement("div");
                rightCol.style.cssText = "display: flex; flex-direction: column; gap: 10px; flex: 1.2; min-width: 270px;";

                const swatchRow = document.createElement("div");
                swatchRow.style.cssText = "display: flex; gap: 12px; align-items: center;";

                const swatch = document.createElement("div");
                swatch.style.cssText = "width: 58px; height: 58px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.25); flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.4); transition: all 0.15s ease;";
                swatchRow.appendChild(swatch);

                const readoutBox = document.createElement("div");
                readoutBox.style.cssText = "display: flex; flex-direction: column; gap: 4px; flex: 1;";

                const hexInput = document.createElement("input");
                hexInput.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; padding: 4px 8px; color: #cdd6f4; font-family: ui-monospace, monospace; font-size: 13px; font-weight: bold; width: 100px; text-transform: uppercase;";
                hexInput.maxLength = 7;

                const rgbHslText = document.createElement("div");
                rgbHslText.style.cssText = "font-size: 11px; font-family: ui-monospace, monospace; color: #a6adc8;";

                readoutBox.appendChild(hexInput);
                readoutBox.appendChild(rgbHslText);
                swatchRow.appendChild(readoutBox);
                rightCol.appendChild(swatchRow);

                // Model Translation Card
                const modelCard = document.createElement("div");
                modelCard.style.cssText = "background: rgba(137, 180, 250, 0.08); border: 1px solid rgba(137, 180, 250, 0.25); border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;";
                modelCard.innerHTML = `
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #a6adc8; font-weight: 700;">Diffusion Model Understands As:</div>
                    <div id="mf-spectrum-model-name" style="font-size: 15px; font-weight: 700; color: #89b4fa; text-shadow: 0 0 10px rgba(137, 180, 250, 0.4);">electric cyan</div>
                `;
                rightCol.appendChild(modelCard);

                // Target selector row
                const targetRow = document.createElement("div");
                targetRow.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: 11px; color: #a6adc8;";
                targetRow.innerHTML = "<span>Target:</span>";

                const posBtn = document.createElement("button");
                posBtn.textContent = "Positive Prompt";
                posBtn.style.cssText = "background: #89b4fa; border: none; border-radius: 4px; padding: 3px 8px; color: #11111b; font-size: 11px; font-weight: 600; cursor: pointer;";

                const negBtn = document.createElement("button");
                negBtn.textContent = "Negative Prompt";
                negBtn.style.cssText = "background: #313244; border: none; border-radius: 4px; padding: 3px 8px; color: #cdd6f4; font-size: 11px; cursor: pointer;";

                posBtn.onclick = () => {
                    activeTarget = pw;
                    posBtn.style.background = "#89b4fa"; posBtn.style.color = "#11111b"; posBtn.style.fontWeight = "600";
                    negBtn.style.background = "#313244"; negBtn.style.color = "#cdd6f4"; negBtn.style.fontWeight = "normal";
                };
                negBtn.onclick = () => {
                    activeTarget = nw;
                    negBtn.style.background = "#f38ba8"; negBtn.style.color = "#11111b"; negBtn.style.fontWeight = "600";
                    posBtn.style.background = "#313244"; posBtn.style.color = "#cdd6f4"; posBtn.style.fontWeight = "normal";
                };

                targetRow.appendChild(posBtn);
                targetRow.appendChild(negBtn);
                rightCol.appendChild(targetRow);

                // Trait dropdown & Insertion Buttons
                const traitRow = document.createElement("div");
                traitRow.style.cssText = "display: flex; gap: 6px; align-items: center;";

                const traitSel = document.createElement("select");
                traitSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 4px; padding: 5px; color: #cdd6f4; font-size: 11px; outline: none; flex: 1;";
                const traitOptions = [
                    { label: "Just the color", suffix: "" },
                    { label: "...hair", suffix: " hair" },
                    { label: "...eyes", suffix: " eyes" },
                    { label: "...lighting", suffix: " lighting" },
                    { label: "...neon glow", suffix: " neon glow" },
                    { label: "...rim light", suffix: " rim lighting" },
                    { label: "...outfit", suffix: " outfit" },
                    { label: "...atmosphere", suffix: " atmosphere" }
                ];
                traitOptions.forEach(opt => {
                    const o = document.createElement("option");
                    o.value = opt.suffix;
                    o.textContent = opt.label;
                    traitSel.appendChild(o);
                });
                traitRow.appendChild(traitSel);
                rightCol.appendChild(traitRow);

                const actionRow = document.createElement("div");
                actionRow.style.cssText = "display: flex; gap: 8px;";

                const insertModelBtn = document.createElement("button");
                insertModelBtn.textContent = "✨ Insert Model Name";
                insertModelBtn.style.cssText = "flex: 1; background: linear-gradient(135deg, rgba(137, 180, 250, 0.25), rgba(203, 166, 247, 0.2)); border: 1px solid #89b4fa; border-radius: 6px; padding: 7px 10px; color: #89b4fa; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;";

                const insertHexBtn = document.createElement("button");
                insertHexBtn.textContent = "# Insert Hex";
                insertHexBtn.style.cssText = "flex: 1; background: #313244; border: 1px solid #45475a; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;";

                actionRow.appendChild(insertModelBtn);
                actionRow.appendChild(insertHexBtn);
                rightCol.appendChild(actionRow);

                spectrumBox.appendChild(rightCol);
                dialog.appendChild(spectrumBox);

                // ── Spectrum Logic ──
                let hsv = hexToHsv(initialHex);
                let currentHex = normalizeHex(initialHex);
                hueSlider.value = String(hsv.h);

                function drawCanvas() {
                    const w = canvas.width;
                    const h = canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    // Pure hue background
                    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
                    ctx.fillRect(0, 0, w, h);

                    // White horizontal gradient
                    const gWhite = ctx.createLinearGradient(0, 0, w, 0);
                    gWhite.addColorStop(0, "rgba(255,255,255,1)");
                    gWhite.addColorStop(1, "rgba(255,255,255,0)");
                    ctx.fillStyle = gWhite;
                    ctx.fillRect(0, 0, w, h);

                    // Black vertical gradient
                    const gBlack = ctx.createLinearGradient(0, 0, 0, h);
                    gBlack.addColorStop(0, "rgba(0,0,0,0)");
                    gBlack.addColorStop(1, "rgba(0,0,0,1)");
                    ctx.fillStyle = gBlack;
                    ctx.fillRect(0, 0, w, h);

                    // Draw crosshair reticle
                    const cx = (hsv.s / 100) * w;
                    const cy = (1 - (hsv.v / 100)) * h;

                    ctx.beginPath();
                    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                function updateReadouts() {
                    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
                    currentHex = rgbToHex(rgb.r, rgb.g, rgb.b);
                    swatch.style.backgroundColor = currentHex;
                    swatch.style.boxShadow = `0 0 16px ${currentHex}66`;

                    if (document.activeElement !== hexInput) {
                        hexInput.value = currentHex;
                    }

                    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
                    rgbHslText.textContent = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) · HSL(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`;

                    const resolved = getNearestArtisticColor(currentHex);
                    const nameEl = document.getElementById("mf-spectrum-model-name");
                    if (nameEl) nameEl.textContent = resolved.promptFriendlyName;
                }

                function setColor(hex) {
                    currentHex = normalizeHex(hex);
                    hsv = hexToHsv(currentHex);
                    hueSlider.value = String(hsv.h);
                    drawCanvas();
                    updateReadouts();
                }

                let isDraggingCanvas = false;
                function handleCanvasPoint(e) {
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                    hsv.s = Math.round((x / rect.width) * 100);
                    hsv.v = Math.round((1 - (y / rect.height)) * 100);
                    drawCanvas();
                    updateReadouts();
                }

                canvas.addEventListener("mousedown", (e) => {
                    isDraggingCanvas = true;
                    handleCanvasPoint(e);
                });
                window.addEventListener("mousemove", (e) => {
                    if (isDraggingCanvas) handleCanvasPoint(e);
                });
                window.addEventListener("mouseup", () => {
                    isDraggingCanvas = false;
                });

                hueSlider.addEventListener("input", () => {
                    hsv.h = parseInt(hueSlider.value, 10);
                    drawCanvas();
                    updateReadouts();
                });

                hexInput.addEventListener("input", () => {
                    let v = hexInput.value.trim();
                    if (!v.startsWith("#")) v = "#" + v;
                    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
                        setColor(v);
                    }
                });

                function insertIntoTarget(textToInsert) {
                    if (!activeTarget) return;
                    let cur = (activeTarget.value || "").trim();
                    if (cur && !cur.endsWith(",")) cur += ", ";
                    else if (cur && cur.endsWith(",")) cur += " ";
                    cur += textToInsert;

                    activeTarget.value = cur;
                    if (activeTarget.inputEl) activeTarget.inputEl.value = cur;
                    activeTarget._updateSyntaxHighlight?.();
                    app.graph?.setDirtyCanvas(true, true);
                    showStudioToast(`Inserted "${textToInsert}"`);
                    pushPromptHistory(node, `Inserted color: ${textToInsert}`);
                    overlay.remove();
                }

                insertModelBtn.onclick = () => {
                    const resolved = getNearestArtisticColor(currentHex);
                    const tag = resolved.promptFriendlyName + traitSel.value;
                    insertIntoTarget(tag);
                };

                insertHexBtn.onclick = () => {
                    const tag = currentHex + traitSel.value;
                    insertIntoTarget(tag);
                };

                // ── Curated Swatches Section ──
                const swatchesSec = document.createElement("div");
                swatchesSec.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-top: 4px;";
                swatchesSec.innerHTML = '<div style="font-size: 12px; font-weight: 700; color: #cba6f7;">Preset Model Pigments (Click to tune in spectrum)</div>';

                const filterInput = document.createElement("input");
                filterInput.placeholder = "Search 70+ artistic pigments (e.g. crimson, emerald, cobalt, amber)...";
                filterInput.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 7px 10px; color: #cdd6f4; font-size: 12px; outline: none;";
                swatchesSec.appendChild(filterInput);

                const grid = document.createElement("div");
                grid.style.cssText = "overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; max-height: 220px; padding-right: 4px;";

                function renderColors(q = "") {
                    grid.innerHTML = "";
                    const filtered = ARTISTIC_COLOR_PALETTE.filter(c => !q || c.name.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q));

                    for (const c of filtered) {
                        const chip = document.createElement("button");
                        chip.style.cssText = `
                            background: #11111b;
                            border: 1px solid #313244;
                            border-radius: 6px;
                            padding: 5px 8px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            cursor: pointer;
                            transition: all 0.15s ease;
                            text-align: left;
                        `;
                        chip.onmouseenter = () => { chip.style.borderColor = "#89b4fa"; chip.style.background = "#1e1e2e"; };
                        chip.onmouseleave = () => { chip.style.borderColor = "#313244"; chip.style.background = "#11111b"; };

                        chip.innerHTML = `
                            <div style="width: 16px; height: 16px; border-radius: 4px; background: ${c.hex}; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;"></div>
                            <div style="font-size: 11px; color: #cdd6f4; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.name}</div>
                        `;

                        chip.onclick = () => {
                            setColor(c.hex);
                        };
                        grid.appendChild(chip);
                    }
                }

                filterInput.oninput = (e) => renderColors(e.target.value.toLowerCase().trim());
                swatchesSec.appendChild(grid);
                dialog.appendChild(swatchesSec);

                overlay.appendChild(dialog);
                overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
                document.body.appendChild(overlay);

                drawCanvas();
                updateReadouts();
                renderColors();
            }

            // ── Batch Hex Color Translator ────────────────────────────────────────
            function translateAllHexInNode(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                let total = 0;
                const hexRegex = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

                const translateWidget = (w) => {
                    if (!w || !w.value) return 0;
                    let count = 0;
                    const replaced = w.value.replace(hexRegex, (match) => {
                        count++;
                        const info = getNearestArtisticColor(match);
                        return info.promptFriendlyName;
                    });
                    if (count > 0) {
                        w.value = replaced;
                        if (w.inputEl) w.inputEl.value = replaced;
                        w._updateSyntaxHighlight?.();
                    }
                    return count;
                };

                total += translateWidget(pw);
                total += translateWidget(nw);

                if (total > 0) {
                    showStudioToast(`Translated ${total} hex code${total > 1 ? 's' : ''} to natural color names`);
                    pushPromptHistory(node, `Translated ${total} hex colors`);
                    app.graph?.setDirtyCanvas(true, true);
                } else {
                    showStudioToast("No hex color codes found in prompt.", "info");
                }
            }

            // ── Negative Pedalboard Implementation ────────────────────────────────
            const PEDALBOARD_MODULES = [
                {
                    id: "quality",
                    label: "✦ Quality",
                    tooltip: "Toggle baseline quality guard (worst quality, low quality, normal quality)",
                    matchTag: "worst quality",
                    text: "(worst quality, low quality, normal quality:1.4)",
                    unweightedText: "worst quality, low quality, normal quality"
                },
                {
                    id: "anatomy",
                    label: "🚫 Anatomy",
                    tooltip: "Toggle anatomical & hand deformity guard",
                    matchTag: "bad anatomy",
                    text: "(bad anatomy, bad hands, missing fingers, extra digits:1.3)",
                    unweightedText: "bad anatomy, bad hands, missing fingers, extra digits"
                },
                {
                    id: "cgi",
                    label: "🎨 3D Guard",
                    tooltip: "Toggle 3D render / CGI guard for 2D or realistic styles",
                    matchTag: "3d render",
                    text: "(cgi, 3d render, cartoon, illustration:1.2)",
                    unweightedText: "cgi, 3d render, cartoon, illustration"
                },
                {
                    id: "watermark",
                    label: "💧 Watermark",
                    tooltip: "Toggle watermark, text, and signature suppression",
                    matchTag: "watermark",
                    text: "(watermark, text, signature, username:1.2)",
                    unweightedText: "watermark, text, signature, username"
                }
            ];

            function attachNegativePedalboard(widget, node) {
                if (!widget) return;
                requestAnimationFrame(() => {
                    const ta = widget.inputEl || widget.element;
                    if (!ta || !ta.parentElement || ta._hasPedalboard) return;
                    ta._hasPedalboard = true;

                    const parent = ta.parentElement;
                    const pedalBar = document.createElement("div");
                    pedalBar.className = "modusflow-pedal-bar";

                    const label = document.createElement("span");
                    label.textContent = "Pedalboard:";
                    label.style.cssText = "font-size: 10px; color: #6c7086; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; font-weight: 600;";
                    pedalBar.appendChild(label);

                    const buttons = [];

                    PEDALBOARD_MODULES.forEach(mod => {
                        const btn = document.createElement("button");
                        btn.className = "modusflow-pedal-btn";
                        btn.textContent = mod.label;
                        btn.title = mod.tooltip;
                        btn.type = "button";

                        btn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let cur = (ta.value || "").trim();
                            const hasTag = cur.toLowerCase().includes(mod.matchTag.toLowerCase());

                            const styleVal = (node.widgets?.find(w => w.name === "prompt_style")?.value || "").toLowerCase();
                            const isExpressions = styleVal.includes("expression");
                            const insertText = isExpressions ? mod.unweightedText : mod.text;

                            if (hasTag) {
                                cur = cur.replace(mod.text, "");
                                cur = cur.replace(mod.unweightedText, "");
                                const escTag = mod.matchTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                cur = cur.replace(new RegExp(`\\([^)]*${escTag}[^)]*\\)`, "gi"), "");
                                cur = cur.replace(/,\s*,+/g, ", ").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
                                showStudioToast(`Disengaged [${mod.label}] guard`, "info");
                            } else {
                                if (cur && !cur.endsWith(",")) cur += ", ";
                                else if (cur && cur.endsWith(",")) cur += " ";
                                cur += insertText;
                                showStudioToast(`Engaged [${mod.label}] guard${isExpressions ? ' (unweighted)' : ''}`);
                            }

                            ta.value = cur;
                            widget.value = cur;
                            widget._updateSyntaxHighlight?.();
                            updateStates();
                            pushPromptHistory(node, `Pedalboard: ${mod.label}`);
                        };

                        buttons.push({ btn, mod });
                        pedalBar.appendChild(btn);
                    });

                    function updateStates() {
                        const val = (ta.value || "").toLowerCase();
                        buttons.forEach(({ btn, mod }) => {
                            if (val.includes(mod.matchTag.toLowerCase())) {
                                btn.classList.add("active");
                            } else {
                                btn.classList.remove("active");
                            }
                        });
                    }

                    ta.addEventListener("input", updateStates);
                    updateStates();

                    parent.insertBefore(pedalBar, ta);
                });
            }

            // ── Clean Prompt & JSON Exporters ─────────────────────────────────────
            function copyCleanPrompt(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw || !pw.value) return;
                let clean = pw.value
                    .replace(/\/\*[\s\S]*?\*\//g, "")
                    .replace(/(?:^|\n)\s*(?:#|\/\/)[^\n]*/g, "")
                    .replace(/^\s*\$[a-zA-Z0-9_-]+\s*=[^;\n]+;?/gm, "")
                    .replace(/\$[a-zA-Z0-9_-]+/g, "")
                    .replace(/\s+/g, " ")
                    .replace(/,\s*,+/g, ", ")
                    .replace(/^,\s*/, "")
                    .replace(/,\s*$/, "")
                    .trim();
                navigator.clipboard?.writeText(clean);
                showStudioToast("Clean prompt copied to clipboard!");
            }

            function copyJsonPayload(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                const obj = {
                    positive: pw?.value || "",
                    negative: nw?.value || ""
                };
                navigator.clipboard?.writeText(JSON.stringify(obj, null, 2));
                showStudioToast("Prompt JSON copied to clipboard!");
            }

            // ── Interactive Tag Studio Mode Implementation ───────────────────────
            function parsePromptToChips(text) {
                if (!text) return [];
                const lines = text.split("\n");
                const items = [];

                for (let line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    const secMatch = trimmed.match(/^(?:\/\/|#|\/\*)\s*\[?([^\]]+)\]?\s*(?:\*\/)?$/);
                    if (secMatch && (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*"))) {
                        items.push({ type: "section", title: secMatch[1].trim() });
                        continue;
                    }

                    if (trimmed.startsWith("#") || (trimmed.startsWith("//") && !trimmed.includes("["))) {
                        items.push({ type: "comment", text: trimmed });
                        continue;
                    }
                    if (trimmed.startsWith("$") && trimmed.includes("=")) {
                        items.push({ type: "variable", text: trimmed });
                        continue;
                    }

                    let cur = "";
                    let parenDepth = 0;
                    let inBlock = false;

                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i];
                        if (!inBlock && line.startsWith("/*", i)) inBlock = true;
                        else if (inBlock && line.startsWith("*/", i)) inBlock = false;

                        if (!inBlock) {
                            if (ch === "(") parenDepth++;
                            else if (ch === ")" && parenDepth > 0) parenDepth--;
                        }

                        if (ch === "," && parenDepth === 0 && !inBlock) {
                            if (cur.trim()) items.push(parseIndividualTag(cur.trim()));
                            cur = "";
                        } else {
                            cur += ch;
                        }
                    }
                    if (cur.trim()) items.push(parseIndividualTag(cur.trim()));
                }
                return items;
            }

            function parseIndividualTag(raw) {
                let clean = raw.trim();
                let isMuted = false;
                if (clean.startsWith("/*") && clean.endsWith("*/")) {
                    isMuted = true;
                    clean = clean.slice(2, -2).trim();
                }

                let weight = 1.0;
                let baseTag = clean;
                const wm = clean.match(/^\((.+):(-?[0-9.]+)\)$/);
                if (wm) {
                    baseTag = wm[1].trim();
                    weight = parseFloat(wm[2]) || 1.0;
                } else {
                    const sm = clean.match(/^\((.+)\)$/);
                    if (sm) {
                        baseTag = sm[1].trim();
                        weight = 1.1;
                    }
                }

                const lower = baseTag.toLowerCase();
                let cat = "subject";
                let catColor = "#38bdf8";

                if (/light|glow|sun|shadow|chiaroscuro|illumination|neon|radiant|atmospheric|ambient|god rays|volumetric/.test(lower)) {
                    cat = "lighting";
                    catColor = "#fbbf24";
                } else if (/lens|mm|f\/|aperture|bokeh|macro|dof|angle|shot|perspective|shutter|anamorphic|prime/.test(lower)) {
                    cat = "camera";
                    catColor = "#c084fc";
                } else if (/photo|painting|illustration|render|anime|digital art|oil painting|sketch|watercolor|octane|cyberpunk|fantasy/.test(lower)) {
                    cat = "style";
                    catColor = "#f472b6";
                } else if (/masterpiece|best quality|high quality|8k|detailed|sharp focus|award-winning|pristine/.test(lower)) {
                    cat = "quality";
                    catColor = "#34d399";
                }

                return {
                    type: "tag",
                    raw,
                    baseTag,
                    weight,
                    isMuted,
                    cat,
                    catColor
                };
            }

            function reconstructPromptFromChips(items) {
                const lines = [];
                let currentTags = [];

                const flushTags = () => {
                    if (currentTags.length > 0) {
                        lines.push(currentTags.join(", "));
                        currentTags = [];
                    }
                };

                for (const item of items) {
                    if (item.type === "section") {
                        flushTags();
                        lines.push(`// [${item.title}]`);
                    } else if (item.type === "comment" || item.type === "variable") {
                        flushTags();
                        lines.push(item.text);
                    } else if (item.type === "tag") {
                        let tagStr = item.baseTag;
                        if (Math.abs(item.weight - 1.0) > 0.001) {
                            tagStr = `(${item.baseTag}:${item.weight.toFixed(2).replace(/\.?0+$/, "")})`;
                        }
                        if (item.isMuted) {
                            tagStr = `/* ${tagStr} */`;
                        }
                        currentTags.push(tagStr);
                    }
                }
                flushTags();
                return lines.join("\n");
            }

            function setupTagStudio(widget, node) {
                if (!widget) return;
                requestAnimationFrame(() => {
                    const ta = widget.inputEl || widget.element;
                    if (!ta || !ta.parentElement || ta._tagStudioContainer) return;

                    const parent = ta.parentElement;
                    const container = document.createElement("div");
                    container.className = "modusflow-tag-studio-container";
                    container.style.display = "none";
                    ta._tagStudioContainer = container;

                    parent.appendChild(container);
                });
            }

            function renderTagStudio(node, container, widget) {
                if (!container || !widget) return;
                container.innerHTML = "";

                const rawText = widget.value || "";
                const items = parsePromptToChips(rawText);

                let draggedIdx = null;

                items.forEach((item, idx) => {
                    if (item.type === "section") {
                        const secRow = document.createElement("div");
                        secRow.style.cssText = "width: 100%; display: flex; align-items: center; gap: 8px; margin: 8px 0 4px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(137, 180, 250, 0.2);";
                        secRow.innerHTML = `<span style="font-size: 11px; font-weight: bold; color: #89b4fa; text-transform: uppercase; letter-spacing: 0.5px;">§ ${escapeHtml(item.title)}</span>`;
                        container.appendChild(secRow);
                        return;
                    }

                    if (item.type === "comment" || item.type === "variable") {
                        const commentChip = document.createElement("div");
                        commentChip.className = "modusflow-tag-chip";
                        commentChip.style.cssText = "background: rgba(30, 30, 46, 0.5); border-style: dashed; font-family: ui-monospace, monospace; font-size: 11px; color: #6c7086;";
                        commentChip.textContent = item.text;
                        container.appendChild(commentChip);
                        return;
                    }

                    const chip = document.createElement("div");
                    chip.className = "modusflow-tag-chip" + (item.isMuted ? " muted" : "");
                    chip.draggable = true;

                    if (item.weight > 1.0) {
                        const glowSpread = Math.min(10, Math.round((item.weight - 1.0) * 10));
                        const glowAlpha = Math.min(0.8, 0.2 + (item.weight - 1.0) * 0.4);
                        chip.style.boxShadow = `0 0 ${glowSpread}px rgba(251, 191, 36, ${glowAlpha})`;
                        chip.style.borderColor = "rgba(251, 191, 36, 0.6)";
                    } else if (item.weight < 1.0) {
                        chip.style.opacity = Math.max(0.45, item.weight);
                    }

                    const handle = document.createElement("span");
                    handle.className = "modusflow-tag-handle";
                    handle.textContent = "⋮⋮";
                    chip.appendChild(handle);

                    const catDot = document.createElement("span");
                    catDot.className = "modusflow-tag-cat-dot";
                    catDot.style.backgroundColor = item.catColor;
                    catDot.title = `Category: ${item.cat}`;
                    chip.appendChild(catDot);

                    const label = document.createElement("span");
                    label.style.cssText = "font-weight: 500; font-size: 12px;";
                    label.textContent = item.baseTag;
                    chip.appendChild(label);

                    const weightBox = document.createElement("div");
                    weightBox.style.cssText = "display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; background: rgba(0,0,0,0.25); border-radius: 4px; padding: 1px 3px;";

                    const minusBtn = document.createElement("button");
                    minusBtn.className = "modusflow-tag-weight-btn";
                    minusBtn.textContent = "-";
                    minusBtn.title = "Decrease weight (-0.05)";
                    minusBtn.onclick = (e) => {
                        e.stopPropagation();
                        let newW = Math.round((item.weight - 0.05) * 100) / 100;
                        item.weight = Math.max(0.1, newW);
                        syncBack();
                    };

                    const weightLabel = document.createElement("span");
                    weightLabel.style.cssText = "font-size: 10px; font-family: ui-monospace, monospace; color: #fde047; min-width: 24px; text-align: center;";
                    weightLabel.textContent = item.weight.toFixed(2).replace(/\.?0+$/, "");

                    const plusBtn = document.createElement("button");
                    plusBtn.className = "modusflow-tag-weight-btn";
                    plusBtn.textContent = "+";
                    plusBtn.title = "Increase weight (+0.05)";
                    plusBtn.onclick = (e) => {
                        e.stopPropagation();
                        let newW = Math.round((item.weight + 0.05) * 100) / 100;
                        item.weight = Math.min(2.5, newW);
                        syncBack();
                    };

                    weightBox.appendChild(minusBtn);
                    weightBox.appendChild(weightLabel);
                    weightBox.appendChild(plusBtn);
                    chip.appendChild(weightBox);

                    const muteBtn = document.createElement("button");
                    muteBtn.className = "modusflow-tag-btn-icon";
                    muteBtn.textContent = item.isMuted ? "👁‍🗨" : "👁";
                    muteBtn.title = item.isMuted ? "Unmute tag" : "Mute tag (comment out)";
                    muteBtn.onclick = (e) => {
                        e.stopPropagation();
                        item.isMuted = !item.isMuted;
                        syncBack();
                    };
                    chip.appendChild(muteBtn);

                    const delBtn = document.createElement("button");
                    delBtn.className = "modusflow-tag-btn-icon";
                    delBtn.textContent = "✕";
                    delBtn.title = "Delete tag";
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        items.splice(idx, 1);
                        syncBack();
                    };
                    chip.appendChild(delBtn);

                    chip.addEventListener("dragstart", (e) => {
                        draggedIdx = idx;
                        chip.classList.add("dragging");
                        e.dataTransfer.effectAllowed = "move";
                    });
                    chip.addEventListener("dragover", (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        chip.classList.add("drag-over");
                    });
                    chip.addEventListener("dragleave", () => {
                        chip.classList.remove("drag-over");
                    });
                    chip.addEventListener("drop", (e) => {
                        e.preventDefault();
                        chip.classList.remove("drag-over");
                        if (draggedIdx !== null && draggedIdx !== idx) {
                            const moved = items.splice(draggedIdx, 1)[0];
                            items.splice(idx, 0, moved);
                            syncBack();
                        }
                    });
                    chip.addEventListener("dragend", () => {
                        chip.classList.remove("dragging");
                        draggedIdx = null;
                    });

                    container.appendChild(chip);
                });

                function syncBack() {
                    const reconstructed = reconstructPromptFromChips(items);
                    widget.value = reconstructed;
                    if (widget.inputEl) widget.inputEl.value = reconstructed;
                    renderTagStudio(node, container, widget);
                    widget._updateSyntaxHighlight?.();
                }

                const addInput = document.createElement("input");
                addInput.className = "modusflow-tag-add-input";
                addInput.placeholder = "+ Add Tag...";
                addInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && addInput.value.trim()) {
                        e.preventDefault();
                        const newTag = addInput.value.trim();
                        let cur = (widget.value || "").trim();
                        if (cur && !cur.endsWith(",")) cur += ", ";
                        else if (cur && cur.endsWith(",")) cur += " ";
                        cur += newTag;
                        widget.value = cur;
                        if (widget.inputEl) widget.inputEl.value = cur;
                        addInput.value = "";
                        renderTagStudio(node, container, widget);
                        widget._updateSyntaxHighlight?.();
                        showStudioToast(`Added "${newTag}"`);
                    }
                });
                container.appendChild(addInput);
            }

            function toggleTagStudioMode(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw) return;
                const ta = pw.inputEl || pw.element;
                if (!ta) return;

                node._tagStudioMode = !node._tagStudioMode;
                const btn = node.widgets?.find(w => w.name && (w.name.includes("Tag Studio") || w.name.includes("Text Mode")));
                if (btn) {
                    btn.name = node._tagStudioMode ? "📝 Text Mode" : "🏷 Tag Studio";
                }

                const backdrop = ta.parentElement?.querySelector(".modusflow-syntax-backdrop");
                const container = ta._tagStudioContainer;

                if (node._tagStudioMode) {
                    ta.style.display = "none";
                    if (backdrop) backdrop.style.display = "none";
                    if (container) {
                        container.style.display = "flex";
                        renderTagStudio(node, container, pw);
                    }
                    showStudioToast("Switched to Visual Tag Studio");
                } else {
                    ta.style.display = "";
                    if (container) container.style.display = "none";
                    pw._updateSyntaxHighlight?.();
                    showStudioToast("Switched to Syntax Text Mode");
                }
                app.graph?.setDirtyCanvas(true, true);
            }

            // ── Multi-Model Tone Converter (Danbooru <-> Fluent Prose) ────────────
            function prosifyPromptText(text) {
                if (!text || !text.trim()) return "";
                const lines = text.split("\n");
                const preserved = [];
                const tags = [];

                for (const l of lines) {
                    const trim = l.trim();
                    if (trim.startsWith("#") || trim.startsWith("//") || trim.startsWith("/*") || trim.startsWith("$")) {
                        preserved.push(trim);
                    } else {
                        const parts = l.split(",");
                        for (const p of parts) {
                            const t = p.trim();
                            if (t) tags.push(t);
                        }
                    }
                }

                if (!tags.length) return text;

                const qualityWords = new Set(["masterpiece", "best quality", "high quality", "8k", "ultra-detailed", "extremely detailed", "award-winning", "hyperrealistic"]);
                const filteredTags = [];
                const metaTags = [];

                for (const tag of tags) {
                    const lower = tag.toLowerCase().replace(/^\((.+):[0-9.]+\)$/, "$1").trim();
                    if (qualityWords.has(lower)) {
                        metaTags.push(tag);
                    } else {
                        filteredTags.push(tag);
                    }
                }

                const subjects = [];
                const environments = [];
                const opticsAndLighting = [];
                const styles = [];

                for (const tag of filteredTags) {
                    const lower = tag.toLowerCase();
                    if (/light|glow|sun|shadow|chiaroscuro|illumination|neon|radiant|atmospheric|ambient/.test(lower)) {
                        opticsAndLighting.push(tag);
                    } else if (/lens|mm|f\/|aperture|bokeh|macro|dof|angle|shot|perspective|shutter/.test(lower)) {
                        opticsAndLighting.push(tag);
                    } else if (/photo|painting|illustration|render|anime|digital art|oil painting|sketch/.test(lower)) {
                        styles.push(tag);
                    } else if (/street|forest|room|city|sky|interior|exterior|temple|beach|night|indoor|outdoor|backdrop|background/.test(lower)) {
                        environments.push(tag);
                    } else {
                        subjects.push(tag);
                    }
                }

                let sentences = [];
                if (styles.length) {
                    sentences.push(`A ${styles.join(" and ")}`);
                } else {
                    sentences.push("A detailed photograph");
                }

                if (subjects.length) {
                    sentences[0] += ` featuring ${subjects.join(", ")}`;
                }

                if (environments.length) {
                    sentences.push(`set in ${environments.join(", ")}`);
                }

                if (opticsAndLighting.length) {
                    sentences.push(`illuminated by ${opticsAndLighting.join(", ")}`);
                }

                let prose = sentences.join(", ") + ".";
                prose = prose.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
                if (metaTags.length) {
                    prose += ` ${metaTags.join(", ")}.`;
                }

                if (preserved.length) {
                    return preserved.join("\n") + "\n\n" + prose;
                }
                return prose;
            }

            function tagifyPromptText(text) {
                if (!text || !text.trim()) return "";
                let clean = text
                    .replace(/\/\*[\s\S]*?\*\//g, "")
                    .replace(/(?:^|\n)\s*(?:#|\/\/)[^\n]*/g, "")
                    .replace(/\b(?:a|an|the|of|with|set in|illuminated by|featuring|depicting)\b/gi, "")
                    .replace(/[.;!?]+/g, ",");
                const parts = clean.split(",");
                const tags = [];
                const seen = new Set();
                for (const p of parts) {
                    const t = p.trim().replace(/\s{2,}/g, " ");
                    if (t && t.length > 1) {
                        const lower = t.toLowerCase();
                        if (!seen.has(lower)) {
                            seen.add(lower);
                            tags.push(t);
                        }
                    }
                }
                return tags.join(", ");
            }

            function prosifyPositivePrompt(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw || !pw.value) return;
                const original = pw.value;
                const prose = prosifyPromptText(original);
                if (prose && prose !== original) {
                    pushPromptHistory(node, "Pre-Prosify");
                    pw.value = prose;
                    if (pw.inputEl) pw.inputEl.value = prose;
                    pw._updateSyntaxHighlight?.();
                    showStudioToast("Converted prompt to fluent natural prose!");
                    pushPromptHistory(node, "Converted to Fluent Prose");
                    app.graph?.setDirtyCanvas(true, true);
                }
            }

            function tagifyPositivePrompt(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw || !pw.value) return;
                const original = pw.value;
                const tags = tagifyPromptText(original);
                if (tags && tags !== original) {
                    pushPromptHistory(node, "Pre-Tagify");
                    pw.value = tags;
                    if (pw.inputEl) pw.inputEl.value = tags;
                    pw._updateSyntaxHighlight?.();
                    showStudioToast("Converted prompt to normalized tags!");
                    pushPromptHistory(node, "Converted to Comma Tags");
                    app.graph?.setDirtyCanvas(true, true);
                }
            }

            // ── Visual Aesthetic Ribbon Modal ─────────────────────────────────────
            const AESTHETIC_RIBBON_CATEGORIES = {
                "🎞 Film Stocks": [
                    "Kodak Portra 400 film grain",
                    "CineStill 800T halation",
                    "Fujifilm Provia 100F vivid color",
                    "Ilford HP5 Plus black and white",
                    "Kodak Ektachrome 100 slide film",
                    "Vintage Kodachrome 64 color tones",
                    "Polaroid 600 instant film texture",
                    "Agfa Vista 200 warm tones"
                ],
                "📷 Lenses & Optics": [
                    "85mm f/1.4 portrait prime lens",
                    "35mm anamorphic widescreen lens",
                    "50mm f/1.2 creamy bokeh",
                    "100mm macro f/2.8 extreme details",
                    "tilt-shift miniature optics",
                    "ultra-wide 16mm dynamic perspective",
                    "soft optical vignette",
                    "subtle chromatic aberration"
                ],
                "💡 Lighting Rigs": [
                    "dramatic chiaroscuro lighting",
                    "warm golden hour rim light",
                    "volumetric atmospheric god rays",
                    "moody cyberpunk neon rim glow",
                    "soft butterfly studio illumination",
                    "subtle bioluminescent ambient glow",
                    "creamy diffused overcast soft light",
                    "cinematic split blue and amber lighting"
                ],
                "🎥 Camera Systems": [
                    "Hasselblad H6D-100c medium format",
                    "Leica M11 Rangefinder photograph",
                    "ARRI Alexa 65 cinematic sensor",
                    "IMAX 70mm film camera photograph",
                    "Sony A1 8k resolution photo",
                    "Red V-Raptor 8k VV cinema capture"
                ]
            };

            // ── Song Lyrics & Musical Structure Modal ────────────────────────────
            function showSongLyricsModal(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw) return;

                const overlay = document.createElement("div");
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

                const dialog = document.createElement("div");
                dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 680px; max-width: 94vw; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.7); color: #cdd6f4; font-family: sans-serif;";

                const header = document.createElement("div");
                header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
                header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 8px;">🎵 <span>Song Lyrics &amp; Section Structure Studio</span></h3>';

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
                closeBtn.onclick = () => overlay.remove();
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const body = document.createElement("div");
                body.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-height: 520px; padding-right: 4px;";

                // Section tag insert ribbon
                const sectionGroup = document.createElement("div");
                sectionGroup.innerHTML = '<div style="font-size: 12px; font-weight: bold; color: #cba6f7; margin-bottom: 6px;">Insert Song Section Tag</div>';
                const sectionWrap = document.createElement("div");
                sectionWrap.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";

                const LYRIC_SECTIONS = [
                    "[Intro]",
                    "[Verse 1]",
                    "[Verse 2]",
                    "[Verse 3]",
                    "[Pre-Chorus]",
                    "[Chorus]",
                    "[Hook]",
                    "[Bridge]",
                    "[Guitar Solo]",
                    "[Breakdown]",
                    "[Outro]",
                    "(Backing Vocals)",
                    "(Harmonies)"
                ];

                function insertTag(tag) {
                    let cur = pw.value || "";
                    if (cur.length > 0 && !cur.endsWith("\n") && !cur.endsWith("\n\n")) {
                        cur += "\n\n";
                    }
                    pw.value = cur + tag + "\n";
                    if (pw.inputEl) pw.inputEl.value = pw.value;
                    pw._updateSyntaxHighlight?.();
                    node._popoutSyncFromNode?.();
                    app.graph?.setDirtyCanvas(true, true);
                    showStudioToast(`Inserted: ${tag}`);
                }

                LYRIC_SECTIONS.forEach(tag => {
                    const btn = document.createElement("button");
                    btn.textContent = tag;
                    btn.style.cssText = "background: #11111b; border: 1px solid #313244; color: #a6adc8; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; transition: all 0.15s ease;";
                    btn.onmouseenter = () => { btn.style.borderColor = "#89b4fa"; btn.style.color = "#89b4fa"; };
                    btn.onmouseleave = () => { btn.style.borderColor = "#313244"; btn.style.color = "#a6adc8"; };
                    btn.onclick = () => insertTag(tag);
                    sectionWrap.appendChild(btn);
                });
                sectionGroup.appendChild(sectionWrap);
                body.appendChild(sectionGroup);

                // Full Song Templates
                const tmplGroup = document.createElement("div");
                tmplGroup.innerHTML = '<div style="font-size: 12px; font-weight: bold; color: #89b4fa; margin-top: 8px; margin-bottom: 6px;">Full Song Architecture Templates</div>';
                const tmplWrap = document.createElement("div");
                tmplWrap.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

                const SONG_TEMPLATES = [
                    {
                        name: "Standard Pop / Rock Architecture",
                        desc: "Intro -> Verse 1 -> Chorus -> Verse 2 -> Chorus -> Bridge -> Chorus -> Outro",
                        content: "[intro]\n(Melodic rhythm with gentle atmosphere)\n\n[verse 1]\nFirst story unfolds here\nUnderneath the fading sky\n\n[chorus]\nHold on to the melody\nSing it loud for all to see\n\n[verse 2]\nWalking through the crowded street\nFinding where the echoes meet\n\n[chorus]\nHold on to the melody\nSing it loud for all to see\n\n[bridge]\nWhen the shadows start to fall\nWe remember through it all\n\n[chorus]\nHold on to the melody\nSing it loud for all to see\n\n[outro]\nFading gently into dawn\n(Instrumental fade out)"
                    },
                    {
                        name: "Acoustic Ballad / Folk Template",
                        desc: "Intro -> Verse 1 -> Chorus -> Verse 2 -> Chorus -> Outro",
                        content: "[intro]\n(Delicate fingerpicked guitar)\n\n[verse 1]\nDust on the windowsill, sun on the floor\nMorning knocks softly upon my front door\n\n[chorus]\nTime rolls like a river down to the sea\nCarrying all that we wanted to be\n\n[verse 2]\nThe old oak tree leans where the fence used to stand\nMemories scattered like dust in our hand\n\n[chorus]\nTime rolls like a river down to the sea\nCarrying all that we wanted to be\n\n[outro]\nSoftly down the quiet road\n(Harmonica solo fades)"
                    }
                ];

                SONG_TEMPLATES.forEach(t => {
                    const row = document.createElement("div");
                    row.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px;";
                    row.innerHTML = `
                        <div>
                            <div style="font-size: 12px; font-weight: bold; color: #fab387;">${t.name}</div>
                            <div style="font-size: 11px; color: #a6adc8; margin-top: 2px;">${t.desc}</div>
                        </div>
                    `;
                    const applyBtn = document.createElement("button");
                    applyBtn.textContent = "Apply Template";
                    applyBtn.style.cssText = "background: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.4); color: #89b4fa; border-radius: 6px; padding: 5px 12px; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap;";
                    applyBtn.onclick = () => {
                        pw.value = t.content;
                        if (pw.inputEl) pw.inputEl.value = pw.value;
                        pw._updateSyntaxHighlight?.();
                        node._popoutSyncFromNode?.();
                        app.graph?.setDirtyCanvas(true, true);
                        showStudioToast(`Applied: ${t.name}`);
                        overlay.remove();
                    };
                    row.appendChild(applyBtn);
                    tmplWrap.appendChild(row);
                });
                tmplGroup.appendChild(tmplWrap);
                body.appendChild(tmplGroup);

                dialog.appendChild(body);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
                overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            }

            function showAestheticRibbonModal(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw) return;

                const overlay = document.createElement("div");
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

                const dialog = document.createElement("div");
                dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 660px; max-width: 94vw; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.7); color: #cdd6f4; font-family: sans-serif;";

                const header = document.createElement("div");
                header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
                header.innerHTML = '<h3 style="margin: 0; font-size: 16px; color: #89b4fa; display: flex; align-items: center; gap: 8px;">🎞 <span>Visual Aesthetic Ribbon — Film, Optics &amp; Lighting</span></h3>';

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
                closeBtn.onclick = () => overlay.remove();
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const body = document.createElement("div");
                body.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 14px; max-height: 520px; padding-right: 4px;";

                for (const [category, items] of Object.entries(AESTHETIC_RIBBON_CATEGORIES)) {
                    const sec = document.createElement("div");
                    sec.innerHTML = `<div style="font-size: 12px; font-weight: bold; color: #cba6f7; margin-bottom: 6px;">${category}</div>`;
                    const grid = document.createElement("div");
                    grid.style.cssText = "display: flex; flex-wrap: wrap; gap: 6px;";

                    for (const item of items) {
                        const btn = document.createElement("button");
                        btn.textContent = item;
                        btn.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 6px; padding: 6px 10px; color: #cdd6f4; font-size: 12px; cursor: pointer; transition: all 0.15s ease;";
                        btn.onmouseenter = () => { btn.style.borderColor = "#89b4fa"; btn.style.background = "#26263b"; };
                        btn.onmouseleave = () => { btn.style.borderColor = "#313244"; btn.style.background = "#1e1e2e"; };

                        btn.onclick = () => {
                            let cur = (pw.value || "").trim();
                            if (cur && !cur.endsWith(",")) cur += ", ";
                            else if (cur && cur.endsWith(",")) cur += " ";
                            cur += item;
                            pw.value = cur;
                            if (pw.inputEl) pw.inputEl.value = cur;
                            pw._updateSyntaxHighlight?.();
                            showStudioToast(`Added [${item}]`);
                            pushPromptHistory(node, `Ribbon: ${item}`);
                            btn.textContent = "✓ Injected";
                            btn.style.borderColor = "#a6e3a1";
                            btn.style.color = "#a6e3a1";
                            setTimeout(() => {
                                btn.textContent = item;
                                btn.style.borderColor = "#313244";
                                btn.style.color = "#cdd6f4";
                            }, 1000);
                        };
                        grid.appendChild(btn);
                    }
                    sec.appendChild(grid);
                    body.appendChild(sec);
                }

                dialog.appendChild(body);
                overlay.appendChild(dialog);
                overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
                document.body.appendChild(overlay);
            }

            // ── Permutation / Variation Matrix Generator ──────────────────────────
            function generatePermutationMatrix(text) {
                if (!text) return [];
                const choiceRegex = /\{([^{}]+)\}/g;
                const matches = [];
                let m;
                while ((m = choiceRegex.exec(text)) !== null) {
                    const body = m[1];
                    if (body.startsWith("shuffle:")) continue;
                    const opts = body.split("|").map(x => x.trim()).filter(Boolean);
                    if (opts.length > 1) {
                        matches.push({ full: m[0], opts });
                    }
                }

                if (!matches.length) return [];

                let variations = [text];
                for (const match of matches) {
                    const next = [];
                    for (const currentText of variations) {
                        for (const opt of match.opts) {
                            next.push(currentText.replace(match.full, opt));
                        }
                    }
                    variations = next;
                    if (variations.length > 64) break;
                }
                return variations;
            }

            function showVariationGridModal(node) {
                const pw = node.widgets?.find(w => w.name === "positive");
                if (!pw || !pw.value) {
                    showStudioToast("Please enter a positive prompt with {a|b} choices first.", "warning");
                    return;
                }

                const variations = generatePermutationMatrix(pw.value);
                if (!variations.length || (variations.length === 1 && variations[0] === pw.value)) {
                    showStudioToast("No dynamic choices {a|b} found in prompt to permute.", "info");
                    return;
                }

                const overlay = document.createElement("div");
                overlay.className = "modusflow-modal-overlay";
                overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100050; backdrop-filter: blur(4px);";

                const dialog = document.createElement("div");
                dialog.style.cssText = "background: #181825; border: 1px solid #313244; border-radius: 12px; padding: 20px; width: 680px; max-width: 94vw; max-height: 85vh; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.7); color: #cdd6f4; font-family: sans-serif;";

                const header = document.createElement("div");
                header.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 8px;";
                header.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h3 style="margin: 0; font-size: 16px; color: #f5c2e7;">⚄ Variation Grid</h3>
                        <span style="font-size: 11px; background: #313244; color: #a6adc8; padding: 2px 8px; border-radius: 10px;">${variations.length} Combinations</span>
                    </div>
                `;

                const closeBtn = document.createElement("button");
                closeBtn.textContent = "✕";
                closeBtn.style.cssText = "background: none; border: none; color: #6c7086; font-size: 18px; cursor: pointer;";
                closeBtn.onclick = () => overlay.remove();
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const list = document.createElement("div");
                list.style.cssText = "overflow-y: auto; display: flex; flex-direction: column; gap: 8px; max-height: 520px; padding-right: 4px;";

                variations.forEach((variantText, idx) => {
                    const row = document.createElement("div");
                    row.style.cssText = "background: #1e1e2e; border: 1px solid #313244; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px;";

                    const info = document.createElement("div");
                    info.style.cssText = "flex: 1; min-width: 0;";
                    info.innerHTML = `
                        <div style="font-size: 11px; font-weight: bold; color: #cba6f7; margin-bottom: 3px;">#${idx + 1}</div>
                        <div style="font-size: 12px; color: #cdd6f4; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-word;">${escapeHtml(variantText)}</div>
                    `;

                    const actRow = document.createElement("div");
                    actRow.style.cssText = "display: flex; gap: 6px; flex-shrink: 0;";

                    const copyBtn = document.createElement("button");
                    copyBtn.textContent = "📋 Copy";
                    copyBtn.style.cssText = "background: #313244; border: 1px solid #45475a; border-radius: 4px; padding: 5px 8px; color: #cdd6f4; font-size: 11px; cursor: pointer;";
                    copyBtn.onclick = () => {
                        navigator.clipboard?.writeText(variantText);
                        showStudioToast(`Variation #${idx + 1} copied!`);
                    };

                    const useBtn = document.createElement("button");
                    useBtn.textContent = "✨ Use This";
                    useBtn.style.cssText = "background: rgba(137, 180, 250, 0.2); border: 1px solid #89b4fa; border-radius: 4px; padding: 5px 10px; color: #89b4fa; font-size: 11px; font-weight: 600; cursor: pointer;";
                    useBtn.onclick = () => {
                        pushPromptHistory(node, "Pre-Variation Selection");
                        pw.value = variantText;
                        if (pw.inputEl) pw.inputEl.value = variantText;
                        pw._updateSyntaxHighlight?.();
                        overlay.remove();
                        showStudioToast(`Applied Variation #${idx + 1}`);
                        pushPromptHistory(node, `Applied Variation #${idx + 1}`);
                    };

                    actRow.appendChild(copyBtn);
                    actRow.appendChild(useBtn);
                    row.appendChild(info);
                    row.appendChild(actRow);
                    list.appendChild(row);
                });

                dialog.appendChild(list);
                overlay.appendChild(dialog);
                overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
                document.body.appendChild(overlay);
            }

            function toggleNodeLayout(node) {
                node._splitLayout = !node._splitLayout;
                if (node._splitLayout) {
                    node.size = [980, 680];
                } else {
                    node.size = [560, 930];
                }
                const splitBtn = node.widgets?.find(w => w.name && (w.name.includes("Split Studio") || w.name.includes("Stacked Layout") || w.name.includes("Side-by-Side")));
                if (splitBtn) {
                    splitBtn.name = node._splitLayout ? "◫ Stacked Layout" : "◫ Split Studio";
                }
                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                pw?._updateSyntaxHighlight?.();
                nw?._updateSyntaxHighlight?.();
                app.graph?.setDirtyCanvas(true, true);
                showStudioToast(node._splitLayout ? "Split-Screen Studio Mode Active" : "Stacked Layout Mode Active");
            }

            // ── Studio Tools Dropdown Menu ───────────────────────────────────────
            function showStudioToolsMenu(node, evt) {
                const existing = document.getElementById("modusflow-tools-menu");
                if (existing) {
                    existing.remove();
                    return;
                }

                const menu = document.createElement("div");
                menu.id = "modusflow-tools-menu";
                menu.style.cssText = "position: fixed; z-index: 100020; background: #181825; border: 1px solid #45475a; border-radius: 8px; box-shadow: 0 16px 36px rgba(0,0,0,0.7), 0 0 1px 1px rgba(255,255,255,0.1); padding: 6px; min-width: 250px; color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;";

                let x = evt ? evt.clientX : (window.innerWidth / 2 - 125);
                let y = evt ? evt.clientY : (window.innerHeight / 2 - 150);
                if (x + 260 > window.innerWidth) x = window.innerWidth - 270;
                if (y + 400 > window.innerHeight) y = Math.max(10, window.innerHeight - 410);
                menu.style.left = `${Math.max(10, x)}px`;
                menu.style.top = `${Math.max(10, y)}px`;

                const sections = [
                    {
                        title: "Studio & Layout",
                        items: [
                            { label: "⛶ Pop Out Studio", action: () => showPopOutStudio(node) },
                            { label: "🏷 Tag Studio Mode", action: () => toggleTagStudioMode(node) },
                            { label: "◫ Split Studio Layout", action: () => toggleNodeLayout(node) }
                        ]
                    },
                    {
                        title: "Styling & Color",
                        items: [
                            { label: "🌈 Color Spectrum Studio", action: () => showColorPaletteModal(node) },
                            { label: "🎞 Visual Aesthetic Ribbon", action: () => showAestheticRibbonModal(node) },
                            { label: "🎨 Active LoRA Deck", action: () => showLoraDeckModal(node) },
                            { label: "⚡ Quick Chips", action: () => showQuickChipsModal(node) }
                        ]
                    },
                    {
                        title: "Prose & Flow",
                        items: [
                            { label: "🔄 Convert: Tags ↔ Expressions", action: () => convertPromptStyle(node) },
                            { label: "✍️ Prosify (Fluent Prose)", action: () => prosifyPositivePrompt(node) },
                            { label: "🏷 Tagify (Tags & Weights)", action: () => tagifyPositivePrompt(node) },
                            { label: "⇄ Swap Positive / Negative", action: () => swapPositiveNegative(node) },
                            { label: "🧹 Prettify & Dedupe Tags", action: () => prettifyNodePrompts(node) },
                            { label: "✨ Translate All Hex Codes", action: () => translateAllHexInNode(node) },
                            { label: "◫ Explode / Collapse Tags", action: () => toggleTagFormat(node) }
                        ]
                    },
                    {
                        title: "Analysis & History",
                        items: [
                            { label: "⚄ Choice Variation Grid", action: () => showVariationGridModal(node) },
                            { label: "👁️ Preview Resolved Prompt", action: () => showResolvedPreviewModal(node) },
                            { label: "🔍 Prompt Diff Viewer", action: () => showPromptDiffModal(node) },
                            { label: "🔍 Find & Replace (Ctrl+F)", action: () => showFindReplaceBar(node) },
                            { label: "📜 Prompt History", action: () => showHistoryDialog(node) },
                            { label: "🔃 Refresh Saved Prompts", action: () => refreshPrompts(node) }
                        ]
                    },
                    {
                        title: "Configuration",
                        items: [
                            { label: "⚙️ ModusFlow Settings...", action: () => showModusFlowSettingsModal(node) }
                        ]
                    }
                ];

                sections.forEach((sec, sIdx) => {
                    if (sIdx > 0) {
                        const sep = document.createElement("div");
                        sep.style.cssText = "height: 1px; background: #313244; margin: 4px 6px;";
                        menu.appendChild(sep);
                    }
                    const titleEl = document.createElement("div");
                    titleEl.style.cssText = "font-size: 10px; font-weight: 700; color: #6c7086; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px 2px 8px;";
                    titleEl.textContent = sec.title;
                    menu.appendChild(titleEl);

                    sec.items.forEach(it => {
                        const itemEl = document.createElement("div");
                        itemEl.style.cssText = "padding: 5px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; transition: all 0.12s ease;";
                        itemEl.textContent = it.label;
                        itemEl.onmouseenter = () => {
                            itemEl.style.background = "#313244";
                            itemEl.style.color = "#89b4fa";
                        };
                        itemEl.onmouseleave = () => {
                            itemEl.style.background = "transparent";
                            itemEl.style.color = "#cdd6f4";
                        };
                        itemEl.onclick = (e) => {
                            e.stopPropagation();
                            menu.remove();
                            it.action();
                        };
                        menu.appendChild(itemEl);
                    });
                });

                const closeListener = (e) => {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener("pointerdown", closeListener, true);
                    }
                };
                setTimeout(() => {
                    document.addEventListener("pointerdown", closeListener, true);
                }, 10);

                document.body.appendChild(menu);
            }

            // ── Pop-Out Prompt Studio (Floating & Fullscreen Workstation) ─────────
            function showPopOutStudio(node) {
                if (node._popoutStudioEl && document.body.contains(node._popoutStudioEl)) {
                    if (node._popoutStudioEl.classList.contains("is-minimized")) {
                        node._popoutStudioEl.classList.remove("is-minimized");
                    }
                    const currentZ = parseInt(node._popoutStudioEl.style.zIndex || "10001", 10);
                    node._popoutStudioEl.style.zIndex = String(currentZ + 1);
                    node._popoutStudioEl.querySelector("textarea")?.focus();
                    showStudioToast("Prompt Studio brought to front");
                    return;
                }

                const pw = node.widgets?.find(w => w.name === "positive");
                const nw = node.widgets?.find(w => w.name === "negative");
                if (!pw || !nw) return;

                const win = document.createElement("div");
                win.className = "modusflow-popout-window";
                node._popoutStudioEl = win;

                let z = typeof window._popoutZIndex === "number" ? ++window._popoutZIndex : 10001;
                window._popoutZIndex = z;
                win.style.zIndex = String(z);

                const defW = Math.min(1220, Math.floor(window.innerWidth * 0.90));
                const defH = Math.min(840, Math.floor(window.innerHeight * 0.88));
                const defTop = Math.max(30, Math.floor((window.innerHeight - defH) / 2));
                const defLeft = Math.max(30, Math.floor((window.innerWidth - defW) / 2));

                let savedRect = node._popoutSavedRect;
                if (!savedRect && typeof localStorage !== "undefined") {
                    try {
                        const raw = localStorage.getItem("modusflow_popout_geometry");
                        if (raw) savedRect = JSON.parse(raw);
                    } catch (_) {}
                }

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

                // ── Header Bar ──
                const header = document.createElement("div");
                header.className = "modusflow-popout-header";

                const titleGroup = document.createElement("div");
                titleGroup.style.cssText = "display: flex; align-items: center; gap: 8px; min-width: 0;";
                const nodeTitle = node.title || "Text Editor";
                const savedPromptName = node.widgets?.find(w => w.name === "saved_prompt")?.value || "Draft";
                titleGroup.innerHTML = `
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #a6e3a1; box-shadow: 0 0 8px #a6e3a1; flex-shrink: 0;"></div>
                    <span style="font-weight: 700; font-size: 13px; color: #cdd6f4; white-space: nowrap;">ModusFlow Studio</span>
                    <span style="font-size: 11px; color: #89b4fa; background: rgba(137, 180, 250, 0.15); border: 1px solid rgba(137, 180, 250, 0.3); padding: 1px 7px; border-radius: 10px; white-space: nowrap;">#${node.id} ${escapeHtml(nodeTitle)}</span>
                    <span id="mf-popout-prompt-tag" style="font-size: 11px; color: #f5c2e7; background: rgba(245, 194, 231, 0.12); border: 1px solid rgba(245, 194, 231, 0.25); padding: 1px 7px; border-radius: 10px; white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(savedPromptName)}</span>
                `;

                const statGroup = document.createElement("div");
                statGroup.style.cssText = "display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 12px;";
                const posStatPill = document.createElement("span");
                posStatPill.style.cssText = "font-size: 11px; font-family: ui-monospace, monospace; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 4px; color: #94a3b8;";
                const negStatPill = document.createElement("span");
                negStatPill.style.cssText = "font-size: 11px; font-family: ui-monospace, monospace; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 4px; color: #94a3b8;";
                statGroup.appendChild(posStatPill);
                statGroup.appendChild(negStatPill);

                const winControls = document.createElement("div");
                winControls.style.cssText = "display: flex; align-items: center; gap: 6px; flex-shrink: 0;";

                const queueBtn = document.createElement("button");
                queueBtn.className = "modusflow-popout-btn";
                queueBtn.style.cssText = "background: linear-gradient(135deg, rgba(166, 227, 161, 0.25), rgba(137, 180, 250, 0.2)); border: 1px solid #a6e3a1; color: #a6e3a1; font-weight: 700; padding: 4px 10px;";
                queueBtn.innerHTML = "🚀 Queue";
                queueBtn.title = "Queue generation to ComfyUI (Ctrl+Enter)";
                queueBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof app.queuePrompt === "function") {
                        app.queuePrompt(0);
                    } else {
                        document.getElementById("queue-button")?.click();
                    }
                    showStudioToast("🚀 Prompt queued to ComfyUI!");
                };

                const minBtn = document.createElement("button");
                minBtn.className = "modusflow-popout-btn";
                minBtn.innerHTML = "—";
                minBtn.title = "Minimize to floating dock";
                minBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleMinimize();
                };

                const maxBtn = document.createElement("button");
                maxBtn.className = "modusflow-popout-btn";
                maxBtn.innerHTML = "⇱";
                maxBtn.title = "Maximize / Fullscreen Studio";
                maxBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleMaximize();
                };

                const dockBtn = document.createElement("button");
                dockBtn.className = "modusflow-popout-btn";
                dockBtn.style.cssText = "color: #f38ba8; border-color: rgba(243, 139, 168, 0.4);";
                dockBtn.innerHTML = "✕ Dock";
                dockBtn.title = "Dock back to canvas node";
                dockBtn.onclick = (e) => {
                    e.stopPropagation();
                    closePopout();
                };

                winControls.appendChild(queueBtn);
                winControls.appendChild(minBtn);
                winControls.appendChild(maxBtn);
                winControls.appendChild(dockBtn);

                header.appendChild(titleGroup);
                header.appendChild(statGroup);
                header.appendChild(winControls);
                win.appendChild(header);

                // ── Toolbar Ribbon ──
                const toolbar = document.createElement("div");
                toolbar.className = "modusflow-popout-toolbar";

                // Category & Prompt Selectors
                const catSel = document.createElement("select");
                catSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #89b4fa; font-size: 11px; padding: 3px 6px; outline: none; cursor: pointer; max-width: 140px;";
                catSel.title = "Filter prompts by category";

                const promptSel = document.createElement("select");
                promptSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #a6e3a1; font-size: 11px; font-weight: 600; padding: 3px 8px; outline: none; cursor: pointer; max-width: 200px;";
                promptSel.title = "Select prompt to load";

                function populatePopoutPrompts() {
                    const all = node._allPrompts || [];
                    const cats = [...new Set(all.map(p => (p.category || "").trim()).filter(Boolean))].sort();

                    const savedCat = (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_prompt_category_filter")) || "--all categories--";
                    const prevCat = catSel.value || savedCat;
                    catSel.innerHTML = "";
                    const allOpt = document.createElement("option");
                    allOpt.value = "--all categories--";
                    allOpt.textContent = "📁 All Categories";
                    catSel.appendChild(allOpt);
                    cats.forEach(c => {
                        const opt = document.createElement("option");
                        opt.value = c;
                        opt.textContent = `📁 ${c}`;
                        if (c === prevCat) opt.selected = true;
                        catSel.appendChild(opt);
                    });

                    const activeCat = catSel.value;
                    let filtered = all;
                    if (activeCat && activeCat !== "--all categories--") {
                        filtered = filtered.filter(p => (p.category || "") === activeCat);
                    }
                    const filenames = filtered.map(p => p.filename);
                    const curVal = node.widgets?.find(w => w.name === "saved_prompt")?.value || "";

                    promptSel.innerHTML = "";
                    if (filenames.length === 0) {
                        const opt = document.createElement("option");
                        opt.value = "";
                        opt.textContent = "--no prompts found--";
                        promptSel.appendChild(opt);
                    } else {
                        const defaultOpt = document.createElement("option");
                        defaultOpt.value = "";
                        defaultOpt.textContent = "📂 --select prompt--";
                        promptSel.appendChild(defaultOpt);
                        filenames.forEach(fn => {
                            const opt = document.createElement("option");
                            opt.value = fn;
                            opt.textContent = fn;
                            if (fn === curVal) opt.selected = true;
                            promptSel.appendChild(opt);
                        });
                    }
                }

                catSel.onchange = () => {
                    try {
                        localStorage.setItem("modusflow_prompt_category_filter", catSel.value);
                    } catch (_) {}
                    populatePopoutPrompts();
                };

                promptSel.onchange = () => {
                    const val = promptSel.value;
                    if (val && val !== "--select prompt--" && val !== "--no prompts found--") {
                        const dw = node.widgets?.find(w => w.name === "saved_prompt");
                        if (dw) dw.value = val;
                        loadPrompt(node, val);
                    }
                };

                node._popoutSyncPromptsDropdown = populatePopoutPrompts;
                populatePopoutPrompts();

                toolbar.appendChild(catSel);
                toolbar.appendChild(promptSel);

                // Editable Prompt Category input badge for active prompt
                const catBadge = document.createElement("div");
                catBadge.style.cssText = "display: inline-flex; align-items: center; gap: 4px; background: #11111b; border: 1px solid #313244; border-radius: 5px; padding: 2px 6px;";
                catBadge.title = "Current prompt category (type to set category for this prompt)";
                const catIcon = document.createElement("span");
                catIcon.style.cssText = "font-size: 11px; color: #89b4fa; font-weight: 600;";
                catIcon.textContent = "📁";
                const catInput = document.createElement("input");
                catInput.type = "text";
                catInput.placeholder = "Category";
                catInput.style.cssText = "background: transparent; border: none; color: #cdd6f4; font-size: 11px; width: 95px; outline: none;";
                const curPcw = node.widgets?.find(w => w.name === "prompt_category");
                catInput.value = (curPcw?.value || "").trim();
                catInput.oninput = () => {
                    if (curPcw) {
                        curPcw.value = catInput.value.trim();
                        if (curPcw.inputEl) curPcw.inputEl.value = curPcw.value;
                    }
                };
                catBadge.appendChild(catIcon);
                catBadge.appendChild(catInput);
                toolbar.appendChild(catBadge);
                node._popoutCategoryInput = catInput;

                function addToolBtn(iconText, title, onClick, extraStyle = "") {
                    const btn = document.createElement("button");
                    btn.className = "modusflow-popout-btn";
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

                addToolBtn("💾 Save", "Save prompt preset", () => showSaveDialog(node));
                addToolBtn("🔄 Update", "Update selected prompt file", () => updatePrompt(node));
                addToolBtn("🏷️ Category", "Assign prompt to a category", () => showAssignCategoryDialog(node));
                addToolBtn("🔃 Refresh", "Refresh saved prompts list", () => refreshPrompts(node));

                const divSep = document.createElement("div");
                divSep.style.cssText = "width: 1px; height: 18px; background: #313244; margin: 0 4px;";
                toolbar.appendChild(divSep);

                // Prompt Style selector in Popout
                const styleSel = document.createElement("select");
                styleSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #fab387; font-size: 11px; font-weight: 600; padding: 3px 6px; outline: none; cursor: pointer;";
                styleSel.title = "Prompt Style: Tags (SDXL/Pony) vs Expressions (Flux/SD3) vs Song Lyrics";
                const styleOpt1 = document.createElement("option");
                styleOpt1.value = "Tags (SDXL / Pony)";
                styleOpt1.textContent = "🏷️ Tags (Pony)";
                const styleOpt2 = document.createElement("option");
                styleOpt2.value = "Expressions (Flux / SD3)";
                styleOpt2.textContent = "✍️ Expressions (Flux)";
                const styleOpt3 = document.createElement("option");
                styleOpt3.value = "Song Lyrics / Audio";
                styleOpt3.textContent = "🎵 Song Lyrics";
                const curStyle = node.widgets?.find(w => w.name === "prompt_style")?.value || "Tags (SDXL / Pony)";
                if (curStyle.includes("Expression")) styleOpt2.selected = true;
                else if (curStyle.includes("Lyric") || curStyle.includes("Song")) styleOpt3.selected = true;
                else styleOpt1.selected = true;
                styleSel.appendChild(styleOpt1);
                styleSel.appendChild(styleOpt2);
                styleSel.appendChild(styleOpt3);
                styleSel.onchange = () => {
                    const sw = node.widgets?.find(w => w.name === "prompt_style");
                    if (sw) sw.value = styleSel.value;
                    node.properties = node.properties || {};
                    node.properties["prompt_style"] = styleSel.value;
                    try {
                        localStorage.setItem("modusflow_default_prompt_style", styleSel.value);
                    } catch (_) {}
                    fetch("/modusflow/save_config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt_style: styleSel.value })
                    }).catch(() => {});
                    showStudioToast(`Prompt style: ${styleSel.value}`);
                    app.graph?.setDirtyCanvas(true, true);
                };
                node._popoutSyncStyle = (val) => {
                    if (styleSel) {
                        if (val.includes("Expression")) styleSel.value = "Expressions (Flux / SD3)";
                        else if (val.includes("Lyric") || val.includes("Song")) styleSel.value = "Song Lyrics / Audio";
                        else styleSel.value = "Tags (SDXL / Pony)";
                    }
                };
                toolbar.appendChild(styleSel);

                addToolBtn("⇄ Style", "Convert prompt between Tags (Pony) and Expressions (Flux)", () => {
                    convertPromptStyle(node);
                    syncFromNode();
                });

                const themeSel = document.createElement("select");
                themeSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #cdd6f4; font-size: 11px; padding: 3px 6px; outline: none; cursor: pointer;";
                const curTheme = node._currentSyntaxTheme ||
                    (typeof localStorage !== "undefined" && localStorage.getItem("modusflow_syntax_theme")) ||
                    "Modus Neon (Default)";
                getThemeOptions().forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.textContent = t;
                    if (t === curTheme) opt.selected = true;
                    themeSel.appendChild(opt);
                });
                themeSel.onchange = () => {
                    setNodeTheme(node, themeSel.value);
                    const tw = node.widgets?.find(w => w.name === "syntax_theme");
                    if (tw) tw.value = themeSel.value;
                    try {
                        localStorage.setItem("modusflow_syntax_theme", themeSel.value);
                    } catch (_) {}
                    app.ui?.settings?.setSettingValue?.("ModusFlow.DefaultSyntaxTheme", themeSel.value);
                    updatePopoutBackdrops();
                };
                toolbar.appendChild(themeSel);

                // ── Typography Controls (Font Family & Font Size with Persistence) ──
                const POPOUT_FONT_FAMILIES = {
                    "Monospace": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    "JetBrains Mono": "'JetBrains Mono', Consolas, Monaco, monospace",
                    "Fira Code": "'Fira Code', 'Cascadia Code', Consolas, monospace",
                    "Consolas": "'Cascadia Code', Consolas, 'Courier New', monospace",
                    "Clean Sans (Inter)": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    "Editorial Serif": "'Georgia', 'Cambria', 'Times New Roman', serif",
                    "Readable / Dyslexic": "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif"
                };

                let savedFontKey = "Monospace";
                try {
                    const sf = localStorage.getItem("modusflow_popout_font_family");
                    if (sf && POPOUT_FONT_FAMILIES[sf]) savedFontKey = sf;
                } catch (_) {}

                let savedFontSize = 14;
                try {
                    const rawSz = localStorage.getItem("modusflow_popout_font_size");
                    if (rawSz) savedFontSize = parseInt(rawSz, 10) || 14;
                } catch (_) {}
                savedFontSize = Math.max(10, Math.min(32, savedFontSize));

                const fontSel = document.createElement("select");
                fontSel.style.cssText = "background: #11111b; border: 1px solid #313244; border-radius: 5px; color: #cdd6f4; font-size: 11px; padding: 3px 6px; outline: none; cursor: pointer; max-width: 140px;";
                fontSel.title = "Select Popout Editor Font Family (Persists across sessions)";
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
                sizeDecBtn.className = "modusflow-popout-btn";
                sizeDecBtn.style.cssText = "border: none; border-radius: 0; padding: 3px 6px; font-size: 11px; font-weight: bold; background: transparent;";
                sizeDecBtn.textContent = "A-";
                sizeDecBtn.title = "Decrease font size (Ctrl + Minus)";

                const sizeSel = document.createElement("select");
                sizeSel.style.cssText = "background: transparent; border: none; color: #89b4fa; font-size: 11px; font-weight: 600; padding: 3px 4px; outline: none; cursor: pointer;";
                sizeSel.title = "Popout Font Size (Persists across sessions, Ctrl+Wheel to zoom)";
                [11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28].forEach(sz => {
                    const opt = document.createElement("option");
                    opt.value = sz;
                    opt.textContent = `${sz}px`;
                    if (sz === savedFontSize) opt.selected = true;
                    sizeSel.appendChild(opt);
                });

                const sizeIncBtn = document.createElement("button");
                sizeIncBtn.className = "modusflow-popout-btn";
                sizeIncBtn.style.cssText = "border: none; border-radius: 0; padding: 3px 6px; font-size: 11px; font-weight: bold; background: transparent;";
                sizeIncBtn.textContent = "A+";
                sizeIncBtn.title = "Increase font size (Ctrl + Plus)";

                function applyTypography(sz, fontKey) {
                    savedFontSize = Math.max(10, Math.min(32, sz));
                    savedFontKey = POPOUT_FONT_FAMILIES[fontKey] ? fontKey : "Monospace";
                    const cssFamily = POPOUT_FONT_FAMILIES[savedFontKey];

                    win.style.setProperty("--mf-popout-font-size", `${savedFontSize}px`);
                    win.style.setProperty("--mf-popout-font-family", cssFamily);

                    if (posBackdrop) {
                        posBackdrop.style.fontSize = `${savedFontSize}px`;
                        posBackdrop.style.fontFamily = cssFamily;
                    }
                    if (negBackdrop) {
                        negBackdrop.style.fontSize = `${savedFontSize}px`;
                        negBackdrop.style.fontFamily = cssFamily;
                    }
                    if (posTa) {
                        posTa.style.fontSize = `${savedFontSize}px`;
                        posTa.style.fontFamily = cssFamily;
                    }
                    if (negTa) {
                        negTa.style.fontSize = `${savedFontSize}px`;
                        negTa.style.fontFamily = cssFamily;
                    }

                    if (sizeSel && sizeSel.value !== String(savedFontSize)) {
                        sizeSel.value = String(savedFontSize);
                        if (!sizeSel.value) {
                            const customOpt = document.createElement("option");
                            customOpt.value = String(savedFontSize);
                            customOpt.textContent = `${savedFontSize}px`;
                            customOpt.selected = true;
                            sizeSel.appendChild(customOpt);
                        }
                    }
                    if (fontSel && fontSel.value !== savedFontKey) {
                        fontSel.value = savedFontKey;
                    }

                    try {
                        localStorage.setItem("modusflow_popout_font_size", String(savedFontSize));
                        localStorage.setItem("modusflow_popout_font_family", savedFontKey);
                    } catch (_) {}
                    fetch("/modusflow/save_config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            popout_font_family: savedFontKey,
                            popout_font_size: savedFontSize
                        })
                    }).catch(() => {});

                    onPosInput();
                    onNegInput();
                }

                fontSel.onchange = () => applyTypography(savedFontSize, fontSel.value);
                sizeSel.onchange = () => applyTypography(parseInt(sizeSel.value, 10) || 14, savedFontKey);
                sizeDecBtn.onclick = (e) => { e.preventDefault(); applyTypography(savedFontSize - 1, savedFontKey); };
                sizeIncBtn.onclick = (e) => { e.preventDefault(); applyTypography(savedFontSize + 1, savedFontKey); };

                sizeGroup.appendChild(sizeDecBtn);
                sizeGroup.appendChild(sizeSel);
                sizeGroup.appendChild(sizeIncBtn);

                toolbar.appendChild(fontSel);
                toolbar.appendChild(sizeGroup);

                const undoBtn = addToolBtn("↩ Undo", "Undo last prompt change (Ctrl+Z)", () => doPopoutUndo());
                const redoBtn = addToolBtn("↪ Redo", "Redo last prompt change (Ctrl+Y / Ctrl+Shift+Z)", () => doPopoutRedo());

                const tagStudioBtn = addToolBtn("🏷 Tag Studio", "Toggle Tag Matrix / Chip Flow", () => togglePopoutTagStudio());
                addToolBtn("🎵 Lyrics", "Song structure sections ([Verse], [Chorus], [Bridge]) and templates", () => showSongLyricsModal(node));
                addToolBtn("🎞 Aesthetic", "Visual Aesthetic Ribbon (Optics, Films, Rigs)", () => showAestheticRibbonModal(node));
                addToolBtn("✍️ Prosify", "Format into fluent natural prose (Flux/SD3)", () => {
                    prosifyPositivePrompt(node);
                    syncFromNode();
                });
                addToolBtn("🏷 Tagify", "Format into weighted tag flow (SDXL/Pony)", () => {
                    tagifyPositivePrompt(node);
                    syncFromNode();
                });
                addToolBtn("⚄ Variations", "Dynamic Choice Permutations Matrix", () => showVariationGridModal(node));
                addToolBtn("✨ Ollama", "Enhance prompt with Ollama LLM", () => {
                    const eb = node.widgets?.find(w => w.name && w.name.includes("Enhance with Ollama"));
                    if (window.event?.shiftKey || !_ollamaAvailable) {
                        showOllamaStatusModal(node, eb);
                    } else {
                        enhancePromptWithOllama(node, eb);
                    }
                });
                addToolBtn("🎨 LoRAs", "Manage active LoRA weights & mute", () => showLoraDeckModal(node));
                addToolBtn("⇄ Swap", "Swap Positive and Negative prompts", () => {
                    swapPositiveNegative(node);
                    syncFromNode();
                });
                addToolBtn("🌈 Spectrum", "Interactive Color Spectrum Picker & Model Pigment Translator", () => showColorPaletteModal(node));
                addToolBtn("✨ Hex->Color", "Translate all hex codes to color names", () => {
                    translateAllHexInNode(node);
                    syncFromNode();
                });
                addToolBtn("🧹 Dedupe", "Prettify spacing and deduplicate tags", () => {
                    prettifyNodePrompts(node);
                    syncFromNode();
                });
                addToolBtn("🔍 Find", "Find & Replace (Ctrl+F)", () => showFindReplaceBar(node));

                addToolBtn("⚙️ Settings", "ModusFlow Studio & AI Settings", () => showModusFlowSettingsModal(node));

                win.appendChild(toolbar);

                // ── Workspace Body (Dual-Pane) ──
                const body = document.createElement("div");
                body.className = "modusflow-popout-body";

                // Left Pane: Positive
                const posPane = document.createElement("div");
                posPane.className = "modusflow-popout-pane";
                posPane.style.flex = "1.5";

                const posHead = document.createElement("div");
                posHead.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #89b4fa; letter-spacing: 0.5px;";
                posHead.innerHTML = `
                    <span>POSITIVE PROMPT</span>
                    <span id="mf-pos-popout-sub" style="font-weight: normal; color: #a6adc8; font-family: ui-monospace, monospace;"></span>
                `;
                posPane.appendChild(posHead);

                const posBox = document.createElement("div");
                posBox.className = "modusflow-popout-editor-box";

                const posBackdrop = document.createElement("div");
                posBackdrop.className = "modusflow-popout-backdrop";
                posBox.appendChild(posBackdrop);

                const posTa = document.createElement("textarea");
                posTa.className = "modusflow-popout-ta";
                posTa.placeholder = "Enter positive prompt, tags, choices {a|b}, wildcards __style__...";
                posTa.value = pw.value || "";
                posBox.appendChild(posTa);

                const posTagStudio = document.createElement("div");
                posTagStudio.className = "modusflow-tag-studio-container";
                posTagStudio.style.display = "none";
                posTagStudio.style.flex = "1";
                posTagStudio.style.height = "100%";
                posTagStudio.style.maxHeight = "none";
                posBox.appendChild(posTagStudio);

                const posWaveform = document.createElement("div");
                posWaveform.className = "modusflow-waveform-strip";
                for (let c = 0; c < 3; c++) {
                    const chunkEl = document.createElement("div");
                    chunkEl.className = "modusflow-waveform-chunk";
                    const fill = document.createElement("div");
                    fill.className = "modusflow-waveform-fill";
                    chunkEl.appendChild(fill);
                    posWaveform.appendChild(chunkEl);
                }
                posBox.appendChild(posWaveform);

                posPane.appendChild(posBox);

                // Right Pane: Negative
                const negPane = document.createElement("div");
                negPane.className = "modusflow-popout-pane";
                negPane.style.flex = "1";

                const negHead = document.createElement("div");
                negHead.style.cssText = "display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #f38ba8; letter-spacing: 0.5px;";
                negHead.innerHTML = `
                    <span>NEGATIVE PROMPT</span>
                    <span id="mf-neg-popout-sub" style="font-weight: normal; color: #a6adc8; font-family: ui-monospace, monospace;"></span>
                `;
                negPane.appendChild(negHead);

                const pedalBar = document.createElement("div");
                pedalBar.className = "modusflow-pedal-bar";
                const pLabel = document.createElement("span");
                pLabel.textContent = "Guards:";
                pLabel.style.cssText = "font-size: 10px; color: #6c7086; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;";
                pedalBar.appendChild(pLabel);

                const pedalBtns = [];
                PEDALBOARD_MODULES.forEach(mod => {
                    const btn = document.createElement("button");
                    btn.className = "modusflow-pedal-btn";
                    btn.textContent = mod.label;
                    btn.title = mod.tooltip;
                    btn.onclick = () => {
                        let cur = (negTa.value || "").trim();
                        const hasTag = cur.toLowerCase().includes(mod.matchTag.toLowerCase());

                        const styleVal = (node.widgets?.find(w => w.name === "prompt_style")?.value || "").toLowerCase();
                        const isExpressions = styleVal.includes("expression");
                        const insertText = isExpressions ? mod.unweightedText : mod.text;

                        if (hasTag) {
                            cur = cur.replace(mod.text, "");
                            cur = cur.replace(mod.unweightedText, "");
                            const escTag = mod.matchTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            cur = cur.replace(new RegExp(`\\([^)]*${escTag}[^)]*\\)`, "gi"), "");
                            cur = cur.replace(/,\s*,+/g, ", ").replace(/^,\s*/, "").replace(/,\s*$/, "").trim();
                            showStudioToast(`Disengaged [${mod.label}] guard`, "info");
                        } else {
                            if (cur && !cur.endsWith(",")) cur += ", ";
                            else if (cur && cur.endsWith(",")) cur += " ";
                            cur += insertText;
                            showStudioToast(`Engaged [${mod.label}] guard${isExpressions ? ' (unweighted)' : ''}`);
                        }
                        negTa.value = cur;
                        onNegInput();
                    };
                    pedalBtns.push({ btn, mod });
                    pedalBar.appendChild(btn);
                });
                negPane.appendChild(pedalBar);

                const negBox = document.createElement("div");
                negBox.className = "modusflow-popout-editor-box";

                const negBackdrop = document.createElement("div");
                negBackdrop.className = "modusflow-popout-backdrop";
                negBox.appendChild(negBackdrop);

                const negTa = document.createElement("textarea");
                negTa.className = "modusflow-popout-ta";
                negTa.placeholder = "Enter negative prompt, unwanted traits...";
                negTa.value = nw.value || "";
                negBox.appendChild(negTa);

                const negWaveform = document.createElement("div");
                negWaveform.className = "modusflow-waveform-strip";
                for (let c = 0; c < 3; c++) {
                    const chunkEl = document.createElement("div");
                    chunkEl.className = "modusflow-waveform-chunk";
                    const fill = document.createElement("div");
                    fill.className = "modusflow-waveform-fill";
                    chunkEl.appendChild(fill);
                    negWaveform.appendChild(chunkEl);
                }
                negBox.appendChild(negWaveform);

                negPane.appendChild(negBox);

                body.appendChild(posPane);
                body.appendChild(negPane);
                win.appendChild(body);

                // ── Event Synchronization ──
                let inPopoutTagStudio = false;
                function togglePopoutTagStudio() {
                    inPopoutTagStudio = !inPopoutTagStudio;
                    tagStudioBtn.innerHTML = inPopoutTagStudio ? "📝 Text Mode" : "🏷 Tag Studio";
                    if (inPopoutTagStudio) {
                        posTa.style.display = "none";
                        posBackdrop.style.display = "none";
                        posTagStudio.style.display = "flex";
                        renderTagStudio(node, posTagStudio, pw);
                    } else {
                        posTa.style.display = "";
                        posBackdrop.style.display = "";
                        posTagStudio.style.display = "none";
                        posTa.value = pw.value || "";
                        onPosInput();
                    }
                }

                function updateWaveform(waveformEl, text) {
                    const chunks = waveformEl.querySelectorAll(".modusflow-waveform-chunk");
                    const tokens = estimateTokens(text || "").tokens;
                    const c1 = Math.min(75, tokens);
                    const c2 = Math.min(75, Math.max(0, tokens - 75));
                    const c3 = Math.min(75, Math.max(0, tokens - 150));
                    const fills = [c1 / 75 * 100, c2 / 75 * 100, c3 / 75 * 100];
                    const hasSpike = /:[1-9]\.[2-9]|\([a-zA-Z0-9_\s]+:[2-9]\)/.test(text || "");

                    chunks.forEach((chunk, i) => {
                        const fill = chunk.querySelector(".modusflow-waveform-fill");
                        if (fill) {
                            fill.style.width = `${fills[i]}%`;
                            if (hasSpike) fill.classList.add("has-spike");
                            else fill.classList.remove("has-spike");
                        }
                    });
                }

                function updatePopoutBackdrops() {
                    const themeName = node._currentSyntaxTheme || "Modus Neon (Default)";
                    const theme = getThemeByName(themeName);
                    const bgColor = theme.bg_color || "#181825";
                    const caretColor = theme.caret_color || "#ffffff";
                    const isOff = (themeName === "Off (Plain Text)");

                    if (isOff) {
                        if (posBackdrop) posBackdrop.style.display = "none";
                        if (negBackdrop) negBackdrop.style.display = "none";
                        if (posTa) {
                            posTa.style.color = "#cdd6f4";
                            posTa.style.backgroundColor = bgColor;
                            posTa.style.caretColor = caretColor;
                        }
                        if (negTa) {
                            negTa.style.color = "#cdd6f4";
                            negTa.style.backgroundColor = bgColor;
                            negTa.style.caretColor = caretColor;
                        }
                    } else {
                        if (posBackdrop) {
                            posBackdrop.style.display = "block";
                            posBackdrop.innerHTML = tokenizeAndHighlight(posTa.value || "", theme);
                            posBackdrop.style.backgroundColor = bgColor;
                        }
                        if (negBackdrop) {
                            negBackdrop.style.display = "block";
                            negBackdrop.innerHTML = tokenizeAndHighlight(negTa.value || "", theme);
                            negBackdrop.style.backgroundColor = bgColor;
                        }
                        if (posTa) {
                            posTa.style.color = "transparent";
                            posTa.style.backgroundColor = "transparent";
                            posTa.style.caretColor = caretColor;
                        }
                        if (negTa) {
                            negTa.style.color = "transparent";
                            negTa.style.backgroundColor = "transparent";
                            negTa.style.caretColor = caretColor;
                        }
                    }

                    if (posBox) posBox.style.backgroundColor = bgColor;
                    if (negBox) negBox.style.backgroundColor = bgColor;
                }

                function onPosInput() {
                    pw.value = posTa.value;
                    if (pw.inputEl) pw.inputEl.value = posTa.value;
                    pw._updateSyntaxHighlight?.();

                    const themeName = node._currentSyntaxTheme || "Modus Neon (Default)";
                    if (themeName !== "Off (Plain Text)") {
                        const theme = getThemeByName(themeName);
                        posBackdrop.innerHTML = tokenizeAndHighlight(posTa.value || "", theme);
                        posBackdrop.scrollTop = posTa.scrollTop;
                        posBackdrop.scrollLeft = posTa.scrollLeft;
                    }

                    const stats = estimateTokens(posTa.value || "");
                    const unclosed = countUnclosedParens(posTa.value || "");
                    let statStr = `Pos: ${stats.words}w · ~${stats.tokens} tok (${stats.chunkProgress}/75 Ch.${stats.currentChunk})`;
                    if (unclosed > 0) statStr += ` · ⚠️ ${unclosed} unclosed`;
                    posStatPill.textContent = statStr;
                    const sub = document.getElementById("mf-pos-popout-sub");
                    if (sub) sub.textContent = `${stats.words} words · ${stats.tokens} tokens`;

                    updateWaveform(posWaveform, posTa.value);
                    app.graph?.setDirtyCanvas(true, true);
                }

                function onNegInput() {
                    nw.value = negTa.value;
                    if (nw.inputEl) nw.inputEl.value = negTa.value;
                    nw._updateSyntaxHighlight?.();

                    const themeName = node._currentSyntaxTheme || "Modus Neon (Default)";
                    if (themeName !== "Off (Plain Text)") {
                        const theme = getThemeByName(themeName);
                        negBackdrop.innerHTML = tokenizeAndHighlight(negTa.value || "", theme);
                        negBackdrop.scrollTop = negTa.scrollTop;
                        negBackdrop.scrollLeft = negTa.scrollLeft;
                    }

                    const stats = estimateTokens(negTa.value || "");
                    negStatPill.textContent = `Neg: ${stats.words}w · ~${stats.tokens} tok`;
                    const sub = document.getElementById("mf-neg-popout-sub");
                    if (sub) sub.textContent = `${stats.words} words · ${stats.tokens} tokens`;

                    const val = (negTa.value || "").toLowerCase();
                    pedalBtns.forEach(({ btn, mod }) => {
                        if (val.includes(mod.matchTag.toLowerCase())) btn.classList.add("active");
                        else btn.classList.remove("active");
                    });

                    updateWaveform(negWaveform, negTa.value);
                    app.graph?.setDirtyCanvas(true, true);
                }

                // ── Popout Studio Undo / Redo History Stack ──
                const MAX_POPOUT_UNDO = 60;
                let popoutUndoStack = [];
                let popoutRedoStack = [];
                let isApplyingPopoutHistory = false;

                function getPopoutState() {
                    return {
                        pos: posTa ? posTa.value : "",
                        neg: negTa ? negTa.value : "",
                        posStart: posTa ? posTa.selectionStart : 0,
                        posEnd: posTa ? posTa.selectionEnd : 0,
                        negStart: negTa ? negTa.selectionStart : 0,
                        negEnd: negTa ? negTa.selectionEnd : 0
                    };
                }

                function updateUndoRedoButtons() {
                    if (undoBtn) {
                        undoBtn.disabled = popoutUndoStack.length <= 1;
                        undoBtn.style.opacity = popoutUndoStack.length <= 1 ? "0.4" : "1";
                    }
                    if (redoBtn) {
                        redoBtn.disabled = popoutRedoStack.length === 0;
                        redoBtn.style.opacity = popoutRedoStack.length === 0 ? "0.4" : "1";
                    }
                }

                function pushPopoutHistory() {
                    if (isApplyingPopoutHistory) return;
                    const current = getPopoutState();
                    if (popoutUndoStack.length > 0) {
                        const top = popoutUndoStack[popoutUndoStack.length - 1];
                        if (top.pos === current.pos && top.neg === current.neg) return;
                    }
                    popoutUndoStack.push(current);
                    if (popoutUndoStack.length > MAX_POPOUT_UNDO) {
                        popoutUndoStack.shift();
                    }
                    popoutRedoStack = [];
                    updateUndoRedoButtons();
                }

                function doPopoutUndo() {
                    if (popoutUndoStack.length <= 1) return;
                    const currentState = popoutUndoStack.pop();
                    popoutRedoStack.push(currentState);
                    const targetState = popoutUndoStack[popoutUndoStack.length - 1];

                    isApplyingPopoutHistory = true;
                    if (posTa) {
                        posTa.value = targetState.pos;
                        posTa.setSelectionRange(targetState.posStart, targetState.posEnd);
                    }
                    if (negTa) {
                        negTa.value = targetState.neg;
                        negTa.setSelectionRange(targetState.negStart, targetState.negEnd);
                    }
                    onPosInput();
                    onNegInput();
                    isApplyingPopoutHistory = false;
                    updateUndoRedoButtons();
                    showStudioToast("↩ Undone");
                }

                function doPopoutRedo() {
                    if (popoutRedoStack.length === 0) return;
                    const nextState = popoutRedoStack.pop();
                    popoutUndoStack.push(nextState);

                    isApplyingPopoutHistory = true;
                    if (posTa) {
                        posTa.value = nextState.pos;
                        posTa.setSelectionRange(nextState.posStart, nextState.posEnd);
                    }
                    if (negTa) {
                        negTa.value = nextState.neg;
                        negTa.setSelectionRange(nextState.negStart, nextState.negEnd);
                    }
                    onPosInput();
                    onNegInput();
                    isApplyingPopoutHistory = false;
                    updateUndoRedoButtons();
                    showStudioToast("↪ Redone");
                }

                node._pushPopoutHistory = pushPopoutHistory;

                let popoutTypeDebounce = null;
                const onTypeWithHistory = () => {
                    clearTimeout(popoutTypeDebounce);
                    popoutTypeDebounce = setTimeout(pushPopoutHistory, 320);
                };

                posTa.addEventListener("input", () => {
                    onPosInput();
                    onTypeWithHistory();
                });
                posTa.addEventListener("scroll", () => {
                    posBackdrop.scrollTop = posTa.scrollTop;
                    posBackdrop.scrollLeft = posTa.scrollLeft;
                });

                negTa.addEventListener("input", () => {
                    onNegInput();
                    onTypeWithHistory();
                });
                negTa.addEventListener("scroll", () => {
                    negBackdrop.scrollTop = negTa.scrollTop;
                    negBackdrop.scrollLeft = negTa.scrollLeft;
                });

                const handleUndoRedoShortcuts = (e) => {
                    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
                    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
                    if (ctrlOrCmd && !e.altKey) {
                        const key = e.key.toLowerCase();
                        if (key === "z" && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            doPopoutUndo();
                            return true;
                        } else if (key === "y" || (key === "z" && e.shiftKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            doPopoutRedo();
                            return true;
                        }
                    }
                    return false;
                };

                posTa.addEventListener("keydown", (e) => {
                    handleUndoRedoShortcuts(e);
                });
                negTa.addEventListener("keydown", (e) => {
                    handleUndoRedoShortcuts(e);
                });

                attachOllamaSelectionContextMenu(posTa, pw, node, onPosInput);
                attachOllamaSelectionContextMenu(negTa, nw, node, onNegInput);

                // Ctrl+MouseWheel font zoom listener
                const handleZoomWheel = (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.deltaY < 0) {
                            applyTypography(savedFontSize + 1, savedFontKey);
                        } else if (e.deltaY > 0) {
                            applyTypography(savedFontSize - 1, savedFontKey);
                        }
                    }
                };
                posTa.addEventListener("wheel", handleZoomWheel, { passive: false });
                negTa.addEventListener("wheel", handleZoomWheel, { passive: false });

                function syncFromNode() {
                    posTa.value = pw.value || "";
                    negTa.value = nw.value || "";
                    const savedName = node.widgets?.find(w => w.name === "saved_prompt")?.value || "Draft";
                    const tagEl = document.getElementById("mf-popout-prompt-tag");
                    if (tagEl) tagEl.textContent = savedName;
                    if (promptSel && savedName && promptSel.value !== savedName) {
                        promptSel.value = savedName;
                    }
                    onPosInput();
                    onNegInput();
                    updatePopoutBackdrops();
                }
                node._popoutSyncFromNode = syncFromNode;

                win.addEventListener("keydown", (e) => {
                    if (handleUndoRedoShortcuts(e)) return;
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        queueBtn.click();
                    } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        showSaveDialog(node);
                    } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        showFindReplaceBar(node);
                    } else if ((e.key === "=" || e.key === "+") && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        applyTypography(savedFontSize + 1, savedFontKey);
                    } else if ((e.key === "-" || e.key === "_") && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        applyTypography(savedFontSize - 1, savedFontKey);
                    } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        applyTypography(14, savedFontKey);
                    } else if (e.key === "Escape" && !win.classList.contains("is-minimized")) {
                        if (document.activeElement !== posTa && document.activeElement !== negTa) {
                            closePopout();
                        }
                    }
                });

                // ── Dragging logic ──
                let isDragging = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let winStartX = 0;
                let winStartY = 0;

                header.addEventListener("mousedown", (e) => {
                    if (e.target.tagName === "BUTTON" || e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
                    if (win.classList.contains("is-maximized")) return;
                    isDragging = true;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    winStartX = win.offsetLeft;
                    winStartY = win.offsetTop;
                    win.style.zIndex = String(++window._popoutZIndex);

                    const onMouseMove = (ev) => {
                        if (!isDragging) return;
                        const dx = ev.clientX - dragStartX;
                        const dy = ev.clientY - dragStartY;
                        win.style.left = `${Math.max(0, winStartX + dx)}px`;
                        win.style.top = `${Math.max(0, winStartY + dy)}px`;
                    };

                    const onMouseUp = () => {
                        isDragging = false;
                        window.removeEventListener("mousemove", onMouseMove);
                        window.removeEventListener("mouseup", onMouseUp);
                        if (!win.classList.contains("is-maximized") && !win.classList.contains("is-minimized")) {
                            node._popoutSavedRect = {
                                top: win.style.top,
                                left: win.style.left,
                                width: win.style.width,
                                height: win.style.height
                            };
                            try {
                                localStorage.setItem("modusflow_popout_geometry", JSON.stringify(node._popoutSavedRect));
                            } catch (_) {}
                        }
                    };

                    window.addEventListener("mousemove", onMouseMove);
                    window.addEventListener("mouseup", onMouseUp);
                });

                function toggleMaximize() {
                    const isMax = win.classList.toggle("is-maximized");
                    maxBtn.innerHTML = isMax ? "🗗" : "⇱";
                    maxBtn.title = isMax ? "Restore Studio size" : "Maximize / Fullscreen Studio";
                    if (!isMax && node._popoutSavedRect) {
                        win.style.top = node._popoutSavedRect.top;
                        win.style.left = node._popoutSavedRect.left;
                        win.style.width = node._popoutSavedRect.width;
                        win.style.height = node._popoutSavedRect.height;
                    }
                    updatePopoutBackdrops();
                }

                function toggleMinimize() {
                    const isMin = win.classList.toggle("is-minimized");
                    if (isMin) {
                        toolbar.style.display = "none";
                        body.style.display = "none";
                        statGroup.style.display = "none";
                        minBtn.innerHTML = "⇱";
                        minBtn.title = "Restore Studio";
                    } else {
                        toolbar.style.display = "flex";
                        body.style.display = "flex";
                        statGroup.style.display = "flex";
                        minBtn.innerHTML = "—";
                        minBtn.title = "Minimize to floating dock";
                        updatePopoutBackdrops();
                    }
                }

                function closePopout() {
                    if (!win.classList.contains("is-maximized") && !win.classList.contains("is-minimized")) {
                        node._popoutSavedRect = {
                            top: win.style.top,
                            left: win.style.left,
                            width: win.style.width,
                            height: win.style.height
                        };
                        try {
                            localStorage.setItem("modusflow_popout_geometry", JSON.stringify(node._popoutSavedRect));
                        } catch (_) {}
                    }
                    node._popoutSyncStyle = null;
                    node._popoutSyncPromptsDropdown = null;
                    node._popoutSyncFromNode = null;
                    win.remove();
                    node._popoutStudioEl = null;
                    pw._updateSyntaxHighlight?.();
                    nw?._updateSyntaxHighlight?.();
                    app.graph?.setDirtyCanvas(true, true);
                    showStudioToast("Docked back to canvas node");
                }

                document.body.appendChild(win);
                applyTypography(savedFontSize, savedFontKey);
                updatePopoutBackdrops();
                onPosInput();
                onNegInput();
                pushPopoutHistory();
                posTa.focus();
                showStudioToast("Prompt Studio popped out! (Drag header to move, 🚀 Queue to run)");
            }
        }
    },

    async setup(app) {
        // Listen for prompt pushes from IDE / Antigravity via WebSocket
        api.addEventListener("modusflow_canvas_push", (e) => {
            const detail = e?.detail || {};
            const targetId = detail.node_id != null ? String(detail.node_id) : null;
            const nodes = app.graph?._nodes || [];
            let targetNode = null;
            if (targetId) {
                targetNode = nodes.find(n => String(n.id) === targetId && n.type === "ModusFlowTextEditor");
            }
            if (!targetNode) {
                if (app.canvas?.selected_nodes) {
                    targetNode = Object.values(app.canvas.selected_nodes).find(n => n?.type === "ModusFlowTextEditor");
                }
                if (!targetNode) {
                    targetNode = nodes.find(n => n.type === "ModusFlowTextEditor");
                }
            }
            if (targetNode) {
                const pw = targetNode.widgets?.find(w => w.name === "positive");
                const nw = targetNode.widgets?.find(w => w.name === "negative");
                const sw = targetNode.widgets?.find(w => w.name === "prompt_style");
                if (detail.positive !== undefined && pw) {
                    pw.value = detail.positive;
                    if (pw.inputEl) pw.inputEl.value = detail.positive;
                    pw._updateSyntaxHighlight?.();
                }
                if (detail.negative !== undefined && nw) {
                    nw.value = detail.negative;
                    if (nw.inputEl) nw.inputEl.value = detail.negative;
                    nw._updateSyntaxHighlight?.();
                }
                if (detail.prompt_style !== undefined && sw) {
                    sw.value = detail.prompt_style;
                }
                if (targetNode._popoutSyncFromNode) {
                    targetNode._popoutSyncFromNode();
                }
                app.graph?.setDirtyCanvas(true, true);
                reportCanvasNode(targetNode, true);
                if (typeof showStudioToast === "function") {
                    showStudioToast(`📥 Prompt received from Antigravity/IDE (Node #${targetNode.id})`);
                }
            }
        });

        // Broadcast active node when graph loads
        setTimeout(() => {
            const firstNode = app.graph?._nodes?.find(n => n.type === "ModusFlowTextEditor");
            if (firstNode) {
                reportCanvasNode(firstNode, true);
            }
        }, 1500);
    }
});