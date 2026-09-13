import os
import random
import uuid
from aiohttp import web
from server import PromptServer

NODE_ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), ".."))


def get_prompts_dir():
    prompts_dir = os.path.join(NODE_ROOT_DIR, "prompts")
    os.makedirs(prompts_dir, exist_ok=True)
    return prompts_dir


@PromptServer.instance.routes.get("/agi/get_prompt_file")
async def get_prompt_file(request):
    filename = request.query.get("filename", "")
    if not filename or filename == "none":
        return web.json_response({"text": "", "total_lines": 0})

    prompts_dir = get_prompts_dir()
    file_path = os.path.abspath(os.path.join(prompts_dir, filename))

    if not file_path.startswith(prompts_dir):
        return web.json_response({"text": "Access denied", "total_lines": 0}, status=403)

    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            filtered_lines = [
                line.strip() for line in content.splitlines()
                if line.strip() and not line.strip().startswith("#")
            ]
            return web.json_response({"text": content, "total_lines": len(filtered_lines)})
        except Exception as e:
            return web.json_response({"text": f"Error reading file: {str(e)}", "total_lines": 0}, status=500)

    return web.json_response({"text": f"File not found: {filename}", "total_lines": 0}, status=404)


class PromptLineSelectorNode:
    DEBUG_MODE = True
    _last_executed = {}
    _last_user_index = {}

    @classmethod
    def IS_CHANGED(s, source, mode, node_id, filename="none", index=0, start_index=0, end_index=0, text=""):
        if mode in ["random", "increment", "decrement"]:
            return uuid.uuid4().hex
        return f"{source}_{filename}_{text}_{index}"

    @classmethod
    def INPUT_TYPES(s):
        prompts_dir = get_prompts_dir()

        files = []
        if os.path.exists(prompts_dir):
            for root, _, filenames in os.walk(prompts_dir):
                for f in filenames:
                    if f.endswith('.txt'):
                        full_path = os.path.join(root, f)
                        rel_path = os.path.relpath(full_path, prompts_dir)
                        files.append(rel_path)

        files = sorted(files) if files else ["none"]

        return {
            "required": {
                "source": (["text widget", "file"], {"default": "text widget"}),
                "mode": (["fixed", "random", "increment", "decrement"], {"default": "fixed"}),
            },
            "optional": {
                "filename": (files, {"default": files[0]}),
                "index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1}),
                "start_index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1}),
                "end_index": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1}),
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("line", "comment", "index")
    FUNCTION = "process_text"
    CATEGORY = "agi/Prompt Utility"

    def process_text(self, source, mode, node_id, filename="none", index=0, start_index=0, end_index=0, text=""):
        full_text = text if text else ""

        if source == "file" and filename and filename != "none":
            prompts_dir = get_prompts_dir()
            file_path = os.path.abspath(os.path.join(prompts_dir, filename))

            if file_path.startswith(prompts_dir) and os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        full_text = f.read()
                except Exception as e:
                    full_text = f"Error reading file: {str(e)}"

        all_lines = full_text.splitlines()

        valid_entries = [
            (i, line.strip())
            for i, line in enumerate(all_lines)
            if line.strip() and not line.strip().startswith("#")
        ]

        if not valid_entries:
            if PromptLineSelectorNode.DEBUG_MODE:
                print(f"[PromptLineSelectorNode Debug] Node ID: {node_id} | No valid lines found.")
            return ("", "", 0)

        total_valid = len(valid_entries)
        max_idx = total_valid - 1

        start = max(0, min(start_index if start_index is not None else 0, max_idx))

        if mode == "fixed":
            end = max_idx
        else:
            end = max(start, min(end_index if (end_index is not None and end_index > 0) else max_idx, max_idx))

        selected_index = 0

        if mode == "random":
            selected_index = random.randint(start, end)
        elif mode == "fixed":
            selected_index = max(0, min(index if index is not None else 0, max_idx))
        elif mode in ["increment", "decrement"]:
            prev_exec = PromptLineSelectorNode._last_executed.get(node_id, None)
            prev_user_val = PromptLineSelectorNode._last_user_index.get(node_id, None)

            # FIRST RUN / SAVED WORKFLOW FIX:
            # If backend state is empty for this node, strictly respect the deserialized index incoming from UI
            if prev_exec is None:
                selected_index = max(start, min(index if index is not None else start, end))
            # Detect explicit manual edit from user
            elif prev_user_val is not None and index != prev_user_val and index != prev_exec:
                selected_index = index
            else:
                if mode == "increment":
                    selected_index = prev_exec + 1 if prev_exec < end else start
                else:
                    selected_index = prev_exec - 1 if prev_exec > start else end

            if selected_index < start or selected_index > end:
                selected_index = start if mode == "increment" else end

        PromptLineSelectorNode._last_executed[node_id] = selected_index
        PromptLineSelectorNode._last_user_index[node_id] = selected_index

        original_line_idx, selected_line = valid_entries[selected_index]

        last_comment = ""
        for i in range(original_line_idx - 1, -1, -1):
            stripped = all_lines[i].strip()
            if stripped.startswith("#"):
                last_comment = stripped.lstrip("#").strip()
                break

        # Send back to frontend to update UI widget accurately
        PromptServer.instance.send_sync(
            "agi_prompt_selector_executed",
            {"node": node_id, "index": selected_index}
        )

        if PromptLineSelectorNode.DEBUG_MODE:
            print("=" * 60)
            print(f"[PromptLineSelectorNode Debug] Node ID: {node_id}")
            print(f"  * Mode: {mode}")
            print(f"  * Total Valid Lines: {total_valid}")
            print(f"  * Active Range: [{start} -> {end}]")
            print(f"  * Selected Index: {selected_index}")
            print(f"  * Output Line: \"{selected_line}\"")
            print(f"  * Comment: \"{last_comment}\"")
            print("=" * 60)

        return (selected_line, last_comment, selected_index)


NODE_CLASS_MAPPINGS = {"PromptLineSelectorNode": PromptLineSelectorNode}
NODE_DISPLAY_NAME_MAPPINGS = {"PromptLineSelectorNode": "Prompt Line Selector"}