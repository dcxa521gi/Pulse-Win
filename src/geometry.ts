// Translated from Pulse's DockBerthShape: concave fillets + exponent-4 corners.
export function dockPath(width:number,height:number,top:boolean,left:boolean,scale:number){
 const w=top?height:width,h=top?width:height,f=Math.min(24*scale,h/2),r=Math.max(0,Math.min(26*scale,w,(h-f*2)/2)),fw=Math.max(0,Math.min(38*scale,w-r));
 const point=(x:number,y:number)=>top?`${y},${height-x}`:left?`${width-x},${y}`:`${x},${y}`;
 let d=`M ${point(r,f)} L ${point(w-fw,f)} C ${point(w-fw*.45,f)} ${point(w,f*.55)} ${point(w,0)} L ${point(w,h)} C ${point(w,h-f*.55)} ${point(w-fw*.45,h-f)} ${point(w-fw,h-f)} L ${point(r,h-f)}`;
 for(let i=1;i<=48;i++){const t=i/48*Math.PI/2;d+=` L ${point(r-r*Math.sqrt(Math.sin(t)),h-f-r+r*Math.sqrt(Math.cos(t)))}`;}
 d+=` L ${point(0,f+r)}`;
 for(let i=1;i<=48;i++){const t=i/48*Math.PI/2;d+=` L ${point(r-r*Math.sqrt(Math.cos(t)),f+r-r*Math.sqrt(Math.sin(t)))}`;}
 return `path("${d} Z")`;
}
