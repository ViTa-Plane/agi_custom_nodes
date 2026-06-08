import { app } from "/scripts/app.js";

app.registerExtension({
    name: "agi.IntIncrementer",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "IntIncrementer") {
            // Logic to run after the server (Python) finishes execution
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                if (message?.value) {
                    // Find the 'current_index' widget among the node's widgets
                    const widget = this.widgets.find((w) => w.name === "current_index");
                    if (widget) {
                        widget.value = message.value[0];
                        // Force the UI to visually refresh
                        this.setDirtyCanvas(true, true);
                    }
                }
            };
        }
    },
});