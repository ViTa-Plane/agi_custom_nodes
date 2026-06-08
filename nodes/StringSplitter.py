class StringSplitter:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "delimiter": ("STRING", {"default": "\\"}),
                "remove": ("STRING", {"default": ".safetensors"}),
            },
        }

    # Added a second STRING output
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("multiline_text", "last_part")
    FUNCTION = "process_string"
    CATEGORY = "agi/string"

    def process_string(self, text, delimiter, remove):
        # 1. Remove the specified string/extension
        if remove:
            text = text.replace(remove, "")
        
        # 2. Resolve common escape sequences
        if delimiter == "\\n":
            resolved_delimiter = "\n"
        elif delimiter == "\\t":
            resolved_delimiter = "\t"
        else:
            resolved_delimiter = delimiter
        
        # 3. Split the string
        parts = text.split(resolved_delimiter)
        
        # 4. Generate the two outputs
        multiline_result = "\n".join(parts)
        # Grab the last item in the list
        last_item = parts[-1] if len(parts) > 0 else text
        
        return (multiline_result, last_item)

NODE_CLASS_MAPPINGS = {
    "StringSplitter": StringSplitter
}

# Define the user-facing name displayed in the ComfyUI context menu
NODE_DISPLAY_NAME_MAPPINGS = {
    "StringSplitter": "String Splitter"
}