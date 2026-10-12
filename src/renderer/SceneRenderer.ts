import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameSnapshot, VehicleKind } from '../core/types';
import { Kit, makeSignAtlas, palette, playerKit, rowGeometry, signGeometry, vehicleGeometry, type Sign } from './kit';

interface CarModel { group: THREE.Group; body: THREE.Mesh; conductor?: THREE.Mesh; kind: VehicleKind; id: string }
interface CachedRow { geometry: THREE.BufferGeometry; signs: Sign[] }

export class SceneRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private world=new THREE.Group();
  private camera=new THREE.OrthographicCamera(-9,9,9,-9,.1,100);
  private solid=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0});
  private atlas=makeSignAtlas();
  private signMaterial=new THREE.MeshBasicMaterial({map:this.atlas,side:THREE.DoubleSide});
  private ground=new THREE.Mesh(new THREE.BufferGeometry(),this.solid);
  private signs=new THREE.Mesh(new THREE.BufferGeometry(),this.signMaterial);
  private cachedRows=new Map<number,CachedRow>();
  private rowSignature='';
  private models=new Map<string,CarModel>();
  private modelPool=new Map<VehicleKind,CarModel[]>();
  private carGeometries=new Map<string,THREE.BufferGeometry>();
  private routeGeometries=new Map<number,THREE.BufferGeometry>();
  private conductorGeometry:THREE.BufferGeometry;
  private player=new THREE.Group();
  private limbs:THREE.Group[]=[];
  private characterGeometries:THREE.BufferGeometry[]=[];
  private shadowGeometry=new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2);
  private shadowMaterial=new THREE.MeshBasicMaterial({color:'#233f36',opacity:.16,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  private shadows=new THREE.InstancedMesh(this.shadowGeometry,this.shadowMaterial,180);
  private shadowDummy=new THREE.Object3D();
  private impact=new THREE.Group();
  private sparkGeometry=new THREE.IcosahedronGeometry(.065,0);
  private sparkMaterial=new THREE.MeshBasicMaterial({color:'#fbd86b'});
  private sparks:THREE.Mesh[]=[];
  private selectionRing=new THREE.Mesh(new THREE.RingGeometry(.31,.355,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#8761ab',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
  private followZ=0;
  private viewHeight=17;
  private lastSeed=-1;
  private lastScore=0;
  private hitAge=0;
  private lastPhase='';
  private incomingGeometry:THREE.BufferGeometry;
  private incomingMaterial=new THREE.MeshBasicMaterial({color:'#ffd05a',side:THREE.DoubleSide});
  private incoming:THREE.InstancedMesh;
  private resizeObserver:ResizeObserver;
  private destroyed=false;

  constructor(private container:HTMLElement) {
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=.84;
    this.renderer.setClearColor('#dce1d2',1);
    this.renderer.domElement.setAttribute('aria-label','Lagos street crossing game. Purple commuter, yellow danfos and roadside market.');
    this.renderer.domElement.setAttribute('role','img');
    this.renderer.domElement.style.display='block';
    this.renderer.domElement.style.width='100%';
    this.renderer.domElement.style.height='100%';
    container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#dce1d2');
    this.scene.fog=new THREE.Fog('#dce1d2',43,79);
    // Reflection preserves intuitive controls while the camera sees vehicle sides.
    this.world.scale.z=-1;this.scene.add(this.world);
    this.incomingGeometry=new THREE.BufferGeometry();
    this.incomingGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -.29,.045,-.24, -.035,.045,0, -.29,.045,.24,
      .025,.045,-.24, .28,.045,0, .025,.045,.24,
    ],3));
    this.incomingGeometry.computeVertexNormals();
    this.incoming=new THREE.InstancedMesh(this.incomingGeometry,this.incomingMaterial,40);
    this.incoming.frustumCulled=false;
    this.world.add(this.ground,this.signs,this.shadows,this.player,this.selectionRing,this.impact,this.incoming);
    this.shadows.frustumCulled=false;this.shadows.renderOrder=1;
    this.scene.add(new THREE.HemisphereLight('#ffffe6','#a2b5a5',1.30));
    const sun=new THREE.DirectionalLight('#fff1ca',2);sun.position.set(-8,18,10);this.scene.add(sun);
    const fill=new THREE.DirectionalLight('#cedfe3',.35);fill.position.set(8,5,-5);this.scene.add(fill);
    this.shadowMaterial.opacity=.26;
    const kit=playerKit();this.characterGeometries=[kit.torso,kit.arm,kit.leg];
    this.player.add(new THREE.Mesh(kit.torso,this.solid));
    for(let i=0;i<4;i++) {
      const g=new THREE.Group();g.position.set(i<2?(i===0?-.245:.245):(i===2?-.092:.092),i<2?.70:.37,0);
      g.add(new THREE.Mesh(i<2?kit.arm:kit.leg,this.solid));this.limbs.push(g);this.player.add(g);
    }
    const conductor=new Kit();
    conductor.box('#dce4bf',[0,.66,-.50],[.20,.27,.20],true,[.2,0,.2]);
    conductor.ball(palette.skin,[.01,.86,-.54],[.18,.20,.18]);
    conductor.box(palette.skin,[.20,.73,-.60],[.32,.07,.07],true,[0,-.2,-.3]);
    this.conductorGeometry=conductor.finish();
    for(let i=0;i<9;i++) {const spark=new THREE.Mesh(this.sparkGeometry,this.sparkMaterial);this.sparks.push(spark);this.impact.add(spark);}
    this.impact.visible=false;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }

  get metrics() {return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};}

  resize() {
    const width=Math.max(1,this.container.clientWidth),height=Math.max(1,this.container.clientHeight),aspect=width/height;
    // A portrait retains all eleven columns. Wide screens gain scenery, not a cropped road.
    this.viewHeight=Math.max(14.5,13.65/aspect);
    const viewWidth=this.viewHeight*aspect;
    this.camera.left=-viewWidth/2;this.camera.right=viewWidth/2;this.camera.top=this.viewHeight/2;this.camera.bottom=-this.viewHeight/2;
    this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);
  }

  resetCamera() {this.followZ=0;this.lastScore=0;this.hitAge=0;}

  private syncRows(snapshot:GameSnapshot) {
    const signature=`${snapshot.seed}:${snapshot.rows[0]?.z}:${snapshot.rows.at(-1)?.z}`;
    if(signature===this.rowSignature)return;
    if(snapshot.seed!==this.lastSeed) {this.cachedRows.forEach(r=>r.geometry.dispose());this.cachedRows.clear();}
    this.rowSignature=signature;
    const active=new Set(snapshot.rows.map(r=>r.z));
    for(const [z,row]of this.cachedRows)if(!active.has(z)){row.geometry.dispose();this.cachedRows.delete(z);}
    const pieces:THREE.BufferGeometry[]=[],signs:Sign[]=[];
    for(const row of snapshot.rows) {
      let cached=this.cachedRows.get(row.z);
      if(!cached){cached=rowGeometry(row);this.cachedRows.set(row.z,cached);}
      pieces.push(cached.geometry);signs.push(...cached.signs);
    }
    const merged=pieces.length?mergeGeometries(pieces,false)!:new THREE.BufferGeometry();
    this.ground.geometry.dispose();this.ground.geometry=merged;
    this.signs.geometry.dispose();this.signs.geometry=signGeometry(signs);
  }

  private acquire(kind:VehicleKind,id:string):CarModel {
    const pool=this.modelPool.get(kind),reused=pool?.pop();
    if(reused){reused.id=id;reused.group.visible=true;return reused;}
    let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;
    const key=`${kind}:${hash%4}`;
    let geometry=this.carGeometries.get(key);
    if(!geometry){geometry=vehicleGeometry(kind,hash%4);this.carGeometries.set(key,geometry);}
    const group=new THREE.Group(),body=new THREE.Mesh(geometry,this.solid);group.add(body);
    let conductor:THREE.Mesh|undefined;
    if(kind==='danfo'){
      conductor=new THREE.Mesh(this.conductorGeometry,this.solid);conductor.visible=false;group.add(conductor);
      const route=hash%2;
      let routeGeometry=this.routeGeometries.get(route);
      if(!routeGeometry){routeGeometry=signGeometry([{x:.45,y:.795,z:-.432,width:.34,height:.19,label:route}]);this.routeGeometries.set(route,routeGeometry);}
      group.add(new THREE.Mesh(routeGeometry,this.signMaterial));
    }
    this.world.add(group);return {group,body,conductor,kind,id};
  }

  render(snapshot:GameSnapshot,dt:number,reducedMotion:boolean) {
    if(this.destroyed)return;
    if(snapshot.seed!==this.lastSeed||snapshot.score<this.lastScore)this.resetCamera();
    this.syncRows(snapshot);this.lastSeed=snapshot.seed;this.lastScore=snapshot.score;
    const moving=snapshot.phase==='playing';
    const highest=Math.max(0,snapshot.player.highestZ);
    this.followZ=reducedMotion?highest:THREE.MathUtils.lerp(this.followZ,highest,1-Math.exp(-Math.min(dt,.1)*6));
    // Look ahead keeps the commuter in the lower third, with danger fully readable above.
    const lookAhead=Math.min(9,this.viewHeight*(this.viewHeight>20?.16:.265));
    const aim=this.followZ+lookAhead;
    this.camera.position.set(2.5,21,18-aim);this.camera.lookAt(0,0,-aim);
    // IDs repeat between seeds; include kind so a retry cannot inherit the wrong silhouette.
    const active=new Set(snapshot.vehicles.map(v=>`${v.kind}:${v.id}`));
    for(const[id,model]of this.models)if(!active.has(id)){
      model.group.visible=false;this.models.delete(id);
      let pool=this.modelPool.get(model.kind);if(!pool){pool=[];this.modelPool.set(model.kind,pool);}pool.push(model);
    }
    let shadow=0;
    for(const v of snapshot.vehicles) {
      const key=`${v.kind}:${v.id}`;
      let model=this.models.get(key);if(!model){model=this.acquire(v.kind,v.id);this.models.set(key,model);}
      const visible=Math.abs(v.x)<12&&v.rowZ>this.followZ-9&&v.rowZ<this.followZ+26;
      model.group.visible=visible;if(!visible)continue;
      model.group.position.set(v.x,0,v.rowZ);model.group.rotation.y=v.direction===1?0:Math.PI;
      model.body.position.y=!reducedMotion&&moving&&!v.stopped?Math.sin(snapshot.time*12+v.rowZ)*.009:0;
      if(model.conductor)model.conductor.visible=v.stopped;
      this.shadowDummy.position.set(v.x+.07,.022,v.rowZ+.02);this.shadowDummy.scale.set(v.length*.58,1,v.width*.63);this.shadowDummy.rotation.set(0,0,0);this.shadowDummy.updateMatrix();
      if(shadow<179)this.shadows.setMatrixAt(shadow++,this.shadowDummy.matrix);
    }
    let cueCount=0;
    for(const row of snapshot.rows) {
      if(!row.kind.startsWith('road'))continue;
      const warning=snapshot.vehicles.some(v=>{
        if(v.rowZ!==row.z)return false;
        const travelFront=v.direction*v.x+v.length/2;
        const distance=-5.24-travelFront;
        return distance>=-.3&&distance<=row.speed*1.6;
      });
      if(!warning||cueCount>=40)continue;
      this.shadowDummy.position.set(-row.direction*5.15,.008,row.z);
      this.shadowDummy.rotation.set(0,row.direction===1?0:Math.PI,0);
      this.shadowDummy.scale.setScalar(1);this.shadowDummy.updateMatrix();
      this.incoming.setMatrixAt(cueCount++,this.shadowDummy.matrix);
    }
    this.incoming.count=cueCount;this.incoming.instanceMatrix.needsUpdate=true;
    const player=snapshot.player;
    const onRoad=snapshot.rows.find(r=>r.z===Math.round(player.z))?.kind.startsWith('road')??false;
    const floor=onRoad?.027:.153;
    const hop=player.moving&&!reducedMotion?Math.sin(player.hopProgress*Math.PI):0;
    const dead=snapshot.phase==='hit'||snapshot.phase==='result';
    this.player.position.set(player.x,floor+hop*.27,player.z);
    this.player.scale.set(1+hop*.035,1-hop*.03,1+hop*.035);
    let facing=0;
    if(player.to.x!==player.from.x)facing=player.to.x>player.from.x?Math.PI/2:-Math.PI/2;
    else if(player.to.z<player.from.z)facing=Math.PI;
    this.player.rotation.y=facing;
    this.player.rotation.z=dead?-.28:0;
    for(let i=0;i<this.limbs.length;i++)this.limbs[i].rotation.x=hop*(i%2===0?1:-1)*(i<2?.52:.40);
    this.shadowDummy.position.set(player.x+.06,floor,player.z+.02);this.shadowDummy.scale.set(.30-hop*.06,1,.24-hop*.05);this.shadowDummy.rotation.set(0,0,0);this.shadowDummy.updateMatrix();
    this.shadows.setMatrixAt(shadow++,this.shadowDummy.matrix);this.shadows.count=shadow;this.shadows.instanceMatrix.needsUpdate=true;
    this.selectionRing.position.set(player.x,floor+.004,player.z);this.selectionRing.visible=!dead;
    if(dead&&this.lastPhase!=='hit'&&this.lastPhase!=='result')this.hitAge=0;
    if(dead)this.hitAge=Math.min(1,this.hitAge+dt);else this.hitAge=0;
    this.impact.visible=dead;
    if(dead) {
      this.impact.position.set(player.x,.5,player.z);
      const progress=reducedMotion?.65:Math.min(this.hitAge*2.8,1);
      this.sparks.forEach((spark,i)=>{
        const a=i/this.sparks.length*Math.PI*2;
        spark.position.set(Math.cos(a)*(.24+progress*.39),Math.sin(i*2.7)*.15+.23*(1-progress),Math.sin(a)*(.24+progress*.34));
        spark.rotation.set(i+progress,i*2,i*3);spark.scale.setScalar(1-progress*.32);
      });
    }
    this.lastPhase=snapshot.phase;
    this.renderer.render(this.scene,this.camera);
  }

  dispose() {
    this.destroyed=true;this.resizeObserver.disconnect();
    this.ground.geometry.dispose();this.signs.geometry.dispose();this.cachedRows.forEach(r=>r.geometry.dispose());
    this.carGeometries.forEach(g=>g.dispose());this.routeGeometries.forEach(g=>g.dispose());this.characterGeometries.forEach(g=>g.dispose());this.conductorGeometry.dispose();
    this.shadowGeometry.dispose();this.shadowMaterial.dispose();this.sparkGeometry.dispose();this.sparkMaterial.dispose();
    this.incomingGeometry.dispose();this.incomingMaterial.dispose();
    this.selectionRing.geometry.dispose();(this.selectionRing.material as THREE.Material).dispose();
    this.solid.dispose();this.signMaterial.dispose();this.atlas.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
