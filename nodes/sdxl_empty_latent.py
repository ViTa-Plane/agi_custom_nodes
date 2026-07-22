import json
import os
import torch

# Locate the json file in the same directory as this python file
CURRENT_DIR = os.path.dirname(os.path.realpath(__file__))
JSON_PATH = os.path.join(CURRENT_DIR, "sdxl_resolutions.json")


def load_resolutions():
    """Reads aspect ratios and resolutions from the external JSON file."""
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r") as f:
            return json.load(f)
    else:
        # Fallback default values if the JSON is missing
        return {
            "1:1 Square (1024x1024)": [1024, 1024],
            "9:7 Standard (1152x896)": [1152, 896],
            "3:2 Photo (1216x832)": [1216, 832],
            "16:9 Widescreen (1344x768)": [1344, 768],
            "21:9 Ultra-Wide (1536x640)": [1536, 640],
        }


RESOLUTIONS_DATA = load_resolutions()


class SdxlEmptyLatentImage:
    """A ComfyUI custom node that selects standard SDXL resolutions from JSON,
    toggles orientation, and produces both dimensions and an Empty Latent Image.
    """

    @classmethod
    def INPUT_TYPES(cls):
        resolution_keys = list(RESOLUTIONS_DATA.keys())
        return {
            "required": {
                "resolution": (resolution_keys,),
                "orientation": (["Landscape", "Portrait"], {"default": "Landscape"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64, "step": 1}),
            }
        }

    RETURN_TYPES = ("LATENT", "INT", "INT")
    RETURN_NAMES = ("latent", "width", "height")
    FUNCTION = "generate"
    CATEGORY = "agi/latent"

    def generate(self, resolution, orientation, batch_size):
        # Retrieve base dimensions [width, height] from JSON dictionary
        dims = RESOLUTIONS_DATA.get(resolution, [1024, 1024])
        base_w, base_h = dims[0], dims[1]

        # Ensure base dimensions represent landscape orientation (larger dimension first)
        long_side = max(base_w, base_h)
        short_side = min(base_w, base_h)

        if orientation == "Landscape":
            width, height = long_side, short_side
        else:  # Portrait
            width, height = short_side, long_side

        # Standard SDXL downscaling factor is 8 (latent resolution = pixel resolution / 8)
        latent_h = height // 8
        latent_w = width // 8

        # Initialize standard ComfyUI empty latent tensor (Batch, Channels, Height, Width)
        latent_tensor = torch.zeros([batch_size, 4, latent_h, latent_w], device="cpu")

        latent_output = {"samples": latent_tensor}

        return (latent_output, width, height)


# Node registration dictionary for ComfyUI
NODE_CLASS_MAPPINGS = {
    "SDXL Empty Latent Image": SdxlEmptyLatentImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SDXL Empty Latent Image": "SDXL Empty Latent Image"
}
