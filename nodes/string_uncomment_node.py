class StringUncommentNode:
    def __init__(self):
        pass
        
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # Input-link only, no text widget box
                "text": ("STRING", {"forceInput": True}),
                # Toggle 1: Strip just the '#' character
                "uncomment": ("BOOLEAN", {"default": False, "label_on": "Uncomment: ON", "label_off": "Uncomment: OFF"}),
                # Toggle 2: Remove the entire line if it starts with '#'
                "remove_comment_line": ("BOOLEAN", {"default": False, "label_on": "Remove Line: ON", "label_off": "Remove Line: OFF"}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "process_text"
    CATEGORY = "agi/string"

    def process_text(self, text, uncomment, remove_comment_line):
        if text is None:
            return ("",)
            
        lines = text.splitlines()
        processed_lines = []

        for line in lines:
            stripped_line = line.lstrip()
            
            # Check if the line is a comment
            if stripped_line.startswith('#'):
                if remove_comment_line:
                    # If remove line is True, skip this line entirely
                    continue
                elif uncomment:
                    # If remove line is False but uncomment is True, strip the first '#'
                    processed_lines.append(line.replace('#', '', 1))
                else:
                    # Both are False: Leave the comment line completely untouched
                    processed_lines.append(line)
            else:
                # Normal line, keep as-is
                processed_lines.append(line)

        return ("\n".join(processed_lines),)


NODE_CLASS_MAPPINGS = {
    "StringUncommentNode": StringUncommentNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "StringUncommentNode": "String Comment Filter"
}