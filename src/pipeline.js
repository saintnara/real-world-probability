const fs = require('fs');
const path = require('path');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function scoreOpportunity(input) {
  const edge = Number(input.edgePct || 0); // expected edge in %
  const liquidity = Number(input.liquidity || 0); // USD
  const evidence = Number(input.evidenceQuality || 0); // 0..100
  const volatility = Number(input.volatilityRisk || 50); // 0..100 (higher=worse)

  const edgeScore = clamp(edge * 2.2, 0, 40);
  const liquidityScore = clamp(Math.log10(Math.max(liquidity, 1)) * 8, 0, 20);
  const evidenceScore = clamp(evidence * 0.3, 0, 30);
  const volPenalty = clamp((volatility - 40) * 0.25, 0, 15);

  const signalScore = clamp(edgeScore + liquidityScore + evidenceScore - volPenalty, 0, 100);
  return Math.round(signalScore);
}

function riskDecision({ bankrollUsd, signalScore, maxRiskPerTradePct = 1 }) {
  const baseRiskPct = clamp((signalScore - 55) / 50, 0, 1) * maxRiskPerTradePct;
  const suggestedRiskUsd = Number((bankrollUsd * (baseRiskPct / 100)).toFixed(2));
  return {
    approved: signalScore >= 65 && suggestedRiskUsd > 0,
    riskPct: Number(baseRiskPct.toFixed(3)),
    riskUsd: suggestedRiskUsd,
    rrMin: signalScore >= 80 ? 1.8 : 1.4
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function simplePdfBuffer(title, lines) {
  const safeLines = [title, '', ...lines].map((l) =>
    String(l).replace(/[()\\]/g, (m) => `\\${m}`)
  );

  const textOps = ['BT', '/F1 11 Tf', '50 770 Td'];
  safeLines.forEach((line, idx) => {
    if (idx > 0) textOps.push('0 -16 Td');
    textOps.push(`(${line}) Tj`);
  });
  textOps.push('ET');

  const stream = textOps.join('\n');
  const objects = [];
  const addObj = (s) => objects.push(s);

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  addObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  addObj(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`);

  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(out, 'utf8'));
    out += obj;
  }

  const xrefPos = Buffer.byteLength(out, 'utf8');
  out += `xref\n0 ${objects.length + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(out, 'utf8');
}

function savePositionArtifacts(rootDir, payload) {
  const date = new Date();
  const yyyy = String(date.getFullYear());
  const id = payload.positionId;
  const dir = path.join(rootDir, 'data', 'positions', yyyy, id);
  ensureDir(dir);

  const pretrade = {
    createdAt: date.toISOString(),
    ...payload
  };
  fs.writeFileSync(path.join(dir, '01_pretrade.json'), JSON.stringify(pretrade, null, 2));

  const summaryMd = [
    `# Executive Summary — ${payload.market}`,
    '',
    `- Side: **${payload.side}**`,
    `- Signal score: **${payload.signalScore}**`,
    `- Estimated edge: **${payload.edgePct}%**`,
    `- Suggested risk: **$${payload.risk.riskUsd} (${payload.risk.riskPct}%)**`,
    `- Thesis: ${payload.thesis}`,
    '',
    '## Evidence',
    ...(payload.evidence || []).map((e) => `- ${e}`),
    '',
    '## Invalidators',
    ...(payload.invalidators || []).map((i) => `- ${i}`)
  ].join('\n');
  fs.writeFileSync(path.join(dir, '02_exec_summary.md'), summaryMd, 'utf8');

  const pdf = simplePdfBuffer(`Executive Summary: ${payload.market}`, [
    `Position ID: ${payload.positionId}`,
    `Side: ${payload.side}`,
    `Signal score: ${payload.signalScore}`,
    `Edge: ${payload.edgePct}%`,
    `Risk USD: ${payload.risk.riskUsd}`,
    `Thesis: ${payload.thesis}`,
    'See markdown report for full detail.'
  ]);
  fs.writeFileSync(path.join(dir, '03_exec_summary.pdf'), pdf);

  return dir;
}

module.exports = {
  scoreOpportunity,
  riskDecision,
  savePositionArtifacts
};