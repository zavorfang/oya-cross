import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Row, VehicleKind } from '../core/types';
import { GAME } from '../config/game';

// Original painted miniature kit. All solid parts share one vertex-colour material.
export const palette = {
  asphalt: '#535a58', asphaltDark: '#4a5352', concrete: '#ddd6c1', edge: '#b6b09a',
  yellow: '#f6bc22', orange: '#e9a32b', ink: '#263536', glass: '#40595b',
  white: '#eee9d5', purple: '#8050bb', skin: '#875031', leaves: '#568969',
  peach: '#cb9276', green: '#34856e', red: '#c75843', sand: '#c5bea3',
};
const primitives = new Map<string, THREE.BufferGeometry>();
const colorCache = new Map<string, THREE.Color>();
const scratch = new THREE.Object3D();
function color(hex: string) { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex,c); } return c; }
function base(key: string, make: () => THREE.BufferGeometry) {
  let g = primitives.get(key); if (!g) { g = make(); primitives.set(key, g); } return g;
}
export class Kit {
  parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, tint: string, p: number[], s: number[] = [1,1,1], r: number[] = [0,0,0]) {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    geo.deleteAttribute('uv');
    const count = geo.getAttribute('position').count;
    const colors = new Float32Array(count * 3); const c = color(tint);
    for (let i=0;i<count;i++) { colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b; }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    scratch.position.set(p[0],p[1],p[2]); scratch.scale.set(s[0],s[1],s[2]);
    scratch.rotation.set(r[0],r[1],r[2]); scratch.updateMatrix(); geo.applyMatrix4(scratch.matrix);
    this.parts.push(geo); return this;
  }
  box(tint: string, p: number[], s: number[], bevel = false, r: number[] = [0,0,0]) {
    return this.add(base(bevel?'bevel':'box',()=>bevel?new RoundedBoxGeometry(1,1,1,1,0.10):new THREE.BoxGeometry(1,1,1)),tint,p,s,r);
  }
  cylinder(tint: string, p: number[], s: number[], r: number[] = [0,0,0], sides=10) {
    return this.add(base(`cyl${sides}`,()=>new THREE.CylinderGeometry(0.5,0.5,1,sides)),tint,p,s,r);
  }
  cone(tint: string, p: number[], s: number[], sides=8) { return this.add(base(`cone${sides}`,()=>new THREE.ConeGeometry(.5,1,sides)),tint,p,s); }
  ball(tint: string,p: number[],s: number[]) {return this.add(base('ball',()=>new THREE.IcosahedronGeometry(.5,1)),tint,p,s);}
  finish() {
    const g=mergeGeometries(this.parts,false)!; for (const p of this.parts) p.dispose(); this.parts=[];
    g.computeBoundingSphere(); return g;
  }
}
export function seeded(seed: number) { let a=seed>>>0; return () => {a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }

export interface Sign { x: number; y: number; z: number; width: number; height: number; label: number; facing?: number }
export const labels = ['OSHODI', 'YABA', 'POS', 'AYO STORES', 'FRESH & GO', 'EKO / 01', 'BUS STOP', 'SLOW. SMALL.', 'MAMA T. FRUIT', 'CITY GOODS', 'LAGOS', 'GO EASY'];
export function makeSignAtlas() {
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=768;
  const ctx=canvas.getContext('2d')!;
  labels.forEach((label,i)=>{
    const x=(i%4)*256, y=Math.floor(i/4)*256;
    const dark=[0,1,3,5,6,9,10].includes(i);
    ctx.fillStyle=dark?'#29453e':'#f4e9c9';ctx.fillRect(x,y,256,256);
    ctx.strokeStyle=dark?'#ccdab0':'#d19b41';ctx.lineWidth=6;ctx.strokeRect(x+13,y+66,230,124);
    ctx.fillStyle=dark?'#f7e8b8':'#3c5142';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`900 ${label.length>9?25:label.length>6?30:41}px Arial`;ctx.fillText(label,x+128,y+127);
    ctx.font='bold 13px Arial';ctx.fillText(i===6?'PICK UP / DROP OFF':i===2?'CASH • TRANSFER':'LAGOS CROSSING',x+128,y+166);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
  return texture;
}
export function signGeometry(signs: Sign[]) {
  const parts: THREE.BufferGeometry[]=[];
  for (const sign of signs) {
    const g=new THREE.PlaneGeometry(sign.width,sign.height);const uv=g.getAttribute('uv');
    const col=sign.label%4, row=Math.floor(sign.label/4);
    for(let i=0;i<uv.count;i++) uv.setXY(i,(col+uv.getX(i))/4,1-(row+1-uv.getY(i))/3);
    g.rotateY(sign.facing??Math.PI);g.translate(sign.x,sign.y,sign.z);parts.push(g);
  }
  if(!parts.length)return new THREE.BufferGeometry();
  const merged=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());return merged;
}

function wheel(k: Kit, x: number, z: number, radius=.19) {
  k.cylinder(palette.ink,[x,radius,z],[radius*2,.12,radius*2],[Math.PI/2,0,0],12);
  k.cylinder('#9eaa9c',[x,radius,z+Math.sign(z)*.069],[radius*.90,.016,radius*.90],[Math.PI/2,0,0],8);
}
export function vehicleGeometry(kind: VehicleKind, variant=0) {
  const k=new Kit(), p=palette;
  if(kind==='danfo') {
    k.box(p.ink,[0,.22,0],[2.02,.18,.74],true);
    k.box(p.yellow,[0,.62,0],[2.13,.72,.82],true);
    k.box('#fbd259',[-.05,1.005,0],[1.91,.12,.78],true);
    for(const side of [-1,1]) {
      k.box(p.ink,[0,.49,side*.417],[2.05,.08,.012]);
      k.box(p.ink,[0,.39,side*.417],[2.02,.032,.012]);
      for(let a=0;a<4;a++) k.box(p.glass,[-.72+a*.42,.78,side*.416],[.33,.29,.017]);
      k.box('#182f32',[-.76,.75,side*.428],[.19,.2,.012]);
      k.box(p.orange,[-.19,.69,side*.43],[.018,.52,.016]);
      k.box(p.ink,[.17,.60,side*.44],[.11,.025,.022]);
      k.box(p.ink,[.86,.77,side*.47],[.12,.13,.10]);
      wheel(k,-.70,side*.4);wheel(k,.68,side*.4);
    }
    k.box(p.glass,[1.05,.79,0],[.025,.30,.68]);
    k.box(p.ink,[1.081,.34,0],[.10,.12,.84],true);
    k.box(p.ink,[-1.08,.32,0],[.08,.12,.84],true);
    for(const z of [-.26,.26]) {k.box(p.white,[1.091,.51,z],[.04,.12,.16]);k.box(p.red,[-1.071,.47,z],[.025,.14,.12]);}
    k.box(p.white,[1.138,.37,0],[.014,.07,.22]);
    k.box('#b18a2f',[-.72,1.076,.12],[.18,.007,.22]);
    k.box('#a7aa80',[-.88,.50,-.421],[.13,.08,.008]);
  } else if(kind==='keke') {
    k.box(p.yellow,[-.13,.40,0],[.85,.36,.67],true);
    k.box(p.orange,[.38,.42,0],[.35,.36,.47],true);
    k.box(p.ink,[-.1,.93,0],[.88,.14,.73],true);
    for(const s of [-1,1]) {k.box(p.yellow,[-.49,.70,s*.27],[.06,.4,.06]);k.box(p.yellow,[.28,.72,s*.27],[.045,.42,.045],false,[0,0,.16]);wheel(k,-.30,s*.31,.155);}
    k.box(p.ink,[-.11,.54,0],[.30,.08,.51]);
    k.box(p.glass,[.29,.73,0],[.025,.28,.46],false,[0,0,.15]);
    k.box(p.yellow,[.48,.43,0],[.10,.37,.27],true);
    k.cylinder(p.ink,[.47,.16,0],[.3,.13,.3],[Math.PI/2,0,0]);
    k.box(p.white,[.55,.49,0],[.04,.11,.13],true);
  } else {
    const suv=kind==='suv', length=suv?1.65:1.45;
    const paint=['#eee9d8','#b7c7c1','#a65649','#435e59'][variant%4];
    k.box(p.ink,[0,.22,0],[length*.91,.15,.65],true);
    k.box(paint,[0,.41,0],[length,.35,suv?.8:.74],true);
    k.box(p.glass,[-.10,suv?.72:.66,0],[length*.61,suv?.36:.30,.64],true);
    k.box(paint,[-.12,suv?.91:.81,0],[length*.53,.07,.65],true);
    k.box(paint,[.48,.58,0],[.43,.09,.69],true);
    for(const s of [-1,1]){
      k.box(paint,[-.13,.71,s*.332],[.055,.27,.02]);
      k.box(p.ink,[.22,.64,s*.41],[.13,.08,.1]);
      k.box('#d5d8c4',[-.15,.48,s*.38],[.11,.025,.018]);
      wheel(k,-length*.31,s*.34,.16);wheel(k,length*.30,s*.34,.16);
      k.box(p.white,[length*.5,.43,s*.25],[.022,.11,.17]);
      k.box(p.red,[-length*.5,.42,s*.25],[.022,.09,.16]);
    }
    k.box(p.ink,[length*.51,.28,0],[.05,.09,.57],true);
    if(suv) {k.box(p.ink,[-.1,.96,-.22],[.74,.04,.05]);k.box(p.ink,[-.1,.96,.22],[.74,.04,.05]);}
  }
  return k.finish();
}

function crate(k:Kit,x:number,z:number,tint:string) {
  k.box('#9c754c',[x,.23,z],[.47,.46,.42],true);
  for(const y of [.12,.28,.40]) k.box('#b99263',[x,y,z-.221],[.46,.025,.021]);
  for(let a=0;a<3;a++) for(let b=0;b<2;b++) k.ball(tint,[x-.13+a*.13,.51,z-.1+b*.18],[.13,.13,.13]);
}
function umbrella(k: Kit,x:number,z:number,tint:string) {
  k.cylinder('#887a59',[x,.78,z],[.045,1.56,.045]);
  k.cone(tint,[x,1.64,z],[1.58,.45,1.58],8);
  k.cone(tint==='#34856e'?'#67a088':'#e8835b',[x,1.81,z],[.94,.25,.94],8);
  k.ball('#ede2ae',[x,1.97,z],[.11,.13,.11]);
}
function tree(k: Kit,x:number,z:number) {
  k.cylinder('#90714c',[x,.65,z],[.14,1.30,.14],[0,0,0],7);
  k.ball('#719871',[x,1.61,z],[1.12,1.36,.96]);
  k.ball('#547f5e',[x-.26,1.43,z+.15],[.85,.86,.85]);
  k.ball('#8aa976',[x+.2,1.9,z],[.8,.73,.76]);
  k.box('#b7b89d',[x,.12,z],[.9,.24,.8],true);
}
export function rowGeometry(row: Row): { geometry: THREE.BufferGeometry; signs: Sign[] } {
  const k=new Kit(),p=palette,rng=seeded(row.seed),z=row.z,signs:Sign[]=[];
  const road=row.kind.startsWith('road');
  k.box(road?(row.bundle%2?p.asphalt:p.asphaltDark):row.kind==='refuge'?'#c2cab0':p.concrete,[0,road?-.1:-.035,z],[24,road?.2:.32,1]);
  // Quiet, continuous utility cables sit entirely outside the playable columns.
  k.box('#6c7867',[-6.17,2.83,z],[.013,.014,1]);
  k.box('#73806d',[-6.04,2.77,z],[.010,.013,1]);
  if(road) {
    k.box('#3f4d48',[-5.8,.012,z],[.13,.016,1]);k.box('#3f4d48',[5.8,.012,z],[.13,.016,1]);
    for(let x=-10;x<11;x+=1.3) k.box('#b0b2a0',[x,.012,z+.47],[.61,.024,.032]);
    if(z===3) for(let x=-1.3;x<1.4;x+=.48) k.box('#e7e0c7',[x,.017,z],[.26,.025,.72]);
    if(row.stop) {
      const stopX=GAME.stopPosition*row.direction;
      k.box('#e8c369',[stopX,.018,z-.4],[2.2,.026,.035]);
      k.box('#e8c369',[stopX+row.direction*1.1,.018,z],[.035,.026,.79]);
    }
  } else {
    for(let x=-5;x<=5;x++) {k.box('#c9c2ab',[x,.132,z],[.012,.008,.91]);if(z%2===0)k.box('#c9c2ab',[x,.132,z-.35],[.93,.008,.012]);}
    for(const side of [-1,1]) {
      k.box('#a6a994',[side*5.65,.10,z],[.18,.30,1]);
      for(const zz of [-.32,.18]) k.box((z+Math.round(zz*10))%2===0?p.white:'#737e69',[side*5.65,.26,z+zz],[.19,.05,.34]);
    }
    if(z<0||z%4===0) for(const side of [-1,1]) {
      const x=side*6.5;
      tree(k,x,z);
      k.ball('#819974',[x+.4,.18,z-.33],[.50,.31,.4]);
    }
    else {
      for(const side of [-1,1]) {
        const x=side*6.65, market=(z%3!==0||z===2);
        if(market) {
          umbrella(k,x,z+.05,side===1?p.green:p.red);
          k.box('#d2ac74',[x,.54,z-.02],[1.12,.11,.59],true);
          k.box('#ad8c61',[x,.27,z+.12],[.79,.51,.44]);
          crate(k,x+side*.64,z-.07,side===1?'#da9050':'#859a43');
          signs.push({x,y:.48,z:z-.26,width:.77,height:.28,label:side===1?2:8});
          k.ball('#754b33',[x,.99,z+.35],[.23,.25,.23]);
          k.box(side===1?'#61848a':'#dfb167',[x,.75,z+.35],[.29,.31,.22],true);
        }
        if(z%3===1||z===2) {
          const bx=side*8.20, h=1.3+rng()*1.45;
          k.box(side===1?'#d2ac83':'#ca987d',[bx,h*.5,z+.24],[1.87,h,1.65],true);
          k.box('#b18b6a',[bx,h+.10,z+.24],[2.03,.20,1.77],true);
          k.box('#718877',[bx,.22,z-.64],[1.7,.38,.11]);
          k.box('#64847a',[bx,.74,z-.615],[.67,.98,.04]);
          for(const a of [-.58,.58]) {k.box('#547470',[bx+a,h-.43,z-.60],[.36,.39,.026]);k.box('#e9d2a6',[bx+a,h-.43,z-.62],[.034,.40,.02]);}
          k.box('#f0d8ac',[bx,1.25,z-.65],[1.64,.37,.12],true);
          signs.push({x:bx,y:1.26,z:z-.723,width:1.59,height:.36,label:side===1?3:4});
          k.box(side===1?'#648e7c':'#d2a854',[bx,1.03,z-.84],[1.78,.08,.61],false,[.13,0,0]);
          for(let a=-3;a<=3;a++)k.box('#eee2b9',[bx+a*.25,1.044,z-.84],[.12,.085,.61],false,[.13,0,0]);
          k.box('#8d8e75',[bx+.45,h+.30,z+.38],[.35,.45,.40],true);
        }
      }
    }
    if(z===2||z%7===0) {
      k.cylinder('#596d60',[5.99,1.23,z],[.06,2.46,.06]);
      k.box(p.green,[5.99,2.19,z],[.89,.51,.07],true);
      signs.push({x:5.99,y:2.19,z:z-.043,width:.87,height:.49,label:z===2?0:6});
      k.box('#a0ac8e',[5.99,.12,z],[.27,.24,.30],true);
      k.cylinder('#485e55',[-6.10,1.55,z],[.085,3.1,.085]);
      k.box('#485e55',[-5.85,3.08,z],[.57,.065,.065],true);
      k.box('#f6e5ba',[-5.61,3.04,z],[.34,.11,.22],true);
    }
  }
  return {geometry:k.finish(),signs};
}

export function playerKit() {
  const torso=new Kit();torso.box(palette.purple,[0,.56,0],[.38,.36,.25],true);
  torso.box('#a079cd',[0,.74,0],[.36,.09,.27],true);
  torso.box('#513975',[0,.40,0],[.33,.07,.25],true);
  torso.box('#e2ae55',[.14,.51,.15],[.19,.21,.11],true);
  torso.box('#e2ae55',[.04,.63,-.139],[.06,.36,.025],false,[0,0,-.48]);
  torso.box(palette.skin,[0,.86,0],[.29,.29,.27],true);
  torso.box('#303831',[0,1.008,-.01],[.31,.085,.28],true);
  torso.box('#303831',[0,.947,-.132],[.29,.14,.03],true);
  torso.box('#a56540',[0,.84,.149],[.075,.064,.07],true);
  torso.box('#202e2c',[-.074,.89,.148],[.034,.035,.015],true);
  torso.box('#202e2c',[.074,.89,.148],[.034,.035,.015],true);
  const arm=new Kit();arm.box(palette.purple,[0,-.11,0],[.13,.24,.16],true);arm.box(palette.skin,[0,-.255,0],[.11,.13,.12],true);
  const leg=new Kit();leg.box('#30464b',[0,-.14,0],[.13,.28,.16],true);leg.box(palette.white,[0,-.29,.035],[.16,.12,.24],true);
  return {torso:torso.finish(),arm:arm.finish(),leg:leg.finish()};
}
export function disposePrimitives() {primitives.forEach(g=>g.dispose());primitives.clear();}
