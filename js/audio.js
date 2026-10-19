/* =========================================================
   程序化音频引擎 —— 零外部素材，全部由 Web Audio 合成
   ========================================================= */
window.Sfx = (function () {
  let ac = null, master = null, comp = null, noiseBuf = null;
  let vol = 0.7, muted = false;
  let fanGain = null, windGain = null, windSrc = null;
  let boxTimer = null, boxStep = 0, boxMode = 0;

  const MEL = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440,
               523.25, 440, 392, 349.23, 392, 440, 349.23, 293.66];

  function makeNoise(sec) {
    const len = Math.floor(ac.sampleRate * sec);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : vol;
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 22;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      master.connect(comp);
      comp.connect(ac.destination);
      noiseBuf = makeNoise(2);
      startFan();
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    return ac;
  }

  function startFan() {
    if (!ac || fanGain) return;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 0.6;
    fanGain = ac.createGain(); fanGain.gain.value = 0.0;
    src.connect(lp); lp.connect(fanGain); fanGain.connect(master);
    src.start();
    fanGain.gain.linearRampToValueAtTime(0.16, ac.currentTime + 2.0);
    // 风扇低频晃动
    const lfo = ac.createOscillator(); lfo.frequency.value = 11.5;
    const lg = ac.createGain(); lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(fanGain.gain); lfo.start();
  }

  function setFan(on) {
    if (!ac || !fanGain) return;
    fanGain.gain.cancelScheduledValues(ac.currentTime);
    fanGain.gain.linearRampToValueAtTime(on ? 0.16 : 0.0, ac.currentTime + 0.8);
  }

  function panner(p) {
    if (!ac.createStereoPanner) return null;
    const n = ac.createStereoPanner();
    n.pan.value = Math.max(-1, Math.min(1, p || 0));
    return n;
  }

  function noiseHit(o) {
    if (!ensure()) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 1200;
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    const dur = o.dur || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t + (o.atk || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    let out = g;
    const pn = panner(o.pan);
    if (pn) { g.connect(pn); out = pn; }
    out.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone(o) {
    if (!ensure()) return;
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 220, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.dur || 0.3));
    const g = ac.createGain();
    const dur = o.dur || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.atk || 0.008));
    if (o.sustain) {
      g.gain.setValueAtTime(o.gain || 0.2, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    osc.connect(g);
    let out = g;
    const pn = panner(o.pan);
    if (pn) { g.connect(pn); out = pn; }
    out.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  const api = {
    unlock() { ensure(); },
    setVolume(v) { vol = v; if (master) master.gain.value = muted ? 0 : v; },
    get volume() { return vol; },
    mute(m) { muted = m; if (master) master.gain.value = m ? 0 : vol; },
    get isMuted() { return muted; },

    ambience(on) { ensure(); setFan(on); },

    door(close, pan) {
      if (!ensure()) return;
      noiseHit({ freq: 700, q: 1.2, dur: 0.22, gain: 0.42, pan: pan });
      tone({ type: 'sine', f0: 96, f1: 42, dur: 0.42, gain: 0.42, pan: pan });
      tone({ type: 'square', f0: 240, f1: 120, dur: 0.09, gain: 0.06, pan: pan });
      if (close) noiseHit({ freq: 2600, q: 2, dur: 0.09, gain: 0.16, pan: pan });
    },
    click(pan) {
      noiseHit({ freq: 2200, q: 1.6, dur: 0.05, gain: 0.2, pan: pan });
    },
    light(on, pan) {
      if (!ensure()) return;
      noiseHit({ freq: 3200, q: 2, dur: 0.045, gain: 0.2, pan: pan });
      if (on) tone({ type: 'sawtooth', f0: 118, f1: 122, dur: 0.5, gain: 0.03, sustain: true, pan: pan });
    },
    camOpen() {
      noiseHit({ freq: 3200, rate: 1.4, dur: 0.26, gain: 0.3 });
      tone({ type: 'square', f0: 880, dur: 0.06, gain: 0.05 });
      tone({ type: 'square', f0: 1320, dur: 0.06, gain: 0.04, delay: 0.08 });
    },
    camClose() {
      noiseHit({ freq: 1400, dur: 0.16, gain: 0.22 });
      tone({ type: 'square', f0: 320, f1: 160, dur: 0.14, gain: 0.05 });
    },
    camSwitch() {
      noiseHit({ freq: 4200, dur: 0.1, gain: 0.18 });
      tone({ type: 'square', f0: 1200, dur: 0.03, gain: 0.03 });
    },
    step(pan, heavy) {
      noiseHit({ freq: heavy ? 380 : 620, q: 1.1, dur: heavy ? 0.13 : 0.08, gain: heavy ? 0.3 : 0.16, pan: pan });
      tone({ type: 'sine', f0: heavy ? 74 : 108, f1: 40, dur: 0.16, gain: heavy ? 0.28 : 0.14, pan: pan });
    },
    thud(pan) {
      tone({ type: 'sine', f0: 72, f1: 34, dur: 0.5, gain: 0.45, pan: pan });
      noiseHit({ freq: 300, dur: 0.18, gain: 0.2, pan: pan });
    },
    heartbeat() {
      tone({ type: 'sine', f0: 62, f1: 40, dur: 0.22, gain: 0.3 });
      tone({ type: 'sine', f0: 58, f1: 36, dur: 0.26, gain: 0.24, delay: 0.24 });
    },
    beep(f, dur) {
      tone({ type: 'square', f0: f || 660, dur: dur || 0.08, gain: 0.07 });
    },
    glitch() {
      for (let i = 0; i < 5; i++) {
        tone({ type: 'square', f0: 200 + Math.random() * 2400, dur: 0.035, gain: 0.05, delay: i * 0.035 });
      }
      noiseHit({ freq: 5200, dur: 0.22, gain: 0.14 });
    },
    overload() {
      if (!ensure()) return;
      for (let i = 0; i < 4; i++) {
        tone({ type: 'sawtooth', f0: i % 2 ? 480 : 660, dur: 0.22, gain: 0.09, delay: i * 0.24, sustain: true });
      }
      noiseHit({ freq: 2600, dur: 0.6, gain: 0.16 });
    },
    powerDown() {
      if (!ensure()) return;
      tone({ type: 'sawtooth', f0: 300, f1: 42, dur: 1.8, gain: 0.16 });
      noiseHit({ freq: 900, dur: 0.9, gain: 0.12 });
    },
    wind(on) {
      if (!ensure()) return;
      if (on) {
        if (windSrc) return;
        windSrc = ac.createBufferSource();
        windSrc.buffer = noiseBuf; windSrc.loop = true;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 3;
        windGain = ac.createGain(); windGain.gain.value = 0.0;
        const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9;
        const lg = ac.createGain(); lg.gain.value = 0.09;
        lfo.connect(lg); lg.connect(windGain.gain); lfo.start();
        windSrc.connect(f); f.connect(windGain); windGain.connect(master);
        windSrc.start();
        windGain.gain.linearRampToValueAtTime(0.11, ac.currentTime + 0.2);
      } else if (windSrc) {
        try { windSrc.stop(ac.currentTime + 0.12); } catch (e) {}
        windSrc = null; windGain = null;
      }
    },
    screech() {
      if (!ensure()) return;
      const t = ac.currentTime;
      for (let i = 0; i < 6; i++) {
        const o = ac.createOscillator();
        o.type = i % 2 ? 'sawtooth' : 'square';
        o.frequency.setValueAtTime(1200 + i * 340, t);
        o.frequency.exponentialRampToValueAtTime(140 + i * 30, t + 0.85);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.95);
      }
      noiseHit({ freq: 3400, q: 0.7, dur: 0.9, gain: 0.55, atk: 0.01 });
      noiseHit({ freq: 220, q: 0.8, dur: 1.1, gain: 0.4, atk: 0.02 });
      tone({ type: 'sine', f0: 48, f1: 30, dur: 1.2, gain: 0.45 });
    },
    chime() {
      if (!ensure()) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone({ type: 'sine', f0: f, dur: 1.6, gain: 0.16, delay: i * 0.22 });
        tone({ type: 'triangle', f0: f * 2, dur: 1.0, gain: 0.05, delay: i * 0.22 });
      });
    },
    boxAlarm() {
      tone({ type: 'sine', f0: 1046, dur: 0.14, gain: 0.14 });
      tone({ type: 'sine', f0: 784, dur: 0.2, gain: 0.13, delay: 0.18 });
    },
    note(f, gain, delay, dur) {
      if (!ensure()) return;
      tone({ type: 'triangle', f0: f, dur: dur || 1.1, gain: gain || 0.075, delay: delay || 0, atk: 0.01 });
      tone({ type: 'sine', f0: f * 2.01, dur: (dur || 1.1) * 0.6, gain: (gain || 0.075) * 0.35, delay: delay || 0 });
    },
    startMusicBox(mode) {
      if (!ensure()) return;
      api.stopMusicBox();
      boxMode = mode || 0;
      boxStep = 0;
      const int = boxMode === 2 ? 620 : 400;
      boxTimer = setInterval(() => {
        const f = MEL[boxStep % MEL.length] * (boxMode === 2 ? 0.5 : 1);
        api.note(f, boxMode === 2 ? 0.09 : 0.055, 0, 1.35);
        boxStep++;
      }, int);
    },
    stopMusicBox() {
      if (boxTimer) { clearInterval(boxTimer); boxTimer = null; }
    },
    stopAll() {
      api.stopMusicBox();
      api.wind(false);
      setFan(false);
    }
  };

  return api;
})();
