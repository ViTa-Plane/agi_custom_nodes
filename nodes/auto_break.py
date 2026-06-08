import re
from transformers import AutoTokenizer

class StringTokenBreakInjector:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "max_tokens": ("INT", {"default": 75, "min": 1, "max": 2048, "step": 1}),
            },
        }

    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("text", "total_tokens")
    FUNCTION = "AutoBreak"
    CATEGORY = "agi/string"

    def AutoBreak(self, text, max_tokens):
        # 1. Fallback/Default to CLIP tokenizer used by most SD models
        try:
            tokenizer = AutoTokenizer.from_pretrained("openai/clip-vit-large-patch14", local_files_only=True)
        except Exception:
            # If local cache isn't found, load it normally (will download if needed once)
            tokenizer = AutoTokenizer.from_pretrained("openai/clip-vit-large-patch14")

        # 2. Split the text by existing BREAK points to respect them
        break_pattern = re.compile(r'\s*,\s*BREAK\s*,\s*|\s*\bBREAK\b\s*')
        segments = break_pattern.split(text)
        
        processed_segments = []
        total_token_count = 0

        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue
                
            # Tokenize the current segment
            tokens = tokenizer.tokenize(segment)
            segment_token_count = len(tokens)
            total_token_count += segment_token_count

            # If the segment itself is longer than the allowed max_tokens, chunk it up
            if segment_token_count > max_tokens:
                words = segment.split(" ")
                current_chunk = []
                
                for word in words:
                    # Test token length if we add this word
                    test_str = " ".join(current_chunk + [word])
                    if len(tokenizer.tokenize(test_str)) > max_tokens and current_chunk:
                        processed_segments.append(" ".join(current_chunk))
                        current_chunk = [word]
                    else:
                        current_chunk.append(word)
                        
                if current_chunk:
                    processed_segments.append(" ".join(current_chunk))
            else:
                processed_segments.append(segment)

        # 3. Join all chunks back together using the standard ComfyUI ',BREAK,' format
        output_text = " ,BREAK, ".join(processed_segments)

        return (output_text, total_token_count)

# Mapping for ComfyUI to recognize the node
NODE_CLASS_MAPPINGS = {
    "StringTokenBreakInjector": StringTokenBreakInjector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "StringTokenBreakInjector": "Auto Break"
}