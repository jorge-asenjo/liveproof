# Attack fixture: an old real proof edited to show a new code (like the "AI timestamp"
# edits traders report). Paints over the handwritten code and writes a new one in a
# handwriting-style font. A simple edit, not an AI image model.
#   python scripts/edit-code.py <genuine case dir> <cases dir>
# The code boxes below were measured on the first genuine case; adjust them for others.
import json, random, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

base = Path(sys.argv[1]); out_root = Path(sys.argv[2])
meta = json.loads((base / "meta.json").read_text(encoding="utf-8"))
# code boxes per frame (x0, y0, x1, y1), measured on the mouse frames
boxes = {"m1-0.jpg": (570, 418, 765, 488), "m2-0.jpg": (582, 415, 775, 490)}
variants = [("KXT4M", "Inkfree.ttf", 52, (70, 70, 75)), ("DH7RE", "segoesc.ttf", 40, (60, 60, 70)), ("A9CWN", "comic.ttf", 46, (90, 90, 95))]
for n, (code, font_name, size, color) in enumerate(variants, 1):
    out = out_root / f"{base.name}__edited_photo-{n}"
    out.mkdir(parents=True, exist_ok=True)
    for f, box in boxes.items():
        im = Image.open(base / f).convert("RGB")
        x0, y0, x1, y1 = box
        # inpaint the paper: per column, blend from the row above the box to the row below
        px = im.load()
        for x in range(x0, x1):
            top = [sum(px[x, y0 - k][c] for k in range(3, 8)) / 5 for c in range(3)]
            bot = [sum(px[x, y1 + k][c] for k in range(3, 8)) / 5 for c in range(3)]
            for y in range(y0, y1):
                a = (y - y0) / (y1 - y0)
                px[x, y] = tuple(int(top[c] * (1 - a) + bot[c] * a + random.uniform(-2, 2)) for c in range(3))
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        font = ImageFont.truetype(f"C:/Windows/Fonts/{font_name}", size)
        d.text((x0 + 12, y0 + 8), code, font=font, fill=color + (235,))
        layer = layer.rotate(random.uniform(-3, 3), center=((x0 + x1) / 2, (y0 + y1) / 2)).filter(ImageFilter.GaussianBlur(0.6))
        im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
        im.save(out / f, quality=85)
    m = dict(meta); m.update(label="attack", attack="edited_photo", code=code, derivedFrom=base.name,
        notes=f"Old real proof with the code painted over and {code} written with the {font_name} font (gestures as shown). Best case for the attacker: ignores the 15 s window.")
    (out / "meta.json").write_text(json.dumps(m, indent=2), encoding="utf-8")
    print(out)
