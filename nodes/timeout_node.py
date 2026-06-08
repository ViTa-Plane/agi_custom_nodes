import time
import random

class TimeoutNode:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "delay_ms": ("INT", {
                    "default": 1000, 
                    "min": 0, 
                    "max": 60000, 
                    "step": 100
                }),
                "seed": ("INT", {
                    "default": 0, 
                    "min": 0, 
                    "max": 0xffffffffffffffff
                }),
                "min_val": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "max_val": ("INT", {"default": 100, "min": 0, "max": 0xffffffffffffffff}),
            },
        }

    RETURN_TYPES = ("INT", "STRING")
    RETURN_NAMES = ("int_out", "string_out")
    FUNCTION = "execute_timeout"
    CATEGORY = "agi/utils"

    def execute_timeout(self, delay_ms, seed, min_val, max_val):
        # 1. Execute the wait
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
        
        # 2. Random logic
        random.seed(seed)
        lower = min(min_val, max_val)
        upper = max(min_val, max_val)
        res = random.randint(lower, upper)
        
        return (res, str(res))

# Registration
NODE_CLASS_MAPPINGS = {
    "TimeoutNode": TimeoutNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TimeoutNode": "Timeout Node"
}