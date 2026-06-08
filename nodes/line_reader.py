import os
import folder_paths

class LineReader_v2:
    @classmethod
    def INPUT_TYPES(s):
        prompt_dir = os.path.join(folder_paths.get_input_directory(), "..", "user", "prompts")
        os.makedirs(prompt_dir, exist_ok=True)
        files = [f for f in os.listdir(prompt_dir) if f.endswith(".txt")]
        files.sort()
        
        return {
            "required": {
                "source": (["file", "text_override"], {"default": "file"}),
                "file_list": (["manual"] + files, {"default": "manual"}),
                "manual_path": ("STRING", {"default": "path/to/your/file.txt"}),
                "index": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "control_after_generate": True}),
                "start_index": ("INT", {"default": 0, "min": 0}),
                "max_index": ("INT", {"default": 0, "min": 0}),
                "skip_empty_lines": ("BOOLEAN", {"default": True}),
                "ignore_comments": ("BOOLEAN", {"default": True}),
            },
            "optional": {"text_override": ("STRING", {"multiline": True, "default": ""})}
        }

    RETURN_TYPES = ("STRING", "STRING", "INT", "STRING")
    RETURN_NAMES = ("text", "index_str", "file_max", "last_comment")
    FUNCTION = "process_file"
    CATEGORY = "agi/text"

    def process_file(self, source, file_list, manual_path, index, start_index, max_index, skip_empty_lines, ignore_comments, text_override=""):
        # 1. Load Data
        raw_lines = text_override.splitlines() if source == "text_override" else []
        source_name = "text_override"
        if source == "file":
            prompt_dir = os.path.join(folder_paths.get_input_directory(), "..", "user", "prompts")
            path = manual_path if file_list == "manual" else os.path.join(prompt_dir, file_list)
            source_name = os.path.basename(path)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f: raw_lines = f.readlines()

        processed = []
        for i, line in enumerate(raw_lines):
            l = line.strip()
            if skip_empty_lines and not l: continue
            if ignore_comments and l.startswith("#"): continue
            processed.append((l if skip_empty_lines else line.strip('\n'), i))

        abs_max = max(0, len(processed) - 1)
        if not processed: return ("Empty", "0", abs_max, "")

        # 2. Logic & Reset Detection (Sign-aware Modulo)
        limit = abs_max if (max_index <= 0 or max_index > abs_max) else max_index
        start = min(start_index, limit)
        window_size = (limit - start) + 1
        
        # Python's % handles negative numbers perfectly for decrementing loops
        target_idx = start + (index % window_size)

        # 3. Comment Extraction
        final_text, original_idx = processed[target_idx]
        last_comment = "" # Initialized to avoid NameError
        for i in range(original_idx - 1, -1, -1):
            stripped = raw_lines[i].strip()
            if stripped.startswith("#"):
                last_comment = stripped.lstrip("#").strip()
                break

        # 4. Console Print
        comment_display = f" ({last_comment})" if last_comment else ""
        print(f"\033[92m[LineReader_v2]\033[0m {source_name} | {target_idx}/{abs_max}{comment_display}")

        return {
            "ui": {
                "file_max": [abs_max],
                "sync_index": [target_idx] 
            }, 
            "result": (final_text, str(target_idx), abs_max, last_comment)
        }

NODE_CLASS_MAPPINGS = {
    "LineReader_v2": LineReader_v2
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LineReader_v2": "Text Line Reader v2"
}