// 효과음과 배경 음악 (코드로 합성)
"use strict";

/* ---------- 효과음 (파일 없이 코드로 합성) ---------- */
let AC = null;
const lastSfx = {};
const soundOn = () => { try { return localStorage.getItem('magic-league-sound') !== 'off'; } catch(e){ return true; } };
function setSound(on){ try { localStorage.setItem('magic-league-sound', on ? 'on' : 'off'); } catch(e){} }
function sfx(kind, opt){
  if (!soundOn()) return;
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return;
  const now = Date.now();
  if (lastSfx[kind] && now - lastSfx[kind] < (kind === 'skill' ? 90 : 60)) return;
  lastSfx[kind] = now;
  try {
    if (!AC) AC = new Ctor();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    const tone = (freq, dur, type = 'sine', vol = .06, slide = 0, delay = 0) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t + delay);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq*slide), t + delay + dur);
      g.gain.setValueAtTime(.0001, t + delay); g.gain.exponentialRampToValueAtTime(vol, t + delay + .01); g.gain.exponentialRampToValueAtTime(.0001, t + delay + dur);
      o.connect(g); g.connect(AC.destination); o.start(t + delay); o.stop(t + delay + dur + .02);
    };
    const base = {fire:330, wind:440, earth:196, water:392, light:523, dark:247}[opt] || 392;
    if (kind === 'skill') tone(base, .18, 'triangle', .035, 1.5);
    else if (kind === 'kill'){ if (opt === 0){ tone(660, .09, 'square', .03); tone(880, .12, 'square', .03, 0, .07); } else tone(220, .2, 'sawtooth', .025, .6); }
    else if (kind === 'tactic'){ tone(392, .1, 'triangle', .05); tone(523, .1, 'triangle', .05, 0, .08); tone(659, .16, 'triangle', .05, 0, .16); }
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .06, 0, i*.11));
    else if (kind === 'lose') [392, 330, 262].forEach((f, i) => tone(f, .28, 'sine', .05, 0, i*.14));
    else if (kind === 'ban') tone(180, .14, 'square', .03, .7);
    else if (kind === 'pick') tone(587, .12, 'triangle', .045, 1.3);
    else if (kind === 'ach') [784, 988, 1175].forEach((f, i) => tone(f, .18, 'triangle', .05, 0, i*.08));
  } catch(e){}
}

/* =========================================================
   배경 음악 (파일 없이 코드로 연주)
   ========================================================= */
const musicOn = () => { try { return localStorage.getItem('magic-league-music') !== 'off'; } catch(e){ return true; } };
const MUSIC = {
  menu:{bpm:70, prog:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]], arp:[0,1,2,1,2,1,0,1], every:2, bass:false, hat:false, pad:.022},
  battle:{bpm:112, prog:[[50,53,57],[46,50,53],[48,52,55],[45,49,52]], arp:[0,2,1,2,0,2,1,2], every:1, bass:true, hat:true, pad:.016},
};
let MZ = null;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function audioCtx(){
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try { if (!AC) AC = new Ctor(); return AC; } catch(e){ return null; }
}
function setMusic(on){
  try { localStorage.setItem('magic-league-music', on ? 'on' : 'off'); } catch(e){}
  if (on) musicStart(); else musicStop();
}
function musicStart(){
  if (!musicOn() || (MZ && MZ.timer) || typeof setInterval !== 'function') return;
  const ac = audioCtx(); if (!ac) return;
  try {
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
    if (!MZ){
      const g = ac.createGain(); g.gain.value = .0001; g.connect(ac.destination);
      const len = ac.sampleRate * .2, nb = ac.createBuffer(1, len, ac.sampleRate), d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      MZ = {gain:g, noise:nb, mode:musicModeNow(), beat:0, next:0, timer:null};
    }
    MZ.gain.gain.cancelScheduledValues(ac.currentTime);
    MZ.gain.gain.setTargetAtTime(.6, ac.currentTime, .8);
    MZ.next = ac.currentTime + .15;
    MZ.timer = setInterval(musicTick, 120);
  } catch(e){}
}
function musicStop(){
  if (!MZ || !MZ.timer) return;
  clearInterval(MZ.timer); MZ.timer = null;
  try { MZ.gain.gain.setTargetAtTime(.0001, AC.currentTime, .3); } catch(e){}
}
const musicModeNow = () => V && V.view === 'battle' ? 'battle' : 'menu';
function musicMode(){
  if (!MZ) return;
  const m = musicModeNow();
  if (m !== MZ.mode){ MZ.mode = m; MZ.beat = 0; }
}
function mVoice(t, freq, dur, type, vol, attack, cutoff){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  if (cutoff){ const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); f.connect(g); }
  else o.connect(g);
  g.connect(MZ.gain); o.start(t); o.stop(t + dur + .05);
}
function mHat(t){
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = MZ.noise; f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(.008, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
  s.connect(f); f.connect(g); g.connect(MZ.gain); s.start(t); s.stop(t + .06);
}
function musicTick(){
  if (!AC || !MZ) return;
  if (typeof document !== 'undefined' && document.hidden){ MZ.next = AC.currentTime + .15; return; }
  const M = MUSIC[MZ.mode] || MUSIC.menu, spb = 60 / M.bpm / 2;
  try {
    while (MZ.next < AC.currentTime + .45){
      const b = MZ.beat, t = MZ.next, chord = M.prog[Math.floor(b / 8) % M.prog.length];
      if (b % 8 === 0) chord.forEach((n, i) => { mVoice(t, mtof(n), spb*8.4, 'triangle', M.pad, .5, 900); mVoice(t, mtof(n) * 1.003, spb*8.4, 'sine', M.pad*.6, .7); });
      if (b % M.every === 0) mVoice(t, mtof(chord[M.arp[b % M.arp.length]] + 12), spb*2.2, 'sine', .02, .01);
      if (M.bass && b % 2 === 0) mVoice(t, mtof(chord[0] - 12), spb*1.8, 'triangle', .04, .01, 500);
      if (M.hat && b % 2 === 1) mHat(t);
      MZ.beat++; MZ.next += spb;
    }
  } catch(e){}
}
