import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "Comfy.CLIPTextEncodeWithBreakAndStrength",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CLIPTextEncodeWithBreakAndStrength") {

            const origConfigure = nodeType.prototype.configure;
            nodeType.prototype.configure = function(data) {
                if (data && data.widgets_values) {
                    const strengthsVal = data.widgets_values.find(v => typeof v === "string" && v.includes(","));
                    if (strengthsVal) {
                        const parsed = strengthsVal.split(",").map(val => parseFloat(val.trim())).filter(val => !isNaN(val));
                        if (parsed.length > 0) {
                            this._blockStrengths = parsed;
                        }
                    }
                }
                if (origConfigure) {
                    return origConfigure.apply(this, arguments);
                }
            };

            const origNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const node = this;

                if (!node._blockStrengths) {
                    node._blockStrengths = [1.0];
                }

                // Hide the raw comma-separated strengths widget
                const strengthsWidget = node.widgets?.find(w => w.name === "strengths");
                if (strengthsWidget) {
                    strengthsWidget.type = "hidden";
                    strengthsWidget.computeSize = () => [0, -4];
                    strengthsWidget.draw = function() {};
                }

                // Bind live typing callback to its own text widget if present
                const textWidget = node.widgets?.find(w => w.name === "text");
                if (textWidget) {
                    const origCb = textWidget.callback;
                    textWidget.callback = function() {
                        if (origCb) origCb.apply(this, arguments);
                        node.updateBreakPreview?.();
                    };
                }

                const container = document.createElement("div");
                container.className = "break-preview-container";

                node.addDOMWidget("break_preview", "break_preview", container, {
                    serialize: false,
                    computeSize: function(width) {
                        const blockCount = node._blockStrengths ? node._blockStrengths.length : 1;
                        const height = 75 + (blockCount * 36);
                        return [width || 360, Math.max(140, height)];
                    }
                });

                container.style.color = "#d7d7d7";
                container.style.backgroundColor = "#1e1e1e";
                container.style.border = "1px solid #333";
                container.style.padding = "8px";
                container.style.borderRadius = "4px";
                container.style.fontSize = "11px";
                container.style.fontFamily = "monospace";
                container.style.boxSizing = "border-box";
                container.style.width = "100%";
                container.style.overflowY = "auto";

                function cleanTextBlock(blockText) {
                    if (!blockText) return "";
                    let cleaned = blockText.trim();
                    cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/g, '');
                    cleaned = cleaned.replace(/,\s*,+/g, ',');
                    return cleaned.trim();
                }

                function estimateTokens(text) {
                    if (!text) return 0;
                    const words = text.trim().split(/\s+/).filter(Boolean);
                    let count = 0;
                    words.forEach(word => {
                        count += Math.max(1, Math.ceil(word.length / 4));
                    });
                    return count;
                }

                function getUpstreamText(nodeId, visited = new Set()) {
                    if (!nodeId || visited.has(nodeId)) return "";
                    visited.add(nodeId);

                    const upstreamNode = app.graph.getNodeById(nodeId);
                    if (!upstreamNode) return "";

                    if (upstreamNode._executedText && typeof upstreamNode._executedText === "string") {
                        return upstreamNode._executedText;
                    }

                    if (upstreamNode.widgets) {
                        const stringWidget = upstreamNode.widgets.find(w =>
                            typeof w.value === "string" &&
                            w.value.length > 0 &&
                            w.value !== upstreamNode.title &&
                            w.name !== "title"
                        );
                        if (stringWidget) return stringWidget.value;
                    }

                    if (upstreamNode.widgets_values) {
                        const val = upstreamNode.widgets_values.find(v =>
                            typeof v === "string" &&
                            v.length > 0 &&
                            v !== upstreamNode.title
                        );
                        if (val) return val;
                    }

                    if (upstreamNode.inputs) {
                        const textInput = upstreamNode.inputs.find(i => i.name === "text") || upstreamNode.inputs[0];
                        if (textInput && textInput.link != null) {
                            const link = app.graph.links[textInput.link];
                            if (link) {
                                return getUpstreamText(link.origin_id, visited);
                            }
                        }
                    }

                    return "";
                }

                node.updateBreakPreview = function() {
                    let text = "";

                    // 1. Check if linked to an upstream node
                    const textInputIndex = node.inputs?.findIndex(i => i.name === "text");
                    if (textInputIndex !== -1 && node.inputs[textInputIndex]?.link != null) {
                        const linkId = node.inputs[textInputIndex].link;
                        const link = app.graph.links[linkId];
                        if (link) {
                            text = getUpstreamText(link.origin_id);
                        }
                    }
                    // 2. Fallback to its own text widget value if unlinked
                    else if (textWidget) {
                        text = textWidget.value || "";
                    }

                    // Fallback to executed override if present
                    if (node._executedText && typeof node._executedText === "string" && !text) {
                        text = node._executedText;
                    }

                    const rawBlocks = text ? text.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/) : [];
                    let validBlocks = [];
                    let newStrengths = [];

                    rawBlocks.forEach((block, idx) => {
                        const cleaned = cleanTextBlock(block);
                        if (cleaned) {
                            validBlocks.push(cleaned);
                            newStrengths.push(node._blockStrengths[idx] ?? 1.0);
                        }
                    });

                    if (validBlocks.length === 0) {
                        validBlocks = text ? [] : ["(type text or connect node)"];
                        if (validBlocks.length > 0 && !text) newStrengths = [1.0];
                    }

                    node._blockStrengths = newStrengths.length > 0 ? newStrengths : [1.0];

                    let html = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-weight:bold; color:#8ab4f8;">Break Blocks (${validBlocks.length}):</span>
                            <div style="display: flex; gap: 4px;">
                                <button id="reset-btn-${node.id}" style="background: #333; color: #f28b82; border: 1px solid #555; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; transition: background-color 0.2s;">↩ Reset to 1</button>
                                <button id="refresh-btn-${node.id}" style="background: #333; color: #8ab4f8; border: 1px solid #555; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; transition: background-color 0.2s;">🔄 Refresh Scan</button>
                            </div>
                        </div>
                    `;

                    if (validBlocks.length === 0 || (!text && validBlocks[0] === "(type text or connect node)")) {
                        html += `<div style="color: #777; font-style: italic; padding: 4px;">No text input or connection.</div>`;
                    } else {
                        validBlocks.forEach((block, idx) => {
                            const strengthVal = node._blockStrengths[idx] ?? 1.0;
                            const tokenCount = estimateTokens(block);

                            html += `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; background: #262626; padding: 4px 6px; border-radius: 3px;">
                                    <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(block)}">
                                        <span style="color:#f28b82; font-weight:bold;">[${idx + 1}]</span> 
                                        <span style="color:#aaa; font-size:10px;">(${tokenCount}t)</span> 
                                        ${escapeHtml(block)}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                        <input type="range" min="0" max="2" step="0.05" value="${strengthVal}" data-index="${idx}" class="break-strength-slider" style="width: 80px; accent-color: #8ab4f8; cursor: pointer;" />
                                        <input type="number" min="0" max="10" step="0.05" value="${Number(strengthVal).toFixed(2)}" data-index="${idx}" class="break-strength-number" style="width: 45px; background: #111; color: #fff; border: 1px solid #444; border-radius: 2px; padding: 1px; font-size: 10px; text-align: center;" />
                                    </div>
                                </div>
                            `;
                        });
                    }

                    container.innerHTML = html;

                    const resetBtn = container.querySelector(`#reset-btn-${node.id}`);
                    if (resetBtn) {
                        resetBtn.addEventListener("click", () => {
                            resetBtn.style.backgroundColor = "#c5221f";
                            resetBtn.style.borderColor = "#c5221f";
                            resetBtn.style.color = "#fff";

                            node._blockStrengths = node._blockStrengths.map(() => 1.0);
                            setTimeout(() => {
                                node.updateBreakPreview();
                            }, 50);
                        });
                    }

                    const refreshBtn = container.querySelector(`#refresh-btn-${node.id}`);
                    if (refreshBtn) {
                        refreshBtn.addEventListener("click", () => {
                            refreshBtn.style.backgroundColor = "#28a745";
                            refreshBtn.style.borderColor = "#28a745";

                            node._executedText = null;
                            setTimeout(() => {
                                node.updateBreakPreview();
                            }, 50);
                        });
                    }

                    const activeWidgetsHeight = (node.widgets || []).filter(w => w.type !== "hidden").length * 28;
                    const blockCount = Math.max(1, validBlocks.length);
                    const previewHeight = 75 + (blockCount * 36);
                    const totalHeight = activeWidgetsHeight + previewHeight + 40;

                    if (node.size) {
                        node.size[1] = Math.max(node.size[1], totalHeight);
                    }

                    const sliders = container.querySelectorAll(".break-strength-slider");
                    sliders.forEach(slider => {
                        slider.addEventListener("input", (e) => {
                            const index = parseInt(e.target.getAttribute("data-index"));
                            const val = parseFloat(e.target.value);
                            if (!isNaN(index) && !isNaN(val)) {
                                node._blockStrengths[index] = val;
                                const numInput = e.target.parentElement.querySelector(".break-strength-number");
                                if (numInput) numInput.value = val.toFixed(2);
                                node.syncStrengthsWidget();
                            }
                        });
                    });

                    const numInputs = container.querySelectorAll(".break-strength-number");
                    numInputs.forEach(input => {
                        input.addEventListener("input", (e) => {
                            const index = parseInt(e.target.getAttribute("data-index"));
                            const val = parseFloat(e.target.value);
                            if (!isNaN(index) && !isNaN(val)) {
                                node._blockStrengths[index] = val;
                                const slider = e.target.parentElement.querySelector(".break-strength-slider");
                                if (slider) slider.value = val;
                                node.syncStrengthsWidget();
                            }
                        });
                    });

                    node.syncStrengthsWidget();
                    node.setDirtyCanvas(true, true);
                };

                node.syncStrengthsWidget = function() {
                    const strengthsStr = node._blockStrengths.join(", ");
                    const w = node.widgets?.find(widget => widget.name === "strengths");
                    if (w) {
                        w.value = strengthsStr;
                        node.graph?.setDirtyCanvas(true, true);
                    }
                };

                function escapeHtml(string) {
                    return String(string).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }

                node.updateBreakPreview();
                return origNodeCreated ? origNodeCreated.apply(this, arguments) : undefined;
            };

            if (app.api) {
                app.api.addEventListener("execution_start", () => {
                    for (const n of app.graph._nodes || []) {
                        if (n.type === "CLIPTextEncodeWithBreakAndStrength") {
                            n.updateBreakPreview?.();
                        }
                    }
                });
            }

            const origOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                const r = origOnExecuted ? origOnExecuted.apply(this, arguments) : undefined;
                if (message) {
                    if (message.text) {
                        this._executedText = Array.isArray(message.text) ? message.text[0] : message.text;
                    } else if (message.string) {
                        this._executedText = Array.isArray(message.string) ? message.string[0] : message.string;
                    }
                }
                this.updateBreakPreview?.();
                return r;
            };

            const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
                const r = origOnConnectionsChange ? origOnConnectionsChange.apply(this, arguments) : undefined;
                if (type === 1 && this.inputs && this.inputs[index]?.name === "text") {
                    const node = this;
                    if (!connected) {
                        node._executedText = null;
                    }
                    setTimeout(() => node.updateBreakPreview?.(), 50);
                }
                return r;
            };
        }
    }
});