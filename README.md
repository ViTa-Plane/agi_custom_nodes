A collection of custom ComfyUI nodes used in my personal workflows. Tested on ComfyUI 0.22.0 with ComfyUI_frontend v1.43.18

Usage:
in ComfyUI  interface right click --> add node --> agi


descriptions:

sdxl_resolutions.py
A ComfyUI custom node that selects standard SDXL resolutions from JSON and toggles between Landscape and Portrait orientation.

sdxl_empty_latent.py
A custom node that selects standard SDXL resolutions from JSON, toggles orientation, and produces both dimensions and an Empty Latent Image.Variation of sdxl_resolutions.py with added Latent image output

Both sdxl_resolutions.py and  sdxl_empty_latent.py use sdxl_resolutions.json for the list of SDXL resolutions
