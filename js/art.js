/* =========================================================
   Canvas 渲染层 —— 全部人偶/场景/特效均为程序化矢量绘制
   ========================================================= */
window.Art = (function () {
  const W = 1280, H = 720;

  const CHARS = {
    fez:    { kind: 'bear',    fur: '#7d5327', fur2: '#a97b3f', dark: '#33200d', eye: '#ffd35a', bow: '#8b1f26', hat: true, mic: true },
    spring: { kind: 'rabbit',  fur: '#5e4a7a', fur2: '#8a74a8', dark: '#221a30', eye: '#c86bff', bow: '#3b2a52', guitar: true },
    chica:  { kind: 'chicken', fur: '#c9a02e', fur2: '#e8c65a', dark: '#4d3c0d', eye: '#ffdf7a', bib: true },
    fox:    { kind: 'fox',     fur: '#8a3520', fur2: '#b8523a', dark: '#33110a', eye: '#ffe06a', patch: true, hook: true },
    puppet: { kind: 'puppet',  fur: '#d8d2c4', fur2: '#f2ecdd', dark: '#22201c', eye: '#79e2ff' },
    glitch: { kind: 'bear',    fur: '#281a38', fur2: '#6b3fa0', dark: '#100819', eye: '#8affd8', glitch: true },
    gold:   { kind: 'bear',    fur: '#9c7d2c', fur2: '#d9bb5e', dark: '#332605', eye: '#fff6c0', hat: true, bow: '#5b1a1a' }
  };

  const CAM_INFO = {
    '1A': '主舞台', '1B': '餐厅', '2A': '西走廊', '2B': '西角',
    '3': '厨房', '4A': '东走廊', '4B': '东角', '5': '海盗湾',
    '6': '后台', '7': '通风口'
  };

  let noiseFrames = [], scanPat = null, officeBg = null;

  /* ---------------- 基础工具 ---------------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function vgrad(ctx, x, y, w, h, c0, c1) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function init() {
    for (let f = 0; f < 4; f++) {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 180;
      const g = c.getContext('2d');
      const img = g.createImageData(320, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 255;
      }
      g.putImageData(img, 0, 0);
      noiseFrames.push(c);
    }
    const sc = document.createElement('canvas');
    sc.width = 4; sc.height = 4;
    const sg = sc.getContext('2d');
    sg.fillStyle = 'rgba(0,0,0,0.55)';
    sg.fillRect(0, 3, 4, 1);
    scanPat = sc;
    officeBg = buildOfficeBg();
  }

  function noiseOverlay(ctx, x, y, w, h, alpha, frame) {
    if (!noiseFrames.length) return;
    const n = noiseFrames[frame % noiseFrames.length];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(n, x, y, w, h);
    ctx.restore();
  }

  /* ---------------- 办公室静态背景 ---------------- */
  function buildOfficeBg() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    // 墙
    g.fillStyle = vgrad(g, 0, 0, W, 640, '#2b2023', '#0e0a0b');
    g.fillRect(0, 0, W, 640);
    // 天花板
    g.fillStyle = vgrad(g, 0, 0, W, 130, '#0c090a', '#1c1316');
    g.fillRect(0, 0, W, 130);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 126, W, 6);

    // 地板
    g.fillStyle = vgrad(g, 0, 600, W, 120, '#171113', '#070405');
    g.fillRect(0, 600, W, 120);

    // 墙面污渍与管道
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(0,0,0,' + rand(0.05, 0.22).toFixed(2) + ')';
      const bw = rand(30, 180), bh = rand(20, 120);
      g.beginPath();
      g.ellipse(rand(0, W), rand(120, 600), bw, bh, rand(0, 3), 0, 7);
      g.fill();
    }
    // 横向管道
    g.fillStyle = '#191216'; g.fillRect(0, 148, W, 12);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 148, W, 3);
    g.fillStyle = '#191216'; g.fillRect(0, 90, W, 7);

    // 海报 1（左）
    g.save();
    g.translate(392, 208); g.rotate(-0.02);
    g.fillStyle = '#241a16'; g.fillRect(-70, -80, 140, 168);
    g.fillStyle = '#3a2a20'; g.fillRect(-62, -72, 124, 152);
    g.fillStyle = 'rgba(216,162,74,0.5)';
    g.font = '700 15px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('CELEBRATE!', 0, -50);
    // 熊剪影
    g.fillStyle = '#5e4526';
    g.beginPath(); g.arc(0, -2, 30, 0, 7); g.fill();
    g.beginPath(); g.arc(-26, -26, 11, 0, 7); g.fill();
    g.beginPath(); g.arc(26, -26, 11, 0, 7); g.fill();
    g.fillStyle = '#2a1e14';
    g.beginPath(); g.arc(-10, -6, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(10, -6, 4, 0, 7); g.fill();
    g.font = '600 10px "Courier New",monospace'; g.fillStyle = 'rgba(216,162,74,0.45)';
    g.fillText('FREDDY FAZBEAR\'S', 0, 56);
    g.restore();

    // 海报 2（右）
    g.save();
    g.translate(892, 214); g.rotate(0.03);
    g.fillStyle = '#1e1a1c'; g.fillRect(-72, -84, 144, 170);
    g.fillStyle = '#2c2226'; g.fillRect(-64, -76, 128, 154);
    g.fillStyle = 'rgba(200,80,80,0.4)';
    g.font = '700 13px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('PIRATE COVE', 0, -54);
    g.fillStyle = '#6a2a1e';
    g.beginPath(); g.moveTo(0, -34); g.lineTo(28, 10); g.lineTo(-28, 10); g.closePath(); g.fill();
    g.fillStyle = '#120c0c';
    g.beginPath(); g.arc(-8, -12, 4, 0, 7); g.fill();
    g.strokeStyle = '#120c0c'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-28, -12); g.lineTo(28, -12); g.stroke();
    g.restore();

    // 中央标牌
    g.save();
    g.translate(640, 196);
    g.fillStyle = '#0f0c0d'; rr(g, -132, -44, 264, 88, 6); g.fill();
    g.strokeStyle = 'rgba(216,162,74,0.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(216,162,74,0.75)';
    g.font = '700 24px Georgia,serif'; g.textAlign = 'center';
    g.fillText('ECHO ARCHIVE', 0, -6);
    g.font = '600 14px "Courier New",monospace';
    g.fillStyle = 'rgba(190,170,150,0.6)';
    g.fillText('B6 · 回声档案馆 · 夜班', 0, 22);
    g.restore();

    // 桌面
    const deskTop = [[70, 612], [1210, 612], [1280, 720], [0, 720]];
    g.fillStyle = vgrad(g, 0, 612, 0, 108, '#2b2123', '#150f11');
    poly(g, deskTop); g.fill();
    // 桌沿高光
    g.fillStyle = 'rgba(255,225,190,0.07)';
    poly(g, [[70, 612], [1210, 612], [1204, 620], [76, 620]]); g.fill();
    // 抽屉面板
    g.fillStyle = 'rgba(0,0,0,0.28)';
    poly(g, [[360, 660], [900, 660], [920, 720], [340, 720]]); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 3; i++) {
      g.fillRect(430 + i * 150, 676, 110, 4);
    }

    // 桌上物件：纸堆
    g.save(); g.translate(760, 640); g.rotate(-0.05);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#b9b3a4' : '#8e887c';
      g.fillRect(-52 + i, -6 - i * 2, 108, 6);
    }
    g.restore();
    // 马克杯
    g.save(); g.translate(980, 636);
    g.fillStyle = '#2e2a28'; rr(g, -18, -34, 36, 36, 5); g.fill();
    g.fillStyle = '#3a3532'; rr(g, -18, -34, 36, 8, 4); g.fill();
    g.strokeStyle = '#2e2a28'; g.lineWidth = 6;
    g.beginPath(); g.arc(22, -16, 11, -1.2, 1.2); g.stroke();
    g.restore();
    // 台灯（点亮）
    g.save(); g.translate(1108, 620);
    g.fillStyle = '#161113'; g.fillRect(-6, -44, 12, 44);
    g.beginPath(); g.ellipse(0, 2, 26, 8, 0, 0, 7); g.fill();
    const shadeG = g.createLinearGradient(0, -80, 0, -44);
    shadeG.addColorStop(0, '#3d2c20');
    shadeG.addColorStop(1, '#5a4028');
    g.fillStyle = shadeG;
    poly(g, [[-36, -78], [36, -78], [22, -46], [-22, -46]]); g.fill();
    const lampGlow = g.createRadialGradient(0, -52, 4, 0, -52, 120);
    lampGlow.addColorStop(0, 'rgba(255,214,150,0.55)');
    lampGlow.addColorStop(0.4, 'rgba(255,196,130,0.18)');
    lampGlow.addColorStop(1, 'rgba(255,196,130,0)');
    g.fillStyle = lampGlow;
    g.beginPath(); g.arc(0, -52, 120, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,235,200,0.8)';
    g.beginPath(); g.arc(0, -60, 5, 0, 7); g.fill();
    g.restore();
    // 风扇底座
    g.save(); g.translate(432, 634);
    g.fillStyle = '#141013'; g.beginPath(); g.ellipse(0, 6, 44, 11, 0, 0, 7); g.fill();
    g.fillStyle = '#1c171a'; g.fillRect(-6, -58, 12, 62);
    g.restore();

    // 通风口外框
    g.fillStyle = '#0a0809';
    rr(g, 466, 8, 268, 92, 8); g.fill();
    g.strokeStyle = '#241c1c'; g.lineWidth = 5; g.stroke();

    // 桌面暖光（台灯）
    const lamp = g.createRadialGradient(1090, 590, 20, 1090, 590, 520);
    lamp.addColorStop(0, 'rgba(255,190,120,0.16)');
    lamp.addColorStop(0.5, 'rgba(255,170,110,0.06)');
    lamp.addColorStop(1, 'rgba(255,170,110,0)');
    g.fillStyle = lamp; g.fillRect(0, 300, W, 420);

    // 整体压暗
    const vg = g.createRadialGradient(640, 400, 210, 640, 420, 760);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    return c;
  }

  /* ---------------- 走廊（门外） ---------------- */
  function corridor(ctx, x0, y0, x1, y1, lit, t) {
    const w = x1 - x0, h = y1 - y0;
    const fx0 = x0 + w * 0.22, fx1 = x1 - w * 0.22;
    const fy0 = y0 + h * 0.24, fy1 = y1 - h * 0.14;

    ctx.fillStyle = '#050406';
    ctx.fillRect(x0, y0, w, h);

    // 地板
    ctx.fillStyle = lit ? '#3b3027' : '#0b090a';
    poly(ctx, [[x0, y1], [x1, y1], [fx1, fy1], [fx0, fy1]]); ctx.fill();
    // 地砖线
    ctx.strokeStyle = lit ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const tt = i / 5;
      const yy = y1 + (fy1 - y1) * tt;
      ctx.beginPath();
      ctx.moveTo(x0 + (fx0 - x0) * tt, yy);
      ctx.lineTo(x1 + (fx1 - x1) * tt, yy);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const xx = x0 + w * (i / 4);
      ctx.beginPath();
      ctx.moveTo(xx, y1);
      ctx.lineTo(fx0 + (fx1 - fx0) * (i / 4), fy1);
      ctx.stroke();
    }

    // 侧墙
    ctx.fillStyle = lit ? '#2e251e' : '#080607';
    poly(ctx, [[x0, y0], [x0, y1], [fx0, fy1], [fx0, fy0]]); ctx.fill();
    ctx.fillStyle = lit ? '#241d18' : '#070506';
    poly(ctx, [[x1, y0], [x1, y1], [fx1, fy1], [fx1, fy0]]); ctx.fill();
    // 顶
    ctx.fillStyle = lit ? '#221b16' : '#060506';
    poly(ctx, [[x0, y0], [x1, y0], [fx1, fy0], [fx0, fy0]]); ctx.fill();

    // 尽头墙
    ctx.fillStyle = lit ? '#4c3d30' : '#0d0b0c';
    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    // 尽头的门洞（纵深）
    const iw = fx1 - fx0, ih = fy1 - fy0;
    ctx.fillStyle = lit ? '#0b0908' : '#040305';
    ctx.fillRect(fx0 + iw * 0.33, fy0 + ih * 0.34, iw * 0.34, ih * 0.66);

    // 尽头紧急出口灯
    const ex = (fx0 + fx1) / 2, ey = fy0 + ih * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(ex, ey, 2, ex, ey, w * 0.42);
    eg.addColorStop(0, lit ? 'rgba(255,90,70,0.42)' : 'rgba(200,50,40,0.18)');
    eg.addColorStop(1, 'rgba(200,50,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, w * 0.42, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = lit ? '#ff7a62' : 'rgba(190,60,50,0.6)';
    ctx.fillRect(ex - 15, ey - 3, 30, 6);

    if (lit) {
      // 顶灯
      ctx.fillStyle = '#e8d3a8';
      ctx.fillRect(x0 + w * 0.30, y0 + 4, w * 0.40, 5);
      // 暖色光wash
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,228,182,0.30)');
      g.addColorStop(0.5, 'rgba(255,214,168,0.09)');
      g.addColorStop(1, 'rgba(255,200,150,0.03)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
      // 前方地面反光
      const fg = ctx.createLinearGradient(0, fy1, 0, y1);
      fg.addColorStop(0, 'rgba(255,220,170,0)');
      fg.addColorStop(1, 'rgba(255,220,170,0.10)');
      ctx.fillStyle = fg;
      poly(ctx, [[x0, y1], [x1, y1], [fx1, fy1], [fx0, fy1]]); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(x0, y0, w, h);
    }
  }

  /* ---------------- 人偶头部 ---------------- */
  function eye(ctx, x, y, r, col, glow, flick) {
    if (glow) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, col);
      g.addColorStop(0.25, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (flick === undefined ? 1 : flick) * 0.85;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 5, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 0.05, r * 0.38, 0, 7); ctx.fill();
  }

  function head(ctx, id, cx, cy, sc, open, opt) {
    const c = CHARS[id] || CHARS.fez;
    opt = opt || {};
    const flick = opt.flick === undefined ? 1 : opt.flick;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);

    const R = 44;
    // 耳
    if (c.kind === 'bear') {
      ctx.fillStyle = c.fur;
      ctx.beginPath(); ctx.arc(-36, -36, 17, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(36, -36, 17, 0, 7); ctx.fill();
      ctx.fillStyle = c.fur2;
      ctx.beginPath(); ctx.arc(-36, -36, 9, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(36, -36, 9, 0, 7); ctx.fill();
    } else if (c.kind === 'rabbit') {
      ctx.fillStyle = c.fur;
      ctx.save(); ctx.translate(-25, -40); ctx.rotate(-0.14);
      ctx.beginPath(); ctx.ellipse(0, -46, 11, 48, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c.fur2;
      ctx.beginPath(); ctx.ellipse(0, -46, 5, 38, 0, 0, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.fur;
      ctx.save(); ctx.translate(25, -40); ctx.rotate(0.14);
      ctx.beginPath(); ctx.ellipse(0, -46, 11, 48, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c.fur2;
      ctx.beginPath(); ctx.ellipse(0, -46, 5, 38, 0, 0, 7); ctx.fill();
      ctx.restore();
    } else if (c.kind === 'fox') {
      ctx.fillStyle = c.fur;
      poly(ctx, [[-42, -28], [-20, -80], [-6, -30]]); ctx.fill();
      poly(ctx, [[42, -28], [20, -80], [6, -30]]); ctx.fill();
      ctx.fillStyle = c.dark;
      poly(ctx, [[-34, -32], [-22, -66], [-14, -32]]); ctx.fill();
      poly(ctx, [[34, -32], [22, -66], [14, -32]]); ctx.fill();
    } else if (c.kind === 'chicken') {
      ctx.fillStyle = c.fur2;
      poly(ctx, [[-4, -44], [-22, -78], [-2, -70]]); ctx.fill();
      poly(ctx, [[4, -44], [22, -78], [2, -70]]); ctx.fill();
      poly(ctx, [[0, -46], [0, -86], [10, -66]]); ctx.fill();
    } else if (c.kind === 'puppet') {
      // 提线面具：无耳，细长
    }

    // 头主体
    ctx.fillStyle = c.fur;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.98, 0, 0, 7); ctx.fill();
    // 高光
    ctx.save();
    const hg = ctx.createRadialGradient(-16, -18, 4, 0, 0, R);
    hg.addColorStop(0, 'rgba(255,255,255,0.16)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.98, 0, 0, 7); ctx.fill();
    ctx.restore();

    if (c.kind === 'puppet') {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.85, R * 0.9, 0, 0, 7); ctx.stroke();
      // 泪痕
      ctx.fillStyle = 'rgba(40,30,50,0.75)';
      ctx.fillRect(-26, -2, 9, 40);
      ctx.fillRect(17, -2, 9, 40);
      ctx.fillStyle = 'rgba(180,60,70,0.35)';
      ctx.beginPath(); ctx.arc(-24, 12, 8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(24, 12, 8, 0, 7); ctx.fill();
    }

    // 口鼻
    if (c.kind === 'chicken') {
      // 喙
      ctx.fillStyle = '#e2a33c';
      poly(ctx, [[-23, 10], [23, 10], [0, open ? 42 : 32]]); ctx.fill();
      ctx.fillStyle = '#bd7c24';
      poly(ctx, [[-18, open ? 42 : 32], [18, open ? 42 : 32], [0, open ? 58 : 44]]); ctx.fill();
      if (open) {
        ctx.fillStyle = '#0b0608';
        poly(ctx, [[-14, 40], [14, 40], [0, 56]]); ctx.fill();
      }
    } else if (c.kind !== 'puppet') {
      ctx.fillStyle = c.fur2;
      ctx.beginPath(); ctx.ellipse(0, 20, 29, 21, 0, 0, 7); ctx.fill();

      if (open) {
        // 张开的嘴
        ctx.fillStyle = '#0b0608';
        rr(ctx, -19, 23, 38, 29, 9); ctx.fill();
        ctx.fillStyle = 'rgba(110,18,26,0.55)';
        rr(ctx, -11, 37, 22, 10, 5); ctx.fill();
        // 上下牙
        ctx.fillStyle = '#e8e2cf';
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(i * 8 - 4, 23, 7, 9);
          ctx.fillRect(i * 8 - 4, 43, 7, 9);
        }
        // 下颚阴影
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(0, 52, 22, 6, 0, 0, 7); ctx.fill();
      } else {
        // 闭口：牙缝线
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-18, 31); ctx.lineTo(18, 31); ctx.stroke();
        ctx.fillStyle = '#ded8c6';
        for (let i = -2; i <= 2; i++) ctx.fillRect(i * 8 - 4, 31, 7, 6);
      }

      // 鼻
      ctx.fillStyle = c.dark;
      ctx.beginPath(); ctx.ellipse(0, 7, 9, 6.5, 0, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#2a2028';
      ctx.beginPath(); ctx.ellipse(0, 26, 10, 7, 0, 0, 7); ctx.fill();
    }

    // 眼窝阴影
    const ey = -10;
    if (c.kind !== 'puppet') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(-18, ey, 13, 11.5, 0, 0, 7); ctx.fill();
      if (c.kind !== 'fox') {
        ctx.beginPath(); ctx.ellipse(18, ey, 13, 11.5, 0, 0, 7); ctx.fill();
      }
    }

    // 眼
    if (c.kind === 'fox') {
      ctx.fillStyle = '#1a1210';
      ctx.beginPath(); ctx.arc(19, ey, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, ey - 12); ctx.lineTo(34, ey + 4); ctx.stroke();
      eye(ctx, -18, ey, 8, c.eye, true, flick);
    } else {
      eye(ctx, -18, ey, 8, c.eye, true, flick);
      eye(ctx, 18, ey, 8, c.eye, true, flick);
    }

    // 帽子 / 领结
    if (c.hat) {
      ctx.fillStyle = '#141014';
      rr(ctx, -30, -58, 60, 10, 4); ctx.fill();
      rr(ctx, -20, -88, 40, 32, 4); ctx.fill();
      ctx.fillStyle = c.bow || '#8b1f26';
      rr(ctx, -21, -64, 42, 7, 3); ctx.fill();
    }
    if (c.glitch) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(performance.now() / 90);
      ctx.fillStyle = '#00ffcc';
      ctx.translate(3, 0);
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.98, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff00aa';
      ctx.translate(-6, 0);
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.98, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------- 全身人偶 ---------------- */
  function body(ctx, id, x, y, s, t, opt) {
    opt = opt || {};
    const c = CHARS[id];
    if (!c) return;
    const bob = Math.sin(t * 1.4 + (opt.phase || 0)) * 2.5;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;

    if (c.kind === 'puppet') {
      // 细长身形
      ctx.fillStyle = c.dark;
      rr(ctx, -14, -84, 28, 92, 8); ctx.fill();
      ctx.fillStyle = c.fur;
      rr(ctx, -18, -128, 36, 60, 12); ctx.fill();
      // 细长手臂
      ctx.strokeStyle = c.fur; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-18, -118); ctx.quadraticCurveTo(-58, -80, -46, -46 + Math.sin(t * 1.1) * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, -118); ctx.quadraticCurveTo(58, -80, 46, -46 - Math.sin(t * 1.1) * 8); ctx.stroke();
      ctx.restore();
      head(ctx, id, x, y - 172 + bob, s * 0.92, false, opt);
      return;
    }

    // 腿
    ctx.fillStyle = c.fur;
    rr(ctx, -24, -74, 20, 78, 8); ctx.fill();
    rr(ctx, 4, -74, 20, 78, 8); ctx.fill();
    // 脚
    ctx.fillStyle = c.dark;
    ctx.beginPath(); ctx.ellipse(-16, 2, 21, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, 2, 21, 9, 0, 0, 7); ctx.fill();

    // 躯干
    ctx.fillStyle = c.fur;
    ctx.beginPath(); ctx.ellipse(0, -112, 47, 62, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c.fur2;
    ctx.beginPath(); ctx.ellipse(0, -104, 28, 40, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, -150, 40, 20, 0, 0, 7); ctx.fill();

    // 手臂
    ctx.fillStyle = c.fur;
    ctx.save(); ctx.translate(-48, -150); ctx.rotate(0.12 + Math.sin(t * 1.2) * 0.02);
    rr(ctx, -9, 0, 18, 84, 9); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(48, -150); ctx.rotate(-0.12 - Math.sin(t * 1.2) * 0.02);
    rr(ctx, -9, 0, 18, 84, 9); ctx.fill();
    ctx.restore();
    // 手
    ctx.beginPath(); ctx.arc(-54, -62, 12, 0, 7); ctx.fill();
    if (c.hook) {
      ctx.strokeStyle = '#b9b3a4'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(60, -56, 13, -0.4, 2.2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(54, -62, 12, 0, 7); ctx.fill();
    }

    // 领结 / 围兜
    if (c.bow) {
      ctx.fillStyle = c.bow;
      poly(ctx, [[-2, -152], [-20, -160], [-20, -142]]); ctx.fill();
      poly(ctx, [[2, -152], [20, -160], [20, -142]]); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -151, 4, 0, 7); ctx.fill();
    }
    if (c.bib) {
      ctx.fillStyle = '#e8e0cc';
      poly(ctx, [[-22, -146], [22, -146], [26, -108], [-26, -108]]); ctx.fill();
      ctx.fillStyle = '#b33a3a';
      ctx.font = '700 10px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('LET\'S EAT', 0, -122);
    }
    // 麦克风 / 吉他
    if (c.mic) {
      ctx.strokeStyle = '#2a2226'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(54, -62); ctx.lineTo(66, -104); ctx.stroke();
      ctx.fillStyle = '#3a3236';
      ctx.beginPath(); ctx.arc(67, -108, 8, 0, 7); ctx.fill();
    }
    if (c.guitar) {
      ctx.save(); ctx.translate(-62, -66); ctx.rotate(-0.35);
      ctx.fillStyle = '#7a2222';
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 26, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a2a20';
      rr(ctx, -4, -58, 8, 40, 3); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    head(ctx, id, x, y - 190 + bob, s * 1.0, !!opt.open, opt);
  }

  /* ---------------- 监控画面 ---------------- */
  function floorGrid(ctx, x, y, w, h, horizon, ca, cb) {
    const rows = 7, cols = 9;
    for (let r = 0; r < rows; r++) {
      const t0 = Math.pow(r / rows, 1.9), t1 = Math.pow((r + 1) / rows, 1.9);
      const y0 = horizon + (y + h - horizon) * t0;
      const y1 = horizon + (y + h - horizon) * t1;
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        ctx.fillStyle = (r + cIdx) % 2 ? ca : cb;
        ctx.fillRect(x + (w / cols) * cIdx, y0, w / cols + 1, y1 - y0 + 1);
      }
    }
  }

  function drawRoom(ctx, S, cam, t, X, Y, WW, HH) {
    ctx.save();
    ctx.beginPath(); ctx.rect(X, Y, WW, HH); ctx.clip();

    const groundY = Y + HH * 0.60;

    // 通用墙 + 地板
    ctx.fillStyle = vgrad(ctx, X, Y, WW, HH, '#1a161c', '#0a0809');
    ctx.fillRect(X, Y, WW, HH);
    floorGrid(ctx, X, groundY, WW, HH - (groundY - Y), groundY, 'rgba(60,52,44,0.55)', 'rgba(26,22,22,0.9)');
    // 地平线墙裙
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(X, groundY - 8, WW, 8);

    const actorsHere = (S.actors || []).filter(a => a.node && a.node !== 'office');

    if (cam === '1A') {
      // 幕布
      for (let i = 0; i < 14; i++) {
        const bw = WW / 14;
        const g = ctx.createLinearGradient(X + i * bw, 0, X + (i + 1) * bw, 0);
        g.addColorStop(0, '#2c0a12');
        g.addColorStop(0.5, i % 2 ? '#4a0f1c' : '#3a0b16');
        g.addColorStop(1, '#22070d');
        ctx.fillStyle = g;
        ctx.fillRect(X + i * bw, Y, bw + 1, groundY - Y - 26);
      }
      // 舞台
      ctx.fillStyle = '#241b18';
      ctx.fillRect(X, groundY - 26, WW, 26);
      ctx.fillStyle = 'rgba(216,162,74,0.14)';
      ctx.fillRect(X, groundY - 30, WW, 5);
      // 舞台灯
      for (let i = 0; i < 3; i++) {
        const sx = X + WW * (0.22 + i * 0.28);
        const g = ctx.createRadialGradient(sx, Y + 40, 6, sx, groundY, 220);
        g.addColorStop(0, 'rgba(255,214,150,0.22)');
        g.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - 220, Y, 440, groundY - Y);
      }
      const spots = [['fez', 0.30], ['spring', 0.50], ['chica', 0.70]];
      spots.forEach(([id, px], i) => {
        const a = actorsHere.find(a => a.id === id && a.node === 'stage');
        if (a) body(ctx, id, X + WW * px, groundY - 24, 0.86, t, { phase: i * 2 });
        else {
          // 空舞台底座
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath(); ctx.ellipse(X + WW * px, groundY - 22, 34, 9, 0, 0, 7); ctx.fill();
        }
      });
    } else if (cam === '1B') {
      // 餐厅：桌椅
      const tables = [[0.22, 0.78], [0.5, 0.9], [0.78, 0.76]];
      tables.forEach(([px, py], i) => {
        const tx = X + WW * px, ty = Y + HH * py;
        const sc = 0.6 + i * 0.09;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(tx, ty + 8, 66 * sc, 16 * sc, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#3a2c22';
        ctx.beginPath(); ctx.ellipse(tx, ty, 66 * sc, 20 * sc, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a1f18';
        ctx.fillRect(tx - 7, ty, 14, 52 * sc);
        for (let k = 0; k < 4; k++) {
          const ang = k * Math.PI / 2 + 0.4;
          const cx2 = tx + Math.cos(ang) * 92 * sc, cy2 = ty + Math.sin(ang) * 30 * sc;
          ctx.fillStyle = '#241a16';
          ctx.fillRect(cx2 - 14 * sc, cy2 - 22 * sc, 28 * sc, 22 * sc);
        }
        // 派对帽
        ctx.fillStyle = 'rgba(200,90,90,0.5)';
        poly(ctx, [[tx - 8, ty - 6], [tx + 8, ty - 6], [tx, ty - 30]]); ctx.fill();
      });
      actorsHere.filter(a => a.node === 'dining').forEach((a, i) => {
        body(ctx, a.id, X + WW * (0.42 + i * 0.14), groundY + 30, 0.8, t, { phase: i });
      });
    } else if (cam === '2A' || cam === '4A') {
      // 走廊
      const dir = cam === '2A' ? -1 : 1;
      ctx.fillStyle = vgrad(ctx, X, Y, WW, HH, '#171319', '#090708');
      ctx.fillRect(X, Y, WW, HH);
      const vx = X + WW * (0.5 + dir * 0.06);
      const vy = Y + HH * 0.34;
      // 侧墙
      ctx.fillStyle = '#211a1e';
      poly(ctx, [[X, Y], [X, Y + HH], [vx - WW * 0.06, vy + HH * 0.22], [vx - WW * 0.06, vy]]); ctx.fill();
      ctx.fillStyle = '#191316';
      poly(ctx, [[X + WW, Y], [X + WW, Y + HH], [vx + WW * 0.06, vy + HH * 0.22], [vx + WW * 0.06, vy]]); ctx.fill();
      // 地板
      ctx.fillStyle = '#241d1a';
      poly(ctx, [[X, Y + HH], [X + WW, Y + HH], [vx + WW * 0.06, vy + HH * 0.22], [vx - WW * 0.06, vy + HH * 0.22]]); ctx.fill();
      for (let i = 1; i < 6; i++) {
        const tt = i / 6;
        const yy = (Y + HH) + (vy + HH * 0.22 - (Y + HH)) * tt;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(X, yy); ctx.lineTo(X + WW, yy); ctx.stroke();
      }
      // 尽头
      ctx.fillStyle = '#0d0a0b';
      ctx.fillRect(vx - WW * 0.06, vy, WW * 0.12, HH * 0.22);
      // 顶灯
      for (let i = 0; i < 2; i++) {
        const lx = X + WW * (0.32 + i * 0.34), ly = Y + HH * (0.10 + i * 0.06);
        const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 150);
        g.addColorStop(0, 'rgba(255,228,180,0.5)');
        g.addColorStop(1, 'rgba(255,228,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, 150, 0, 7); ctx.fill();
        ctx.fillStyle = '#191417'; rr(ctx, lx - 26, ly - 4, 52, 8, 4); ctx.fill();
      }
      // 墙上海报
      ctx.fillStyle = 'rgba(216,162,74,0.18)';
      ctx.fillRect(X + WW * 0.14, Y + HH * 0.36, 60, 80);
      ctx.fillStyle = 'rgba(216,162,74,0.10)';
      ctx.fillRect(X + WW * 0.78, Y + HH * 0.30, 46, 62);

      const node = cam === '2A' ? 'westHall' : 'eastHall';
      actorsHere.filter(a => a.node === node).forEach((a, i) => {
        body(ctx, a.id, X + WW * (0.46 + i * 0.12), vy + HH * 0.55, 0.78, t, { phase: i * 3 });
      });
    } else if (cam === '2B' || cam === '4B') {
      // 转角
      ctx.fillStyle = '#1d171b';
      poly(ctx, [[X, Y], [X, Y + HH], [X + WW * 0.55, Y + HH * 0.72], [X + WW * 0.55, Y + HH * 0.12]]); ctx.fill();
      ctx.fillStyle = '#141014';
      poly(ctx, [[X + WW, Y], [X + WW, Y + HH], [X + WW * 0.55, Y + HH * 0.72], [X + WW * 0.55, Y + HH * 0.12]]); ctx.fill();
      // 地
      ctx.fillStyle = '#2a221d';
      poly(ctx, [[X, Y + HH], [X + WW, Y + HH], [X + WW * 0.55, Y + HH * 0.72]]); ctx.fill();
      // 角线
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(X + WW * 0.55, Y + HH * 0.12); ctx.lineTo(X + WW * 0.55, Y + HH * 0.72); ctx.stroke();
      // 推车 / 桌
      ctx.fillStyle = '#33261e';
      ctx.fillRect(X + WW * 0.60, Y + HH * 0.50, 150, 12);
      ctx.fillRect(X + WW * 0.62, Y + HH * 0.50, 10, 90);
      ctx.fillRect(X + WW * 0.74, Y + HH * 0.50, 10, 90);

      const node = cam === '2B' ? 'westCorner' : 'eastCorner';
      actorsHere.filter(a => a.node === node).forEach((a, i) => {
        body(ctx, a.id, X + WW * (0.30 + i * 0.1), Y + HH * 0.86, 0.92, t, { phase: i * 2 });
      });
    } else if (cam === '5') {
      // 海盗湾
      ctx.fillStyle = '#170f1a';
      ctx.fillRect(X, Y, WW, HH);
      const foxA = (S.actors || []).find(a => a.id === 'fox');
      const stage = foxA ? foxA.stage : 0;
      // 幕布
      for (let i = 0; i < 12; i++) {
        const bw = WW / 12;
        const g = ctx.createLinearGradient(X + i * bw, 0, X + (i + 1) * bw, 0);
        g.addColorStop(0, '#2a1030');
        g.addColorStop(0.5, i % 2 ? '#44204e' : '#35183c');
        g.addColorStop(1, '#1e0c24');
        ctx.fillStyle = g;
        const gap = 0.42;
        if (i >= 5 && i <= 6 && stage > 0) continue;
        ctx.fillRect(X + i * bw, Y, bw + 1, HH * 0.86);
      }
      if (stage > 0) {
        ctx.fillStyle = '#0a050c';
        ctx.fillRect(X + WW * 0.42, Y, WW * 0.17, HH * 0.86);
        if (stage >= 2) {
          if (stage >= 3) body(ctx, 'fox', X + WW * 0.505, Y + HH * 0.84, 1.0, t, { phase: 1 });
          else {
            head(ctx, 'fox', X + WW * 0.505, Y + HH * 0.42, 0.75, false, { flick: 0.9 });
          }
        } else {
          ctx.fillStyle = '#ffe06a';
          ctx.beginPath(); ctx.arc(X + WW * 0.48, Y + HH * 0.4, 5, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(X + WW * 0.53, Y + HH * 0.4, 5, 0, 7); ctx.fill();
        }
      }
      // 牌子
      ctx.save();
      ctx.translate(X + WW * 0.5, Y + HH * 0.90);
      ctx.fillStyle = '#e8e2cf';
      ctx.fillRect(-90, -24, 180, 46);
      ctx.fillStyle = '#8b1f26';
      ctx.font = '700 16px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('OUT OF ORDER', 0, 6);
      ctx.restore();
    } else if (cam === '6') {
      // 后台 + 音乐盒
      ctx.fillStyle = '#151114';
      ctx.fillRect(X, Y, WW, HH);
      // 架子
      ctx.fillStyle = '#241b18';
      ctx.fillRect(X + 40, Y + HH * 0.20, WW * 0.34, 14);
      ctx.fillRect(X + 40, Y + HH * 0.44, WW * 0.34, 14);
      // 备用头
      for (let i = 0; i < 3; i++) {
        head(ctx, i === 1 ? 'spring' : 'fez', X + 90 + i * 78, Y + HH * 0.20 - 34, 0.34, false, { flick: 0.55 });
      }
      for (let i = 0; i < 2; i++) {
        head(ctx, 'chica', X + 120 + i * 80, Y + HH * 0.44 - 30, 0.30, false, { flick: 0.45 });
      }
      // 桌子 + 音乐盒
      ctx.fillStyle = '#2e231c';
      ctx.fillRect(X + WW * 0.58, Y + HH * 0.56, WW * 0.34, 16);
      ctx.fillRect(X + WW * 0.60, Y + HH * 0.56, 12, HH * 0.4);
      ctx.fillRect(X + WW * 0.88, Y + HH * 0.56, 12, HH * 0.4);
      const bx = X + WW * 0.74, by = Y + HH * 0.56;
      ctx.fillStyle = '#4a2020';
      rr(ctx, bx - 40, by - 46, 80, 48, 4); ctx.fill();
      ctx.fillStyle = '#6a2c2c';
      rr(ctx, bx - 44, by - 56, 88, 14, 4); ctx.fill();
      ctx.fillStyle = 'rgba(216,162,74,0.7)';
      ctx.fillRect(bx - 2, by - 96, 4, 40); // 摇柄
      ctx.beginPath(); ctx.arc(bx, by - 98, 7, 0, 7); ctx.fill();
      // 音乐盒上弦进度
      const pct = Math.max(0, Math.min(1, (S.box || 0) / 100));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 44, by + 8, 88, 8);
      ctx.fillStyle = pct > 0.35 ? '#6fd6a8' : '#ff6b6b';
      ctx.fillRect(bx - 44, by + 8, 88 * pct, 8);
      // 提线
      if ((S.actors || []).some(a => a.id === 'puppet' && a.node === 'backstage')) {
        body(ctx, 'puppet', X + WW * 0.22, Y + HH * 0.94, 1.0, t, { phase: 2 });
      }
    } else if (cam === '3') {
      // 厨房：无画面
      ctx.fillStyle = '#080607';
      ctx.fillRect(X, Y, WW, HH);
      noiseOverlay(ctx, X, Y, WW, HH, 0.5, Math.floor(t * 24));
      ctx.fillStyle = 'rgba(255,90,90,0.85)';
      ctx.font = '700 30px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('AUDIO ONLY', X + WW / 2, Y + HH / 2 - 10);
      ctx.fillStyle = 'rgba(200,190,180,0.6)';
      ctx.font = '600 16px "Courier New",monospace';
      ctx.fillText('CAM 03 · 画面损坏 · 仅音频', X + WW / 2, Y + HH / 2 + 26);
      // 波形
      ctx.strokeStyle = 'rgba(111,214,168,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xx = X + WW * 0.15 + (WW * 0.7) * (i / 60);
        const amp = (S.kitchenNoise || 0) * 42 * Math.sin(i * 1.7 + t * 6) * Math.random();
        i === 0 ? ctx.moveTo(xx, Y + HH * 0.78) : ctx.lineTo(xx, Y + HH * 0.78 + amp);
      }
      ctx.stroke();
    } else if (cam === '7') {
      // 通风管道
      ctx.fillStyle = '#0b0908';
      ctx.fillRect(X, Y, WW, HH);
      for (let i = 0; i < 5; i++) {
        const t2 = i / 5;
        const w2 = WW * (0.95 - t2 * 0.6), h2 = HH * (0.95 - t2 * 0.6);
        ctx.strokeStyle = 'rgba(120,110,100,' + (0.25 - t2 * 0.04) + ')';
        ctx.lineWidth = 3;
        rr(ctx, X + (WW - w2) / 2, Y + (HH - h2) / 2, w2, h2, 10);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(X, Y, WW, HH);
      // 铁栅
      ctx.strokeStyle = 'rgba(140,130,120,0.35)'; ctx.lineWidth = 6;
      for (let i = 0; i < 7; i++) {
        const xx = X + WW * (0.2 + i * 0.1);
        ctx.beginPath(); ctx.moveTo(xx, Y + HH * 0.15); ctx.lineTo(xx, Y + HH * 0.85); ctx.stroke();
      }
      const chi = (S.actors || []).find(a => a.id === 'chica' && a.node === 'vent');
      if (chi) {
        ctx.fillStyle = '#ffe06a';
        ctx.beginPath(); ctx.arc(X + WW * 0.44, Y + HH * 0.45, 8, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(X + WW * 0.56, Y + HH * 0.45, 8, 0, 7); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath(); ctx.arc(X + WW * 0.5, Y + HH * 0.45, 60, 0, 7); ctx.fill();
        ctx.restore();
      }
    }

    // 监控画面调色与噪点
    ctx.fillStyle = 'rgba(90,110,80,0.10)';
    ctx.fillRect(X, Y, WW, HH);
    noiseOverlay(ctx, X, Y, WW, HH, 0.10 + (S.staticLevel || 0) * 0.2, Math.floor(t * 30));
    // 扫描线
    ctx.save();
    ctx.globalAlpha = 0.25;
    const pat = ctx.createPattern(scanPat, 'repeat');
    ctx.fillStyle = pat; ctx.fillRect(X, Y, WW, HH);
    ctx.restore();
    // 滚动暗带
    const bandY = Y + ((t * 90) % (HH + 120)) - 60;
    const bg2 = ctx.createLinearGradient(0, bandY, 0, bandY + 70);
    bg2.addColorStop(0, 'rgba(255,255,255,0)');
    bg2.addColorStop(0.5, 'rgba(255,255,255,0.045)');
    bg2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg2;
    ctx.fillRect(X, bandY, WW, 70);

    // 标签
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(X, Y, WW, 46);
    ctx.fillStyle = '#cfc8b8';
    ctx.font = '700 22px "Courier New",monospace'; ctx.textAlign = 'left';
    ctx.fillText('CAM ' + cam, X + 16, Y + 31);
    ctx.fillStyle = 'rgba(190,180,160,0.75)';
    ctx.font = '600 17px "Courier New",monospace';
    ctx.fillText(CAM_INFO[cam] || '', X + 120, Y + 31);
    // REC
    if (Math.floor(t) % 2 === 0) {
      ctx.fillStyle = '#e04a4a';
      ctx.beginPath(); ctx.arc(X + WW - 92, Y + 23, 7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,190,170,0.8)';
    ctx.font = '600 16px "Courier New",monospace'; ctx.textAlign = 'right';
    ctx.fillText('REC', X + WW - 18, Y + 30);
    // 时间戳
    ctx.fillStyle = 'rgba(200,190,170,0.55)';
    ctx.textAlign = 'right';
    const secs = Math.floor(t) % 60;
    ctx.fillText('2037-11-0' + (S.night || 1) + '  ' + String((Math.floor(t / 60) % 24)).padStart(2, '0') + ':' + String(secs).padStart(2, '0'), X + WW - 18, Y + HH - 16);

    ctx.restore();
  }

  /* ---------------- 监控平板 ---------------- */
  function drawTablet(ctx, S, t) {
    // 平板主体
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#141114';
    rr(ctx, 96, 54, 1088, 604, 22); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2;
    rr(ctx, 96, 54, 1088, 604, 22); ctx.stroke();

    const X = 126, Y = 92, WW = 1028, HH = 508;
    ctx.fillStyle = '#050406';
    ctx.fillRect(X, Y, WW, HH);
    drawRoom(ctx, S, S.curCam || '1A', t, X, Y, WW, HH);

    // 底部状态条
    ctx.fillStyle = '#0d0b0d';
    rr(ctx, 126, 610, 1028, 36, 8); ctx.fill();
    ctx.fillStyle = 'rgba(200,190,170,0.65)';
    ctx.font = '600 15px "Courier New",monospace'; ctx.textAlign = 'left';
    ctx.fillText('FAZBEAR ECHO ARCHIVE · SURVEILLANCE v2.7', 144, 634);
    ctx.textAlign = 'right';
    // 信号格
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < 3 ? 'rgba(111,214,168,0.8)' : 'rgba(120,110,100,0.4)';
      ctx.fillRect(1100 + i * 9, 638 - (i + 1) * 4, 6, (i + 1) * 4);
    }
    ctx.fillStyle = 'rgba(200,190,170,0.6)';
    ctx.fillText('LINK', 1094, 634);

    // 屏幕外玻璃反光
    const gl = ctx.createLinearGradient(X, Y, X + WW * 0.6, Y + HH);
    gl.addColorStop(0, 'rgba(255,255,255,0.05)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(X, Y, WW, HH);
  }

  /* ---------------- 办公室动态层 ---------------- */
  function drawOffice(ctx, S, t) {
    if (!officeBg) officeBg = buildOfficeBg();
    ctx.drawImage(officeBg, 0, 0);

    const doorL = { x0: 30, y0: 110, x1: 280, y1: 606 };
    const doorR = { x0: 1000, y0: 110, x1: 1250, y1: 606 };

    const at = id => (S.actors || []).find(a => a.id === id);
    const leftActor = (S.actors || []).find(a => a.node === 'leftDoor');
    const rightActor = (S.actors || []).find(a => a.node === 'rightDoor');

    // 左走廊
    corridor(ctx, doorL.x0, doorL.y0, doorL.x1, doorL.y1, !!S.leftLight, t);
    // 右走廊
    corridor(ctx, doorR.x0, doorR.y0, doorR.x1, doorR.y1, !!S.rightLight, t);

    // 门外的人偶
    if (leftActor) {
      const lit = !!S.leftLight;
      if (lit) {
        body(ctx, leftActor.id, 155, 606, 1.22, t, { phase: 1, open: Math.random() < 0.05 });
      } else {
        ctx.save(); ctx.globalAlpha = 0.5;
        eye(ctx, 140, 372, 6, CHARS[leftActor.id].eye, true, 0.55);
        eye(ctx, 172, 372, 6, CHARS[leftActor.id].eye, true, 0.55);
        ctx.restore();
      }
    }
    if (rightActor) {
      const lit = !!S.rightLight;
      if (lit) {
        body(ctx, rightActor.id, 1125, 606, 1.22, t, { phase: 3, open: Math.random() < 0.05 });
      } else {
        ctx.save(); ctx.globalAlpha = 0.5;
        eye(ctx, 1108, 372, 6, CHARS[rightActor.id].eye, true, 0.55);
        eye(ctx, 1140, 372, 6, CHARS[rightActor.id].eye, true, 0.55);
        ctx.restore();
      }
    }

    // 门闸
    function shutter(x, w, prog) {
      if (prog <= 0.001) return;
      const h = (606 - 110) * prog;
      const y = 110;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, 110, w, 496); ctx.clip();
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, '#0e0e13');
      g.addColorStop(0.5, '#2a2a34');
      g.addColorStop(1, '#0e0e13');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      for (let yy = y; yy < y + h; yy += 16) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, yy, w, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x, yy + 3, w, 2);
      }
      // 底缘
      ctx.fillStyle = '#3a3a46';
      ctx.fillRect(x, y + h - 8, w, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y + h - 8, w, 2);
      ctx.restore();
    }
    shutter(doorL.x0, doorL.x1 - doorL.x0, S.doorAnim ? S.doorAnim.l : 0);
    shutter(doorR.x0, doorR.x1 - doorR.x0, S.doorAnim ? S.doorAnim.r : 0);

    // 门框（金属包边 + 顶部横梁），让门洞在暗处也能被读出来
    function doorFrame(x0, y0, x1, y1, closed) {
      const w = x1 - x0, h = y1 - y0;
      ctx.save();
      // 顶部横梁
      const hg = ctx.createLinearGradient(0, y0 - 58, 0, y0);
      hg.addColorStop(0, '#100c0d');
      hg.addColorStop(1, '#2a2124');
      ctx.fillStyle = hg;
      ctx.fillRect(x0 - 26, y0 - 58, w + 52, 58);
      ctx.fillStyle = 'rgba(216,162,74,0.10)';
      ctx.fillRect(x0 - 26, y0 - 6, w + 52, 4);
      // 侧边钢梁
      const sideG = ctx.createLinearGradient(x0 - 22, 0, x0 + 10, 0);
      sideG.addColorStop(0, '#0d0a0b');
      sideG.addColorStop(1, '#31272a');
      ctx.fillStyle = sideG;
      ctx.fillRect(x0 - 22, y0 - 58, 22, h + 58);
      const sideG2 = ctx.createLinearGradient(x1, 0, x1 + 22, 0);
      sideG2.addColorStop(0, '#31272a');
      sideG2.addColorStop(1, '#0d0a0b');
      ctx.fillStyle = sideG2;
      ctx.fillRect(x1, y0 - 58, 22, h + 58);
      // 内边高光
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, w, h);
      // 门框警示条
      ctx.fillStyle = 'rgba(160,60,40,0.35)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x0 - 16, y1 - 30 - i * 16, 10, 7);
      // 顶部状态灯
      ctx.beginPath();
      ctx.arc(x0 + w / 2, y0 - 28, 5, 0, 7);
      ctx.fillStyle = closed ? '#ff5a3a' : '#3a6a52';
      ctx.fill();
      ctx.restore();
    }
    doorFrame(doorL.x0, doorL.y0, doorL.x1, doorL.y1, S.leftDoor);
    doorFrame(doorR.x0, doorR.y0, doorR.x1, doorR.y1, S.rightDoor);

    // 通风口
    const ventX = 470, ventY = 12, ventW = 260, ventH = 84;
    const vAnim = S.doorAnim ? S.doorAnim.vent : 0;
    // 栅格
    ctx.save();
    ctx.beginPath(); ctx.rect(ventX, ventY, ventW, ventH); ctx.clip();
    ctx.fillStyle = '#050405'; ctx.fillRect(ventX, ventY, ventW, ventH);
    const chi = at('chica');
    if (chi && chi.node === 'vent') {
      eye(ctx, ventX + ventW * 0.40, ventY + ventH * 0.5, 6, '#ffe06a', true, 0.8);
      eye(ctx, ventX + ventW * 0.60, ventY + ventH * 0.5, 6, '#ffe06a', true, 0.8);
    }
    // 栅条
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#221c1c' : '#191415';
      ctx.fillRect(ventX + 8, ventY + 8 + i * 10, ventW - 16, 7);
    }
    // 挡板
    if (vAnim > 0.001) {
      ctx.fillStyle = '#2c2626';
      ctx.fillRect(ventX, ventY, ventW, ventH * vAnim);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(ventX, ventY + ventH * vAnim - 5, ventW, 5);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(90,80,76,0.7)'; ctx.lineWidth = 3;
    rr(ctx, ventX, ventY, ventW, ventH, 8); ctx.stroke();

    // 风扇
    ctx.save();
    ctx.translate(432, 566);
    ctx.scale(0.86, 0.86);
    ctx.fillStyle = 'rgba(10,8,9,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(130,120,112,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.stroke();
    ctx.save();
    ctx.rotate(t * 7.5);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(170,168,175,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, -22, 12, 26, 0.55, 0, 7);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#2c2628';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(160,150,140,0.16)'; ctx.lineWidth = 2;
    for (let r = 16; r <= 48; r += 16) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    }
    ctx.restore();

    // 门口警报红光
    if (S.leftLight) {
      const g = ctx.createRadialGradient(155, 360, 30, 155, 360, 300);
      g.addColorStop(0, 'rgba(255,225,180,0.10)');
      g.addColorStop(1, 'rgba(255,225,180,0)');
      ctx.fillStyle = g; ctx.fillRect(30, 110, 250, 496);
    }
    if (S.rightLight) {
      const g = ctx.createRadialGradient(1125, 360, 30, 1125, 360, 300);
      g.addColorStop(0, 'rgba(255,225,180,0.10)');
      g.addColorStop(1, 'rgba(255,225,180,0)');
      ctx.fillStyle = g; ctx.fillRect(1000, 110, 250, 496);
    }

    // 温度过高色调
    if (S.heat > 60) {
      const a = ((S.heat - 60) / 40) * 0.16;
      ctx.fillStyle = 'rgba(255,80,40,' + a.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 金灵现身
    if (S.gold && S.gold.active) {
      ctx.save();
      const p = Math.min(1, (7 - S.gold.t) / 0.8);
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 12);
      body(ctx, 'gold', 640, 700, 1.75 * p, t, { phase: 0 });
      ctx.restore();
      const g = ctx.createRadialGradient(640, 500, 20, 640, 500, 400);
      g.addColorStop(0, 'rgba(255,220,120,0.16)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- 屏幕特效 ---------------- */
  function fx(ctx, S, t) {
    // 暗角
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 1.02);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // 细扫描线
    ctx.save();
    ctx.globalAlpha = 0.1;
    const pat = ctx.createPattern(scanPat, 'repeat');
    ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 灵怨干扰
    const e = S.echo || 0;
    if (e > 55) {
      const n = Math.floor((e - 55) / 12) + 1;
      ctx.save();
      for (let i = 0; i < n; i++) {
        const sy = Math.random() * H;
        const sh = 4 + Math.random() * 22;
        const dx = (Math.random() - 0.5) * 40;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(ctx.canvas, 0, sy, W, sh, dx, sy, W, sh);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(120,20,160,' + ((e - 55) / 45 * 0.10).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (S.overload > 0 && !S.flickerReduce) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.12).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    noiseOverlay(ctx, 0, 0, W, H, 0.022 + (S.staticLevel || 0) * 0.1, Math.floor(t * 20));
  }

  /* ---------------- 死亡特写 ---------------- */
  function drawJumpscare(ctx, S, t) {
    const j = S.jumpscare;
    if (!j) return;
    const p = Math.min(1, j.t / 0.55);
    const sh = 22 * (1 - p);
    ctx.save();
    ctx.translate(W / 2 + (Math.random() - 0.5) * sh * 2, H / 2 + 46 + (Math.random() - 0.5) * sh * 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(-W, -H, W * 2, H * 2);

    const flash = Math.random() < 0.3 && !S.flickerReduce;
    if (flash) { ctx.fillStyle = 'rgba(120,0,0,0.35)'; ctx.fillRect(-W, -H, W * 2, H * 2); }

    const sc = 2.7 + p * 2.1;
    ctx.save();
    ctx.rotate((Math.random() - 0.5) * 0.05);
    // 色散
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16;
    ctx.save(); ctx.translate(-7, 0); head(ctx, j.id, 0, 0, sc, true, { flick: 1 }); ctx.restore();
    ctx.save(); ctx.translate(7, 0); head(ctx, j.id, 0, 0, sc, true, { flick: 1 }); ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    head(ctx, j.id, 0, 0, sc, true, { flick: 1 });
    ctx.restore();

    // 边缘压暗
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    noiseOverlay(ctx, 0, 0, W, H, 0.2, Math.floor(t * 60));
  }

  /* ---------------- 主入口 ---------------- */
  function draw(ctx, S, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const shake = S.shake || 0;
    if (shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawOffice(ctx, S, t);
    if (S.camsUp) drawTablet(ctx, S, t);
    fx(ctx, S, t);

    if (S.powerOut) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
    }

    if (shake > 0) ctx.restore();

    drawJumpscare(ctx, S, t);
  }

  return { init, draw, W, H, CAM_INFO, CHARS };
})();
