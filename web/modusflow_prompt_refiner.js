import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

/**
 * ModusFlow Ollama Prompt Refiner & Text Refiner Extensions
 * - Dynamic reloading of Ollama models
 * - Bypass UI toggling
 * - Category-filtered prompt save/load from unified saved_prompts directory
 */
app.registerExtension({
	name: "ModusFlow.OllamaPromptRefiner.Widgets",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		// ── OllamaPromptRefiner ──────────────────────────────────────────────
		if (nodeData.name === "OllamaPromptRefiner") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;

			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated?.apply(this, arguments);
				const node = this;

				const modelWidget       = node.widgets?.find(w => w.name === "ollama_model");
				const textInputWidget   = node.widgets?.find(w => w.name === "text_input");
				const negativeWidget    = node.widgets?.find(w => w.name === "negative_prompt");
				const dropdownWidget    = node.widgets?.find(w => w.name === "saved_prompt");

				// ── Refresh Ollama Models Button ──────────────────────────────
				const refreshCallback = async (button) => {
					const originalName = button.name;
					button.name = "🔄 Refreshing...";
					button.disabled = true;

					try {
						const response = await api.fetchApi("/modusflow/refresh_ollama_models");
						if (response.success && Array.isArray(response.data)) {
							const models = response.data;
							if (modelWidget) {
								modelWidget.options.values = models;
								if (!models.includes(modelWidget.value)) {
									modelWidget.value = models[0] || "";
								}
							}
						} else {
							alert(`Error refreshing Ollama models: ${response.message || 'Unknown error'}`);
						}
					} catch (error) {
						alert("Error refreshing Ollama models. Check console for details.");
					} finally {
						button.name = originalName;
						button.disabled = false;
					}
				};

				const refreshButton = node.addWidget("button", "🔄 Refresh Models", null, refreshCallback);
				refreshButton.options = { serialize: false };

				// ── Prompt Cache & Category Filter ────────────────────────────
				node._allPrompts    = [];
				node._savedCategory = undefined;

				const categoryWidget = node.addWidget(
					"combo",
					"category_filter",
					"--all categories--",
					(v) => applyFilter(node, v),
					{ values: ["--all categories--"] }
				);
				categoryWidget.label = "Category Filter";

				// Place category_filter right above saved_prompt
				if (dropdownWidget) {
					const dropIdx = node.widgets.indexOf(dropdownWidget);
					const catIdx  = node.widgets.indexOf(categoryWidget);
					if (dropIdx >= 0 && catIdx > dropIdx) {
						node.widgets.splice(catIdx, 1);
						node.widgets.splice(dropIdx, 0, categoryWidget);
					}
				}

				// Prompt dropdown load callback
				if (dropdownWidget) {
					dropdownWidget.callback = function(value) {
						if (value && value !== "--select prompt--" && value !== "--no prompts found--") {
							loadPrompt(node, value);
						}
					};
				}

				// Category text entry for saving
				const promptCategoryWidget = node.addWidget(
					"text",
					"prompt_category",
					"Refined",
					() => {},
					{}
				);
				promptCategoryWidget.label = "Prompt Category";

				// Prompt save/update/refresh action buttons
				node.addWidget("button", "💾 Save Prompt",     null, () => showSaveDialog(node));
				node.addWidget("button", "✏️ Update Selected", null, () => updatePrompt(node));
				node.addWidget("button", "🔄 Refresh Prompts",  null, () => refreshPrompts(node));

				// Auto-populate prompts list
				requestAnimationFrame(() => refreshPrompts(node));

				// ── UI Toggling for Bypass ────────────────────────────────────
				const refinerStatusWidget = node.widgets.find(w => w.name === "refiner_status");
				if (refinerStatusWidget) {
					const widgetsToToggle = [
						"mode",
						"ollama_model",
						"refine_mode_system_prompt",
						"generate_mode_system_prompt",
						"pose_reference_system_prompt",
						"temperature",
						"max_tokens",
						"image_usage",
						"🔄 Refresh Models"
					].map(name => node.widgets.find(w => w.name === name)).filter(Boolean);

					const toggleOllamaWidgets = () => {
						const isBypassed = refinerStatusWidget.value === "bypassed";
						widgetsToToggle.forEach(widget => {
							if (!widget.originalType) {
								widget.originalType = widget.type;
							}
							widget.type = isBypassed ? "hidden" : widget.originalType;
						});
						node.computeSize();
						node.setDirtyCanvas(true, true);
					};

					const originalCallback = refinerStatusWidget.callback;
					refinerStatusWidget.callback = function() {
						originalCallback?.apply(this, arguments);
						toggleOllamaWidgets();
					};

					setTimeout(toggleOllamaWidgets, 0);
				}

				// --- Sync Widget Values on Load ---
				const syncWidgetValues = () => {
					node.widgets.forEach(widget => {
						if (widget.inputEl && widget.inputEl.value !== widget.value) {
							widget.inputEl.value = widget.value;
						}
					});
				};
				setTimeout(syncWidgetValues, 0);

				// --- UI Toggling for Latent Input ---
				const latentInput = node.inputs.find(i => i.name === "latent");
				const widthWidget = node.widgets.find(w => w.name === "width");
				const heightWidget = node.widgets.find(w => w.name === "height");
				const useImageDimWidget = node.widgets.find(w => w.name === "use_image_dimensions");

				this.updateLatentWidgetState = () => {
					const isConnected = latentInput && (latentInput.link !== null && latentInput.link !== undefined);
					const widgets = [widthWidget, heightWidget, useImageDimWidget].filter(Boolean);
					widgets.forEach(widget => {
						if (widget.inputEl) {
							widget.inputEl.disabled = isConnected;
							widget.inputEl.style.opacity = isConnected ? 0.5 : 1.0;
						}
					});
				};

				setTimeout(() => this.updateLatentWidgetState(), 0);
			};

			const onConnectionsChange = nodeType.prototype.onConnectionsChange;
			nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
				onConnectionsChange?.apply(this, arguments);
				if (this.updateLatentWidgetState) {
					this.updateLatentWidgetState();
				}
			};

			// Helper functions for OllamaPromptRefiner
			function setWidgetValue(widget, value) {
				if (!widget) return;
				widget.value = value;
				if (widget.inputEl) widget.inputEl.value = value;
			}

			function loadPrompt(node, filename) {
				fetch("/modusflow/load_prompt", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ filename })
				})
				.then(r => r.json())
				.then(data => {
					if (data.success && data.data) {
						setWidgetValue(node.widgets?.find(w => w.name === "text_input"), data.data.positive || "");
						setWidgetValue(node.widgets?.find(w => w.name === "negative_prompt"), data.data.negative || "");
						setWidgetValue(node.widgets?.find(w => w.name === "prompt_category"), data.data.category || "");
						app.graph.setDirtyCanvas(true, true);
					} else {
						console.error("[ModusFlow PromptRefiner] Load error:", data.message);
					}
				})
				.catch(err => console.error("[ModusFlow PromptRefiner] Load error:", err.message));
			}

			function applyFilter(node, category) {
				const dw = node.widgets?.find(w => w.name === "saved_prompt");
				if (!dw) return;
				const all = node._allPrompts || [];
				const filenames = (!category || category === "--all categories--")
					? all.map(p => p.filename)
					: all.filter(p => (p.category || "") === category).map(p => p.filename);

				dw.options.values = filenames.length
					? ["--select prompt--", ...filenames]
					: ["--no prompts found--"];

				if (!dw.options.values.includes(dw.value)) {
					dw.value = dw.options.values[0];
				}
				app.graph.setDirtyCanvas(true, true);
			}

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
						applyFilter(node, cw ? cw.value : "--all categories--");
					})
					.catch(err => console.error("[ModusFlow PromptRefiner] Refresh error:", err.message));
			}

			function showSaveDialog(node) {
				const pw  = node.widgets?.find(w => w.name === "text_input");
				const nw  = node.widgets?.find(w => w.name === "negative_prompt");
				const pcw = node.widgets?.find(w => w.name === "prompt_category");
				if (!pw) return;

				const filename = prompt("Filename (without extension):");
				if (!filename?.trim()) return;
				const category = (pcw?.value || "").trim() || "Refined";

				fetch("/modusflow/save_prompt", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filename: filename.trim(),
						category: category,
						positive: pw.value || "",
						negative: nw?.value || ""
					})
				})
				.then(r => r.json())
				.then(data => {
					if (data.success) {
						alert("Saved: " + filename.trim() + ".json");
						refreshPrompts(node);
					} else {
						alert("Save failed: " + data.message);
					}
				})
				.catch(err => alert("Save error: " + err.message));
			}

			function updatePrompt(node) {
				const pw  = node.widgets?.find(w => w.name === "text_input");
				const nw  = node.widgets?.find(w => w.name === "negative_prompt");
				const dw  = node.widgets?.find(w => w.name === "saved_prompt");
				const pcw = node.widgets?.find(w => w.name === "prompt_category");

				const selected = dw?.value;
				if (!selected || selected === "--select prompt--" || selected === "--no prompts found--") {
					alert("Select a saved prompt from the dropdown first.");
					return;
				}
				if (!confirm('Overwrite "' + selected + '" with current text?')) return;

				const base = selected.replace(/\.json$/i, "");
				const category = (pcw?.value || "").trim() || "Refined";

				fetch("/modusflow/save_prompt", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						filename: base,
						category: category,
						positive: pw?.value || "",
						negative: nw?.value || ""
					})
				})
				.then(r => r.json())
				.then(data => {
					if (data.success) alert('"' + selected + '" updated.');
					else alert("Update failed: " + data.message);
				})
				.catch(err => alert("Update error: " + err.message));
			}
		}

		// ── OllamaTextRefiner ────────────────────────────────────────────────
		if (nodeData.name === "OllamaTextRefiner") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated?.apply(this, arguments);
				const node = this;

				const textWidget     = node.widgets?.find(w => w.name === "text");
				const dropdownWidget = node.widgets?.find(w => w.name === "saved_prompt");

				node._allPrompts    = [];
				node._savedCategory = undefined;

				const categoryWidget = node.addWidget(
					"combo",
					"category_filter",
					"--all categories--",
					(v) => applyTextFilter(node, v),
					{ values: ["--all categories--"] }
				);
				categoryWidget.label = "Category Filter";

				if (dropdownWidget) {
					const dropIdx = node.widgets.indexOf(dropdownWidget);
					const catIdx  = node.widgets.indexOf(categoryWidget);
					if (dropIdx >= 0 && catIdx > dropIdx) {
						node.widgets.splice(catIdx, 1);
						node.widgets.splice(dropIdx, 0, categoryWidget);
					}
				}

				if (dropdownWidget) {
					dropdownWidget.callback = function(value) {
						if (value && value !== "--select prompt--" && value !== "--no prompts found--") {
							fetch("/modusflow/load_prompt", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ filename: value })
							})
							.then(r => r.json())
							.then(data => {
								if (data.success && data.data) {
									const t = data.data.positive || data.data.text || "";
									if (textWidget) {
										textWidget.value = t;
										if (textWidget.inputEl) textWidget.inputEl.value = t;
										app.graph.setDirtyCanvas(true, true);
									}
								}
							});
						}
					};
				}

				node.addWidget("button", "💾 Save Text", null, () => {
					if (!textWidget) return;
					const filename = prompt("Filename (without extension):");
					if (!filename?.trim()) return;

					fetch("/modusflow/save_prompt", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							filename: filename.trim(),
							category: "Refined",
							positive: textWidget.value || "",
							negative: ""
						})
					})
					.then(r => r.json())
					.then(data => {
						if (data.success) {
							alert("Saved: " + filename.trim() + ".json");
							refreshTextPrompts(node);
						} else {
							alert("Save failed: " + data.message);
						}
					});
				});

				node.addWidget("button", "🔄 Refresh Prompts", null, () => refreshTextPrompts(node));

				function applyTextFilter(n, category) {
					const dw = n.widgets?.find(w => w.name === "saved_prompt");
					if (!dw) return;
					const all = n._allPrompts || [];
					const filenames = (!category || category === "--all categories--")
						? all.map(p => p.filename)
						: all.filter(p => (p.category || "") === category).map(p => p.filename);

					dw.options.values = filenames.length
						? ["--select prompt--", ...filenames]
						: ["--no prompts found--"];

					if (!dw.options.values.includes(dw.value)) {
						dw.value = dw.options.values[0];
					}
					app.graph.setDirtyCanvas(true, true);
				}

				function refreshTextPrompts(n) {
					const dw = n.widgets?.find(w => w.name === "saved_prompt");
					const cw = n.widgets?.find(w => w.name === "category_filter");
					if (!dw) return;

					fetch("/modusflow/list_prompts")
						.then(r => r.json())
						.then(data => {
							if (!data.success) return;
							n._allPrompts = data.data;

							const cats = [...new Set(
								data.data.map(p => (p.category || "").trim()).filter(Boolean)
							)].sort();

							if (cw) {
								cw.options.values = ["--all categories--", ...cats];
								cw.value = cw.options.values.includes(cw.value) ? cw.value : "--all categories--";
							}
							applyTextFilter(n, cw ? cw.value : "--all categories--");
						});
				}

				requestAnimationFrame(() => refreshTextPrompts(node));
			};
		}

		// Inject CSS to make all textareas resizable
		if (!document.getElementById('modusflow-resize-textarea-style')) {
			const style = document.createElement('style');
			style.id = 'modusflow-resize-textarea-style';
			style.innerHTML = `
				textarea {
					resize: both !important;
					min-height: 40px;
					min-width: 120px;
				}
			`;
			document.head.appendChild(style);
		}
	},
});