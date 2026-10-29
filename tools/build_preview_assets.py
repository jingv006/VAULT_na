# -*- coding: utf-8 -*-
"""Create local display-only meshes using NumPy and quadric simplification."""
import json, math, sys, struct
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools/vendor"))
import numpy as np
from preview_landmarks import planes,circular_holes,runner_ports,label_pocket
from preview_normals import crease_mesh
from sustainer_landmarks import component_orientation,measured
from drawer_orientation import is_xl_drawer,xl_orientation

def orient(points,role,meta):
    if is_xl_drawer(role,meta):return xl_orientation(points,meta['_faces'],role,meta['path'])
    # Printed cabinets/facades/lids use XY as width/height and Z as depth.
    if role in ['柜体','箱体','面板','前面板','顶盖','翻盖','翻盖分件']:
        width=meta.get('width',float(np.ptp(points,axis=0)[0]))
        angles=[0,math.pi/4,-math.pi/4,math.pi/2,3*math.pi/4]
        measured_box=role=='箱体' and meta.get('path','').startswith('02. SUSTAINERS/')
        if role in ['翻盖','翻盖分件'] or measured_box:
            # These covers are printed at an arbitrary angle, not exactly 45°.
            t=points[meta['_faces']];n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);area=np.linalg.norm(n,axis=1)
            unit=n/(area[:,None]+1e-30);mask=(abs(unit[:,2])<.001)&(area>1e-8)
            keys,inv=np.unique(np.round(unit[mask],2),axis=0,return_inverse=True)
            weights=np.bincount(inv,weights=area[mask])
            measured_angles=[]
            for key in np.argsort(weights)[-8:]:
                if weights[key]<weights.max()*.2:continue
                candidates=n[mask][inv==key]
                normal=candidates[np.argmax(np.linalg.norm(candidates,axis=1))]
                measured_angles.append(math.atan2(normal[0],-normal[1]))
            angles=measured_angles
        # Exact plane normals supply non-45-degree print rotations too.
        covariance=np.cov(points.T);_,axes=np.linalg.eigh(covariance)
        if not measured_box and role not in ['翻盖','翻盖分件']:angles += [math.atan2(axes[1,i],axes[0,i]) for i in range(3) if abs(axes[2,i])<.2]
        best=None
        if role in ['翻盖','翻盖分件'] or measured_box:
            angles=[(a+math.pi/2)%math.pi-math.pi/2 for a in angles]
        for angle in angles:
            c,s=math.cos(angle),math.sin(angle)
            matrix=np.array([[c,s,0],[0,0,1],[s,-c,0]])
            transformed=points@matrix.T;dims=np.ptp(transformed,axis=0)
            score=abs(dims[0]-width)/max(width,1)
            # Covers/roofs must become horizontal without changing their shape.
            if role in ['顶盖','翻盖','翻盖分件']:score+=max(0,dims[2]-35)/100
            if best is None or score<best[0]:best=(score,transformed,matrix)
        return best[1],best[2]
    if role in ['旋钮锁芯','旋钮帽','面板端盖','标签','箱体标签','锁扣标签','弹簧套件','密封隔板','密封侧隔板','密封中隔板']:
        matrix=np.array([[1,0,0],[0,0,1],[0,-1,0]])
    elif role in ['导轨','滑轨','限位件']:
        matrix=np.array([[0,0,1],[0,1,0],[-1,0,0]])
    elif role=='加强齿条套件':matrix=np.array([[1,0,0],[0,0,1],[0,-1,0]])
    elif role.startswith('网格收纳底板'):
        dims=np.ptp(points,axis=0)
        target=meta.get('width',dims[0])-(10 if meta.get('path','').startswith('02. SUSTAINERS/') else 30)
        matrix=np.array([[0,-1,0],[1,0,0],[0,0,1]]) if abs(dims[1]-target)<abs(dims[0]-target) else np.eye(3)
    else:matrix=np.eye(3)
    return points@matrix.T,matrix

def split_components(points,faces,role):
    sets=['弹簧套件','堆叠锁扣','加强齿条套件','上铰链套件','下铰链套件','铰链轴套件','锁扣插销套件']
    if role not in sets:return [np.arange(len(faces))]
    parent=list(range(len(points)))
    def find(x):
        while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
        return x
    for a,b,c in faces:
        root=find(int(a));parent[find(int(b))]=root;parent[find(int(c))]=root
    groups={}
    for i,face in enumerate(faces):groups.setdefault(find(int(face[0])),[]).append(i)
    groups=sorted(groups.values(),key=len,reverse=True)
    # Keep tiny disconnected surface details with their nearest substantial component.
    major=[np.array(g) for g in groups if len(g)>max(8,len(faces)*.005)]
    if not major:return [np.arange(len(faces))]
    if len(major)>12:return [np.arange(len(faces))]
    used=set(int(x) for g in major for x in g)
    rest=np.array([i for i in range(len(faces)) if i not in used])
    if len(rest):major[0]=np.concatenate([major[0],rest])
    return major

def build(row,out):
    path=Path(row['source']);target=out/(row['id']+'.json')
    if target.exists() and (out/(row['id']+'.bin')).exists():return
    raw=path.read_bytes();count=struct.unpack_from('<I',raw,80)[0]
    triangles=np.ndarray((count,),dtype=np.dtype([('normal','<f4',3),('v','<f4',(3,3)),('attr','<u2')]),buffer=raw,offset=84)['v'].reshape(-1,3)
    co,index=np.unique(triangles,axis=0,return_inverse=True);faces=index.reshape(-1,3)
    co=co.astype(np.float64);co-=(co.min(axis=0)+co.max(axis=0))/2
    source_faces=len(faces)
    co,matrix=orient(co,row['role'],{**row,'_faces':faces})
    low,high=co.min(axis=0),co.max(axis=0);full_center=(low+high)/2
    landmarks={'planes':planes(co,faces,full_center)}
    sustainer=row['path'].startswith('02. SUSTAINERS/')
    if sustainer:landmarks.update(measured(co,faces,row['role'],full_center))
    if row['role']=='面板':
        landmarks['holes']=circular_holes(co,faces,full_center)
        front=circular_holes(co,faces,full_center,8)
        missing=[h for h in landmarks['holes'] if not any(np.hypot(h['x']-q['x'],h['z']-q['z'])<.1 for q in front)]
        if len(missing)==1:
            landmarks['labelHole']=missing[0]
            front=next(p['at'] for p in landmarks['planes']['y'] if p['normal']==1)
            landmarks['labelPocket']=label_pocket(co,faces,full_center,missing[0],front)
    if row['role']=='旋钮帽':
        bores=circular_holes(co,faces,full_center,.2,2.8,3.8)
        if bores:landmarks['frontBore']=bores[0]
    if row['role']=='柜体':landmarks['runnerPorts']=runner_ports(co,faces,full_center)
    limits={'柜体':120000,'箱体':120000,'抽屉盒':220000,'抽屉盒分件':180000,'顶盖':100000,'翻盖':100000,'翻盖分件':100000,'面板':20000000,'前面板':20000000}
    limit=limits.get(row['role'],200000)
    if len(faces)>limit:
        import fast_simplification
        co,faces=fast_simplification.simplify(co,faces,target_count=limit,agg=4)
    chunks=[];components=[];offset=0
    for group in split_components(co,faces,row['role']):
        selected=faces[group];used,index=np.unique(selected,return_inverse=True);verts=co[used]
        a,b=verts.min(axis=0),verts.max(axis=0);source_center=(a+b)/2
        source_offset=source_center-full_center
        verts,component_matrix=component_orientation(verts-source_center,row['role'],source_offset) if sustainer else (verts-source_center,np.eye(3))
        a,b=verts.min(axis=0),verts.max(axis=0);center=(a+b)/2
        features=measured(verts,index.reshape(-1,3),row['role'],center) if sustainer else None
        v,f,normals=crease_mesh(verts-center,index.reshape(-1,3))
        positions=np.asarray(v,dtype='<f4');normals=np.asarray(normals,dtype='<f4');indices=np.asarray(f,dtype='<u4').ravel()
        payload=positions.tobytes()+normals.tobytes()+indices.tobytes();chunks.append(payload)
        components.append({'offset':offset,'normalOffset':offset+positions.nbytes,'indexOffset':offset+positions.nbytes+normals.nbytes,'vertices':len(positions),'indices':len(indices),'size':(b-a).tolist(),'center':source_offset.tolist(),**({'landmarks':features,'orientation':component_matrix.tolist()} if sustainer else {})})
        offset+=len(payload)
    binary=out/(row['id']+'.bin');temp=binary.with_suffix('.part');temp.write_bytes(b''.join(chunks));temp.replace(binary)
    data={'version':9,'path':row['path'],'role':row['role'],'url':'preview-assets/'+binary.name,'size':(high-low).tolist(),'components':components,'sourceTriangles':source_faces,'displayTriangles':len(faces),'sourceBytes':path.stat().st_size,'sourceMtimeNs':path.stat().st_mtime_ns,'landmarks':landmarks,'orientation':matrix.tolist(),'displayOnly':True}
    temp=target.with_suffix('.part');temp.write_text(json.dumps(data,separators=(',',':')));temp.replace(target)

args=sys.argv[1:];plan=json.loads(Path(args[0]).read_text());out=Path(plan['output']);out.mkdir(parents=True,exist_ok=True)
progress=Path(plan['progress'])
for index,row in enumerate(plan['parts']):
    p=progress.with_suffix('.part');p.write_text(json.dumps({'done':index,'total':len(plan['parts']),'current':row['name']},ensure_ascii=False));p.replace(progress)
    build(row,out)
p=progress.with_suffix('.part');p.write_text(json.dumps({'done':len(plan['parts']),'total':len(plan['parts']),'current':'三维零件已准备完成'},ensure_ascii=False));p.replace(progress)
