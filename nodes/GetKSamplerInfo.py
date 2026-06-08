import nodes

class GetKSamplerInfo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "node_id": ("INT", {"default": 0, "min": 0, "max": 1000000}),
                "delimiter": ("STRING", {"default": "_"}),
                "base_string": ("STRING", {"default": ""}),
            },
            "hidden": {"prompt": "PROMPT"},
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_sampler_data"
    CATEGORY = "agi/utils"

    def get_sampler_data(self, node_id, delimiter, base_string, prompt=None):
        if prompt is None:
            return ("(Error: No prompt data)",)
            
        str_id = str(node_id)
        
        if str_id not in prompt:
            # If the node isn't found, we still return the base string if it exists
            err_msg = f"(Node_{node_id}_Not_Found)"
            return (f"{base_string}{delimiter}{err_msg}" if base_string else err_msg,)
            
        node_data = prompt[str_id]
        inputs = node_data.get("inputs", {})
        
        # Comprehensive list of KSampler parameters
        targets = ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise']
        results = []

        for key in targets:
            if key in inputs:
                val = inputs[key]
                
                # Logic to follow wires if the widget is converted to an input
                if isinstance(val, list) and len(val) == 2:
                    parent_id = str(val[0])
                    parent_node = prompt.get(parent_id, {})
                    parent_inputs = parent_node.get("inputs", {})
                    
                    found_val = None
                    # Search common keys in the source node (Primitives, Generators, etc.)
                    for p_key in ["value", "seed", "steps", "text", "string", "number"]:
                        if p_key in parent_inputs:
                            found_val = str(parent_inputs[p_key])
                            break
                    
                    results.append(found_val if found_val is not None else f"Node{parent_id}")
                else:
                    # Direct widget value
                    results.append(str(val))
            else:
                results.append("NA")

        # Create the metadata string wrapped in ()
        metadata = f"({delimiter.join(results)})"
        
        # Combine with base_string if provided
        if base_string and base_string.strip():
            final_output = f"{base_string}{delimiter}{metadata}"
        else:
            final_output = metadata

        return (final_output,)

    @classmethod
    def IS_CHANGED(s, **kwargs):
        # Force refresh to capture real-time slider/seed changes
        return float("NaN")

# Map the node's internal class name to the string used in workflows
NODE_CLASS_MAPPINGS = {
    "GetKSamplerInfo": GetKSamplerInfo
}

# Define the user-facing name displayed in the ComfyUI context menu
NODE_DISPLAY_NAME_MAPPINGS = {
    "GetKSamplerInfo": "Get KSampler Info"
}