import torch

class InteractiveLatentMask:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "latent": ("LATENT",),
                "x": ("INT", {"default": 128, "min": 0, "max": 8192, "step": 1}),
                "y": ("INT", {"default": 128, "min": 0, "max": 8192, "step": 1}),
                "width": ("INT", {"default": 256, "min": 0, "max": 8192, "step": 1}),
                "height": ("INT", {"default": 256, "min": 0, "max": 8192, "step": 1}),
                "value": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "outer_value": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
        }

    RETURN_TYPES = ("MASK",)
    FUNCTION = "generate_mask"
    CATEGORY = "agi/mask"

    def generate_mask(self, latent, x, y, width, height, value, outer_value):
        samples = latent["samples"]
        # Latent space to Pixel space (8x)
        h_pixel, w_pixel = samples.shape[2] * 8, samples.shape[3] * 8
        mask = torch.full((1, h_pixel, w_pixel), outer_value, dtype=torch.float32)
        
        x1, y1 = max(0, int(x)), max(0, int(y))
        x2, y2 = min(w_pixel, int(x + width)), min(h_pixel, int(y + height))
        
        if x2 > x1 and y2 > y1:
            mask[:, y1:y2, x1:x2] = value
            
        return {"ui": {"dims": [w_pixel, h_pixel]}, "result": (mask,)}
        
NODE_CLASS_MAPPINGS = {
    "InteractiveLatentMask": InteractiveLatentMask
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "InteractiveLatentMask": "Interactive Mask (lite)"
}