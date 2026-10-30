// Teste de fumaça: percorre os 5 passos com a API da Anthropic simulada
// (nenhuma chave real é usada) e confere a planilha gerada.
// Uso: node tests/smoke.mjs   (requer o pacote "playwright" com Chromium)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

// require (e não import) para também achar um playwright global via NODE_PATH
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pageUrl = 'file://' + path.join(root, 'index.html');

const extraction = {
  plano: 'Plano Exemplo', tipo: 'consulta', especialidade: 'Cardiologia',
  prestadores: [
    { estabelecimento: 'Clínica <b>Teste</b>', bairro: 'Centro', cidade: 'Campinas', uf: 'SP',
      endereco: 'Rua A, 10', medicos: 'Dra. X', tel1: '(19) 3333-4444', tel2: '0800 123 4567', tel3: '' }
  ]
};

function sse(text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const half = Math.ceil(text.length / 2);
  return ev('message_start', { message: { id: 'msg_1', content: [] } })
    + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(0, half) } })
    + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(half) } })
    + ev('content_block_stop', { index: 0 })
    + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } })
    + ev('message_stop', {});
}

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());

const requests = [];
// SheetJS: usa a cópia do npm quando existe (CI sem acesso ao CDN), senão o CDN
try {
  const xlsxPath = createRequire(import.meta.url).resolve('xlsx/dist/xlsx.full.min.js');
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/**', route =>
    route.fulfill({ path: xlsxPath, contentType: 'application/javascript' }));
} catch (e) { /* sem o pacote xlsx: carrega do CDN */ }

await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  requests.push({ body, headers: route.request().headers() });
  const text = body.system ? '```json\n' + JSON.stringify(extraction) + '\n```' : 'Olá, mensagem gerada.';
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(text) });
});

await page.goto(pageUrl);
await page.fill('#apikey-input', 'sk-ant-teste-0000000000000000');
await page.dispatchEvent('#apikey-input', 'input');

// perfil e endereços de partida salvos pela interface
await page.fill('#f-rotulo', 'Mãe');
await page.fill('#f-nome', 'Maria Exemplo');
await page.fill('#f-relacao', 'minha mãe');
await page.fill('#f-solicitante', 'Fulano');
await page.click('text=Salvar perfil neste navegador');
// endereços ficam num card sempre visível, sem abrir painel nenhum
await page.fill('#casa-rotulo', 'Casa');
await page.fill('#casa-endereco', 'Av. Brasil, 1, Campinas, SP');
await page.click('text=Adicionar endereço');
await page.fill('#casa-rotulo', 'Trabalho');
await page.fill('#casa-endereco', 'Rua B, 2, Campinas, SP');
await page.press('#casa-endereco', 'Enter');
assert.equal(await page.locator('#casas-list .casa-row').count(), 2);

const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
await page.setInputFiles('#pdf-input', { name: 'guia.pdf', mimeType: 'application/pdf', buffer: pdf });
await page.waitForFunction(() => !document.getElementById('btn-go2').disabled);
assert.ok(await page.isVisible('#btn-go2'), 'botão do passo 1 visível no passo 1');

await page.click('#btn-go2');
await page.waitForSelector('#s2-status .status-ok');
assert.equal(await page.isVisible('#btn-go2'), false, 'botão do passo 1 some nos outros passos');
assert.equal(requests[0].body.model, 'claude-opus-5-5');
assert.equal(requests[0].body.stream, true);
assert.equal(requests[0].body.fallbacks, 'default');
assert.equal(requests[0].headers['anthropic-beta'], 'server-side-fallback-2026-07-01');

await page.click('text=Definir mensagem WA →');
const msg = await page.inputValue('#wa-msg');
assert.match(msg, /Me chamo Fulano/);
assert.match(msg, /minha mãe Maria Exemplo/);
await page.click('text=Gerar mensagem com IA');
await page.waitForFunction(() => document.getElementById('wa-msg').value === 'Olá, mensagem gerada.');

await page.click('text=Ver prévia →');
const cell = await page.locator('#preview-tbody td').nth(1).innerHTML();
assert.equal(cell, 'Clínica &lt;b&gt;Teste&lt;/b&gt;', 'conteúdo do PDF é escapado');

const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Gerar planilha →')]);
assert.match(download.suggestedFilename(), /^\d{8}_Maria_Cardiologia_Plano_Exemplo\.xlsx$/);
const bytes = [...(await import('node:fs')).readFileSync(await download.path())];
const sheet = await page.evaluate(b => {
  const wb = XLSX.read(new Uint8Array(b), { type: 'array' });
  const ws = wb.Sheets.Prestadores;
  return { rows: XLSX.utils.sheet_to_json(ws, { header: 1 }), links: Object.fromEntries(
    // o leitor do SheetJS devolve o alvo ainda escapado como no XML (&amp;)
    Object.entries(ws).filter(([k, v]) => v && v.l).map(([k, v]) => [k, v.l.Target.replace(/&amp;/g, '&')])) };
}, bytes);
assert.deepEqual(sheet.rows[0], ['Estabelecimento','Bairro','Cidade','Endereço','Médico(s)','Rota Casa','Rota Trabalho','Telefone 1','Telefone 2','Telefone 3','Status do Contato']);
assert.equal(sheet.rows[1][2], 'Campinas - SP');
assert.match(sheet.links.D2, /query=Rua%20A%2C%2010%2C%20Campinas%2C%20SP%2C%20Brasil/);
// rota: origem = endereço cadastrado, destino = endereço do prestador
assert.match(sheet.links.F2, /origin=Av\.%20Brasil%2C%201%2C%20Campinas%2C%20SP&destination=Rua%20A%2C%2010%2C%20Campinas%2C%20SP%2C%20Brasil/);
assert.match(sheet.links.G2, /origin=Rua%20B%2C%202%2C%20Campinas%2C%20SP&destination=Rua%20A%2C%2010/);
assert.match(sheet.links.H2, /^https:\/\/wa\.me\/551933334444\?text=Ol%C3%A1/);
assert.equal(sheet.links.I2, undefined, '0800 não vira link de WhatsApp');

// configuração persiste após recarregar
await page.reload();
assert.equal(await page.inputValue('#f-nome'), 'Maria Exemplo');
assert.equal(await page.inputValue('#f-solicitante'), 'Fulano');
assert.equal(await page.locator('#casas-list .casa-row').count(), 2, 'endereços sobrevivem ao recarregar');

assert.deepEqual(errors, [], 'sem erros de JavaScript');
await browser.close();
console.log('smoke ok');
