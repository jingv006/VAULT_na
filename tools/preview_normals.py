"""Crease-aware corner normals. Coordinates and triangle winding remain unchanged."""
import numpy as np

def crease_mesh(points,faces,angle=35):
    t=points[faces];cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);length=np.linalg.norm(cross,axis=1);fn=cross/np.maximum(length[:,None],1e-20)
    angles=[]
    for k in range(3):
        a=t[:,(k+1)%3]-t[:,k];b=t[:,(k+2)%3]-t[:,k]
        angles.append(np.arccos(np.clip(np.sum(a*b,axis=1)/np.maximum(np.linalg.norm(a,axis=1)*np.linalg.norm(b,axis=1),1e-20),-1,1)))
    weights=np.column_stack(angles).ravel();flat=faces.ravel()
    # Weld only the normal neighbourhood, not the positions, to bridge STL export rounding.
    _,weld=np.unique(np.round(points/.005).astype(np.int64),axis=0,return_inverse=True)
    ids=weld[flat];order=np.argsort(ids,kind='stable');counts=np.bincount(ids);starts=np.cumsum(counts)-counts;corner=np.zeros((len(flat),3),float);threshold=np.cos(np.deg2rad(angle))
    for degree in np.unique(counts[counts>0]):
        vertices=np.flatnonzero(counts==degree);batch=max(1,1500000//int(degree*degree))
        for start in range(0,len(vertices),batch):
            v=vertices[start:start+batch];which=order[starts[v,None]+np.arange(degree)]
            normals=fn[which//3];dot=np.einsum('bik,bjk->bij',normals,normals)
            weighted=(dot>=threshold)*weights[which][:,None,:]
            summed=np.einsum('bij,bjk->bik',weighted,normals);summed/=np.maximum(np.linalg.norm(summed,axis=2,keepdims=True),1e-20)
            bad=np.linalg.norm(summed,axis=2)<1e-10;summed[bad]=[0,0,1];corner[which]=summed
    # Split a vertex only where its crease normal differs.
    key=np.column_stack([flat,np.round(corner*100000).astype(np.int64)]);unique,inverse=np.unique(key,axis=0,return_inverse=True)
    pos=points[unique[:,0]];normals=unique[:,1:].astype(float)/100000;normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-20)
    return pos,inverse.reshape(-1,3),normals
