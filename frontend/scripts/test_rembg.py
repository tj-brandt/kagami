from rembg import remove
from PIL import Image
import os

# === CONFIG ===
input_path = "frontend/public/sample_input.png"   # Put your test image here
output_path = "frontend/public/sample_output.png"  # Output will be saved here

# === Check that input exists ===
if not os.path.exists(input_path):
    print(f"❌ Input image not found at: {input_path}")
    print("👉 Place a PNG or JPG file named 'sample_input.png' inside 'frontend/public' and re-run.")
    exit(1)

# === Run background removal ===
print(f"🧠 Removing background from {input_path}...")
input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)
print(f"✅ Saved background-removed image to: {output_path}")
