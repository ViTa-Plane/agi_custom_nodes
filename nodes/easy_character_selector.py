"""
===============================================================================
Module: Easy Character Selector
File: easy_character_selector.py
Version: 2.8.8
===============================================================================
"""
import os
import json
import re
from aiohttp import web
from server import PromptServer
import folder_paths

# Set to False to silence console debug messages and warnings
DEBUG_MODE = True

def dprint(*args, **kwargs):
    if DEBUG_MODE:
        print(*args, **kwargs)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
STYLES_ROOT_DIR = os.path.join(CURRENT_DIR, "character_packs")
THUMBNAILS_DIR = os.path.join(STYLES_ROOT_DIR, "thumbnails")

if not os.path.exists(THUMBNAILS_DIR):
    try:
        os.makedirs(THUMBNAILS_DIR)
    except Exception:
        pass

try:
    PromptServer.instance.app.router.add_static(
        '/agi_characters_thumbnails/',
        path=THUMBNAILS_DIR,
        name='agi_characters_thumbnails'
    )
except Exception:
    pass


async def check_lora_exists(request):
    lora_query = request.query.get("name", "").strip()
    if not lora_query:
        return web.json_response({"exists": False})

    try:
        available_loras = folder_paths.get_filename_list("loras")
    except Exception as e:
        dprint(f"[Easy Character Selector] Error accessing folder_paths: {e}")
        available_loras = []

    def clean_filename(filename_str):
        norm = filename_str.replace("\\", "/").strip().lower()
        base = os.path.basename(norm)
        for ext in [".safetensors", ".ckpt", ".pt"]:
            if base.endswith(ext):
                base = base[:-len(ext)]
                break
        return base, norm

    clean_query_base, clean_query_full = clean_filename(lora_query)

    exists = False
    for lora in available_loras:
        lora_base, lora_full = clean_filename(lora)
        if clean_query_base == lora_base or clean_query_full == lora_full or lora_full.endswith("/" + clean_query_full):
            exists = True
            break

    if not exists:
        dprint(f"\033[91m[Easy Character Selector] ⚠️ LoRa NOT FOUND in ComfyUI folders -> '{lora_query}'\033[0m")

    return web.json_response({"exists": exists, "query": lora_query})


try:
    routes = PromptServer.instance.app.router
    routes.add_get("/agi_characters_check_lora", check_lora_exists)
except Exception as err:
    dprint(f"[Easy Character Selector] Failed to bind endpoint route: {err}")


def load_flat_container_styles():
    styles_inventory = []
    if not os.path.exists(STYLES_ROOT_DIR):
        return []

    try:
        for file in os.listdir(STYLES_ROOT_DIR):
            if file.endswith(".json"):
                json_path = os.path.join(STYLES_ROOT_DIR, file)
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    raw_items = data if isinstance(data, list) else [data]
                    for item in raw_items:
                        if not isinstance(item, dict) or "name" not in item:
                            continue

                        category = item.get("category", "").strip()
                        if category.lower() != "character":
                            continue

                        category = category.capitalize()

                        character = item.get("character")
                        if character is None or str(character).strip() == "":
                            character = "misc"
                        else:
                            character = str(character).strip()

                        nested_params = item.get("params", {})
                        if not isinstance(nested_params, dict):
                            nested_params = {}

                        def parse_flexible_map(raw_map):
                            if isinstance(raw_map, dict):
                                cleaned_map = {}
                                for k, v in raw_map.items():
                                    clean_k = str(k).strip()
                                    if isinstance(v, dict):
                                        cleaned_map[clean_k] = {str(sub_k).strip(): str(sub_v).strip() for sub_k, sub_v in v.items()}
                                    else:
                                        cleaned_map[clean_k] = str(v).strip()
                                return cleaned_map
                            elif isinstance(raw_map, list):
                                return {str(elem).strip(): str(elem).strip() for elem in raw_map}
                            elif isinstance(raw_map, str) and raw_map.strip():
                                return {"default": raw_map.strip()}
                            return {}

                        clothes_dict = parse_flexible_map(item.get("clothes"))
                        mod_dict = parse_flexible_map(item.get("mod"))
                        lora_dict = parse_flexible_map(item.get("lora"))
                        age_dict = parse_flexible_map(item.get("age"))
                        concept_dict = parse_flexible_map(item.get("concept"))

                        main_prompt = item.get("prompt", "{prompt}")

                        version_dict = {}
                        raw_versions = item.get("version")
                        if isinstance(raw_versions, dict):
                            version_dict = {str(k).strip(): str(v).strip() for k, v in raw_versions.items()}

                        if "default" not in version_dict:
                            version_dict["default"] = main_prompt

                        styles_inventory.append({
                            "name": item.get("name"),
                            "category": category,
                            "character": character,
                            "prompt": main_prompt,
                            "version": version_dict,
                            "age": age_dict,
                            "concept": concept_dict,
                            "negative_prompt": item.get("negative_prompt", ""),
                            "suppress": item.get("suppress", ""),
                            "clothes": clothes_dict,
                            "mod": mod_dict,
                            "lora": lora_dict,
                            "thumbnail": item.get("thumbnail"),
                            "comment": item.get("comment", ""),
                            "seed": item.get("seed", ""),
                            "params": nested_params,
                            "file_name": file
                        })
                except Exception as e:
                    error_msg = str(e)
                    dprint(f"[Easy Character Selector] Critical Syntax Error parsing container {file}: {error_msg}")

                    styles_inventory.append({
                        "name": f"⚠️ ERROR IN: {file}",
                        "category": "Character",
                        "character": "misc",
                        "prompt": f"JSON syntax error detected inside file: {file}",
                        "version": {"default": f"JSON syntax error detected inside file: {file}"},
                        "age": {},
                        "concept": {},
                        "negative_prompt": "Fix file syntax to clear this alert flag.",
                        "suppress": "",
                        "clothes": {},
                        "mod": {},
                        "lora": {},
                        "thumbnail": None,
                        "comment": f"PARSER REJECTION: {error_msg}",
                        "seed": "ERROR",
                        "params": {},
                        "file_name": file
                    })
    except Exception as e:
        dprint(f"[Easy Character Selector] Directory access error: {e}")

    styles_inventory.sort(key=lambda x: x["name"].lower())
    return styles_inventory


class CharacterSelectorV2:
    @classmethod
    def INPUT_TYPES(cls):
        all_styles = load_flat_container_styles()
        character_list = [item["name"] for item in all_styles] if all_styles else ["None"]

        all_clothes_keys = set(["none"])
        all_mod_keys = set(["none"])
        all_version_keys = set(["default"])
        all_age_keys = set(["none"])
        all_concept_keys = set(["none"])

        for item in all_styles:
            for k in item.get("clothes", {}).keys():
                all_clothes_keys.add(k)
            for k in item.get("mod", {}).keys():
                all_mod_keys.add(k)
            for k in item.get("version", {}).keys():
                all_version_keys.add(k)
            for k in item.get("age", {}).keys():
                all_age_keys.add(k)
            for k in item.get("concept", {}).keys():
                all_concept_keys.add(k)

        clothing_list = sorted(list(all_clothes_keys))
        mod_list = ["none"] + sorted([m for m in all_mod_keys if m != "none"])
        version_list = ["default"] + sorted([v for v in all_version_keys if v != "default"])
        age_list = ["none"] + sorted([a for a in all_age_keys if a != "none"])
        concept_list = ["none"] + sorted([c for c in all_concept_keys if c != "none"])

        return {
            "required": {
                "select_character": (character_list, {
                    "default": character_list[0] if character_list else "None",
                    "tooltip": "Select character profile to load prompt tags, negative prompts, thumbnails, and replace positive prompt placeholders."
                }),
                "epoch": ("INT", {
                    "default": 1, "min": 1, "max": 999, "step": 1, "display": "number",
                    "tooltip": "Replaces any {epoch} placeholders in positive prompt templates or LoRA strings with this training epoch number (padded to 2 digits)."
                }),
                "version": (version_list, {
                    "default": "default",
                    "tooltip": "Select a specific positive prompt version preset defined for this character."
                }),
                "age": (age_list, {
                    "default": "none",
                    "tooltip": "Select age preset defined for this character."
                }),
                "clothing": (clothing_list, {
                    "default": "none",
                    "tooltip": "Select clothing preset. Replaces {clothes} in positive prompt templates or appends if no placeholder is present."
                }),
                "mod": (mod_list, {
                    "default": "none",
                    "tooltip": "Select modifier preset. Replaces {mod} in positive prompt templates or appends if no placeholder is present."
                }),
                "concept": (concept_list, {
                    "default": "none",
                    "tooltip": "Select concept template. Replaces {concept} in positive prompt templates or appends if no placeholder is present."
                }),
                "lora_strength": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05, "display": "number",
                    "tooltip": "Multiplier for LoRA weights embedded in character tags (<lora:name:weight>)."
                }),
                "keyword_strength": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05, "display": "number",
                    "tooltip": "Replaces any {kw_str} placeholders in the prompts with this strength factor."
                }),
                "remove_dependencies": ("BOOLEAN", {
                    "default": False, "label_on": "enabled", "label_off": "disabled",
                    "tooltip": "Strips out all <lora:...> and embedding:... tags from output prompts."
                }),
                "wrap_break": ("BOOLEAN", {
                    "default": True, "label_on": "enabled", "label_off": "disabled",
                    "tooltip": "Wraps character prompt block with starting and ending BREAK tokens."
                }),
            },
            "optional": {
                "positive": ("STRING", {
                    "forceInput": True,
                    "tooltip": "Optional incoming positive text to combine with character tags."
                }),
                "negative": ("STRING", {
                    "forceInput": True,
                    "tooltip": "Optional incoming negative text to combine with character negative tags."
                }),
            },
            "hidden": {
                "styles_inventory": ("STRING", {"default": json.dumps(all_styles)})
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("positive", "negative", "character", "suppress")
    OUTPUT_TOOLTIPS = (
        "Combined positive prompt string with character tags and optional BREAK formatting.",
        "Combined negative prompt string with character negative tags.",
        "The character name identifier (defaults to 'misc' if undefined).",
        "List of suppressed or unwanted tags defined in the character profile."
    )
    FUNCTION = "apply_style"
    CATEGORY = "agi/Prompt Utility"

    def clean_output_string(self, text):
        if not text:
            return ""
        text = text.replace("{prompt}", "").replace("{weight}", "").replace("{epoch}", "").replace("{age}", "").replace("{concept}", "").replace("{clothes}", "").replace("{mod}", "").replace("{lora}", "")
        text = re.sub(r'<lora:[:\s]*>', '', text)
        text = re.sub(r',(?:\s*,)+', ',', text)
        text = text.strip().strip(',')
        return text.strip()

    def clean_all_dependencies(self, text):
        if not text:
            return ""
        text = re.sub(r'<lora:[^>]+>', '', text)
        text = re.sub(r'\(\s*embedding:[^)]+\s*\)', '', text)
        text = re.sub(r'[^a-zA-Z0-9_-]?embedding:[a-zA-Z0-9_.-]+', '', text)
        return self.clean_output_string(text)

    def process_lora_weights(self, text, weight_value):
        if not text:
            return ""

        def parse_individual_lora_tag(tag_match):
            full_tag = tag_match.group(0)
            inner_content = tag_match.group(1)

            if "{weight}" in inner_content:
                inner_content = inner_content.replace("{weight}", f"{weight_value:.2f}")
                parts = inner_content.split(":")
                processed_parts = [parts[0]]

                orig_parts = tag_match.group(1).split(":")
                for idx in range(1, len(parts)):
                    if idx < len(orig_parts) and orig_parts[idx] == "{weight}":
                        processed_parts.append(parts[idx])
                    else:
                        try:
                            processed_parts.append(f"{float(parts[idx]) * weight_value:.2f}")
                        except ValueError:
                            processed_parts.append(parts[idx])
                return f"<lora:{':'.join(processed_parts)}>"

            parts = inner_content.split(":")
            if len(parts) >= 2:
                processed_parts = [parts[0]]
                for num_str in parts[1:]:
                    try:
                        processed_parts.append(f"{float(num_str) * weight_value:.2f}")
                    except ValueError:
                        processed_parts.append(num_str)
                return f"<lora:{':'.join(processed_parts)}>"

            return full_tag

        return re.sub(r'<lora:([^>]+)>', parse_individual_lora_tag, text)

    def resolve_nested_value(self, field_map, selected_key, version_key):
        if not field_map or selected_key not in field_map:
            return ""
        val = field_map[selected_key]
        if isinstance(val, dict):
            if version_key in val:
                return str(val[version_key]).strip()
            elif "default" in val:
                return str(val["default"]).strip()
            elif val:
                return str(list(val.values())[0]).strip()
            return ""
        elif isinstance(val, str):
            return val.strip()
        return ""

    def apply_style(self, select_character, **kwargs):
        version_selected = kwargs.get("version", "default")
        age_selected = kwargs.get("age", "none")
        concept_selected = kwargs.get("concept", "none")
        clothing_selected = kwargs.get("clothing", kwargs.get("clothing/mod", kwargs.get("modifier (optional)", "none")))
        mod_selected = kwargs.get("mod", "none")

        raw_lora_str = kwargs.get("lora_strength", 1.0)
        lora_strength = float(raw_lora_str) if raw_lora_str is not None else 1.0

        raw_kw_str = kwargs.get("keyword_strength", 1.0)
        keyword_strength = float(raw_kw_str) if raw_kw_str is not None else 1.0

        epoch_val = kwargs.get("epoch", 1)
        remove_dependencies = kwargs.get("remove_dependencies", False)
        wrap_break = kwargs.get("wrap_break", True)
        positive = kwargs.get("positive", "")
        negative = kwargs.get("negative", "")

        if "⚠️ ERROR IN" in select_character:
            return (positive, negative, "misc", "")

        all_styles = load_flat_container_styles()
        style_data = next((item for item in all_styles if item.get("name") == select_character), None)

        if not style_data or select_character == "None":
            res_p, res_n = positive, negative
            character_val = "misc"
            suppress_val = ""
        else:
            version_dict = style_data.get("version", {})
            if isinstance(version_dict, dict) and version_selected in version_dict:
                style_positive = version_dict[version_selected]
            else:
                style_positive = style_data.get("prompt", "{prompt}")

            style_negative = style_data.get("negative_prompt", "")
            character_val = style_data.get("character", "misc")
            suppress_val = style_data.get("suppress", "")

            age_text = self.resolve_nested_value(style_data.get("age", {}), age_selected, version_selected)
            concept_text = self.resolve_nested_value(style_data.get("concept", {}), concept_selected, version_selected)
            clothing_text = self.resolve_nested_value(style_data.get("clothes", {}), clothing_selected, version_selected)
            mod_text = self.resolve_nested_value(style_data.get("mod", {}), mod_selected, version_selected)

            lora_text = ""
            lora_map = style_data.get("lora", {})
            if isinstance(lora_map, dict):
                if version_selected in lora_map:
                    lora_text = lora_map.get(version_selected, "")
                elif "default" in lora_map:
                    lora_text = lora_map.get("default", "")
                elif lora_map:
                    lora_text = list(lora_map.values())[0]

            kw_val_str = f"{keyword_strength:.2f}".rstrip('0').rstrip('.') if keyword_strength % 1 != 0 else f"{int(keyword_strength)}"
            epoch_str = f"{int(epoch_val):02d}"

            if lora_text and "{epoch}" in lora_text:
                lora_text = lora_text.replace("{epoch}", epoch_str)

            if age_text and "{epoch}" in age_text:
                age_text = age_text.replace("{epoch}", epoch_str)

            has_concept_tag = "{concept}" in style_positive
            has_clothes_tag = "{clothes}" in style_positive
            has_mod_tag = "{mod}" in style_positive
            has_lora_tag = "{lora}" in style_positive
            has_age_tag = "{age}" in style_positive

            style_positive = style_positive.replace("{kw_str}", kw_val_str).replace("{epoch}", epoch_str)
            style_negative = style_negative.replace("{kw_str}", kw_val_str).replace("{epoch}", epoch_str)

            if has_concept_tag:
                style_positive = style_positive.replace("{concept}", concept_text)

            if has_clothes_tag:
                style_positive = style_positive.replace("{clothes}", clothing_text)

            if has_mod_tag:
                style_positive = style_positive.replace("{mod}", mod_text)

            if has_lora_tag:
                style_positive = style_positive.replace("{lora}", lora_text)

            if has_age_tag:
                style_positive = style_positive.replace("{age}", age_text)

            has_prompt_tag = "{prompt}" in style_positive
            prompt_at_start = style_positive.strip().startswith("{prompt}")

            clean_style_positive = style_positive.replace("{prompt}", "").strip(" ,")

            fallback_additions = []
            if age_text and not has_age_tag:
                fallback_additions.append(age_text)

            if clothing_text and not has_clothes_tag:
                clothing_text_proc = clothing_text.replace("{kw_str}", kw_val_str).replace("{epoch}", epoch_str).replace("{age}", age_text).replace("{concept}", concept_text).replace("{mod}", mod_text).replace("{lora}", lora_text)
                fallback_additions.append(clothing_text_proc)

            if mod_text and not has_mod_tag:
                mod_text_proc = mod_text.replace("{kw_str}", kw_val_str).replace("{epoch}", epoch_str).replace("{age}", age_text).replace("{concept}", concept_text).replace("{clothes}", clothing_text).replace("{lora}", lora_text)
                fallback_additions.append(mod_text_proc)

            if lora_text and not has_lora_tag:
                fallback_additions.append(lora_text)

            if concept_text and not has_concept_tag:
                fallback_additions.append(concept_text)

            if fallback_additions:
                joined_additions = ", ".join([a for a in fallback_additions if a])
                if joined_additions:
                    clean_style_positive = f"{clean_style_positive}, {joined_additions}" if clean_style_positive else joined_additions

            clean_style_positive = self.process_lora_weights(clean_style_positive, lora_strength)

            if remove_dependencies:
                clean_style_positive = self.clean_all_dependencies(clean_style_positive)
                style_negative = self.clean_all_dependencies(style_negative)

            clean_style_positive = self.clean_output_string(clean_style_positive)
            if wrap_break and clean_style_positive:
                wrapped_style = f"BREAK {clean_style_positive} BREAK"
            else:
                wrapped_style = clean_style_positive

            if has_prompt_tag:
                if positive:
                    if prompt_at_start:
                        final_positive = f"{positive}, {wrapped_style}" if wrapped_style else positive
                    else:
                        final_positive = f"{wrapped_style}, {positive}" if wrapped_style else positive
                else:
                    final_positive = wrapped_style
            else:
                if positive:
                    if wrap_break:
                        final_positive = f"{wrapped_style}, {positive}" if wrapped_style else positive
                    else:
                        final_positive = f"{positive}, {wrapped_style}" if wrapped_style else positive
                else:
                    final_positive = wrapped_style

            style_negative = self.clean_output_string(style_negative)
            final_negative = f"{negative}, {style_negative}" if negative and style_negative else (
                style_negative if style_negative else negative)

            res_p, res_n = final_positive, final_negative

        res_p = self.clean_output_string(res_p)
        res_n = self.clean_output_string(res_n)
        suppress_val = str(suppress_val).strip() if suppress_val else ""

        return (res_p, res_n, character_val, suppress_val)


NODE_CLASS_MAPPINGS = {
    "CharacterSelectorV2": CharacterSelectorV2
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "CharacterSelectorV2": "Easy Character Selector"
}