import re

class DynamicStringConcatenate:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "delimiter": ("STRING", {"default": ", "}),
                "cleanup": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "string_1": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "concatenate"
    CATEGORY = "agi/string"

    def concatenate(self, delimiter, cleanup, **kwargs):
        raw_segments = []
        sorted_keys = sorted(kwargs.keys(), key=lambda x: int(x.split('_')[-1]) if x.split('_')[-1].isdigit() else 0)
        
        for key in sorted_keys:
            if kwargs[key] is not None:
                val_str = str(kwargs[key])
                
                # Check if the input contains multiple lines
                if "\n" in val_str:
                    # Split by line breaks and add individual lines to our list
                    lines = val_str.splitlines()
                    raw_segments.extend(lines)
                else:
                    raw_segments.append(val_str)
        
        # If cleanup is enabled, filter out empty elements or whitespace-only lines
        if cleanup:
            final_segments = [seg.strip() for seg in raw_segments if seg.strip() != ""]
        else:
            final_segments = raw_segments
            
        # Join all segments using the designated delimiter
        result = delimiter.join(final_segments)
        
        # Post-processing brute-force cleanup for duplicate delimiters if cleanup is active
        if cleanup and delimiter:
            escaped_delim = re.escape(delimiter.strip())
            if escaped_delim:
                # Collapses repeating strings of delimiters (e.g., ", , , ")
                pattern = f"(?:{escaped_delim}\\s*){{2,}}"
                result = re.sub(pattern, delimiter, result)
                
                # Trim accidental delimiters sitting at the very start or end
                result = re.sub(f"^{escaped_delim}\\s*|\\s*{escaped_delim}$", "", result)
                
        # Final safety pass for literal duplicate commas
        if cleanup:
            result = re.sub(r',+', ',', result)
            result = re.sub(r'(\s*,\s*)+', ', ', result)
            result = result.strip().strip(',')
            
        return (result,)

NODE_CLASS_MAPPINGS = {
    "DynamicStringConcatenate": DynamicStringConcatenate
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DynamicStringConcatenate": "Dynamic String Concatenate"
}