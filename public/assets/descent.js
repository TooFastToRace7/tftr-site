/* The damper, opened on request. Nothing here moves until the visitor presses the button.
   Page-local. All copy is real markup in the section. Illustration, not a simulation. */
(function () {
  'use strict';
  var sec = document.getElementById('descent');
  if (!sec || !sec.classList.contains('dsc-live')) return;
  var T = window.THREE;
  var stage = sec.querySelector('.dsc-stage'), canvas = sec.querySelector('.dsc-gl');
  var openBtn = sec.querySelector('.dsc-open'), closeBtn = sec.querySelector('.dsc-close'), pauseBtn = sec.querySelector('.dsc-pause'), panel = sec.querySelector('.dsc-panel');
  var steps = [].slice.call(sec.querySelectorAll('.dsc-step')), chips = [].slice.call(sec.querySelectorAll('.dsc-chips button')), hits = [].slice.call(sec.querySelectorAll('[data-hit]'));
  var liveW = sec.querySelector('.dsc-live-word'), liveS = sec.querySelector('.dsc-live-sub');
  var tags = [].slice.call(sec.querySelectorAll('.dsc-tag'));
  panel.hidden = true;
  var restText = liveS.textContent;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ss(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- machined solids, each with a lathe skin and two section faces ---------- */
  var SPRING_L = 3.5;
  var R, S, C, ROOT, planes, secs = [], wedge = 0, A = {};
  var CUT = { n1: null, n2: null };
  function bevel(p, b) {
    var o = [], n = p.length;
    for (var i = 0; i < n; i++) {
      var a = p[(i + n - 1) % n], c = p[i], d = p[(i + 1) % n];
      var la = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1, ld = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, e = Math.min(b, la * .3, ld * .3);
      o.push([c[0] + (a[0] - c[0]) / la * e, c[1] + (a[1] - c[1]) / la * e]);
      o.push([c[0] + (d[0] - c[0]) / ld * e, c[1] + (d[1] - c[1]) / ld * e]);
    }
    return o;
  }
  function shapeOf(p) { var s = new T.Shape(); p.forEach(function (q, i) { if (i) s.lineTo(q[0], q[1]); else s.moveTo(q[0], q[1]); }); s.closePath(); return s; }
  function hole(p) { var h = new T.Path(); p.forEach(function (q, i) { if (i) h.lineTo(q[0], q[1]); else h.moveTo(q[0], q[1]); }); h.closePath(); return h; }
  function solid(parent, prof, mat, face, opt) {
    opt = opt || {};
    var g = new T.Group(), b = bevel(prof, opt.bevel == null ? .006 : opt.bevel), pts = b.concat([b[0]]).map(function (q) { return new T.Vector2(Math.max(q[0], .0001), q[1]); });
    var lathe = new T.LatheGeometry(pts, opt.seg || 96);
    var m = new T.Mesh(lathe, mat); g.add(m);
    [0, 1].forEach(function (k) {
      var sh = shapeOf(prof), hs = opt.holes && opt.holes[k]; if (hs) hs.forEach(function (h) { sh.holes.push(hole(h)); });
      var s = new T.Mesh(new T.ShapeGeometry(sh), face); s.userData.side = k; s.visible = false; g.add(s); secs.push(s);
    });
    parent.add(g); return g;
  }
  function setWedge(a) {
    wedge = a;
    var c = Math.cos(a), s = Math.sin(a);
    planes[0].normal.set(c, 0, -s); planes[1].normal.set(-c, 0, -s);
    secs.forEach(function (m) {
      m.visible = a > .015;
      m.rotation.y = (m.userData.side ? -Math.PI / 2 - a : a - Math.PI / 2) + (m.userData.back ? (m.userData.side ? -.03 : .03) : 0);
    });
  }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; }
  function studio(r) {
    var e = new T.Scene(), add = function (w, h, x, y, z, c, i) { var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); e.add(m); };
    e.background = new T.Color(0x050605);
    add(6, 12, -7, 2, 5, 0xffffff, 5); add(3, 12, 7, 0, 3, 0xdfe8e0, 3); add(12, 3, 0, 8, 1, 0xffffff, 3.2); add(2, 10, 3, 0, -8, 0xcfe6d0, 2.4); add(10, 2, 0, -7, 3, 0x9aa39b, 1.2);
    var p = new T.PMREMGenerator(r), t = p.fromScene(e, .03).texture; p.dispose(); return t;
  }

  /* moving parts, with shim stacks that really bend */
  var shims = [];
  function shim(parent, y, R0, t, dir, mat, face) {
    var st = [.078, .1, .12, .14, .16, R0].filter(function (r) { return r <= R0; }), top = st.map(function (r) { return [r, y + t]; }), bot = st.slice().reverse().map(function (r) { return [r, y]; }), prof = top.concat(bot);
    var g = solid(parent, prof, mat, face, { bevel: 0, seg: 72 });
    var parts = g.children.map(function (m) { var a = m.geometry.attributes.position; return { m: m, a: a, y0: Float32Array.from(a.array) }; });
    shims.push({ parts: parts, R: R0, dir: dir });
  }
  function bend(lift) {
    shims.forEach(function (s) {
      var L = lift[s.dir < 0 ? 0 : 1] * s.R / .172;
      s.parts.forEach(function (p) {
        var a = p.a.array, y0 = p.y0, sec = p.m.geometry.type === 'ShapeGeometry';
        for (var i = 0; i < a.length; i += 3) {
          var r = sec ? y0[i] : Math.hypot(y0[i], y0[i + 2]), k = clamp((r - .08) / (s.R - .08), 0, 1);
          a[i + 1] = y0[i + 1] + s.dir * L * k * k;
        }
        p.a.needsUpdate = true;
      });
    });
  }

  function build() {
    R = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.localClippingEnabled = true; R.setClearColor(0, 0);
    S = new T.Scene(); S.environment = studio(R);
    C = new T.PerspectiveCamera(28, 1, .05, 60);
    var key = new T.DirectionalLight(0xfff6ea, 1.6); key.position.set(-3, 4, 5); S.add(key);
    var rim = new T.DirectionalLight(0xdff0e0, 1.1); rim.position.set(4, 1, -3); S.add(rim);
    var inner = new T.PointLight(0xfff0d8, 1.6, 3.2, 1.6); inner.position.set(0, .5, 1.1); S.add(inner); A.inner = inner;
    planes = [new T.Plane(new T.Vector3(1, 0, 0), 0), new T.Plane(new T.Vector3(-1, 0, 0), 0)];
    function M(o, cut) { var m = new T.MeshStandardMaterial(o); if (cut !== false) { m.clippingPlanes = planes; m.clipIntersection = true; } return m; }
    var stripes = canvasTex(16, 256, function (g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#7d7d7d'; for (var y = 0; y < h; y += 4) g.fillRect(0, y, w, 2); }); stripes.wrapS = stripes.wrapT = T.RepeatWrapping; stripes.repeat.set(1, 26);
    var mt = {
      body: M({ color: 0x2c302c, metalness: .95, roughness: .34, side: T.DoubleSide }), inner: M({ color: 0x8a8f89, metalness: 1, roughness: .28, side: T.BackSide }),
      thread: M({ color: 0x8f948e, metalness: 1, roughness: .32, map: stripes, side: T.DoubleSide }), cap: M({ color: 0x1b1e1b, metalness: .9, roughness: .3, side: T.DoubleSide }),
      steel: M({ color: 0xc9cdc6, metalness: 1, roughness: .2, side: T.DoubleSide }), chrome: M({ color: 0xffffff, metalness: 1, roughness: .07, side: T.DoubleSide }),
      piston: M({ color: 0xb4b9b2, metalness: 1, roughness: .26, side: T.DoubleSide }), shim: M({ color: 0xe6e8e2, metalness: 1, roughness: .16, emissive: 0x5cb85c, emissiveIntensity: 0, side: T.DoubleSide }),
      band: M({ color: 0x1a1c1a, metalness: .1, roughness: .6, side: T.DoubleSide }), spring: M({ color: 0x5cb85c, metalness: .3, roughness: .34, side: T.DoubleSide })
    };
    var hatch = canvasTex(64, 64, function (g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6f746e'; g.lineWidth = 5; g.beginPath(); for (var q = -64; q <= 128; q += 32) { g.moveTo(q, 64); g.lineTo(q + 64, 0); } g.stroke(); }); hatch.wrapS = hatch.wrapT = T.RepeatWrapping; hatch.repeat.set(30, 30);
    var fc = { steel: new T.MeshStandardMaterial({ color: 0xb6bbb3, map: hatch, metalness: .35, roughness: .55, side: T.DoubleSide }), dark: new T.MeshStandardMaterial({ color: 0x8c918b, map: hatch, metalness: .3, roughness: .6, side: T.DoubleSide }), shim: new T.MeshStandardMaterial({ color: 0xf4f5f1, metalness: .4, roughness: .3, emissive: 0x5cb85c, emissiveIntensity: 0, side: T.DoubleSide }), band: new T.MeshStandardMaterial({ color: 0x20231f, roughness: .7, side: T.DoubleSide }) };
    A.mt = mt; A.fc = fc;

    ROOT = new T.Group(); S.add(ROOT);
    /* fixed: body, cap, gland, top perch */
    solid(ROOT, [[.205, -.52], [.24, -.52], [.24, 1.95], [.205, 1.95]], mt.body, fc.dark);
    solid(ROOT, [[.0, 1.93], [.262, 1.93], [.262, 2.2], [.13, 2.27], [.0, 2.27]], mt.cap, fc.dark);
    solid(ROOT, [[.075, -.56], [.262, -.56], [.262, -.5], [.204, -.5], [.204, -.32], [.075, -.32]], mt.cap, fc.dark);
    solid(ROOT, [[.245, 1.6], [.43, 1.6], [.43, 1.66], [.3, 1.74], [.245, 1.74]], mt.steel, fc.steel);
    var th = new T.Mesh(new T.CylinderGeometry(.2425, .2425, 1.5, 96, 1, true), mt.thread); th.position.y = .78; ROOT.add(th);
    var inn = new T.Mesh(new T.CylinderGeometry(.2045, .2045, 2.3, 96, 1, true), mt.inner); inn.position.y = .8; ROOT.add(inn);
    var eyeT = new T.Mesh(new T.TorusGeometry(.13, .045, 16, 48), mt.steel); eyeT.position.y = 2.45; ROOT.add(eyeT); var neck = solid(ROOT, [[0, 2.26], [.075, 2.26], [.075, 2.36], [0, 2.36]], mt.steel, fc.steel);
    /* adjuster */
    var knob = new T.Group(); knob.position.set(.33, 2.08, 0); ROOT.add(knob);
    var kB = new T.Mesh(new T.CylinderGeometry(.11, .11, .1, 32), mt.cap); kB.rotation.z = Math.PI / 2; knob.add(kB);
    for (var i = 0; i < 18; i++) { var r = new T.Mesh(new T.BoxGeometry(.11, .012, .012), mt.steel); var an = i / 18 * Math.PI * 2; r.position.set(0, Math.cos(an) * .112, Math.sin(an) * .112); knob.add(r); }
    A.knob = knob;
    /* oil: section fill and the volume seen against the far wall */
    A.oilS = []; var OIL_B = -.32; A.oilB = OIL_B;
    var oilMat = new T.MeshBasicMaterial({ color: 0x7a4f12, transparent: true, opacity: .62, depthWrite: false, side: T.DoubleSide });
    [0, 1].forEach(function (k) { var s = new T.Mesh(new T.PlaneGeometry(.135, 1), oilMat); s.geometry.translate(.1375, .5, 0); s.position.y = OIL_B; s.userData.side = k; s.userData.back = 1; s.visible = false; s.renderOrder = 1; ROOT.add(s); secs.push(s); A.oilS.push(s); });
    var oilV = new T.MeshBasicMaterial({ color: 0x5a3a0e, transparent: true, opacity: .5, depthWrite: false, side: T.BackSide, clippingPlanes: planes, clipIntersection: true });
    var oilC = new T.Mesh(new T.CylinderGeometry(.204, .204, 1, 96, 1, true), oilV); oilC.geometry.translate(0, .5, 0); oilC.position.y = OIL_B; A.oilS.push(oilC); oilC.renderOrder = 1; ROOT.add(oilC); A.oil = oilMat; A.oilV = oilV;
    /* floating piston */
    A.floatP = solid(ROOT, [[0, -.05], [.204, -.05], [.204, .05], [0, .05]], mt.piston, fc.steel);
    /* moving: rod, piston, shims, nut, bottom eye, bottom perch */
    var mv = new T.Group(); ROOT.add(mv); A.mv = mv;
    solid(mv, [[0, -2.0], [.07, -2.0], [.07, .21], [0, .21]], mt.chrome, fc.steel, { bevel: .003, seg: 64 });
    /* the piston: angled ports, compression on one section and rebound on the other, as they alternate round a real piston */
    var pr = [[.07, -.085], [.203, -.085], [.203, .085], [.07, .085]];
    var cPort = [[.17, .085], [.196, .085], [.145, -.085], [.106, -.085]];  /* in at the top rim, out under the compression stack */
    var rPort = [[.106, .085], [.145, .085], [.196, -.085], [.17, -.085]];  /* in at the bottom rim, out under the rebound stack */
    solid(mv, pr, mt.piston, fc.steel, { holes: [[cPort], [rPort]], bevel: .004 });
    solid(mv, [[.198, -.03], [.2045, -.03], [.2045, .03], [.198, .03]], mt.band, fc.band, { bevel: 0 });
    var y = -.1; [[.172, .012], [.15, .012], [.125, .012], [.1, .012]].forEach(function (d) { shim(mv, y, d[0], d[1], -1, mt.shim, fc.shim); y -= d[1] + .002; });  /* compression stack, underside */
    y = .088; [[.172, .012], [.15, .012], [.125, .012], [.1, .012]].forEach(function (d) { shim(mv, y, d[0], d[1], 1, mt.shim, fc.shim); y += d[1] + .002; });    /* rebound stack, top */
    solid(mv, [[.07, .15], [.098, .15], [.098, .205], [.07, .205]], mt.steel, fc.steel);
    solid(mv, [[.07, -.205], [.098, -.205], [.098, -.15], [.07, -.15]], mt.steel, fc.steel);
    var eyeB = new T.Mesh(new T.TorusGeometry(.13, .045, 16, 48), mt.steel); eyeB.position.y = -2.2; mv.add(eyeB);
    solid(mv, [[.07, -2.0], [.43, -2.0], [.43, -1.94], [.2, -1.86], [.07, -1.86]], mt.steel, fc.steel);
    var lo = new T.Mesh(new T.CylinderGeometry(.075, .075, .16, 32), mt.steel); lo.position.y = -2.06; mv.add(lo);
    /* spring */
    var pts = [], coils = 7.5; for (i = 0; i <= 480; i++) { var f = i / 480, a2 = f * coils * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a2) * .385, (f - .5) * SPRING_L, Math.sin(a2) * .385)); }
    var sp = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 900, .05, 14, false), mt.spring); ROOT.add(sp); A.spring = sp;
    /* oil moving through the ports */
    var N = 120, geo = new T.BufferGeometry(); A.pPos = new Float32Array(N * 3); geo.setAttribute('position', new T.BufferAttribute(A.pPos, 3));
    var pm = new T.PointsMaterial({ color: 0xffe3a8, size: .0125, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    var pts3 = new T.Points(geo, pm); pts3.frustumCulled = false; pts3.renderOrder = 3; ROOT.add(pts3); A.pm = pm;
    A.seed = []; for (i = 0; i < N; i++) A.seed.push({ t: Math.random(), a: Math.random(), b: Math.random(), s: i % 2 });
    setWedge(0);
  }

  /* ---------- the five chapters ---------- */
  var CH = [
    { ms: 6000, wedge: 0, tags: 0, drive: 'breathe', w: { pos: [0, .2, 12], tgt: [0, .1, 0], sx: .2, sy: -.015 }, p: { pos: [0, .35, 16], tgt: [0, .1, 0], sx: 0, sy: .17 } },
    { ms: 7000, wedge: .92, tags: 0, drive: 'breathe', w: { pos: [2.0, .9, 6.6], tgt: [0, .5, 0], sx: .2, sy: .02 }, p: { pos: [2.8, .9, 12], tgt: [0, .5, 0], sx: 0, sy: .21 } },
    { ms: 6000, wedge: .92, tags: 1, drive: 'still', w: { pos: [.55, .66, 2.5], tgt: [0, .52, 0], sx: .2, sy: 0 }, p: { pos: [.75, .66, 3.7], tgt: [0, .52, 0], sx: 0, sy: .27 } },
    { ms: 11000, wedge: .92, tags: 1, drive: 'hits', w: { pos: [.42, .6, 1.95], tgt: [0, .52, 0], sx: .2, sy: 0 }, p: { pos: [.6, .6, 3.0], tgt: [0, .52, 0], sx: 0, sy: .27 } },
    { ms: 0, wedge: .92, tags: 0, drive: 'still', w: { pos: [1.9, .5, 8.6], tgt: [0, .2, 0], sx: .2, sy: .01 }, p: { pos: [2.6, .5, 15], tgt: [0, .2, 0], sx: 0, sy: .22 } }
  ];
  /* the shut damper, framed to the short section */
  function rest() {
    var phone = W / H < .85, k = H / closedH();
    return phone ? { pos: [0, -.1, 13.5 * k * .78], tgt: [0, -.1, 0], sx: .24, sy: .5 - (closedH() * .72) / H, lean: -.5, wedge: 0, tags: 0 }
      : { pos: [0, .1, 10.6 * k * .94], tgt: [0, .1, 0], sx: .22, sy: .5 - closedH() / (2 * H), lean: -.14, wedge: 0, tags: 0 };
  }
  function target(i) {
    if (i < 0) return rest();
    var c = CH[i], k = W / H < .85 ? c.p : c.w;
    return { pos: k.pos, tgt: k.tgt, sx: k.sx, sy: k.sy, lean: 0, wedge: c.wedge, tags: c.tags };
  }
  function closedH() { return sec.classList.contains('dsc-open-now') ? closedPx : (closedPx = stage.offsetHeight || closedPx); }
  var closedPx = 560, cur = null, from = null, to = null, tw = 1, TW = 1.5;
  function snap(o) { return { pos: o.pos.slice(), tgt: o.tgt.slice(), sx: o.sx, sy: o.sy, lean: o.lean, wedge: o.wedge, tags: o.tags }; }
  function mix(a, b, t) {
    var l = function (u, v) { return u + (v - u) * t; };
    return { pos: [l(a.pos[0], b.pos[0]), l(a.pos[1], b.pos[1]), l(a.pos[2], b.pos[2])], tgt: [l(a.tgt[0], b.tgt[0]), l(a.tgt[1], b.tgt[1]), l(a.tgt[2], b.tgt[2])], sx: l(a.sx, b.sx), sy: l(a.sy, b.sy), lean: l(a.lean, b.lean), wedge: l(a.wedge, b.wedge), tags: l(a.tags, b.tags) };
  }
  function moveTo(o, secs) { from = snap(cur); to = o; tw = 0; TW = secs; }

  /* ---------- a stroke of the shaft, slow bump or sharp kerb ---------- */
  var shaft = { x: .34, v: 0, flow: 0, lift: [0, 0] }, W = 0, H = 0, D = 1, ready = false, last = 0, seen = false, shown = {}, stroke = null, tau = 0;
  var STROKE = { slow: { in: 1.5, top: .74, hold: .35, out: 2 }, kerb: { in: .14, top: .98, hold: .08, out: 1.5 } };
  function strokeX(s, t) {
    var c = STROKE[s.k];
    if (t < c.in) return s.x0 + (c.top - s.x0) * ss(0, c.in, t);
    if (t < c.in + c.hold) return c.top;
    return c.top + (.34 - c.top) * ss(0, c.out, t - c.in - c.hold);
  }
  function hit(k) { stroke = { k: k, t: 0, x0: shaft.x }; }
  function stepShaft(dt, drive) {
    var nx = shaft.x;
    tau += dt;
    if (stroke) { stroke.t += dt; var c = STROKE[stroke.k]; nx = strokeX(stroke, stroke.t); if (stroke.t > c.in + c.hold + c.out) stroke = null; }
    else if (drive === 'breathe') nx = .34 + .16 * Math.sin(tau * 1.5);
    else nx = shaft.x + (.34 - shaft.x) * clamp(dt * 3, 0, 1);
    shaft.v = (nx - shaft.x) / Math.max(dt, .001); shaft.x = nx;
    var v = shaft.v, gain = stroke ? 1.7 : .9;
    shaft.flow = clamp(v * gain, -1, 1);
    var want = [v > .02 ? clamp((v - .3) * .05, .006, .06) : 0, v < -.02 ? clamp((-v - .3) * .05, .006, .06) : 0];
    shaft.lift[0] += (want[0] - shaft.lift[0]) * clamp(dt * 18, 0, 1); shaft.lift[1] += (want[1] - shaft.lift[1]) * clamp(dt * 18, 0, 1);
    return Math.abs(v) > 1.05;
  }
  function paintShaft(dt) {
    var s = shaft, x = s.x, up = .55 * (x - .34);
    A.mv.position.y = .34 + up;
    A.floatP.position.y = 1.5 + .1 * x;
    /* the oil always fills right up to the separating piston */
    var oilLen = A.floatP.position.y - .05 - A.oilB; A.oilS.forEach(function (m) { m.scale.y = oilLen; });
    var bot = -1.86 + A.mv.position.y, top = 1.6, sp = A.spring; sp.scale.y = (top - bot) / SPRING_L; sp.position.y = (top + bot) / 2;
    bend(s.lift || shaft.lift);
    var hi = Math.max(s.lift ? s.lift[0] : 0, s.lift ? s.lift[1] : 0) / .06;
    A.mt.shim.emissiveIntensity = A.fc.shim.emissiveIntensity = hi * .9;
    /* particles run in the plane of each section, through the matching port */
    var flow = s.flow || 0, py = A.mv.position.y, a = wedge - .03, dA = [Math.sin(a), Math.cos(a)], dB = [-Math.sin(a), Math.cos(a)], pos = A.pPos, spd = Math.abs(flow);
    for (var i = 0; i < A.seed.length; i++) {
      var o = A.seed[i], d = o.s ? dB : dA, comp = !o.s, active = comp ? flow > .01 : flow < -.01;
      if (active) o.t = (o.t + dt * (.5 + spd * 2.4)) % 1;
      var t = comp ? o.t : 1 - o.t, r, y;      /* t runs top to bottom */
      var rimR = .183, outR = .125, topY = py + .085, botY = py - .085;
      if (comp) {
        if (t < .42) { var f = t / .42; r = .08 + o.a * .115 + (rimR - .08 - o.a * .115) * f * f; y = Math.min(1.42, py + .86 * o.b + .1) + (topY - Math.min(1.42, py + .86 * o.b + .1)) * f; }
        else if (t < .58) { var g = (t - .42) / .16; r = rimR + (outR - rimR) * g; y = topY + (botY - topY) * g; }
        else { var h = (t - .58) / .42; r = outR + (.08 + o.a * .115 - outR) * Math.sqrt(h); y = botY - .02 + (Math.max(-.3, py - .75 * o.b - .1) - botY) * h; }
      } else {
        if (t < .42) { var f2 = t / .42; r = .08 + o.a * .115 + (outR - .08 - o.a * .115) * (1 - (1 - f2) * (1 - f2)); y = Math.min(1.42, py + .86 * o.b + .1) + (topY + .02 - Math.min(1.42, py + .86 * o.b + .1)) * f2; }
        else if (t < .58) { var g2 = (t - .42) / .16; r = outR + (rimR - outR) * g2; y = topY + (botY - topY) * g2; }
        else { var h2 = (t - .58) / .42; r = rimR + (.08 + o.a * .115 - rimR) * h2 * h2; y = botY + (Math.max(-.3, py - .75 * o.b - .1) - botY) * h2; }
      }
      pos[i * 3] = d[0] * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = d[1] * r;
    }
    A.pPos.needsUpdate = true; A.pm.geometry; ROOT.children.forEach(function (c) { if (c.isPoints) c.geometry.attributes.position.needsUpdate = true; });
    A.pm.opacity = wedge > .2 ? Math.min(1, spd * 3 + .0) * .95 : 0;
    A.knob.rotation.x += 0;
  }


  function tagsAt(o) {
    var v = new T.Vector3(), a = wedge - .08, py = A.mv.position.y;
    var pts = { reb: [.15, py + .135, 1], piston: [.19, py, 1], comp: [.15, py - .145, 1], oil: [.14, py + .55, -1], gas: [.14, 1.7, -1] };
    tags.forEach(function (t) {
      var q = pts[t.dataset.tag], sg = q[2]; v.set(sg * Math.sin(a) * q[0], q[1], Math.cos(a) * q[0]).applyMatrix4(ROOT.matrixWorld).project(C);
      t.style.opacity = o.toFixed(3); t.style.visibility = o < .02 ? 'hidden' : 'visible';
      t.style.transform = 'translate(' + ((v.x + 1) / 2 * W).toFixed(1) + 'px,' + ((1 - v.y) / 2 * H).toFixed(1) + 'px)';
    });
  }
  function liveCopy(fast, flow) {
    var dir = flow > .05 ? 'c' : flow < -.05 ? 'r' : '', key = dir + (fast ? 'f' : 's');
    if (key === shown.live) return; shown.live = key;
    var c = { cs: ['Compression, low speed', 'Body movement: roll, dive and squat.'], cf: ['Compression, high speed', 'Sharp inputs from the surface, such as kerbs and sharp-edged bumps.'], rs: ['Rebound', 'The spring releasing the energy it has just stored.'], rf: ['Rebound', 'The spring releasing the energy it has just stored.'] }[key];
    sec.dataset.live = dir ? key : '';
    if (c) { liveW.textContent = c[0]; liveS.textContent = c[1]; }
  }

  /* ---------- the chapters, played by the clock, not the scroll wheel ---------- */
  var ch = -1, playing = false, elapsed = 0, isOpen = false, closing = false, fired = 0;
  function show(i) {
    ch = i; elapsed = 0; fired = 0; stroke = null;
    if (i === 3) { shown.live = null; sec.dataset.live = ''; liveW.textContent = 'At rest'; liveS.textContent = restText; }
    steps.forEach(function (s, k) { var on = k === i; s.classList.toggle('on', on); s.setAttribute('aria-hidden', on ? 'false' : 'true'); s.inert = !on; });
    chips.forEach(function (c, k) { c.classList.toggle('on', k === i); c.classList.toggle('past', k < i); if (k === i) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); c.style.setProperty('--fill', k < i ? 1 : 0); });
    moveTo(target(i), 1.5);
    if (i === CH.length - 1) setPlaying(false, true);
    sec.dataset.ch = i;
  }
  function setPlaying(v, ended) {
    playing = v; pauseBtn.textContent = v ? 'Pause' : ended ? 'Replay' : 'Play'; pauseBtn.dataset.ended = ended ? '1' : '';
  }
  function openIt() {
    if (!ready) start();
    isOpen = true; closing = false; sec.classList.add('dsc-open-now'); openBtn.setAttribute('aria-expanded', 'true'); panel.hidden = false;
    sizeOpen();
    stage.style.height = closedPx + 'px'; stage.offsetHeight; stage.style.height = 'var(--dsc-h)';
    var top = sec.getBoundingClientRect().top + scrollY - headerH();
    window.scrollTo({ top: top, behavior: 'smooth' });
    setPlaying(true); show(0); run();
    closeBtn.focus({ preventScroll: true });
  }
  function closeIt() {
    isOpen = false; closing = true; setPlaying(false); stroke = null; ch = -1;
    sec.classList.remove('dsc-open-now'); openBtn.setAttribute('aria-expanded', 'false');
    stage.style.height = closedPx + 'px';
    moveTo(rest(), .7); run();
    setTimeout(function () { panel.hidden = true; stage.style.height = ''; steps.forEach(function (s) { s.classList.remove('on'); }); }, 460);
    openBtn.focus({ preventScroll: true });
    var r = sec.getBoundingClientRect(); if (r.top < 0) window.scrollTo({ top: r.top + scrollY - headerH(), behavior: 'smooth' });
  }
  function headerH() { var h = document.querySelector('.site-header'); return h && getComputedStyle(h).position !== 'static' ? h.offsetHeight : 0; }
  function sizeOpen() { sec.style.setProperty('--dsc-h', Math.round(clamp(innerHeight - headerH(), 480, 940)) + 'px'); }

  /* ---------- one frame ---------- */
  function view() {
    var w = stage.clientWidth, h = Math.round(clamp(innerHeight - headerH(), 480, 940)), d = LOW ? 1 : Math.min(devicePixelRatio || 1, 2);
    if (w !== W || h !== H || d !== D) { W = w; H = h; D = d; R.setPixelRatio(d); R.setSize(w, h, false); C.aspect = w / h; if (cur && !isOpen && !closing) { cur = snap(rest()); } }
    if (!cur) cur = snap(rest());
    C.position.set(cur.pos[0], cur.pos[1], cur.pos[2]); C.lookAt(cur.tgt[0], cur.tgt[1], cur.tgt[2]);
    C.setViewOffset(w, h, -cur.sx * w, cur.sy * h, w, h); C.updateProjectionMatrix(); C.updateMatrixWorld();
    ROOT.rotation.z = cur.lean; ROOT.updateMatrixWorld(true);
  }
  var LOW = false, slowN = 0, slowT = 0, slowDone = false;
  function slow(dt) { if (slowDone) return; slowT += dt; if (++slowN === 60) { if (slowT / 60 > .03) { slowDone = true; LOW = true; } slowT = slowN = 0; } }
  function draw(dt) {
    if (!cur) view();
    if (tw < 1) { tw = Math.min(1, tw + dt / TW); cur = mix(from, to, ss(0, 1, tw)); }
    var c = ch >= 0 ? CH[ch] : null;
    if (playing && c && c.ms) {
      elapsed += dt * 1000;
      if (c.drive === 'hits') { if (fired === 0 && elapsed > 1800) { fired = 1; hit('slow'); } if (fired === 1 && elapsed > 6800) { fired = 2; hit('kerb'); } }
      chips[ch].style.setProperty('--fill', Math.min(1, elapsed / c.ms).toFixed(3));
      if (elapsed >= c.ms) show(ch + 1);
    }
    var fast = stepShaft(dt, c ? c.drive : 'still');
    setWedge(cur.wedge);
    view(); paintShaft(dt); R.render(S, C);
    tagsAt(cur.tags);
    if (c && c.drive === 'hits') liveCopy(fast, shaft.flow);
    slow(dt);
    stage.dataset.verifyState = [ch, cur.wedge.toFixed(2), shaft.x.toFixed(2)].join(' ');
  }
  var looping = false;
  function loop(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    if (seen && !document.hidden) draw(dt);
    var busy = isOpen || tw < 1 || Math.abs(shaft.x - .34) > .002;
    if (!busy) closing = false;
    if (busy) requestAnimationFrame(loop); else looping = false;
  }
  function run() { if (!looping) { looping = true; last = performance.now(); requestAnimationFrame(loop); } }
  var starting = false;
  function start() {
    if (ready || starting) return; starting = true;
    try { build(); ready = true; sec.classList.add('dsc-ready'); seen = true; draw(.016); setTimeout(function () { R.compile(S, C); }, 0); }
    catch (e) { sec.classList.remove('dsc-live'); sec.classList.add('dsc-static'); if (window.console) console.error(e); }
  }

  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { seen = e.isIntersecting; if (seen) start(); }); }, { rootMargin: '30% 0px 30% 0px' });
  io.observe(sec);
  addEventListener('resize', function () { if (!ready) return; sizeOpen(); if (isOpen) { moveTo(target(ch), .01); } else { closedPx = stage.offsetHeight; cur = null; } run(); });

  openBtn.addEventListener('click', openIt);
  closeBtn.addEventListener('click', closeIt);
  pauseBtn.addEventListener('click', function () { if (pauseBtn.dataset.ended) { setPlaying(true); show(0); return; } setPlaying(!playing); });
  chips.forEach(function (c, i) { c.addEventListener('click', function () { setPlaying(false); show(i); }); });
  hits.forEach(function (b) { b.addEventListener('click', function () { setPlaying(false); fired = 9; hit(b.dataset.hit); run(); }); });
  sec.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) closeIt(); });

  window.__dsc = { ready: function () { return ready; }, state: function () { return { ch: ch, playing: playing, tw: tw, x: shaft.x, wedge: wedge, open: isOpen }; }, step: function (dt) { draw(dt || .016); }, settle: function () { if (to) { tw = 1; cur = snap(to); } draw(.016); } };
})();
