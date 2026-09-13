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

        node.widgets.forEach((w) => {
            if (w && !w._origDraw) {
                w._origDraw = w.draw;
                w._origComputeSize = w.computeSize;
            }
        });

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
                widget.draw = () => {};
                widget.computeSize = () => [0, -4];
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

            setWidgetVisibility(filenameWidget, !isTextMode);
            setWidgetVisibility(indexWidget, true);
            setWidgetVisibility(startIndexWidget, currentMode !== "fixed");
            setWidgetVisibility(endIndexWidget, currentMode !== "fixed");

            const minSize = node.computeSize();
            const targetWidth = Math.max(node.size[0], 340);
            const targetHeight = Math.max(node.size[1], minSize[1]);
            node.setSize([targetWidth, targetHeight]);

            app.graph?.setDirtyCanvas(true, true);
        };

        api.addEventListener("agi_prompt_selector_executed", (event) => {
            if (event.detail && event.detail.node == node.id) {
                if (indexWidget && event.detail.index !== undefined) {
                    indexWidget.value = event.detail.index;
                    app.graph?.setDirtyCanvas(true, true);
                }
            }
        });

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

        if (indexWidget) {
            const origIndexCallback = indexWidget.callback;
            indexWidget.callback = function (value) {
                if (origIndexCallback) origIndexCallback.apply(this, arguments);
                app.graph?.setDirtyCanvas(true, true);
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

        const origOnConfigure = node.onConfigure;
        node.onConfigure = function () {
            if (origOnConfigure) origOnConfigure.apply(this, arguments);
            if (textWidget && textWidget.value) {
                node._userTextCache = textWidget.value;
            }
            relayoutNode();
        };

        setTimeout(() => {
            relayoutNode();
            if (textWidget) {
                updateLineCountLimits(calculateValidLines(textWidget.value));
            }
        }, 50);
    }
});
