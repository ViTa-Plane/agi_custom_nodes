import re


class SimpleTextConcat:
    """A clean node that merges two strings with a custom delimiter."""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text_a": ("STRING", {"multiline": True, "default": ""}),
                "text_b": ("STRING", {"multiline": True, "default": ""}),
                "delimiter": ("STRING", {"default": ", "}),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "combine_text"
    CATEGORY = "agi/text"

    def combine_text(self, text_a, text_b, delimiter):
        combined = f"{text_a.strip()}{delimiter}{text_b.strip()}"
        return (combined,)


class CleanPromptWhitespace:
    """A node that strips accidental double spaces and trailing punctuation."""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "clean_text"
    CATEGORY = "agi/text"

    def clean_text(self, text):
        cleaned = re.sub(r'\s+', ' ', text).strip()
        cleaned = re.sub(r' ,', ',', cleaned)
        return (cleaned,)


NODE_CLASS_MAPPINGS = {
    "MCP_SimpleTextConcat": SimpleTextConcat,
    "MCP_CleanPromptWhitespace": CleanPromptWhitespace
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MCP_SimpleTextConcat": "Custom Text Concat",
    "MCP_CleanPromptWhitespace": "Clean Prompt Whitespace"
}