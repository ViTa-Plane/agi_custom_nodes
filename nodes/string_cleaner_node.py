import re

class StringCleanerNode:
    def __init__(self):
        pass
        
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remove_comments": ("BOOLEAN", {"default": True}), # New option (runs first)
                "clean_duplicate_commas": ("BOOLEAN", {"default": True}),
                "clean_extra_newlines": ("BOOLEAN", {"default": True}),
                "clean_all_newlines": ("BOOLEAN", {"default": False}),
                "clean_extra_spaces": ("BOOLEAN", {"default": True}),
                "trim_edges": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "text": ("STRING", {"forceInput": True}), 
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("cleaned_text",)
    FUNCTION = "clean_string"
    CATEGORY = "agi/string"

    def clean_string(self, remove_comments, clean_duplicate_commas, clean_extra_newlines, clean_all_newlines, clean_extra_spaces, trim_edges, text=""):
        if not text:
            return ("",)

        cleaned = text

        # 1. Remove Comments (Runs first to prevent structural corruption)
        if remove_comments:
            # Split into lines, filter out any line that starts with '#' (ignoring leading whitespace)
            lines = cleaned.split('\n')
            filtered_lines = []
            for line in lines:
                # .lstrip() ensures lines like "   # comment" are caught too
                if not line.lstrip().startswith('#'):
                    filtered_lines.append(line)
            cleaned = '\n'.join(filtered_lines)

        # 2. Clean All Newlines (Converts the text into a single line)
        if clean_all_newlines:
            cleaned = re.sub(r'\s*\n\s*', ' ', cleaned)
        # 3. Clean Extra Newlines (Only shrinks stacked gaps)
        elif clean_extra_newlines:
            cleaned = re.sub(r'\n+', '\n', cleaned)

        # 4. Clean Duplicate Commas
        if clean_duplicate_commas:
            if clean_all_newlines:
                cleaned = re.sub(r',[\s,]*', ',', cleaned)
                cleaned = re.sub(r'\s*,\s*', ', ', cleaned)
            else:
                cleaned = re.sub(r',[ \t,]*', ',', cleaned)
                cleaned = re.sub(r'[ \t]*,[ \t]*', ', ', cleaned)

        # 5. Clean Extra Spaces
        if clean_extra_spaces:
            cleaned = re.sub(r'[ \t]+', ' ', cleaned)

        # 6. Trim Edges
        if trim_edges:
            if clean_all_newlines:
                cleaned = cleaned.strip()
            else:
                lines = [line.strip() for line in cleaned.split('\n')]
                if clean_extra_newlines:
                    lines = [line for line in lines if line]
                cleaned = '\n'.join(lines).strip()

        # Final safety cleanup for double spaces
        if clean_extra_spaces:
            if clean_all_newlines:
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            else:
                cleaned = re.sub(r'[ \t]+', ' ', cleaned)

        return (cleaned,)

NODE_CLASS_MAPPINGS = {
    "StringCleanerNode": StringCleanerNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "StringCleanerNode": "String Cleaner"
}