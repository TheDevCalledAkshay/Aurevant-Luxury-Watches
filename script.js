(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  /* =========================================================
     1. Mobile Navigation & Active Link
     ========================================================= */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        document.body.classList.remove('nav-open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* =========================================================
     2. Scroll-Scrubbed 3D Canvas Story (index.html)
     ========================================================= */
  const story = document.getElementById('story');
  const stage = document.getElementById('stage');
  const cv = document.getElementById('cv');

  if (story && stage && cv) {
    const ctx = cv.getContext('2d');
    const panels = [...document.querySelectorAll('.panel')];
    const statEls = [...document.querySelectorAll('.stats b')];
    const chap = document.getElementById('chap');
    const cue = document.getElementById('cue');
    const prog = document.getElementById('prog');

    let W = 0, H = 0, dpr = 1, R = 0, F = { x: 0, y: 0 }, mobile = false;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = stage.clientWidth; H = stage.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mobile = W < 760;
      if (mobile) { R = Math.min(W * 0.3, H * 0.2); F = { x: W / 2, y: H * 0.33 }; }
      else { R = Math.min(W * 0.2, H * 0.27); F = { x: W * 0.68, y: H * 0.5 }; }
    }

    /* sky keyframes: [progress, top, bottom] */
    const SKY = [
      [0, '#0a0908', '#15110e'], [.15, '#0c0d11', '#1a1512'], [.24, '#141a24', '#80512f'],
      [.33, '#131119', '#2a1c15'], [.40, '#0f0c0a', '#17120e'], [.57, '#0d0c0b', '#131110'],
      [.76, '#04050a', '#0a0c12'], [.86, '#05060a', '#090b10'], [.915, '#ebe3d1', '#d9cfb8'], [1, '#ece4d3', '#dbd1ba']
    ].map(k => [k[0], hex(k[1]), hex(k[2])]);

    function sky(p) {
      for (let i = 1; i < SKY.length; i++) {
        if (p <= SKY[i][0]) {
          const a = SKY[i - 1], b = SKY[i], t = (p - a[0]) / (b[0] - a[0]);
          return [mixc(a[1], b[1], t), mixc(a[2], b[2], t)];
        }
      }
      const l = SKY[SKY.length - 1]; return [l[1], l[2]];
    }

    /* stars */
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const STARS = Array.from({ length: 170 }, () => ({
      x: rnd(), y: rnd() * .95, r: .3 + rnd() * 1.0,
      a: .35 + rnd() * .65, sp: .6 + rnd() * 1.8, ph: rnd() * TAU
    }));

    function stars(t, alpha) {
      if (alpha < .01) return;
      ctx.fillStyle = '#f3ead6';
      for (const s of STARS) {
        const tw = reduce ? .75 : .55 + .45 * Math.sin(t * s.sp + s.ph);
        ctx.globalAlpha = alpha * tw * s.a;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* mountains */
    function ridge(x, i, off) {
      const f = [.0016, .0022, .003, .004][i], a = [120, 90, 66, 44][i], s = x + off;
      return Math.sin(s * f + i * 3.1) * a * .5 + Math.sin(s * f * 2.3 + i * 1.7) * a * .28 + Math.sin(s * f * 5.1 + i) * a * .12;
    }

    function mountains(p, a, drop) {
      if (a < .01) return;
      const sk = sky(p), k = H / 900;
      ctx.save(); ctx.globalAlpha = a;
      for (let i = 0; i < 4; i++) {
        const base = H * (.57 + i * .072) + drop * (1 + i * .25);
        ctx.fillStyle = rgb(mixc(sk[1], [7, 6, 6], .36 + i * .2));
        ctx.beginPath(); ctx.moveTo(-10, H + 10);
        for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, base + ridge(x, i, p * W * (.25 + i * .22)) * k);
        ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    /* 3D shaded & bevelled gears */
    function gear(g, a, depth = 0) {
      const td = R * .04, ro = g.r + td, ri = g.r - td * 1.15, w = TAU / g.t;
      const traceGearPath = (ox, oy) => {
        ctx.beginPath();
        for (let i = 0; i < g.t; i++) {
          const a0 = g.rot + i * w;
          const P = [[0, ri], [.12, ro], [.38, ro], [.5, ri], [1, ri]];
          P.forEach((q, j) => {
            const ang = a0 + q[0] * w;
            const px = g.x + ox + Math.cos(ang) * q[1];
            const py = g.y + oy + Math.sin(ang) * q[1];
            if (i === 0 && j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
        }
        ctx.closePath();
        const spokes = g.t >= 16 ? 5 : 0;
        if (spokes) {
          for (let k = 0; k < spokes; k++) {
            const s0 = k * TAU / spokes + .14 + g.rot;
            const s1 = s0 + TAU / spokes - .28;
            ctx.moveTo(g.x + ox + Math.cos(s0) * g.r * .74, g.y + oy + Math.sin(s0) * g.r * .74);
            ctx.arc(g.x + ox, g.y + oy, g.r * .74, s0, s1);
            ctx.arc(g.x + ox, g.y + oy, g.r * .3, s1, s0, true);
            ctx.closePath();
          }
        }
      };

      ctx.save();
      ctx.globalAlpha = a;

      // Extruded 3D thickness edge (dark brass underside)
      const extrude = Math.max(3, g.r * .055);
      traceGearPath(extrude * .45, extrude);
      ctx.fillStyle = '#2b1e0d';
      ctx.fill('evenodd');

      // Soft ambient drop shadow
      ctx.shadowColor = `rgba(0,0,0,${.58 + depth * .1})`;
      ctx.shadowBlur = g.r * .22;
      ctx.shadowOffsetX = g.r * .05;
      ctx.shadowOffsetY = g.r * .12;

      // Main brushed-brass face with multi-stop 3D metallic sheen
      traceGearPath(0, 0);
      const gr = ctx.createLinearGradient(g.x - g.r, g.y - g.r, g.x + g.r, g.y + g.r);
      gr.addColorStop(0, '#f7e5b8');
      gr.addColorStop(.28, '#cfa968');
      gr.addColorStop(.52, '#7d5d2b');
      gr.addColorStop(.78, '#d9ba7f');
      gr.addColorStop(1, '#3f2d14');
      ctx.fillStyle = gr;
      ctx.fill('evenodd');

      // Reset shadow for crisp bevels
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Specular top-left bevel highlight
      ctx.strokeStyle = 'rgba(255,242,204,.65)';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // Inner chamfer ring
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * .76, 0, TAU);
      ctx.strokeStyle = 'rgba(255,234,185,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Raised 3D hub
      const hg = ctx.createRadialGradient(g.x - g.r * .05, g.y - g.r * .05, 0, g.x, g.y, g.r * .2);
      hg.addColorStop(0, '#f8e6be');
      hg.addColorStop(.65, '#b68e4d');
      hg.addColorStop(1, '#4c3818');
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * .19, 0, TAU);
      ctx.fillStyle = hg;
      ctx.fill();

      // Ruby jewel bearing with specular glint
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * .09, 0, TAU);
      const jg = ctx.createRadialGradient(g.x - g.r * .028, g.y - g.r * .028, 0, g.x, g.y, g.r * .095);
      jg.addColorStop(0, '#ff8ca0');
      jg.addColorStop(.35, '#d13a52');
      jg.addColorStop(1, '#4d0a16');
      ctx.fillStyle = jg;
      ctx.fill();

      ctx.restore();
    }

    function gearSet(p, a) {
      if (a < .01) return;
      const m = R / 24;
      const A = { x: F.x, y: F.y, r: R, t: 48, rot: p * TAU * 3 };
      const mesh = (P, th, t) => {
        const r = m * t / 2, d = P.r + r;
        return { x: P.x + Math.cos(th) * d, y: P.y + Math.sin(th) * d, r, t, rot: th + Math.PI - (P.rot - th) * P.t / t + Math.PI / t };
      };
      const B = mesh(A, -.75, 20), C = mesh(A, 2.45, 32), D = mesh(B, -1.9, 16), E = mesh(C, 1.5, 18);
      const s = 1 + seg(p, .34, .57) * .16 + seg(p, .57, .64) * .22;
      ctx.save(); ctx.translate(F.x, F.y); ctx.scale(s, s); ctx.translate(-F.x, -F.y);
      [C, E, B, D, A].forEach((g, idx) => gear(g, a, idx * .2));
      ctx.restore();
    }

    /* 3D shaded watch with case reflections, recessed dial, and sapphire glare */
    const LUME = '#cdeedd';
    function watch(x, y, r, o, p, t) {
      const Rc = r * 1.12, caseAng = p * 9;
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = o.a;

      if (o.lume > .01) {
        const lg = ctx.createRadialGradient(0, 0, r * .4, 0, 0, r * 2.4);
        lg.addColorStop(0, `rgba(150,225,195,${.22 * o.lume})`);
        lg.addColorStop(1, 'rgba(150,225,195,0)');
        ctx.fillStyle = lg; ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
      }

      // Leather strap with 3D cylindrical shading
      const sw = r * .8, top = -H * 2, gap = Rc * .55;
      const sg = ctx.createLinearGradient(-sw / 2, 0, sw / 2, 0);
      sg.addColorStop(0, '#0f0705'); sg.addColorStop(.25, '#2b1810'); sg.addColorStop(.5, '#46281c');
      sg.addColorStop(.75, '#26140e'); sg.addColorStop(1, '#0f0705');
      ctx.fillStyle = sg;
      ctx.fillRect(-sw / 2, top, sw, -gap - top);
      ctx.fillRect(-sw / 2, gap, sw, H * 2);
      ctx.strokeStyle = 'rgba(214,180,120,.52)'; ctx.lineWidth = Math.max(1, r * .008);
      ctx.setLineDash([r * .05, r * .04]);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * sw * .4, top); ctx.lineTo(sx * sw * .4, -gap);
        ctx.moveTo(sx * sw * .4, gap); ctx.lineTo(sx * sw * .4, H * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Fluted 3D crown
      const cg = ctx.createLinearGradient(0, -r * .11, 0, r * .11);
      cg.addColorStop(0, '#4f3a1b'); cg.addColorStop(.25, '#f6e4b6'); cg.addColorStop(.55, '#8a6a34');
      cg.addColorStop(.82, '#e3c88f'); cg.addColorStop(1, '#3b2b12');
      ctx.fillStyle = cg;
      ctx.fillRect(Rc * .93, -r * .105, r * .18, r * .21);
      ctx.strokeStyle = 'rgba(30,20,6,.65)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Rc * .93 + i * r * .03, -r * .105);
        ctx.lineTo(Rc * .93 + i * r * .03, r * .105);
        ctx.stroke();
      }

      // 3D Case with deep shadow and sweeping metallic reflections
      ctx.shadowColor = 'rgba(0,0,0,.72)';
      ctx.shadowBlur = r * .36;
      ctx.shadowOffsetX = r * .06;
      ctx.shadowOffsetY = r * .16;
      let cgr;
      if (ctx.createConicGradient) {
        cgr = ctx.createConicGradient(caseAng, 0, 0);
        [[0, '#faebc4'], [.12, '#7d5d2b'], [.25, '#eed7a6'], [.4, '#5a411c'],
         [.55, '#fff0cc'], [.7, '#705226'], [.85, '#e8cd96'], [1, '#faebc4']].forEach(s => cgr.addColorStop(s[0], s[1]));
      } else {
        cgr = ctx.createLinearGradient(-Rc, -Rc, Rc, Rc);
        cgr.addColorStop(0, '#faebc4'); cgr.addColorStop(.5, '#7d5d2d'); cgr.addColorStop(1, '#e8cd96');
      }
      ctx.fillStyle = cgr; ctx.beginPath(); ctx.arc(0, 0, Rc, 0, TAU); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Stepped inner bezel & specular rim
      ctx.fillStyle = '#17120d'; ctx.beginPath(); ctx.arc(0, 0, r * 1.03, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,186,.65)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.035, 0, TAU); ctx.stroke();

      // Recessed enamel dial with depth shadow
      const dg = ctx.createRadialGradient(-r * .3, -r * .35, 0, 0, 0, r);
      dg.addColorStop(0, '#243348'); dg.addColorStop(.7, '#111826'); dg.addColorStop(1, '#070a11');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill();

      // Inner rehaut shadow (gives dial recessed 3D depth)
      const rehaut = ctx.createRadialGradient(0, 0, r * .86, 0, 0, r * .95);
      rehaut.addColorStop(0, 'rgba(0,0,0,0)');
      rehaut.addColorStop(1, 'rgba(0,0,0,.62)');
      ctx.fillStyle = rehaut; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill();

      // Sunburst guilloché rays
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.clip();
      ctx.strokeStyle = 'rgba(214,226,255,.055)'; ctx.lineWidth = .7; ctx.beginPath();
      for (let i = 0; i < 240; i++) {
        const a = i / 240 * TAU;
        ctx.moveTo(Math.cos(a) * r * .1, Math.sin(a) * r * .1);
        ctx.lineTo(Math.cos(a) * r * .95, Math.sin(a) * r * .95);
      }
      ctx.stroke();
      ctx.restore();

      // Minute track
      ctx.strokeStyle = 'rgba(214,190,140,.58)'; ctx.lineWidth = Math.max(.6, r * .004);
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        const a = i / 60 * TAU;
        ctx.moveTo(Math.sin(a) * r * .875, -Math.cos(a) * r * .875);
        ctx.lineTo(Math.sin(a) * r * .915, -Math.cos(a) * r * .915);
      }
      ctx.stroke();

      // Applied 3D indices with subtle drop shadow
      const idxCol = mixc(hex('#e3c88f'), hex(LUME), o.lume);
      ctx.fillStyle = rgb(idxCol);
      if (o.lume > .01) { ctx.shadowColor = LUME; ctx.shadowBlur = r * .055 * o.lume; }
      else { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = r * .02; ctx.shadowOffsetY = r * .01; }
      for (let i = 0; i < 12; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 6);
        if (i === 0) {
          ctx.fillRect(-r * .04, -r * .86, r * .028, r * .13);
          ctx.fillRect(r * .012, -r * .86, r * .028, r * .13);
        } else {
          ctx.fillRect(-r * .016, -r * .86, r * .032, r * .11);
        }
        ctx.restore();
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // Wordmark
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d9bf8a';
      try { ctx.letterSpacing = (r * .03) + 'px'; } catch (e) {}
      ctx.font = `500 ${r * .075}px "Bodoni Moda", Georgia, serif`; ctx.fillText('AUREVANT', 0, -r * .5);
      ctx.fillStyle = 'rgba(217,191,138,.65)';
      ctx.font = `400 ${r * .04}px "Jost", sans-serif`; ctx.fillText('MOONPHASE · VALLÉE DE JOUX', 0, -r * .39);
      try { ctx.letterSpacing = '0px'; } catch (e) {}

      // Moonphase sub-dial
      const my = r * .46, mr = r * .24;
      ctx.save(); ctx.translate(0, my);
      ctx.beginPath(); ctx.arc(0, 0, mr, 0, TAU); ctx.clip();
      const mg = ctx.createLinearGradient(0, -mr, 0, mr);
      mg.addColorStop(0, '#04060c'); mg.addColorStop(1, '#162442');
      ctx.fillStyle = mg; ctx.fillRect(-mr, -mr, mr * 2, mr * 2);
      ctx.fillStyle = '#f0e6cf';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * 2.4) * mr * .8, Math.sin(i * 3.7) * mr * .75, mr * .018, 0, TAU);
        ctx.fill();
      }
      const mx = Math.sin(p * 7) * mr * .15, moonR = mr * .52;
      const moonGrad = ctx.createRadialGradient(mx - moonR * .25, -mr * .1, 0, mx, -mr * .05, moonR);
      moonGrad.addColorStop(0, '#fff7e0'); moonGrad.addColorStop(1, '#d6c194');
      ctx.fillStyle = moonGrad; ctx.beginPath(); ctx.arc(mx, -mr * .05, moonR, 0, TAU); ctx.fill();
      const ph = (p * 2.2) % 1, sh = lerp(-moonR * 2.1, moonR * 2.1, ph);
      ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.arc(mx + sh, -mr * .05, moonR * 1.02, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#c9a76b'; ctx.lineWidth = Math.max(1, r * .012);
      ctx.beginPath(); ctx.arc(0, my, mr, 0, TAU); ctx.stroke();

      // Faceted dauphine hands with 3D ridge
      const T = ease(seg(p, .575, .74)) * 2050;
      const hAng = (T / 720) * TAU, mAng = ((T % 60) / 60) * TAU;
      const sAng = reduce ? 1.6 : ((t % 60) / 60) * TAU;
      const hg = ctx.createLinearGradient(-r * .06, 0, r * .06, 0);
      hg.addColorStop(0, '#fae8bc'); hg.addColorStop(.5, '#a9854a'); hg.addColorStop(1, '#f0d9a2');

      const hand = (len, tail, w, ang) => {
        ctx.save(); ctx.rotate(ang);
        ctx.shadowColor = 'rgba(0,0,0,.62)'; ctx.shadowBlur = r * .035; ctx.shadowOffsetY = r * .018;
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.moveTo(0, tail); ctx.lineTo(-w, 0); ctx.lineTo(0, -len); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(0,0,0,.32)';
        ctx.beginPath(); ctx.moveTo(0, tail); ctx.lineTo(w, 0); ctx.lineTo(0, -len); ctx.closePath(); ctx.fill();
        if (o.lume > .01) {
          ctx.shadowColor = LUME; ctx.shadowBlur = r * .06 * o.lume;
          ctx.fillStyle = `rgba(205,238,221,${o.lume})`;
          ctx.beginPath(); ctx.moveTo(0, tail * .2); ctx.lineTo(-w * .5, -len * .08);
          ctx.lineTo(0, -len * .86); ctx.lineTo(w * .5, -len * .08); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      };
      hand(r * .5, r * .08, r * .055, hAng);
      hand(r * .79, r * .1, r * .04, mAng);

      // Seconds hand
      ctx.save(); ctx.rotate(sAng);
      ctx.strokeStyle = '#c4553d'; ctx.lineWidth = Math.max(1, r * .011);
      ctx.beginPath(); ctx.moveTo(0, r * .2); ctx.lineTo(0, -r * .84); ctx.stroke();
      ctx.fillStyle = '#c4553d'; ctx.beginPath(); ctx.arc(0, r * .15, r * .026, 0, TAU); ctx.fill();
      ctx.restore();

      // Center pinion
      ctx.fillStyle = '#d9bf8a'; ctx.beginPath(); ctx.arc(0, 0, r * .04, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a140c'; ctx.beginPath(); ctx.arc(0, 0, r * .012, 0, TAU); ctx.fill();

      // Sapphire crystal curved reflection & specular sweep
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.clip();
      const gp = .28 + .42 * (.5 + .5 * Math.sin(p * 9));
      const gg = ctx.createLinearGradient(-r, -r, r, r);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(clamp(gp - .12), 'rgba(255,255,255,0)');
      gg.addColorStop(gp, 'rgba(255,255,255,.15)');
      gg.addColorStop(clamp(gp + .12), 'rgba(255,255,255,0)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg; ctx.fillRect(-r, -r, r * 2, r * 2);

      // Domed crystal arc highlight
      const dome = ctx.createRadialGradient(-r * .38, -r * .42, 0, -r * .25, -r * .25, r * .85);
      dome.addColorStop(0, 'rgba(255,250,240,.12)');
      dome.addColorStop(.55, 'rgba(255,250,240,.02)');
      dome.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = dome; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();

      ctx.restore();
    }

    /* main draw */
    function draw(p, t) {
      ctx.clearRect(0, 0, W, H);
      const sk = sky(p);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(sk[0])); g.addColorStop(1, rgb(sk[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      stars(t, Math.max(.55 * (1 - seg(p, .05, .14)), seg(p, .74, .79) * (1 - seg(p, .86, .9))));

      const sunA = seg(p, .07, .18) * (1 - seg(p, .32, .38));
      if (sunA > .01) {
        const sy = F.y + R * lerp(.95, .05, ease(seg(p, .07, .28)));
        const gl = ctx.createRadialGradient(F.x, sy, R * .5, F.x, sy, R * 3.2);
        gl.addColorStop(0, `rgba(255,190,120,${.4 * sunA})`); gl.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
        const sg = ctx.createRadialGradient(F.x - R * .2, sy - R * .25, R * .1, F.x, sy, R);
        sg.addColorStop(0, '#f8e2b4'); sg.addColorStop(1, '#d68f55');
        ctx.globalAlpha = sunA; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(F.x, sy, R, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }

      mountains(p, seg(p, .08, .15) * (1 - seg(p, .34, .4)), (1 - ease(seg(p, .08, .17))) * H * .3 + ease(seg(p, .33, .4)) * H * .35);

      const ringA = 1 - seg(p, .06, .14);
      if (ringA > .01) {
        const drawn = reduce ? 1 : clamp(t / 1.3);
        ctx.save(); ctx.globalAlpha = ringA;
        ctx.strokeStyle = 'rgba(196,160,106,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(F.x, F.y, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(214,180,120,.95)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(F.x, F.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * ease(drawn)); ctx.stroke();
        ctx.strokeStyle = 'rgba(196,160,106,.4)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const a = i / 60 * TAU, l = i % 5 === 0 ? .06 : .028;
          ctx.moveTo(F.x + Math.sin(a) * R * 1.05, F.y - Math.cos(a) * R * 1.05);
          ctx.lineTo(F.x + Math.sin(a) * R * (1.05 + l), F.y - Math.cos(a) * R * (1.05 + l));
        }
        ctx.stroke();
        const da = reduce ? 0 : t * .5;
        ctx.fillStyle = '#f0d9a2'; ctx.shadowColor = '#e0b878'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(F.x + Math.sin(da) * R, F.y - Math.cos(da) * R, 3.2, 0, TAU); ctx.fill();
        ctx.restore();
      }

      gearSet(p, seg(p, .34, .42) * (1 - seg(p, .56, .65)));

      const wa = seg(p, .55, .62);
      if (wa > .01) {
        const lume = seg(p, .77, .8) * (1 - seg(p, .85, .9));
        watch(F.x, F.y, R * lerp(.72, 1, ease(seg(p, .55, .67))), { a: wa, lume }, p, t);
      }
    }

    /* scroll plumbing */
    let target = 0, p = 0, inView = true, lastChap = -1;
    const CH = ['Prologue', 'I · The valley', 'II · The hands', 'III · The dial', 'IV · The night', 'V · The promise'];
    const BOUNDS = [0, .15, .35, .57, .775, .865];

    function readScroll() {
      const r = story.getBoundingClientRect();
      const total = story.offsetHeight - window.innerHeight;
      target = clamp(-r.top / total);
      inView = r.bottom > -50 && r.top < window.innerHeight + 50;
      if (prog) {
        const de = document.documentElement;
        const max = de.scrollHeight - window.innerHeight;
        prog.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
      }
    }

    function updatePanels() {
      const fi = .022;
      panels.forEach(el => {
        const a = +el.dataset.a, b = +el.dataset.b;
        const inn = a === 0 ? 1 : clamp((p - a) / fi);
        const out = b === 1 ? 1 : clamp((b - p) / fi);
        const o = Math.min(inn, out);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < .01 ? 'hidden' : 'visible';
        el.style.transform = `translateY(${((1 - inn) * 26 - (1 - out) * 26).toFixed(1)}px)`;
        el.style.pointerEvents = o > .6 ? 'auto' : 'none';
      });
      const c = ease(seg(p, .385, .5));
      statEls.forEach(el => { el.textContent = Math.round(+el.dataset.n * c); });
      stage.classList.toggle('light', p > .905);
      if (cue) cue.style.opacity = p < .02 ? 1 : 0;
      let ci = 0; BOUNDS.forEach((b, i) => { if (p >= b) ci = i; });
      if (p >= .9) ci = 5;
      if (chap && ci !== lastChap) { lastChap = ci; chap.textContent = CH[ci]; }
    }

    function frame(ts) {
      readScroll();
      p += (target - p) * (reduce ? 1 : .085);
      if (Math.abs(target - p) < .0003) p = target;
      if (inView) { draw(p, ts / 1000); updatePanels(); }
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    p = target = 0;
    updatePanels();
    requestAnimationFrame(frame);
  }

  /* =========================================================
     3. 3D Mouse-Tracking Tilt & Glare on Watch Cards
     ========================================================= */
  if (!reduce) {
    document.querySelectorAll('.watch-card-3d').forEach(card => {
      let rafId = null;
      let targetRx = 0, targetRy = 0, gx = 50, gy = 30;

      const applyTilt = () => {
        card.style.setProperty('--rx', `${targetRx.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${targetRy.toFixed(2)}deg`);
        const glare = card.querySelector('.watch-glare');
        if (glare) {
          glare.style.setProperty('--gx', `${gx.toFixed(1)}%`);
          glare.style.setProperty('--gy', `${gy.toFixed(1)}%`);
        }
        rafId = null;
      };

      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        targetRy = (nx - .5) * 14;
        targetRx = (.5 - ny) * 14;
        gx = nx * 100;
        gy = ny * 100;
        if (!rafId) rafId = requestAnimationFrame(applyTilt);
      });

      card.addEventListener('mouseleave', () => {
        targetRx = 0; targetRy = 0; gx = 50; gy = 30;
        if (!rafId) rafId = requestAnimationFrame(applyTilt);
      });
    });
  }

  /* =========================================================
     4. Scroll-Reveal System (IntersectionObserver)
     ========================================================= */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      reveals.forEach(el => el.classList.add('revealed'));
    } else {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.14 });
      reveals.forEach(el => io.observe(el));
    }
  }

  /* =========================================================
     5. Subtle Parallax for Heritage & Atelier Backgrounds
     ========================================================= */
  const parallaxEls = [...document.querySelectorAll('.parallax')];
  if (parallaxEls.length && !reduce) {
    let pRaf = null;
    const updateParallax = () => {
      const vh = window.innerHeight;
      parallaxEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > -100 && rect.top < vh + 100) {
          const offset = ((rect.top + rect.height / 2) - vh / 2) * -0.06;
          el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
        }
      });
      pRaf = null;
    };
    window.addEventListener('scroll', () => {
      if (!pRaf) pRaf = requestAnimationFrame(updateParallax);
    }, { passive: true });
    updateParallax();
  }

  /* =========================================================
     6. Smooth-Scroll Anchors
     ========================================================= */
  document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    const el = document.getElementById(a.dataset.go);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }));

  /* =========================================================
     7. Copy Email & Viewing Form Feedback (atelier.html)
     ========================================================= */
  const copyBtn = document.getElementById('copy');
  const toast = document.getElementById('toast');
  if (copyBtn && toast) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('atelier@aurevant.example');
        toast.textContent = 'Address copied';
      } catch (e) {
        toast.textContent = 'Select the address above to copy it';
      }
      setTimeout(() => { toast.textContent = ''; }, 2600);
    });
  }

  const visitForm = document.getElementById('visitForm');
  if (visitForm) {
    visitForm.addEventListener('submit', e => {
      e.preventDefault();
      const btn = visitForm.querySelector('button[type="submit"]');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Request Received — We Will Write Soon';
        btn.disabled = true;
        setTimeout(() => {
          visitForm.reset();
          btn.textContent = original;
          btn.disabled = false;
        }, 4000);
      }
    });
  }
})();
