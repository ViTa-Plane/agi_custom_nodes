// Version: v1.6.0
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
                if (!node._receivedText) {
                    node._receivedText = "";
                }
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
                    }
                    const origCb = textWidget.callback;
                    textWidget.callback = function() {
                        if (origCb) origCb.apply(this, arguments);
                        if (!node._isHeld) {
                            node._receivedText = textWidget.value;
                            node.updateBreakPreview?.();
                        }
                    };
                }

                const container = document.createElement("div");
                container.style.cssText = "color: #d7d7d7; background: #1e1e1e; border: 1px solid #333; padding: 10px; border-radius: 4px; font-size: 11px; font-family: monospace; box-sizing: border-box; width: 100%; max-width: 100%; overflow-y: auto; overflow-x: hidden;";

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
                    return escaped.replace(/\bBREAK\b/g, '<span style="color: #f28b82; font-weight: bold; background: #3c2f2f; padding: 1px 4px; border-radius: 2px;">BREAK</span>');
                }

                node.updateBreakPreview = function() {
                    // Only pull from textWidget if not held and we haven't locked text
                    if (!node._isHeld && textWidget && !node._receivedText) {
                        node._receivedText = textWidget.value || "";
                    }

                    const text = node._receivedText || "";

                    const rawBlocks = text ? text.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/) : [];
                    let validBlocks = [];
                    let savedStrengths = node._blockStrengths || [];
                    let savedEnabled = node._blockEnabled || [];
                    let savedBlockTokens = node._blockTokens || [];

                    let newStrengths = [];
                    let newEnabled = [];
                    let newBlockTokens = [];
                    let fallbackBlockTokens = [];

                    let validIdx = 0;
                    rawBlocks.forEach((block) => {
                        const cleaned = cleanTextBlock(block);
                        if (cleaned) {
                            validBlocks.push(cleaned);
                            const defaultStr = savedStrengths[validIdx] ?? 1.0;
                            newStrengths.push(defaultStr);

                            const defaultEnabled = savedEnabled[validIdx] !== undefined ? savedEnabled[validIdx] : true;
                            newEnabled.push(defaultEnabled);

                            const calculatedTokens = estimateTokens(cleaned);
                            newBlockTokens.push(calculatedTokens);
                            fallbackBlockTokens.push(calculatedTokens);
                            validIdx++;
                        }
                    });

                    node._blockStrengths = newStrengths;
                    node._blockEnabled = newEnabled;
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
                                    <button type="button" id="clear-held-btn-${node.id}" title="Clear text and reset to input" style="background: #333; color: #f28b82; border: 1px solid #555; border-radius: 3px; padding: 1px 6px; font-size: 10px; cursor: pointer;">🗑️ Reset</button>
                                </div>
                                <span style="color: #888; font-size: 10px;">CLIP Tokens: <strong style="color: #fff;">${activeTotalTokens}</strong></span>
                            </div>
                            <div id="received-text-box-${node.id}" style="width: 100%; min-width: 100%; max-width: 100%; min-height: 50px; height: 65px; max-height: 150px; background: #111; color: #00ffcc; border: 1px solid #444; border-radius: 3px; padding: 6px; font-family: monospace; font-size: 11px; box-sizing: border-box; overflow-y: auto; resize: vertical; word-break: break-word; cursor: text;" title="Double-click anywhere in text to insert BREAK">${highlightBreaks(text || "Type text here...")}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; margin-top: 10px; width: 100%; box-sizing: border-box;">
                            <span style="font-weight:bold; color:#8ab4f8;">Break Blocks (${validBlocks.length}):</span>
                            ${validBlocks.length > 0 ? `<button type="button" id="reset-btn-${node.id}" style="background: #333; color: #f28b82; border: 1px solid #555; border-radius: 3px; padding: 3px 8px; font-size: 10px; cursor: pointer;">↩ Reset Strengths</button>` : ''}
                        </div>
                    `;

                    if (validBlocks.length === 0) {
                        html += `<div style="color: #777; font-style: italic; padding: 4px;">No BREAK blocks detected.</div>`;
                    } else {
                        validBlocks.forEach((block, idx) => {
                            const strengthVal = node._blockStrengths[idx] ?? 1.0;
                            const isEnabled = node._blockEnabled[idx] ?? true;
                            const blockTokenCount = activeBlockTokens[idx] ?? 0;
                            const opacityStyle = isEnabled ? 'opacity: 1.0;' : 'opacity: 0.5; background: #1c1c1c;';

                            const isOverLimit = blockTokenCount > 75;
                            const tokenCountStyle = isOverLimit
                                ? 'color: #f28b82; font-weight: bold;'
                                : 'color: #888;';

                            html += `
                                <div class="block-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px; background: #262626; padding: 6px 8px; border-radius: 3px; width: 100%; box-sizing: border-box; ${opacityStyle}">
                                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                        <input type="checkbox" data-index="${idx}" class="break-block-checkbox" ${isEnabled ? 'checked' : ''} style="cursor: pointer; accent-color: #8ab4f8;" title="Enable/Disable block" />
                                        <span style="color:#f28b82; font-weight:bold;">[${idx + 1}]</span>
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

                    const oldTextBox = container.querySelector(`[id^="received-text-box-"]`);
                    const savedHeight = oldTextBox ? oldTextBox.style.height : null;

                    container.innerHTML = html;

                    if (savedHeight) {
                        const newTextBox = container.querySelector(`#received-text-box-${node.id}`);
                        if (newTextBox) newTextBox.style.height = savedHeight;
                    }

                    // Toggling Hold off only disables the lock; it preserves the current text
                    container.querySelector(`#hold-toggle-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        node._isHeld = !node._isHeld;
                        if (node._isHeld) {
                            node._heldText = node._receivedText;
                        } else {
                            node._heldText = ""; // clear held text payload so it routes normally on execution
                        }
                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    // Dedicated Reset button clears text and resumes syncing with input
                    container.querySelector(`#clear-held-btn-${node.id}`)?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        node._isHeld = false;
                        node._heldText = "";
                        node._receivedText = textWidget ? (textWidget.value || "") : "";
                        node.syncWidgets();
                        node.updateBreakPreview();
                    });

                    container.querySelector(`#received-text-box-${node.id}`)?.addEventListener("dblclick", (e) => {
                        e.preventDefault();
                        e.stopPropagation();

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
                        if (charIndex >= 0 && charIndex <= currentText.length) {
                            const updatedText = currentText.slice(0, charIndex) + " BREAK " + currentText.slice(charIndex);
                            node._receivedText = updatedText;
                        } else {
                            const updatedText = currentText ? currentText + " BREAK " : "BREAK";
                            node._receivedText = updatedText;
                        }

                        node._isHeld = true;
                        node._heldText = node._receivedText;

                        const newRawBlocks = node._receivedText.split(/\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*/);
                        let validCount = 0;
                        newRawBlocks.forEach(b => { if (cleanTextBlock(b)) validCount++; });

                        while (node._blockStrengths.length < validCount) {
                            node._blockStrengths.push(1.0);
                        }
                        while (node._blockEnabled.length < validCount) {
                            node._blockEnabled.push(true);
                        }

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