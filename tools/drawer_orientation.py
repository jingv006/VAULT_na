"""Restore XL drawer parts from their angled print pose, without scaling."""
import math
import numpy as np

XL_ROLES={'柜体','顶盖','抽屉盒','抽屉盒分件','抽屉背板','网格收纳底板'}
def is_xl_drawer(role,meta):
    path=meta.get('path','')
    return path.startswith('01. DRAWERS/') and path.rsplit('/',1)[-1].startswith('XL') and role in XL_ROLES

def xl_orientation(points,faces,role,path):
    triangles=points[faces]
    normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    area=np.linalg.norm(normals,axis=1)
    unit=normals/(area[:,None]+1e-30)
    keep=(np.abs(unit[:,2])<.001)&(area>1e-8)
    vectors=unit[keep,:2];weights=area[keep]
    keys,inv=np.unique(np.round(vectors,3),axis=0,return_inverse=True)
    totals=np.bincount(inv,weights=weights)
    reference=keys[np.argmax(totals)];reference/=np.linalg.norm(reference)
    dots=vectors@reference
    parallel=np.abs(dots)>.999999
    normal=np.sum(vectors[parallel]*np.sign(dots[parallel,None])*weights[parallel,None],axis=0)
    angle=(math.atan2(normal[0],-normal[1])+math.pi/2)%math.pi-math.pi/2
    c,s=math.cos(angle),math.sin(angle)
    matrix=np.array([[c,s,0],[0,0,1],[s,-c,0]])
    # Front box halves are printed upside down, with the facade at negative Z.
    # Rear halves and back panels use the opposite print pose.
    if role=='抽屉盒' or (role=='抽屉盒分件' and 'Part 1' in path):
        matrix=np.diag([1,-1,-1])@matrix
    return points@matrix.T,matrix
