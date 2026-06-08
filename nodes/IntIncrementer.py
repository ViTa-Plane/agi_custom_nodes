import random
import time

class IntIncrementer:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "current_index": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "max_value": ("INT", {"default": 10, "min": 1, "max": 0xffffffffffffffff}),
                "mode": (["fixed", "increment", "random"], {"default": "increment"}),
            },
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "process"
    CATEGORY = "agi/Logic"

    def process(self, current_index, max_value, mode):
        upper_bound = max_value + 1
        
        if mode == "fixed":
            result = current_index % upper_bound
        elif mode == "random":
            result = random.randint(0, max_value)
        else: # increment
            result = (current_index + 1) % upper_bound

        # We send the result to the UI via a custom event
        return {"ui": {"value": [result]}, "result": (result,)}

    @classmethod
    def IS_CHANGED(s, **kwargs):
        return time.time()

# Map the node's internal class name to the string used in workflows
NODE_CLASS_MAPPINGS = {
    "IntIncrementer": IntIncrementer
}

# Define the user-facing name displayed in the ComfyUI context menu
NODE_DISPLAY_NAME_MAPPINGS = {
    "IntIncrementer": "Integer Incrementer"
}