"""Display assembly measurements for the original sustainer meshes."""
import numpy as np
from preview_landmarks import planes,circular_holes

def component_orientation(vertices,role,source_center):
    if role=='下铰链套件':
        # Each print file contains a mirrored pair: barrels must both face up/back.
        matrix=np.array([[0,0,-1],[0,1,0],[1,0,0]]) if source_center[1]<0 else np.array([[0,0,1],[0,-1,0],[1,0,0]])
    elif role=='上铰链套件' and source_center[0]<-.1:
        matrix=np.array([[0,0,-1],[0,1,0],[1,0,0]])
    elif role in ['上铰链套件','锁扣座','锁扣内件','锁扣外件']:
        matrix=np.array([[0,0,1],[0,1,0],[-1,0,0]])
    else:return vertices,np.eye(3)
    return vertices@matrix.T,matrix

def measured(points,faces,role,center):
    result={'planes':planes(points,faces,center)}
    size=np.ptp(points,axis=0)
    if role in ['铰链轴套件','锁扣插销套件']:
        q=points[abs(points[:,0]-center[0])<1]
        if len(q):result['shaftAxis']=((q.min(axis=0)+q.max(axis=0))/2-center).tolist()
    if role=='箱体':
        result['hingeHoles']=circular_holes(points,faces,center,5.5,1.5,3)
        # The divider notches interrupt the inner left wall at half height.
        t=points[faces];cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(cross,axis=1)
        inside=points[:,0].min()+5
        mask=(cross[:,0]>area*.9999)&(abs(t[:,:,0].mean(axis=1)-inside)<.03)&(t[:,:,2].min(axis=1)<center[2])&(t[:,:,2].max(axis=1)>center[2])
        t=t[mask];q=np.roll(t,-1,axis=1);crossing=(t[:,:,2]-center[2])*(q[:,:,2]-center[2])<0
        hits=(t+(q-t)*((center[2]-t[:,:,2])/(q[:,:,2]-t[:,:,2]+1e-20))[:,:,None])[crossing]
        intervals=sorted((float(a[1]),float(b[1])) if a[1]<b[1] else (float(b[1]),float(a[1])) for a,b in hits.reshape(-1,2,3))
        merged=[]
        for lo,hi in intervals:
            if merged and lo<merged[-1][1]+.05:merged[-1][1]=max(hi,merged[-1][1])
            else:merged.append([lo,hi])
        result['dividerRows']=[(a[1]+b[0])/2-center[1] for a,b in zip(merged,merged[1:]) if 1.5<b[0]-a[1]<5]
    if role=='前面板':
        result['mountHoles']=circular_holes(points,faces,center,1,1.5,3)
        t=points[faces];cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(cross,axis=1)
        front=points[:,1].max();mask=(cross[:,1]>area*.9999)&(abs(t[:,:,1].mean(axis=1)-(front-2.13))<.03)&(area>.01)
        if mask.any():
            q=t[mask].reshape(-1,3)-center
            result['labelPocket']={'bedY':float(front-2.13-center[1]),'minX':float(q[:,0].min()),'maxX':float(q[:,0].max()),'minZ':float(q[:,2].min()),'maxZ':float(q[:,2].max())}
    if role=='下铰链套件':
        # Section through the flat mounting leaf, ahead of the barrel.
        result['mountHoles']=circular_holes(points,faces,center,size[1]-2,1.5,3)
    if role in ['锁扣座','锁扣内件','锁扣外件']:
        # The lock pivots and its pins are parallel to the box width (X).
        perm=[1,0,2];p=points[:,perm];cc=center[perm]
        result['pivotBores']=circular_holes(p,faces,cc,2,1.5,8,20)
        if role=='锁扣座':result['mountHoles']=circular_holes(points,faces,center,2,1.5,3)
    return result
