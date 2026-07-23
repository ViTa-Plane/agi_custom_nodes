import os
import json

# Path to 'names_set.json' located in the same directory as this script
NODE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE_PATH = os.path.join(NODE_DIR, "names_set.json")


def load_json_keys():
    """Reads names_set.json and returns its keys/elements as a list for the drop-down widget."""
    if not os.path.exists(JSON_FILE_PATH):
        return ["Error: names_set.json not found"]
    
    try:
        with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        if isinstance(data, dict):
            return list(data.keys())
        elif isinstance(data, list):
            return [str(item) for item in data]
        else:
            return ["Invalid JSON format"]
    except Exception as e:
        return [f"Error reading JSON: {str(e)}"]


# ==============================================================================
# JSON Selector
# ==============================================================================
class NameSetSelectorNode:
    """
    ComfyUI node that reads names_set.json from its directory and outputs
    the selected element as a string.
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        options = load_json_keys()
        return {
            "required": {
                "selected_element": (options, ),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("selected_value",)
    FUNCTION = "get_element_value"
    CATEGORY = "agi/JSON"

    def get_element_value(self, selected_element):
        if not os.path.exists(JSON_FILE_PATH):
            return (f"Error: names_set.json not found in {NODE_DIR}",)

        try:
            with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, dict):
                val = data.get(selected_element, "")
            elif isinstance(data, list):
                val = selected_element
            else:
                val = str(data)

            if isinstance(val, (dict, list)):
                output_str = json.dumps(val, indent=2)
            else:
                output_str = str(val)

            return (output_str,)

        except Exception as e:
            return (f"Error: {str(e)}",)

# ==============================================================================
# ComfyUI Mappings
# ==============================================================================
NODE_CLASS_MAPPINGS = {
    "NameSetSelectorNode": NameSetSelectorNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NameSetSelectorNode": "JSON Name Set Selector"
}
