require('dotenv').config();
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { db, salvar } = require('./src/db');
const { parsePlanilha, encontrarPorTexto } = require('./src/condominios');
const { analisarBoleto } = require('./src/boleto');
const email = require('./src/email');

const PORTA = Number(process.env.PORTA || 3002);
const UPLOADS = path.join(__dirname, 'uploads');
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      req.compraId ||= new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(3).toString('hex');
      const dir = path.join(UPLOADS, req.compraId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.\-]+/g, '_'));
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const arquivo = (f) => ({
  nome: f.originalname,
  caminho: f.path,
  url: '/uploads/' + path.relative(UPLOADS, f.path).split(path.sep).join('/'),
  tipo: f.mimetype,
});

function listaItens(texto) {
  const itens = (texto || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  if (itens.length <= 1) return itens[0] || 'Compra';
  return itens.slice(0, -1).join(', ') + ' e ' + itens.at(-1);
}

// O campo "whatsapp" do condomínio pode ser:
//  - um número (81999999999): abre a conversa com a mensagem pronta;
//  - o link de convite do grupo (chat.whatsapp.com/...): abre o grupo e a mensagem vai copiada;
//  - o nome do grupo (ou vazio): abre a lista de conversas com a mensagem pronta para escolher o grupo.
function prepararWhatsApp(compra, condominio) {
  const texto = email.mensagemPadrao('WhatsApp');
  const destino = (condominio.whatsapp || '').trim();
  const numero = destino.replace(/\D/g, '');
  compra.whatsappTexto = texto;
  compra.whatsappGrupo = '';
  if (/chat\.whatsapp\.com\//i.test(destino)) {
    compra.whatsappLink = destino.startsWith('http') ? destino : 'https://' + destino;
    compra.whatsappCopiar = true;
  } else if (numero.length >= 10 && !/[a-z]/i.test(destino)) {
    compra.whatsappLink = `https://wa.me/${numero.length <= 11 ? '55' + numero : numero}?text=${encodeURIComponent(texto)}`;
    compra.whatsappCopiar = false;
  } else {
    compra.whatsappGrupo = destino;
    compra.whatsappLink = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    compra.whatsappCopiar = false;
  }
}

async function despachar(compra) {
  const condominio = db().condominios.find((c) => c.id === compra.condominioId);
  compra.erro = null;
  if (!condominio) {
    compra.status = 'sem_condominio';
  } else if (condominio.canal === 'WhatsApp') {
    compra.status = 'whatsapp_manual';
    prepararWhatsApp(compra, condominio);
  } else if (!condominio.emails.length) {
    compra.status = 'sem_contato';
  } else if (!email.configurado()) {
    compra.status = 'erro';
    compra.erro = 'E-mail de envio não configurado (arquivo .env).';
  } else {
    try {
      compra.messageId = await email.enviar(compra, condominio);
      compra.enviadoPara = condominio.emails;
      compra.enviadoEm = new Date().toISOString();
      compra.status = 'aguardando_resposta';
    } catch (e) {
      compra.status = 'erro';
      compra.erro = e.message;
    }
  }
  salvar();
  return compra;
}

// ---------- API ----------

app.get('/api/status', (_req, res) => {
  res.json({ emailConfigurado: email.configurado(), conta: process.env.EMAIL_USUARIO || null });
});

app.get('/api/condominios', (_req, res) => res.json(db().condominios));

app.put('/api/condominios/:id', (req, res) => {
  const c = db().condominios.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ erro: 'Condomínio não encontrado' });
  const campos = ['administradora', 'contato', 'responsavel', 'canal', 'whatsapp', 'status', 'empresa'];
  campos.forEach((k) => { if (k in req.body) c[k] = String(req.body[k] || '').trim(); });
  if ('emails' in req.body) {
    c.emails = String(req.body.emails).split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean);
  }
  salvar();
  res.json(c);
});

app.post('/api/condominios/importar', (req, res) => {
  const novos = parsePlanilha(req.body.texto || '');
  if (!novos.length) return res.status(400).json({ erro: 'Nenhuma linha reconhecida. Cole a planilha com o cabeçalho.' });
  const lista = db().condominios;
  for (const n of novos) {
    const i = lista.findIndex((c) => c.id === n.id);
    if (i >= 0) lista[i] = { ...lista[i], ...n, whatsapp: n.whatsapp || lista[i].whatsapp };
    else lista.push(n);
  }
  salvar();
  res.json({ importados: novos.length, total: lista.length });
});

// Lê o boleto antes do envio para sugerir condomínio, valor e vencimento.
app.post('/api/detectar', upload.single('boleto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Envie o boleto' });
  const info = await analisarBoleto(req.file.path, req.file.mimetype);
  fs.rm(path.dirname(req.file.path), { recursive: true, force: true }, () => {});
  const c = encontrarPorTexto(db().condominios, info.texto);
  res.json({ condominioId: c?.id || null, valor: info.valor || null, vencimento: info.vencimento || null });
});

app.get('/api/compras', (_req, res) => {
  res.json([...db().compras].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
});

app.post('/api/compras', upload.fields([{ name: 'fotos', maxCount: 20 }, { name: 'boletos', maxCount: 10 }]), async (req, res) => {
  const fotos = (req.files?.fotos || []).map(arquivo);
  const boletos = (req.files?.boletos || []).map(arquivo);
  if (!boletos.length) return res.status(400).json({ erro: 'Anexe pelo menos um boleto.' });

  let condominioId = req.body.condominioId || null;
  let valor = null;
  let vencimento = null;
  for (const b of boletos) {
    const info = await analisarBoleto(b.caminho, b.tipo);
    valor ??= info.valor || null;
    vencimento ??= info.vencimento || null;
    if (!condominioId) condominioId = encontrarPorTexto(db().condominios, info.texto)?.id || null;
  }
  const condominio = db().condominios.find((c) => c.id === condominioId);
  const itens = listaItens(req.body.itens);
  const responsavel = condominio?.responsavel || '';

  const compra = {
    id: req.compraId,
    criadoEm: new Date().toISOString(),
    condominioId,
    condominioNome: condominio?.nome || '',
    administradora: condominio?.administradora || '',
    responsavel,
    itens,
    observacao: (req.body.observacao || '').trim(),
    assunto: [itens, responsavel, condominio?.nome].filter(Boolean).join(' - '),
    valor,
    vencimento,
    fotos,
    boletos,
    respostas: [],
    status: 'novo',
  };
  db().compras.push(compra);
  await despachar(compra);
  res.json(compra);
});

// Exporta o histórico em CSV (abre direto no Excel).
app.get('/api/compras.csv', (_req, res) => {
  const STATUS = {
    aguardando_resposta: 'Aguardando resposta', respondido: 'Respondido', pago: 'Pago',
    whatsapp_manual: 'WhatsApp pendente', whatsapp_enviado: 'Enviado no WhatsApp',
    erro: 'Erro no envio', sem_contato: 'Sem e-mail da ADM', sem_condominio: 'Condomínio não identificado',
  };
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Condomínio', 'Itens', 'Operador', 'Administradora', 'Enviado para', 'Valor', 'Vencimento', 'Status', 'Última resposta']];
  for (const c of [...db().compras].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))) {
    const r = c.respostas.at(-1);
    linhas.push([
      new Date(c.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Recife' }),
      c.condominioNome, c.itens, c.responsavel, c.administradora, (c.enviadoPara || []).join('; '),
      c.valor != null ? c.valor.toFixed(2).replace('.', ',') : '',
      c.vencimento ? c.vencimento.split('-').reverse().join('/') : '',
      STATUS[c.status] || c.status,
      r ? r.texto.replace(/\s+/g, ' ').slice(0, 300) : '',
    ]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cedro-pagamentos.csv"');
  res.send('\uFEFF' + linhas.map((l) => l.map(cel).join(';')).join('\r\n'));
});

app.post('/api/compras/:id/reenviar', async (req, res) => {
  const compra = db().compras.find((c) => c.id === req.params.id);
  if (!compra) return res.status(404).json({ erro: 'Compra não encontrada' });
  if (req.body.condominioId) {
    const c = db().condominios.find((x) => x.id === req.body.condominioId);
    if (c) Object.assign(compra, {
      condominioId: c.id, condominioNome: c.nome, administradora: c.administradora,
      responsavel: compra.responsavel || c.responsavel,
    });
    compra.assunto = [compra.itens, compra.responsavel, compra.condominioNome].filter(Boolean).join(' - ');
  }
  res.json(await despachar(compra));
});

app.post('/api/compras/:id/status', (req, res) => {
  const compra = db().compras.find((c) => c.id === req.params.id);
  if (!compra) return res.status(404).json({ erro: 'Compra não encontrada' });
  const permitidos = ['pago', 'aguardando_resposta', 'respondido', 'whatsapp_enviado'];
  if (!permitidos.includes(req.body.status)) return res.status(400).json({ erro: 'Status inválido' });
  compra.status = req.body.status;
  salvar();
  res.json(compra);
});

app.delete('/api/compras/:id', (req, res) => {
  const lista = db().compras;
  const i = lista.findIndex((c) => c.id === req.params.id);
  if (i < 0) return res.status(404).json({ erro: 'Compra não encontrada' });
  const [compra] = lista.splice(i, 1);
  salvar();
  fs.rm(path.join(UPLOADS, compra.id), { recursive: true, force: true }, () => {});
  res.json({ ok: true });
});

// ---------- Verificação de respostas ----------

let ultimaVerificacao = null;
let verificando = null;

async function verificarRespostas() {
  if (!email.configurado()) return { erro: 'E-mail não configurado' };
  if (verificando) return verificando;
  verificando = (async () => {
    const pendentes = db().compras.filter((c) => c.messageId);
    const achadas = await email.buscarRespostas(pendentes.map((c) => c.messageId));
    let novas = 0;
    for (const compra of pendentes) {
      for (const r of achadas[compra.messageId] || []) {
        if (compra.respostas.some((x) => x.id === r.id)) continue;
        compra.respostas.push(r);
        novas++;
        if (compra.status === 'aguardando_resposta') compra.status = 'respondido';
      }
    }
    ultimaVerificacao = new Date().toISOString();
    salvar();
    return { novas, ultimaVerificacao };
  })().finally(() => { verificando = null; });
  return verificando;
}

app.post('/api/respostas/verificar', async (_req, res) => {
  try {
    res.json(await verificarRespostas());
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao ler a caixa de entrada: ' + e.message });
  }
});

app.get('/api/respostas/ultima', (_req, res) => res.json({ ultimaVerificacao }));

const minutos = Number(process.env.VERIFICAR_A_CADA_MINUTOS || 5);
setInterval(() => verificarRespostas().catch((e) => console.error('[respostas]', e.message)), minutos * 60 * 1000);

db();
const servidor = app.listen(PORTA, (erro) => {
  if (erro) return;
  console.log(`Cedro Pagamentos rodando em http://localhost:${PORTA}`);
  if (!email.configurado()) console.log('Atenção: configure EMAIL_USUARIO e EMAIL_SENHA_APP no arquivo .env');
  else verificarRespostas().catch((e) => console.error('[respostas]', e.message));
});
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`O Cedro Pagamentos já está aberto em http://localhost:${PORTA}`);
    process.exit(0);
  }
  throw e;
});
