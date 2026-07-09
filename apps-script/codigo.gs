/******************************************************
 * Rifa Solidária — Ajude Davi e Vitória
 * Google Apps Script para usar Google Sheets como banco.
 *
 * Publicar como Web App:
 * - Executar como: eu
 * - Quem tem acesso: qualquer pessoa
 ******************************************************/

const SHEET_NAME = 'Numeros';
const TOTAL_NUMEROS = 100;
const COMPROVANTES_FOLDER_NAME = 'Comprovantes - Rifa Solidaria Davi e Vitoria';

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
  inicializarPlanilha_();
  return 'Planilha inicializada.';
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
      return json_({ ok: true, numeros: listarNumeros_() });
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
      inicializarPlanilha_();
      return json_({ ok: true, message: 'Planilha inicializada.' });
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
    } catch (ignore) {
      // Permite chamadas simples também.
    }
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

  // Garante a ordem esperada se a planilha foi criada por este sistema.
  const finalHeader = sheet.getRange(1, 1, 1, COLS.length).getValues()[0].map(String);
  const firstColsOk = COLS.every(function (col, index) {
    return String(finalHeader[index] || '').trim() === col;
  });

  if (!firstColsOk && sheet.getLastRow() <= 1) {
    sheet.getRange(1, 1, 1, COLS.length).setValues([COLS]);
  }

  sheet.setFrozenRows(1);
  formatSheet_(sheet);
}

function inicializarPlanilha_() {
  const sheet = getSheet_();
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, COLS.length).getValues()
    : [];

  const existentes = {};
  rows.forEach(function (row) {
    const numero = Number(row[COL.numero]);
    if (numero) existentes[numero] = true;
  });

  const toAppend = [];
  for (let i = 1; i <= TOTAL_NUMEROS; i++) {
    if (!existentes[i]) {
      toAppend.push([i, 'livre', '', '', '', '', '', '', '', '', '', '']);
    }
  }

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, COLS.length).setValues(toAppend);
  }

  formatSheet_(sheet);
}

function formatSheet_(sheet) {
  sheet.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#e7f4ff');
  try { sheet.autoResizeColumns(1, COLS.length); } catch (ignore) {}
}

function listarNumeros_() {
  inicializarPlanilha_();
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, COLS.length).getValues();
  return values.map(rowToObject_).sort(function (a, b) {
    return Number(a.numero) - Number(b.numero);
  });
}

function rowToObject_(row) {
  return {
    numero: Number(row[COL.numero]),
    status: String(row[COL.status] || 'livre').toLowerCase(),
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
  return values.map(function (row, index) {
    return {
      rowIndex: index + 2,
      values: normalizeRow_(row),
      data: rowToObject_(normalizeRow_(row))
    };
  });
}

function normalizeRow_(row) {
  const out = row.slice(0, COLS.length);
  while (out.length < COLS.length) out.push('');
  return out;
}

function reservarNumeros_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    inicializarPlanilha_();
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const byNumber = {};
    rows.forEach(function (item) { byNumber[Number(item.data.numero)] = item; });

    const numeros = parseNumeros_(payload.numeros);
    if (!numeros.length) throw new Error('Nenhum número informado.');

    const nome = String(payload.nome || '').trim();
    const whatsapp = String(payload.whatsapp || '').trim();
    const observacao = String(payload.observacao || '').trim();
    const valorPorNumero = Number(payload.valorPorNumero || 10);

    if (!nome) throw new Error('Nome obrigatório.');
    if (!whatsapp) throw new Error('WhatsApp obrigatório.');

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      if (!item) throw new Error('Número ' + numero + ' não existe.');
      if (item.data.status !== 'livre') {
        throw new Error('O número ' + numero + ' acabou de ser escolhido.');
      }
    });

    const now = new Date();
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
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([newRow]);
    });

    return { ok: true, numeros: numeros, message: 'Reserva realizada.' };
  } finally {
    lock.releaseLock();
  }
}

function enviarComprovante_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    inicializarPlanilha_();
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const byNumber = {};
    rows.forEach(function (item) { byNumber[Number(item.data.numero)] = item; });

    const numeros = parseNumeros_(payload.numeros);
    if (!numeros.length) throw new Error('Nenhum número informado para vincular ao comprovante.');

    const arquivoBase64 = String(payload.arquivoBase64 || '').trim();
    const arquivoNome = sanitizeFileName_(payload.arquivoNome || 'comprovante.jpg');
    const arquivoMime = String(payload.arquivoMime || 'image/jpeg').trim();
    const autoConfirmar = payload.autoConfirmar === true || payload.autoConfirmar === 'true';

    if (!arquivoBase64) throw new Error('Comprovante não enviado.');

    numeros.forEach(function (numero) {
      const item = byNumber[numero];
      if (!item) throw new Error('Número ' + numero + ' não existe.');
      if (item.data.status === 'livre') throw new Error('O número ' + numero + ' está livre e não possui reserva.');
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
      row[COL.valor] = Number(row[COL.valor] || payload.valorPorNumero || 10);
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
      message: autoConfirmar ? 'Comprovante enviado e números marcados como pagos.' : 'Comprovante enviado para conferência.'
    };
  } finally {
    lock.releaseLock();
  }
}

function saveProofFile_(base64, name, mimeType, numeros, date) {
  const folder = getOrCreateFolder_(COMPROVANTES_FOLDER_NAME);
  const decoded = Utilities.base64Decode(base64);
  const cleanName = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-num-' + numeros.join('-') + '-' + name;
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
    inicializarPlanilha_();
    const sheet = getSheet_();
    const rows = getRowsWithIndex_(sheet);
    const numero = Number(payload.numero);
    const status = String(payload.status || '').toLowerCase().trim();

    if (!numero) throw new Error('Número obrigatório.');
    if (['livre', 'reservado', 'pago'].indexOf(status) === -1) {
      throw new Error('Status inválido. Use livre, reservado ou pago.');
    }

    const item = rows.find(function (row) { return Number(row.data.numero) === numero; });
    if (!item) throw new Error('Número não encontrado.');

    const current = normalizeRow_(item.values);
    const now = new Date();

    if (status === 'livre') {
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([[
        numero, 'livre', '', '', '', '', '', '', '', '', '', ''
      ]]);
    }

    if (status === 'reservado') {
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([[
        numero,
        'reservado',
        String(payload.nome || current[COL.nome] || 'Reserva manual').trim(),
        String(payload.whatsapp || current[COL.whatsapp] || '').trim(),
        Number(payload.valorPorNumero || current[COL.valor] || 10),
        current[COL.data_reserva] || now,
        '',
        String(payload.observacao || current[COL.observacao] || '').trim(),
        current[COL.comprovante_nome] || '',
        current[COL.comprovante_url] || '',
        current[COL.data_comprovante] || '',
        current[COL.comprovante_tipo] || ''
      ]]);
    }

    if (status === 'pago') {
      sheet.getRange(item.rowIndex, 1, 1, COLS.length).setValues([[
        numero,
        'pago',
        String(payload.nome || current[COL.nome] || '').trim(),
        String(payload.whatsapp || current[COL.whatsapp] || '').trim(),
        Number(payload.valorPorNumero || current[COL.valor] || 10),
        current[COL.data_reserva] || now,
        now,
        String(payload.observacao || current[COL.observacao] || '').trim(),
        current[COL.comprovante_nome] || '',
        current[COL.comprovante_url] || '',
        current[COL.data_comprovante] || '',
        current[COL.comprovante_tipo] || ''
      ]]);
    }

    return { ok: true, numero: numero, status: status, message: 'Status atualizado.' };
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
    const n = Number(item);
    if (n >= 1 && n <= TOTAL_NUMEROS) unique[n] = true;
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
