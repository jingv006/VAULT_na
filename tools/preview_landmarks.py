"""Measure assembly datums from source surfaces, before display simplification."""
import numpy as np

def planes(points,faces,center):
    t=points[faces];cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(cross,axis=1);mid=t.mean(axis=1)-center;result={}
    for axis,key in enumerate('xyz'):
        mask=(np.abs(cross[:,axis])>area*.99999)&(area>1e-8)
        levels=np.column_stack([np.round(mid[mask,axis],2),np.sign(cross[mask,axis])])
        u,inv=np.unique(levels,axis=0,return_inverse=True);weights=np.bincount(inv,weights=area[mask]/2)
        result[key]=[{'at':float(u[i,0]),'normal':int(u[i,1]),'area':round(float(weights[i]),2)} for i in np.argsort(weights)[-16:][::-1]]
    return result

def circular_holes(points,faces,center,offset=6,radius_min=4.8,radius_max=5.5,max_diameter=12):
    t=points[faces];plane=points[:,1].min()+offset
    mask=(t[:,:,1].min(axis=1)<plane)&(t[:,:,1].max(axis=1)>plane);t=t[mask];q=np.roll(t,-1,axis=1)
    mask=(t[:,:,1]-plane)*(q[:,:,1]-plane)<0
    hits=(t+(q-t)*((plane-t[:,:,1])/(q[:,:,1]-t[:,:,1]+1e-20))[:,:,None])[mask][:,[0,2]].reshape(-1,2,2)
    if not len(hits):return []
    u,inv=np.unique(np.round(hits.reshape(-1,2)/.005).astype(np.int64),axis=0,return_inverse=True);edges=inv.reshape(-1,2);parent=list(range(len(u)))
    def find(a):
        while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
        return a
    for a,b in edges:parent[find(int(a))]=find(int(b))
    groups={}
    for i in range(len(u)):groups.setdefault(find(i),[]).append(i)
    holes=[]
    for group in groups.values():
        if len(group)<24:continue
        p=u[group]*.005
        if np.max(np.ptp(p,axis=0))>max_diameter:continue
        fit=np.linalg.lstsq(np.column_stack([2*p,np.ones(len(p))]),np.sum(p*p,axis=1),rcond=None)[0];c=fit[:2];r=np.sqrt(max(0,fit[2]+sum(c*c)));error=np.std(np.linalg.norm(p-c,axis=1))
        if radius_min<r<radius_max and error<.035:holes.append({'x':round(float(c[0]-center[0]),4),'z':round(float(c[1]-center[2]),4),'radius':round(float(r),4)})
    return sorted(holes,key=lambda p:(round(p['z'],1),p['x']))


def runner_ports(points,faces,center):
    t=points[faces];plane=points[:,0].max()-.3
    mask=(t[:,:,0].min(axis=1)<plane)&(t[:,:,0].max(axis=1)>plane);t=t[mask];q=np.roll(t,-1,axis=1)
    mask=(t[:,:,0]-plane)*(q[:,:,0]-plane)<0
    hit=(t+(q-t)*((plane-t[:,:,0])/(q[:,:,0]-t[:,:,0]+1e-20))[:,:,None])[mask][:,[1,2]].reshape(-1,2,2)
    if not len(hit):return []
    u,inv=np.unique(np.round(hit.reshape(-1,2)/.01).astype(int),axis=0,return_inverse=True);parent=list(range(len(u)))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in inv.reshape(-1,2):parent[find(int(a))]=find(int(b))
    groups={}
    for i in range(len(u)):groups.setdefault(find(i),[]).append(i)
    result=[]
    for group in groups.values():
        p=u[group]*.01;lo,hi=p.min(axis=0),p.max(axis=0);size=hi-lo
        if len(p)>10 and 15<size[0]<21 and 6<size[1]<10:
            c=(lo+hi)/2-center[[1,2]];result.append({'y':float(c[0]),'z':float(c[1]),'size':size.tolist()})
    return sorted(result,key=lambda p:p['z'])


def label_pocket(points,faces,center,label_hole,front):
    t=points[faces];normal=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(normal,axis=1);mid=t.mean(axis=1)-center
    mask=(normal[:,1]>area*.99999)&(area>1e-8)&(mid[:,0]>label_hole['x']-28)&(np.abs(mid[:,2]-label_hole['z'])<13)&(mid[:,1]<front-.1)
    levels=np.round(mid[mask,1],2)
    if not len(levels):return None
    u,inv=np.unique(levels,return_inverse=True);weights=np.bincount(inv,weights=area[mask]);pick=int(np.argmax(weights));selected=t[np.flatnonzero(mask)[inv==pick]].reshape(-1,3)-center
    lo,hi=selected.min(axis=0),selected.max(axis=0)
    return {'bedY':float(u[pick]),'minX':float(lo[0]),'maxX':float(hi[0]),'minZ':float(lo[2]),'maxZ':float(hi[2])}
