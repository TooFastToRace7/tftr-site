/* Real-time 3D front suspension.
   The motion comes from synth() and the arm geometry from GEO and solveCorner() in index.html,
   the same as the 2D drawing. Everything else here is modelling. Static points are illustrative. */
"use strict";
(function(){
if(!window.THREE) return;
const SPRING_L=.34, T=THREE, UP=new T.Vector3(0,1,0), MAG=2.3, ROAD_K=100;
const v=(x,y,z)=>new T.Vector3(x,y,z||0);
const cyl=(r,mat,seg=14)=>{ const m=new T.Mesh(new T.CylinderGeometry(r,r,1,seg),mat); m.castShadow=true; return m; };
const place=(m,a,b)=>{ const d=b.clone().sub(a), l=d.length(); m.position.copy(a).addScaledVector(d,.5); m.scale.set(1,l,1); m.quaternion.setFromUnitVectors(UP,d.divideScalar(l||1)); };
const ball=(r,mat)=>{ const m=new T.Mesh(new T.SphereGeometry(r,14,10),mat); m.castShadow=true; return m; };
function canvasTex(w,h,draw){ const c=document.createElement("canvas"); c.width=w; c.height=h; draw(c.getContext("2d"),w,h); const t=new T.CanvasTexture(c); t.wrapS=t.wrapT=T.RepeatWrapping; t.colorSpace=T.SRGBColorSpace; t.anisotropy=8; return t; }

function studioEnv(r){
  const s=new T.Scene(); s.background=new T.Color(0x050605);
  const panel=(x,y,z,w,h,c)=>{ const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); s.add(m); };
  panel(0,9,3,14,5,new T.Color(4,4,3.8)); panel(-9,3,6,3,9,new T.Color(1.8,2,1.8)); panel(9,3,4,3,9,new T.Color(2.2,2.3,2.2)); panel(0,1,-10,16,3,new T.Color(.7,.8,.72));
  const p=new T.PMREMGenerator(r), t=p.fromScene(s,.03).texture; p.dispose(); return t;
}

function init(canvas){
  let R;
  try{ R=new T.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"}); }catch(e){ return null; }
  if(!R.getContext()) return null;
  R.outputColorSpace=T.SRGBColorSpace; R.toneMapping=T.ACESFilmicToneMapping; R.toneMappingExposure=1.1;
  R.shadowMap.enabled=true; R.shadowMap.type=T.PCFSoftShadowMap; R.setScissorTest(true);
  const S=new T.Scene(), BG=0x0a0a0a; S.background=new T.Color(BG); S.fog=new T.Fog(BG,3.4,7.2); S.environment=studioEnv(R);
  const C=new T.PerspectiveCamera(26,1,.05,30);
  const key=new T.DirectionalLight(0xfff6ea,2.4); key.position.set(-1.6,3.6,2.8); key.castShadow=true; key.shadow.mapSize.set(1536,1536);
  Object.assign(key.shadow.camera,{left:-1.5,right:1.5,top:1.5,bottom:-1.5,near:.5,far:9}); key.shadow.bias=-.0006; key.shadow.radius=5; S.add(key);
  S.add(new T.HemisphereLight(0xffffff,0x202220,.7));
  const rim=new T.DirectionalLight(0xdfeee0,.9); rim.position.set(2,1.4,-3); S.add(rim);

  const M={
    frame:new T.MeshStandardMaterial({color:0x565a56,metalness:.5,roughness:.5}),
    arm:new T.MeshStandardMaterial({color:0xd4d7d0,metalness:1,roughness:.22}),
    alloy:new T.MeshStandardMaterial({color:0xa9aea8,metalness:.85,roughness:.42}),
    rod:new T.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.08}),
    body:new T.MeshStandardMaterial({color:0x565b56,metalness:.9,roughness:.26}),
    perch:new T.MeshStandardMaterial({color:0xc9ccc6,metalness:1,roughness:.3}),
    joint:new T.MeshStandardMaterial({color:0xe9eae4,metalness:.9,roughness:.25}),
    spring:new T.MeshStandardMaterial({color:0x5cb85c,metalness:.25,roughness:.32,emissiveIntensity:.3}),
    disc:new T.MeshStandardMaterial({color:0x8d928d,metalness:1,roughness:.34}),
    cal:new T.MeshStandardMaterial({color:0x2c2f2c,metalness:.6,roughness:.4}),
    rim:new T.MeshStandardMaterial({color:0x9ca1a6,metalness:.95,roughness:.28}),
    rad:new T.MeshStandardMaterial({color:0x2a2d2a,metalness:.7,roughness:.5}),
    cap:new T.MeshStandardMaterial({color:0x2c2f2c,metalness:.85,roughness:.3}),
    res:new T.MeshStandardMaterial({color:0xc4c8c4,metalness:.95,roughness:.28}),
    hose:new T.MeshStandardMaterial({color:0x151615,metalness:.2,roughness:.55}),
    ring:new T.MeshBasicMaterial({color:0x7dcc7d}),
    warn:new T.MeshBasicMaterial({color:0xff5a45,transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide})
  };
  M.tyre=new T.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:.86,map:canvasTex(1024,64,(g,w,h)=>{
    g.fillStyle="#2a2d2a"; g.fillRect(0,0,w,h); g.strokeStyle="#0b0c0b"; g.lineWidth=7;
    for(let x=0;x<w;x+=34){ g.beginPath(); g.moveTo(x,10); g.lineTo(x+13,h-10); g.stroke(); } })});

  M.body.map=canvasTex(16,256,(g,w,h)=>{ g.fillStyle="#fff"; g.fillRect(0,0,w,h); g.fillStyle="#9a9a9a"; for(let y=0;y<h;y+=4) g.fillRect(0,y,w,2); }); M.body.map.repeat.set(1,9); M.body.color.set(0x8a8f8a);

  /* road: its own surface, moved under the car */
  const roadTex=canvasTex(512,512,(g,w,h)=>{ g.fillStyle="#3b3e3b"; g.fillRect(0,0,w,h); for(let i=0;i<26000;i++){ const b=30+Math.random()*62|0; g.fillStyle=`rgb(${b},${b},${b})`; g.fillRect(Math.random()*w,Math.random()*h,1.6,1.6); } });
  roadTex.repeat.set(5,8);
  const roadG=new T.PlaneGeometry(6,9.6,60,96); roadG.rotateX(-Math.PI/2);
  const road=new T.Mesh(roadG,new T.MeshStandardMaterial({map:roadTex,color:0x565856,roughness:.95,metalness:0})); road.receiveShadow=true; S.add(road);
  const rp=roadG.attributes.position;

  /* chassis */
  const chassis=new T.Group(); S.add(chassis);
  const P=(x,y,z)=>v(x,y,z), lowY=GEO.P1.y-.03, Rr=.0135;
  const bar=(a,b,r=Rr)=>{ const m=cyl(r,M.frame); place(m,a,b); chassis.add(m); return m; };
  [-1,1].forEach(sg=>{
    const low=P(sg*GEO.P1.x,lowY,0), mid=P(sg*GEO.P2.x,GEO.P2.y,0), top=P(sg*GEO.T.x,GEO.T.y,0), low2=P(sg*.26,lowY,-1.5), mid2=P(sg*.33,GEO.P2.y,-1.5), top2=P(sg*.31,.66,-1.5);
    bar(low,mid); bar(mid,top); bar(low,low2); bar(mid,mid2); bar(top,top2); bar(mid,low2,.014); bar(top,mid2,.014);
    bar(P(sg*GEO.P1.x,GEO.P1.y,-.17),P(sg*GEO.P1.x,GEO.P1.y,.17),.016); bar(P(sg*GEO.P2.x,GEO.P2.y,-.14),P(sg*GEO.P2.x,GEO.P2.y,.14),.016);
    bar(P(sg*GEO.P1.x,lowY,0),P(sg*GEO.P1.x,GEO.P1.y,.17),.012);
  });
  bar(P(-GEO.P1.x,lowY,0),P(GEO.P1.x,lowY,0)); bar(P(-GEO.T.x,GEO.T.y,0),P(GEO.T.x,GEO.T.y,0));
  const rad=new T.Mesh(new T.BoxGeometry(.3,.3,.05),M.rad); rad.position.set(0,.39,-.04); rad.castShadow=true; chassis.add(rad);
  for(let y=.26;y<.53;y+=.022){ const f=new T.Mesh(new T.BoxGeometry(.31,.006,.056),M.frame); f.position.set(0,y,-.04); chassis.add(f); }
  const rack=cyl(.016,M.alloy); place(rack,P(-.2,.3,.13),P(.2,.3,.13)); chassis.add(rack);

  /* remote reservoirs, fixed to the chassis, with a hose to the top of each damper */
  const reservoirs=[-1,1].map(sg=>{
    const r=new T.Group(), a=P(sg*.235,.56,-.1), b=P(sg*.235,.56,-.27), cA=cyl(.024,M.res,20), cB=cyl(.026,M.perch,20), cC=cyl(.026,M.perch,20);
    place(cA,a,b); place(cB,a,P(sg*.235,.56,-.118)); place(cC,P(sg*.235,.56,-.255),b); r.add(cA,cB,cC);
    const start=P(sg*GEO.T.x,GEO.T.y-.03,.03), hose=new T.CatmullRomCurve3([start,P(sg*(GEO.T.x+.015),GEO.T.y+.03,.06),P(sg*.31,.645,-.02),P(sg*.25,.6,-.06),a]);
    const h=new T.Mesh(new T.TubeGeometry(hose,40,.0058,8,false),M.hose); h.castShadow=true; r.add(h); r.visible=false; chassis.add(r); return r;
  });

  /* one corner */
  function makeCorner(sg){
    const c={sg};
    const arm=()=>{ const m=cyl(.0095,M.arm,12); S.add(m); return m; };
    c.lowA=arm(); c.lowB=arm(); c.upA=arm(); c.upB=arm(); c.track=arm();
    c.j=[0,1,2,3,4].map(()=>{ const b=ball(.021,M.joint); S.add(b); return b; });
    c.upright=cyl(.024,M.alloy); S.add(c.upright); c.stub=cyl(.02,M.alloy); S.add(c.stub);
    /* wheel */
    c.wheel=new T.Group(); S.add(c.wheel); c.spin=new T.Group(); c.wheel.add(c.spin);
    const W=GEO.tw/2, Rt=GEO.R, Rim=.168;
    const prof=[[Rim-.005,-W*.92],[Rt-.05,-W*.98],[Rt-.016,-W],[Rt-.002,-W*.9],[Rt,-W*.62],[Rt-.006,-W*.6],[Rt-.006,-W*.5],[Rt,-W*.48],[Rt,W*.48],[Rt-.006,W*.5],[Rt-.006,W*.6],[Rt,W*.62],[Rt-.002,W*.9],[Rt-.016,W],[Rt-.05,W*.98],[Rim-.005,W*.92]].map(p=>new T.Vector2(p[0],p[1]));
    const tyre=new T.Mesh(new T.LatheGeometry(prof,64),M.tyre); tyre.rotation.z=Math.PI/2; tyre.castShadow=true; c.spin.add(tyre);
    const barrel=new T.Mesh(new T.LatheGeometry([[Rim,-W*.9],[Rim-.02,-W*.82],[Rim-.03,0],[Rim-.02,W*.82],[Rim,W*.9]].map(p=>new T.Vector2(p[0],p[1])),48),new T.MeshStandardMaterial({color:0x9ca1a6,metalness:.95,roughness:.28,side:T.DoubleSide})); barrel.rotation.z=Math.PI/2; c.spin.add(barrel);
    const face=sg*W*.55;
    for(let i=0;i<6;i++){ const g=new T.Group(); g.rotation.x=i*Math.PI/3; const sp=new T.Mesh(new T.BoxGeometry(.016,Rim-.03,.042),M.rim); sp.position.set(face,(Rim-.03)/2,0); g.add(sp); c.spin.add(g); }
    const hubc=cyl(.05,M.rim,24); hubc.rotation.z=Math.PI/2; hubc.scale.y=.04; hubc.position.x=face; c.spin.add(hubc);
    const disc=cyl(.122,M.disc,40); disc.rotation.z=Math.PI/2; disc.scale.y=.012; disc.position.x=-sg*.012; c.spin.add(disc);
    const cal=new T.Mesh(new T.BoxGeometry(.05,.09,.075),M.cal); cal.position.set(-sg*.012,.0,-.11); cal.castShadow=true; c.wheel.add(cal);
    /* coilover */
    c.body=cyl(.024,M.body,20); S.add(c.body); c.rod=cyl(.008,M.rod); S.add(c.rod);
    c.collar=cyl(.031,M.perch,24); c.collar.scale.y=.012; S.add(c.collar);
    c.cap=cyl(.0265,M.cap,20); S.add(c.cap);
    c.knob1=cyl(.011,M.perch,14); c.knob2=cyl(.011,M.perch,14); S.add(c.knob1,c.knob2); c.knob1.visible=c.knob2.visible=false;
    c.eyeT=new T.Mesh(new T.TorusGeometry(.016,.0065,10,22),M.perch); c.eyeB=new T.Mesh(new T.TorusGeometry(.016,.0065,10,22),M.perch); c.eyeT.castShadow=c.eyeB.castShadow=true; S.add(c.eyeT,c.eyeB);
    { const g=new T.TorusGeometry(.066,.0042,8,48); g.rotateX(Math.PI/2); c.ring=new T.Mesh(g,M.ring); c.ring.visible=false; S.add(c.ring); }
    c.perchT=cyl(.041,M.perch,28); S.add(c.perchT); c.perchB=cyl(.041,M.perch,28); S.add(c.perchB);
    const coils=6, pts=[]; for(let i=0;i<=coils*22;i++){ const f=i/(coils*22), a=f*coils*Math.PI*2; pts.push(v(Math.cos(a)*.04,(f-.5)*SPRING_L,Math.sin(a)*.04)); }
    const curve=new T.CatmullRomCurve3(pts); c.spring=new T.Mesh(new T.TubeGeometry(curve,coils*44,.0078,8,false),M.spring); c.spring.castShadow=true; S.add(c.spring);
    c.patch=new T.Mesh(new T.PlaneGeometry(GEO.tw*1.1,.26),M.warn); c.patch.rotation.x=-Math.PI/2; S.add(c.patch);
    return c;
  }
  const corners=[makeCorner(-1),makeCorner(1)];
  const Q=new T.Quaternion(), tmp=new T.Vector3();

  function pose(data,i,iL,road,pos){
    const n=road.length, rd=q=>road[((Math.round(data.x[q])%n)+n)%n];
    const zsR=data.zs[i], zsL=data.zs[iL], mid=(zsR+zsL)/2*MAG, roll=(zsR-zsL)/2*MAG*.3, offs=[];
    chassis.position.y=mid; chassis.rotation.z=Math.atan2(roll,.67);
    const bo=(sg,x)=>mid+sg*roll*x/.67;
    corners.forEach(c=>{
      const sg=c.sg, q=sg>0?i:iL, zr=rd(q), lift=Math.max(0,data.zu[q]-data.d0-zr)*MAG, ground=zr*MAG, k=solveCorner(GEO.R+ground+lift,bo(sg,.3));
      const P3=(p,z)=>v(sg*p.x,p.y,z||0), b1=P3(k.B1), b2=P3(k.B2), hub=P3(k.H), p1=k.P1, p2=k.P2;
      place(c.lowA,P3(p1,.15),b1); place(c.lowB,P3(p1,-.15),b1); place(c.upA,P3(p2,.12),b2); place(c.upB,P3(p2,-.12),b2);
      place(c.upright,b1,b2); place(c.stub,b1.clone().lerp(b2,.5),hub);
      const steer=b1.clone().lerp(b2,.42); steer.z=.1; place(c.track,v(sg*.2,.3+mid,.13),steer);
      [P3(p1,.15),P3(p1,-.15),b1,b2,P3(p2,.12)].forEach((a,n)=>c.j[n].position.copy(a));
      c.wheel.position.copy(hub); c.wheel.rotation.z=-sg*k.tilt; c.spin.rotation.x=(pos*2/ROAD_K)/GEO.R;
      /* coilover: body fixed at the chassis, rod fixed at the wishbone, spring between the perches */
      const lm=P3({x:k.P1.x+(k.B1.x-k.P1.x)*GEO.mount,y:k.P1.y+(k.B1.y-k.P1.y)*GEO.mount}), top=v(sg*GEO.T.x,GEO.T.y+bo(sg,GEO.T.x)), ax=top.clone().sub(lm), len=ax.length(); ax.divideScalar(len);
      const at=d=>lm.clone().addScaledVector(ax,d);
      place(c.body,top,at(len-.24)); place(c.rod,lm,at(len-.2));
      place(c.collar,at(len-.245),at(len-.235));
      place(c.cap,top,at(len-.032)); c.eyeT.position.copy(top); c.eyeB.position.copy(lm);
      { const a=at(len-.016), b=at(len-.05); place(c.knob1,a,a.clone().add(v(0,0,.046))); place(c.knob2,b,b.clone().add(v(-sg*.046,0,0))); }
      c.ring.visible=scanT!==null; if(scanT!==null){ c.ring.position.copy(at(len*(1-scanT))); c.ring.quaternion.setFromUnitVectors(UP,ax); }
      const pb=.07, pt=len-.055; place(c.perchB,at(pb),at(pb+.007)); place(c.perchT,at(pt),at(pt+.007));
      c.spring.position.copy(at((pb+pt)/2)); c.spring.quaternion.setFromUnitVectors(UP,ax); c.spring.scale.set(1,(pt-pb)/SPRING_L,1);
      const off=lift>.006; c.patch.visible=off;
      c.patch.position.set(sg*GEO.H.x,ground+.012,0);
      offs.push({on:off,sg,p:v(hub.x,hub.y+GEO.R+.02,0)});
      tyreEdge(c,off);
    });
    return offs;
  }
  function tyreEdge(c,off){ c.patch.material.opacity=off?.5:0; }

  function updateRoad(pos,N,iLoff,road){
    const n=road.length, idx=(pos|0)*2;
    for(let k=0;k<rp.count;k++){
      const x=rp.getX(k), z=rp.getZ(k), t=Math.max(0,Math.min(1,(x+.35)/.7)), a=Math.round(z*ROAD_K);
      const hR=road[(((idx+a)%n)+n)%n], hL=road[(((idx+iLoff*2+a)%n)+n)%n];
      rp.setY(k,(hL+(hR-hL)*t)*MAG);
    }
    rp.needsUpdate=true; roadG.computeVertexNormals();
    roadTex.offset.y=(pos*2/ROAD_K)/9.6*8%1;
  }

  let W=0,H=0,D=1,span=[0,0],scanT=null,kit=null;
  const off=new T.Vector3(), tgt=new T.Vector3();
  const api={
    /* k: {body,trim,cap,res,spring,knobs,reservoir} as colours, or null for the plain damper */
    setKit(k){ kit=k;
      M.body.color.set(k?k.body:0x8a8f8a); M.perch.color.set(k?k.trim:0xc9ccc6); M.cap.color.set(k?k.cap:0x2c2f2c); M.res.color.set(k?k.res:0xc4c8c4);
      corners.forEach(c=>{ c.knob1.visible=!!k&&k.knobs>0; c.knob2.visible=!!k&&k.knobs>1; });
      reservoirs.forEach(r=>r.visible=!!k&&k.reservoir); },
    scan(t){ scanT=t; },
    /* A slower device gets fewer pixels and no moving shadows. */
    lighten(){ R.shadowMap.autoUpdate=false; key.castShadow=false; api.maxDpr=1; R.setPixelRatio(1); D=1; R.setSize(W,H,false); },
    /* view: {az,el,dist,tx,ty,tz,sx,fit}. fit is the width in metres to fill roomW; sx is where the target sits on screen */
    view(w,h,dpr,c,roomW,traceH,drop=0){
      dpr=Math.min(dpr,api.maxDpr); if(w!==W||h!==H||dpr!==D){ W=w;H=h;D=dpr; R.setPixelRatio(dpr); R.setSize(w,h,false); }
      C.aspect=w/h;
      const vf=2*Math.tan(C.fov*Math.PI/360), hw=vf*(roomW/h), base=Math.max(1.86/hw,.92/vf);
      const d=base*c.dist, ce=Math.cos(c.el);
      tgt.set(c.tx,c.ty,c.tz); off.set(Math.sin(c.az)*ce,Math.sin(c.el),Math.cos(c.az)*ce).multiplyScalar(d);
      C.position.copy(tgt).add(off); C.lookAt(tgt);
      C.setViewOffset(w,h,w/2-c.sx,-h*.04-drop,w,h); C.updateProjectionMatrix(); C.updateMatrixWorld();
      const sx=p=>(tmp.copy(p).project(C).x+1)/2*w;
      span=[Math.max(0,sx(v(-.78,.27,0))),Math.min(w-4,sx(v(.78,.27,0)))];
      return span;
    },
    render(layers,i,iL,road,pos,N){
      updateRoad(pos,N,iL-i,road); const marks=[];
      R.clear();
      layers.forEach(l=>{
        const offs=pose(l.data,i,iL,road,pos), sc=kit?kit.spring:l.col; M.spring.color.set(sc); M.spring.emissive.set(sc); M.spring.emissiveIntensity=kit?.05:.3;
        const x=Math.round(l.a), wd=Math.round(l.b-l.a); if(wd<=0) return;
        R.setScissor(x,0,wd,H); R.setViewport(0,0,W,H); R.render(S,C);
        offs.forEach(o=>{ if(!o.on) return; tmp.copy(o.p).project(C); marks.push({x:(tmp.x+1)/2*W,y:(1-tmp.y)/2*H,sg:o.sg,a:l.a,b:l.b}); });
      });
      return marks;
    }
  };
  api.maxDpr=2;
  return api;
}
window.Axle3D={init};
})();
