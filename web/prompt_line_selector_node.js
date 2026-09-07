import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "agi.PromptLineSelectorNode",
    nodeCreated(node) {
        if (node.comfyClass !== "PromptLineSelectorNode") return;

        const sourceWidget = node.widgets?.find((w) => w.name === "source");
        const filenameWidget = node.widgets?.find((w) => w.name === "filename");
        const modeWidget = node.widgets?.find((w) => w.name === "mode");
        const indexWidget = node.widgets?.find((w) => w.name === "index");
        const startIndexWidget = node.widgets?.find((w) => w.name === "start_index");
        const endIndexWidget = node.widgets?.find((w) => w.name === "end_index");
        const textWidget = node.widgets?.find((w) => w.name === "text");

        if (!sourceWidget) return;

        // Backup original draw and size methods for canvas widgets
        node.widgets.forEach((w) => {
            if (w && !w._origDraw) {
                w._origDraw = w.draw;
                w._origComputeSize = w.computeSize;
            }
        });

        // Dedicated cache for user-typed text
        node._userTextCache = textWidget ? textWidget.value : "";
        node._lastSource = sourceWidget.value;

        const calculateValidLines = (str) => {
            if (!str) return 0;
            return str.split("\n").filter((line) => {
                const trimmed = line.trim();
                return trimmed.length > 0 && !trimmed.startsWith("#");
            }).length;
        };

        const updateLineCountLimits = (lineCount) => {
            const maxIdx = Math.max(0, lineCount - 1);
            [indexWidget, startIndexWidget, endIndexWidget].forEach((w) => {
                if (w && w.options) {
                    w.options.max = maxIdx;
                }
            });
            if (endIndexWidget && (endIndexWidget.value === 0 || endIndexWidget.value > maxIdx)) {
                endIndexWidget.value = maxIdx;
            }
        };

        const resetIndices = (customText = null) => {
            const targetText = customText !== null ? customText : (textWidget ? textWidget.value : "");
            const lineCount = calculateValidLines(targetText);
            const maxIdx = Math.max(0, lineCount - 1);
            
            if (startIndexWidget) startIndexWidget.value = 0;
            if (endIndexWidget) endIndexWidget.value = maxIdx;
            if (indexWidget) indexWidget.value = 0;
            
            updateLineCountLimits(lineCount);
        };

        const setWidgetText = (val) => {
            if (textWidget) {
                textWidget.value = val;
                if (textWidget.inputEl) {
                    textWidget.inputEl.value = val;
                }
                updateLineCountLimits(calculateValidLines(val));
                app.graph?.setDirtyCanvas(true, true);
            }
        };

        const fetchAndSetFileText = async (filename) => {
            if (!filename || filename === "none") return;
            try {
                const response = await api.fetchApi(`/agi/get_prompt_file?filename=${encodeURIComponent(filename)}`);
                const data = await response.json();
                if (data && data.text !== undefined) {
                    setWidgetText(data.text);
                    resetIndices(data.text);
                }
            } catch (e) {
                console.error("[PromptLineSelectorNode] Error fetching prompt file:", e);
            }
        };

        // Complete canvas & DOM visibility toggle
        const setWidgetVisibility = (widget, visible) => {
            if (!widget) return;
            
            if (visible) {
                widget.draw = widget._origDraw;
                widget.computeSize = widget._origComputeSize;
                if (widget.inputEl) {
                    widget.inputEl.style.display = "";
                    if (widget.inputEl.parentElement) {
                        widget.inputEl.parentElement.style.display = "";
                    }
                }
            } else {
                widget.draw = () => {}; // Suppress Canvas Drawing
                widget.computeSize = () => [0, -4]; // Zero-out layout height allocation
                if (widget.inputEl) {
                    widget.inputEl.style.display = "none";
                    if (widget.inputEl.parentElement) {
                        widget.inputEl.parentElement.style.display = "none";
                    }
                }
            }
        };

        const relayoutNode = () => {
            const currentSource = sourceWidget.value;
            const isTextMode = currentSource === "text widget";
            const currentMode = modeWidget ? modeWidget.value : "fixed";

            if (node._lastSource !== currentSource) {
                if (currentSource === "file") {
                    if (textWidget) {
                        const liveVal = textWidget.inputEl ? textWidget.inputEl.value : textWidget.value;
                        node._userTextCache = liveVal;
                    }
                    if (filenameWidget) fetchAndSetFileText(filenameWidget.value);
                } else if (currentSource === "text widget") {
                    setWidgetText(node._userTextCache || "");
                    resetIndices(node._userTextCache || "");
                }
                node._lastSource = currentSource;
            }

            // Apply draw suppression & zero-size calculation
            setWidgetVisibility(filenameWidget, !isTextMode);
            setWidgetVisibility(indexWidget, currentMode === "fixed");
            setWidgetVisibility(startIndexWidget, currentMode !== "fixed");
            setWidgetVisibility(endIndexWidget, currentMode !== "fixed");

            const minSize = node.computeSize();
            const targetWidth = Math.max(node.size[0], 340);
            const targetHeight = Math.max(node.size[1], minSize[1]);
            node.setSize([targetWidth, targetHeight]);

            app.graph?.setDirtyCanvas(true, true);
        };

        const bindDOMInputListener = () => {
            if (textWidget && textWidget.inputEl && !textWidget._hasInputListener) {
                textWidget.inputEl.addEventListener("input", (e) => {
                    if (sourceWidget.value === "text widget") {
                        node._userTextCache = e.target.value;
                        textWidget.value = e.target.value;
                        updateLineCountLimits(calculateValidLines(e.target.value));
                    }
                });
                textWidget._hasInputListener = true;
            }
        };

        // Callbacks
        const origSourceCallback = sourceWidget.callback;
        sourceWidget.callback = function (value) {
            if (origSourceCallback) origSourceCallback.apply(this, arguments);
            relayoutNode();
        };

        if (modeWidget) {
            const origModeCallback = modeWidget.callback;
            modeWidget.callback = function (value) {
                if (origModeCallback) origModeCallback.apply(this, arguments);
                resetIndices();
                relayoutNode();
            };
        }

        if (filenameWidget) {
            const origFilenameCallback = filenameWidget.callback;
            filenameWidget.callback = function (value) {
                if (origFilenameCallback) origFilenameCallback.apply(this, arguments);
                if (sourceWidget.value === "file") {
                    fetchAndSetFileText(value);
                }
            };
        }

        if (textWidget) {
            const origTextCallback = textWidget.callback;
            textWidget.callback = function (value) {
                if (origTextCallback) origTextCallback.apply(this, arguments);
                if (sourceWidget.value === "text widget") {
                    node._userTextCache = value;
                }
                updateLineCountLimits(calculateValidLines(value));
            };
        }

        const origOnSerialize = node.onSerialize;
        node.onSerialize = function (o) {
            if (sourceWidget.value === "text widget" && textWidget) {
                const liveVal = textWidget.inputEl ? textWidget.inputEl.value : node._userTextCache;
                textWidget.value = liveVal;
                node._userTextCache = liveVal;
            }
            if (origOnSerialize) origOnSerialize.apply(this, arguments);
        };

        const origOnConfigure = node.onConfigure;
        node.onConfigure = function () {
            if (origOnConfigure) origOnConfigure.apply(this, arguments);
            if (textWidget && textWidget.value) {
                node._userTextCache = textWidget.value;
            }
            relayoutNode();
            bindDOMInputListener();
        };

        setTimeout(() => {
            relayoutNode();
            bindDOMInputListener();
            if (textWidget) {
                updateLineCountLimits(calculateValidLines(textWidget.value));
            }
        }, 50);
    }
});
