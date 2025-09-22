/*
CSPRNG Live - Final (requested fixes)
- samplesPlanned = 25
- previewOffset = 35s (preview published at final - 35s)
- previousResult broadcast at preview time so it appears 35s before final
- robust scheduler: schedule each minute by computing exact UTC minute boundary
- samples collected across sampleWindow (60 - previewOffset) seconds after minute start
- secure RNG via crypto.randomInt(0,10)
- admin endpoints protected via ADMIN_TOKEN env var
*/

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const path = require('path');
const bodyParser = require('body-parser');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'token123';

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

function randDigit(){ return crypto.randomInt(0,10); }
function isoUTC(d){ return d.toISOString().replace('.000',''); }
function floorToMinuteUTC(d){ return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0)); }

class MinuteEngine {
  constructor(){
    this.samplesPlanned = 25;
    this.previewOffset = 35;
    this.currentMinuteStart = null;
    this.samples = [];
    this.sampleTimers = [];
    this.previewTimer = null;
    this.finalTimer = null;
    this.running = false;
    this.previousResult = null; // last final result
  }

  start(){
    if(this.running) return;
    this.running = true;
    this.scheduleNextMinute();
  }

  stop(){
    this.running = false;
    this.clearTimers();
  }

  clearTimers(){
    this.sampleTimers.forEach(t => clearTimeout(t));
    this.sampleTimers = [];
    if(this.previewTimer){ clearTimeout(this.previewTimer); this.previewTimer = null; }
    if(this.finalTimer){ clearTimeout(this.finalTimer); this.finalTimer = null; }
  }

  scheduleNextMinute(){
    this.clearTimers();
    const now = new Date();
    const next = floorToMinuteUTC(now);
    // ensure next is the upcoming minute boundary
    if(now.getUTCSeconds() !== 0 || now.getUTCMilliseconds() !== 0) next.setUTCMinutes(next.getUTCMinutes() + 1);
    const delay = next - now;
    // schedule runMinute to start at the exact boundary + small offset
    setTimeout(() => this.runMinute(next), delay + 10);
  }

  runMinute(minuteStart){
    // prepare new round
    this.clearTimers();
    this.currentMinuteStart = minuteStart;
    this.samples = [];

    // sample window: from minuteStart to minuteStart + sampleWindowSec
    const sampleWindowSec = Math.max(1, 60 - this.previewOffset);
    const interval = sampleWindowSec / this.samplesPlanned;

    for(let i=0;i<this.samplesPlanned;i++){
      const delayMs = Math.round((i * interval + 0.2) * 1000);
      const t = setTimeout(() => {
        const d = randDigit();
        this.samples.push(d);
        // broadcast incremental sample event
        broadcast({
          type: 'sample',
          minuteStart: isoUTC(this.currentMinuteStart),
          sampleDigit: d,
          samplesTaken: this.samples.length,
          counts: this.stats()
        });
      }, delayMs);
      this.sampleTimers.push(t);
    }

    const finalTime = new Date(minuteStart.getTime() + 60000); // lock at :00 next minute
    const previewTime = new Date(finalTime.getTime() - this.previewOffset*1000);
    const now = new Date();

    const msToPreview = Math.max(0, previewTime - now);
    const msToFinal = Math.max(0, finalTime - now);

    // At preview time: publish preview for current minute and also send previousResult (last final) so UI shows previous result 35s before final
    this.previewTimer = setTimeout(() => {
      this.publishPreview();
      // send previous result separately so UI can show it
      if(this.previousResult){
        broadcast({ type: 'previous', previous: this.previousResult });
      }
    }, msToPreview);

    // At final time: lock final digit for current minute
    this.finalTimer = setTimeout(() => {
      this.publishFinal();
    }, msToFinal);

    // schedule next minute after final to avoid skipping
    setTimeout(() => {
      if(this.running) this.scheduleNextMinute();
    }, msToFinal + 200);
  }

  stats(){
    const counts = {};
    for(let i=0;i<10;i++) counts[i.toString()] = 0;
    this.samples.forEach(d => counts[d.toString()]++);
    return counts;
  }

  publishPreview(){
    const payload = {
      type: 'preview',
      minuteStart: isoUTC(this.currentMinuteStart),
      publishedAt: isoUTC(new Date()),
      samplesPlanned: this.samplesPlanned,
      samplesTaken: this.samples.length,
      counts: this.stats(),
      previewOffset: this.previewOffset
    };
    broadcast(payload);
  }

  publishFinal(){
    const finalDigit = randDigit();
    const payload = {
      type: 'final',
      minuteStart: isoUTC(this.currentMinuteStart),
      lockedAt: isoUTC(new Date()),
      finalDigit,
      samplesPlanned: this.samplesPlanned,
      samplesTaken: this.samples.length,
      counts: this.stats()
    };
    // set previousResult to be available for next round's preview time
    this.previousResult = {
      minuteStart: payload.minuteStart,
      finalDigit: finalDigit,
      counts: payload.counts
    };
    broadcast(payload);
    // also immediately emit previous so UIs that connect after final can get it
    broadcast({ type: 'previous', previous: this.previousResult });
  }
}

const engine = new MinuteEngine();
engine.start();

function broadcast(obj){
  const text = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if(c.readyState === WebSocket.OPEN){
      try{ c.send(text); } catch(e) {}
    }
  });
}

// API endpoints
app.get('/api/status', (req,res) => {
  const now = new Date();
  const minuteStart = floorToMinuteUTC(now);
  const finalTime = new Date(minuteStart.getTime() + 60000);
  const secondsUntilFinal = Math.max(0, Math.ceil((finalTime - now)/1000));
  const secondsUntilPreview = Math.max(0, secondsUntilFinal - engine.previewOffset);
  res.json({
    now: isoUTC(now),
    minuteStart: isoUTC(minuteStart),
    samplesPlanned: engine.samplesPlanned,
    samplesTaken: engine.samples.length,
    counts: engine.stats(),
    secondsUntilPreview,
    secondsUntilFinal,
    previousResult: engine.previousResult || null,
    status: engine.running ? 'running' : 'stopped'
  });
});

function checkToken(req,res,next){
  const header = req.headers['x-admin-token'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if(!header || header !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/api/config', checkToken, (req,res) => {
  const { samplesPlanned, previewOffset } = req.body || {};
  if(typeof samplesPlanned === 'number' && samplesPlanned > 0) engine.samplesPlanned = Math.floor(samplesPlanned);
  if(typeof previewOffset === 'number' && previewOffset >=0 && previewOffset < 60) engine.previewOffset = Math.floor(previewOffset);
  res.json({ ok:true, samplesPlanned: engine.samplesPlanned, previewOffset: engine.previewOffset });
});

app.post('/api/force-preview', checkToken, (req,res) => { engine.publishPreview(); res.json({ ok:true }); });
app.post('/api/force-final', checkToken, (req,res) => { engine.publishFinal(); res.json({ ok:true }); });

app.get('/health', (req,res) => res.send('ok'));

// WebSocket connection handler
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type:'welcome', now: isoUTC(new Date()), previewOffset: engine.previewOffset, samplesPlanned: engine.samplesPlanned, previousResult: engine.previousResult }));
  ws.isAlive = true;
  ws.on('pong', () => ws.isAlive = true);
});

// heartbeat cleanup
setInterval(() => {
  wss.clients.forEach(ws => {
    if(!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

server.listen(PORT, () => console.log('CSPRNG Live Final listening on', PORT));
