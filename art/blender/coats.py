"""Per-species look for build_animal.py: anatomical masses fused into the body, the coat painted on the fine surface
(linear colour per vertex plus a fur-grain offset in metres), and hair cards. Positions are three.js metres
(x forward, y up, z to the animal's right), as in components/game/safari-animals.ts."""
import math
import numpy as np
from mathutils import Vector, noise


def hexc(h):
    """sRGB hex -> linear rgb"""
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]


def C(h):
    return np.array(hexc(h))


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = np.asarray(t)[..., None] if np.ndim(t) else t
    return a * (1 - t) + b * t


def fbm(P, scale, octaves=3, stretch=(1, 1, 1), seed=0):
    """fractal noise per point, roughly -1..1"""
    out = np.zeros(len(P)); amp = 1; tot = 0
    sx, sy, sz = stretch
    for o in range(octaves):
        f = scale * (2 ** o)
        out += amp * np.array([noise.noise(Vector((p[0] * f * sx + seed * 17.3, p[1] * f * sy + seed * 3.1, p[2] * f * sz))) for p in P])
        tot += amp; amp *= .5
    return out / tot


def mirrored(items):
    out = []
    for m in items:
        out.append(m)
        if m['c'][2] != 0:
            j = m['joint'].replace('R', 'L') if m['joint'].startswith('leg') else m['joint']
            r = m.get('rot', (0, 0, 0))
            out.append({**m, 'c': (m['c'][0], m['c'][1], -m['c'][2]), 'joint': j, 'rot': (-r[0], -r[1], r[2])})
    return out


# ---------------------------------------------------------------- lion
def lion_masses(spec):
    return mirrored([
        # shoulder blade and the heavy forequarters
        {'c': (.36, 1.0, .19), 'r': (.17, .21, .07), 'rot': (0, 0, .4), 'joint': 'legFR0'},
        {'c': (.36, .76, .18), 'r': (.12, .14, .08), 'joint': 'legFR0'},
        {'c': (.41, .45, .165), 'r': (.065, .13, .06), 'rot': (0, 0, -.1), 'joint': 'legFR1'},
        # haunch and thigh
        {'c': (-.55, .88, .15), 'r': (.21, .2, .085), 'rot': (0, 0, -.2), 'joint': 'legHR0'},
        {'c': (-.47, .64, .16), 'r': (.1, .13, .07), 'rot': (0, 0, .3), 'joint': 'legHR0'},
        # ribcage under the skin and a slight belly sag
        {'c': (.12, .9, 0), 'r': (.36, .27, .26), 'joint': 'body'},
        # face: brow, whisker pads, chin, cheekbones
        {'c': (.99, 1.265, .065), 'r': (.05, .028, .04), 'joint': 'head'},
        {'c': (1.135, 1.095, .045), 'r': (.055, .042, .045), 'joint': 'head'},
        {'c': (1.07, 1.04, 0), 'r': (.07, .03, .05), 'joint': 'head'},
        {'c': (.95, 1.17, .12), 'r': (.07, .05, .04), 'joint': 'head'},
        # the broad lion head: a heavy brow and forehead, a long flat-topped muzzle
        {'c': (.92, 1.29, 0), 'r': (.12, .06, .12), 'joint': 'head'},
        {'c': (1.09, 1.165, 0), 'r': (.1, .045, .07), 'joint': 'head'},
        # big paws, a strong forearm, the gaskin and the point of the hock
        {'c': (.5, .055, .16), 'r': (.1, .055, .085), 'joint': 'legFR2'},
        {'c': (-.56, .055, .16), 'r': (.095, .052, .08), 'joint': 'legHR2'},
        {'c': (-.52, .5, .16), 'r': (.08, .12, .065), 'rot': (0, 0, .5), 'joint': 'legHR1'},
        {'c': (-.7, .3, .16), 'r': (.035, .055, .035), 'joint': 'legHR1'},
    ])


def lion_paint(P, N, part, spec):
    n = len(P); x, y, z = P[:, 0], P[:, 1], P[:, 2]; nx, ny, nz = N[:, 0], N[:, 1], N[:, 2]
    base = part_root = np.array([p.split('#')[0].replace('mass:', '') for p in part])
    is_ = lambda *names: np.isin(part_root, names)
    legs = np.char.startswith(part_root.astype(str), 'leg')
    big = fbm(P, 3.0, 3, seed=1); fine = fbm(P, 22, 2, (1, 4, 4), seed=2)
    # body: darker golden back, warm flanks, pale belly and inner legs
    back = smooth(.1, .9, ny)
    col = mix(C(0xbfa47e), C(0x9c8058), back)
    # a darker line down the spine
    col = mix(col, C(0x8e6a3e), smooth(.08, .0, np.abs(z)) * smooth(.7, .95, ny) * .5)
    col = mix(col, C(0xcfbb98), smooth(.86, .66, y) * (1 - back))
    col = mix(col, C(0xe2d6bc), smooth(-.25, -.75, ny))
    inner = legs & (nz * np.sign(z + 1e-6) < -.25)
    col[inner] = mix(col[inner], C(0xd4c2a0), .35)
    lower = legs & (y < .45)
    col[lower] = mix(col[lower], C(0xc4a87e), .2)
    # head
    h = is_('head')
    face = mix(C(0xbc9c70), C(0xa3804f), smooth(0, .9, ny))
    col[h] = face[h]
    muzzle = h & (x > 1.04) & (y < 1.17)
    col[muzzle] = mix(col[muzzle], C(0xe6d7ba), .55)
    chin = h & (y < 1.06)
    col[chin] = C(0xe9e0cc)
    lip = h & (x > 1.03) & (np.abs(y - 1.073) < .005) & (np.abs(z) > .02)
    col[lip] = C(0x3a2a20)
    nose = h & (x > 1.175) & (nx > .5) & (y > 1.09)
    col[nose] = C(0x6e4438)
    nostril = nose & (np.abs(z) > .022) & (y < 1.115)
    col[nostril] = C(0x2a1612)
    # pale rims around the eyes and the dark tear line
    ex, ey, ez = spec['eye']['c']
    de = np.hypot(x - ex, y - ey) + 0 * z
    side = np.abs(np.abs(z) - ez) < .06
    # a dark rim around each eye and a pale patch under it, as on a real lion's face
    below = h & side & (de < .055) & (de > .03) & (y < ey)
    col[below] = mix(col[below], C(0xe9dbbd), .55)
    col[h & side & (de < .033) & (de > .022)] = C(0x2a1a12)
    tear = h & side & (np.abs(y - (ey - .03 - (x - ex) * .6)) < .007) & (x > ex) & (x < ex + .07)
    col[tear] = mix(col[tear], C(0x4a2c1c), .6)
    # whisker spots
    ws = h & (x > 1.08) & (y > 1.075) & (y < 1.13) & (np.abs(z) > .03)
    dots = ws & (np.sin(x * 260) * np.sin(y * 300) > .75)
    col[dots] = mix(col[dots], C(0x3a2416), .7)
    # ears: dark backs, pale insides
    e = is_('earR', 'earL')
    col[e] = np.where((nx < .2)[e][:, None], C(0x33241a), C(0xb4966c))
    # mane: gold around the face, deepening to dark brown behind and below, in strands
    m = np.array(['#mane' in p for p in part])
    r = np.hypot(y - 1.2, z)
    t = np.clip(smooth(.12, .42, r) * .55 + smooth(.8, .35, x) * .35 + (y < 1.0) * .3 + fbm(P, 9, 2, (3, .5, 3), seed=4) * .35, 0, 1)
    mane = mix(mix(C(0xa98656), C(0x765234), smooth(0, .5, t)), C(0x3a281c), smooth(.5, 1, t))
    col[m] = mane[m]
    # tail tuft
    tuft = np.array(['#tuft' in p for p in part]) | (is_('tail2') & (x < -1.3))
    col[tuft] = C(0x2b1b12)
    # paws: a little darker at the toes
    paw = legs & (y < .07)
    col[paw] = mix(col[paw], C(0xb98f5c), .4)
    # natural variation: mottling and fur grain
    col *= (1 + big * .07)[:, None]
    col *= (1 + fine * .05)[:, None]
    # fur grain for the normal map: short coat lies back along the body and down the legs; the mane is long strands
    fur = np.where(legs, fbm(P, 70, 2, (4, .6, 4), seed=7), fbm(P, 70, 2, (.6, 4, 4), seed=8)) * .0012
    fur = np.where(m, fbm(P, 16, 3, (4, .7, 4), seed=9) * .009, fur)
    return np.clip(col, 0, 1), fur


STYLE = {
    'lion': {'masses': lion_masses, 'paint': lion_paint, 'iris': 0xc8902c, 'pupil': .93, 'voxel': .0075, 'relax': 12, 'soften': 6,
             'tris': 9000, 'far_tris': 1600, 'tex': 1024, 'blend': .03},
}


def paint(species, P, N, part, spec):
    return STYLE[species]['paint'](P, N, part, spec)


def hair_texture(path, size=512, columns=4):
    """An atlas of hair locks: `columns` strips, each a tapering bundle of wavy strands, root at v=0, tip at v=1.
    Grey-warm luminance (the card's vertex colour tints it) with alpha cut around the strands."""
    from PIL import Image
    rng = np.random.default_rng(5)
    img = np.zeros((size, size, 4), dtype=np.float32)
    ys = np.arange(size) / (size - 1)  # v: 0 root .. 1 tip
    w = size // columns
    for c in range(columns):
        for s in range(70):
            x0 = c * w + w * (.12 + .76 * rng.random()); wave = rng.random() * 6.28; amp = w * (.02 + .05 * rng.random())
            end = .72 + .28 * rng.random(); width = 1.2 + 2.2 * rng.random(); shade = .55 + .45 * rng.random()
            # locks narrow toward the tip, strands converge
            for yi, v in enumerate(ys):
                if v > end: break
                xc = c * w + w / 2 + (x0 - c * w - w / 2) * (1 - .55 * v) + amp * math.sin(wave + v * 7)
                half = width * (1 - .7 * (v / end) ** 2) / 2
                lo_, hi_ = int(xc - half - 1), int(xc + half + 2)
                for xi in range(max(c * w, lo_), min((c + 1) * w, hi_)):
                    a = np.clip(half + .5 - abs(xi + .5 - xc), 0, 1)
                    row = size - 1 - yi
                    lum = shade * (.7 + .3 * v)
                    if a > img[row, xi, 3]:
                        img[row, xi] = (lum, lum * .97, lum * .92, a)
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA').save(path)
    return path


def hair(species, roots, spec):
    if species != 'lion':
        return None
    return lion_mane(roots)


def lion_mane(roots, columns=4):
    """Cards for the mane: locks growing out of the mane surface, falling back and down under their own weight,
    longer on the neck and chest than around the face; plus elbow tufts and a belly fringe."""
    rng = np.random.default_rng(11)
    P, N, col, part = roots['P'], roots['N'], roots['col'], roots['part']
    mane = np.array(['#mane' in p for p in part])
    idx = np.nonzero(mane)[0]
    verts, faces, uvs, cols = [], [], [], []

    def card(root, n, length, width, droop, tint, seg=4):
        out = n / np.linalg.norm(n)
        d = out * .5 + np.array([-.5, -.35, 0]) + rng.normal(0, .07, 3); d /= np.linalg.norm(d)
        side = np.cross(d, out); 
        if np.linalg.norm(side) < 1e-3: side = np.array([0, 0, 1.])
        side /= np.linalg.norm(side)
        twist = rng.normal(0, .35); side = side * math.cos(twist) + out * math.sin(twist)
        col_u = rng.integers(columns) / columns
        p = root - out * .012; base = len(verts)
        for k in range(seg + 1):
            v = k / seg
            for s_ in (-.5, .5):
                verts.append(p + side * width * s_ * (1 - .25 * v))
                uvs.append((col_u + (s_ + .5) / columns, v))
                cols.append(tint * (.6 + .55 * v))
            # bend toward the ground as the lock lengthens
            d = d + np.array([0, -droop, 0]) / seg; d /= np.linalg.norm(d)
            p = p + d * length / seg
        for k in range(seg):
            a = base + 2 * k
            faces.append((a, a + 1, a + 3, a + 2))

    pick = rng.choice(idx, size=min(len(idx), 1100), replace=False)
    for i in pick:
        p, n = P[i], N[i]
        if n[1] < -.8: continue
        r = math.hypot(p[1] - 1.2, p[2]); low = max(0, 1.05 - p[1])
        length = .07 + .1 * min(1, r / .38) + .16 * min(1, low / .3) + rng.random() * .03
        face_ring = p[0] > .82
        if face_ring: length *= .55
        card(p, n, length, .07 + .04 * rng.random(), .5 + .5 * low, col[i] * (1.1 + .12 * rng.random()))
    # elbow tufts and the belly fringe of a mature male
    body = np.array([p.startswith('torso') or p == 'mass:body' for p in part])
    belly = np.nonzero(body & (N[:, 1] < -.6) & (P[:, 0] > -.2) & (P[:, 0] < .45))[0]
    for i in rng.choice(belly, size=min(len(belly), 40), replace=False):
        card(P[i], N[i] + np.array([0, -.5, 0]), .05 + .03 * rng.random(), .05, 1.2, np.array(hexc(0x6a4026)) * (.8 + .3 * rng.random()), seg=2)
    return np.array(verts), faces, uvs, np.array(cols)
