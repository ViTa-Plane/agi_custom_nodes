import torch

class InteractiveMask:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "manual_width": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 8}),
                "manual_height": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 8}),
                "x": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "y": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "width": ("INT", {"default": 256, "min": 0, "max": 8192}),
                "height": ("INT", {"default": 256, "min": 0, "max": 8192}),
                "value": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "outer_value": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "latent": ("LATENT",),
            }
        }

    RETURN_TYPES = ("MASK",)
    FUNCTION = "generate_mask"
    CATEGORY = "agi/mask"

    def generate_mask(self, x, y, width, height, value, outer_value, manual_width, manual_height, latent=None):
        # Determine dimensions from latent or manual inputs
        if latent is not None:
            samples = latent["samples"]
            h_pixel, w_pixel = samples.shape[2] * 8, samples.shape[3] * 8
        else:
            w_pixel, h_pixel = manual_width, manual_height
            
        mask = torch.full((1, h_pixel, w_pixel), outer_value, dtype=torch.float32)
        
        # Apply bbox
        x1, y1 = max(0, int(x)), max(0, int(y))
        x2, y2 = min(w_pixel, int(x + width)), min(h_pixel, int(y + height))
        
        if x2 > x1 and y2 > y1:
            mask[:, y1:y2, x1:x2] = value
            
        # Send dimensions back to UI to resize the canvas
        return {"ui": {"dims": [w_pixel, h_pixel]}, "result": (mask,)}

NODE_CLASS_MAPPINGS = {
    "InteractiveMask": InteractiveMask
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "InteractiveMask": "Interactive Mask"
}