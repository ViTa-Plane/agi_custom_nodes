import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "agi.PromptLineSelectorNode",
    nodeCreated(node) {
        if (node.comfyClass !== "PromptLineSelectorNode") return;

        const sourceWidget = node.widgets?.find((w) => w.name === "source");
        const filenameWidget = node.widgets?.find((w) => w.name === "filename");
        const textWidget = node.widgets?.find((w) => w.name === "text");
        const modeWidget = node.widgets?.find((w) => w.name === "mode");
        const indexWidget = node.widgets?.find((w) => w.name === "index");
        const startIndexWidget = node.widgets?.find((w) => w.name === "start_index");
        const endIndexWidget = node.widgets?.find((w) => w.name === "end_index");

        if (!sourceWidget) return;

        node._tmpTextCache = textWidget ? textWidget.value : "";
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

        const relayoutNode = () => {
            const currentSource = sourceWidget.value;
            const isTextMode = currentSource === "text widget";
            const currentMode = modeWidget ? modeWidget.value : "fixed";

            if (node._lastSource !== currentSource) {
                if (currentSource === "file") {
                    if (textWidget) node._tmpTextCache = textWidget.value;
                    if (filenameWidget) fetchAndSetFileText(filenameWidget.value);
                } else if (currentSource === "text widget") {
                    setWidgetText(node._tmpTextCache || "");
                    resetIndices(node._tmpTextCache || "");
                }
                node._lastSource = currentSource;
            }

            const currentWidth = Math.max(node.size[0], 340);
            const currentHeight = node.size[1];

            const activeWidgets = [sourceWidget];

            if (!isTextMode && filenameWidget) {
                activeWidgets.push(filenameWidget);
            }

            if (modeWidget) activeWidgets.push(modeWidget);

            if (currentMode === "fixed") {
                if (indexWidget) activeWidgets.push(indexWidget);
            } else {
                if (startIndexWidget) activeWidgets.push(startIndexWidget);
                if (endIndexWidget) activeWidgets.push(endIndexWidget);
            }

            if (textWidget) {
                activeWidgets.push(textWidget);
            }

            if (textWidget && textWidget.inputEl) {
                textWidget.inputEl.style.display = "block";
            }

            node.widgets = activeWidgets;

            const minSize = node.computeSize();
            const targetHeight = Math.max(currentHeight, minSize[1]);
            node.setSize([currentWidth, targetHeight]);

            app.graph?.setDirtyCanvas(true, true);
        };

        const origSourceCallback = sourceWidget.callback;
        sourceWidget.callback = function (value) {
            if (origSourceCallback) origSourceCallback.apply(this, arguments);
            resetIndices();
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
                updateLineCountLimits(calculateValidLines(value));
            };
        }

        setTimeout(() => {
            relayoutNode();
            if (textWidget) {
                updateLineCountLimits(calculateValidLines(textWidget.value));
            }
        }, 50);
    }
});