import json
def L(pts): return 'M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pts)
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

# ---------------- COMMERCIAL: office tower in 2-point perspective + tower crane ----------------
def tower():
    P=[]; G=[]
    C_top,C_bot=(196,16),(196,172)          # front corner
    Lt,Lb=(140,28),(140,168)               # left face far edge
    Rt,Rb=(262,30),(262,166)               # right face far edge
    P += [L([Lb,Lt,C_top,Rt,Rb]), L([C_top,C_bot])]
    floors=24
    for i in range(1,floors):
        t=i/floors
        c=lerp(C_top,C_bot,t); l=lerp(Lt,Lb,t); r=lerp(Rt,Rb,t)
        P.append(L([l,c,r]))
    for k in range(1,5):                    # left face mullions
        s=k/5; top=lerp(C_top,Lt,s); bot=lerp(C_bot,Lb,s); P.append(L([top,bot]))
    for k in range(1,6):                    # right face mullions
        s=k/6; top=lerp(C_top,Rt,s); bot=lerp(C_bot,Rb,s); P.append(L([top,bot]))
    # crown: setback plant floor + mast
    P.append(L([(150,27),(152,20),(196,10),(250,22),(252,29)]))
    P.append(L([(196,10),(196,16)]))
    P.append(L([(200,10),(200,-2)]))
    P.append(L([(198,3),(202,3)]))
    # podium + entrance canopy
    P.append(L([(120,176),(120,160),(140,158)])); P.append(L([(262,158),(290,160),(290,174)]))
    P.append(L([(120,176),(196,180),(290,174)]))
    P.append(L([(168,176),(170,163),(196,160),(226,163),(226,176)]))
    P.append(L([(178,177),(178,168),(190,168),(190,178)]))
    # neighbouring low-rise blocks
    P.append(L([(40,178),(40,128),(96,124),(118,126),(118,176)])); P.append(L([(96,124),(96,178)]))
    for y in (140,152,164): P.append(L([(44,y+2),(94,y-1)]))
    P.append(L([(300,172),(300,120),(352,116),(372,118),(372,170)])); P.append(L([(352,116),(352,170)]))
    for y in (132,146,160): P.append(L([(304,y),(350,y-3)]))
    # tower crane
    mx=280; top=18; base=172; w=5
    P.append(L([(mx,base),(mx,top)])); P.append(L([(mx+w,base),(mx+w,top)]))
    y=base; flip=False
    while y-12>top:
        P.append(L([(mx,y),(mx+w,y-12)]) if not flip else L([(mx+w,y),(mx,y-12)])); P.append(L([(mx,y-12),(mx+w,y-12)]))
        y-=12; flip=not flip
    P.append(L([(mx-2,top),(mx+w+2,top),(mx+w/2,top-10),(mx-2,top)]))   # slewing apex
    P.append(L([(mx-2,top),(214,top+2)]))                                  # jib
    P.append(L([(mx-2,top+5),(214,top+6)]))
    for x in range(222,276,12): P.append(L([(x,top+1.8),(x+6,top+5.8)]))
    P.append(L([(mx+w/2,top-10),(236,top+2)]))                           # tie
    P.append(L([(mx+w+2,top),(360,top+1),(360,top+6),(mx+w,top+5)]))     # counter-jib
    P.append(L([(348,top+6),(348,top+14),(358,top+14),(358,top+6)]))     # counterweight
    P.append(L([(271,top+5.5),(271,112)])); P.append(L([(265,112),(277,112),(277,120),(265,120),(265,112)]))  # hook + load, clear of the tower
    P.append(L([(272,base),(294,base)]))
    # guides: horizon + vanishing lines
    G += [L([(0,96),(400,96)]), L([(196,172),(20,150)]), L([(196,16),(40,70)]), L([(196,172),(390,148)]), L([(196,16),(380,76)]),
          L([(0,180),(400,180)]), L([(140,0),(140,190)]), L([(262,0),(262,190)])]
    return P,G

# ---------------- INTERNAL: one-point perspective room ----------------
def room():
    P=[]; G=[]
    VP=(200,92)
    BL,BR,TL,TR=(128,140),(272,140),(128,46),(272,46)     # back wall
    FL,FR,FTL,FTR=(4,196),(396,196),(4,-4),(396,-4)
    P += [L([TL,TR,BR,BL,TL])]
    P += [L([BL,FL]), L([BR,FR]), L([TL,FTL]), L([TR,FTR])]
    # floorboards converging to VP
    for k in range(1,12):
        x=4+k*(392/12); t=(140-92)/(196-92)
        bx=VP[0]+(x-VP[0])*t
        P.append(L([(bx,140),(x,196)]))
    for y in (156,176): P.append(L([(128-(y-140)*124/56,y),(272+(y-140)*124/56,y)]))
    # skirting on back + side walls
    P.append(L([(128,134),(272,134)])); P.append(L([(128,134),(40,176)])); P.append(L([(272,134),(360,176)]))
    # window on back wall with mullions & sill
    P.append(L([(128,60),(272,60)]))  # curtain rail wall to wall
    P.append(L([(168,60),(232,60),(232,110),(168,110),(168,60)])); P.append(L([(200,60),(200,110)])); P.append(L([(168,84),(232,84)]))
    P.append(L([(164,110),(236,110),(236,114),(164,114),(164,110)])); P.append(L([(200,114),(200,134)]))
    # door on left wall (perspective)
    P.append(L([(52,172),(52,52),(98,74),(98,150)])); P.append(L([(58,166),(58,62),(92,77),(92,147)]))
    P.append(L([(88,112),(91,113)]))
    # kitchen run on right wall (base + wall units)
    P.append(L([(300,120),(300,164),(356,178)])); P.append(L([(272,120),(356,138),(356,178)])); P.append(L([(300,120),(356,138)]))
    for x,y1,y2 in ((314,125,168),(328,129,171),(342,133,175)): P.append(L([(x,y1),(x,y2)]))
    P.append(L([(272,60),(272,90),(334,104),(334,72),(272,60)])); P.append(L([(303,66),(303,97)]))
    # pendant light
    P.append(L([(63.5,20),(336.5,20)]))  # ceiling bulkhead
    P.append(L([(200,20),(200,26)])); P.append(L([(190,34),(193,26),(207,26),(210,34),(190,34)]))
    # stepladder (it's a works drawing)
    P.append(L([(236,176),(248,120),(260,176)])); P.append(L([(248,120),(268,176)]))
    for y in (136,150,164): P.append(L([(248-(y-120)*12/56,y),(248+(y-120)*12/56,y)]))
    G += [L([VP,(4,196)]), L([VP,(396,196)]), L([VP,(4,-4)]), L([VP,(396,-4)]), L([(0,92),(400,92)])]
    return P,G

src=json.load(open('/tmp/mastor-web/tools/drawings.source.json'))
tp,tg=tower(); rp,rg=room()
src['Commercial']=[['g:'+g for g in tg]+tp]+src['Commercial'][1:]
src['Internal']=[['g:'+g for g in rg]+rp]+src['Internal'][1:]
json.dump(src,open('/tmp/mastor-web/tools/drawings.source.json','w'),indent=1)
print('ok', len(tp), len(rp))
