"""Genererar appens ikoner i alla storlekar, plus favicon.ico.

Motivet är ett procenttecken i legostil — två ringar och en rak stapel i
grafit mot en dämpad salviegrön botten. Körs med `python
tools/generate-icons.py` och skriver över filerna i src/assets/icons. Inga
beroenden utöver standardbiblioteket.
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "icons"

# 180 för hemskärmen, 192 och 512 för manifestet, 1024 för hög upplösning.
SIZES = (180, 192, 512, 1024)

GRAPHITE = (48, 51, 56)
SAGE_TOP = (208, 216, 205)
SAGE_BOTTOM = (184, 197, 183)

# Supersampling per axel. Motivet har hårda kanter, så det behövs för mjuka linjer.
SAMPLES = 3

# Procenttecknet: två lika stora ringar i motsatta hörn och en stapel mellan
# dem. Ringarnas hål är stora nog att synas kvar vid 48 px på hemskärmen.
RING_CENTERS = ((0.335, 0.335), (0.665, 0.665))
RING_OUTER = 0.128
RING_INNER = 0.062

BAR_START = (0.285, 0.735)
BAR_END = (0.715, 0.265)
BAR_HALF_WIDTH = 0.056


def lerp(a, b, t):
    t = min(max(t, 0.0), 1.0)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def distance_to_segment(x, y, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length_squared = dx * dx + dy * dy
    t = 0.0 if length_squared == 0 else ((x - x1) * dx + (y - y1) * dy) / length_squared
    t = min(max(t, 0.0), 1.0)
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def in_ring(x, y, center):
    distance = math.hypot(x - center[0], y - center[1])
    return RING_INNER <= distance <= RING_OUTER


def in_bar(x, y):
    return distance_to_segment(x, y, *BAR_START, *BAR_END) <= BAR_HALF_WIDTH


def in_percent(x, y):
    if in_bar(x, y):
        return True
    return any(in_ring(x, y, center) for center in RING_CENTERS)


def sample(x, y):
    if in_percent(x, y):
        return GRAPHITE
    return lerp(SAGE_TOP, SAGE_BOTTOM, y)


def chunk(tag, payload):
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
    )


def render(size):
    rows = bytearray()
    step = 1.0 / (size * SAMPLES)

    for py in range(size):
        rows.append(0)  # filtertyp None
        for px in range(size):
            red = green = blue = 0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    color = sample(
                        (px * SAMPLES + sx + 0.5) * step,
                        (py * SAMPLES + sy + 0.5) * step,
                    )
                    red += color[0]
                    green += color[1]
                    blue += color[2]
            count = SAMPLES * SAMPLES
            rows += bytes((red // count, green // count, blue // count))

    return bytes(rows)


def write_png(path, size, pixels):
    # Färgtyp 2 = RGB utan alfa. iOS kräver ogenomskinliga ikoner, och
    # genomskinlighet skulle bli svart på hemskärmen.
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    # sRGB och gAMA taggar färgrymden. Utan dem är bilden otaggad och varje
    # visare får gissa, vilket kan ge en annan ton på skärmar med bredare
    # färgrymd än sRGB.
    srgb = chunk(b"sRGB", bytes([0]))  # 0 = perceptuell återgivning
    gama = chunk(b"gAMA", struct.pack(">I", 45455))  # 1/2,2
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + srgb
        + gama
        + chunk(b"IDAT", zlib.compress(pixels, 9))
        + chunk(b"IEND", b"")
    )


def write_ico(path, size):
    """En ICO med en enda bild, lagrad som PNG. Alla webbläsare sedan IE11
    läser den formen, och den slipper BMP-formatets omvända radordning."""
    png = path.with_suffix(".tmp.png")
    write_png(png, size, render(size))
    payload = png.read_bytes()
    png.unlink()

    header = struct.pack("<HHH", 0, 1, 1)  # reserverat, typ 1 = ikon, ett blad
    entry = struct.pack(
        "<BBBBHHII", size, size, 0, 0, 1, 32, len(payload), len(header) + 16
    )
    path.write_bytes(header + entry + payload)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        target = OUT / f"icon-{size}.png"
        write_png(target, size, render(size))
        print(f"{target.name}: {target.stat().st_size} byte")

    favicon = OUT.parent.parent / "favicon.ico"
    write_ico(favicon, 64)
    print(f"{favicon.name}: {favicon.stat().st_size} byte")


if __name__ == "__main__":
    main()
