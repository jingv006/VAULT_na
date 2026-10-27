"""Regression for planar shading at hard edges and immutable vertex positions."""
import numpy as np
from preview_normals import crease_mesh
points=np.array([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],float)
faces=np.array([[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]])
v,index,normals=crease_mesh(points,faces)
assert len(v)==24
assert np.allclose(np.max(np.abs(normals),axis=1),1)
assert np.array_equal(v[index],points[faces])
assert {tuple(p) for p in v}=={tuple(p) for p in points}
print('Hard edges retain planar normals; vertex coordinates and triangle winding unchanged')
