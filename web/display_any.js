import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

app.registerExtension({
    name: "agi.DisplayAnyData",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "DisplayAnyData") {

            // Helper function to create or update the multiline text widget
            function populateTextWidget(node, text) {
                let widget = node.widgets?.find((w) => w.name === "display_text");

                if (!widget) {
                    // Create multiline text widget using standard ComfyUI widgets
                    widget = ComfyWidgets.STRING(
                        node,
                        "display_text",
                        ["STRING", { multiline: true }],
                        app
                    ).widget;

                    // Make the text area read-only & adjust appearance
                    if (widget.inputEl) {
                        widget.inputEl.readOnly = true;
                        widget.inputEl.style.opacity = "0.85";
                        widget.inputEl.style.fontSize = "12px";
                        widget.inputEl.style.fontFamily = "monospace";
                    }
                }

                widget.value = text;

                // Adjust node dimensions for multiline reading
                const currentWidth = Math.max(node.size[0], 360);
                const currentHeight = Math.max(node.size[1], 200);
                node.setSize([currentWidth, currentHeight]);
            }

            // Trigger when node receives execution results from Python backend
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                if (message?.text) {
                    const textToDisplay = Array.isArray(message.text)
                        ? message.text.join("\n")
                        : String(message.text);

                    populateTextWidget(this, textToDisplay);
                    app.graph.setDirtyCanvas(true, true);
                }
            };
        }
    }
});