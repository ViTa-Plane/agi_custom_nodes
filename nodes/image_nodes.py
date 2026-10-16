import torch
import torch.nn.functional as F
import comfy.utils  # <-- Imported ComfyUI's core utility resampler for Lanczos

# print("\n" + "="*80)
# print("[ AGI CustomPack] 🚀 SUCCESS: Image Invert Node loaded successfully!")
# print("="*80 + "\n")
class SimpleImageInvert:
    """A node that inverts the colors of an input image tensor."""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "invert_image"
    CATEGORY = "agi/image"
    def invert_image(self, image):
        # ComfyUI images are float32 tensors scaled between 0.0 and 1.0
        # Shape is [B, H, W, C] (Batch, Height, Width, Channels)
        # .clone() preserves the tracking tensor properties ComfyUI expects
        inverted_image = (1.0 - image).clone().detach()
        return (inverted_image,)


class MakeThumbnail:
    """
    Crops any image tensor into a perfect center square and
    downscales it to exactly 200x200 pixels.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "generate_thumbnail"
    CATEGORY = "agi/image"

    def generate_thumbnail(self, image):
        # ComfyUI image format layout is always: [Batch, Height, Width, Channels]
        # Example shape for a 1080x1920 image: [1, 1080, 1920, 3]
        b, h, w, c = image.shape

        # 1. Determine bounding dimensions for a perfect center square
        crop_size = min(h, w)

        # Calculate pixel start offsets
        start_y = (h - crop_size) // 2
        start_x = (w - crop_size) // 2

        # Slice the tensor array down to a square frame
        cropped = image[:, start_y:start_y + crop_size, start_x:start_x + crop_size, :]

        # 2. Reshaping for PyTorch interpolation
        # F.interpolate demands a [Batch, Channels, Height, Width] structure
        # Permute shifts: Batch(0)->0, Channels(3)->1, Height(1)->2, Width(2)->3
        img_permuted = cropped.permute(0, 3, 1, 2)

        # 3. Perform bilinear scaling down to 200x200
        resized_permuted = F.interpolate(
            img_permuted,
            size=(200, 200),
            mode="bilinear",
            align_corners=False
        )

        # 4. Revert the layout order back to ComfyUI standard: [B, H, W, C]
        final_image = resized_permuted.permute(0, 2, 3, 1).contiguous()

        return (final_image,)

class MakeThumbnailAdv:
    """
    Advanced thumbnail processor that crops any image tensor into a perfect square
    based on selected alignment, then downscales it to the chosen dimensions
    using a custom resampling filter.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "size": ([
                             "100x100",
                             "200x200",  # Default selection
                             "300x300",
                             "400x400",
                             "500x500"
                         ], {"default": "200x200"}),
                "alignment": ([
                                  "Top / Left",
                                  "Center",  # Default selection
                                  "Bottom / Right"
                              ], {"default": "Center"}),
                "filter_mode": ([
                                    "Bilinear (Smooth)",
                                    "Bicubic (Sharp)",
                                    "Lanczos (High-Quality)",
                                    "Nearest (Pixel Art)",
                                    "Area (Anti-Aliased)"
                                ], {"default": "Bilinear (Smooth)"}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "generate_thumbnail"
    CATEGORY = "agi/image"  # <-- Set your custom menu path category

    def generate_thumbnail(self, image, size, alignment, filter_mode):
        # --- ROBUST INTERFACE UNWRAPPING ---
        # Safeguard against list wrapping bugs in modern ComfyUI dropdown configurations
        clean_size = size[0] if isinstance(size, list) else size
        clean_alignment = alignment[0] if isinstance(alignment, list) else alignment
        clean_filter = filter_mode[0] if isinstance(filter_mode, list) else filter_mode

        # Parse target dimension integer (e.g., "200x200" -> 200)
        target_dim = int(clean_size.split("x")[0])

        # ComfyUI image format layout: [Batch, Height, Width, Channels]
        b, h, w, c = image.shape
        crop_size = min(h, w)

        # 2. Smart Box Offset Algebra based on user alignment selection
        if h > w:
            # Image is Portrait: Calculate Vertical Alignment shifts
            if clean_alignment == "Top / Left":
                start_y = 0
            elif clean_alignment == "Bottom / Right":
                start_y = h - crop_size
            else:  # Center
                start_y = (h - crop_size) // 2
            start_x = 0
        else:
            # Image is Landscape: Calculate Horizontal Alignment shifts
            start_y = 0
            if clean_alignment == "Top / Left":
                start_x = 0
            elif clean_alignment == "Bottom / Right":
                start_x = w - crop_size
            else:  # Center
                start_x = (w - crop_size) // 2

        # 3. Slice the tensor array down to the aligned square box frame
        cropped = image[:, start_y:start_y + crop_size, start_x:start_x + crop_size, :]

        # 4. If Lanczos is selected, route it through ComfyUI's custom mathematical backend
        if "Lanczos" in clean_filter:
            # ComfyUI's built-in resampler expects: [B, C, H, W]
            img_permuted = cropped.permute(0, 3, 1, 2)

            # Use Comfy's common_upscale which handles Lanczos clamping natively
            resized_permuted = comfy.utils.common_upscale(
                img_permuted,
                target_dim,
                target_dim,
                upscale_method="lanczos",
                crop="disabled"
            )

            # Revert back to [B, H, W, C]
            final_image = resized_permuted.permute(0, 2, 3, 1).contiguous()
            return (final_image,)

        # 5. Otherwise, fall back to standard native PyTorch functional loops
        img_permuted = cropped.permute(0, 3, 1, 2)

        mode_arg = "bilinear"
        align_corners_arg = False

        if "Bicubic" in clean_filter:
            mode_arg = "bicubic"
            align_corners_arg = False
        elif "Nearest" in clean_filter:
            mode_arg = "nearest"
            align_corners_arg = None
        elif "Area" in clean_filter:
            mode_arg = "area"
            align_corners_arg = None

        resized_permuted = F.interpolate(
            img_permuted,
            size=(target_dim, target_dim),
            mode=mode_arg,
            align_corners=align_corners_arg
        )

        final_image = resized_permuted.permute(0, 2, 3, 1).contiguous()
        return (final_image,)


NODE_CLASS_MAPPINGS = {
    "MCP_SimpleImageInvert": SimpleImageInvert,
    "MCP_MakeThumbnail": MakeThumbnail,
    "MCP_MakeThumbnailAdv": MakeThumbnailAdv,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MCP_SimpleImageInvert": "Image Invert",
    "MCP_MakeThumbnail": "Make Thumbnail (200x200)",
    "MCP_MakeThumbnailAdv": "Make Thumbnail Advanced"
}