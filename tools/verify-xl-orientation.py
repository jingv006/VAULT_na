"""Check rigid XL preview rotations against original STL geometry."""
import json,struct,sys
from pathlib import Path
import numpy as np
BASE=Path(__file__).resolve().parents[1];sys.path.insert(0,str(BASE));sys.path.insert(0,str(BASE/'tools'))
import kit_service as kits
from drawer_orientation import is_xl_drawer,xl_orientation
rows={}
for m in kits.CAT['modules']:
 if m['kind']!='drawer' or m['family']!='XL':continue
 for row in m['parts']+[p for entries in m['roofs'].values() for p in entries]+m['gridParts']:
  if is_xl_drawer(row['role'],row):rows[row['path']]=row
for row in rows.values():
 path=kits.LIB/row['path'];before=path.stat();raw=path.read_bytes();n=struct.unpack_from('<I',raw,80)[0]
 triangles=np.ndarray((n,),dtype=np.dtype([('normal','<f4',3),('v','<f4',(3,3)),('attr','<u2')]),buffer=raw,offset=84)['v']
 points,index=np.unique(triangles.reshape(-1,3),axis=0,return_inverse=True);points=points.astype(float);points-=(points.min(0)+points.max(0))/2
 transformed,matrix=xl_orientation(points,index.reshape(-1,3),row['role'],row['path']);size=np.ptp(transformed,axis=0)
 assert np.allclose(matrix@matrix.T,np.eye(3),atol=1e-12) and abs(np.linalg.det(matrix)-1)<1e-12
 assert abs(np.linalg.norm(transformed[-1]-transformed[0])-np.linalg.norm(points[-1]-points[0]))<1e-8
 limit=58 if row['role']=='柜体' else 40 if row['role'] in ['抽屉盒','抽屉盒分件','抽屉背板'] else 35
 assert size[2]<limit,(row['path'],size)
 if row['role']=='柜体':assert 418<size[0]<420 and abs(size[2]-57)<.1,(row['path'],size)
 assert path.stat().st_size==before.st_size and path.stat().st_mtime_ns==before.st_mtime_ns
print('%d original XL parts/roof styles: horizontal assembly envelope, rigid rotations, no scaling or source changes passed'%len(rows))
