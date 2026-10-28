/**
 * ===============================================================================
 * Extension: Easy Styles Selector
 * File: easy_styles_selector.js
 * Version: 3.3.10
 * Description: Frontend canvas UI extension for 'Easy Styles Selector' node with live weight preview updates.
 * ===============================================================================
 */

import { app } from "/scripts/app.js";

app.registerExtension({
    name: "agi.CustomStylesSelector.Extension",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CustomStylesSelector") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);

                const node = this;
                node.previewImage = null;
                node.previewImageLoaded = false;
                node.debugStatus = "Initializing...";
                node.attemptedPath = "";

                node.activeThumbnailFile = "";
                node.expectedThumbnailFile = "";

                let thumbWidget = node.widgets?.find(w => w.name === "thumbnail_path");
                if (!thumbWidget) {
                    thumbWidget = node.addWidget("text", "thumbnail_path", "none.png", () => {}, { serialize: true });
                }
                if (thumbWidget) {
                    thumbWidget.type = "hidden";
                    thumbWidget.computeSize = () => [0, -4];
                    thumbWidget.draw = () => {};
                }

                node.currentStyleName = "None";
                node.currentPositiveText = "";
                node.currentNegativeText = "";
                node.detectedLoraNames = [];

                node.currentCommentText = "";
                node.currentSeedValue = "None";
                node.currentSourceFile = "None";
                node.currentThumbnailFile = "None";
                node.seedCopyFeedback = false;

                node.isHoveringThumb = false;
                node.mousePos = [0, 0];

                node.size = [350, 385]; // Restored original height since widget is hidden

                const tooltipsMap = {
                    "select_category": "Filter styles by category grouping.",
                    "select_style": "Select a style preset from the available JSON configurations.",
                    "version": "Select a specific variation or model version of the active style.",
                    "lora_strength": "Multiplier applied to LoRa and dependency weights inside the prompt.",
                    "remove_dependencies": "If enabled, strips out all <lora:...> tags and embedding references from the output."
                };

                if (node.widgets) {
                    node.widgets.forEach(w => {
                        if (tooltipsMap[w.name]) {
                            w.tooltip = tooltipsMap[w.name];
                            if (!w.options) w.options = {};
                            w.options.tooltip = tooltipsMap[w.name];
                        }
                    });
                }

                function syncStylesData() {
                    let stylesArray = [];
                    try {
                        const rawInventory = nodeData.input?.hidden?.styles_inventory?.[1]?.default;
                        if (rawInventory) {
                            stylesArray = JSON.parse(rawInventory);
                        } else {
                            const hiddenWidget = node.widgets?.find(w => w.name === "styles_inventory");
                            if (hiddenWidget && hiddenWidget.value) {
                                stylesArray = JSON.parse(hiddenWidget.value);
                            }
                        }
                    } catch(e) {
                        console.error("[Styles Selector v3 Backend Sync Error]", e);
                    }

                    const categoryWidget = node.widgets?.find(w => w.name === "select_category");
                    const styleWidget = node.widgets?.find(w => w.name === "select_style");
                    const versionWidget = node.widgets?.find(w => w.name === "version");
                    const loraStrengthWidget = node.widgets?.find(w => w.name === "lora_strength");
                    const thumbnailsDirWidget = node.widgets?.find(w => w.name === "thumbnails_dir");
                    const thumbnailPathWidget = node.widgets?.find(w => w.name === "thumbnail_path");
                    const thumbnailsDir = thumbnailsDirWidget ? thumbnailsDirWidget.value : "";

                    if (!categoryWidget || !styleWidget) return;

                    const filterStylesByCategory = () => {
                        const currentCategory = categoryWidget.value;
                        const filtered = stylesArray.filter(item => item.category === currentCategory);
                        styleWidget.options.values = filtered.length > 0 ? filtered.map(item => item.name) : ["None"];
                        if (!styleWidget.options.values.includes(styleWidget.value)) {
                            styleWidget.value = styleWidget.options.values[0];
                        }
                        updateVersionDropdown();
                    };

                    const updateVersionDropdown = () => {
                        const selectedValue = styleWidget.value;
                        const styleConfig = stylesArray.find(item => item.name === selectedValue);

                        if (versionWidget) {
                            if (!versionWidget.options) versionWidget.options = {};
                            let availableVersions = ["default"];
                            if (styleConfig && styleConfig.version && typeof styleConfig.version === "object") {
                                Object.keys(styleConfig.version).forEach(vKey => {
                                    if (!availableVersions.includes(vKey)) availableVersions.push(vKey);
                                });
                            }
                            versionWidget.options.values = availableVersions;
                            if (!versionWidget.options.values.includes(versionWidget.value)) {
                                versionWidget.value = "default";
                            }
                        }
                        updateCanvasThumbnail();
                    };

                    const updateCanvasThumbnail = () => {
                        if (!stylesArray || stylesArray.length === 0) return;

                        const selectedValue = styleWidget.value;
                        node.currentStyleName = selectedValue;
                        const styleConfig = stylesArray.find(item => item.name === selectedValue);

                        if (!styleConfig) {
                            node.previewImage = null;
                            node.previewImageLoaded = false;
                            node.activeThumbnailFile = "";
                            node.expectedThumbnailFile = "";
                            node.currentPositiveText = "";
                            node.currentNegativeText = "";
                            node.currentCommentText = "";
                            node.currentSeedValue = "None";
                            node.currentSourceFile = "None";
                            node.currentThumbnailFile = "None";
                            node.detectedLoraNames = [];

                            if (thumbnailPathWidget) {
                                thumbnailPathWidget.value = thumbnailsDir ? `${thumbnailsDir}/none.png` : "none.png";
                            }
                            app.canvas.setDirty(true, true);
                            return;
                        }

                        const loraStrengthVal = loraStrengthWidget ? (parseFloat(loraStrengthWidget.value) || 1.0) : 1.0;

                        const processFrontendLoraWeights = (text, weightVal) => {
                            if (!text) return "";
                            return text.replace(/<lora:([^>]+)>/g, (match, innerContent) => {
                                if (innerContent.includes("{weight}")) {
                                    const formattedWeight = weightVal.toFixed(2);
                                    const replacedContent = innerContent.replace(/{weight}/g, formattedWeight);
                                    const parts = replacedContent.split(":");
                                    const processedParts = [parts[0]];
                                    const origParts = innerContent.split(":");

                                    for (let idx = 1; idx < parts.length; idx++) {
                                        if (idx < origParts.length && origParts[idx] === "{weight}") {
                                            processedParts.push(parts[idx]);
                                        } else {
                                            const num = parseFloat(parts[idx]);
                                            processedParts.push(!isNaN(num) ? (num * weightVal).toFixed(2) : parts[idx]);
                                        }
                                    }
                                    return `<lora:${processedParts.join(":")}>`;
                                }

                                const parts = innerContent.split(":");
                                if (parts.length >= 2) {
                                    const processedParts = [parts[0]];
                                    for (let idx = 1; idx < parts.length; idx++) {
                                        const num = parseFloat(parts[idx]);
                                        processedParts.push(!isNaN(num) ? (num * weightVal).toFixed(2) : parts[idx]);
                                    }
                                    return `<lora:${processedParts.join(":")}>`;
                                }

                                return match;
                            });
                        };

                        const cleanUIString = (str) => {
                            if (!str) return "";
                            let cleaned = String(str).replace(/{prompt}/g, "").replace(/{kw_str}/g, "").replace(/{weight}/g, loraStrengthVal.toFixed(2));
                            cleaned = processFrontendLoraWeights(cleaned, loraStrengthVal);
                            cleaned = cleaned.replace(/,(?:\s*,)+/g, ",");
                            return cleaned.trim().replace(/^,|,$/g, "").trim();
                        };

                        let activePrompt = styleConfig.prompt;
                        const selectedVer = versionWidget ? (versionWidget.value || "default") : "default";
                        if (selectedVer !== "default" && styleConfig.version && styleConfig.version[selectedVer]) {
                            activePrompt = styleConfig.version[selectedVer];
                        }

                        node.currentPositiveText = cleanUIString(activePrompt);
                        node.currentNegativeText = cleanUIString(styleConfig.negative_prompt);
                        node.currentSourceFile = styleConfig.file_name || "Unknown.json";
                        node.currentThumbnailFile = styleConfig.thumbnail || "[None Specified]";

                        let formattedParams = "";
                        if (styleConfig.params && typeof styleConfig.params === 'object') {
                            const p = styleConfig.params;
                            let parts = [];

                            Object.entries(p).forEach(([key, value]) => {
                                if (key !== "seed" && value !== undefined && value !== null) {
                                    parts.push(`${key}:${value}`);
                                }
                            });

                            formattedParams = parts.join(",");
                        }

                        let targetSeed = styleConfig.seed;
                        if (targetSeed === undefined || targetSeed === null || targetSeed === "") {
                            targetSeed = styleConfig.params?.seed;
                        }
                        node.currentSeedValue = (targetSeed !== undefined && targetSeed !== null && targetSeed !== "") ? String(targetSeed) : "None";

                        node.detectedLoraNames = [];
                        const rawCombinedText = `${activePrompt || ""} ${styleConfig.negative_prompt || ""}`;
                        const loraRegex = /<lora:([^:]+)(?::[^>]+)?>/g;
                        const embedRegex = /[^a-zA-Z0-9_-]?embedding:([a-zA-Z0-9_.-]+)/g;
                        let match;
                        while ((match = loraRegex.exec(rawCombinedText)) !== null) {
                            if (match[1]) node.detectedLoraNames.push({ type: "lora", text: `LoRa: ${match[1]}` });
                        }
                        while ((match = embedRegex.exec(rawCombinedText)) !== null) {
                            if (match[1]) node.detectedLoraNames.push({ type: "embed", text: `Emb: ${match[1]}` });
                        }

                        let requiredFileName = "none.png";
                        if (styleConfig.thumbnail) {
                            const baseThumb = styleConfig.thumbnail;
                            let cleanVer = "";
                            if (versionWidget && versionWidget.options && versionWidget.options.values) {
                                const vIndex = versionWidget.options.values.indexOf(selectedVer);
                                if (vIndex > 0) {
                                    cleanVer = `v${vIndex}`;
                                }
                            }
                            let baseName = baseThumb;
                            let ext = "";
                            const lastDotIdx = baseThumb.lastIndexOf(".");
                            if (lastDotIdx !== -1) {
                                baseName = baseThumb.substring(0, lastDotIdx);
                                ext = baseThumb.substring(lastDotIdx);
                            }
                            requiredFileName = cleanVer ? `${baseName}_${cleanVer}${ext}` : baseThumb;
                        }

                        node.expectedThumbnailFile = requiredFileName;
                        if (thumbnailPathWidget) {
                            thumbnailPathWidget.value = thumbnailsDir ? `${thumbnailsDir}/${requiredFileName}` : requiredFileName;
                        }

                        if (styleConfig.name && styleConfig.name.includes("⚠️ ERROR IN")) {
                            node.previewImage = null;
                            node.previewImageLoaded = false;
                            node.activeThumbnailFile = "";
                            node.debugStatus = "JSON Syntax Error Block";
                            node.attemptedPath = "";
                            node.currentCommentText = styleConfig.comment || "None";
                            app.canvas.setDirty(true, true);
                            return;
                        }

                        const tryNoneFallback = (attemptedFileName) => {
                            const nonePath = `/agi_styles_thumbnails/none.png`;
                            const noneImg = new Image();
                            noneImg.src = `${nonePath}?t=${Date.now()}`;
                            noneImg.onload = () => {
                                node.previewImage = noneImg;
                                node.previewImageLoaded = true;
                                node.activeThumbnailFile = "none.png (Fallback)";
                                let baseComment = styleConfig.comment || "";
                                node.currentCommentText = formattedParams
                                    ? (baseComment ? `${baseComment}|${formattedParams}` : formattedParams)
                                    : (baseComment || "None");
                                app.canvas.setDirty(true, true);
                            };
                            noneImg.onerror = () => {
                                node.previewImage = null;
                                node.previewImageLoaded = false;
                                node.activeThumbnailFile = "None (404 Missing)";
                                node.debugStatus = "Image 404 Missing";
                                node.currentCommentText = `[ERR: Missing Thumbnail File] Place image here: easy_styles/thumbnails/${attemptedFileName || "none.png"}`;
                                app.canvas.setDirty(true, true);
                            };
                        };

                        if (styleConfig.thumbnail) {
                            const candidateThumbnails = [node.expectedThumbnailFile, styleConfig.thumbnail];

                            const loadThumbnailCascade = (index) => {
                                if (index >= candidateThumbnails.length) {
                                    tryNoneFallback(candidateThumbnails[0]);
                                    return;
                                }

                                const targetFile = candidateThumbnails[index];
                                const primaryPath = `/agi_styles_thumbnails/${targetFile}`;
                                node.attemptedPath = primaryPath;

                                const img = new Image();
                                img.src = `${primaryPath}?t=${Date.now()}`;

                                img.onload = () => {
                                    node.previewImage = img;
                                    node.previewImageLoaded = true;
                                    node.activeThumbnailFile = targetFile;

                                    let baseComment = styleConfig.comment || "";
                                    node.currentCommentText = formattedParams
                                        ? (baseComment ? `${baseComment}|${formattedParams}` : formattedParams)
                                        : (baseComment || "None");
                                    app.canvas.setDirty(true, true);
                                };

                                img.onerror = () => {
                                    loadThumbnailCascade(index + 1);
                                };
                            };

                            loadThumbnailCascade(0);
                        } else {
                            tryNoneFallback("none.png");
                        }
                    };

                    categoryWidget.callback = filterStylesByCategory;
                    styleWidget.callback = updateVersionDropdown;
                    if (versionWidget) versionWidget.callback = updateCanvasThumbnail;
                    if (loraStrengthWidget) {
                        loraStrengthWidget.callback = updateCanvasThumbnail;
                    }
                    filterStylesByCategory();
                }

                const onConfigure = this.onConfigure;
                this.onConfigure = function() {
                    if (onConfigure) onConfigure.apply(this, arguments);
                    syncStylesData();
                };

                setTimeout(syncStylesData, 100);
            };

            nodeType.prototype.onMouseMove = function (e, local_pos) {
                const startY = 180; // Restored original vertical alignment
                const padding = 14;
                const thumbSize = 110;

                const wasHovering = this.isHoveringThumb;
                this.mousePos = local_pos;

                if (local_pos[0] >= padding && local_pos[0] <= padding + thumbSize &&
                    local_pos[1] >= startY && local_pos[1] <= startY + thumbSize) {
                    this.isHoveringThumb = true;
                } else {
                    this.isHoveringThumb = false;
                }

                if (wasHovering !== this.isHoveringThumb || this.isHoveringThumb) {
                    app.canvas.setDirty(true);
                }
            };

            nodeType.prototype.onMouseDown = function (e, local_pos) {
                if (local_pos[1] >= 302 && local_pos[1] <= 372 && local_pos[0] >= 210) { // Restored metadataTopY = 302
                    if (this.currentSeedValue && this.currentSeedValue !== "None" && this.currentSeedValue !== "ERROR") {
                        navigator.clipboard.writeText(this.currentSeedValue);
                        this.seedCopyFeedback = true;
                        app.canvas.setDirty(true);
                        setTimeout(() => { this.seedCopyFeedback = false; app.canvas.setDirty(true); }, 1200);
                        return true;
                    }
                }
            };

            nodeType.prototype.computeSize = function() { return [350, 385]; };

            nodeType.prototype.onDrawBackground = function(ctx) {
                if (this.flags.collapsed) return;

                const startY = 180; // Restored original vertical alignment
                const padding = 14;
                const thumbSize = 110;
                const textStartX = padding + thumbSize + 20;
                const maxTextWidth = this.size[0] - textStartX - padding;
                const isJsonError = this.currentStyleName && this.currentStyleName.includes("⚠️ ERROR IN");

                const drawWrappedText = (text, x, y, maxLines = 4, targetWidth = maxTextWidth) => {
                    let lines = [];
                    let currentLine = "";
                    for (let i = 0; i < text.length; i++) {
                        let testLine = currentLine + text[i];
                        if (ctx.measureText(testLine).width > targetWidth) {
                            lines.push(currentLine);
                            currentLine = text[i];
                        } else { currentLine = testLine; }
                        if (lines.length === maxLines) break;
                    }
                    if (lines.length < maxLines) lines.push(currentLine);
                    lines.forEach((line, j) => {
                        ctx.fillText(line, x, y + (j * 8.2));
                    });
                    return y + (lines.length * 8.2);
                };

                const drawTruncatedText = (text, x, y, maxWidth) => {
                    let outputText = String(text);
                    if (ctx.measureText(outputText).width > maxWidth) {
                        while (outputText.length > 0 && ctx.measureText(outputText + "...").width > maxWidth) {
                            outputText = outputText.slice(0, -1);
                        }
                        outputText += "...";
                    }
                    ctx.fillText(outputText, x, y);
                };

                ctx.save();

                ctx.fillStyle = "#1e1e24";
                ctx.beginPath();
                ctx.roundRect(padding - 3, startY - 3, thumbSize + 6, thumbSize + 6, 8);
                ctx.fill();

                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isJsonError ? "#ff3333" : (this.previewImageLoaded ? "#3cd3ff" : "#d85a20");
                ctx.stroke();

                ctx.fillStyle = "#0d0d11";
                ctx.beginPath();
                ctx.roundRect(padding, startY, thumbSize, thumbSize, 5);
                ctx.fill();

                if (this.previewImageLoaded && this.previewImage) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(padding, startY, thumbSize, thumbSize, 5);
                    ctx.clip();
                    ctx.drawImage(this.previewImage, padding, startY, thumbSize, thumbSize);
                    ctx.restore();
                } else {
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = isJsonError ? "rgba(255, 51, 51, 0.4)" : "rgba(216, 90, 32, 0.25)";
                    ctx.beginPath();
                    ctx.moveTo(padding, startY); ctx.lineTo(padding + thumbSize, startY + thumbSize);
                    ctx.moveTo(padding + thumbSize, startY); ctx.lineTo(padding, startY + thumbSize);
                    ctx.stroke();
                }

                ctx.fillStyle = isJsonError ? "#ff3333" : (this.previewImageLoaded ? "#3cd3ff" : "#ff7c43");
                ctx.font = "bold 11px sans-serif";

                const rawHeader = String(this.currentStyleName).split(" / ").pop().toUpperCase();
                drawTruncatedText(rawHeader, textStartX, startY + 10, maxTextWidth);

                ctx.font = "7px sans-serif";
                let currentY = startY + 21;
                ctx.fillStyle = isJsonError ? "#ff7777" : "#a3e26c";
                ctx.fillText(isJsonError ? "File Alert Info:" : "Positive:", textStartX, currentY);
                currentY = drawWrappedText(this.currentPositiveText || "None", textStartX, currentY + 8.2, 4) + 2;

                ctx.fillStyle = isJsonError ? "#ff7777" : "#f37a7a";
                ctx.fillText(isJsonError ? "Action Required:" : "Negative:", textStartX, currentY);
                currentY = drawWrappedText(this.currentNegativeText || "None", textStartX, currentY + 8.2, 4);

                if (!isJsonError && this.detectedLoraNames && this.detectedLoraNames.length > 0) {
                    ctx.fillStyle = "#e2b16c";
                    ctx.fillText("Dependencies:", textStartX, currentY + 2);
                    currentY += 10.2;
                    for (let k = 0; k < Math.min(this.detectedLoraNames.length, 2); k++) {
                        const item = this.detectedLoraNames[k];
                        ctx.fillStyle = (item.type === "embed") ? "#a3e26c" : "#ffd8a8";
                        ctx.fillText(item.text, textStartX + 4, currentY);
                        currentY += 8.2;
                    }
                }

                const metadataTopY = 302; // Restored original vertical alignment
                ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
                ctx.beginPath();
                ctx.roundRect(padding, metadataTopY, this.size[0] - (padding * 2), 70, 4);
                ctx.fill();

                ctx.font = "7px monospace";
                if (isJsonError) {
                    ctx.fillStyle = "#ff3333";
                    ctx.fillText("CRITICAL JSON SYNTAX EXCEPTION:", padding + 8, metadataTopY + 12);
                } else {
                    ctx.fillStyle = this.previewImageLoaded ? "#9e9eb4" : "#ff5555";
                    ctx.fillText(this.previewImageLoaded ? "COMMENT / PARAMS:" : "DEBUG INFO (IMAGE NOT FOUND):", padding + 8, metadataTopY + 12);
                }

                ctx.fillStyle = "#ffffff";
                const hasValidSeed = (!isJsonError && this.currentSeedValue && this.currentSeedValue !== "None");
                drawWrappedText(this.currentCommentText || "None", padding + 8, metadataTopY + 22, 3, hasValidSeed ? 180 : 310);

                if (hasValidSeed) {
                    const seedX = padding + 202;
                    ctx.fillStyle = "#ffcc00";
                    ctx.font = "7px monospace";
                    ctx.fillText("SEED (CLICK TO COPY):", seedX, metadataTopY + 12);

                    if (this.seedCopyFeedback) {
                        ctx.fillStyle = "#a3e26c";
                        ctx.font = "bold 8px sans-serif";
                        ctx.fillText("✓ COPIED!", seedX, metadataTopY + 24);
                    } else {
                        ctx.fillStyle = "#3cd3ff";
                        ctx.font = "7px monospace";
                        ctx.fillText(this.currentSeedValue, seedX, metadataTopY + 24);
                    }
                }

                ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padding + 6, metadataTopY + 47);
                ctx.lineTo(this.size[0] - padding - 6, metadataTopY + 47);
                ctx.stroke();

                const maxFooterWidth = this.size[0] - (padding * 2) - 16;
                ctx.fillStyle = isJsonError ? "#ff5555" : "#777788";
                ctx.font = "italic 7px sans-serif";
                drawTruncatedText(`Source Configuration: easy_styles/${this.currentSourceFile}`, padding + 8, metadataTopY + 56, maxFooterWidth);
                drawTruncatedText(`frontend version 3.3.10`, padding + 8, metadataTopY + 65, maxFooterWidth);

                if (this.isHoveringThumb && (this.activeThumbnailFile || this.expectedThumbnailFile)) {
                    ctx.font = "bold 9px sans-serif";

                    const line1 = `Rendering: ${this.activeThumbnailFile || "None"}`;
                    const isUsingFallback = (this.activeThumbnailFile !== this.expectedThumbnailFile);
                    const line2 = isUsingFallback ? `Expected: ${this.expectedThumbnailFile}` : null;

                    const width1 = ctx.measureText(line1).width;
                    const width2 = line2 ? ctx.measureText(line2).width : 0;
                    const tooltipWidth = Math.max(width1, width2) + 16;
                    const tooltipHeight = line2 ? 32 : 18;

                    let tooltipX = this.mousePos[0] + 10;
                    let tooltipY = this.mousePos[1] - (line2 ? 36 : 22);

                    if (tooltipX + tooltipWidth > this.size[0] - 10) {
                        tooltipX = this.size[0] - tooltipWidth - 10;
                    }

                    ctx.fillStyle = "rgba(15, 15, 20, 0.94)";
                    ctx.strokeStyle = isUsingFallback ? "#ff7c43" : "#3cd3ff";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(line1, tooltipX + 8, tooltipY + 12);

                    if (line2) {
                        ctx.fillStyle = "#ff7c43";
                        ctx.fillText(line2, tooltipX + 8, tooltipY + 25);
                    }
                }

                ctx.restore();
            };
        }
    }
});