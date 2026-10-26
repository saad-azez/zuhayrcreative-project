#!/usr/bin/env python3
# Usage: python3 -I tools/dedupe-glb-images.py <in.glb> <out.glb>
# Lossless: images whose bytes are identical are stored once, every texture
# that used a copy points at the one kept, and the binary chunk is repacked
# without the copies. Proven before writing: every texture resolves to the same
# image bytes as before, and every other buffer view (plain, and the meshopt
# streams in buffer 0) holds the same bytes as before.
import hashlib, json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
assert b[:4] == b'glTF'
jl = struct.unpack_from('<I', b, 12)[0]
j = json.loads(b[20:20 + jl])
binlen = struct.unpack_from('<I', b, 20 + jl)[0]
BIN = b[20 + jl + 8:20 + jl + 8 + binlen]
views = j['bufferViews']

def regions(view):
    """(buffer-0 offset, length) ranges this view occupies in the binary chunk."""
    out = []
    if view.get('buffer', 0) == 0 and 'extensions' not in view:
        out.append((view.get('byteOffset', 0), view['byteLength']))
    m = view.get('extensions', {}).get('EXT_meshopt_compression')
    if m and m.get('buffer', 0) == 0:
        out.append((m.get('byteOffset', 0), m['byteLength']))
    return out

def image_bytes(jj, BB, i):
    v = jj['bufferViews'][jj['images'][i]['bufferView']]
    o = v.get('byteOffset', 0)
    return BB[o:o + v['byteLength']]

def tex_source(t):
    return t['extensions']['KHR_texture_basisu']['source'] if 'KHR_texture_basisu' in t.get('extensions', {}) else t['source']

# Which image each image collapses to.
first = {}
keep_of = {}
for i in range(len(j['images'])):
    h = hashlib.sha256(image_bytes(j, BIN, i)).hexdigest()
    keep_of[i] = first.setdefault(h, i)
drop_imgs = sorted(i for i, k in keep_of.items() if k != i)
if not drop_imgs:
    sys.exit('nothing to dedupe')
drop_views = {j['images'][i]['bufferView'] for i in drop_imgs}
# A dropped image's view must belong to that image alone.
for vi in drop_views:
    assert sum(1 for im in j['images'] if im.get('bufferView') == vi) == 1
    assert all(a.get('bufferView') != vi for a in j.get('accessors', []))

old = json.loads(json.dumps(j))
old_tex_bytes = [image_bytes(old, BIN, tex_source(t)) for t in old['textures']]
old_view_bytes = {vi: [BIN[o:o + n] for o, n in regions(v)] for vi, v in enumerate(views) if vi not in drop_views}

# Repack buffer 0: every remaining region, in its original order, 4-byte aligned.
spans = sorted({r for vi, v in enumerate(views) if vi not in drop_views for r in regions(v)})
newpos, out, pos = {}, bytearray(), 0
for o, n in spans:
    if (o, n) in newpos:
        continue
    newpos[(o, n)] = pos
    out += BIN[o:o + n]
    pos += n
    pad = (-pos) % 4
    out += b'\0' * pad
    pos += pad

# Views: renumber without the dropped ones and move their offsets.
remap, new_views = {}, []
for vi, v in enumerate(views):
    if vi in drop_views:
        continue
    v = json.loads(json.dumps(v))
    if v.get('buffer', 0) == 0 and 'extensions' not in v:
        v['byteOffset'] = newpos[(views[vi].get('byteOffset', 0), v['byteLength'])]
    m = v.get('extensions', {}).get('EXT_meshopt_compression')
    if m and m.get('buffer', 0) == 0:
        m['byteOffset'] = newpos[(views[vi]['extensions']['EXT_meshopt_compression'].get('byteOffset', 0), m['byteLength'])]
    remap[vi] = len(new_views)
    new_views.append(v)
j['bufferViews'] = new_views
for a in j.get('accessors', []):
    if 'bufferView' in a:
        a['bufferView'] = remap[a['bufferView']]
    sp = a.get('sparse')
    if sp:
        sp['indices']['bufferView'] = remap[sp['indices']['bufferView']]
        sp['values']['bufferView'] = remap[sp['values']['bufferView']]

# Images: renumber without the dropped ones; textures point at the kept image.
img_remap, new_imgs = {}, []
for i, im in enumerate(j['images']):
    if i in drop_imgs:
        continue
    im = dict(im)
    im['bufferView'] = remap[im['bufferView']]
    img_remap[i] = len(new_imgs)
    new_imgs.append(im)
j['images'] = new_imgs
for t in j['textures']:
    if 'KHR_texture_basisu' in t.get('extensions', {}):
        t['extensions']['KHR_texture_basisu']['source'] = img_remap[keep_of[t['extensions']['KHR_texture_basisu']['source']]]
    if 'source' in t:
        t['source'] = img_remap[keep_of[t['source']]]
j['buffers'][0]['byteLength'] = len(out)
NB = bytes(out)

# Proof.
for ti, t in enumerate(j['textures']):
    assert image_bytes(j, NB, tex_source(t)) == old_tex_bytes[ti], f'texture {ti} changed'
for vi, chunks in old_view_bytes.items():
    assert [NB[o:o + n] for o, n in regions(j['bufferViews'][remap[vi]])] == chunks, f'view {vi} changed'
for k in old:
    if k not in ('bufferViews', 'images', 'textures', 'buffers', 'accessors'):
        assert old[k] == j[k], k

js = json.dumps(j, separators=(',', ':')).encode()
js += b' ' * ((-len(js)) % 4)
glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(NB)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(NB)) + b'BIN\0' + NB
open(dst, 'wb').write(glb)
print(f'{len(drop_imgs)} duplicate images removed: {len(b)} -> {len(glb)} bytes ({100 * (len(b) - len(glb)) / len(b):.1f}%)')
