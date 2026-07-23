class UniversalTextReplacer:
    """
    ComfyUI node to replace {text1} and {text2} placeholders with 
    their corresponding text values.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_text": ("STRING", {
                    "multiline": True, 
                    "default": "A high quality photo of {text1} standing in {text2}, 8k resolution."
                }),
            },
            "optional": {
                "text1": ("STRING", {
                    "multiline": False, 
                    "default": "a cybernetic wolf",
                    "tooltip": "Replaces all occurrences of {text1}"
                }),
                "text2": ("STRING", {
                    "multiline": False, 
                    "default": "a neon lit street in Tokyo",
                    "tooltip": "Replaces all occurrences of {text2}"
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "replace_text"
    CATEGORY = "agi/string"

    def replace_text(self, input_text, text1="", text2=""):
        # Replace {text1} and {text2} with input widget values
        processed_text = input_text.replace("{text1}", text1).replace("{text2}", text2)
        
        return (processed_text,)


NODE_CLASS_MAPPINGS = {
    "UniversalTextReplacer": UniversalTextReplacer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "UniversalTextReplacer": "Replace {text1} & {text2}"
}