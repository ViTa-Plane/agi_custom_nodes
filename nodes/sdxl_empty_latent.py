import torch
import json
import os
from typing import Dict, Any, List

MAX_RESOLUTION = 8192
DEBUG = False

# --- Helper Functions ---

def get_all_json_files(directory: str) -> List[str]:
    """Returns a list of all JSON files in the specified directory."""
    return [
        os.path.join(directory, file)
        for file in os.listdir(directory)
        if file.endswith(".json") and os.path.isfile(os.path.join(directory, file))
    ]

def load_resolutions_from_directory(directory: str) -> Dict[str, Dict[str, int]]:
    """Loads resolution data from all JSON files in the directory."""
    json_files = get_all_json_files(directory)

    if DEBUG:
        for json_file in json_files:
            print(f"json_file:{json_file}")

    resolutions_dict = {}
    for json_file in json_files:
        try:
            with open(json_file, "r") as file:
                json_data = json.load(file)
        except Exception as e:
            print(f"Error loading JSON file {json_file}: {e}")
            continue

        for item in json_data:
            width = item.get("width")
            height = item.get("height")
            
            if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
                print(f"Skipping invalid resolution entry in {json_file}: {item}")
                continue
                
            aspect_ratio = "{:.2f}".format(round(width / height, 2))
            key = f"{width} x {height} ({aspect_ratio})"
            resolutions_dict[key] = {"width": width, "height": height}

    # Sort the dictionary by width for better UI presentation
    return dict(sorted(resolutions_dict.items(), key=lambda item: item[1]['width']))

# --- Custom Node Class ---

class SdxlEmptyLatentImage:
    # Class-level attribute to store loaded resolutions (ComfyUI standard practice for caching)
    RESOLUTIONS: Dict[str, Dict[str, int]] = None

    def __init__(self, device="cpu"):
        self.device = device
        
        # Ensure resolutions are loaded even if the node is instantiated via API/script
        self.load_resolutions()

    @classmethod
    def load_resolutions(cls):
        """Memoized loading of resolutions for the class."""
        if cls.RESOLUTIONS is None:
            # Use os.path to determine the directory of the script
            current_dir = os.path.dirname(os.path.realpath(__file__))
            cls.RESOLUTIONS = load_resolutions_from_directory(current_dir)
            if DEBUG:
                for key, item in cls.RESOLUTIONS.items():
                    print(f"key:{key} w:{item['width']} h:{item['height']}")

    @classmethod
    def INPUT_TYPES(s) -> Dict[str, Any]:
        s.load_resolutions() # Ensure resolutions are loaded before building the UI dropdown
        
        res_list = list(s.RESOLUTIONS.keys())
        
        # Provide a safe default if no resolutions are loaded from the directory
        if not res_list:
            res_list = ["1024 x 1024 (1.00)"]
            s.RESOLUTIONS["1024 x 1024 (1.00)"] = {"width": 1024, "height": 1024}
        
        if DEBUG:
            print(res_list)

        return {
            "required": {
                # Resolution is now a dropdown of the loaded keys
                "resolution": (res_list,), 
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64}),
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "generate"
    
    # Updated category for better UI organization (optional but recommended)
    CATEGORY = "agi/latent" 

    def generate(self, resolution, batch_size=1):
        
        # Access the resolutions dictionary from the class attribute
        resolution_data = SdxlEmptyLatentImage.RESOLUTIONS.get(resolution)

        # Fallback in case the selected resolution key is somehow missing
        if resolution_data is None:
            print(f"Warning: Resolution key '{resolution}' not found. Defaulting to 1024x1024.")
            width = 1024
            height = 1024
        else:
            width = resolution_data["width"]
            height = resolution_data["height"]
        
        if DEBUG:
            print(f"res_key:{resolution} w:{width} h:{height}")

        # ComfyUI's standard latent format is [batch_size, channels(4), height/8, width/8]
        latent = torch.zeros(
            [
                batch_size,
                4,
                height // 8,
                width // 8,
            ],
            device=self.device,
            dtype=torch.float32,
        )

        # The output must be a tuple, where the single element is a dictionary
        # containing the 'samples' key with the latent tensor.
        return ({"samples": latent},)


# --- MAPPING DEFINITIONS ---
# Required for ComfyUI to load the nodes

NODE_CLASS_MAPPINGS = {
    # "SdxlEmptyLatentImage" changed back to "SDXL Empty Latent Image" for legacy workflows compatibility
    "SDXL Empty Latent Image": SdxlEmptyLatentImage
}

# Optional: Add friendly names for the manager/UI
NODE_DISPLAY_NAME_MAPPINGS = {
    # "SdxlEmptyLatentImage" changed back to "SDXL Empty Latent Image" for legacy workflows compatibility
    "SDXL Empty Latent Image": "SDXL Empty Latent Image"
}