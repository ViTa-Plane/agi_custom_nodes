import json

class AnyType(str):
    """A special string subclass that matches any other type in ComfyUI connections."""
    def __ne__(self, __value: object) -> bool:
        return False

# Wildcard constant representing any data type
any_type = AnyType("*")

class DisplayAnyData:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "anything": (any_type, {}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_NODE = True
    CATEGORY = "agi/utils"
    FUNCTION = "display_data"

    def display_data(self, anything):
        # Format raw data cleanly into a string
        try:
            if isinstance(anything, (dict, list)):
                display_text = json.dumps(anything, indent=4, default=str)
            else:
                display_text = str(anything)
        except Exception as e:
            display_text = f"Error formatting data: {str(e)}\nRaw representation: {repr(anything)}"

        # Server terminal print
        # print("\n" + "="*40)
        # print(f"[DisplayAnyData Node] Received Type: {type(anything)}")
        # print(f"[DisplayAnyData Node] Raw Data:\n{display_text}")
        # print("="*40 + "\n")

        # Returns: (STRING output execution result, UI payload)
        return {"ui": {"text": [display_text]}, "result": (display_text,)}

NODE_CLASS_MAPPINGS = {
    "DisplayAnyData": DisplayAnyData
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DisplayAnyData": "Display Any Data"
}

# Tell ComfyUI where to find the frontend JS extension
WEB_DIRECTORY = "./web"