const http = require('http');
const fs = require('fs');
const path = require('path');
const { scoreOpportunity, riskDecision, savePositionArtifacts } = require('./pipeline');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const MACHINE_MAX_SWARM_AGENTS = Number(process.env.MAX_SWARM_AGENTS || 4); // safety cap for this machine
const SETTINGS_PATH = path.join(ROOT, 'data', 'settings.json');

const TIER_SWARM_CAP = {
  private: 4,
  starter: 3,
  pro: 8,
  enterprise: 20
};

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function getSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    writeJson(SETTINGS_PATH, {
      accountType: 'private',
      requestedSwarmAgents: 3,
      refreshIntervalSec: 20,
      slippageTolerancePct: 1.5,
      bankrollUsd: 1000,
      maxRiskPerTradePct: 1
    });
  }
  return readJson(SETTINGS_PATH);
}

function getSwarmLimits(settings) {
  const tierCap = TIER_SWARM_CAP[settings.accountType] ?? TIER_SWARM_CAP.private;
  const requested = Number(settings.requestedSwarmAgents || 1);
  const effective = Math.max(1, Math.min(requested, tierCap, MACHINE_MAX_SWARM_AGENTS));
  return { tierCap, machineCap: MACHINE_MAX_SWARM_AGENTS, effective };
}

function send(res, code, body, contentType = 'application/json') {
  res.writeHead(code, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(contentType === 'application/json' ? JSON.stringify(body, null, 2) : body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function serveFile(res, filePath, contentType = 'text/plain') {
  if (!fs.existsSync(filePath)) return send(res, 404, { error: 'Not found' });
  send(res, 200, fs.readFileSync(filePath), contentType);
}

function calcSlippagePct(oddsAtSignal, currentOdds) {
  const a = Number(oddsAtSignal);
  const b = Number(currentOdds);
  if (!(a > 0) || !(b > 0)) return null;
  return Number((Math.abs((b - a) / a) * 100).toFixed(4));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

  if (req.url === '/' && req.method === 'GET') {
    const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    const settings = getSettings();
    const limits = getSwarmLimits(settings);
    return send(res, 200, { ok: true, swarm: limits, settings });
  }

  if (req.url === '/api/settings' && req.method === 'GET') {
    const settings = getSettings();
    return send(res, 200, { settings, swarm: getSwarmLimits(settings), tiers: TIER_SWARM_CAP });
  }

  if (req.url === '/api/settings' && req.method === 'POST') {
    try {
      const patch = await parseBody(req);
      const prev = getSettings();
      const next = {
        ...prev,
        ...patch,
        requestedSwarmAgents: Number(patch.requestedSwarmAgents ?? prev.requestedSwarmAgents),
        refreshIntervalSec: Number(patch.refreshIntervalSec ?? prev.refreshIntervalSec),
        slippageTolerancePct: Number(patch.slippageTolerancePct ?? prev.slippageTolerancePct),
        bankrollUsd: Number(patch.bankrollUsd ?? prev.bankrollUsd),
        maxRiskPerTradePct: Number(patch.maxRiskPerTradePct ?? prev.maxRiskPerTradePct)
      };
      writeJson(SETTINGS_PATH, next);
      return send(res, 200, { ok: true, settings: next, swarm: getSwarmLimits(next) });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (req.url === '/api/opportunities' && req.method === 'GET') {
    const opportunities = readJson(path.join(ROOT, 'data', 'opportunities.json'));
    const scored = opportunities.map((o) => ({
      ...o,
      signalScore: scoreOpportunity(o)
    }));
    return send(res, 200, scored);
  }

  if (req.url === '/api/position/create' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const settings = getSettings();
      const bankrollUsd = Number(body.bankrollUsd || settings.bankrollUsd || 1000);
      const maxRiskPerTradePct = Number(body.maxRiskPerTradePct || settings.maxRiskPerTradePct || 1);

      const signalScore = scoreOpportunity(body);
      const risk = riskDecision({ bankrollUsd, signalScore, maxRiskPerTradePct });
      if (!risk.approved) {
        return send(res, 200, { approved: false, reason: 'Signal/risk gate rejected', signalScore, risk });
      }

      const slippagePct = calcSlippagePct(body.oddsAtSignal, body.currentOdds);
      const tolerancePct = Number(settings.slippageTolerancePct || 1.5);
      if (slippagePct !== null && slippagePct > tolerancePct) {
        return send(res, 200, {
          approved: false,
          reason: 'Slippage tolerance exceeded',
          signalScore,
          risk,
          slippagePct,
          slippageTolerancePct: tolerancePct
        });
      }

      const payload = {
        positionId: `pos-${Date.now()}`,
        market: body.market,
        side: body.side || 'YES',
        edgePct: Number(body.edgePct || 0),
        thesis: body.thesis || 'No thesis provided',
        evidence: body.evidence || [],
        invalidators: body.invalidators || [],
        signalScore,
        risk,
        oddsAtSignal: body.oddsAtSignal,
        currentOdds: body.currentOdds,
        slippagePct
      };

      const dir = savePositionArtifacts(ROOT, payload);
      return send(res, 200, {
        approved: true,
        signalScore,
        risk,
        slippagePct,
        slippageTolerancePct: tolerancePct,
        positionId: payload.positionId,
        artifactDir: dir,
        summaryPdf: path.join(dir, '03_exec_summary.pdf')
      });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (req.url.startsWith('/artifacts/') && req.method === 'GET') {
    const rel = req.url.replace('/artifacts/', '');
    const filePath = path.join(ROOT, rel);
    const ext = path.extname(filePath).toLowerCase();
    const ct = ext === '.pdf' ? 'application/pdf' : ext === '.md' ? 'text/markdown' : 'application/octet-stream';
    return serveFile(res, filePath, ct);
  }

  return send(res, 404, { error: 'Route not found' });
});

server.listen(PORT, () => {
  const settings = getSettings();
  const limits = getSwarmLimits(settings);
  console.log(`RWP MVP running on http://localhost:${PORT}`);
  console.log(`Swarm cap => machine:${limits.machineCap}, tier:${limits.tierCap}, effective:${limits.effective}`);
});