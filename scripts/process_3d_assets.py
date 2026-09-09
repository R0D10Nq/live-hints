"""
Скрипт обработки и сохранения 3D-ассетов с прозрачным фоном для лендинга.
"""

import os
from PIL import Image

BRAIN_DIR = r"C:\Users\RODION\.gemini\antigravity\brain\4e83fa28-db39-4017-b112-f2a154aaa5c9"
TARGET_DIR = os.path.join(os.path.dirname(__file__), "..", "site", "assets")
os.makedirs(TARGET_DIR, exist_ok=True)


def make_transparent_glow(img_path: str, out_path: str, threshold: int = 18, soft_range: int = 35):
    """
    Преобразует темный фон в прозрачный с плавным сохранением светящихся краев.
    """
    img = Image.open(img_path).convert("RGBA")
    data = img.getdata()
    new_data = []

    for item in data:
        r, g, b, a = item
        # Максимальная интенсивность канала
        intensity = max(r, g, b)

        if intensity <= threshold:
            new_data.append((r, g, b, 0))
        elif intensity < threshold + soft_range:
            alpha = int(((intensity - threshold) / soft_range) * 255)
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, 255))

    img.putdata(new_data)
    img.save(out_path, "PNG", optimize=True)
    print(f"Сохранено: {out_path} ({img.size[0]}x{img.size[1]})")


def main():
    # 1. Сфера интеллекта (изолированный шар на чистом черном фоне)
    orb_src = os.path.join(BRAIN_DIR, "abstract_neural_orb_1788941294652.jpg")
    orb_dest = os.path.join(TARGET_DIR, "neural-orb-transparent.png")
    if os.path.exists(orb_src):
        make_transparent_glow(orb_src, orb_dest, threshold=12, soft_range=30)

    # 2. Титановое кольцо (геометрический тор на черном фоне)
    ring_src = os.path.join(BRAIN_DIR, "abstract_ring_1788941309068.jpg")
    ring_dest = os.path.join(TARGET_DIR, "titanium-ring-transparent.png")
    if os.path.exists(ring_src):
        make_transparent_glow(ring_src, ring_dest, threshold=10, soft_range=25)

    # 3. Шелковая волна для Hero
    wave_src = os.path.join(BRAIN_DIR, "hero_silk_wave_1788941279944.jpg")
    wave_dest = os.path.join(TARGET_DIR, "hero-wave-3d.png")
    if os.path.exists(wave_src):
        make_transparent_glow(wave_src, wave_dest, threshold=18, soft_range=40)

    # 4. Широкая панорамная волна для фона
    wide_src = os.path.join(BRAIN_DIR, "silk_wave_wide_1788941328952.jpg")
    wide_dest = os.path.join(TARGET_DIR, "ambient-wave-wide.png")
    if os.path.exists(wide_src):
        make_transparent_glow(wide_src, wide_dest, threshold=20, soft_range=45)


if __name__ == "__main__":
    main()
