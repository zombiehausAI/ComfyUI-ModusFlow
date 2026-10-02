import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
    name: "ModusFlow.VAEEncode.Widgets",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModusFlowImg2ImgVAEEncode" || nodeData.name === "ModusFlowVAEEncode" || nodeData.name === "ModusFlowLoadImage") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const node = this;
                const imageWidget = node.widgets ? node.widgets.find((w) => w.name === "image_upload" || w.name === "image") : null;
                if (!imageWidget) {
                    return;
                }

                // Create hidden native file input element attached to document
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.accept = "image/*";
                fileInput.style.display = "none";
                document.body.appendChild(fileInput);

                fileInput.addEventListener("change", async () => {
                    if (!fileInput.files || fileInput.files.length === 0) {
                        return;
                    }

                    const file = fileInput.files[0];
                    const formData = new FormData();
                    formData.append("image", file);
                    formData.append("overwrite", "true");

                    try {
                        const resp = await api.fetchApi("/upload/image", {
                            method: "POST",
                            body: formData
                        });

                        if (resp.status === 200) {
                            const data = await resp.json();
                            const filename = data.name;

                            if (!imageWidget.options) {
                                imageWidget.options = { values: [] };
                            }
                            if (!imageWidget.options.values) {
                                imageWidget.options.values = [];
                            }
                            if (!imageWidget.options.values.includes(filename)) {
                                imageWidget.options.values.push(filename);
                            }

                            imageWidget.value = filename;
                            if (imageWidget.callback) {
                                imageWidget.callback(filename);
                            }

                            // Trigger node recalculation and redraw
                            node.setDirtyCanvas(true, true);
                        } else {
                            alert("Failed to upload image. Server returned: " + resp.statusText);
                        }
                    } catch (err) {
                        console.error("[ModusFlow] Image upload error:", err);
                        alert("Error uploading image: " + err);
                    } finally {
                        fileInput.value = "";
                    }
                });

                // Check if ComfyUI already added an upload button
                const hasExistingUploadBtn = node.widgets ? node.widgets.some((w) => w.name && (w.name.toLowerCase().includes("upload") || w.name.toLowerCase().includes("choose"))) : false;

                if (!hasExistingUploadBtn) {
                    const uploadButton = node.addWidget("button", "📁 Upload Image", "upload", () => {
                        fileInput.click();
                    });
                    uploadButton.options = { serialize: false };

                    // Move the button directly beneath the image widget
                    if (node.widgets && imageWidget) {
                        const imgIdx = node.widgets.indexOf(imageWidget);
                        const btnIdx = node.widgets.indexOf(uploadButton);
                        if (imgIdx !== -1 && btnIdx !== -1 && btnIdx !== imgIdx + 1) {
                            node.widgets.splice(btnIdx, 1);
                            node.widgets.splice(imgIdx + 1, 0, uploadButton);
                        }
                    }
                }

                // Ensure node has enough vertical space so widgets and buttons never overlap
                if (node.size && node.size[1] < 680) {
                    node.size[1] = 720;
                }
            };
        }
    }
});
