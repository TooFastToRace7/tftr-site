/* Damper Adjustment Explained: the trackside tool.
   Every word of Simon's explanation is read from the page itself, never retyped here.
   The short labels below come from the page's own figures. With JavaScript off,
   the page is the full article, unchanged. */
(function () {
  'use strict';
  var main = document.querySelector('main');
  var hero = main && main.querySelector('.page-hero');
  if (!hero) return;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- the ten symptoms, in the order of the page's flow diagram ---------- */
  var ZONES = [
    { id: 'brake', n: 1, name: 'Braking and turn-in', at: [.13, .40], label: [1, -1], syms: ['ust', 'ost', 'lazy', 'dive'] },
    { id: 'kerb', n: 2, name: 'Apex kerb', at: [.40, .50], label: [1, 0], syms: ['harsh'] },
    { id: 'exit', n: 3, name: 'Corner exit, on the power', at: [.50, .67], label: [1, 1], syms: ['use', 'ose', 'squat'] },
    { id: 'bump', n: 4, name: 'Bumpy section', at: [.67, .83], label: [0, 1], syms: ['skate'] },
    { id: 'crest', n: 5, name: 'Crest', at: [.83, .97], label: [0, 1], syms: ['float'] }
  ];
  var SYM = {
    ust: { name: 'Understeer on turn-in', h: 'Understeer on turn-in', show: [[1, 4], [2, 4]], ask: 'Both directions work, by different mechanisms. Which suits your front piston?', moves: [
      { tab: 'Linear front piston', end: 'front', adj: 'Compression', dir: 'less', note: 'more transfer, but slower' },
      { tab: 'Digressive front piston', end: 'front', adj: 'Low-speed compression', dir: 'more', note: 'loads faster, more bite' }] },
    ost: { name: 'Oversteer on turn-in', h: 'Oversteer on turn-in', moves: [{ end: 'rear', adj: 'Rebound', dir: 'more', note: 'holds the lifting rear down' }] },
    lazy: { name: 'Lazy, slow to take a set', h: 'Car feels lazy, slow to take a set', moves: [{ end: 'both', adj: 'Low-speed compression', dir: 'more', note: 'load arrives sooner' }] },
    dive: { name: 'Excessive dive', h: 'Excessive dive under braking', moves: [{ end: 'front', adj: 'Low-speed compression', dir: 'more', note: 'loads the tyre while braking' }] },
    harsh: { name: 'Harsh over kerbs only', h: 'Harsh over kerbs, but composed everywhere else', moves: [{ end: 'both', adj: 'Both compression settings', dir: 'review', note: 'not just high speed' }] },
    use: { name: 'Understeer on exit', h: 'Understeer on corner exit', moves: [{ end: 'front', adj: 'Rebound', dir: 'less', note: 'spring drives tyre down' }] },
    ose: { name: 'Oversteer on exit', h: 'Oversteer on corner exit', moves: [{ end: 'rear', adj: 'Rebound', dir: 'less', note: 'same reasoning, other end' }] },
    squat: { name: 'Excessive squat', h: 'Excessive squat on power', moves: [{ end: 'rear', adj: 'Low-speed compression', dir: 'more', note: 'loads the tyre on power' }] },
    skate: { name: 'Nervous, skating, chattering', h: 'Car feels nervous or over-reactive, or skates and chatters over bumps', moves: [{ end: 'both', adj: 'Rebound', dir: 'less', note: 'then less low-speed compression' }] },
    float: { name: 'Floats over crests', h: 'Floats over crests, feels loose at speed', show: [[1], [2]], ask: 'Same symptom, opposite cures. Which is happening?', moves: [
      { tab: 'The tyre is leaving the road', end: 'both', adj: 'Rebound', dir: 'less', note: 'keeps it in contact' },
      { tab: 'The body is running away', end: 'both', adj: 'Rebound', dir: 'more', note: 'catch it before it builds' }] }
  };

  /* ---------- saved setup sheet: the field names are RaceTracs' own ---------- */
  var CORNERS = [['fl', 'Front left'], ['fr', 'Front right'], ['rl', 'Rear left'], ['rr', 'Rear right']];
  var DAMPER = {
    '1way': [['setting', 'Setting']],
    '2way': [['lsc', 'Compression'], ['lsr', 'Rebound']],
    '3way': [['lsc', 'Low-speed compression'], ['hsc', 'High-speed compression'], ['lsr', 'Rebound']],
    '4way': [['lsc', 'Low-speed compression'], ['hsc', 'High-speed compression'], ['lsr', 'Low-speed rebound'], ['hsr', 'High-speed rebound']]
  };
  function perCorner(names) { var o = []; names.forEach(function (n) { CORNERS.forEach(function (c) { o.push(n + c[0]); }); }); return o; }
  var NUM_KEYS = perCorner(['spring_rate_', 'corner_weight_', 'camber_', 'toe_']).concat('thrust_angle');
  var TEXT_KEYS = perCorner(['damper_setting_', 'damper_lsc_', 'damper_hsc_', 'damper_lsr_', 'damper_hsr_']);
  var KEY = 'tftr-setup-sheet', sheet = { car: '', f: {}, log: [], base: null };
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved && saved.log) { sheet.car = saved.car || ''; sheet.log = saved.log; sheet.f = saved.f || {}; sheet.base = saved.base || null;
    if (saved.set) { /* a sheet saved by the earlier version */
      Object.keys(saved.set).forEach(function (k) { var c = k.slice(0, 2), t = { r: 'lsr', l: 'lsc', h: 'hsc' }[k.charAt(2)]; if (t) sheet.f['damper_' + t + '_' + c] = saved.set[k]; });
      if (Object.keys(sheet.f).length) sheet.f.damper_type = Object.keys(sheet.f).some(function (k) { return /hsc/.test(k); }) ? '3way' : '2way'; } } } catch (e) {}
  if (!sheet.f.damper_type) sheet.f.damper_type = '1way';
  if (!sheet.f.spring_rate_unit) sheet.f.spring_rate_unit = 'lbs/in';
  if (!sheet.f.corner_weight_unit) sheet.f.corner_weight_unit = 'kg';
  if (!sheet.f.toe_unit) sheet.f.toe_unit = 'deg';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(sheet)); } catch (e) {} updateCounts(); }

  /* ---------- the damper cutaway ---------- */
  var GREEN = '#7DCC7D', AMBER = '#EF9F27', W = 200, H = 420;
  function Damper(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.x = .25; this.flow = 0; this.lit = true; this.tint = GREEN; this.knob = 0; this.knobLit = false;
    this.p = []; for (var i = 0; i < 30; i++) this.p.push({ t: Math.random(), a: Math.random(), b: Math.random() });
    this.size();
  }
  Damper.prototype.size = function () {
    var r = this.c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function metal(g, x, w, a, b) { var m = g.createLinearGradient(x, 0, x + w, 0); m.addColorStop(0, a); m.addColorStop(.28, b); m.addColorStop(.55, a); m.addColorStop(1, '#141514'); return m; }
  Damper.prototype.coil = function (g, cx, top, bot, front, on) {
    var n = 7, rad = 45, step = 3, pts = [];
    for (var a = 0; a <= n * 360; a += step) {
      var f = a / (n * 360), y = top + (bot - top) * f, r = a * Math.PI / 180, s = Math.sin(r);
      pts.push({ x: cx + Math.cos(r) * rad, y: y + s * 4, z: s });
    }
    g.lineCap = 'round';
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], q = pts[i - 1], isF = p.z > 0;
      if (isF !== front) continue;
      g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(p.x, p.y);
      var l = front ? (.42 + .58 * (1 - Math.abs(p.x - cx + 14) / 62)) : .2;
      var col = on ? [92, 184, 92] : [120, 124, 120];
      g.strokeStyle = 'rgb(' + col.map(function (v) { return Math.round(v * (l * 1.3)); }).join(',') + ')';
      g.lineWidth = front ? 7.5 : 6; g.stroke();
    }
  };
  Damper.prototype.draw = function (dt) {
    var c = this.c, g = this.g, s = c.width / W; g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, W, H);
    g.globalAlpha = this.lit ? 1 : .34;
    var cx = 100, x = this.x, travel = 72, eyeY = 396 - travel * x, bodyT = 62, bodyB = 256, hw = 33, wall = 5;
    var pistonY = eyeY - 186, perchB = eyeY - 34, perchT = 74, gasY = 96 - 18 * x, tint = this.tint;
    this.coil(g, cx, perchT + 4, perchB - 4, false, this.lit);
    /* rod */
    g.fillStyle = metal(g, cx - 7, 14, '#c9cdc7', '#fff'); g.fillRect(cx - 7, pistonY, 14, eyeY - pistonY - 8);
    /* body */
    g.fillStyle = metal(g, cx - hw, hw * 2, '#4f544f', '#9aa09a'); rr(g, cx - hw, bodyT, hw * 2, bodyB - bodyT, 3); g.fill();
    var ix = cx - hw + wall, iw = (hw - wall) * 2, it = bodyT + 5, ib = bodyB - 7;
    g.fillStyle = '#0a0c0a'; g.fillRect(ix, it, iw, ib - it);
    /* gas above the floating piston, oil below it */
    var oil = g.createLinearGradient(0, gasY, 0, ib); oil.addColorStop(0, '#2c3a2a'); oil.addColorStop(1, '#1b261b');
    g.fillStyle = oil; g.fillRect(ix, gasY, iw, ib - gasY);
    g.fillStyle = '#6d726c'; g.fillRect(ix, gasY - 5, iw, 6);
    /* oil moving through the piston */
    var speed = Math.abs(this.flow), portX = [cx - 14, cx + 14], flowCol = tint;
    if (speed > .02) {
      g.fillStyle = flowCol;
      for (var i = 0; i < this.p.length; i++) {
        var o = this.p[i]; o.t = (o.t + dt * speed * 1.5) % 1;
        var t = this.flow > 0 ? 1 - o.t : o.t, port = portX[o.a > .5 ? 1 : 0], px, py;
        var above = t < .5, f = above ? t * 2 : (t - .5) * 2, sideA = ix + 4 + o.a * (iw - 8), sideB = ix + 4 + o.b * (iw - 8);
        if (above) { py = gasY + 5 + (pistonY - 7 - gasY - 5) * f; px = sideA + (port - sideA) * f * f; }
        else { py = pistonY + 8 + (ib - pistonY - 8) * f; px = port + (sideB - port) * Math.sqrt(f); }
        g.globalAlpha = (this.lit ? 1 : .34) * Math.min(1, speed * 1.6) * (.45 + .55 * Math.sin(t * Math.PI));
        g.beginPath(); g.arc(px, py, 1.7, 0, 7); g.fill();
      }
      g.globalAlpha = this.lit ? 1 : .34;
    }
    /* piston and shims */
    g.fillStyle = metal(g, ix, iw, '#a7aca6', '#e6e8e3'); g.fillRect(ix, pistonY - 7, iw, 14);
    g.fillStyle = '#0d0f0d'; g.fillRect(portX[0] - 2.5, pistonY - 7, 5, 14); g.fillRect(portX[1] - 2.5, pistonY - 7, 5, 14);
    g.fillStyle = speed > .02 ? tint : '#c8cbc5'; g.fillRect(cx - 19, pistonY - 10, 38, 2.4); g.fillRect(cx - 19, pistonY + 7.6, 38, 2.4);
    /* gland and cap */
    g.fillStyle = metal(g, cx - hw, hw * 2, '#2d302d', '#6f746e'); g.fillRect(cx - hw, bodyB - 9, hw * 2, 11);
    g.fillStyle = metal(g, cx - hw - 3, hw * 2 + 6, '#2d302d', '#6f746e'); rr(g, cx - hw - 3, 38, hw * 2 + 6, 28, 3); g.fill();
    /* top eye */
    g.strokeStyle = '#c9cdc7'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 25, 10, 0, 7); g.stroke();
    /* adjuster */
    var kx = cx + hw + 16, ky = 52;
    g.strokeStyle = this.knobLit ? tint : '#6f746e'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + hw + 2, ky); g.lineTo(kx - 8, ky); g.stroke();
    g.fillStyle = '#1e201e'; g.beginPath(); g.arc(kx, ky, 12, 0, 7); g.fill(); g.lineWidth = 2.4; g.strokeStyle = this.knobLit ? tint : '#6f746e'; g.stroke();
    var ang = this.knob; g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + Math.cos(ang) * 9, ky + Math.sin(ang) * 9); g.strokeStyle = '#fff'; g.stroke();
    /* perches */
    g.fillStyle = metal(g, cx - 54, 108, '#6f746e', '#d4d7d0'); rr(g, cx - 54, perchT - 4, 108, 8, 2); g.fill();
    g.fillStyle = metal(g, cx - 54, 108, '#6f746e', '#d4d7d0'); rr(g, cx - 54, perchB - 4, 108, 8, 2); g.fill();
    /* bottom eye */
    g.fillStyle = metal(g, cx - 10, 20, '#6f746e', '#d4d7d0'); g.fillRect(cx - 9, perchB + 4, 18, eyeY - perchB - 12);
    g.strokeStyle = '#c9cdc7'; g.lineWidth = 6; g.beginPath(); g.arc(cx, eyeY + 2, 10, 0, 7); g.stroke();
    this.coil(g, cx, perchT + 4, perchB - 4, true, this.lit);
    g.globalAlpha = 1;
  };

  /* One stroke of the wheel: up on compression, back down on rebound. */
  var TC = .62, TH = .16, TR = .86, TW = .42;
  function strokeAt(t, c, r) {
    /* returns [position 0..1, stroke name, speed] */
    var a = TC * c, b = TR * r;
    if (t < a) { var u = t / a; return [1 - Math.pow(1 - u, 2.4), 'compression', 1 - u * .7]; }
    t -= a; if (t < TH) return [1, 'hold', 0];
    t -= TH; if (t < b) { var v = t / b; return [Math.pow(1 - v, 2.4), 'rebound', -(1 - v * .7)]; }
    return [0, 'hold', 0];
  }
  function cycleLen(c, r) { return TC * c + TH + TR * r + TW; }

  /* ---------- the tool ---------- */
  var heroBox = $('.container', hero), panel = $('.page-hero-panel', hero);
  var head = el('div', 'g-head');
  while (heroBox.firstChild) head.appendChild(heroBox.firstChild);
  head.insertAdjacentHTML('beforeend', '<button class="g-sheetbtn" type="button" data-sheet>My setup sheet <b data-count>0</b></button>');
  heroBox.appendChild(head);
  var tool = el('div', 'g-tool');
  tool.innerHTML =
    '<div class="g-where">' +
      '<h2 class="g-q">Where on the corner does it go wrong?</h2>' +
      '<div class="g-map" aria-hidden="true"></div>' +
      '<div class="g-zones" role="group" aria-label="Where on the corner"></div>' +
      '<div class="g-syms" role="group" aria-label="What the car does"></div>' +
      '<p class="g-foot"><span>A starting point, not a rulebook.</span> <a class="g-simon" href="#">Tried it and still not right? Ask Simon</a></p>' +
    '</div>' +
    '<div class="g-answer" aria-live="polite">' +
      '<div class="g-ans-text">' +
        '<p class="g-kick"><span class="g-symname"></span></p>' +
        '<p class="g-ask" hidden></p><div class="g-tabs" role="group" hidden></div>' +
        '<p class="g-big"></p><p class="g-note"></p><p class="g-mine"></p>' +
        '<div class="g-why"></div>' +
        '<p class="g-before">Before you touch an adjuster: <span>Spring rates right?</span> <span>Travel available?</span> <span>High-speed compression already set?</span></p>' +
        '<div class="g-actions"><button class="g-add" type="button">Add to my setup sheet</button><a class="g-more" href="#symptoms">Read this in full</a></div>' +
      '</div>' +
      '<div class="g-rig">' +
        '<div class="g-pair"><figure data-end="front"><canvas></canvas><figcaption>Front</figcaption></figure><figure data-end="rear"><canvas></canvas><figcaption>Rear</figcaption></figure></div>' +
        '<p class="g-stage"><b class="g-phase"></b><span class="g-stroke"></span></p>' +
        '<p class="g-illus">Illustration, exaggerated so you can see it. Not a simulation.</p>' +
      '</div>' +
    '</div>' +
    '<div class="g-belt"><a class="g-toread" href="#gBook">Prefer to read it all? <b></b></a>' +
    '<p class="g-works">Your setup sheet works with <a href="https://www.racetracs.com" target="_blank" rel="noopener">RaceTracs</a> <a href="https://springspec.com" target="_blank" rel="noopener">SpringSpec</a> <a href="https://stringalignpro.racetracs.com" target="_blank" rel="noopener">StringAlign Pro</a></p></div>';
  heroBox.appendChild(tool);

  /* map */
  var mapBox = $('.g-map', tool);
  var TRACK = 'M 640 372 L 330 372 C 190 372 96 322 96 226 C 96 128 182 92 280 92 C 372 92 410 142 498 132 C 556 125 590 84 640 62';
  mapBox.innerHTML =
    '<svg viewBox="0 0 640 440" preserveAspectRatio="xMidYMid meet">' +
      '<defs><pattern id="gDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#2a2d2a"/></pattern>' +
      '<linearGradient id="gFade" x1="0" x2="1"><stop offset="0" stop-color="#0a0a0a" stop-opacity=".0"/><stop offset=".86" stop-color="#0a0a0a" stop-opacity="0"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient></defs>' +
      '<rect width="640" height="440" fill="url(#gDots)"/>' +
      '<path class="m-edge" d="' + TRACK + '"/><path class="m-road" d="' + TRACK + '"/>' +
      '<path class="m-kerb" d="M 150 318 C 124 288 118 258 118 226 C 118 196 132 170 152 150"/><path class="m-kerb2" d="M 150 318 C 124 288 118 258 118 226 C 118 196 132 170 152 150"/>' +
      '<path class="m-mid" d="' + TRACK + '"/><path class="m-zone" d="' + TRACK + '"/>' +
      '<rect width="640" height="440" fill="url(#gFade)" pointer-events="none"/>' +
      '<g class="m-car"><rect x="-13" y="-7" width="26" height="14" rx="3"/><rect class="w" x="3" y="-5" width="6" height="10" rx="1"/></g>' +
      '<g class="m-spots"></g>' +
    '</svg>';
  var path = $('.m-zone', mapBox), len = path.getTotalLength(), car = $('.m-car', mapBox), spots = $('.m-spots', mapBox);
  path.style.strokeDasharray = '0 ' + len;
  var zoneBox = $('.g-zones', tool), symBox = $('.g-syms', tool), NS = 'http://www.w3.org/2000/svg';
  ZONES.forEach(function (z, i) {
    var p = path.getPointAtLength(len * (z.at[0] + z.at[1]) / 2);
    var off = { brake: [-20, -66], kerb: [74, 0], exit: [74, 44], bump: [-10, -68], crest: [-30, 62] }[z.id];
    var g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'm-spot'); g.setAttribute('data-z', i);
    g.setAttribute('transform', 'translate(' + (p.x + off[0]) + ' ' + (p.y + off[1]) + ')');
    var words = { brake: 'Braking and turn-in', kerb: 'Apex kerb', exit: 'Corner exit', bump: 'Bumps', crest: 'Crest' }[z.id];
    g.innerHTML = '<circle class="hit" r="30"/><circle class="d" r="18"/><text class="n" text-anchor="middle" dy=".36em">' + z.n + '</text><text class="l" x="26" dy=".35em">' + words + '</text>';
    g.addEventListener('click', function () { pickZone(i, true); });
    spots.appendChild(g);
    var b = el('button', 'g-zone', '<b>' + z.n + '</b>' + z.name); b.type = 'button';
    b.addEventListener('click', function () { pickZone(i, true); });
    zoneBox.appendChild(b);
  });

  /* tap anywhere on the track */
  $('svg', mapBox).addEventListener('click', function (e) {
    if (e.target.closest('.m-spot')) return;
    var svg = this, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var q = pt.matrixTransform(svg.getScreenCTM().inverse()), best = 1e9, at = 0;
    for (var f = 0; f <= 1; f += .01) { var a = path.getPointAtLength(len * f), d = (a.x - q.x) * (a.x - q.x) + (a.y - q.y) * (a.y - q.y); if (d < best) { best = d; at = f; } }
    if (best > 1800) return;
    ZONES.forEach(function (z, i) { if (at >= z.at[0] && at < z.at[1]) pickZone(i, true); });
  });

  /* ---------- reading Simon's words from the page ---------- */
  var cur = { zone: 2, sym: 'use', move: 0 };
  function sectionFor(name) {
    var h = $$('#symptoms h3').filter(function (x) { return x.textContent.trim() === name; })[0], out = [];
    if (!h) return { h: null, nodes: out };
    for (var n = h.nextElementSibling; n && n.tagName !== 'H3' && n.tagName !== 'FIGURE'; n = n.nextElementSibling) if (n.tagName === 'P') out.push(n.cloneNode(true));
    return { h: h, nodes: out };
  }

  function pickZone(i, user) {
    cur.zone = i; var z = ZONES[i];
    $$('.g-zone', tool).forEach(function (b, k) { b.setAttribute('aria-pressed', k === i); });
    $$('.m-spot', mapBox).forEach(function (s, k) { s.classList.toggle('on', k === i); });
    var a = z.at[0] * len, b2 = (z.at[1] - z.at[0]) * len;
    path.style.strokeDasharray = '0 ' + a + ' ' + b2 + ' ' + len;
    symBox.innerHTML = '';
    z.syms.forEach(function (k) {
      var b = el('button', 'g-sym', esc(SYM[k].name)); b.type = 'button'; b.dataset.s = k;
      b.addEventListener('click', function () { pickSym(k, true); }); symBox.appendChild(b);
    });
    symBox.classList.toggle('solo', z.syms.length === 1);
    pickSym(user && z.syms.indexOf(cur.sym) < 0 ? z.syms[0] : (z.syms.indexOf(cur.sym) >= 0 ? cur.sym : z.syms[0]), user);
  }
  function pickSym(k, user) {
    cur.sym = k; cur.move = 0;
    $$('.g-sym', tool).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.s === k); });
    var s = SYM[k], tabs = $('.g-tabs', tool), ask = $('.g-ask', tool);
    $('.g-symname', tool).textContent = s.name;
    ask.hidden = tabs.hidden = !s.ask; ask.textContent = s.ask || ''; tabs.innerHTML = '';
    if (s.ask) s.moves.forEach(function (m, i) {
      var b = el('button', 'g-tab', esc(m.tab)); b.type = 'button';
      b.addEventListener('click', function () { cur.move = i; showMove(); }); tabs.appendChild(b);
    });
    var sec = sectionFor(s.h); cur.nodes = sec.nodes;
    if (sec.h) $('.g-more', tool).href = '#' + sec.h.id;
    showMove(); if (user && innerWidth < 1000) { var ans = $('.g-answer', tool); setTimeout(function () { ans.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }, 40); }
  }
  function moveText(m) {
    var e = m.end === 'both' ? '' : (m.end === 'front' ? 'Front ' : 'Rear ');
    return m.dir === 'review' ? 'Review ' + m.adj.charAt(0).toLowerCase() + m.adj.slice(1) : (m.dir === 'less' ? 'Less ' : 'More ') + e.toLowerCase() + m.adj.toLowerCase();
  }
  function showMove() {
    var s = SYM[cur.sym], m = s.moves[cur.move];
    $$('.g-tab', tool).forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur.move); });
    var e = m.end === 'both' ? '' : '<span>' + (m.end === 'front' ? 'Front' : 'Rear') + '</span> ';
    $('.g-big', tool).innerHTML = m.dir === 'review' ? '<i class="rev">Review</i> <span>' + esc(m.adj) + '</span>'
      : e + '<span>' + esc(m.adj) + '</span> <i class="' + m.dir + '">' + (m.dir === 'less' ? 'Less' : 'More') + '</i>';
    $('.g-big', tool).classList.toggle('long', m.adj.length > 14);
    $('.g-note', tool).textContent = m.note;
    showMine(m);
    var why = $('.g-why', tool); why.innerHTML = '';
    (s.show ? s.show[cur.move].map(function (i) { return cur.nodes[i]; }) : cur.nodes).forEach(function (n) { if (n) why.appendChild(n); });
    $('.g-add', tool).textContent = 'Add to my setup sheet';
    setScene(m);
    if ($('.g-simon', tool)) $('.g-simon', tool).href = contactUrl(true);
  }

  /* the visitor's own numbers, when the sheet has them */
  function showMine(m) {
    var box = $('.g-mine', tool), t = sheet.f.damper_type, keys = [];
    if (!DAMPER[t]) { box.innerHTML = ''; return; }
    if (t === '1way') keys = ['setting'];
    else if (m.dir === 'review') keys = t === '2way' ? ['lsc'] : ['lsc', 'hsc'];
    else if (/rebound/i.test(m.adj)) keys = ['lsr'];
    else keys = ['lsc'];
    var ends = m.end === 'front' ? CORNERS.slice(0, 2) : m.end === 'rear' ? CORNERS.slice(2) : CORNERS, parts = [];
    keys.forEach(function (k) { ends.forEach(function (c) { var v = sheet.f['damper_' + k + '_' + c[0]]; if (v) parts.push(c[1] + (keys.length > 1 ? ' ' + (k === 'hsc' ? 'high-speed' : 'low-speed') : '') + ' <b>' + esc(v) + '</b>'); }); });
    if (!parts.length) { box.innerHTML = '<button type="button" class="g-minebtn" data-sheet="dampers">Enter your clicks and see them here</button>'; return; }
    var dir = m.dir === 'less' ? ' Less means further out from full hard.' : m.dir === 'more' ? ' More means closer to full hard.' : '';
    box.innerHTML = '<span>Your car now:</span> ' + parts.join(', ') + '.' + (t === '1way' && m.dir !== 'review' ? ' Your one adjuster moves compression and rebound together.' : '') + dir;
  }

  /* ---------- animation scenes ---------- */
  var figs = $$('.g-pair figure', tool).map(function (f) { return { end: f.dataset.end, fig: f, d: new Damper($('canvas', f)) }; });
  var phaseEl = $('.g-phase', tool), strokeEl = $('.g-stroke', tool), scene = null;
  function setScene(m) {
    var isRev = /rebound/i.test(m.adj), f = m.dir === 'more' ? 2.3 : m.dir === 'less' ? .42 : 1;
    scene = { m: m, t: 0, reb: isRev, f: f, tint: m.dir === 'more' ? AMBER : GREEN, review: m.dir === 'review' };
    figs.forEach(function (o) {
      var on = m.end === 'both' || m.end === o.end;
      o.d.lit = on; o.d.tint = m.dir === 'review' ? '#fff' : scene.tint; o.d.x = .22; o.d.flow = 0; o.d.knobLit = false;
      o.fig.classList.toggle('on', on);
    });
    if (reduced) { figs.forEach(function (o) { o.d.x = .5; o.d.draw(0); }); phaseEl.textContent = ''; strokeEl.textContent = m.adj; }
  }
  function runScene(dt) {
    var s = scene; if (!s) return; s.t += dt;
    var base = cycleLen(1, 1), after = cycleLen(s.reb ? 1 : s.f, s.reb ? s.f : 1), turn = 1.1;
    var B = base * 2, total = s.review ? base : B + turn + after * 2;
    var t = s.t % total, phase, pos, name = 'hold', flow = 0, knob = 0, turning = false, r;
    if (s.review || t < B) {
      r = strokeAt(t % base, 1, 1); phase = s.review ? '' : 'Before'; pos = r[0]; name = r[1]; flow = r[2];
    } else if (t < B + turn) {
      phase = 'Turning the adjuster'; pos = 0; turning = true; knob = (t - B) / turn;
    } else {
      r = strokeAt((t - B - turn) % after, s.reb ? 1 : s.f, s.reb ? s.f : 1); phase = 'After'; pos = r[0]; name = r[1]; flow = r[2]; knob = 1;
    }
    var dirSign = s.m.dir === 'more' ? 1 : -1;
    figs.forEach(function (o) {
      if (!o.d.lit) { o.d.x = .22; o.d.flow = 0; o.d.knob = 0; o.d.knobLit = false; o.d.draw(dt); return; }
      o.d.x = .05 + pos * .9; o.d.flow = flow; o.d.knob = -1.2 + knob * dirSign * 2.1; o.d.knobLit = turning || knob === 1;
      var adjusted = (s.reb && name === 'rebound') || (!s.reb && name === 'compression');
      o.d.tint = (adjusted && !s.review) ? s.tint : '#e9ebe6';
      o.d.draw(dt);
    });
    if (phaseEl.textContent !== phase) phaseEl.textContent = phase;
    var word = name === 'hold' ? ' ' : name.charAt(0).toUpperCase() + name.slice(1);
    if (strokeEl.textContent !== word) strokeEl.textContent = word;
    var cls = 'g-stroke' + (((s.reb && name === 'rebound') || (!s.reb && name === 'compression')) && !s.review ? ' hot ' + s.m.dir : '');
    if (strokeEl.className !== cls) strokeEl.className = cls;
  }

  /* car on the map */
  var carD = 0, last = 0, mapSeen = true, toolSeen = true, marginSeen = false;
  function runCar(dt) {
    var f = carD / len, sp = 90 + 190 * Math.min(1, Math.abs(f - .36) * 2.6);
    carD += sp * dt; if (carD > len + 40) carD = -30;
    var d = Math.max(0, Math.min(len, carD)), p = path.getPointAtLength(d), q = path.getPointAtLength(Math.min(len, d + 3));
    /* travelling from the end of the path list: bottom right into the corner */
    car.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ') rotate(' + (Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI) + ')');
    car.style.opacity = carD < 0 || carD > len - 6 ? 0 : 1;
  }

  /* ---------- the book: chapters, one at a time ---------- */
  var sections = [$('.content-intro', main), $('#understanding'), $('#roadmap'), $('#adjusting'), $('#symptoms'), $('#quality'), $('#standard'), $('#faq')].filter(Boolean);
  var strip = $('.photo-strip', main), book = el('div', 'g-book'), rail = el('nav', 'g-rail'), read = el('div', 'g-read'), margin = el('aside', 'g-margin');
  rail.setAttribute('aria-label', 'Chapters');
  var bar = el('div', 'g-progress', '<i></i>');
  sections[0].parentNode.insertBefore(book, sections[0]);
  book.appendChild(rail); book.appendChild(read); book.appendChild(margin);
  var titles = ['Start here'].concat($$('.guide-contents a', sections[0]).map(function (a) { return a.textContent.trim(); }));
  var chapters = sections.map(function (sec, i) {
    var w = el('article', 'g-ch'); w.id = 'ch-' + i;
    read.appendChild(w); w.appendChild(sec);
    if (i === 0) {
      if (strip) { w.appendChild(strip); if (panel) { panel.removeAttribute('style'); strip.insertBefore(panel, strip.firstChild); } }
    }
    var mins = Math.max(1, Math.round(sec.textContent.trim().split(/\s+/).length / 230));
    var heads = $$('h3', sec);
    heads.forEach(function (h, k) { if (!h.id) h.id = 's' + i + '-' + h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
    var label = el('p', 'g-chlabel', 'Chapter ' + (i + 1) + ' of ' + sections.length + ' <span>' + mins + ' min read</span>');
    sec.insertBefore(label, sec.firstChild);
    return { i: i, w: w, sec: sec, title: titles[i] || '', mins: mins, heads: heads };
  });
  rail.innerHTML = '<p class="g-railh">The full guide</p><ol>' + chapters.map(function (c) {
    return '<li><a href="#ch-' + c.i + '" data-ch="' + c.i + '"><b>' + esc(c.title) + '</b><span>' + c.mins + ' min</span></a><ul>' +
      c.heads.map(function (h) { return '<li><a href="#' + h.id + '">' + esc(h.textContent) + '</a></li>'; }).join('') + '</ul></li>';
  }).join('') + '</ol><a class="g-pdf" href="' + (($('.guide-download a', main) || {}).getAttribute ? $('.guide-download a', main).getAttribute('href') : '#') + '" download>Download the PDF</a>';
  read.insertBefore(bar, read.firstChild);
  chapters.forEach(function (c, i) {
    var nav = el('div', 'g-next'), nx = chapters[i + 1], pv = chapters[i - 1];
    nav.innerHTML = (pv ? '<a class="g-prev" href="#ch-' + (i - 1) + '">Back: ' + esc(pv.title) + '</a>' : '<span></span>') +
      (nx ? '<a class="g-fwd" href="#ch-' + (i + 1) + '"><span>Next chapter, ' + nx.mins + ' min</span><b>' + esc(nx.title) + '</b></a>'
          : '<a class="g-fwd" href="#gTop"><span>Back to the car</span><b>Find your first adjustment</b></a>');
    c.w.appendChild(nav);
  });
  hero.id = 'gTop'; book.id = 'gBook';
  $('.g-toread b', tool).textContent = 'The full guide: ' + chapters.length + ' chapters, ' + chapters.reduce(function (a, c) { return a + c.mins; }, 0) + ' minutes';

  var active = 0, railLinks = $$('[data-ch]', rail);
  function setHash(h) { try { history.replaceState(null, '', h); } catch (e) {} }
  function openChapter(i, scroll) {
    active = i; book.classList.toggle('g-wide', !!chapters[i].sec.querySelector('.guide-figure-wide'));
    chapters.forEach(function (c, k) { if (k === i) c.w.removeAttribute('hidden'); else c.w.setAttribute('hidden', 'until-found'); });
    railLinks.forEach(function (a, k) { a.parentNode.classList.toggle('on', k === i); if (k === i) { a.setAttribute('aria-current', 'true'); if (rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: a.parentNode.offsetLeft - 16, behavior: 'auto' }); } else a.removeAttribute('aria-current'); });
    if (scroll) {
      window.scrollTo({ top: book.getBoundingClientRect().top + scrollY - stickyTop(), behavior: 'instant' });
    }
    onScroll();
  }
  function stickyTop() { var h = $('.site-header'); return (h ? h.offsetHeight : 68); }
  function goTo(id) {
    if (id === 'gTop') { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    if (id === 'gBook') { window.scrollTo({ top: book.getBoundingClientRect().top + scrollY - stickyTop(), behavior: 'instant' }); return; }
    var t = document.getElementById(id); if (!t) return;
    var host = t.closest('.g-ch'); if (!host) return;
    var i = chapters.map(function (c) { return c.w; }).indexOf(host);
    if (t === host || t === chapters[i].sec) { openChapter(i, true); setHash('#' + chapters[i].sec.id || ''); return; }
    openChapter(i, false);
    window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - stickyTop() - 64, behavior: 'instant' });
    t.classList.add('g-flash'); setTimeout(function () { t.classList.remove('g-flash'); }, 1600);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1); if (!id) return;
    if (document.getElementById(id) && (document.getElementById(id).closest('.g-ch') || id === 'gTop' || id === 'gBook')) { e.preventDefault(); goTo(id); }
  });
  chapters.forEach(function (c) {
    c.w.addEventListener('beforematch', function () { openChapter(c.i, false); });
  });
  /* steps you can tick off with oily hands */
  $$('ol.guide-list-ordered li', read).forEach(function (li) {
    li.tabIndex = 0; li.addEventListener('click', function (e) { if (e.target.tagName !== 'A') li.classList.toggle('g-done'); });
    li.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); li.classList.toggle('g-done'); } });
  });

  /* margin: one damper that follows what you are reading */
  margin.innerHTML = '<div class="g-mstick"><canvas></canvas><p class="g-mlabel"></p><p class="g-mh"></p>' +
    '<a class="g-mgo" href="#gTop">Find my first adjustment</a><button class="g-mbtn" type="button" data-sheet>My setup sheet <b data-count>0</b></button></div>';
  var mDamper = new Damper($('canvas', margin)), mLabel = $('.g-mlabel', margin), mH = $('.g-mh', margin), mMode = 'both', mT = 0, spyH = null;
  var COMP = /compression|lazy|dive|squat|harsh|understeer on turn-in/i, REB = /rebound|oversteer|understeer on corner exit|floats|nervous/i;
  function modeOf(t) {
    if (/bump and rebound|^how many|^what is the difference|does rebound|two-way/i.test(t)) return 'both';
    if (/understeer on turn-in/i.test(t)) return 'compression';
    if (REB.test(t)) return 'rebound';
    if (COMP.test(t)) return 'compression';
    return 'both';
  }
  function runMargin(dt) {
    mT += dt; var r = strokeAt(mT % cycleLen(1, 1), 1, 1);
    mDamper.x = .05 + r[0] * .9; mDamper.flow = r[2];
    mDamper.tint = (mMode === 'both' || mMode === r[1]) ? GREEN : '#6f746e'; mDamper.draw(dt);
    var word = mMode === 'both' ? (r[1] === 'hold' ? ' ' : r[1].charAt(0).toUpperCase() + r[1].slice(1)) : mMode.charAt(0).toUpperCase() + mMode.slice(1);
    if (mLabel.textContent !== word) mLabel.textContent = word;
  }
  var pb = $('i', bar), ticking = false;
  function onScroll() {
    ticking = false;
    var c = chapters[active], rect = c.w.getBoundingClientRect(), vh = innerHeight;
    var f = Math.max(0, Math.min(1, (vh * .5 - rect.top) / Math.max(1, rect.height - vh * .4)));
    pb.style.transform = 'scaleX(' + f + ')';
    var cur2 = null, top = stickyTop() + 120;
    c.heads.forEach(function (h) { if (h.getBoundingClientRect().top < top) cur2 = h; });
    if (cur2 !== spyH) {
      spyH = cur2;
      $$('ul a', rail).forEach(function (a) { a.classList.toggle('on', !!cur2 && a.getAttribute('href') === '#' + cur2.id); });
      mMode = modeOf(cur2 ? cur2.textContent : ''); mH.textContent = cur2 ? cur2.textContent : c.title;
    }
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- setup sheet: one record of the car, fed by SpringSpec and StringAlign Pro,
     and written as a real RaceTracs share file (format racetracs-share, version 1) ---------- */
  var drawer = el('div', 'g-sheet'); drawer.id = 'gSheet'; drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'My setup sheet'); drawer.hidden = true;
  var LINK = { spring: 'https://springspec.com', align: 'https://stringalignpro.racetracs.com', race: 'https://www.racetracs.com', ios: 'https://apps.apple.com/gb/app/racetracs/id6755153259', android: 'https://play.google.com/store/apps/details?id=com.racetracs.app' };
  var TABS = [
    { id: 'springs', n: 1, name: 'Springs', from: 'SpringSpec' },
    { id: 'align', n: 2, name: 'Alignment', from: 'StringAlign Pro' },
    { id: 'dampers', n: 3, name: 'Dampers', from: 'Your clicks' },
    { id: 'save', n: 4, name: 'Changes', from: 'RaceTracs' }
  ];
  function ext(href, text) { return '<a class="g-app" href="' + href + '" target="_blank" rel="noopener">' + text + '</a>'; }
  drawer.innerHTML =
    '<div class="g-sh-in"><div class="g-sh-top"><h2>My setup sheet</h2>' +
    '<label class="g-car"><span>Car</span><input id="gCar" autocomplete="off" placeholder="Make, model, use"></label>' +
    '<label class="g-load">Load a RaceTracs file<input type="file" id="gLoad"></label>' +
    '<button class="g-x" type="button" aria-label="Close">Close</button></div>' +
    '<div class="g-tabsbar" role="tablist" aria-label="Setup sheet steps">' + TABS.map(function (t) {
      return '<button type="button" role="tab" class="g-step" data-t="' + t.id + '"><b>' + t.n + '</b><span>' + t.name + '<small>' + t.from + '</small></span><i></i></button>';
    }).join('') + '</div>' +
    '<p class="g-sh-status" role="status"></p><div class="g-panel" role="tabpanel"></div>' +
    '<p class="g-sh-note">Saved in this browser only. Nothing leaves your device unless you send it.</p></div>';
  document.body.appendChild(drawer);
  var scrim = el('div', 'g-scrim'); scrim.hidden = true; document.body.appendChild(scrim);
  var lastFocus = null, tabNow = 'dampers', panelEl = $('.g-panel', drawer), statusEl = $('.g-sh-status', drawer), undo = null;
  var CAR_SVG = '<svg class="g-carplan" viewBox="0 0 120 300" aria-hidden="true"><path class="b" d="M45 18 h30 l6 64 l10 44 v130 q0 22 -22 22 h-18 q-22 0 -22 -22 v-130 l10 -44z"/>' +
    '<path class="a" d="M14 62 H106 M14 246 H106"/><rect class="t" x="2" y="36" width="20" height="52" rx="4"/><rect class="t" x="98" y="36" width="20" height="52" rx="4"/><rect class="t" x="0" y="218" width="24" height="56" rx="4"/><rect class="t" x="96" y="218" width="24" height="56" rx="4"/>' +
    '<rect class="c" x="42" y="128" width="36" height="64" rx="5"/><text x="60" y="12" text-anchor="middle">FRONT</text></svg>';

  function val(k) { var v = sheet.f[k]; return v == null ? '' : String(v); }
  function field(key, label, numeric) {
    return '<label class="g-f"><span>' + esc(label) + '</span><input inputmode="' + (numeric ? 'decimal' : 'text') + '" autocomplete="off" data-k="' + key + '"' + (numeric ? ' data-num="1"' : '') + ' value="' + esc(val(key)) + '"></label>';
  }
  function plan(groups) {
    function card(c) {
      return '<fieldset class="g-corner g-c-' + c[0] + '"><legend>' + c[1] + '</legend>' + groups.map(function (g) { return field(g.key + c[0], g.label, g.num); }).join('') + '</fieldset>';
    }
    return '<div class="g-plan">' + CORNERS.map(card).join('') + CAR_SVG + '</div>';
  }
  function unitSel(key, label, opts) {
    return '<label class="g-unit"><span>' + label + '</span><select data-k="' + key + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val(key) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
  }
  function renderLog() {
    var ol = $('.g-log', drawer); if (!ol) return;
    ol.innerHTML = sheet.log.length ? '' : '<li class="g-empty">Nothing yet. Pick a symptom on the track map and add its first adjustment here.</li>';
    sheet.log.forEach(function (x, i) {
      var li = el('li', '', '<div class="g-l1"><time>' + esc(x.d) + '</time><b>' + esc(x.s) + '</b><button type="button" class="g-del" aria-label="Remove this change">Remove</button></div><p>' + esc(x.m) + '</p>' +
        '<label>What happened<input value="' + esc(x.res || '') + '" autocomplete="off"></label>');
      $('input', li).addEventListener('input', function () { x.res = this.value; save(); });
      $('.g-del', li).addEventListener('click', function () { sheet.log.splice(i, 1); save(); renderLog(); });
      ol.appendChild(li);
    });
  }
  function renderTab() {
    var h = '';
    if (tabNow === 'springs') h =
      '<div class="g-ph"><div><h3>Springs and corner weights</h3><p>No damper adjustment will rescue a wrong spring rate, so this comes first. SpringSpec works out wheel frequency from your corner weights and motion ratios, and matches springs from the Eibach and Hyperco catalogues. Copy your figures here.</p></div>' + ext(LINK.spring, 'Open SpringSpec') + '</div>' +
      '<div class="g-units">' + unitSel('spring_rate_unit', 'Spring rate', [['lbs/in', 'lbs/in'], ['N/mm', 'N/mm'], ['kg/mm', 'kg/mm']]) + unitSel('corner_weight_unit', 'Corner weight', [['kg', 'kg'], ['lbs', 'lbs']]) + '</div>' +
      plan([{ key: 'spring_rate_', label: 'Spring rate', num: 1 }, { key: 'corner_weight_', label: 'Corner weight', num: 1 }]);
    else if (tabNow === 'align') h =
      '<div class="g-ph"><div><h3>Alignment</h3><p>StringAlign Pro works out toe and rear thrust angle from rim measurements taken at the car, and records camber. Copy its figures here so they travel with the rest of the setup.</p></div>' + ext(LINK.align, 'Open StringAlign Pro') + '</div>' +
      '<div class="g-units">' + unitSel('toe_unit', 'Toe', [['deg', 'Degrees'], ['mm', 'Millimetres'], ['in', 'Inches']]) + '<div class="g-unit">' + field('thrust_angle', 'Thrust angle', 1) + '</div></div>' +
      plan([{ key: 'camber_', label: 'Camber', num: 1 }, { key: 'toe_', label: 'Toe', num: 1 }]);
    else if (tabNow === 'dampers') {
      var t = val('damper_type');
      h = '<div class="g-ph"><div><h3>Clicks from full hard</h3><p>Wind fully in, treat that as zero, and count back out. Front and rear, left and right.</p></div></div>' +
        '<div class="g-dtype" role="group" aria-label="How many adjusters"><span>How many adjusters?</span>' + [['1way', '1-way'], ['2way', '2-way'], ['3way', '3-way'], ['4way', '4-way'], ['no_adjustment', 'None']].map(function (o) {
          return '<button type="button" data-type="' + o[0] + '" aria-pressed="' + (t === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      h += DAMPER[t] ? plan(DAMPER[t].map(function (d) { return { key: 'damper_' + d[0] + '_', label: d[1] }; })) : '<p class="g-sh-hint">' + (t === 'electronic' ? 'Your electronic damper settings are kept from your RaceTracs file.' : 'No adjusters to record.') + '</p>';
    } else h =
      '<div class="g-ph"><div><h3>Changes</h3><p>One change at a time. Write down what you did and what happened, in that order.</p></div></div><ol class="g-log"></ol>' +
      '<div class="g-rt"><div class="g-rt-t"><h3>Keep it in RaceTracs</h3><p>This makes a setup file with your springs, alignment, dampers and changes. It arrives as a new setup, so nothing already in your logbook is overwritten.</p></div>' +
      '<button class="g-send-rt" type="button">Send to RaceTracs</button><div class="g-rt-after" hidden></div>' +
      '<p class="g-rt-need">Importing needs the full RaceTracs app, a one-time £9.99 with no subscription. ' + ext(LINK.ios, 'App Store') + ' ' + ext(LINK.android, 'Google Play') + '</p></div>' +
      '<div class="g-sh-do"><a class="g-send" href="#">Send this to Simon</a><button class="g-print" type="button">Print this sheet</button></div>';
    panelEl.innerHTML = h;
    $$('.g-step', drawer).forEach(function (b) { var on = b.dataset.t === tabNow; b.setAttribute('aria-selected', on); b.classList.toggle('filled', tabFilled(b.dataset.t)); });
    renderLog(); updateCounts();
    $$('[data-k]', panelEl).forEach(function (i) {
      if (i.tagName === 'SELECT') i.addEventListener('change', function () { sheet.f[i.dataset.k] = i.value; save(); });
      else i.addEventListener('input', function () {
        var v = i.value.trim(); if (v) sheet.f[i.dataset.k] = v; else delete sheet.f[i.dataset.k];
        i.classList.toggle('bad', !!(i.dataset.num && v && isNaN(Number(v)))); save();
        $$('.g-step', drawer).forEach(function (b) { b.classList.toggle('filled', tabFilled(b.dataset.t)); });
      });
    });
    var pr = $('.g-print', panelEl); if (pr) pr.addEventListener('click', printSheet);
    var rt = $('.g-send-rt', panelEl); if (rt) rt.addEventListener('click', sendToRaceTracs);
  }
  function tabFilled(t) {
    var re = t === 'springs' ? /^(spring_rate|corner_weight)_(f|r)/ : t === 'align' ? /^(camber|toe)_(f|r)|^thrust/ : t === 'dampers' ? /^damper_(setting|lsc|hsc|lsr|hsr)_/ : null;
    if (!re) return sheet.log.length > 0;
    return Object.keys(sheet.f).some(function (k) { return re.test(k) && sheet.f[k] !== ''; });
  }
  function showTab(t) { tabNow = t; statusEl.textContent = ''; renderTab(); }
  drawer.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('.g-step'); if (s) { showTab(s.dataset.t); s.focus(); return; }
    var d = e.target.closest && e.target.closest('[data-type]'); if (d) { sheet.f.damper_type = d.dataset.type; save(); renderTab(); return; }
    if (e.target.classList && e.target.classList.contains('g-undo')) { if (undo) { sheet = undo; undo = null; save(); $('#gCar').value = sheet.car || ''; renderTab(); statusEl.textContent = 'Back to what you had.'; } }
  });
  function openSheet(tab) {
    lastFocus = document.activeElement; $('#gCar').value = sheet.car || ''; tabNow = tab || tabNow;
    statusEl.textContent = ''; renderTab(); drawer.hidden = scrim.hidden = false; document.documentElement.classList.add('g-lock');
    requestAnimationFrame(function () { drawer.classList.add('open'); $('.g-x', drawer).focus(); });
  }
  function closeSheet() {
    drawer.classList.remove('open'); document.documentElement.classList.remove('g-lock'); scrim.hidden = true;
    setTimeout(function () { drawer.hidden = true; }, reduced ? 0 : 240); if (lastFocus && lastFocus.focus) lastFocus.focus(); showMove();
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-sheet]'); if (b) openSheet(b.dataset.sheet || undefined); });
  scrim.addEventListener('click', closeSheet); $('.g-x', drawer).addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (drawer.hidden) return;
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      var f = $$('a[href],button,input,select', drawer).filter(function (x) { return x.offsetParent !== null; }), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  $('#gCar').addEventListener('input', function () { sheet.car = this.value; save(); });

  /* writing a RaceTracs share file */
  function uuid() { try { return crypto.randomUUID(); } catch (e) { return 'tftr-' + Date.now() + '-' + Math.random().toString(16).slice(2); } }
  function badFields() { return NUM_KEYS.filter(function (k) { var v = sheet.f[k]; return v != null && v !== '' && isNaN(Number(v)); }); }
  function logLines() { return sheet.log.map(function (x) { return x.d + ', ' + x.s + ': ' + x.m + '. What happened: ' + (x.res || 'not noted'); }); }
  function raceTracsDoc() {
    var s = {}, b = sheet.base || {}, now = new Date(), when = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    Object.keys(b).forEach(function (k) { s[k] = b[k]; });
    NUM_KEYS.forEach(function (k) { var v = sheet.f[k]; s[k] = v == null || v === '' || isNaN(Number(v)) ? null : Number(v); });
    TEXT_KEYS.forEach(function (k) { s[k] = sheet.f[k] ? String(sheet.f[k]) : null; });
    s.id = uuid(); s.setup_name = 'Setup sheet ' + when; s.toe_unit = val('toe_unit') || 'deg'; s.spring_rate_unit = val('spring_rate_unit') || 'lbs/in'; s.corner_weight_unit = val('corner_weight_unit') || 'kg';
    s.damper_type = val('damper_type') || 'no_adjustment'; s.alignment_image_urls = []; s.corner_weight_image_urls = [];
    s.notes = b.notes || 'Made with the Too Fast To Race setup sheet.';
    var l = logLines().filter(function (x) { return String(b.damper_notes || '').indexOf(x) < 0; }); s.damper_notes = [b.damper_notes, l.length ? l.join('\n') : ''].filter(Boolean).join('\n') || null;
    return {
      format: 'racetracs-share', version: 1, kind: 'setup', app_version: 'toofasttorace-web', exported_at: now.toISOString(), shared_by: 'Too Fast To Race',
      discipline: 'circuit_car_general',
      vehicle: { nickname: sheet.car || 'My car', manufacturer: null, model: null, vehicle_class: null, setup_profile_type: 'circuit_car_general' },
      setup: s, files: []
    };
  }
  function safeName(s) { return String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'setup'; }
  function sendToRaceTracs() {
    var bad = badFields(), after = $('.g-rt-after', panelEl);
    if (bad.length) { statusEl.textContent = 'Some boxes hold something other than a number. They are marked in red, and were left out.'; }
    var name = safeName(sheet.car || 'my-car') + '-setup-sheet.racetracs', text = JSON.stringify(raceTracsDoc());
    var phone = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
    function done(how) {
      after.hidden = false;
      after.innerHTML = how === 'share' ? '<p><b>Choose RaceTracs in the share list.</b> Then pick your vehicle and tap Import setup.</p>'
        : phone ? '<p><b>Your setup file is in Downloads.</b> Open it and choose RaceTracs. Or in RaceTracs, open the menu, choose Import Shared File, then Choose file.</p>'
        : '<p><b>Your setup file is in your Downloads folder.</b> Send it to your phone by AirDrop or email, then open it and choose RaceTracs. Or in RaceTracs, open the menu, choose Import Shared File, then Choose file.</p>';
    }
    function download() {
      var u = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000); done('download');
    }
    try {
      var f = new File([text], name, { type: 'application/json' });
      if (phone && navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: 'RaceTracs setup' }).then(function () { done('share'); }, function (err) { if (!err || err.name !== 'AbortError') download(); });
        return;
      }
    } catch (e) {}
    download();
  }

  /* reading one back: only known fields are used, and nothing is sent anywhere */
  function loadFile(file) {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { statusEl.textContent = 'That file is too large to be a setup.'; return; }
    file.text().then(function (t) {
      var d; try { d = JSON.parse(t); } catch (e) { d = null; }
      if (!d || (d.format !== 'racetracs-share' && d.format !== 'racetracs-backup')) { statusEl.textContent = 'That is not a RaceTracs file. In RaceTracs, open a setup and tap its share button to make one.'; return; }
      if (Number(d.version) > 1) { statusEl.textContent = 'That file was made by a newer version of RaceTracs than this page understands.'; return; }
      if (d.format === 'racetracs-backup' || d.kind !== 'setup' || !d.setup) { statusEl.textContent = 'That is a full backup or an event. Share one setup from RaceTracs and load that instead.'; return; }
      if (d.discipline !== 'circuit_car_general') { statusEl.textContent = 'This sheet is for circuit car setups, and that file is for a different discipline.'; return; }
      undo = JSON.parse(JSON.stringify(sheet));
      var s = d.setup, base = {}, f = {};
      Object.keys(s).forEach(function (k) { var v = s[k]; if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') base[k] = v; });
      ['id', 'vehicle_id', 'created_by_id', 'created_date', 'updated_date', 'is_base_setup', 'is_shared', 'setup_name'].forEach(function (k) { delete base[k]; });
      NUM_KEYS.concat(TEXT_KEYS).forEach(function (k) { if (s[k] != null && s[k] !== '') f[k] = String(s[k]); });
      ['toe_unit', 'spring_rate_unit', 'corner_weight_unit', 'damper_type'].forEach(function (k) { if (s[k]) f[k] = String(s[k]); });
      sheet.f = f; sheet.base = base;
      if (d.vehicle && (d.vehicle.nickname || d.vehicle.model)) sheet.car = String(d.vehicle.nickname || [d.vehicle.manufacturer, d.vehicle.model].filter(Boolean).join(' ')).slice(0, 80);
      $('#gCar').value = sheet.car || ''; save(); tabNow = 'dampers'; renderTab();
      statusEl.innerHTML = 'Loaded ' + esc(s.setup_name || 'your setup') + '. Everything else in that setup is kept, except photos. <button type="button" class="g-undo">Undo</button>';
    }, function () { statusEl.textContent = 'That file could not be read.'; });
  }
  $('#gLoad').addEventListener('change', function () { loadFile(this.files[0]); this.value = ''; });
  drawer.addEventListener('dragover', function (e) { e.preventDefault(); drawer.classList.add('drop'); });
  drawer.addEventListener('dragleave', function (e) { if (e.target === drawer) drawer.classList.remove('drop'); });
  drawer.addEventListener('drop', function (e) { e.preventDefault(); drawer.classList.remove('drop'); loadFile(e.dataTransfer.files[0]); });

  function printSheet() { document.documentElement.classList.add('g-printing'); renderAllForPrint(); window.print(); }
  function renderAllForPrint() {
    var keep = tabNow, out = '';
    TABS.forEach(function (t) { if (t.id !== 'save') { tabNow = t.id; renderTab(); out += panelEl.innerHTML; } });
    tabNow = 'save'; renderTab(); var log = $('.g-log', panelEl).outerHTML; tabNow = keep;
    var box = el('div', 'g-printall', out + '<h3>Changes</h3>' + log); box.id = 'gPrintAll'; var old = $('#gPrintAll'); if (old) old.remove(); drawer.appendChild(box);
    $$('input', box).forEach(function (i) { i.setAttribute('value', i.value); });
  }
  addEventListener('afterprint', function () { document.documentElement.classList.remove('g-printing'); var o = $('#gPrintAll'); if (o) o.remove(); renderTab(); });
  /* printing the page itself gives the whole guide */
  addEventListener('beforeprint', function () { if (!document.documentElement.classList.contains('g-printing')) chapters.forEach(function (c) { c.w.removeAttribute('hidden'); }); });
  addEventListener('afterprint', function () { openChapter(active, false); });

  $('.g-add', tool).addEventListener('click', function () {
    var s = SYM[cur.sym], m = s.moves[cur.move], d = new Date();
    var when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    sheet.log.push({ d: when, s: s.name, m: moveText(m) + (m.tab ? ' (' + m.tab.toLowerCase() + ')' : ''), res: '' }); save();
    this.textContent = 'Added to your sheet'; openSheet('save');
  });

  function contactBase() { var a = $$('a').filter(function (x) { return /contact\/index\.html$/.test(x.getAttribute('href') || ''); })[0]; return a ? a.getAttribute('href') : '../contact/index.html'; }
  function cornerRow(label, key) {
    var v = CORNERS.map(function (c) { var x = sheet.f[key + c[0]]; return x ? c[1].toLowerCase() + ' ' + x : ''; }).filter(Boolean);
    return v.length ? label + ': ' + v.join(', ') : '';
  }
  function sheetText(withSym) {
    var L = [], t = val('damper_type');
    if (sheet.car) L.push('Car: ' + sheet.car);
    if (withSym) { var s = SYM[cur.sym], m = s.moves[cur.move]; L.push('What the car is doing: ' + s.name, 'What the guide suggests first: ' + moveText(m)); }
    var rows = [cornerRow('Spring rate (' + val('spring_rate_unit') + ')', 'spring_rate_'), cornerRow('Corner weight (' + val('corner_weight_unit') + ')', 'corner_weight_'), cornerRow('Camber', 'camber_'), cornerRow('Toe (' + val('toe_unit') + ')', 'toe_'), sheet.f.thrust_angle ? 'Thrust angle: ' + sheet.f.thrust_angle : ''];
    (DAMPER[t] || []).forEach(function (d) { rows.push(cornerRow(d[1] + ', clicks from full hard', 'damper_' + d[0] + '_')); });
    rows = rows.filter(Boolean); if (rows.length) L.push(''); L = L.concat(rows);
    if (DAMPER[t]) L.push('Damper type: ' + t.replace('way', '-way'));
    if (sheet.log.length) { L.push('', 'Changes:'); logLines().forEach(function (x) { L.push('- ' + x); }); }
    return L.join('\n');
  }
  function contactUrl(withSym) { return contactBase() + '?from=guide&msg=' + encodeURIComponent(sheetText(withSym)); }
  function hasData() { return sheet.log.length || sheet.car || Object.keys(sheet.f).some(function (k) { return !/_unit$|damper_type/.test(k); }); }
  function updateCounts() {
    $$('[data-count]').forEach(function (b) { b.textContent = sheet.log.length; });
    var send = $('.g-send', drawer); if (send) send.href = contactUrl(false);
    var cta = $('.cta-section a[href*="contact"]', main); if (cta && hasData()) cta.href = contactUrl(false);
    if (scene) { var si = $('.g-simon', tool); if (si) si.href = contactUrl(true); }
  }

  /* phone bar */
  var phone = el('div', 'g-phonebar', '<a href="#gTop">First adjustment</a><button type="button" data-sheet>Setup sheet <b data-count>0</b></button>');
  document.body.appendChild(phone);

  /* ---------- start ---------- */
  document.documentElement.classList.add('g-ready');
  var hash = (location.hash || '').slice(1), startCh = 0;
  chapters.forEach(function (c) { if (c.sec.id === hash) startCh = c.i; });
  var hashT = hash && document.getElementById(hash);
  if (hashT && hashT.closest('.g-ch')) startCh = chapters.map(function (c) { return c.w; }).indexOf(hashT.closest('.g-ch'));
  openChapter(startCh, false);
  pickZone(cur.zone, false);
  updateCounts();
  if (hashT) setTimeout(function () { goTo(hash); }, 50);

  var io = window.IntersectionObserver && new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target === tool) toolSeen = e.isIntersecting; else marginSeen = e.isIntersecting; });
  }, { threshold: 0 });
  if (io) { io.observe(tool); io.observe(margin); }
  function resize() { figs.forEach(function (o) { o.d.size(); o.d.draw(0); }); mDamper.size(); mDamper.draw(0); }
  addEventListener('resize', resize);
  resize();
  runCar(0);
  if (reduced) { carD = len * .55; runCar(0); setScene(SYM[cur.sym].moves[cur.move]); return; }
  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!document.hidden) {
      if (toolSeen) { runCar(dt); runScene(dt); }
      if (marginSeen && margin.offsetWidth) runMargin(dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__guide = { pickZone: pickZone, pickSym: pickSym, openChapter: openChapter, chapters: chapters, seek: function (t) { if (scene) scene.t = t; runScene(0); }, sheet: function () { return sheet; }, open: openSheet, doc: raceTracsDoc };
})();
