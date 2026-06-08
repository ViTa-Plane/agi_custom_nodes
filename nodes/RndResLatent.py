import random
import torch


class RndResLatent:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096}),
            }
        }

    RETURN_TYPES = (
        "LATENT",
        "INT",
        "INT",
        "STRING",
    )
    RETURN_NAMES = (
        "LATENT",
        "width",
        "height",
        "resolution_string", # Naming convention corrected
    )
    OUTPUT_NODE = True
    FUNCTION = "random_resolution"
    CATEGORY = "agi/latent"

    def title(self):
        return "Random Resolution Latent"

    @classmethod
    def IS_CHANGED(s, **kwargs):
        random.seed()
        return float("NaN")

    def random_resolution(self, batch_size, resolution_string=None): 
        
        res_list = [(832, 1216), (1216, 832), (1024, 1024)]

        rand_res = random.choice(res_list)
        
        H = rand_res[0] # Height
        W = rand_res[1] # Width

        latent = torch.zeros(
            [batch_size, 4, H // 8, W // 8])

        resolution_str = f"{W}x{H}"
        
        return (
            {"samples": latent},
            W,
            H,
            resolution_str,
        )

NODE_CLASS_MAPPINGS = {
    "RndResLatent": RndResLatent
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RndResLatent": "Random Resolution Latent"
}