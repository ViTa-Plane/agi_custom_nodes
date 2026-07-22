A collection of custom ComfyUI nodes used in my personal workflows. Tested on ComfyUI 0.22.0 with ComfyUI_frontend v1.43.18

Instalation:
download the repository as a zip and extract in ComfyUI\custom_nodes\agi_custom_nodes
restart ComfyUI 
 
Usage:
in ComfyUI  interface right click --> add node --> agi/


descriptions:
agi/image/SDXL Resolution Selector (sdxl_resolutions.py)
A ComfyUI custom node that selects standard SDXL resolutions from JSON and toggles between Landscape and Portrait orientation.

agi/latent/SDXL Empty Latent Image (sdxl_empty_latent.py)
A custom node that selects standard SDXL resolutions from JSON, toggles orientation, and produces both dimensions and an Empty Latent Image.Variation of sdxl_resolutions.py with added Latent image output

Both sdxl_resolutions.py and  sdxl_empty_latent.py use sdxl_resolutions.json for the list of SDXL resolutions

agi/latent/Random Resolution Latent (RndResLatent.py)
Generates random latent image with resolution (832x1216), (1216x832) and (1024x1024) (hard coded, change if you need)
the node outputs W and H  dimensions as Int ,latent image and resolution string in (W)x(H) format


