import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "StringTools.DynamicConcatenate",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "DynamicStringConcatenate") {
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            
            nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
                if (onConnectionsChange) {
                    onConnectionsChange.apply(this, arguments);
                }

                // Only monitor input connections
                if (type === 1) {
                    // 1. Calculate the highest index currently on the node
                    let lastIndex = 0;
                    for (const input of this.inputs) {
                        const match = input.name.match(/^string_(\d+)$/);
                        if (match) {
                            lastIndex = Math.max(lastIndex, parseInt(match[1]));
                        }
                    }

                    // Ensure we always start with at least string_1
                    if (lastIndex === 0) lastIndex = 1;

                    // 2. Find the actual slot object for that highest index
                    const lastInput = this.inputs.find(i => i.name === `string_${lastIndex}`);
                    
                    // 3. If the highest slot is connected, spawn the NEXT available number
                    if (connected && lastInput && lastInput.link !== null) {
                        this.addInput(`string_${lastIndex + 1}`, "STRING");
                    } 
                    // 4. If someone disconnected a wire, run the smart cleanup
                    else if (!connected) {
                        // Loop backwards and remove unlinked trailing slots
                        for (let i = this.inputs.length - 1; i >= 0; i--) {
                            const input = this.inputs[i];
                            const match = input.name.match(/^string_(\d+)$/);
                            
                            if (match) {
                                const currentNum = parseInt(match[1]);
                                
                                // SAFEGUARD: Never delete string_1, and never delete an input that has a wire
                                if (currentNum > 1 && input.link === null) {
                                    // Check if the input BEFORE this one is ALSO empty. 
                                    // We only delete if there's already an empty slot waiting above it.
                                    const prevInput = this.inputs.find(p => p.name === `string_${currentNum - 1}`);
                                    if (prevInput && prevInput.link === null) {
                                        this.removeInput(i);
                                    }
                                }
                            }
                        }
                    }
                }
            };
        }
    }
});