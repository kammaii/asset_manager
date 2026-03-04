from PIL import Image
import sys

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    
    # Very simple blending for anti-aliasing against white background
    # We assume the background was pure white (255, 255, 255).
    # If a pixel is white, it becomes transparent.
    # If a pixel is bright, we try to deduce its original color before blending with white.
    # But for a simple approach, a threshold with an alpha gradient usually works okay.
    
    for item in datas:
        r, g, b, a = item
        # Calculate grayscale intensity of the pixel, to detect light spots
        # However, checking against distances from white works better.
        white_dist = ((255 - r)**2 + (255 - g)**2 + (255 - b)**2)**0.5
        
        # If it's extremely close to white (distance < 15), make it fully transparent
        if white_dist < 15:
            new_data.append((255, 255, 255, 0))
        # If it's somewhat close to white (distance < 60), make it partially transparent to smooth edges
        elif white_dist < 60:
            # Map distance to alpha (0 at dist 15, 255 at dist 60)
            alpha = int(((white_dist - 15) / 45.0) * 255)
            # Ensure we don't increase opacity if it was already lower
            alpha = min(alpha, a)
            
            # Recalculate color (un-premultiply alpha from white background)
            # Roughly estimating: C_obs = C_true * alpha + 255 * (1 - alpha)
            # C_true = (C_obs - 255*(1 - alpha)) / alpha
            try:
                new_r = max(0, min(255, int((r - 255.0 * (1 - alpha/255.0)) / (alpha/255.0))))
                new_g = max(0, min(255, int((g - 255.0 * (1 - alpha/255.0)) / (alpha/255.0))))
                new_b = max(0, min(255, int((b - 255.0 * (1 - alpha/255.0)) / (alpha/255.0))))
                new_data.append((new_r, new_g, new_b, alpha))
            except ZeroDivisionError:
                new_data.append((255, 255, 255, 0))
        else:
            new_data.append((r, g, b, a))

    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    remove_white_bg(sys.argv[1], sys.argv[2])
