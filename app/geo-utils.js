/** Pure map helpers shared by the browser and Node checks. */
export const PALETTE=['#f7d8a9','#ffb71b','#ee7a32','#1e3ac8'];

export function validPolygon(geometry){
 if(geometry?.type!=='Polygon'||!Array.isArray(geometry.coordinates)||geometry.coordinates.length!==1)return false;
 const ring=geometry.coordinates[0];
 if(!Array.isArray(ring)||ring.length<4||ring.length>1000)return false;
 if(!ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90))return false;
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return false;
 const points=ring.slice(0,-1);
 if(new Set(points.map(p=>p.join(','))).size!==points.length||points.length<3)return false;
 const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0);
 if(Math.abs(signed)<1e-12)return false;
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const onSegment=(p,a,b)=>Math.abs(orient(a,b,p))<1e-12&&p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12&&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
  const ab1=orient(a,b,c),ab2=orient(a,b,d),cd1=orient(c,d,a),cd2=orient(c,d,b);
  if((ab1*ab2<0&&cd1*cd2<0)||onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d))return false;
 }
 return true;
}

export function validZone(geometry){
 if(geometry===null)return true;
 if(['LineString','MultiLineString'].includes(geometry?.type)){
  const lines=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
  return Array.isArray(lines)&&lines.length>0&&lines.length<1000&&lines.every(points=>Array.isArray(points)&&points.length>=2&&points.length<5000&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
 }
 if(!['Polygon','MultiPolygon'].includes(geometry?.type))return false;
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 return Array.isArray(polygons)&&polygons.length>0&&polygons.length<200&&polygons.every(rings=>Array.isArray(rings)&&rings.length>0&&rings.every(ring=>Array.isArray(ring)&&ring.length>=4&&ring.length<5000&&ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]));
}

export function classification(values,{unit='%',method='quantile'}={}){
 const nums=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number).sort((a,b)=>a-b);
 if(!nums.length)return {breaks:[],unit,method,colors:PALETTE};
 let breaks;
 if(method==='fixed-percent')breaks=[25,50,75,100];
 else if(method==='equal'){
  const min=nums[0],max=nums.at(-1);
  breaks=[1,2,3,4].map(i=>min+(max-min)*i/4);
 }else breaks=[1,2,3,4].map(i=>nums[Math.ceil(i*nums.length/4)-1]);
 return {breaks,unit,method,colors:PALETTE};
}

export function classIndex(value,legend){
 if(value===null||value===undefined||!Number.isFinite(Number(value))||!legend.breaks.length)return -1;
 const i=legend.breaks.findIndex(limit=>Number(value)<=limit);
 return i<0?legend.breaks.length-1:i;
}
