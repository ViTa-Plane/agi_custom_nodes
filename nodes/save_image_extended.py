import os
import torch
import numpy as np
from PIL import Image
import folder_paths


class CustomSaveImage:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "output_path": ("STRING", {"default": "output", "multiline": False}),
                "filename_prefix": ("STRING", {"default": "ComfyUI_Image", "multiline": False}),
                "file_format": (["png", "jpg", "jpeg", "webp", "bmp", "tiff"], {"default": "png"}),
                "quality": ("INT", {"default": 95, "min": 1, "max": 100, "step": 1}),
                "overwrite": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    OUTPUT_NODE = True
    CATEGORY = "image"

    def save_images(self, images, output_path, filename_prefix, file_format, quality, overwrite):
        # Resolve base target directory
        if not os.path.isabs(output_path):
            target_dir = os.path.join(self.output_dir, output_path)
        else:
            target_dir = output_path

        # Extract any subdirectories and file extension from filename_prefix
        # e.g., "folder/subfolder/my_image.jpg" -> prefix_dir = "folder/subfolder", base_file = "my_image.jpg"
        prefix_dir, base_file = os.path.split(filename_prefix)
        clean_prefix, _ = os.path.splitext(base_file)

        # If subdirectories are included in the filename prefix, append them to the target directory
        if prefix_dir:
            target_dir = os.path.join(target_dir, prefix_dir)

        # Automatically create target folder and any nested subdirectories before saving
        os.makedirs(target_dir, exist_ok=True)

        results = []

        for idx, image in enumerate(images):
            # Convert PyTorch tensor (B, H, W, C) float [0, 1] to NumPy uint8 [0, 255]
            i = 255.0 * image.cpu().numpy()
            img_np = np.clip(i, 0, 255).astype(np.uint8)
            img = Image.fromarray(img_np)

            # Determine extension
            format_ext = file_format.lower()
            if format_ext == "jpeg":
                format_ext = "jpg"

            if len(images) > 1:
                filename = f"{clean_prefix}_{idx + 1:04d}.{format_ext}"
            else:
                filename = f"{clean_prefix}.{format_ext}"

            full_path = os.path.join(target_dir, filename)

            # Handle duplicates if overwrite is False
            if not overwrite and len(images) == 1 and os.path.exists(full_path):
                counter = 1
                while os.path.exists(full_path):
                    filename = f"{clean_prefix}_{counter:04d}.{format_ext}"
                    full_path = os.path.join(target_dir, filename)
                    counter += 1

            # Save according to format requirements
            save_kwargs = {}
            if format_ext in ["jpg", "webp"]:
                save_kwargs["quality"] = quality
                if format_ext == "jpg" and img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
            elif format_ext == "png":
                save_kwargs["compress_level"] = 4

            img.save(full_path, **save_kwargs)

            # Build UI result safely without triggering cross-drive server errors
            try:
                rel_path = os.path.relpath(target_dir, self.output_dir)
                if not rel_path.startswith("..") and not os.path.isabs(rel_path):
                    results.append({
                        "filename": filename,
                        "subfolder": rel_path.replace("\\", "/") if rel_path != "." else "",
                        "type": "output"
                    })
            except ValueError:
                pass

        return {"ui": {"images": results}}


NODE_CLASS_MAPPINGS = {
    "CustomSaveImage": CustomSaveImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CustomSaveImage": "Save Image (Format & Path)"
}