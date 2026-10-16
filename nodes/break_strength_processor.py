# Version: v1.5.4

import re
from comfy.sd import CLIP
from comfy.sd1_clip import SDTokenizer
import nodes as native


def get_special_tokens_map(clip: CLIP) -> dict[str, set[int]]:
    tokenizers: list[SDTokenizer] = [t for t in clip.tokenizer.__dict__.values() if isinstance(t, SDTokenizer)]
    special_tokens_map: dict[str, set[int]] = dict(
        (
            tokenizer.embedding_key.replace("clip_", ""),
            set([
                token
                for token in [tokenizer.start_token, tokenizer.end_token, tokenizer.pad_token]
                if isinstance(token, int)
            ]),
        )
        for tokenizer in tokenizers
    )
    return special_tokens_map


class BreakStrengthProcessor:
    DEBUG_MODE = True

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "clip": ("CLIP",),
                "text": ("STRING", {"default": "", "multiline": False}),
            },
            "optional": {
                "strengths": ("STRING", {"default": "1.0", "multiline": False}),
                "tokens": ("STRING", {"default": "0;", "multiline": False}),
                "toggles": ("STRING", {"default": "true", "multiline": False}),
                "held_text": ("STRING", {"default": "", "multiline": False}),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "STRING")
    RETURN_NAMES = ("conditioning", "text")

    FUNCTION = "process"
    CATEGORY = "agi/conditioning"

    def clean_text_block(self, block_text):
        if not block_text:
            return ""
        cleaned = block_text.strip()
        cleaned = re.sub(r'^[,\s]+|[,\s]+$', '', cleaned)
        cleaned = re.sub(r',\s*,+', ',', cleaned)
        return cleaned.strip()

    def process(self, text, clip, strengths="1.0", tokens="0;", toggles="true", held_text=""):
        active_text = held_text if held_text and held_text.strip() else text
        special_tokens_map = get_special_tokens_map(clip)

        raw_prompts = re.split(r'\s*,\s*\bBREAK\b\s*,\s*|\s*\bBREAK\b\s*', active_text)

        try:
            strength_list = [float(s.strip()) for s in strengths.split(",") if s.strip()]
        except ValueError:
            strength_list = []

        try:
            toggle_list = [t.strip().lower() in ("true", "1", "yes", "on") for t in toggles.split(",") if t.strip()]
        except ValueError:
            toggle_list = []

        paired = []
        block_token_counts = []

        for i, p in enumerate(raw_prompts):
            cleaned = self.clean_text_block(p)
            if cleaned:
                idx = len(paired)
                s = strength_list[idx] if idx < len(strength_list) else 1.0
                enabled = toggle_list[idx] if idx < len(toggle_list) else True

                effective_s = s if enabled else 0.0
                paired.append((cleaned, effective_s))

                tokenizer_results = clip.tokenize(cleaned)
                block_tokens = 0
                for key, tokens_map in [
                    (key, tokens[0]) for key, tokens in tokenizer_results.items() if key in special_tokens_map
                ]:
                    prompt_tokens = [
                        t for t in tokens_map if t[0] not in special_tokens_map[key]
                    ]
                    block_tokens += len(prompt_tokens)

                if block_tokens == 0:
                    for tokens_map in tokenizer_results.values():
                        if isinstance(tokens_map, list) and len(tokens_map) > 0 and isinstance(tokens_map[0], list):
                            block_tokens += len(tokens_map[0])
                        else:
                            block_tokens += len(tokens_map)

                block_token_counts.append(block_tokens)

        if not paired:
            paired = [("", 1.0)]
            block_token_counts = [0]

        prompts = [item[0] for item in paired]
        effective_strengths = [item[1] for item in paired]

        raw_strength_list = [strength_list[i] if i < len(strength_list) else 1.0 for i in range(len(prompts))]
        toggle_states = [toggle_list[i] if i < len(toggle_list) else True for i in range(len(prompts))]

        multiplier_node = native.ConditioningMultiply()

        first_prompt = prompts.pop(0)
        out = native.CLIPTextEncode().encode(clip, first_prompt)

        s1 = effective_strengths[0] if len(effective_strengths) > 0 else 1.0
        if s1 != 1.0:
            out = multiplier_node.multiply(out[0], s1)

        for i, prompt in enumerate(prompts, start=1):
            cond_from = native.CLIPTextEncode().encode(clip, prompt)

            si = effective_strengths[i] if i < len(effective_strengths) else 1.0
            if si != 1.0:
                cond_from = multiplier_node.multiply(cond_from[0], si)

            out = native.ConditioningConcat().concat(out[0], cond_from[0])

        if self.DEBUG_MODE:
            debug_blocks = []
            full_prompts_list = [first_prompt] + prompts
            for idx, (p, s) in enumerate(zip(full_prompts_list, raw_strength_list)):
                tokens_count = block_token_counts[idx] if idx < len(block_token_counts) else 0
                enabled = toggle_states[idx] if idx < len(toggle_states) else True
                status = "Enabled" if enabled else "Disabled"
                debug_blocks.append(
                    f"  [Block {idx + 1}] ({status} | Strength: {s:.2f}) | Tokens: {tokens_count} -> \"{p}\"")

            print("\033[36m--- BreakStrengthProcessor Debug ---\033[0m")
            for block_msg in debug_blocks:
                print(block_msg)
            print("\033[36m------------------------------------\033[0m")

        total_tokens = sum(block_token_counts)

        formatted_blocks = []
        full_prompts_list = [first_prompt] + prompts
        for p, s in zip(full_prompts_list, strength_list):
            if s == 1.0:
                formatted_blocks.append(p)
            else:
                formatted_blocks.append(f"({p}:{s:.2f})")

        output_text = " BREAK ".join(formatted_blocks)

        return {
            "ui": {
                "text": [active_text],
                "total_tokens": [total_tokens],
                "block_tokens": [block_token_counts]
            },
            "result": (out[0],output_text)
        }


NODE_CLASS_MAPPINGS = {
    "BreakStrengthProcessor": BreakStrengthProcessor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BreakStrengthProcessor": "BREAK Strength Processor"
}

WEB_DIRECTORY = "./web"