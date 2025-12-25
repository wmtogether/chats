from PIL import Image

def convert_png_to_ico(input_path, output_path):
    try:
        # Open the source image
        img = Image.open(input_path)

        # Standard ICO sizes
        # 256x256 is vital for Windows 10/11 large icons
        icon_sizes = [
            (16, 16),
            (32, 32),
            (48, 48),
            (64, 64),
            (128, 128),
            (256, 256)
        ]

        # Save as ICO
        # The 'append_images' isn't strictly needed for ICO in Pillow
        # if you pass the 'sizes' parameter with a single image source;
        # Pillow handles the resizing automatically.
        img.save(output_path, format='ICO', sizes=icon_sizes)
        
        print(f"Success! Converted '{input_path}' to '{output_path}'")
        print(f"Included sizes: {icon_sizes}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Change these filenames as needed
    input_file = "../Icons/Content.png"
    output_file = "../Icons/icon.ico"
    
    convert_png_to_ico(input_file, output_file)