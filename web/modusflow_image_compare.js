import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ModusFlow Image Compare — Interactive on-canvas A/B split slider with real-time mouse dragging
app.registerExtension({
    name: "modusflow.CompareImages",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowCompareImages") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                // Configure node sizing
                node.size = [460, 480];
                node.resizable = true;

                // Cache widgets
                const splitPercentWidget = node.widgets?.find(w => w.name === "split_percent");
                const splitDirectionWidget = node.widgets?.find(w => w.name === "split_direction");
                const showDividerWidget = node.widgets?.find(w => w.name === "show_divider");

                // Main interactive comparison container
                const container = document.createElement("div");
                container.className = "modusflow-compare-container";
                container.style.cssText = `
                    position: relative;
                    width: 100%;
                    height: 320px;
                    background: #11111b;
                    border: 1px solid #313244;
                    border-radius: 8px;
                    overflow: hidden;
                    user-select: none;
                    touch-action: none;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: ew-resize;
                `;

                // Empty state placeholder
                const emptyState = document.createElement("div");
                emptyState.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: #6c7086;
                    font-size: 13px;
                    font-family: sans-serif;
                    pointer-events: none;
                    text-align: center;
                    padding: 20px;
                `;
                emptyState.innerHTML = `
                    <div style="font-size: 32px; opacity: 0.6;">🖼️ ↔ 🖼️</div>
                    <div style="font-weight: bold; color: #a6adc8;">ModusFlow A/B Image Compare</div>
                    <div style="font-size: 11px; color: #585b70;">Connect Image A (Before) and Image B (After), then queue to compare.</div>
                `;
                container.appendChild(emptyState);

                // Image B (After / Base layer)
                const imgB = document.createElement("img");
                imgB.style.cssText = `
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    pointer-events: none;
                    display: none;
                `;
                container.appendChild(imgB);

                // Image A (Before / Overlaid layer with clip-path)
                const imgA = document.createElement("img");
                imgA.style.cssText = `
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    pointer-events: none;
                    display: none;
                `;
                container.appendChild(imgA);

                // Divider line
                const divider = document.createElement("div");
                divider.className = "modusflow-compare-divider";
                divider.style.cssText = `
                    position: absolute;
                    background: #ffffff;
                    box-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 2px rgba(255,255,255,0.8);
                    pointer-events: none;
                    z-index: 10;
                    display: none;
                `;

                // Handle grip button
                const handle = document.createElement("div");
                handle.className = "modusflow-compare-handle";
                handle.style.cssText = `
                    position: absolute;
                    width: 28px;
                    height: 28px;
                    background: #ffffff;
                    border: 2px solid #11111b;
                    border-radius: 50%;
                    color: #11111b;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: bold;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.6);
                    pointer-events: none;
                    z-index: 11;
                `;
                divider.appendChild(handle);
                container.appendChild(divider);

                // Badge A (Top Left: BEFORE)
                const badgeA = document.createElement("div");
                badgeA.textContent = "BEFORE (A)";
                badgeA.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(17, 17, 27, 0.75);
                    border: 1px solid rgba(137, 180, 250, 0.4);
                    color: #89b4fa;
                    font-size: 10px;
                    font-weight: bold;
                    font-family: sans-serif;
                    padding: 3px 8px;
                    border-radius: 4px;
                    backdrop-filter: blur(4px);
                    pointer-events: none;
                    z-index: 12;
                    display: none;
                `;
                container.appendChild(badgeA);

                // Badge B (Top Right: AFTER)
                const badgeB = document.createElement("div");
                badgeB.textContent = "AFTER (B)";
                badgeB.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(17, 17, 27, 0.75);
                    border: 1px solid rgba(166, 227, 161, 0.4);
                    color: #a6e3a1;
                    font-size: 10px;
                    font-weight: bold;
                    font-family: sans-serif;
                    padding: 3px 8px;
                    border-radius: 4px;
                    backdrop-filter: blur(4px);
                    pointer-events: none;
                    z-index: 12;
                    display: none;
                `;
                container.appendChild(badgeB);

                // Percentage indicator (Bottom center)
                const badgePercent = document.createElement("div");
                badgePercent.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    background: rgba(17, 17, 27, 0.75);
                    border: 1px solid #313244;
                    color: #cdd6f4;
                    font-size: 10px;
                    font-family: monospace;
                    padding: 2px 6px;
                    border-radius: 4px;
                    backdrop-filter: blur(4px);
                    pointer-events: none;
                    z-index: 12;
                    display: none;
                `;
                container.appendChild(badgePercent);

                // Helper to update split presentation
                function updateSplitView(percent, isVertical, showDivider) {
                    const clamped = Math.max(0.0, Math.min(100.0, parseFloat(percent) || 50.0));
                    badgePercent.textContent = `${Math.round(clamped)}%`;

                    if (isVertical) {
                        container.style.cursor = "ew-resize";
                        imgA.style.clipPath = `polygon(0 0, ${clamped}% 0, ${clamped}% 100%, 0 100%)`;

                        divider.style.top = "0";
                        divider.style.bottom = "0";
                        divider.style.left = `${clamped}%`;
                        divider.style.right = "auto";
                        divider.style.width = "2px";
                        divider.style.height = "100%";

                        handle.textContent = "⟷";
                        handle.style.left = "0";
                        handle.style.top = "50%";
                        handle.style.transform = "translate(-50%, -50%)";
                    } else {
                        container.style.cursor = "ns-resize";
                        imgA.style.clipPath = `polygon(0 0, 100% 0, 100% ${clamped}%, 0 ${clamped}%)`;

                        divider.style.left = "0";
                        divider.style.right = "0";
                        divider.style.top = `${clamped}%`;
                        divider.style.bottom = "auto";
                        divider.style.height = "2px";
                        divider.style.width = "100%";

                        handle.textContent = "⥯";
                        handle.style.left = "50%";
                        handle.style.top = "0";
                        handle.style.transform = "translate(-50%, -50%)";
                    }

                    divider.style.display = showDivider ? "block" : "none";
                }

                // Interactive dragging state
                let isDragging = false;

                function getSplitFromEvent(e) {
                    const rect = container.getBoundingClientRect();
                    const isVertical = !splitDirectionWidget?.value?.startsWith("Horizontal");
                    if (isVertical) {
                        const x = e.clientX - rect.left;
                        return Math.max(0, Math.min(100, (x / rect.width) * 100));
                    } else {
                        const y = e.clientY - rect.top;
                        return Math.max(0, Math.min(100, (y / rect.height) * 100));
                    }
                }

                container.addEventListener("pointerdown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isDragging = true;
                    container.setPointerCapture(e.pointerId);

                    const newPercent = getSplitFromEvent(e);
                    if (splitPercentWidget) {
                        splitPercentWidget.value = Math.round(newPercent);
                    }
                    const isVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                    const showDiv = showDividerWidget?.value ?? true;
                    updateSplitView(newPercent, isVert, showDiv);
                });

                container.addEventListener("pointermove", (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const newPercent = getSplitFromEvent(e);
                    if (splitPercentWidget) {
                        splitPercentWidget.value = Math.round(newPercent);
                    }
                    const isVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                    const showDiv = showDividerWidget?.value ?? true;
                    updateSplitView(newPercent, isVert, showDiv);
                });

                const endDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    try { container.releasePointerCapture(e.pointerId); } catch (_) {}

                    const newPercent = getSplitFromEvent(e);
                    if (splitPercentWidget) {
                        splitPercentWidget.value = Math.round(newPercent);
                        splitPercentWidget.callback?.(splitPercentWidget.value);
                    }
                    app.graph.setDirtyCanvas(true, true);
                };

                container.addEventListener("pointerup", endDrag);
                container.addEventListener("pointercancel", endDrag);

                // Listen for changes on Python slider widget
                if (splitPercentWidget) {
                    const origCallback = splitPercentWidget.callback;
                    splitPercentWidget.callback = function (v) {
                        origCallback?.apply(this, arguments);
                        const isVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                        const showDiv = showDividerWidget?.value ?? true;
                        updateSplitView(v, isVert, showDiv);
                    };
                }

                if (splitDirectionWidget) {
                    const origDirCallback = splitDirectionWidget.callback;
                    splitDirectionWidget.callback = function (v) {
                        origDirCallback?.apply(this, arguments);
                        const percent = splitPercentWidget?.value ?? 50;
                        const isVert = !v?.startsWith("Horizontal");
                        const showDiv = showDividerWidget?.value ?? true;
                        updateSplitView(percent, isVert, showDiv);
                    };
                }

                if (showDividerWidget) {
                    const origDivCallback = showDividerWidget.callback;
                    showDividerWidget.callback = function (v) {
                        origDivCallback?.apply(this, arguments);
                        const percent = splitPercentWidget?.value ?? 50;
                        const isVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                        updateSplitView(percent, isVert, v);
                    };
                }

                // Register DOM widget with LiteGraph
                node.addDOMWidget("compare_preview", "customcanvas", container, {
                    serialize: false,
                    computeSize(width) {
                        const h = Math.max(240, node.size[1] - 150);
                        container.style.height = `${h}px`;
                        return [width, h];
                    }
                });

                // Helper to build URL from ComfyUI temp/output image descriptor
                function buildImageUrl(imgInfo) {
                    if (!imgInfo) return "";
                    const fn = encodeURIComponent(imgInfo.filename || "");
                    const sf = encodeURIComponent(imgInfo.subfolder || "");
                    const ty = encodeURIComponent(imgInfo.type || "temp");
                    const path = `/view?filename=${fn}&subfolder=${sf}&type=${ty}`;
                    return api?.apiURL ? api.apiURL(path) : path;
                }

                // Node state update with received images
                node.setComparisonImages = function (srcA, srcB) {
                    if (!srcA && !srcB) return;
                    imgA.src = srcA || srcB;
                    imgB.src = srcB || srcA;
                    imgA.style.display = "block";
                    imgB.style.display = "block";
                    emptyState.style.display = "none";
                    badgeA.style.display = "block";
                    badgeB.style.display = "block";
                    badgePercent.style.display = "block";

                    const percent = splitPercentWidget?.value ?? 50;
                    const isVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                    const showDiv = showDividerWidget?.value ?? true;
                    updateSplitView(percent, isVert, showDiv);
                };

                // Initialize split line with default or current widget value
                const initPercent = splitPercentWidget?.value ?? 50;
                const initVert = !splitDirectionWidget?.value?.startsWith("Horizontal");
                const initShowDiv = showDividerWidget?.value ?? true;
                updateSplitView(initPercent, initVert, initShowDiv);

                return r;
            };

            // ── onExecuted ────────────────────────────────────────────────────────
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                // Extract image A and image B from custom or standard payload
                const imgAData = message?.images_a?.[0] || message?.images?.[0];
                const imgBData = message?.images_b?.[0] || message?.images?.[1] || message?.images?.[0];

                if (imgAData || imgBData) {
                    const fnA = encodeURIComponent(imgAData?.filename || "");
                    const sfA = encodeURIComponent(imgAData?.subfolder || "");
                    const tyA = encodeURIComponent(imgAData?.type || "temp");
                    const urlA = api?.apiURL ? api.apiURL(`/view?filename=${fnA}&subfolder=${sfA}&type=${tyA}`) : `/view?filename=${fnA}&subfolder=${sfA}&type=${tyA}`;

                    const fnB = encodeURIComponent(imgBData?.filename || "");
                    const sfB = encodeURIComponent(imgBData?.subfolder || "");
                    const tyB = encodeURIComponent(imgBData?.type || "temp");
                    const urlB = api?.apiURL ? api.apiURL(`/view?filename=${fnB}&subfolder=${sfB}&type=${tyB}`) : `/view?filename=${fnB}&subfolder=${sfB}&type=${tyB}`;

                    this.setComparisonImages?.(urlA, urlB);
                }

                // Prevent LiteGraph default background drawing from duplicating the static preview image
                this.imgs = null;
                app.graph.setDirtyCanvas(true, true);
            };

            // ── onResize ──────────────────────────────────────────────────────────
            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function (size) {
                const r = onResize ? onResize.apply(this, arguments) : undefined;
                const widget = this.widgets?.find(w => w.name === "compare_preview");
                if (widget && widget.element) {
                    const h = Math.max(200, size[1] - 150);
                    widget.element.style.height = `${h}px`;
                }
                return r;
            };
        }
    }
});
