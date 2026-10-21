"""Textures for the Blender-made savanna, built from the project's CC0 Poly Haven scans (photographed bark, rock and
earth, regraded for the dry season) and procedurally drawn alpha atlases (acacia leaf sprays, grass)."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

PH = '/mnt/project-files/blender/assets/polyhaven/textures'


def scan(name, kind, size):
    return Image.open(f'{PH}/{name}/{name}_{kind}_2k.jpg').convert('RGB').resize((size, size), Image.LANCZOS)


def grade(im, sat=1., bright=1., tint=(1, 1, 1)):
    im = ImageEnhance.Color(im).enhance(sat); im = ImageEnhance.Brightness(im).enhance(bright)
    a = np.asarray(im).astype(np.float32) * np.array(tint)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def leaf_atlas(path, tile=256, columns=4, seed=3):
    """Acacia sprays: thin twigs carrying feathery bipinnate leaves made of hundreds of tiny leaflets."""
    rng = np.random.default_rng(seed)
    big = 2  # draw at 2x and downsample for soft edges
    W, H = tile * columns * big, tile * big
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    greens = [(92, 106, 54), (104, 116, 60), (82, 96, 50), (116, 124, 68), (98, 104, 56), (126, 128, 76)]
    for c in range(columns):
        ox = c * tile * big; cx, cy = ox + tile * big / 2, H / 2
        for spray in range(5 + c):
            a = rng.random() * 6.283; L = tile * big * (.25 + .2 * rng.random())
            x0, y0 = cx + rng.normal(0, tile * big * .08), cy + rng.normal(0, tile * big * .08)
            x1, y1 = x0 + math.cos(a) * L, y0 + math.sin(a) * L
            d.line([(x0, y0), (x1, y1)], fill=(86, 70, 52, 255), width=3)
            for p in range(9):
                t = (p + 1) / 10; px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for side in (-1, 1):
                    b = a + side * (1.1 + rng.normal(0, .2)); l2 = L * .32 * (1 - .4 * t) * (.7 + .5 * rng.random())
                    g = greens[rng.integers(len(greens))]
                    for q in range(10):
                        u = (q + 1) / 11; qx, qy = px + math.cos(b) * l2 * u, py + math.sin(b) * l2 * u
                        for s2 in (-1, 1):
                            r = 3.4 * (1 - .4 * u) * big / 2 + 1
                            lx, ly = qx + math.cos(b + s2 * 1.4) * r * 1.4, qy + math.sin(b + s2 * 1.4) * r * 1.4
                            sh = .8 + .4 * rng.random()
                            d.ellipse([lx - r, ly - r * .7, lx + r, ly + r * .7], fill=(int(g[0] * sh), int(g[1] * sh), int(g[2] * sh), 255))
    im = im.resize((tile * columns, tile), Image.LANCZOS)
    # keep colour under the cut-out edge (alpha-tested mips otherwise bleed black)
    a = np.asarray(im).astype(np.float32); rgb = a[..., :3]; al = a[..., 3:] / 255
    blur = np.asarray(Image.fromarray(np.clip(rgb * al, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    wb = np.asarray(Image.fromarray((al[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None] / 255
    fill = blur / np.maximum(wb, 1e-3)
    rgb = rgb * al + fill * (1 - al)
    Image.fromarray(np.concatenate([np.clip(rgb, 0, 255), a[..., 3:]], 2).astype(np.uint8), 'RGBA').save(path)
    return path


def acacia_textures(outdir):
    os.makedirs(outdir, exist_ok=True)
    out = {'bark': os.path.join(outdir, 'acacia_bark.jpg'), 'bark_n': os.path.join(outdir, 'acacia_bark_n.jpg'), 'leaf': os.path.join(outdir, 'acacia_leaf.png')}
    # umbrella-thorn bark: dark grey-brown, deeply fissured, no moss
    grade(scan('bark_brown_02', 'diff', 1024), sat=.35, bright=.95, tint=(1.04, .98, .9)).save(out['bark'], quality=88)
    scan('bark_brown_02', 'nor_gl', 1024).save(out['bark_n'], quality=92)
    leaf_atlas(out['leaf'])
    return out


def grass_atlas(path, tile=(256, 512), columns=4, seed=8):
    """Dry-season savanna grass clumps for crossed cards: fine curved blades in straw and gold, darker at the base,
    some with oat-like seed heads (red oat grass, Themeda). Root at the bottom edge."""
    rng = np.random.default_rng(seed); tw, th = tile; big = 2
    W, H = tw * columns * big, th * big
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for c in range(columns):
        ox = c * tw * big
        for b in range(110 + 15 * c):
            x0 = ox + tw * big * (.5 + rng.normal(0, .12)); h = th * big * (.45 + .5 * rng.random()) * (1 if c < 3 else .6)
            lean = rng.normal(0, .35) * tw * big * .5; wid = (1.6 + 2.0 * rng.random()) * big
            base = np.array([150, 128, 80]) * (.85 + .25 * rng.random()); tip = np.array([214, 186, 124]) * (.88 + .15 * rng.random())
            if rng.random() < .25: tip = np.array([196, 150, 98])  # rusty red oat grass
            pts = []
            for k in range(13):
                t = k / 12; x = min(max(x0 + lean * t * t, ox + 6 * big), ox + (tw - 6) * big); y = H - t * h
                pts.append((x, y, wid * (1 - t) ** .8 + .6, base * (1 - t) + tip * t))
            for (x1, y1, w1, c1), (x2, y2, w2, c2) in zip(pts, pts[1:]):
                col = tuple(int(v) for v in (c1 + c2) / 2) + (255,)
                d.polygon([(x1 - w1 / 2, y1), (x1 + w1 / 2, y1), (x2 + w2 / 2, y2), (x2 - w2 / 2, y2)], fill=col)
            if rng.random() < .14:  # a drooping seed head
                x, y = pts[-1][0], pts[-1][1]
                for s in range(7):
                    sx, sy = x + rng.normal(0, 5) * big, y + s * 4 * big
                    d.ellipse([sx - 2 * big, sy - 4 * big, sx + 2 * big, sy + 4 * big], fill=(196, 140, 84, 255))
    im = im.resize((tw * columns, th), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32); al = a[..., 3:] / 255
    # un-premultiply the blade colour and keep a straw colour under the cut-out edge, so mips never darken the fringe
    fill = np.array([180, 150, 90], dtype=np.float32); k = np.minimum(1, al * 4)
    rgb = np.where(al > 0, a[..., :3] / np.maximum(al, 1e-3) * k + fill * (1 - k), fill)
    Image.fromarray(np.concatenate([np.clip(rgb, 0, 255), a[..., 3:]], 2).astype(np.uint8), 'RGBA').save(path)
    return path


def ground_textures(outdir, size=1024):
    """Tiling ground detail for the terrain shader: sun-bleached grass sward and cracked bare earth. Stored as
    detail around mid-grey (the terrain's own vertex colours give the hue), plus a shared normal map."""
    os.makedirs(outdir, exist_ok=True)
    def detail(name, sat, tint):
        im = grade(scan(name, 'diff', size), sat=sat, tint=tint); a = np.asarray(im).astype(np.float32)
        blur = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(size / 16))).astype(np.float32).mean(2, keepdims=True)
        # keep local detail and a touch of the scan's own colour, flatten the large-scale tone
        out = 128 * (a / np.maximum(blur, 1))
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    grass = detail('sparse_grass', .15, (1.1, 1., .75)); earth = detail('rock_boulder_cracked', .4, (1, 1, 1))
    grass.save(os.path.join(outdir, 'ground_grass.jpg'), quality=88); earth.save(os.path.join(outdir, 'ground_earth.jpg'), quality=88)
    scan('sparse_grass', 'nor_gl', size).save(os.path.join(outdir, 'ground_grass_n.jpg'), quality=90)
    scan('rock_boulder_cracked', 'nor_gl', size).save(os.path.join(outdir, 'ground_earth_n.jpg'), quality=90)


def rock_textures(outdir):
    """Savanna granite: the scan's own texture, warmed and lightened toward sun-baked pinkish-grey granite."""
    src = '/mnt/project-files/blender/assets/polyhaven/models/boulder_01/textures/boulder_01_%s_2k.jpg'
    out = {'diff': os.path.join(outdir, 'granite.jpg'), 'nor': os.path.join(outdir, 'granite_n.jpg')}
    im = Image.open(src % 'diff').convert('RGB').resize((1024, 1024), Image.LANCZOS)
    grade(im, sat=.55, bright=1.25, tint=(1.06, 1., .92)).save(out['diff'], quality=88)
    Image.open(src % 'nor_gl').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out['nor'], quality=90)
    return out
