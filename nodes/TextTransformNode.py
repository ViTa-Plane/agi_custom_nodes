# ==============================================================================
# Text Transformer (Replace Spaces & Lowercase Toggles)
# ==============================================================================
class TextTransformNode:
    """
    Utility node that modifies a input string with toggles to:
    1. Replace spaces with underscores
    2. Convert text to lowercase
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "forceInput": True  # Allows connecting directly from another node output
                }),
                "replace_spaces": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Spaces -> Underscores ('_')",
                    "label_off": "Keep original spaces"
                }),
                "lowercase": ("BOOLEAN", {
                    "default": False,
                    "label_on": "Lowercase",
                    "label_off": "Keep original case"
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("transformed_text",)
    FUNCTION = "transform_text"
    CATEGORY = "agi/text"

    def transform_text(self, text, replace_spaces, lowercase):
        output = str(text)

        if replace_spaces:
            output = output.replace(" ", "_")

        if lowercase:
            output = output.lower()

        return (output,)


# ==============================================================================
# ComfyUI Mappings
# ==============================================================================
NODE_CLASS_MAPPINGS = {
    "TextTransformNode": TextTransformNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TextTransformNode": "Text Formatting"
}