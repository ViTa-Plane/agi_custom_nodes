"""
===============================================================================
Module: Easy Character Selector
File: easy_character_selector.py
Version: 2.7.2
===============================================================================
"""
import os
import json
import re
from server import PromptServer

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

                        clothes_dict = {}
                        raw_clothes = item.get("clothes")
                        if isinstance(raw_clothes, dict):
                            clothes_dict = {str(k).strip(): str(v).strip() for k, v in raw_clothes.items()}

                        mod_dict = {}
                        raw_mods = item.get("mod")
                        if isinstance(raw_mods, dict):
                            mod_dict = {str(k).strip(): str(v).strip() for k, v in raw_mods.items()}
                        elif isinstance(raw_mods, list):
                            mod_dict = {str(elem).strip(): str(elem).strip() for elem in raw_mods}
                        elif isinstance(raw_mods, str) and raw_mods.strip():
                            mod_dict = {"default": raw_mods.strip()}

                        lora_dict = {}
                        raw_loras = item.get("lora")
                        if isinstance(raw_loras, dict):
                            lora_dict = {str(k).strip(): str(v).strip() for k, v in raw_loras.items()}
                        elif isinstance(raw_loras, list):
                            lora_dict = {str(elem).strip(): str(elem).strip() for elem in raw_loras}
                        elif isinstance(raw_loras, str) and raw_loras.strip():
                            lora_dict = {"default": raw_loras.strip()}

                        age_dict = {}
                        raw_ages = item.get("age")
                        if isinstance(raw_ages, dict):
                            age_dict = {str(k).strip(): str(v).strip() for k, v in raw_ages.items()}
                        elif isinstance(raw_ages, list):
                            age_dict = {str(elem).strip(): str(elem).strip() for elem in raw_ages}
                        elif isinstance(raw_ages, str) and raw_ages.strip():
                            age_dict = {"default": raw_ages.strip()}

                        main_prompt = item.get("prompt", "{prompt}")

                        version_dict = {}
                        raw_versions = item.get("version")
                        if isinstance(raw_versions, dict):
                            version_dict = {str(k).strip(): str(v).strip() for k, v in raw_versions.items()}

                        if "default" not in version_dict:
                            version_dict["default"] = main_prompt

                        concept_dict = {}
                        raw_concepts = item.get("concept")
                        if isinstance(raw_concepts, dict):
                            concept_dict = {str(k).strip(): str(v).strip() for k, v in raw_concepts.items()}
                        elif isinstance(raw_concepts, list):
                            concept_dict = {str(elem).strip(): str(elem).strip() for elem in raw_concepts}
                        elif isinstance(raw_concepts, str) and raw_concepts.strip():
                            concept_dict = {"default": raw_concepts.strip()}

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
                    print(f"[Easy Character Selector] Critical Syntax Error parsing container {file}: {error_msg}")

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
        print(f"[Easy Character Selector] Directory access error: {e}")

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
            clothes_map = item.get("clothes", {})
            if isinstance(clothes_map, dict):
                for k in clothes_map.keys():
                    all_clothes_keys.add(k)

            mod_map = item.get("mod", {})
            if isinstance(mod_map, dict):
                for k in mod_map.keys():
                    all_mod_keys.add(k)

            version_map = item.get("version", {})
            if isinstance(version_map, dict):
                for k in version_map.keys():
                    all_version_keys.add(k)

            age_map = item.get("age", {})
            if isinstance(age_map, dict):
                for k in age_map.keys():
                    all_age_keys.add(k)

            concept_map = item.get("concept", {})
            if isinstance(concept_map, dict):
                for k in concept_map.keys():
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

    def apply_style(self, select_character, **kwargs):
        version_selected = kwargs.get("version", "default")
        age_selected = kwargs.get("age", "none")
        concept_selected = kwargs.get("concept", "none")
        clothing_selected = kwargs.get("clothing", kwargs.get("clothing/mod", kwargs.get("modifier (optional)", "none")))
        mod_selected = kwargs.get("mod", "none")
        lora_strength = kwargs.get("lora_strength", 1.0)
        keyword_strength = kwargs.get("keyword_strength", 1.0)
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

            age_text = ""
            age_dict = style_data.get("age", {})
            if isinstance(age_dict, dict) and age_selected != "none":
                if age_selected in age_dict:
                    age_text = age_dict.get(age_selected, "")

            concept_text = ""
            concept_dict = style_data.get("concept", {})
            if isinstance(concept_dict, dict) and concept_selected != "none":
                concept_text = concept_dict.get(concept_selected, "")

            clothing_text = ""
            clothes_map = style_data.get("clothes", {})
            if isinstance(clothes_map, dict) and clothing_selected != "none":
                clothing_text = clothes_map.get(clothing_selected, "")

            mod_text = ""
            mod_map = style_data.get("mod", {})
            if isinstance(mod_map, dict) and mod_selected != "none":
                mod_text = mod_map.get(mod_selected, "")

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