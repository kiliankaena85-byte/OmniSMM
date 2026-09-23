import os
from PIL import Image
import numpy as np

def run_analysis():
    img_path = "visual_audit_assets/landing_1440px.png"
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found")
        return
        
    img = Image.open(img_path).convert("RGB")
    pixels = np.array(img).reshape(-1, 3)
    
    # Define design token colors in RGB
    # Group 1: Dominant (background, card, muted)
    tokens_dom = [
        np.array([248, 250, 252]), # bg: #f8fafc
        np.array([255, 255, 255]), # card/input/popover: #ffffff
        np.array([241, 245, 249]), # muted: #f1f5f9
    ]
    
    # Group 2: Secondary (foreground, secondary, border)
    tokens_sec = [
        np.array([15, 23, 42]),    # foreground: #0f172a
        np.array([224, 242, 254]), # secondary: #e0f2fe
        np.array([226, 232, 240]), # border: #e2e8f0
    ]
    
    # Group 3: Accent (primary, destructive, success)
    tokens_acc = [
        np.array([3, 105, 161]),   # primary: #0369a1
        np.array([244, 63, 94]),   # destructive: #f43f5e
        np.array([16, 185, 129]),  # success: #10b981
    ]
    
    # Calculate min Euclidean distance for each pixel to each token group
    # To speed up, we can sample the pixels (e.g. every 10th pixel) or run on full
    # Let's run on full using vectorization
    pixels_float = pixels.astype(float)
    
    dist_dom = np.min([np.linalg.norm(pixels_float - t, axis=1) for t in tokens_dom], axis=0)
    dist_sec = np.min([np.linalg.norm(pixels_float - t, axis=1) for t in tokens_sec], axis=0)
    dist_acc = np.min([np.linalg.norm(pixels_float - t, axis=1) for t in tokens_acc], axis=0)
    
    # Classify pixels: assign to the group with the minimum distance, provided that distance < 45 (approx Delta-E equivalent)
    # If the distance is too large, it is unclassified (ignored or categorized based on nearest)
    min_dists = np.minimum(np.minimum(dist_dom, dist_sec), dist_acc)
    
    # We count pixels close to each group
    # Threshold distance of 45 in RGB is roughly equivalent to Delta-E 15
    threshold = 45.0
    
    dom_mask = (dist_dom == min_dists) & (min_dists < threshold)
    sec_mask = (dist_sec == min_dists) & (min_dists < threshold)
    acc_mask = (dist_acc == min_dists) & (min_dists < threshold)
    
    total = len(pixels)
    dom_count = np.sum(dom_mask)
    sec_count = np.sum(sec_mask)
    acc_count = np.sum(acc_mask)
    unclassified_count = total - (dom_count + sec_count + acc_count)
    
    dom_pct = dom_count / total * 100
    sec_pct = sec_count / total * 100
    acc_pct = acc_count / total * 100
    unclassified_pct = unclassified_count / total * 100
    
    print(f"Total pixels: {total}")
    print(f"Dominant (Group 1): {dom_pct:.2f}% ({dom_count} px)")
    print(f"Secondary (Group 2): {sec_pct:.2f}% ({sec_count} px)")
    print(f"Accent (Group 3): {acc_pct:.2f}% ({acc_count} px)")
    print(f"Unclassified: {unclassified_pct:.2f}% ({unclassified_count} px)")

if __name__ == "__main__":
    run_analysis()
