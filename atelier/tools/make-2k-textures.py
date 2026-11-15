#!/usr/bin/env python3
# Usage: python3 atelier/tools/make-2k-textures.py [src_dir] [out_dir] [workers]
# The desktop 2K set: public/atelier/tex/4k -> public/atelier/tex/2k, every texture the window ships.
#  - the tiling scans (marble, metal, paper, foil, veneer) and the four prints: half the size each way (4096 -> 2048);
#  - the bakes (labels, scarves, the mat, the deck) and the wall ink: copied as they are; they are small already and carry
#    lettering.
# Like the phone set (~/zuhayrcreative-3dshop/scripts/make-phone-textures.py): decoded (basisu -unpack), downsized
# (resize-texture.py: Lanczos; a normal map as vectors, renormalised), encoded back as the 4K set is (UASTC, mipmapped,
# zstd), keeping its colour space; then zstd'd again at the highest level (rezstd-ktx2.py, lossless).
import os, shutil, struct, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SHOP = os.path.expanduser('~/zuhayrcreative-3dshop/scripts')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'public', 'atelier', 'tex', '4k')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, 'public', 'atelier', 'tex', '2k')
WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
HALVE = ('Foil003', 'Marble003', 'Marble016', 'Metal032', 'Paper001', 'ash_veneer', 'print_')

def transfer(b):  # the KTX2 data format descriptor's transfer function: 1 linear, 2 sRGB
    dfd = struct.unpack_from('<I', b, 48)[0]
    return b[dfd + 14]

def one(name):
    src, dst = os.path.join(SRC, name), os.path.join(OUT, name)
    b = open(src, 'rb').read()
    w, h = struct.unpack_from('<II', b, 20)
    if not name.startswith(HALVE):
        shutil.copy(src, dst)
        return f'{name}: {w}x{h} copied'
    tw, th = max(4, round(w / 2 / 4) * 4), max(4, round(h / 2 / 4) * 4)
    tmp = tempfile.mkdtemp(prefix='tex2k-')
    try:
        shutil.copy(src, os.path.join(tmp, 'in.ktx2'))
        subprocess.run(['basisu', '-unpack', '-no_ktx', 'in.ktx2'], cwd=tmp, check=True, capture_output=True)
        png = next(p for p in os.listdir(tmp) if '_unpacked_rgba_RGBA32_level_0_' in p and p.endswith('.png'))
        normal = name.endswith('_normal.ktx2')
        subprocess.run(['python3', os.path.join(SHOP, 'resize-texture.py'), os.path.join(tmp, png), os.path.join(tmp, 'small.png'),
                        str(tw), str(th), '1' if normal else '0'], check=True)
        args = ['basisu', '-ktx2', '-uastc', '-uastc_level', '3', '-mipmap', '-output_file', 'out.ktx2', 'small.png']
        if normal: args.insert(1, '-normal_map')
        elif transfer(b) != 2: args.insert(1, '-linear')
        subprocess.run(args, cwd=tmp, check=True, capture_output=True)
        subprocess.run(['python3', os.path.join(SHOP, 'rezstd-ktx2.py'), 'out.ktx2'], cwd=tmp, check=True, capture_output=True)
        out = open(os.path.join(tmp, 'out.ktx2'), 'rb').read()
        assert transfer(out) == transfer(b), f'{name}: colour space changed'
        open(dst, 'wb').write(out)
        return f'{name}: {w}x{h} {len(b)/1e6:.1f} MB -> {tw}x{th} {len(out)/1e6:.2f} MB'
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

os.makedirs(OUT, exist_ok=True)
names = sorted(n for n in os.listdir(SRC) if n.endswith('.ktx2'))
with ThreadPoolExecutor(max_workers=WORKERS) as ex:
    for line in ex.map(one, names):
        print(line, flush=True)
