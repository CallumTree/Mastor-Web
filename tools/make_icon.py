import math, cairosvg
from PIL import Image, ImageDraw
CH, CU = '#1A1A2E', '#C97B3F'
def mark(scale=1.0, joint=7.0):
    cx, cy = 256, 250                     # springing line centre
    R, r = 122*scale, 84*scale            # extrados / intrados → a solid stone band
    pier_h = 96*scale
    out = []
    # arch band (semicircle) as one filled shape
    out.append(f'<path d="M{cx-R:.1f} {cy:.1f} A{R:.1f} {R:.1f} 0 0 1 {cx+R:.1f} {cy:.1f} L{cx+r:.1f} {cy:.1f} A{r:.1f} {r:.1f} 0 0 0 {cx-r:.1f} {cy:.1f} Z" fill="{CU}"/>')
    # piers + impost blocks + plinth
    pw = R - r
    for side in (-1, 1):
        x0 = cx + side*r if side > 0 else cx - R
        out.append(f'<rect x="{x0:.1f}" y="{cy:.1f}" width="{pw:.1f}" height="{pier_h:.1f}" fill="{CU}"/>')
        ix = x0 - 7*scale
        out.append(f'<rect x="{ix:.1f}" y="{cy-1:.1f}" width="{pw+14*scale:.1f}" height="{11*scale:.1f}" fill="{CU}"/>')
    out.append(f'<rect x="{cx-R-16*scale:.1f}" y="{cy+pier_h:.1f}" width="{2*R+32*scale:.1f}" height="{12*scale:.1f}" fill="{CU}"/>')
    # voussoir joints (fine charcoal cuts), keystone flanks at ±9°
    for deg in (20, 40, 60, 80, 100, 120, 140, 160):
        if deg in (80, 100): continue
        a = math.radians(deg)
        x1, y1 = cx + (r-3)*math.cos(a), cy - (r-3)*math.sin(a)
        x2, y2 = cx + (R+3)*math.cos(a), cy - (R+3)*math.sin(a)
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{CH}" stroke-width="{joint*scale:.1f}"/>')
    # keystone: a wedge between 81° and 99°, standing proud of the extrados and dropping below the intrados
    k1, k2 = math.radians(80), math.radians(100)
    Ro, ri = R + 16*scale, r - 10*scale
    pts = [(cx + Ro*math.cos(k1), cy - Ro*math.sin(k1)), (cx + Ro*math.cos(k2), cy - Ro*math.sin(k2)),
           (cx + ri*math.cos(k2), cy - ri*math.sin(k2)), (cx + ri*math.cos(k1), cy - ri*math.sin(k1))]
    pd = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    out.append(f'<polygon points="{pd}" fill="{CU}" stroke="{CH}" stroke-width="{joint*scale:.1f}" stroke-linejoin="miter"/>')
    top = cy - Ro; bottom = cy + pier_h + 12*scale
    return ''.join(out), (top + bottom)/2
def svg(size=512, scale=1.0, joint=7.0):
    g, mid = mark(scale, joint)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}"><defs><radialGradient id="l" cx="50%" cy="40%" r="70%">'
            f'<stop offset="0" stop-color="#26264A"/><stop offset="1" stop-color="{CH}"/></radialGradient></defs>'
            f'<rect width="512" height="512" fill="url(#l)"/><g transform="translate(0,{256-mid:.1f})">{g}</g></svg>')
open('icon.svg','w').write(svg()); open('maskable.svg','w').write(svg(scale=0.8)); open('favicon.svg','w').write(svg(scale=1.12, joint=12))
for name, src, sz in [('icon-512.png','maskable.svg',512),('icon-192.png','maskable.svg',192),('apple-touch-icon.png','icon.svg',180),('favicon-32.png','favicon.svg',32),('preview-512.png','icon.svg',512)]:
    cairosvg.svg2png(url=src, write_to=name, output_width=sz, output_height=sz)
sheet = Image.new('RGB', (1180, 520), '#E9E6E1'); d = ImageDraw.Draw(sheet)
def masked(path, size, shape):
    im = Image.open(path).convert('RGBA').resize((size,size), Image.LANCZOS)
    m = Image.new('L', (size,size), 0); md = ImageDraw.Draw(m)
    md.ellipse((0,0,size,size), fill=255) if shape == 'circle' else md.rounded_rectangle((0,0,size,size), radius=int(size*0.225), fill=255)
    im.putalpha(m); return im
for im, xy in [(masked('preview-512.png', 300, 'rr'), (40, 40)), (masked('icon-512.png', 300, 'circle'), (380, 40)), (masked('preview-512.png', 120, 'rr'), (740, 40)), (masked('preview-512.png', 72, 'rr'), (880, 40)), (masked('preview-512.png', 48, 'rr'), (970, 40))]:
    sheet.paste(im, xy, im)
d.rectangle((740, 200, 1140, 240), fill='#FFFFFF'); d.rectangle((740, 260, 1140, 300), fill='#202124')
fav = Image.open('favicon-32.png').convert('RGBA').resize((16,16), Image.LANCZOS)
sheet.paste(fav, (752, 212), fav); sheet.paste(fav, (752, 272), fav)
d.text((776, 214), 'Mastor', fill='#202124'); d.text((776, 274), 'Mastor', fill='#E8EAED')
for i, col in enumerate(['#25D366', '#4285F4', '#EA4335']): d.rounded_rectangle((40 + i*100, 400, 112 + i*100, 472), radius=16, fill=col)
im = masked('preview-512.png', 72, 'rr'); sheet.paste(im, (340, 400), im)
sheet.save('sheet2.png')
