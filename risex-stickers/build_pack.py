"""Turn the Higgsfield sticker images into a Telegram-ready pack.

Telegram static stickers: PNG or WEBP, transparent, one side exactly 512 px,
the other 512 px or less, under 512 KB.

Usage:
  python3 build_pack.py              # download from the CDN, then build
  python3 build_pack.py --src DIR    # build from images you already downloaded
"""
import argparse, io, json, os, sys, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_BYTES = 512 * 1024


def fit_512(img):
    img = img.convert("RGBA")
    box = img.getchannel("A").getbbox()
    if box:
        img = img.crop(box)
    pad = max(img.size) // 40  # small margin so the white border isn't clipped
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad))
    scale = 512 / max(canvas.size)
    size = (max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale)))
    out = canvas.resize(size, Image.LANCZOS)
    # One side must be exactly 512.
    if max(out.size) != 512:
        out = out.resize((512, out.height) if out.width >= out.height else (out.width, 512), Image.LANCZOS)
    return out


def save_png(img, path):
    data = io.BytesIO()
    img.save(data, "PNG", optimize=True)
    if data.tell() > MAX_BYTES:
        data = io.BytesIO()
        img.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(data, "PNG", optimize=True)
    with open(path, "wb") as f:
        f.write(data.getvalue())
    return data.tell()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="folder with the original images (skips download)")
    args = ap.parse_args()
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    src = args.src or os.path.join(HERE, "source")
    out = os.path.join(HERE, "pack")
    os.makedirs(src, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    rows = []
    for s in man["stickers"]:
        raw = os.path.join(src, s["file"])
        if not os.path.exists(raw):
            if args.src:
                sys.exit(f"missing {raw}")
            urllib.request.urlretrieve(man["cdn"] + s["file"], raw)
        name = f'{s["n"]:02d}-{s["caption"].replace(" ", "-")}'
        img = fit_512(Image.open(raw))
        size = save_png(img, os.path.join(out, name + ".png"))
        img.save(os.path.join(out, name + ".webp"), "WEBP", quality=90, method=6)
        ok = size <= MAX_BYTES and max(img.size) == 512
        rows.append(f'{name}.png  {img.width}x{img.height}  {size // 1024} KB  {s["emoji"]}  {"ok" if ok else "CHECK"}')
    open(os.path.join(out, "emoji.txt"), "w").write("\n".join(rows) + "\n")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
