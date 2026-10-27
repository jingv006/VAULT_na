// Only display names are translated. Original file paths remain stable for exports.
const phrases = [
 ['1 SET OF PINS FOR 1 LOCK','单锁插销套件'],['Turn On Supports','需开启支撑'],
 ['Under Table Mount Roof','桌下安装顶盖'],['Gridfinity Baseplate','网格收纳底板'],
 ['Baseplate_With 2 Handles','双手柄底板'],['Baseplate_With 1 Handle','单手柄底板'],
 ['Universal Pull-out Handle Lock','通用伸缩手柄锁扣'],['Pull-out Handle Lock','伸缩手柄锁扣'],
 ['Handle Lock Knob Part','手柄锁定旋钮分件'],['Pull-out Handle','伸缩手柄'],
 ['Stationary Handle','固定手柄'],['Top Handle','顶部手柄'],
 ['Connector For Split Roof','分体翻盖连接件'],['Connector for Modules','模块连接件'],
 ['Wall Mount Second Part','壁挂支架第二分件'],['Wall Mount','壁挂支架'],
 ['Heavyweight Roof Cut','重载顶盖切分版'],['Heawyweight Roof Handle','重载顶盖手柄'],
 ['Heawyweight Roof Insert','重载顶盖嵌件'],['Heawyweight Roof','重载顶盖'],
 ['Bowl Roof','托盘顶盖'],['Grid Roof','网格收纳顶盖'],['Table Roof','平面顶盖'],
 ['Dividers Module','分隔箱体'],['Flat Module','平底箱体'],['Sealed Module','密封箱体'],
 ['Runner Guide','导轨'],['Runner Slide','滑轨'],['Runner Stopper','滑轨限位件'],
 ['LOCK HOLDER','锁扣座'],['LOCK INNER PART','锁扣内件'],['LOCK OUTER PART','锁扣外件'],
 ['Hidden Key Part','隐藏旋钮锁芯分件'],['Hidden Key','隐藏旋钮锁芯'],['Key Cap','旋钮帽'],
 ['Facade Cap','面板端盖'],['Back Panel','抽屉背板'],['Base Connector','底座连接件'],
 ['Label for Sustainers','翻盖箱标签'],['Hinge Top','上铰链'],['Seal Divider','密封隔板'],
 ['Width Divider','横向隔板'],['Depth Divider','纵向隔板'],
 ['Rounded Edge Piece','圆角边条'],['Straight Edge Piece','直边条'],
 ['grid divider pin_loose','网格隔板插销（宽松）'],['grid divider pin_tight','网格隔板插销（紧配）'],
 ['Accessory 1st','中间连接件一'],['Accessory 2nd','中间连接件二'],
 ['Baseplate','底板'],['Backbone','背部加强件'],['Universal','通用'],['Facade','面板'],
 ['Module','柜体'],['Springs','弹簧套件'],['Latch','堆叠锁扣'],['Label','标签'],
 ['Key','旋钮锁芯'],['Roof','翻盖'],['Box','抽屉盒'],['Base','底座'],['Whole','整件'],
 ['Part','分件'],['Divider','隔板'],['Rails','加强齿条套件'],['Feet','脚座'],
 ['Hinge','下铰链'],['Rods','铰链轴套件'],['Center','中部'],['Sides','两侧'],
 ['Tyre','轮胎'],['Bushing','轴套'],['Disk','圆盘'],['Cover','盖板'],['Jig','定位治具']
];
export function partName(file) {
 const path=typeof file==='string'?file:file.path||file.name;
 let name=path.split('/').pop().replace(/\.stl$/i,'');
 for(const [en,zh] of phrases)name=name.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),zh);
 if(path.startsWith('02. SUSTAINERS'))name=name.replaceAll('柜体','箱体');
 if(path.includes('/Manual Supports/'))name+=' 手动支撑件';
 if(path.includes('/Grid Dividers/')){const tall=path.match(/\/([\d.]+)MM TALL/);name='网格隔板'+(tall?'（'+tall[1]+'毫米高）':'')+' '+name;}
 if(/^[SMLX]+\d[Ff](?:\s*\(需开启支撑\))?$/.test(name))name+=path.includes('/Pegboard Attachment/')?(path.includes('IKEA')?' 宜家洞洞板挂件':'洞洞板挂件'):' 面板';
 return name.replace(/(\d)MM\b/gi,'$1毫米').replaceAll('_',' ').replace(/\s+/g,' ').trim();
}
export function folderName(path) {
 if(path.startsWith('03. MODIFICATIONS'))return '改装配件';
 if(path.startsWith('02. SUSTAINERS'))return '翻盖箱通用配件';
 return '抽屉柜通用配件';
}
