/* =========================================================
   核心玩法：资源管理 + 七人偶 AI + 六夜流程
   ========================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CFG = {
    hourLen: 42,          // 每"小时"秒数 → 一夜约 4.2 分钟
    hours: 6,
    doorGrace: 4.0,       // 门口宽限
    ventGrace: 4.5,
    drainBase: 0.185,
    echoAtDoor: 2.0,
    echoDecay: 1.15,
    heatGainBoth: 1.45,
    heatGainOne: 0.30,
    heatCool: 0.85
  };

  const NODE_CAM = {
    stage: '1A', dining: '1B', kitchen: '3', backstage: '6',
    westHall: '2A', westCorner: '2B', eastHall: '4A', eastCorner: '4B',
    cove: '5', vent: '7'
  };
  const PATH = {
    fez: ['stage', 'dining', 'eastHall', 'eastCorner', 'rightDoor'],
    spring: ['stage', 'dining', 'westHall', 'westCorner', 'leftDoor'],
    chica: ['stage', 'dining', 'kitchen', 'eastHall', 'vent']
  };
  const CAM_LIST = ['1A', '1B', '2A', '2B', '3', '4A', '4B', '5', '6', '7'];

  const DIFF = {
    1: { fez: 2, spring: 1, chica: 1, fox: 0, puppet: 2, glitch: 1, gold: 0 },
    2: { fez: 4, spring: 3, chica: 3, fox: 2, puppet: 4, glitch: 2, gold: 0 },
    3: { fez: 6, spring: 5, chica: 5, fox: 4, puppet: 6, glitch: 3, gold: 0 },
    4: { fez: 8, spring: 7, chica: 7, fox: 6, puppet: 8, glitch: 4, gold: 0 },
    5: { fez: 10, spring: 9, chica: 9, fox: 8, puppet: 10, glitch: 5, gold: 4 },
    6: { fez: 10, spring: 10, chica: 10, fox: 10, puppet: 10, glitch: 6, gold: 0 }
  };

  const S = {
    state: 'menu', night: 1, t: 0, hour: 0,
    power: 100, echo: 0, heat: 0,
    camsUp: false, curCam: '1A',
    leftDoor: false, rightDoor: false, leftLight: false, rightLight: false, ventClosed: false,
    doorAnim: { l: 0, r: 0, vent: 0 },
    box: 100, puppetT: 0, winding: false, windSound: false,
    lures: 3, lureCd: 0,
    actors: [], diff: Object.assign({}, DIFF[1]),
    gold: { active: false, t: 0, stare: 0 }, staring: false,
    glitchCam: null, glitchT: 0, glitchTimer: 24,
    powerOut: false, powerOutT: 0,
    overload: 0, heatLock: 0, shake: 0, staticLevel: 0,
    jumpscare: null, paused: false, boxMusic: false,
    stats: { peakEcho: 0 }
  };

  let canvas, ctx, lastTs = 0, typeTimer = null;
  let save = loadSave();

  /* ---------------- 存档 ---------------- */
  function loadSave() {
    const def = { unlocked: 1, codex: [], settings: { vol: 0.7, flicker: false }, custom: {} };
    try {
      const raw = localStorage.getItem('fnaf_echo_save_v1');
      if (!raw) return def;
      const o = JSON.parse(raw);
      return {
        unlocked: Math.max(1, Math.min(6, o.unlocked || 1)),
        codex: Array.isArray(o.codex) ? o.codex : [],
        settings: Object.assign(def.settings, o.settings || {}),
        custom: o.custom || {}
      };
    } catch (e) { return def; }
  }
  function persist() {
    try { localStorage.setItem('fnaf_echo_save_v1', JSON.stringify(save)); } catch (e) {}
  }

  /* ---------------- 屏幕管理 ---------------- */
  const SCREENS = ['scrMenu', 'scrNights', 'scrBrief', 'scrCodex', 'scrHelp', 'scrSettings', 'scrResult', 'scrPause'];
  function showScreen(id) {
    SCREENS.forEach(s => {
      const el = $(s);
      if (el) el.classList.toggle('on', s === id);
    });
    document.body.classList.toggle('in-game', id === null);
    $('hud').classList.toggle('on', id === null);
  }
  function goMenu() {
    S.state = 'menu'; S.paused = false;
    Sfx.stopMusicBox(); Sfx.ambience(false);
    showScreen('scrMenu');
    renderSaveInfo();
  }

  function renderSaveInfo() {
    $('saveInfo').textContent = save.unlocked >= 6
      ? '档案等级：全部解锁 · 可挑战自定义夜'
      : '已解锁夜次：1 - ' + save.unlocked + ' · 档案 ' + save.codex.length + '/' + LORE.entries.length;
    $('contNum').textContent = save.unlocked;
    $('btnContinue').style.display = save.unlocked > 1 ? '' : 'none';
  }

  /* ---------------- 选夜 ---------------- */
  function openNights() {
    const grid = $('nightGrid');
    grid.innerHTML = '';
    for (let n = 1; n <= 6; n++) {
      const b = document.createElement('button');
      b.className = 'night-card' + (n > save.unlocked ? ' locked' : '');
      b.innerHTML = '<b>' + n + '</b><span>' + (n === 6 ? '自定义' : '第 ' + n + ' 夜') + '</span>';
      if (n > save.unlocked) b.innerHTML += '<i>未解锁</i>';
      else b.onclick = () => { startNight(n); };
      grid.appendChild(b);
    }
    buildCustomPanel();
    showScreen('scrNights');
  }

  function buildCustomPanel() {
    const box = $('customPanel');
    if (box.dataset.built) { syncCustomInputs(); return; }
    box.dataset.built = '1';
    const defs = [
      ['fez', '费兹（东廊棕熊）'], ['spring', '弹簧（西廊紫兔）'], ['chica', '琪可（通风口黄鸡）'],
      ['fox', '海盗狐（冲刺）'], ['puppet', '提线（音乐盒）'], ['glitch', '残响（画面污染）']
    ];
    defs.forEach(([k, label]) => {
      const row = document.createElement('label');
      row.className = 'slider-row';
      row.innerHTML = '<span>' + label + '</span><input type="range" min="0" max="20" step="1" id="d-' + k + '" value="' + (save.custom[k] !== undefined ? save.custom[k] : 10) + '"><b><i class="v">10</i></b>';
      box.appendChild(row);
    });
    const g = document.createElement('label');
    g.className = 'slider-row check';
    g.innerHTML = '<span>金灵（金色残响）</span><input type="checkbox" id="d-gold"' + (save.custom.gold ? ' checked' : '') + '>';
    box.appendChild(g);
    box.addEventListener('input', e => {
      const t = e.target;
      if (t.type === 'range') t.parentElement.querySelector('.v').textContent = t.value;
    });
  }
  function syncCustomInputs() {
    ['fez', 'spring', 'chica', 'fox', 'puppet', 'glitch'].forEach(k => {
      const el = $('d-' + k);
      if (el) {
        if (save.custom[k] !== undefined) el.value = save.custom[k];
        el.parentElement.querySelector('.v').textContent = el.value;
      }
    });
    if ($('d-gold')) $('d-gold').checked = !!save.custom.gold;
  }

  /* ---------------- 夜前简报 ---------------- */
  function startNight(n) {
    S.night = n;
    const data = LORE.nights[n - 1];
    $('briefNum').textContent = n === 6 ? 'CUSTOM NIGHT' : 'NIGHT ' + n;
    $('briefTitle').textContent = data.title;
    $('briefText').innerHTML = data.brief.map(l => '<p>' + l + '</p>').join('');
    const phone = $('briefPhone');
    phone.textContent = '';
    if (typeTimer) clearInterval(typeTimer);
    const full = data.phone.join('\n');
    let i = 0;
    typeTimer = setInterval(() => {
      i += 2;
      phone.textContent = full.slice(0, i);
      if (i >= full.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 16);
    $('btnBegin').textContent = n === 6 ? '推到底' : '开始值班';
    $('btnBegin').onclick = beginNight;
    showScreen('scrBrief');
    if (n === 6) syncCustomInputs();
  }

  function beginNight() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    resetNight(S.night);
    S.state = 'play';
    showScreen(null);
    Sfx.unlock();
    Sfx.ambience(true);
    toast(S.night === 6 ? '自定义夜开始' : '第 ' + S.night + ' 夜 · 12:00 AM');
  }

  function resetNight(n) {
    S.t = 0; S.hour = 0;
    S.power = 100; S.echo = 0; S.heat = 0;
    S.leftDoor = S.rightDoor = S.leftLight = S.rightLight = S.ventClosed = false;
    S.camsUp = false; S.curCam = '1A';
    S.doorAnim = { l: 0, r: 0, vent: 0 };
    S.box = 100; S.puppetT = 0; S.winding = false; S.windSound = false;
    S.lures = 3; S.lureCd = 0;
    S.gold = { active: false, t: 0, stare: 0 }; S.staring = false;
    S.glitchCam = null; S.glitchT = 0; S.glitchTimer = 24;
    S.powerOut = false; S.powerOutT = 0;
    S.overload = 0; S.heatLock = 0; S.shake = 0; S.boxMusic = false;
    S.freeze = 0; S.goldCheck = 6; S.kitchenNoise = 0; S.winT = undefined;
    S.jumpscare = null; S.paused = false;
    S.stats = { peakEcho: 0 };
    S.state = 'play';

    if (n === 6) {
      const c = {};
      ['fez', 'spring', 'chica', 'fox', 'puppet', 'glitch'].forEach(k => {
        const el = $('d-' + k);
        c[k] = el ? parseInt(el.value, 10) : 10;
        save.custom[k] = c[k];
      });
      c.gold = ($('d-gold') && $('d-gold').checked) ? 8 : 0;
      save.custom.gold = !!c.gold;
      persist();
      S.diff = c;
    } else {
      S.diff = Object.assign({}, DIFF[n]);
    }

    S.actors = [
      { id: 'fez', node: 'stage', timer: rand(7, 11), phase: 0, doorTimer: 0 },
      { id: 'spring', node: 'stage', timer: rand(7, 11), phase: 2, doorTimer: 0 },
      { id: 'chica', node: 'stage', timer: rand(9, 13), phase: 4, doorTimer: 0 },
      { id: 'fox', node: 'cove', stage: 0, timer: rand(10, 15), sprinting: false, sprintT: 0, phase: 1, doorTimer: 0 },
      { id: 'puppet', node: null, phase: 3, doorTimer: 0 },
      { id: 'glitch', node: null, phase: 0, doorTimer: 0 }
    ];
    updateHud();
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- 提示 ---------------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), ms || 2400);
  }

  /* ---------------- 输入 ---------------- */
  function canAct() {
    return S.state === 'play' && !S.paused && !S.powerOut && S.overload <= 0 && S.freeze <= 0;
  }

  function toggleDoor(side) {
    if (!canAct()) return;
    if (S.heatLock > 0) { toast('散热过载，闸板锁死'); return; }
    if (side === 'l') { S.leftDoor = !S.leftDoor; Sfx.door(S.leftDoor, -0.7); }
    else { S.rightDoor = !S.rightDoor; Sfx.door(S.rightDoor, 0.7); }
  }
  function toggleLight(side) {
    if (!canAct()) return;
    if (side === 'l') { S.leftLight = !S.leftLight; Sfx.light(S.leftLight, -0.6); }
    else { S.rightLight = !S.rightLight; Sfx.light(S.rightLight, 0.6); }
  }
  function toggleCams() {
    if (!canAct()) return;
    S.camsUp = !S.camsUp;
    if (S.camsUp) Sfx.camOpen(); else Sfx.camClose();
    if (S.camsUp) { S.leftLight = S.rightLight = false; }
  }
  function toggleVent() {
    if (!canAct()) return;
    S.ventClosed = !S.ventClosed;
    Sfx.door(S.ventClosed, 0);
    toast(S.ventClosed ? '通风挡板已闭合' : '通风挡板已开启', 1200);
  }
  function useLure() {
    if (!canAct()) return;
    if (S.lureCd > 0) { toast('诱饵正在充能', 1000); return; }
    if (S.lures <= 0) { toast('音频诱饵已用尽', 1200); return; }
    S.lures--; S.lureCd = 5;
    let moved = false;
    S.actors.forEach(a => {
      if (a.id === 'puppet' || a.id === 'glitch') return;
      if (!a.node) return;
      const near = ['leftDoor', 'rightDoor', 'vent', 'westCorner', 'eastCorner', 'westHall', 'eastHall'].indexOf(a.node) >= 0;
      if (!near) return;
      if (a.id === 'fox') {
        a.stage = Math.max(0, a.stage - 2);
        a.sprinting = false; a.timer = rand(9, 13); moved = true;
      } else if (PATH[a.id]) {
        retreat(a); moved = true;
      }
    });
    S.echo = Math.max(0, S.echo - 14);
    Sfx.beep(300, 0.12);
    Sfx.step(-0.8, true); Sfx.step(0.8, true);
    toast(moved ? '诱饵播放：有东西被引开了' : '诱饵播放：没有回应', 1800);
  }
  function retreat(a) {
    const path = PATH[a.id];
    if (!path) return;
    const i = path.indexOf(a.node);
    if (i < 0) { a.node = 'stage'; return; }
    a.node = path[Math.max(0, i - 2)];
    a.doorTimer = 0;
    a.timer = rand(5, 9);
    Sfx.step(a.node.indexOf('west') >= 0 ? -0.4 : 0.4, false);
  }

  /* ---------------- 主循环 ---------------- */
  function frame(ts) {
    const dtRaw = (ts - lastTs) / 1000;
    const dt = Math.max(0, Math.min(0.06, isFinite(dtRaw) ? dtRaw : 0.016));
    lastTs = ts;

    if (S.state === 'play' && !S.paused) update(dt);
    if (S.state === 'jump') {
      S.jumpscare.t += dt;
      S.shake = Math.max(0, 18 - S.jumpscare.t * 10);
      if (S.jumpscare.t > 1.9) showResult('lose');
    }
    if (S.state === 'win' && S.winT !== undefined) {
      S.winT += dt;
    }
    S.shake = Math.max(0, S.shake - 30 * dt);
    S.staticLevel = (S.glitchCam && S.camsUp && S.curCam === S.glitchCam) ? 0.9
      : (S.echo > 70 ? 0.4 : (S.echo > 40 ? 0.2 : 0.08));

    updateHud();
    Art.draw(ctx, S, ts / 1000);
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // 时间
    S.t += dt;
    const h = Math.floor(S.t / CFG.hourLen);
    if (h !== S.hour) {
      S.hour = h;
      if (h < CFG.hours) Sfx.beep(520, 0.08);
      if (h >= CFG.hours) { winNight(); return; }
    }

    // 闸板动画
    const spd = 6.5;
    S.doorAnim.l += ((S.leftDoor ? 1 : 0) - S.doorAnim.l) * Math.min(1, spd * dt);
    S.doorAnim.r += ((S.rightDoor ? 1 : 0) - S.doorAnim.r) * Math.min(1, spd * dt);
    S.doorAnim.vent += ((S.ventClosed ? 1 : 0) - S.doorAnim.vent) * Math.min(1, spd * dt);

    if (S.overload > 0) {
      S.overload -= dt;
      if (S.overload < 0) S.overload = 0;
    }
    if (S.freeze > 0) S.freeze -= dt;
    if (S.heatLock > 0) S.heatLock -= dt;
    if (S.lureCd > 0) S.lureCd -= dt;

    // 停电流程
    if (S.powerOut) {
      S.powerOutT += dt;
      if (S.powerOutT > 9.5) kill('fez');
      return;
    }

    // 电量
    let usage = 1;
    if (S.leftDoor) usage += 1;
    if (S.rightDoor) usage += 1;
    if (S.camsUp) usage += 1;
    if (S.leftLight) usage += 0.5;
    if (S.rightLight) usage += 0.5;
    if (S.ventClosed) usage += 0.5;
    S.power -= CFG.drainBase * Math.pow(usage, 1.12) * dt;
    if (S.power <= 0) {
      S.power = 0;
      goPowerOut();
      return;
    }

    // 温度
    const closed = (S.leftDoor ? 1 : 0) + (S.rightDoor ? 1 : 0);
    if (closed === 2) S.heat += CFG.heatGainBoth * dt;
    else if (closed === 1) S.heat += CFG.heatGainOne * dt;
    else S.heat -= CFG.heatCool * dt;
    S.heat = Math.max(0, Math.min(100, S.heat));
    if (S.heat >= 100 && S.heatLock <= 0) {
      S.heatLock = 4; S.heat = 55; S.power = Math.max(0, S.power - 10);
      S.leftDoor = S.rightDoor = false;
      S.shake = 14; Sfx.overload();
      toast('散热过载！闸板强制开启 4 秒', 2600);
    }

    // 灵怨
    let gain = 0;
    S.actors.forEach(a => { if (a.node === 'leftDoor' || a.node === 'rightDoor' || a.node === 'vent') gain += CFG.echoAtDoor; });
    if (S.glitchCam && S.camsUp && S.curCam === S.glitchCam) gain += 2.2;
    if (S.gold.active) gain += 0.8;
    if (gain > 0) S.echo += gain * dt;
    else S.echo -= CFG.echoDecay * dt;
    S.echo = Math.max(0, Math.min(100, S.echo));
    if (S.echo > S.stats.peakEcho) S.stats.peakEcho = S.echo;
    if (S.echo >= 100 && S.overload <= 0 && !S.gold.active) {
      S.overload = 2.6; S.echo = 45;
      S.leftDoor = S.rightDoor = false; S.camsUp = false;
      S.shake = 20; Sfx.overload();
      toast('灵怨过载：闸板被强制弹开', 2600);
    }

    // 音乐盒
    if (S.winding && S.camsUp && S.curCam === '6') {
      S.box = Math.min(100, S.box + 27 * dt);
      if (!S.windSound) { Sfx.wind(true); S.windSound = true; }
    } else {
      if (S.windSound) { Sfx.wind(false); S.windSound = false; }
      const decay = 0.72 + (S.diff.puppet || 0) * 0.062;
      S.box = Math.max(0, S.box - decay * dt);
    }
    if (S.box < 45 && !S.boxMusic) { S.boxMusic = true; Sfx.startMusicBox(1); }
    if (S.box > 62 && S.boxMusic) { S.boxMusic = false; Sfx.stopMusicBox(); }
    if (S.box <= 0) {
      S.puppetT += dt;
      if (S.puppetT > 9.5) { kill('puppet'); return; }
    } else S.puppetT = 0;

    // 人偶 AI
    S.actors.forEach(a => updateActor(a, dt));

    // 残响（画面污染）
    if (S.diff.glitch > 0) {
      S.glitchTimer -= dt;
      if (S.glitchTimer <= 0) {
        S.glitchTimer = rand(18, 30);
        if (Math.random() < (S.diff.glitch / 20) * 0.62) {
          const pool = CAM_LIST.filter(c => c !== '3');
          S.glitchCam = pool[Math.floor(Math.random() * pool.length)];
          S.glitchT = 9;
          Sfx.glitch();
        }
      }
    }
    if (S.glitchT > 0) {
      S.glitchT -= dt;
      if (S.glitchT <= 0) S.glitchCam = null;
    }

    // 金灵
    if (S.diff.gold > 0) {
      if (!S.gold.active) {
        S.goldCheck = (S.goldCheck || 6) - dt;
        if (S.goldCheck <= 0) {
          S.goldCheck = 7;
          if (S.echo > 72 && Math.random() < 0.32) {
            S.gold.active = true; S.gold.t = 7.5; S.gold.stare = 0;
            Sfx.heartbeat(); toast('有东西站在办公室里。看着它。', 3000);
          }
        }
      } else {
        S.gold.t -= dt;
        if (S.staring) {
          S.gold.stare += dt;
          S.echo = Math.max(0, S.echo - 5 * dt);
        }
        if (S.gold.stare >= 3) {
          S.gold.active = false; S.staring = false;
          S.echo = Math.max(0, S.echo - 40);
          Sfx.thud(0); toast('它退回了黑暗里', 2000);
        } else if (S.gold.t <= 0) { kill('gold'); return; }
      }
    }

    // 提线出现在后台
    const puppet = S.actors.find(a => a.id === 'puppet');
    if (puppet) puppet.node = (S.box < 26) ? 'backstage' : null;
    const chi = S.actors.find(a => a.id === 'chica');
    S.kitchenNoise = (chi && chi.node === 'kitchen') ? 1 : 0.12;
  }

  function updateActor(a, dt) {
    const d = S.diff[a.id] || 0;
    if (a.id === 'puppet' || a.id === 'glitch') return;
    if (d <= 0 && a.id !== 'fox') return;

    const watching = S.camsUp && S.curCam === NODE_CAM[a.node];

    if (a.id === 'fox') {
      if (a.sprinting) {
        a.sprintT -= dt;
        if (S.rightDoor) {
          a.sprinting = false; a.stage = 0; a.timer = rand(9, 13);
          S.echo = Math.max(0, S.echo - 12);
          Sfx.thud(0.7); S.shake = 8;
          toast('闸板挡住了冲刺', 1600);
        } else if (a.sprintT <= 0) { kill('fox'); }
        return;
      }
      if (S.camsUp && S.curCam === '5') return;   // 盯着海盗湾可以拖延
      if (d <= 0) return;
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = Math.max(4.5, 11 - d * 0.42) * rand(0.85, 1.25);
        if (a.stage < 3) {
          a.stage++;
          Sfx.step(0.5, true);
          S.echo += 3;
        } else {
          a.sprinting = true; a.sprintT = 2.1;
          Sfx.step(0.85, true); Sfx.glitch(); S.shake = 6;
          toast('走廊里传来金属摩擦声！', 1800);
        }
      }
      return;
    }

    // 门口
    if (a.node === 'leftDoor' || a.node === 'rightDoor') {
      a.doorTimer += dt;
      S.echo += 0.6 * dt;
      const closed = a.node === 'leftDoor' ? S.leftDoor : S.rightDoor;
      if (a.doorTimer > CFG.doorGrace) {
        if (closed) { retreat(a); }
        else { kill(a.id); }
      }
      return;
    }
    // 通风口
    if (a.node === 'vent') {
      a.doorTimer += dt;
      S.echo += 0.5 * dt;
      if (a.doorTimer > CFG.ventGrace) {
        if (S.ventClosed) { a.node = 'kitchen'; a.doorTimer = 0; a.timer = rand(6, 10); Sfx.thud(0); }
        else { kill('chica'); }
      }
      return;
    }

    if (watching) return;   // 被看着就不动
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = Math.max(2.0, 5.8 - d * 0.14) * rand(0.8, 1.3);
      if (Math.random() < Math.min(1, d / 20 * 1.05)) stepActor(a);
    }
  }

  function stepActor(a) {
    const path = PATH[a.id];
    if (!path) return;
    const i = path.indexOf(a.node);
    if (i < 0) { a.node = 'stage'; return; }
    if (i === 0 && Math.random() < 0.22) return;   // 主舞台偶尔不动
    const ni = Math.min(path.length - 1, i + 1);
    a.node = path[ni];
    a.doorTimer = 0;
    const pan = a.node === 'leftDoor' ? -0.75 : a.node === 'rightDoor' ? 0.75 : (a.node.indexOf('west') >= 0 ? -0.35 : 0.35);
    Sfx.step(pan, a.node === 'leftDoor' || a.node === 'rightDoor');
  }

  /* ---------------- 死亡 / 停电 / 通关 ---------------- */
  function kill(id) {
    if (S.state !== 'play') return;
    S.state = 'jump';
    S.jumpscare = { id: id, t: 0 };
    S.leftDoor = S.rightDoor = false;
    S.camsUp = false;
    Sfx.stopMusicBox();
    Sfx.wind(false);
    Sfx.screech();
  }

  function goPowerOut() {
    S.powerOut = true; S.powerOutT = 0;
    S.leftDoor = S.rightDoor = false;
    S.leftLight = S.rightLight = false;
    S.camsUp = false; S.ventClosed = false;
    Sfx.ambience(false);
    Sfx.powerDown();
    setTimeout(() => { if (S.powerOut && S.state === 'play') Sfx.startMusicBox(2); }, 1400);
    toast('电量耗尽。什么都别做。', 3000);
  }

  function winNight() {
    S.state = 'win'; S.winT = 0;
    S.camsUp = false;
    Sfx.stopMusicBox(); Sfx.ambience(false); Sfx.wind(false);
    Sfx.chime();
    const n = S.night;
    if (n < 6) {
      save.unlocked = Math.max(save.unlocked, Math.min(6, n + 1));
      (LORE.nights[n - 1].unlock || []).forEach(id => {
        if (save.codex.indexOf(id) < 0) save.codex.push(id);
      });
      persist();
    }
    setTimeout(() => showResult('win'), 1500);
  }

  function showResult(kind) {
    S.state = kind === 'win' ? 'result' : 'gameover';
    S.camsUp = false;
    Sfx.stopMusicBox(); Sfx.ambience(false); Sfx.wind(false);
    const win = kind === 'win';
    $('resTitle').textContent = win ? '6 : 00 AM' : 'GAME OVER';
    $('resTitle').className = win ? 'res-title win' : 'res-title lose';
    let txt;
    if (win) {
      txt = LORE.endings.win['night' + Math.min(5, S.night)] || '天亮了。';
      if (S.night === 6) txt = '六个小时。所有旋钮都推到了尽头，而你还在呼吸。' +
        '\n\n档案馆的打印机吐出一张纸：' + '\n"档案员资格：通过。你可以走了。"' +
        '\n\n但电梯门开的时候，你听见地下还有一层在播放音乐盒。';
      if (S.night === 5) {
        const e = S.stats.peakEcho;
        if (e < 55) {
          txt = '六点整。整个夜里，你几乎没有让它们确认过你的存在。\n\n' +
            '结项报告上写着：观察者合格。\n附件里附了一张照片——空办公室，七把椅子，其中一把是温的。\n\n' +
            '【结局 · 旁观者】它们到最后都没能被你看见，也没能看见你。';
        } else if (e >= 85) {
          txt = '六点整。灵怨计几乎整夜贴着上限，画面一直在替你撒谎。\n\n' +
            '你走出电梯时，玻璃倒影里多站了一个人。它没有跟上来，只是抬起手，' +
            '做了个"下次见"的手势。\n\n【结局 · 被记住的人】档案馆今晚记住的不是你的名字，是你的注视。';
        } else {
          txt += '\n\n【结局 · 档案员】不算完美，但你让它们把记忆播完了。';
        }
        txt += '\n\n——主线完成。自定义夜已解锁。';
      }
    } else {
      txt = LORE.endings.lose[Math.floor(Math.random() * LORE.endings.lose.length)];
    }
    $('resText').textContent = txt;

    const mm = Math.floor(S.t / 60), ss = Math.floor(S.t % 60);
    $('resStats').innerHTML =
      '<div><span>夜次</span><b>' + (S.night === 6 ? '自定义' : '第 ' + S.night + ' 夜') + '</b></div>' +
      '<div><span>存活时间</span><b>' + mm + ' 分 ' + String(ss).padStart(2, '0') + ' 秒</b></div>' +
      '<div><span>剩余电量</span><b>' + Math.max(0, S.power).toFixed(1) + '%</b></div>' +
      '<div><span>灵怨峰值</span><b>' + Math.round(S.stats.peakEcho) + '%</b></div>';

    $('btnNext').style.display = (win && S.night < 6) ? '' : 'none';
    $('btnNext').onclick = () => startNight(Math.min(6, S.night + 1));
    $('btnRetry').onclick = () => startNight(S.night);
    showScreen('scrResult');
  }

  /* ---------------- HUD ---------------- */
  function updateHud() {
    const h = Math.min(CFG.hours, Math.floor(S.t / CFG.hourLen));
    $('hudClock').textContent = (h === 0 ? 12 : h) + ' AM';
    $('hudNight').textContent = S.night === 6 ? 'CUSTOM' : 'NIGHT ' + S.night;

    const pw = Math.max(0, S.power);
    $('barPower').style.width = pw + '%';
    $('barPower').className = 'bar-fill power' + (pw < 25 ? ' low' : '');
    $('txtPower').textContent = pw.toFixed(0) + '%';

    $('barEcho').style.width = S.echo + '%';
    $('txtEcho').textContent = Math.round(S.echo) + '%';
    $('barHeat').style.width = S.heat + '%';
    $('barHeat').className = 'bar-fill heat' + (S.heat > 75 ? ' low' : '');
    $('txtHeat').textContent = Math.round(S.heat) + '%';

    $('boxBar').style.width = S.box + '%';
    $('boxBar').className = 'box-fill' + (S.box < 30 ? ' low' : '');
    $('boxGauge').classList.toggle('warn', S.box < 30);

    $('lureNum').textContent = S.lures;

    // 按钮状态
    $('btnLD').classList.toggle('active', S.leftDoor);
    $('btnRD').classList.toggle('active', S.rightDoor);
    $('btnLL').classList.toggle('active', S.leftLight);
    $('btnRL').classList.toggle('active', S.rightLight);
    $('btnCams').classList.toggle('active', S.camsUp);
    $('btnVent').classList.toggle('active', S.ventClosed);
    $('camPanel').classList.toggle('on', S.camsUp);
    $('btnStare').classList.toggle('on', !!(S.gold && S.gold.active));
    $('btnStare').classList.toggle('pressing', !!S.staring);

    if (S.gold && S.gold.active) {
      $('stareRing').style.width = Math.min(100, (S.gold.stare / 3) * 100) + '%';
    }

    // 上弦按钮可用性
    const canWind = S.state === 'play' && S.camsUp && S.curCam === '6' && !S.powerOut;
    $('btnWind').classList.toggle('disabled', !canWind);
    $('btnWind').classList.toggle('active', S.winding && canWind);

    // 摄像头选中态
    const camBtns = $('camPanel').querySelectorAll('.cam-btn');
    for (let i = 0; i < camBtns.length; i++) {
      camBtns[i].classList.toggle('on', camBtns[i].dataset.cam === S.curCam);
    }

    // 暂停层
    $('scrPause').classList.toggle('on', S.paused && S.state === 'play');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind(id, fn, ev) {
    const el = $(id); if (!el) return;
    el.addEventListener(ev || 'click', fn);
  }

  function bindUI() {
    // 首次交互解锁音频
    const unlock = () => { Sfx.unlock(); Sfx.setVolume(save.settings.vol); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    bind('btnStart', () => startNight(1));
    bind('btnContinue', () => startNight(Math.min(save.unlocked, 6)));
    bind('btnNights', openNights);
    bind('btnResultMenu', goMenu);
    bind('btnCodex', () => { renderCodex(); showScreen('scrCodex'); });
    bind('btnHelp', () => showScreen('scrHelp'));
    bind('btnSettings', () => { openSettings(); showScreen('scrSettings'); });
    bind('btnNightsBack', goMenu);
    bind('btnBriefBack', goMenu);
    bind('btnCodexBack', goMenu);
    bind('btnHelpBack', goMenu);
    bind('btnSettingsBack', goMenu);
    bind('btnQuit', goMenu);

    bind('btnPause', () => { if (S.state === 'play') S.paused = true; });
    bind('btnResume', () => { S.paused = false; });

    bind('btnLL', () => toggleLight('l'));
    bind('btnRL', () => toggleLight('r'));
    bind('btnLD', () => toggleDoor('l'));
    bind('btnRD', () => toggleDoor('r'));
    bind('btnCams', toggleCams);
    bind('btnVent', toggleVent);
    bind('btnLure', useLure);

    // 长按上弦
    const windOn = e => { e.preventDefault(); S.winding = true; };
    const windOff = () => { S.winding = false; };
    ['pointerdown'].forEach(ev => $('btnWind').addEventListener(ev, windOn));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('btnWind').addEventListener(ev, windOff));

    // 长按注视
    $('btnStare').addEventListener('pointerdown', e => { e.preventDefault(); S.staring = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
      $('btnStare').addEventListener(ev, () => { S.staring = false; }));

    // 摄像机按钮
    const panel = $('camPanel');
    CAM_LIST.forEach(c => {
      const b = document.createElement('button');
      b.className = 'cam-btn';
      b.dataset.cam = c;
      b.innerHTML = '<b>' + c + '</b><span>' + (Art.CAM_INFO[c] || '') + '</span>';
      b.onclick = () => {
        if (S.state !== 'play' || !S.camsUp) return;
        S.curCam = c; Sfx.camSwitch();
      };
      panel.appendChild(b);
    });

    // 键盘
    window.addEventListener('keydown', e => {
      if (S.state !== 'play') {
        if (e.key === 'Escape' && S.paused) S.paused = false;
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'q') toggleDoor('l');
      else if (k === 'e') toggleDoor('r');
      else if (k === 'a') toggleLight('l');
      else if (k === 'd') toggleLight('r');
      else if (k === ' ') { e.preventDefault(); toggleCams(); }
      else if (k === 'w') toggleVent();
      else if (k === 'f') useLure();
      else if (k === 's') S.winding = true;
      else if (k === 'escape') S.paused = !S.paused;
      else if (k >= '1' && k <= '9') {
        const idx = parseInt(k, 10) - 1;
        if (S.camsUp && CAM_LIST[idx]) { S.curCam = CAM_LIST[idx]; Sfx.camSwitch(); }
      } else if (k === '0' && S.camsUp) { S.curCam = CAM_LIST[9]; Sfx.camSwitch(); }
    });
    window.addEventListener('keyup', e => {
      if (e.key.toLowerCase() === 's') S.winding = false;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S.state === 'play') S.paused = true;
    });

    // 设置
    $('volRange').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10) / 100;
      save.settings.vol = v; Sfx.setVolume(v);
      $('volVal').textContent = Math.round(v * 100) + '%';
      persist();
    });
    $('flickReduce').addEventListener('change', e => {
      save.settings.flicker = e.target.checked;
      S.flickerReduce = !!e.target.checked;
      persist();
    });
    $('btnResetSave').addEventListener('click', () => {
      if (confirm('确定清除全部进度与档案？此操作不可撤销。')) {
        save = { unlocked: 1, codex: [], settings: save.settings, custom: {} };
        persist(); renderSaveInfo(); renderCodex(); toast('存档已清除');
      }
    });
  }

  function openSettings() {
    $('volRange').value = Math.round(save.settings.vol * 100);
    $('volVal').textContent = Math.round(save.settings.vol * 100) + '%';
    $('flickReduce').checked = !!save.settings.flicker;
  }

  /* ---------------- 档案 ---------------- */
  let codexSel = null;
  function renderCodex() {
    const list = $('codexList');
    list.innerHTML = '';
    $('codexCount').textContent = save.codex.length + ' / ' + LORE.entries.length;
    LORE.entries.forEach(e => {
      const got = save.codex.indexOf(e.id) >= 0;
      const b = document.createElement('button');
      b.className = 'codex-item' + (got ? '' : ' locked') + (codexSel === e.id ? ' sel' : '');
      b.innerHTML = '<i class="tag" style="--c:' + LORE.tags[e.tag].color + '">' + LORE.tags[e.tag].label + '</i>' +
        '<b>' + (got ? e.title : '未解锁档案') + '</b>' +
        '<span>' + (got ? e.era : '—') + '</span>';
      b.onclick = () => { if (got) { codexSel = e.id; renderCodex(); } };
      list.appendChild(b);
    });
    if (!codexSel || save.codex.indexOf(codexSel) < 0) {
      codexSel = save.codex.length ? save.codex[save.codex.length - 1] : null;
    }
    const det = $('codexDetail');
    if (!codexSel) {
      det.innerHTML = '<div class="codex-empty">档案为空。<br>通关每一夜，解锁对应的历史碎片。</div>';
      return;
    }
    const e = LORE.entries.find(x => x.id === codexSel);
    det.innerHTML = '<div class="codex-head"><i class="tag" style="--c:' + LORE.tags[e.tag].color + '">' +
      LORE.tags[e.tag].label + '</i><span>' + e.era + '</span></div>' +
      '<h2>' + e.title + '</h2><p>' + e.text + '</p>';
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    canvas = $('stage');
    ctx = canvas.getContext('2d');
    Art.init();
    S.flickerReduce = !!save.settings.flicker;
    bindUI();
    renderSaveInfo();
    renderCodex();
    openSettings();
    showScreen('scrMenu');
    devHook();
    requestAnimationFrame(frame);
  }

  /* 开发调试钩子：仅在 URL 带 #dev 时生效，不参与正常流程 */
  function devHook() {
    const h = location.hash || '';
    if (h.indexOf('dev') < 0) return;
    window.__ECHO = { S: S, startNight: startNight, beginNight: beginNight, Art: Art, Sfx: Sfx, kill: kill, winNight: winNight };
    const m = /night=(\d)/.exec(h);
    if (m) {
      startNight(parseInt(m[1], 10));
      resetNight(parseInt(m[1], 10));
      S.state = 'play'; showScreen(null);
    }
    const cm = /cam=([0-9][AB]?)/.exec(h);
    const has = k => new RegExp('[#&]' + k + '($|&)').test(h);
    if (has('cams')) { S.camsUp = true; S.curCam = cm ? cm[1] : '1A'; }
    if (has('doorl')) S.leftDoor = true;
    if (has('doorr')) S.rightDoor = true;
    if (has('lightl')) S.leftLight = true;
    if (has('lightr')) S.rightLight = true;
    if (has('echo')) S.echo = 88;
    if (has('atdoorl')) { const a = S.actors.find(x => x.id === 'spring'); if (a) a.node = 'leftDoor'; S.leftLight = true; }
    if (has('atdoorr')) { const a = S.actors.find(x => x.id === 'fez'); if (a) a.node = 'rightDoor'; S.rightLight = true; }
    if (has('vent')) { const a = S.actors.find(x => x.id === 'chica'); if (a) a.node = 'vent'; }
    if (has('cove3')) { const a = S.actors.find(x => x.id === 'fox'); if (a) a.stage = 3; }
    const km = /kill=(\w+)/.exec(h);
    if (km) { window.__ECHO.kill(km[1]); S.jumpscare.t = 0.45; }
    const jm = /jump=(\w+)/.exec(h);
    if (jm) {
      S.state = 'jump';
      S.jumpscare = { id: jm[1], t: 0.5 };
      S.camsUp = false;
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
