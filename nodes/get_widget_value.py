class AgiWidgetToString:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # Only these two are needed to find the target
                "node_id": ("INT", {"default": 0, "min": 0, "max": 1000000}),
                "widget_name": ("STRING", {"default": "ckpt_name"}),
            },
            # We use the hidden prompt to 'peek' at the rest of the graph
            "hidden": {"prompt": "PROMPT"},
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_value"
    CATEGORY = "agi/utils"

    def get_value(self, node_id, widget_name, prompt=None):
        if prompt is None:
            return ("Error: Workflow data not accessible",)
            
        str_id = str(node_id)
        
        if str_id in prompt:
            node_data = prompt[str_id]
            widgets = node_data.get("inputs", {})
            
            if widget_name in widgets:
                value = widgets[widget_name]
                
                # If it's a direct value (String, Int, Float)
                if not isinstance(value, list):
                    return (str(value),)
                
                # If it's a link [NodeID, OutputIndex], we try to resolve it
                if isinstance(value, list) and len(value) == 2:
                    parent_id = str(value[0])
                    parent_node = prompt.get(parent_id, {})
                    parent_inputs = parent_node.get("inputs", {})
                    
                    # Try to find the most likely value on the source node
                    for key in ["value", "text", "string", "ckpt_name"]:
                        if key in parent_inputs:
                            return (str(parent_inputs[key]),)
                    
                    return (f"Node {parent_id} (Linked)",)
            
            return (f"Error: Widget '{widget_name}' not found",)
        return (f"Error: Node {node_id} not found",)

    @classmethod
    def IS_CHANGED(s, **kwargs):
        # Force the node to refresh every time you hit 'Queue Prompt'
        return float("NaN")

NODE_CLASS_MAPPINGS = {
    "AgiWidgetToString": AgiWidgetToString
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AgiWidgetToString": "Widget To String"
}