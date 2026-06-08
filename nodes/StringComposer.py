class StringComposer:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text_input": ("STRING", {"forceInput": True}),
                "prepend": ("STRING", {"default": "", "multiline": True}),
                "append": ("STRING", {"default": "", "multiline": True}),
                "separator": ("STRING", {"default": "\\", "multiline": False}),
            },
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "compose_string"
    CATEGORY = "agi/string"

    def compose_string(self, text_input, prepend, append, separator):
        # Gather components and filter out any that are empty or just whitespace
        components = [prepend, text_input, append]
        filtered_components = [str(c) for c in components if c and str(c).strip()]
        
        # Join with the backslash (or user-defined separator)
        result = separator.join(filtered_components)
        return (result,)

# Map the node's internal class name to the string used in workflows
NODE_CLASS_MAPPINGS = {
    "StringComposer": StringComposer
}

# Define the user-facing name displayed in the ComfyUI context menu
NODE_DISPLAY_NAME_MAPPINGS = {
    "StringComposer": "String Composer (Pre/App)"
}