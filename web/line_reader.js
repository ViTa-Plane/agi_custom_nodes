import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "agi.LineReader_v2",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "LineReader_v2") {
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                const indexW = this.widgets.find(w => w.name === "index");
                const startW = this.widgets.find(w => w.name === "start_index");
                const maxW = this.widgets.find(w => w.name === "max_index");

                // 1. Boundary Sync
                if (message?.file_max) {
                    const total = message.file_max[0];
                    [startW, maxW].forEach(w => { if (w) w.options.max = total; });
                    if (maxW && maxW.value === 0) maxW.value = total;
                }

                // 2. Manual Entry Guard
                // If a user manually types a negative number, snap it to 0.
                if (indexW && indexW.value < 0) {
                    // We only do this if it's not a 'sync' event
                    if (!message?.sync_index) {
                        indexW.value = 0;
                    }
                }

                // 3. Sync UI to server's wrapped index
                if (message?.sync_index !== undefined && indexW) {
                    const serverValue = message.sync_index[0];
                    requestAnimationFrame(() => {
                        indexW.value = serverValue;
                        if (indexW.callback) indexW.callback(indexW.value);
                        this.setDirtyCanvas(true, true);
                    });
                }
            };
        }
    },
});