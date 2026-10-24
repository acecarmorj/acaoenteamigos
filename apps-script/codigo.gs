/******************************************************
 * Rifa Honda XRE 190 2018 — Ação entre Amigos
 * Google Apps Script Backend (Google Sheets + Drive).
 * Escala: 10.000 cotas (0000 a 9999), R$ 20,00 por cota.
 *
 * Características principais:
 * - 10.000 cotas: NUMERO_INICIAL = 0, QUANTIDADE_NUMEROS = 10000 (0000 a 9999).
 * - VALOR_POR_NUMERO = 20 (R$ 20,00).
 * - Suporte a armazenamento esparso (números não registrados são 'livre' por padrão).
 * - Inicialização em lotes (batch chunks de 1.000 linhas) para evitar timeout.
 * - Concorrência segura via LockService (waitLock até 30s).
 * - Privacidade pública: action 'listar' remove nomes e telefones (PII sanitizado).
 ******************************************************/

const SHEET_NAME = 'Numeros';
const NUMERO_INICIAL = 0;
const QUANTIDADE_NUMEROS = 10000;
const START_NUMERO = NUMERO_INICIAL;
const TOTAL_NUMEROS = QUANTIDADE_NUMEROS;
const MAX_NUMERO = START_NUMERO + TOTAL_NUMEROS - 1; // 9999
const PANEL_SIZE = 100;
const VALOR_POR_NUMERO = 20;
const DEFAULT_VALOR_NUMERO = VALOR_POR_NUMERO;
const COMPROVANTES_FOLDER_NAME = 'Comprovantes - Rifa Honda XRE 190';
const BATCH_SIZE = 1000;

const COLS = [
  'numero',
  'status',
  'nome',
  'whatsapp',
  'valor',
  'data_reserva',
  'data_pagamento',
  'observacao',
  'comprovante_nome',
  'comprovante_url',
  'data_comprovante',
  'comprovante_tipo'
];

const COL = COLS.reduce(function (acc, name, index) {
  acc[name] = index;
  return acc;
}, {});

function inicializarPlanilha() {
  return inicializarPlanilha_(false);
}

function inicializarPlanilhaCompleta() {
  return inicializarPlanilha_(true);
}

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || 'listar').trim();

    if (action === 'listar') {
      return json_({
        ok: true,
        total_numeros: TOTAL_NUMEROS,
        numero_inicial: START_NUMERO,
        valor_numero: VALOR_POR_NUMERO,
        numeros: listarNumeros_(payload)
      });
    }

    if (action === 'reservar') {
      return json_(reservarNumeros_(payload));
    }

    if (action === 'enviarComprovante') {
      return json_(enviarComprovante_(payload));
    }

    if (action === 'confirmarPagamento') {
      payload.status = 'pago';
      return json_(atualizarStatus_(payload));
    }

    if (action === 'liberarNumero') {
      payload.status = 'livre';
      return json_(atualizarStatus_(payload));
    }

    if (action === 'atualizarStatus') {
      return json_(atualizarStatus_(payload));
    }

    if (action === 'inicializar') {
      const prefillAll = payload.prefillAll === true || payload.prefillAll === 'true';
      const msg = inicializarPlanilha_(prefillAll);
      return json_({ ok: true, message: msg });
    }

    return json_({ ok: false, error: 'Ação inválida: ' + action });
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function parsePayload_(e) {
  let payload = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (key) {
      payload[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    try {
      const parsed = JSON.parse(raw);
      payload = Object.assign(payload, parsed);
    } catch (ignore) {}
  }

  return payload;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) {
    return String(v || '').trim();
  });

  const hasAnyHeader = header.some(function (v) { return v; });
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, COLS.length).setValues([COLS]);
    sheet.setFrozenRows(1);
    formatSheet_(sheet);
    return;
  }

  const missing = COLS.filter(function (col) {
    return header.indexOf(col) === -1;
  });

  if (missing.length) {
    sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
  }

  sheet.setFrozenRows(1);
  formatSheet_(sheet);
}

function formatSheet_(sheet) {
  sheet.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#e7f4ff');
  try { sheet.autoResizeColumns(1, COLS.length); } catch (ignore) {}
}

function isValidNumero_(n) {
  return typeof n === 'number' && !isNaN(n) && isFinite(n) && Math.floor(n) === n && n >= START_NUMERO && n <= MAX_NUMERO;
}

function formatCode_(n) {
  return String(n).padStart(4, '0');
}

/**
 * Inicialização com suporte a lote (batch chunking) e modo esparso.
 * Em modo padrão (prefillAll=false), apenas prepara o cabeçalho.
 * Em modo completo (prefillAll=true), preenche em lotes de 1.000 para não estourar o limite de tempo do Google.
 */
function inicializarPlanilha_(prefillAll) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    if (!prefillAll) {
      return 'Planilha preparada em modo esparso (0000 a 9999). Números sem reserva são livres por padrão.';
    }

    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, COLS.length).getValues()
      : [];

    const existentes = {};
    rows.forEach(function (row) {
      const rawNum = row[COL.numero];
      if (rawNum !== '' && rawNum !== null && rawNum !== undefined) {
        const numero = Number(rawNum);
        if (isValidNumero_(numero)) existentes[numero] = true;
      }
    });

    const toAppend = [];
    for (let i = START_NUMERO; i <= MAX_NUMERO; i++) {
      if (!existentes[i]) {
        toAppend.push([i, 'livre', '', '', '', '', '', '', '', '', '', '']);
      }
    }

    // Gravação em lotes (chunks) para evitar timeout
    for (let offset = 0; offset < toAppend.length; offset += BATCH_SIZE) {
      const chunk = toAppend.slice(offset, offset + BATCH_SIZE);
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, chunk.length, COLS.length).setValues(chunk);
      SpreadsheetApp.flush();
    }

    formatSheet_(sheet);
    return 'Planilha pré-preenchida com sucesso com 10.000 cotas (0000 a 9999).';
  } finally {
    lock.releaseLock();
  }
}

/**
 * Listagem sanitizada para consulta pública.
 * Remove rigorosamente dados pessoais (nome, whatsapp, comprovante_url).
 * Retorna apenas { numero, status }.
 */
function listarNumeros_(payload) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const opts = payload || {};
  const hasPanel = opts.panel !== undefined && opts.panel !== null && String(opts.panel).trim() !== '';
  const panelIndex = hasPanel ? Math.max(0, Math.min(99, Number(opts.panel) || 0)) : null;
  const panelFirst = panelIndex !== null ? START_NUMERO + panelIndex * PANEL_SIZE : START_NUMERO;
  const panelLast = panelIndex !== null ? Math.min(MAX_NUMERO, panelFirst + PANEL_SIZE - 1) : MAX_NUMERO;
  const includeAllFree = opts.includeFree === true || opts.includeFree === 'true';

  const values = sheet.getRange(2, 1, lastRow - 1, COLS.length).getValues();
  const out = [];

  for (let i = 0; i < values.length; i++) {
    const rawNum = values[i][COL.numero];
    if (rawNum === '' || rawNum === null || rawNum === undefined) continue;
    const numero = Number(rawNum);
    if (!isValidNumero_(numero)) continue;
    if (panelIndex !== null && (numero < panelFirst || numero > panelLast)) continue;

    const status = String(values[i][COL.status] || 'livre').toLowerCase().trim();
    if (!includeAllFree && status === 'livre') continue;

    // PRIVACIDADE PÚBLICA: apenas numero e status são expostos
    out.push({
      numero: numero,
      status: status
    });
  }

  return out.sort(function (a, b) {
    return Number(a.numero) - Number(b.numero);
  });
}

function rowToObject_(row) {
  return {
    numero: Number(row[COL.numero]),
    status: String(row[COL.status] || 'livre').toLowerCase().trim(),
    nome: row[COL.nome] || '',
    whatsapp: row[COL.whatsapp] || '',
    valor: Number(row[COL.valor] || 0),
    data_reserva: dateToIso_(row[COL.data_reserva]),
    data_pagamento: dateToIso_(row[COL.data_pagamento]),
    observacao: row[COL.observacao] || '',
    comprovante_nome: row[COL.comprovante_nome] || '',
    comprovante_url: row[COL.comprovante_url] || '',
    data_comprovante: dateToIso_(row[COL.data_comprovante]),
    comprovante_tipo: row[COL.comprovante_tipo] || ''
  };
}

function dateToIso_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value);
}

function getRowsWithIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, COLS.length).getValues();
  const rows = [];
  for (let index = 0; index < values.length; index++) {
    const rawNum = values[index][COL.numero];
    if (rawNum === '' || rawNum === null || rawNum === undefined) continue;
    const norm = normalizeRow_(values[index]);
    rows.push({
      rowIndex: index + 2,
      values: norm,
      data: rowToObject_(norm)
    });
  }
  return rows;
}

function normalizeRow_(row) {
  const out = row.slice(0, COLS.length);
  while (out.length < COLS.length) out.push('');
  return out;
}

/**
 * Reserva de cotas com LockService para garantir integridade e atomicidade sob concorrência.
 */
function reservarNumeros_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const byNumber = {};
    rows.forEach(function (item) {
      if (isValidNumero_(item.data.numero)) {
        byNumber[Number(item.data.numero)] = item;
      }
    });

    const numeros = parseNumeros_(payload.numeros);
    if (!numeros.length) throw new Error('Nenhum número válido informado (0000 a 9999).');

    const nome = String(payload.nome || '').trim();
    const whatsapp = String(payload.whatsapp || '').trim();
    const observacao = String(payload.observacao || '').trim();
    const valorPorNumero = Number(payload.valorPorNumero || VALOR_POR_NUMERO);

    if (!nome) throw new Error('Nome obrigatório.');
    if (!whatsapp) throw new Error('WhatsApp obrigatório.');

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      if (item && item.data.status !== 'livre') {
        throw new Error('A cota ' + formatCode_(numero) + ' acabou de ser reservada por outra pessoa.');
      }
    });

    const now = new Date();
    const rowsToAppend = [];

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      const newRow = [
        numero,
        'reservado',
        nome,
        whatsapp,
        valorPorNumero,
        now,
        '',
        observacao,
        '',
        '',
        '',
        ''
      ];
      if (item) {
        sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([newRow]);
      } else {
        rowsToAppend.push(newRow);
      }
    });

    if (rowsToAppend.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, COLS.length).setValues(rowsToAppend);
    }

    return { ok: true, numeros: numeros, message: 'Reserva realizada com sucesso!' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Envio de comprovante anexado via Drive com concorrência segura.
 */
function enviarComprovante_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const byNumber = {};
    rows.forEach(function (item) {
      if (isValidNumero_(item.data.numero)) {
        byNumber[Number(item.data.numero)] = item;
      }
    });

    const numeros = parseNumeros_(payload.numeros);
    if (!numeros.length) throw new Error('Nenhum número informado para vincular ao comprovante.');

    const arquivoBase64 = String(payload.arquivoBase64 || '').trim();
    const arquivoNome = sanitizeFileName_(payload.arquivoNome || 'comprovante.jpg');
    const arquivoMime = String(payload.arquivoMime || 'image/jpeg').trim();
    const autoConfirmar = payload.autoConfirmar === true || payload.autoConfirmar === 'true';

    if (!arquivoBase64) throw new Error('Comprovante não enviado.');

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      if (!item || item.data.status === 'livre') {
        throw new Error('A cota ' + formatCode_(numero) + ' está livre e não possui reserva pendente.');
      }
    });

    const now = new Date();
    const fileUrl = saveProofFile_(arquivoBase64, arquivoNome, arquivoMime, numeros, now);
    const finalStatus = autoConfirmar ? 'pago' : 'reservado';

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      const row = normalizeRow_(item.values);
      row[COL.status] = finalStatus;
      row[COL.nome] = String(payload.nome || row[COL.nome] || '').trim();
      row[COL.whatsapp] = String(payload.whatsapp || row[COL.whatsapp] || '').trim();
      row[COL.valor] = Number(row[COL.valor] || payload.valorPorNumero || VALOR_POR_NUMERO);
      row[COL.data_reserva] = row[COL.data_reserva] || now;
      if (autoConfirmar) row[COL.data_pagamento] = now;
      row[COL.comprovante_nome] = arquivoNome;
      row[COL.comprovante_url] = fileUrl;
      row[COL.data_comprovante] = now;
      row[COL.comprovante_tipo] = arquivoMime;
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([row]);
    });

    return {
      ok: true,
      numeros: numeros,
      status: finalStatus,
      comprovante_url: fileUrl,
      message: autoConfirmar ? 'Comprovante recebido e pagamento confirmado!' : 'Comprovante recebido para conferência.'
    };
  } finally {
    lock.releaseLock();
  }
}

function saveProofFile_(base64, name, mimeType, numeros, date) {
  const folder = getOrCreateFolder_(COMPROVANTES_FOLDER_NAME);
  const decoded = Utilities.base64Decode(base64);
  const formattedNums = numeros.slice(0, 8).map(formatCode_).join('-');
  const cleanName = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-num-' + formattedNums + '-' + name;
  const blob = Utilities.newBlob(decoded, mimeType, cleanName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}

function atualizarStatus_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const rawNum = payload.numero;
    if (rawNum === undefined || rawNum === null || String(rawNum).trim() === '') {
      throw new Error('Número obrigatório.');
    }
    const numero = Number(rawNum);
    const status = String(payload.status || '').toLowerCase().trim();

    if (!isValidNumero_(numero)) {
      throw new Error('Número inválido. Use entre 0000 e 9999.');
    }
    if (['livre', 'reservado', 'pago'].indexOf(status) === -1) {
      throw new Error('Status inválido. Use livre, reservado ou pago.');
    }

    const item = rows.find(function (row) { return Number(row.data.numero) === numero; });
    const current = item ? normalizeRow_(item.values) : [numero, 'livre', '', '', '', '', '', '', '', '', '', ''];
    const now = new Date();
    let targetRow = null;

    if (status === 'livre') {
      targetRow = [numero, 'livre', '', '', '', '', '', '', '', '', '', ''];
    } else if (status === 'reservado') {
      targetRow = [
        numero,
        'reservado',
        String(payload.nome || current[COL.nome] || 'Reserva manual').trim(),
        String(payload.whatsapp || current[COL.whatsapp] || '').trim(),
        Number(payload.valorPorNumero || current[COL.valor] || VALOR_POR_NUMERO),
        current[COL.data_reserva] || now,
        '',
        String(payload.observacao || current[COL.observacao] || '').trim(),
        current[COL.comprovante_nome] || '',
        current[COL.comprovante_url] || '',
        current[COL.data_comprovante] || '',
        current[COL.comprovante_tipo] || ''
      ];
    } else if (status === 'pago') {
      targetRow = [
        numero,
        'pago',
        String(payload.nome || current[COL.nome] || '').trim(),
        String(payload.whatsapp || current[COL.whatsapp] || '').trim(),
        Number(payload.valorPorNumero || current[COL.valor] || VALOR_POR_NUMERO),
        current[COL.data_reserva] || now,
        now,
        String(payload.observacao || current[COL.observacao] || '').trim(),
        current[COL.comprovante_nome] || '',
        current[COL.comprovante_url] || '',
        current[COL.data_comprovante] || '',
        current[COL.comprovante_tipo] || ''
      ];
    }

    if (item) {
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([targetRow]);
    } else if (status !== 'livre') {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, COLS.length).setValues([targetRow]);
    }

    return { ok: true, numero: numero, status: status, message: 'Status atualizado com sucesso.' };
  } finally {
    lock.releaseLock();
  }
}

function parseNumeros_(input) {
  let numeros = input;

  if (typeof input === 'string') {
    try {
      numeros = JSON.parse(input);
    } catch (ignore) {
      numeros = input.split(',');
    }
  }

  if (!Array.isArray(numeros)) numeros = [numeros];

  const unique = {};
  numeros.forEach(function (item) {
    if (item === '' || item === null || item === undefined) return;
    if (typeof item === 'number') {
      if (isValidNumero_(item)) unique[item] = true;
      return;
    }
    const rawStr = String(item).trim();
    if (!rawStr) return;
    if (/^\d+$/.test(rawStr)) {
      const n = Number(rawStr);
      if (isValidNumero_(n)) unique[n] = true;
      return;
    }
    const match = rawStr.match(/(?:^|[^-\d])(\d{1,4})(?!\d)/);
    if (match) {
      const parsed = Number(match[1]);
      if (isValidNumero_(parsed)) unique[parsed] = true;
    }
  });

  return Object.keys(unique).map(Number).sort(function (a, b) { return a - b; });
}

function sanitizeFileName_(name) {
  return String(name || 'comprovante.jpg')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 90);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
