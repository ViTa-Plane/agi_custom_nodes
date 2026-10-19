// Version: v1.8.4
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "Comfy.BreakStrengthProcessor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "BreakStrengthProcessor") {

            const origConfigure = nodeType.prototype.configure;
            nodeType.prototype.configure = function(data) {
                if (data && data.widgets_values) {
                    const getWidgetVal = (name) => {
                        const idx = (this.widgets || []).findIndex(w => w.name === name);
                        return (idx !== -1 && data.widgets_values.length > idx) ? data.widgets_values[idx] : null;
                    };

                    const textVal = getWidgetVal("text");
                    if (textVal) {
                        this._receivedText = textVal;
                        this._originalText = textVal;
                    }

                    const heldTextVal = getWidgetVal("held_text");
                    if (heldTextVal) {
                        this._heldText = heldTextVal;
                        if (heldTextVal.trim().length > 0) {
                            this._isHeld = true;
                            this._receivedText = heldTextVal;
                        }
                    }

                    const strengthsVal = getWidgetVal("strengths");
                    if (typeof strengthsVal === "string") {
                        const parsed = strengthsVal.split(",").map(val => parseFloat(val.trim())).filter(val => !isNaN(val));
                        if (parsed.length > 0) {
                            this._blockStrengths = parsed;
                        }
                    }

                    const togglesVal = getWidgetVal("toggles");
                    if (typeof togglesVal === "string") {
                        const parsedToggles = togglesVal.split(",").map(val => {
                            const v = val.trim().toLowerCase();
                            return v === "true" || v === "1" || v === "yes" || v === "on";
                        });
                        if (parsedToggles.length > 0) {
                            this._blockEnabled = parsedToggles;
                        }
                    }

                    const tokensVal = getWidgetVal("tokens");
                    if (typeof tokensVal === "string" && tokensVal.includes(";")) {
                        const parts = tokensVal.split(";");
                        if (parts.length === 2) {
                            this._totalTokens = parseInt(parts[0]) || 0;
                            this._blockTokens = parts[1].split(",").map(v => parseInt(v.trim()) || 0);
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

                node.size = [440, 260];

                if (!node._blockStrengths) {
                    node._blockStrengths = [];
                }
                if (!node._blockEnabled) {
                    node._blockEnabled = [];
                }
                if (!node._originalIndices) {
                    node._originalIndices = [];
                }
                if (!node._originalSubIndices) {
                    node._originalSubIndices = [];
                }
                if (!node._receivedText) {
                    node._receivedText = "";
                }
                node._originalText = node._originalText || "";
                node._heldText = node._heldText || "";
                node._isHeld = false;
                node._totalTokens = node._totalTokens || 0;
                node._blockTokens = node._blockTokens || [];

                // Hide internal state widgets cleanly
                ["strengths", "tokens", "toggles", "held_text"].forEach(name => {
                    const w = node.widgets?.find(widget => widget.name === name);
                    if (w) {
                        w.type = "hidden";
                        w.computeSize = () => [0, -4];
                        w.draw = function() {};
                    }
                });

                const textWidget = node.widgets?.find(w => w.name === "text");
                if (textWidget) {
                    if (textWidget.value && !node._receivedText) {
                        node._receivedText = textWidget.value;
                        node._originalText = textWidget.value;
                    }
                    const origCb = textWidget.callback;
                    textWidget.callback = function() {
                        if (origCb) origCb.apply(this, arguments);
                        if (!node._isHeld) {
                            node._receivedText = textWidget.value;
                            node._originalText = textWidget.value;
                            node.updateBreakPreview?.();
                        }
                    };
                }

                const container = document.createElement("div");
                container.style.cssText = "color: #d7d7d7; background: #1e1e1e; border: 1px solid #333; padding: 10px; border-radius: 4px; font-size: 11px; font-family: monospace; box-sizing: border-box; width: 100%; max-width: 100%; overflow-y: auto; overflow-x: hidden; position: relative;";

                const domWidget = node.addDOMWidget("break_ui", "break_ui", container, {
                    serialize: false,
                    computeSize: function(width) {
                        const currentWidth = node.size ? node.size[0] : (width || 440);
                        const safeWidth = Math.max(currentWidth, 440);

                        container.style.width = "100%";
                        container.style.maxWidth = "100%";

                        const count = node._blockStrengths && node._blockStrengths.length > 0 ? node._blockStrengths.length : 1;
                        return [safeWidth, Math.max(200, 110 + (count * 45))];
                    }
                });

                if (domWidget) {
                    Object.defineProperty(domWidget, 'width', {
                        get: function() { return node.size ? node.size[0] : 440; },
                        set: function(v) {},
                        configurable: true
                    });
                }

                function cleanTextBlock(blockText) {
                    if (!blockText) return "";
                    let cleaned = blockText.trim();
                    cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/g, '');
                    cleaned = cleaned.replace(/,\s*,+/g, ',');
                    return cleaned.trim();
                }

                function sanitizeTextWithBreaks(text) {
                    if (!text) return "";
                    let rawParts = text.split(/\bBREAK\b/);
                    let cleanedParts = [];
                    rawParts.forEach(part => {
                        const cleaned = cleanTextBlock(part);
                        if (cleaned) {
                            cleanedParts.push(cleaned);
                        }
                    });
                    return cleanedParts.join(" BREAK ");
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

                function highlightBreaks(str) {
                    if (!str) return "";
                    const escaped = escapeHtml(str);
                    return escaped.replace(/\bBREAK\b/g, '<span class="break-keyword" style="color: #f28b82; font-weight: bold; background: #3c2f2f; padding: 1px 4px; border-radius: 2px; cursor: pointer; text-decoration: none;" title="Double-click to delete this BREAK">BREAK</span>');
                }

                node.updateBreakPreview = function() {
                    if (!node._isHeld && textWidget && !node._receivedText) {
                        node._receivedText = textWidget.value || "";
                        node._originalText = node._receivedText;
                    }

                    node._receivedText = sanitizeTextWithBreaks(node._receivedText);
                    const text = node._receivedText || "";

                    const rawBlocks = text ? text.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/) : [];
                    let validBlocks = [];
                    let savedStrengths = node._blockStrengths || [];
                    let savedEnabled = node._blockEnabled || [];
                    let savedOriginalIndices = node._originalIndices || [];
                    let savedOriginalSubIndices = node._originalSubIndices || [];
                    let savedBlockTokens = node._blockTokens || [];

                    let newStrengths = [];
                    let newEnabled = [];
                    let newOriginalIndices = [];
                    let newOriginalSubIndices = [];
                    let newBlockTokens = [];
                    let fallbackBlockTokens = [];

                    let validIdx = 0;
                    rawBlocks.forEach((block) => {
                        const cleaned = cleanTextBlock(block);
                        if (cleaned) {
                            validBlocks.push(cleaned);
                            const defaultStr = savedStrengths[validIdx] !== undefined ? savedStrengths[validIdx] : 1.0;
                            newStrengths.push(defaultStr);

                            const defaultEnabled = savedEnabled[validIdx] !== undefined ? savedEnabled[validIdx] : true;
                            newEnabled.push(defaultEnabled);

                            const defaultOrigIdx = savedOriginalIndices[validIdx] !== undefined ? savedOriginalIndices[validIdx] : validIdx;
                            newOriginalIndices.push(defaultOrigIdx);

                            const defaultSubIdx = savedOriginalSubIndices[validIdx] !== undefined ? savedOriginalSubIndices[validIdx] : 0;
                            newOriginalSubIndices.push(defaultSubIdx);

                            const calculatedTokens = estimateTokens(cleaned);
                            newBlockTokens.push(calculatedTokens);
                            fallbackBlockTokens.push(calculatedTokens);
                            validIdx++;
                        }
                    });

                    node._blockStrengths = newStrengths;
                    node._blockEnabled = newEnabled;
                    node._originalIndices = newOriginalIndices;
                    node._originalSubIndices = newOriginalSubIndices;
                    node._blockTokens = newBlockTokens.length > 0 ? newBlockTokens : fallbackBlockTokens;
                    node._totalTokens = node._blockTokens.reduce((a, b) => a + b, 0);

                    const activeBlockTokens = node._blockTokens;
                    const activeTotalTokens = node._totalTokens;
                    const holdBtnBg = node._isHeld ? '#2b4c3f' : '#333';
                    const holdBtnColor = node._isHeld ? '#81c995' : '#8ab4f8';
                    const holdBtnText = node._isHeld ? '🔒 Held' : '🔓 Hold';

                    let html = `
                        <div style="margin-bottom: 8px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; width: 100%;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-weight: bold; color: #8ab4f8;">Received Text:</span>
                                    <button type="button" id="hold-toggle-btn-${node.id}" title="Toggle hold state (preserves current text when toggled off)" style="background: ${holdBtnBg}; color: ${holdBtnColor}; border: 1px solid #555; border-radius: 3px; padding: 1px 6px; font-size: 10px; cursor: pointer;">${holdBtnText}</button>
                                    <button type="button" id="clear-held-btn-${node.id}" title="Clear text and reset to original input" style="background: #333; color: #f28b82; border: 1px solid #555; border-radius: 3px; padding: 1px 6px; font-size: 10px; cursor: pointer;">🗑️ Reset</button>
                                </div>
                                <span style="color: #888; font-size: 10px;">CLIP Tokens: <strong style="color: #fff;">${activeTotalTokens}</strong></span>
                            </div>
                            <div id="received-text-box-${node.id}" style="width: 100%; min-width: 100%; max-width: 100%; min-height: 50px; height: 65px; max-height: 150px; background: #111; color: #00ffcc; border: 1px solid #444; border-radius: 3px; padding: 6px; font-family: monospace; font-size: 11px; box-sizing: border-box; overflow-y: auto; resize: vertical; word-break: break-word; cursor: text;" title="Double-click anywhere to insert BREAK. Double-click BREAK keyword to delete it.">${highlightBreaks(text || "Type text here...")}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; margin-top: 10px; width: 100%; box-sizing: border-box;">
                            <span style="font-weight:bold; color:#8ab4f8;">Break Blocks (${validBlocks.length}) <span style="font-size: 9px; color: #888; font-weight: normal;">(Drag handle to reorder)</span>:</span>
                            <div style="display: flex; gap: 4px;">
                                ${validBlocks.length > 0 ? `<button type="button" id="reset-order-btn-${node.id}" style="background: #333; color: #8ab4f8; border: 1px solid #555; border-radius: 3px; padding: 3px 6px; font-size: 10px; cursor: pointer;" title="Reset block order">↩ Reset Order</button>` : ''}
                                ${validBlocks.length > 0 ? `<button type="button" id="reset-btn-${node.id}" style="background: #333; color: #f28b82; border: 1px solid #555; border-radius: 3px; padding: 3px 6px; font-size: 10px; cursor: pointer;" title="Reset all strength values to 1.0">↩ Reset Strengths</button>` : ''}
                            </div>
                        </div>
                        <div id="blocks-container-${node.id}" style="display: flex; flex-direction: column; position: relative; width: 100%;">
                    `;

                    if (validBlocks.length === 0) {
                        html += `<div style="color: #777; font-style: italic; padding: 4px;">No BREAK blocks detected.</div>`;
                    } else {
                        validBlocks.forEach((block, idx) => {
                            const strengthVal = node._blockStrengths[idx] ?? 1.0;
                            const isEnabled = node._blockEnabled[idx] ?? true;
                            const origIdx = node._originalIndices[idx] !== undefined ? node._originalIndices[idx] : idx;
                            const subIdx = node._originalSubIndices[idx] !== undefined ? node._originalSubIndices[idx] : 0;
                            const blockTokenCount = activeBlockTokens[idx] ?? 0;
                            const opacityStyle = isEnabled ? 'opacity: 1.0;' : 'opacity: 0.5; background: #1c1c1c;';

                            const isOverLimit = blockTokenCount > 75;
                            const tokenCountStyle = isOverLimit
                                ? 'color: #f28b82; font-weight: bold;'
                                : 'color: #888;';

                            // Format like [1] for main or [1a], [1b] for sub-indices
                            const displayMain = origIdx + 1;
                            let labelStr = `[${displayMain}]`;
                            if (subIdx > 0) {
                                const letter = String.fromCharCode(96 + subIdx); // 1 -> 'a', 2 -> 'b', etc.
                                labelStr = `[${displayMain}${letter}]`;
                            }

                            html += `
                                <div class="block-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; background: #262626; border: 1px solid #333; padding: 6px 8px; border-radius: 3px; width: 100%; box-sizing: border-box; ${opacityStyle}">
                                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                        <span class="drag-handle" draggable="true" data-index="${idx}" style="display: inline-block; width: 12px; height: 12px; cursor: grab; background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22%23aaa%22><path d=%22M2 4h12v2H2zm0 5h12v2H2z%22/></svg>'); background-repeat: no-repeat; background-position: center; opacity: 0.7;" title="Drag to reorder block"></span>
                                        <input type="checkbox" data-index="${idx}" class="break-block-checkbox" ${isEnabled ? 'checked' : ''} style="cursor: pointer; accent-color: #8ab4f8;" title="Enable/Disable block" />
                                        <span style="color:#f28b82; font-weight:bold;" title="Original position ${labelStr}">${labelStr}</span>
                                    </div>
                                    <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(block)}">
                                        <span style="${tokenCountStyle} font-size: 9px; margin-right: 4px;" title="${isOverLimit ? 'Warning: Exceeds 75 tokens!' : ''}">(${blockTokenCount}t)</span> 
                                        ${escapeHtml(block)}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                        <input type="range" min="0" max="2" step="0.05" value="${strengthVal}" data-index="${idx}" class="break-strength-slider" ${isEnabled ? '' : 'disabled'} style="width: 70px; cursor: pointer; accent-color: #8ab4f8;" />
                                        <input type="number" min="0" max="10" step="0.05" value="${Number(strengthVal).toFixed(2)}" data-index="${idx}" class="break-strength-number" ${isEnabled ? '' : 'disabled'} style="width: 48px; background: #111; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 2px; text-align: center; font-size: 11px;" />
                                    </div>
                                </div>
                            `;
                        });
                    }

                    html += `</div>`;

                    const oldTextBox = container.querySelector(`[id^="received-text-box-"]`);
                    const savedHeight = oldTextBox ? oldTextBox.style.height : null;

                    container.innerHTML = html;

                    if (savedHeight) {
                        const newTextBox = container.querySelector(`#received-text-box-${node.id}`);
                        if (newTextBox) newTextBox.style.height = savedHeight;
                    }

                    const dropIndicator = document.createElement("div");
                    dropIndicator.style.cssText = "position: absolute; left: 0; right: 0; height: 3px; background: #8ab4f8; pointer-events: none; display: none; z-index: 10; box-shadow: 0 0 4px #8ab4f8; border-radius: 2px;";
                    const blocksContainer = container.querySelector(`#blocks-container-${node.id}`);
                    if (blocksContainer) {
                        blocksContainer.appendChild(dropIndicator);
                    }

                    let draggedIdx = null;
                    container.querySelectorAll(".drag-handle").forEach(handle => {
                        handle.addEventListener("dragstart", (e) => {
                            draggedIdx = parseInt(e.currentTarget.getAttribute("data-index"));
                            e.dataTransfer.effectAllowed = "move";
                            e.currentTarget.style.opacity = "0.3";

                            const row = e.currentTarget.closest(".block-row");
                            if (row) {
                                row.style.background = "#1c1c1c";
                                row.style.border = "1px dashed #555";
                                row.style.opacity = "0.4";
                            }
                        });

                        handle.addEventListener("dragend", (e) => {
                            e.currentTarget.style.opacity = "0.7";
                            if (dropIndicator) dropIndicator.style.display = "none";
                            container.querySelectorAll(".block-row").forEach(r => {
                                r.style.background = "#262626";
                                r.style.border = "1px solid #333";
                                r.style.opacity = "1.0";
                            });
                        });
                    });

                    container.querySelectorAll(".block-row").forEach(row => {
                        row.addEventListener("dragover", (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";

                            const targetIdx = parseInt(row.getAttribute("data-index"));

                            if (draggedIdx !== null) {
                                const rect = row.getBoundingClientRect();
                                const midpoint = rect.top + rect.height / 2;
                                const dropBefore = e.clientY < midpoint;

                                const isSelf = targetIdx === draggedIdx;
                                const isImmediatelyBefore = (targetIdx === draggedIdx + 1) && dropBefore;
                                const isImmediatelyAfter = (targetIdx === draggedIdx - 1) && !dropBefore;

                                if (isSelf || isImmediatelyBefore || isImmediatelyAfter) {
                                    if (dropIndicator) dropIndicator.style.display = "none";
                                    return;
                                }

                                row.dataset.dropAction = dropBefore ? "before" : "after";

                                const rows = Array.from(container.querySelectorAll(".block-row"));
                                const targetRow = rows[targetIdx];
                                if (!targetRow) return;

                                let lineTop = 0;
                                if (dropBefore) {
                                    lineTop = targetRow.offsetTop - 3;
                                } else {
                                    if (targetIdx + 1 < rows.length) {
                                        lineTop = rows[targetIdx + 1].offsetTop - 3;
                                    } else {
                                        lineTop = targetRow.offsetTop + targetRow.offsetHeight + 3;
                                    }
                                }

                                if (dropIndicator) {
                                    dropIndicator.style.top = `${lineTop}px`;
                                    dropIndicator.style.display = "block";
                                }
                            }
                        });

                        row.addEventListener("drop", (e) => {
                            e.preventDefault();
                            if (dropIndicator) dropIndicator.style.display = "none";

                            const targetIdx = parseInt(e.currentTarget.getAttribute("data-index"));
                            if (draggedIdx !== null) {
                                const dropBefore = e.currentTarget.dataset.dropAction === "before";
                                const isSelf = targetIdx === draggedIdx;
                                const isImmediatelyBefore = (targetIdx === draggedIdx + 1) && dropBefore;
                                const isImmediatelyAfter = (targetIdx === draggedIdx - 1) && !dropBefore;

                                if (isSelf || isImmediatelyBefore || isImmediatelyAfter) {
                                    return;
                                }

                                let targetPos = dropBefore ? targetIdx : targetIdx + 1;
                                if (draggedIdx < targetPos) {
                                    targetPos--;
                                }
                                if (draggedIdx !== targetPos) {
                                    const currentText = node._receivedText || "";
                                    const rawBlocks = currentText.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/);
                                    let validBlocksList = [];
                                    rawBlocks.forEach(b => {
                                        const cleaned = cleanTextBlock(b);
                                        if (cleaned) validBlocksList.push(cleaned);
                                    });

                                    const reorder = (arr) => {
                                        if (!arr) return;
                                        const item = arr.splice(draggedIdx, 1)[0];
                                        arr.splice(targetPos, 0, item);
                                    };

                                    reorder(validBlocksList);
                                    reorder(node._blockStrengths);
                                    reorder(node._blockEnabled);
                                    reorder(node._originalIndices);
                                    reorder(node._originalSubIndices);
                                    reorder(node._blockTokens);

                                    node._receivedText = validBlocksList.join(" BREAK ");
                                    node._isHeld = true;
                                    node._heldText = node._receivedText;

                                    node.syncWidgets();
                                    node.updateBreakPreview();
                                }
                            }
                        });
                    });

                    container.querySelector(`#hold-toggle-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        node._isHeld = !node._isHeld;
                        if (node._isHeld) {
                            node._heldText = node._receivedText;
                        } else {
                            node._heldText = "";
                        }
                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelector(`#clear-held-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        node._isHeld = false;
                        node._heldText = "";
                        node._receivedText = node._originalText || (textWidget ? (textWidget.value || "") : "");
                        node._blockStrengths = [];
                        node._blockEnabled = [];
                        node._originalIndices = [];
                        node._originalSubIndices = [];
                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelector(`#reset-order-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const currentText = node._receivedText || "";
                        const rawBlocks = currentText.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/);
                        let validBlocksList = [];
                        rawBlocks.forEach(b => {
                            const cleaned = cleanTextBlock(b);
                            if (cleaned) validBlocksList.push(cleaned);
                        });

                        const combined = validBlocksList.map((block, i) => ({
                            block,
                            strength: node._blockStrengths[i] ?? 1.0,
                            enabled: node._blockEnabled[i] ?? true,
                            origIdx: node._originalIndices[i] !== undefined ? node._originalIndices[i] : i,
                            subIdx: node._originalSubIndices[i] !== undefined ? node._originalSubIndices[i] : 0
                        }));

                        combined.sort((a, b) => {
                            if (a.origIdx !== b.origIdx) {
                                return a.origIdx - b.origIdx;
                            }
                            return a.subIdx - b.subIdx;
                        });

                        node._receivedText = combined.map(c => c.block).join(" BREAK ");
                        node._blockStrengths = combined.map(c => c.strength);
                        node._blockEnabled = combined.map(c => c.enabled);
                        node._originalIndices = combined.map(c => c.origIdx);
                        node._originalSubIndices = combined.map(c => c.subIdx);
                        node._isHeld = true;
                        node._heldText = node._receivedText;

                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelector(`#received-text-box-${node.id}`)?.addEventListener("dblclick", (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const target = e.target;
                        if (target && target.classList.contains("break-keyword")) {
                            let currentText = node._receivedText || "";
                            let blocks = currentText.split(/\bBREAK\b/).map(b => cleanTextBlock(b)).filter(Boolean);

                            const textBox = container.querySelector(`#received-text-box-${node.id}`);
                            const breakSpans = Array.from(textBox.querySelectorAll(".break-keyword"));
                            const breakIdx = breakSpans.indexOf(target);

                            if (breakIdx >= 0 && breakIdx < blocks.length - 1) {
                                blocks[breakIdx] = blocks[breakIdx] + " " + blocks[breakIdx + 1];
                                blocks.splice(breakIdx + 1, 1);

                                if (node._blockStrengths) {
                                    node._blockStrengths[breakIdx] = 1.0;
                                    node._blockStrengths.splice(breakIdx + 1, 1);
                                }
                                if (node._blockEnabled) {
                                    node._blockEnabled[breakIdx] = true;
                                    node._blockEnabled.splice(breakIdx + 1, 1);
                                }
                                if (node._originalIndices) {
                                    node._originalIndices.splice(breakIdx + 1, 1);
                                }
                                if (node._originalSubIndices) {
                                    node._originalSubIndices.splice(breakIdx + 1, 1);
                                }

                                node._receivedText = blocks.join(" BREAK ");
                                node._isHeld = true;
                                node._heldText = node._receivedText;

                                node.syncWidgets();
                                node.updateBreakPreview();
                            }
                            return;
                        }

                        let charIndex = -1;
                        if (document.caretRangeFromPoint) {
                            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                            if (range && range.startContainer) {
                                const walker = document.createTreeWalker(container.querySelector(`#received-text-box-${node.id}`), NodeFilter.SHOW_TEXT, null, false);
                                let currentPos = 0;
                                while (walker.nextNode()) {
                                    const nodeText = walker.currentNode;
                                    if (nodeText === range.startContainer) {
                                        charIndex = currentPos + range.startOffset;
                                        break;
                                    }
                                    currentPos += nodeText.length;
                                }
                            }
                        }

                        let currentText = node._receivedText || (textWidget ? textWidget.value : "") || "";
                        let candidateText = "";

                        if (charIndex >= 0 && charIndex <= currentText.length) {
                            candidateText = currentText.slice(0, charIndex) + " BREAK " + currentText.slice(charIndex);
                        } else {
                            candidateText = currentText ? currentText + " BREAK " : "BREAK";
                        }

                        const sanitizedCandidate = sanitizeTextWithBreaks(candidateText);
                        const oldBlocksCount = sanitizeTextWithBreaks(currentText).split(/\bBREAK\b/).length;
                        const newBlocksCount = sanitizedCandidate.split(/\bBREAK\b/).length;

                        if (sanitizedCandidate === sanitizeTextWithBreaks(currentText) || newBlocksCount <= oldBlocksCount) {
                            return;
                        }

                        node._receivedText = sanitizedCandidate;
                        node._isHeld = true;
                        node._heldText = node._receivedText;

                        let targetBlockIdx = 0;
                        const preText = currentText.slice(0, charIndex >= 0 ? charIndex : currentText.length);
                        const preBlocks = preText.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/);
                        targetBlockIdx = Math.max(0, preBlocks.length - 1);

                        const newRawBlocks = node._receivedText.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/);
                        let validBlocksList = [];
                        newRawBlocks.forEach(b => {
                            const cleaned = cleanTextBlock(b);
                            if (cleaned) validBlocksList.push(cleaned);
                        });

                        let updatedStrengths = [];
                        let updatedEnabled = [];
                        let updatedOriginalIndices = [];
                        let updatedOriginalSubIndices = [];
                        let oldStrengths = node._blockStrengths || [];
                        let oldEnabled = node._blockEnabled || [];
                        let oldOriginalIndices = node._originalIndices || [];
                        let oldOriginalSubIndices = node._originalSubIndices || [];

                        validBlocksList.forEach((_, idx) => {
                            if (idx === targetBlockIdx && oldStrengths.length < validBlocksList.length) {
                                const parentOrigIdx = oldOriginalIndices[targetBlockIdx] !== undefined ? oldOriginalIndices[targetBlockIdx] : targetBlockIdx;
                                const parentSubIdx = oldOriginalSubIndices[targetBlockIdx] !== undefined ? oldOriginalSubIndices[targetBlockIdx] : 0;
                                updatedStrengths.push(1.0);
                                updatedEnabled.push(true);
                                updatedOriginalIndices.push(parentOrigIdx);
                                updatedOriginalSubIndices.push(parentSubIdx);
                            } else if (idx === targetBlockIdx + 1 && oldStrengths.length < validBlocksList.length) {
                                const parentOrigIdx = oldOriginalIndices[targetBlockIdx] !== undefined ? oldOriginalIndices[targetBlockIdx] : targetBlockIdx;
                                const parentSubIdx = oldOriginalSubIndices[targetBlockIdx] !== undefined ? oldOriginalSubIndices[targetBlockIdx] : 0;
                                updatedStrengths.push(1.0);
                                updatedEnabled.push(true);
                                updatedOriginalIndices.push(parentOrigIdx);
                                updatedOriginalSubIndices.push(parentSubIdx + 1);
                            } else {
                                const oldIdx = idx > targetBlockIdx ? idx - 1 : idx;
                                updatedStrengths.push(oldStrengths[oldIdx] !== undefined ? oldStrengths[oldIdx] : 1.0);
                                updatedEnabled.push(oldEnabled[oldIdx] !== undefined ? oldEnabled[oldIdx] : true);
                                updatedOriginalIndices.push(oldOriginalIndices[oldIdx] !== undefined ? oldOriginalIndices[oldIdx] : oldIdx);
                                updatedOriginalSubIndices.push(oldOriginalSubIndices[oldIdx] !== undefined ? oldOriginalSubIndices[oldIdx] : 0);
                            }
                        });

                        node._blockStrengths = updatedStrengths;
                        node._blockEnabled = updatedEnabled;
                        node._originalIndices = updatedOriginalIndices;
                        node._originalSubIndices = updatedOriginalSubIndices;

                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelector(`#reset-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        node._blockStrengths = node._blockStrengths.map(() => 1.0);
                        node._blockEnabled = node._blockEnabled.map(() => true);

                        container.querySelectorAll(".break-strength-slider").forEach(s => s.value = 1.0);
                        container.querySelectorAll(".break-strength-number").forEach(n => n.value = "1.00");
                        container.querySelectorAll(".break-block-checkbox").forEach(c => {
                            c.checked = true;
                            const row = c.closest(".block-row");
                            if (row) {
                                row.style.opacity = "1.0";
                                row.style.background = "#262626";
                            }
                        });
                        container.querySelectorAll(".break-strength-slider, .break-strength-number").forEach(el => el.removeAttribute("disabled"));

                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelectorAll(".break-block-checkbox").forEach(chk => {
                        chk.addEventListener("change", (e) => {
                            const index = parseInt(e.target.getAttribute("data-index"));
                            const isChecked = e.target.checked;
                            if (!isNaN(index)) {
                                node._blockEnabled[index] = isChecked;
                                node.syncWidgets();
                                node.updateBreakPreview();
                            }
                        });
                    });

                    container.querySelectorAll(".break-strength-slider").forEach(slider => {
                        slider.addEventListener("input", (e) => {
                            const index = parseInt(e.target.getAttribute("data-index"));
                            const val = parseFloat(e.target.value);
                            if (!isNaN(index) && !isNaN(val)) {
                                node._blockStrengths[index] = val;
                                const numInput = e.target.parentElement.querySelector(".break-strength-number");
                                if (numInput) numInput.value = val.toFixed(2);
                                node.syncWidgets();
                            }
                        });
                    });

                    container.querySelectorAll(".break-strength-number").forEach(numInput => {
                        numInput.addEventListener("input", (e) => {
                            const index = parseInt(e.target.getAttribute("data-index"));
                            const val = parseFloat(e.target.value);
                            if (!isNaN(index) && !isNaN(val)) {
                                node._blockStrengths[index] = val;
                                const slider = e.target.parentElement.querySelector(".break-strength-slider");
                                if (slider) slider.value = val;
                                node.syncWidgets();
                            }
                        });
                    });

                    node.syncWidgets();
                    node.setDirtyCanvas(true, true);
                };

                node.syncWidgets = function() {
                    const strengthsStr = (node._blockStrengths || []).join(", ");
                    const wStrengths = node.widgets?.find(widget => widget.name === "strengths");
                    if (wStrengths) {
                        wStrengths.value = strengthsStr;
                    }

                    const togglesStr = (node._blockEnabled || []).map(e => e ? "true" : "false").join(", ");
                    const wToggles = node.widgets?.find(widget => widget.name === "toggles");
                    if (wToggles) {
                        wToggles.value = togglesStr;
                    }

                    const tokensStr = `${node._totalTokens || 0};${(node._blockTokens || []).join(",")}`;
                    const wTokens = node.widgets?.find(widget => widget.name === "tokens");
                    if (wTokens) {
                        wTokens.value = tokensStr;
                    }

                    const wHeldText = node.widgets?.find(w => w.name === "held_text");
                    if (wHeldText) {
                        wHeldText.value = node._isHeld ? (node._heldText || node._receivedText || "") : "";
                    }

                    node.graph?.setDirtyCanvas(true, true);
                };

                function escapeHtml(string) {
                    return String(string).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }

                setTimeout(() => node.updateBreakPreview(), 50);
                return origNodeCreated ? origNodeCreated.apply(this, arguments) : undefined;
            };

            const origOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                const r = origOnExecuted ? origOnExecuted.apply(this, arguments) : undefined;
                if (message) {
                    if (message.text) {
                        const newText = Array.isArray(message.text) ? message.text[0] : message.text;
                        if (!this._isHeld && !this._heldText) {
                            this._receivedText = newText;
                            this._originalText = newText;
                            const textWidget = this.widgets?.find(w => w.name === "text");
                            if (textWidget) {
                                textWidget.value = this._receivedText;
                            }
                        }
                    }
                    if (message.total_tokens) {
                        this._totalTokens = Array.isArray(message.total_tokens) ? message.total_tokens[0] : message.total_tokens;
                    }
                    if (message.block_tokens) {
                        this._blockTokens = Array.isArray(message.block_tokens) ? message.block_tokens[0] : message.block_tokens;
                    }
                    this.syncWidgets?.();
                }
                this.updateBreakPreview?.();
                return r;
            };
        }
    }
});