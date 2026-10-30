def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hex_color):
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return 0.2126 * srgb_to_lin(r) + 0.7152 * srgb_to_lin(g) + 0.0722 * srgb_to_lin(b)

def contrast_ratio(hex1, hex2):
    l1 = luminance(hex1)
    l2 = luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

colors = {
    'convenience_pharmacy': '#be185d',
    'restaurant': '#b91c1c',
    'parking': '#475569',
    'transit': '#1d4ed8',
    'coffee_tea': '#78350f',
    'bar': '#6b21a8',
    'hotel': '#c2410c',
    'attraction_art': '#854d0e',
    'park_outdoors': '#15803d',
    'grocery': '#0f766e',
}

white = '#ffffff'
for cat, col in colors.items():
    cr = contrast_ratio(col, white)
    print(f"{cat}: {col} -> Contrast vs white: {cr:.2f}:1 ({'PASS (>=4.5)' if cr >= 4.5 else 'FAIL'})")
