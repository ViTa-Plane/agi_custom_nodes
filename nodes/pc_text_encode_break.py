import re
import torch
import nodes  # ComfyUI core nodes namespace


def unwrap_conditioning(res):
    """
    Extracts the raw conditioning list from ComfyUI's V3 NodeOutput,
    dictionaries, or nested output tuples safely.
    """
    if res is None:
        return []

    # Handle modern ComfyUI V3 NodeOutput wrappers
    if res.__class__.__name__ == "NodeOutput":
        for attr in ["outputs", "_outputs", "value", "data"]:
            if hasattr(res, attr):
                val = getattr(res, attr)
                if val is not None:
                    res = val
                    break
        if hasattr(res, "__dict__") and not isinstance(res, (list, tuple)):
            for k, v in res.__dict__.items():
                if isinstance(v, (list, tuple)):
                    res = v
                    break

    # If it's the node execution output tuple (e.g., (conditioning,)), grab the first element
    if isinstance(res, (tuple, list)) and len(res) > 0:
        # Prompt control returns (conditioning_list,) -> take index 0
        inner = res[0]
        if isinstance(inner, list):
            return inner
        return res

    return res


class PCTextEncodeWithBreak:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "dynamicPrompts": True}),
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "encode_with_break"
    CATEGORY = "agi/Advanced"

    def encode_with_break(self, clip, text):
        # Fetch the Prompt Control class out of memory registry
        PC_Text_Encode_Class = nodes.NODE_CLASS_MAPPINGS.get("PCTextEncode")

        if PC_Text_Encode_Class is None:
            raise RuntimeError(
                "Could not find 'PCTextEncode' in ComfyUI's node registry.\n"
                "Please verify that the 'ComfyUI Prompt Control' extension is installed."
            )

        pc_encoder = PC_Text_Encode_Class()

        # Cleanly split text blocks on uppercase 'BREAK' word boundaries
        fragments = [frag.strip() for frag in re.split(r'\bBREAK\b', text) if frag.strip()]

        if not fragments:
            return pc_encoder.execute(clip, "")

        # 1. Process the first string fragment
        first_res = pc_encoder.execute(clip, fragments[0])
        current_conditioning = unwrap_conditioning(first_res)

        # 2. Iteratively process and concatenate remaining fragments sequentially
        for fragment in fragments[1:]:
            next_res = pc_encoder.execute(clip, fragment)
            next_conditioning = unwrap_conditioning(next_res)

            combined = []
            # Calculate safety bounds based on matching cross-attention stream length
            min_len = min(len(current_conditioning), len(next_conditioning))

            for i in range(min_len):
                try:
                    t1, d1 = current_conditioning[i]
                    t2, d2 = next_conditioning[i]

                    # Stack token data streams along Dimension 1 (Sequence Length)
                    concatenated_tokens = torch.cat((t1, t2), dim=1)

                    merged_dict = d1.copy()
                    if "pooled_output" in d2:
                        merged_dict["pooled_output"] = d2["pooled_output"]

                    combined.append([concatenated_tokens, merged_dict])
                except (ValueError, TypeError, IndexError):
                    # Robust fail-safe boundary mapping protection
                    continue

            if combined:
                current_conditioning = combined

        return (current_conditioning,)


# Expose definitions to the ComfyUI application context
NODE_CLASS_MAPPINGS = {
    "PCTextEncodeWithBreak": PCTextEncodeWithBreak
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PCTextEncodeWithBreak": "PC: Text Encode (with BREAK)"
}
