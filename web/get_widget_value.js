import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "Agi.GetWidgetValue.NodeAndWidgetDropdowns",
    async nodeCreated(node) {
        if (node.comfyClass === "GetWidgetValue") {
            const nodeIdWidget = node.widgets.find(w => w.name === "node_id");
            let targetNodeWidget = node.widgets.find(w => w.name === "target_node");
            let widgetNameWidget = node.widgets.find(w => w.name === "widget_name");

            if (nodeIdWidget && targetNodeWidget && widgetNameWidget) {
                // Forcefully keep node_id hidden and collapsed permanently
                const hideNodeIdWidget = () => {
                    nodeIdWidget.type = "hidden";
                    nodeIdWidget.computeSize = () => [0, -4];
                    nodeIdWidget.hidden = true;
                };
                hideNodeIdWidget();

                // Convert target_node into a combo dropdown if it isn't one
                if (targetNodeWidget.type !== "combo") {
                    const currentVal = targetNodeWidget.value;
                    const idx = node.widgets.indexOf(targetNodeWidget);
                    if (idx !== -1) {
                        node.widgets.splice(idx, 1);
                        targetNodeWidget = node.addWidget("combo", "target_node", currentVal, function(v) {}, { values: ["none"] });
                    }
                }

                // Convert widget_name into a combo dropdown if it isn't one
                if (widgetNameWidget.type !== "combo") {
                    const currentVal = widgetNameWidget.value;
                    const idx = node.widgets.indexOf(widgetNameWidget);
                    if (idx !== -1) {
                        node.widgets.splice(idx, 1);
                        widgetNameWidget = node.addWidget("combo", "widget_name", currentVal, function(v) {}, { values: ["none"] });
                    }
                }

                // Function to populate and numerically sort available nodes in the graph
                const updateNodeList = () => {
                    hideNodeIdWidget(); // Ensure it stays hidden during updates
                    if (!app.graph || !app.graph._nodes) return;

                    const nodeMap = {};
                    const nodeList = [];

                    app.graph._nodes.forEach(n => {
                        // Skip itself to avoid recursive loops
                        if (n.id === node.id) return;
                        const title = n.title || n.type || "Node";
                        const label = `${n.id}: ${title}`;
                        nodeList.push({ id: n.id, label: label });
                        nodeMap[label] = n.id;
                    });

                    // Sort nodes numerically by their ID
                    nodeList.sort((a, b) => a.id - b.id);

                    let nodeChoices = ["none"];
                    nodeList.forEach(item => {
                        nodeChoices.push(item.label);
                    });

                    targetNodeWidget.options.values = nodeChoices;

                    // If current value is missing, reset
                    if (!nodeChoices.includes(targetNodeWidget.value)) {
                        targetNodeWidget.value = nodeChoices[0];
                    }

                    updateWidgetList(nodeMap);
                };

                // Function to populate widget options from the selected target node
                const updateWidgetList = (nodeMap) => {
                    hideNodeIdWidget();
                    if (!nodeMap) {
                        nodeMap = {};
                        if (app.graph && app.graph._nodes) {
                            app.graph._nodes.forEach(n => {
                                nodeMap[`${n.id}: ${n.title || n.type}`] = n.id;
                            });
                        }
                    }

                    const selectedLabel = targetNodeWidget.value;
                    let targetId = 0;

                    if (selectedLabel && selectedLabel !== "none" && nodeMap[selectedLabel] !== undefined) {
                        targetId = nodeMap[selectedLabel];
                    }

                    // Set the backend hidden node_id value
                    nodeIdWidget.value = targetId;

                    // Find target node object in graph
                    const targetNode = app.graph.getNodeById(targetId);
                    let widgetChoices = ["none"];

                    if (targetNode && targetNode.widgets) {
                        const widgetNames = targetNode.widgets.map(w => w.name);
                        if (widgetNames.length > 0) {
                            widgetChoices = widgetNames;
                        }
                    }

                    widgetNameWidget.options.values = widgetChoices;
                    if (!widgetChoices.includes(widgetNameWidget.value)) {
                        widgetNameWidget.value = widgetChoices[0];
                    }

                    if (node.setDirtyCanvas) {
                        node.setDirtyCanvas(true, true);
                    }
                };

                // Hook callback when target_node dropdown selection changes
                const originalTargetCallback = targetNodeWidget.callback;
                targetNodeWidget.callback = function(v) {
                    if (originalTargetCallback) {
                        originalTargetCallback.apply(this, arguments);
                    }
                    updateWidgetList();
                };

                // Intercept draw/layout updates to force-hide node_id whenever the node moves or renders
                const originalOnDrawForeground = node.onDrawForeground;
                node.onDrawForeground = function(ctx) {
                    hideNodeIdWidget();
                    if (originalOnDrawForeground) {
                        originalOnDrawForeground.apply(this, arguments);
                    }
                };

                const originalOnConfigure = node.onConfigure;
                node.onConfigure = function() {
                    if (originalOnConfigure) originalOnConfigure.apply(this, arguments);
                    setTimeout(updateNodeList, 100);
                };

                // Initial population loop
                setTimeout(updateNodeList, 300);
            }
        }
    }
});