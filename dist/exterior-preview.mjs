// Keep complete parts with visible exterior surfaces. The knob core and the
// sustainer's inner lock link are exposed hardware outside the box, despite
// their names. Drawer boxes, runners, springs, racks and dividers stay unloaded.
export const EXTERIOR_ROLES=new Set(['柜体','箱体','面板','前面板','顶盖','翻盖','翻盖分件','旋钮锁芯','旋钮帽','面板端盖','标签','箱体标签','锁扣标签','限位件','堆叠锁扣','上铰链套件','下铰链套件','铰链轴套件','锁扣座','锁扣内件','锁扣外件','锁扣插销套件']);
export const exteriorParts=parts=>parts.filter(p=>EXTERIOR_ROLES.has(p.role));
export const exteriorSpec=entry=>({model:entry.model.id,roof:entry.options.roof,grid:false,rails:false,detail:'exterior'});
