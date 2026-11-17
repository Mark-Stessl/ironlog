"""Draws Ironlog's icons from the brand mark used in the sidebar:
three cyan bars (the middle one taller) on a dark rounded tile.

Usage: python3 scripts/make-icons.py   (writes into assets/images and public/)
"""
from PIL import Image, ImageDraw, ImageFilter

BG = (10, 15, 18)        # app background #0A0F12
TILE = (16, 23, 27)      # card #10171B
EDGE = (42, 57, 67)      # border #2A3943
CYAN = (34, 211, 238)    # accent #22D3EE
SS = 4                   # supersampling for smooth edges


def bars(draw, cx, cy, unit, color):
    """The mark: bars 3 units wide, 3 apart, heights 9 / 14 / 9 (as in the sidebar)."""
    w, gap = 3 * unit, 3 * unit
    for i, h in enumerate((9, 14, 9)):
        x = cx + (i - 1) * (w + gap) - w / 2
        hh = h * unit
        draw.rounded_rectangle([x, cy - hh / 2, x + w, cy + hh / 2], radius=w / 2, fill=color)


def render(size, *, bg=None, tile=True, unit_ratio=1.0, glow=False, color=CYAN, transparent=False):
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0) if transparent else (*(bg or BG), 255))
    if glow:
        g = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([S * 0.2, S * 0.2, S * 0.8, S * 0.8], fill=(*CYAN, 38))
        img.alpha_composite(g.filter(ImageFilter.GaussianBlur(S * 0.12)))
    d = ImageDraw.Draw(img)
    if tile:
        m = S * 0.04
        d.rounded_rectangle([m, m, S - m, S - m], radius=S * 0.24, fill=(*TILE, 255), outline=(*EDGE, 255), width=max(1, int(S * 0.03)))
    unit = S / 28 * unit_ratio  # sidebar mark is a 28 px tile
    bars(d, S / 2, S / 2, unit, (*color, 255))
    return img.resize((size, size), Image.LANCZOS)


out = 'assets/images/'
# App icon (iOS masks the corners itself): full-bleed dark background, soft glow, big bars.
render(1024, tile=False, unit_ratio=0.95, glow=True).convert('RGB').save(out + 'icon.png')
# Android adaptive icon: foreground on transparent (safe zone = middle 66%), plain background.
render(1024, tile=False, unit_ratio=0.68, transparent=True).save(out + 'android-icon-foreground.png')
Image.new('RGB', (1024, 1024), BG).save(out + 'android-icon-background.png')
render(1024, tile=False, unit_ratio=0.68, transparent=True, color=(255, 255, 255)).save(out + 'android-icon-monochrome.png')
# Splash: the tile mark, like on the landing page.
render(512, tile=True, transparent=True).save(out + 'splash-icon.png')
# Browser tab + home screen.
render(64, tile=True, transparent=True).save(out + 'favicon.png')
render(180, tile=False, unit_ratio=0.95, glow=True).convert('RGB').save('public/apple-touch-icon.png')
render(512, tile=False, unit_ratio=0.95, glow=True).convert('RGB').save('public/icon-512.png')
render(192, tile=False, unit_ratio=0.95, glow=True).convert('RGB').save('public/icon-192.png')
print('icons written')
