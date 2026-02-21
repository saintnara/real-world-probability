const http = require('http');
const fs = require('fs');
const path = require('path');
const { scoreOpportunity, riskDecision, savePositionArtifacts } = require('./pipeline');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const MAX_SWARM_AGENTS = Number(process.env.MAX_SWARM_AGENTS || 4); // avoid overload on current machine

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

  if (req.url === '/' && req.method === 'GET') {
    const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    return send(res, 200, { ok: true, maxSwarmAgents: MAX_SWARM_AGENTS });
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
      const bankrollUsd = Number(body.bankrollUsd || 1000);
      const signalScore = scoreOpportunity(body);
      const risk = riskDecision({ bankrollUsd, signalScore, maxRiskPerTradePct: Number(body.maxRiskPerTradePct || 1) });
      if (!risk.approved) {
        return send(res, 200, { approved: false, reason: 'Signal/risk gate rejected', signalScore, risk });
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
        risk
      };

      const dir = savePositionArtifacts(ROOT, payload);
      return send(res, 200, {
        approved: true,
        signalScore,
        risk,
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
  console.log(`RWP MVP running on http://localhost:${PORT}`);
  console.log(`Max swarm agents configured: ${MAX_SWARM_AGENTS}`);
});