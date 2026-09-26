"""
Turn a set of line drawings (SVG path strings) into ONE continuous stroke.
 1. parse paths into straight segments (curves approximated)
 2. split segments wherever they touch/cross, so the drawing becomes a connected graph
 3. join any separate islands with the shortest connector line
 4. 'Chinese postman': duplicate the fewest edges so every point has an even number of
    lines -> an Euler circuit exists (one stroke, pen never lifts, retraces hidden)
 5. walk it, then stop just short of the start so start and end nearly meet but don't
"""
import re, math, heapq, itertools, json, sys

def bez(p0,p1,p2,p3,n=8):
    out=[]
    for i in range(1,n+1):
        t=i/n; mt=1-t
        out.append((mt**3*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t**3*p3[0],
                    mt**3*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t**3*p3[1]))
    return out

def parse(d):
    toks=re.findall(r'[MLHVZCAmlhvzca]|-?\d*\.?\d+',d)
    segs=[];i=0;cur=(0.0,0.0);start=None;cmd=None
    def num():
        nonlocal i; v=float(toks[i]); i+=1; return v
    while i<len(toks):
        t=toks[i]
        if t.isalpha(): cmd=t; i+=1
        if cmd in ('Z','z'):
            if start and cur!=start: segs.append((cur,start))
            cur=start; cmd=None; continue
        if cmd in ('M','m'):
            x,y=num(),num(); cur=(x,y) if cmd=='M' else (cur[0]+x,cur[1]+y); start=cur
            cmd='L' if cmd=='M' else 'l'
        elif cmd in ('L','l'):
            x,y=num(),num(); p=(x,y) if cmd=='L' else (cur[0]+x,cur[1]+y); segs.append((cur,p)); cur=p
        elif cmd in ('H','h'):
            x=num(); p=(x,cur[1]) if cmd=='H' else (cur[0]+x,cur[1]); segs.append((cur,p)); cur=p
        elif cmd in ('V','v'):
            y=num(); p=(cur[0],y) if cmd=='V' else (cur[0],cur[1]+y); segs.append((cur,p)); cur=p
        elif cmd in ('C','c'):
            vals=[num() for _ in range(6)]
            if cmd=='c': vals=[vals[k]+(cur[0] if k%2==0 else cur[1]) for k in range(6)]
            c1,c2,p=(vals[0],vals[1]),(vals[2],vals[3]),(vals[4],vals[5])
            prev=cur
            for q in bez(cur,c1,c2,p): segs.append((prev,q)); prev=q
            cur=p
        elif cmd in ('A','a'):
            rx,ry,rot,large,sweep,x,y=[num() for _ in range(7)]
            p=(x,y) if cmd=='A' else (cur[0]+x,cur[1]+y)
            # quarter-ish arc approximated through a bulged midpoint
            mx,my=(cur[0]+p[0])/2,(cur[1]+p[1])/2
            dx,dy=p[0]-cur[0],p[1]-cur[1]; L=math.hypot(dx,dy) or 1
            bulge=(1 if sweep else -1)*L*0.2
            mid=(mx-dy/L*bulge,my+dx/L*bulge)
            segs.append((cur,mid)); segs.append((mid,p)); cur=p
    return segs

def inter(a,b,c,d):
    x1,y1=a;x2,y2=b;x3,y3=c;x4,y4=d
    den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
    if abs(den)<1e-9: return None
    t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den
    u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den
    if -1e-6<=t<=1+1e-6 and -1e-6<=u<=1+1e-6: return (t,(x1+t*(x2-x1),y1+t*(y2-y1)))
    return None

def proj(p,a,b):
    ax,ay=a;bx,by=b;px,py=p
    L=(bx-ax)**2+(by-ay)**2
    if L==0: return None
    t=((px-ax)*(bx-ax)+(py-ay)*(by-ay))/L
    q=(ax+t*(bx-ax),ay+t*(by-ay))
    return t, math.dist(p,q)

def build(paths, tol=1.6):
    segs=[s for d in paths for s in parse(d) if math.dist(*s)>0.05]
    cuts=[[0.0,1.0] for _ in segs]
    for i,j in itertools.combinations(range(len(segs)),2):
        a,b=segs[i];c,d=segs[j]
        r=inter(a,b,c,d)
        if r:
            cuts[i].append(r[0])
            r2=inter(c,d,a,b); cuts[j].append(r2[0])
        # T-junctions / near-misses: endpoints close to the other segment
        for (P,k,(A,B)) in ((c,j,(a,b)),(d,j,(a,b))):
            pr=proj(P,A,B)
            if pr and -0.02<=pr[0]<=1.02 and pr[1]<tol: cuts[i].append(min(1,max(0,pr[0])))
        for (P,k,(A,B)) in ((a,i,(c,d)),(b,i,(c,d))):
            pr=proj(P,A,B)
            if pr and -0.02<=pr[0]<=1.02 and pr[1]<tol: cuts[j].append(min(1,max(0,pr[0])))
    nodes=[]
    def node(p):
        for k,q in enumerate(nodes):
            if math.dist(p,q)<tol*0.9: return k
        nodes.append(p); return len(nodes)-1
    edges=set()
    for (a,b),ts in zip(segs,cuts):
        ts=sorted(set(round(t,4) for t in ts))
        pts=[(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])) for t in ts]
        ids=[node(p) for p in pts]
        for u,v in zip(ids,ids[1:]):
            if u!=v: edges.add((min(u,v),max(u,v)))
    return nodes, list(edges)

def components(n,edges):
    par=list(range(n))
    def f(x):
        while par[x]!=x: par[x]=par[par[x]]; x=par[x]
        return x
    for u,v in edges: par[f(u)]=f(v)
    comps={}
    for k in range(n): comps.setdefault(f(k),[]).append(k)
    return [c for c in comps.values()]

def connect(nodes,edges):
    used=set(u for e in edges for u in e)
    while True:
        comps=[c for c in components(len(nodes),edges) if any(k in used for k in c)]
        if len(comps)<=1: return edges
        main=max(comps,key=len); best=None
        for c in comps:
            if c is main: continue
            for a in c:
                for b in main:
                    dd=math.dist(nodes[a],nodes[b])
                    if best is None or dd<best[0]: best=(dd,a,b)
        edges.append((min(best[1],best[2]),max(best[1],best[2])))

def eulerize(nodes,edges):
    adj={}
    for u,v in edges:
        w=math.dist(nodes[u],nodes[v]); adj.setdefault(u,[]).append((v,w)); adj.setdefault(v,[]).append((u,w))
    deg={k:len(v) for k,v in adj.items()}
    odd=[k for k,d in deg.items() if d%2]
    def dij(s):
        dist={s:0};prev={};pq=[(0,s)]
        while pq:
            d,u=heapq.heappop(pq)
            if d>dist[u]: continue
            for v,w in adj[u]:
                if d+w<dist.get(v,1e18): dist[v]=d+w; prev[v]=u; heapq.heappush(pq,(d+w,v))
        return dist,prev
    info={o:dij(o) for o in odd}
    # greedy min-weight pairing of odd nodes
    pairs=sorted(((info[a][0][b],a,b) for a,b in itertools.combinations(odd,2)))
    matched=set(); extra=[]
    for w,a,b in pairs:
        if a in matched or b in matched: continue
        matched|={a,b}
        prev=info[a][1]; v=b
        while v!=a: u=prev[v]; extra.append((min(u,v),max(u,v))); v=u
    return edges+extra

def euler_path(nodes,edges,start):
    adj={}
    for idx,(u,v) in enumerate(edges):
        adj.setdefault(u,[]).append((v,idx)); adj.setdefault(v,[]).append((u,idx))
    used=[False]*len(edges); stack=[start]; path=[]
    while stack:
        u=stack[-1]
        while adj[u] and used[adj[u][-1][1]]: adj[u].pop()
        if adj[u]:
            v,idx=adj[u].pop(); used[idx]=True; stack.append(v)
        else: path.append(stack.pop())
    return path[::-1]

def one_line(paths, gap=0.15):
    nodes,edges=build(paths)
    edges=connect(nodes,edges)
    base=len(edges)
    edges=eulerize(nodes,edges)
    start=min(range(len(nodes)),key=lambda k:(nodes[k][1]*-1,nodes[k][0]))  # bottom-left-ish
    start=min(range(len(nodes)),key=lambda k:math.dist(nodes[k],(0,200)))
    walk=euler_path(nodes,edges,start)
    pts=[nodes[k] for k in walk]
    # stop short of the start: trim the final leg so the ends come close but never meet
    a,b=pts[-2],pts[-1]
    pts[-1]=(a[0]+(b[0]-a[0])*(1-gap),a[1]+(b[1]-a[1])*(1-gap))
    d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pts)
    total=sum(math.dist(p,q) for p,q in zip(pts,pts[1:]))
    return d, len(edges)-base, base, total

if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]!='generate':
    paths=json.load(open(sys.argv[1]))
    d,dups,base,total=one_line(paths)
    print(json.dumps({'d':d,'dups':dups,'edges':base,'length':round(total)}))


def generate(source_path='tools/drawings.source.json', out_path='src/components/drawings.generated.ts'):
    """Source drawings (multi-path, 'g:' = faint guide) -> one continuous stroke per drawing."""
    src = json.load(open(source_path))
    sets = {}
    for key, variants in src.items():
        sets[key] = []
        for paths in variants:
            guides = [p[2:] for p in paths if p.startswith('g:')]
            main = [p for p in paths if not p.startswith('g:')]
            d, _, _, total = one_line(main)
            sets[key].append({'d': d, 'guides': guides, 'length': round(total)})
    ts = ('// GENERATED by tools/oneline.py from tools/drawings.source.json — do not hand edit.\n'
          '// Each drawing is ONE continuous stroke: the pen never lifts, retraced stretches overlap\n'
          '// existing lines so they are invisible, and it stops just short of where it started.\n'
          'export interface OneLineDrawing { d: string; guides: string[]; length: number }\n'
          'export const DRAWINGS: Record<string, OneLineDrawing[]> = ' + json.dumps(sets) + '\n')
    open(out_path, 'w').write(ts)
    print('generated', {k: len(v) for k, v in sets.items()})

if __name__=='__main__' and (len(sys.argv)==1 or sys.argv[1]=='generate'):
    generate()
