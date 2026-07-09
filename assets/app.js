(function () {
  "use strict";

  const CFG = window.RIFA_CONFIG || {};
  const selectedNumbers = new Set();
  let currentNumbers = [];
  let lastReservation = null;
  let selectedProofFile = null;

  const els = {
    valorNumeroHero: document.getElementById("valorNumeroHero"),
    pixHero: document.getElementById("pixHero"),
    dataSorteioHero: document.getElementById("dataSorteioHero"),
    premioInfo: document.getElementById("premioInfo"),
    responsavelInfo: document.getElementById("responsavelInfo"),
    pixKeyText: document.getElementById("pixKeyText"),
    copyPixBtn: document.getElementById("copyPixBtn"),
    shareBtn: document.getElementById("shareBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    statusMessage: document.getElementById("statusMessage"),
    numbersGrid: document.getElementById("numbersGrid"),
    selectedNumbersText: document.getElementById("selectedNumbersText"),
    selectedTotalText: document.getElementById("selectedTotalText"),
    reserveForm: document.getElementById("reserveForm"),
    reserveBtn: document.getElementById("reserveBtn"),
    nome: document.getElementById("nome"),
    whatsapp: document.getElementById("whatsapp"),
    observacao: document.getElementById("observacao"),
    bottomSummary: document.getElementById("bottomSummary"),
    bottomSelectedText: document.getElementById("bottomSelectedText"),
    goToFormBtn: document.getElementById("goToFormBtn"),
    modal: document.getElementById("successModal"),
    modalNumbers: document.getElementById("modalNumbers"),
    modalTotal: document.getElementById("modalTotal"),
    modalPixKey: document.getElementById("modalPixKey"),
    pixQrCode: document.getElementById("pixQrCode"),
    pixCopyPaste: document.getElementById("pixCopyPaste"),
    copyPixAgainBtn: document.getElementById("copyPixAgainBtn"),
    copyPixPayloadBtn: document.getElementById("copyPixPayloadBtn"),
    openWhatsAppBtn: document.getElementById("openWhatsAppBtn"),
    proofFile: document.getElementById("proofFile"),
    proofFileName: document.getElementById("proofFileName"),
    sendProofBtn: document.getElementById("sendProofBtn"),
    proofMessage: document.getElementById("proofMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyConfigToPage();
    bindEvents();
    restoreLastReservation();
    loadNumbers();
  }

  function applyConfigToPage() {
    els.valorNumeroHero.textContent = formatCurrency(getValuePerNumber());
    els.pixHero.textContent = getPixKey();
    els.pixKeyText.textContent = getPixKey();
    els.dataSorteioHero.textContent = CFG.DATA_SORTEIO || "A definir";
    els.premioInfo.textContent = CFG.PREMIO_RIFA || "A definir";
    els.responsavelInfo.textContent = CFG.RESPONSAVEL_NOME || "Juliana";
  }

  function bindEvents() {
    els.copyPixBtn.addEventListener("click", () => copyText(getPixKey(), "Chave Pix copiada."));
    els.copyPixAgainBtn.addEventListener("click", () => copyText(getPixKey(), "Chave Pix copiada."));
    els.copyPixPayloadBtn.addEventListener("click", () => copyText(els.pixCopyPaste.value, "Pix copia e cola copiado."));
    els.shareBtn.addEventListener("click", shareRaffle);
    els.refreshBtn.addEventListener("click", loadNumbers);
    els.reserveForm.addEventListener("submit", handleReservation);
    els.goToFormBtn.addEventListener("click", () => document.querySelector(".form-card").scrollIntoView({ behavior: "smooth", block: "start" }));

    els.proofFile.addEventListener("change", () => {
      selectedProofFile = els.proofFile.files && els.proofFile.files[0] ? els.proofFile.files[0] : null;
      els.proofFileName.textContent = selectedProofFile ? selectedProofFile.name : "Escolher comprovante ou print";
      hideProofMessage();
    });

    els.sendProofBtn.addEventListener("click", sendProof);

    document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModal));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  async function loadNumbers() {
    try {
      setLoading(true);
      showMessage("Carregando a cartela...", "info");
      const response = await apiCall("listar", {});
      currentNumbers = normalizeNumbers(response.numeros || []);
      selectedNumbers.clear();
      renderNumbers();
      updateSelectionSummary();
      if (isDemoMode()) showMessage("Modo teste local: configure a URL do Apps Script para usar a planilha.", "info");
      else hideMessage();
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Não foi possível carregar os números.", "error");
      currentNumbers = normalizeNumbers([]);
      renderNumbers();
    } finally {
      setLoading(false);
    }
  }

  function normalizeNumbers(rows) {
    const byNumber = new Map();
    (rows || []).forEach((row) => {
      const numero = Number(row.numero);
      if (!Number.isFinite(numero)) return;
      byNumber.set(numero, {
        numero,
        status: normalizeStatus(row.status),
        nome: row.nome || "",
        whatsapp: row.whatsapp || "",
        valor: Number(row.valor || 0),
        data_reserva: row.data_reserva || "",
        data_pagamento: row.data_pagamento || "",
        observacao: row.observacao || "",
        comprovante_url: row.comprovante_url || "",
        data_comprovante: row.data_comprovante || ""
      });
    });

    const total = getTotalQuantity();
    const normalized = [];
    for (let i = 1; i <= total; i += 1) {
      normalized.push(byNumber.get(i) || { numero: i, status: "livre" });
    }
    return normalized;
  }

  function renderNumbers() {
    els.numbersGrid.innerHTML = "";

    currentNumbers.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "number-chip";
      btn.textContent = String(item.numero).padStart(2, "0");
      btn.setAttribute("aria-label", `Número ${item.numero}, ${item.status}`);

      const isBusy = item.status === "reservado" || item.status === "pago";
      if (selectedNumbers.has(item.numero)) btn.classList.add("selected");
      if (item.status === "reservado") btn.classList.add("reserved");
      if (item.status === "pago") btn.classList.add("paid");
      if (item.comprovante_url && item.status !== "pago") btn.classList.add("proof-sent");
      btn.disabled = isBusy;
      btn.addEventListener("click", () => toggleNumber(item.numero));
      els.numbersGrid.appendChild(btn);
    });
  }

  function toggleNumber(numero) {
    const item = currentNumbers.find((row) => row.numero === numero);
    if (!item || item.status !== "livre") {
      showMessage(`O número ${numero} já foi escolhido. Escolha outro.`, "error");
      return;
    }

    if (selectedNumbers.has(numero)) selectedNumbers.delete(numero);
    else selectedNumbers.add(numero);

    renderNumbers();
    updateSelectionSummary();
    hideMessage();
  }

  function updateSelectionSummary() {
    const sorted = getSelectedNumbers();
    const total = sorted.length * getValuePerNumber();
    const numbersText = sorted.length ? sorted.map((n) => String(n).padStart(2, "0")).join(", ") : "Nenhum";
    els.selectedNumbersText.textContent = numbersText;
    els.selectedTotalText.textContent = formatCurrency(total);
    els.bottomSelectedText.textContent = sorted.length ? `${sorted.length} número(s) • ${formatCurrency(total)}` : "Nenhum";
    els.bottomSummary.hidden = sorted.length === 0;
  }

  async function handleReservation(event) {
    event.preventDefault();

    const numeros = getSelectedNumbers();
    const nome = els.nome.value.trim();
    const whatsapp = els.whatsapp.value.trim();
    const observacao = els.observacao.value.trim();

    if (!numeros.length) return showMessage("Escolha pelo menos um número livre.", "error");
    if (!nome || !whatsapp) return showMessage("Preencha nome completo e WhatsApp.", "error");

    try {
      setLoading(true);
      showMessage("Conferindo se os números ainda estão livres...", "info");
      const response = await apiCall("reservar", {
        numeros,
        nome,
        whatsapp,
        observacao,
        valorPorNumero: getValuePerNumber()
      });

      const finalNumbers = response.numeros || numeros;
      lastReservation = {
        nome,
        whatsapp,
        numeros: finalNumbers.map(Number),
        total: finalNumbers.length * getValuePerNumber(),
        observacao,
        criado_em: new Date().toISOString()
      };
      localStorage.setItem("rifa-last-reservation", JSON.stringify(lastReservation));

      selectedProofFile = null;
      els.proofFile.value = "";
      els.proofFileName.textContent = "Escolher comprovante ou print";
      hideProofMessage();

      showSuccessModal(lastReservation);
      els.reserveForm.reset();
      selectedNumbers.clear();
      await loadNumbers();
    } catch (error) {
      console.error(error);
      const msg = error.message || "Não foi possível reservar. Tente novamente.";
      const match = msg.match(/número\s+(\d+)/i);
      showMessage(match ? `O número ${match[1]} acabou de ser escolhido. Escolha outro.` : msg, "error");
      await safeReloadNumbers();
    } finally {
      setLoading(false);
    }
  }

  function showSuccessModal(reservation) {
    const total = reservation.total;
    const pixPayload = buildPixPayload({ amount: total, txid: makeTxid(reservation.numeros) });
    const whatsMessage = buildWhatsAppProofMessage(reservation);

    els.modalNumbers.textContent = reservation.numeros.map((n) => String(n).padStart(2, "0")).join(", ");
    els.modalTotal.textContent = formatCurrency(total);
    els.modalPixKey.textContent = getPixKey();
    els.pixCopyPaste.value = pixPayload;
    els.pixQrCode.src = buildQrUrl(pixPayload);
    els.openWhatsAppBtn.href = buildWhatsAppUrl(whatsMessage);

    els.modal.classList.add("open");
    els.modal.setAttribute("aria-hidden", "false");
  }

  async function sendProof() {
    if (!lastReservation || !lastReservation.numeros || !lastReservation.numeros.length) {
      return showProofMessage("Faça a reserva primeiro para vincular o comprovante aos números.", "error");
    }
    if (!selectedProofFile) {
      return showProofMessage("Escolha uma foto, print ou PDF do comprovante.", "error");
    }

    try {
      setProofLoading(true);
      showProofMessage("Preparando e enviando o comprovante...", "info");
      const fileData = await prepareProofFile(selectedProofFile);
      const response = await apiCall("enviarComprovante", {
        numeros: lastReservation.numeros,
        nome: lastReservation.nome,
        whatsapp: lastReservation.whatsapp,
        valorTotal: lastReservation.total,
        autoConfirmar: Boolean(CFG.AUTO_CONFIRMAR_COM_COMPROVANTE),
        arquivoNome: fileData.name,
        arquivoMime: fileData.mimeType,
        arquivoBase64: fileData.base64
      });

      const msg = response.status === "pago"
        ? "Comprovante enviado e números marcados como pagos."
        : "Comprovante enviado. Ele já apareceu no painel da responsável.";
      showProofMessage(msg, "success");
      await safeReloadNumbers();
    } catch (error) {
      console.error(error);
      showProofMessage(error.message || "Não foi possível enviar o comprovante.", "error");
    } finally {
      setProofLoading(false);
    }
  }

  async function prepareProofFile(file) {
    const isImage = /^image\//i.test(file.type || "");
    if (isImage) return compressImage(file);

    if (file.size > 4 * 1024 * 1024) {
      throw new Error("O arquivo está grande demais. Envie uma imagem ou PDF de até 4 MB.");
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name: sanitizeFileName(file.name || "comprovante.pdf"),
      mimeType: file.type || "application/octet-stream",
      base64: dataUrl.split(",")[1]
    };
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1300;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxSide) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else if (height >= width && height > maxSide) {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
          if (dataUrl.length > 5_500_000) reject(new Error("A imagem ficou grande demais. Envie um print mais leve."));
          else resolve({
            name: sanitizeFileName((file.name || "comprovante").replace(/\.[^.]+$/, "") + ".jpg"),
            mimeType: "image/jpeg",
            base64: dataUrl.split(",")[1]
          });
        };
        img.onerror = () => reject(new Error("Não foi possível ler a imagem do comprovante."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  function restoreLastReservation() {
    try {
      const saved = localStorage.getItem("rifa-last-reservation");
      if (saved) lastReservation = JSON.parse(saved);
    } catch (error) {
      lastReservation = null;
    }
  }

  function closeModal() {
    els.modal.classList.remove("open");
    els.modal.setAttribute("aria-hidden", "true");
  }

  function getSelectedNumbers() {
    return Array.from(selectedNumbers).sort((a, b) => a - b);
  }

  function setLoading(isLoading) {
    els.reserveBtn.disabled = isLoading;
    els.refreshBtn.disabled = isLoading;
  }

  function setProofLoading(isLoading) {
    els.sendProofBtn.disabled = isLoading;
    els.proofFile.disabled = isLoading;
  }

  function showMessage(message, type) {
    els.statusMessage.hidden = false;
    els.statusMessage.textContent = message;
    els.statusMessage.className = `message-box ${type || "info"}`;
  }

  function hideMessage() {
    els.statusMessage.hidden = true;
    els.statusMessage.textContent = "";
  }

  function showProofMessage(message, type) {
    els.proofMessage.hidden = false;
    els.proofMessage.textContent = message;
    els.proofMessage.className = `message-box ${type || "info"}`;
  }

  function hideProofMessage() {
    els.proofMessage.hidden = true;
    els.proofMessage.textContent = "";
  }

  async function safeReloadNumbers() {
    try {
      const response = await apiCall("listar", {});
      currentNumbers = normalizeNumbers(response.numeros || []);
      selectedNumbers.clear();
      renderNumbers();
      updateSelectionSummary();
    } catch (error) {
      console.warn("Falha ao recarregar números", error);
    }
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      fallbackCopy(text);
    }
    showMessage(successMessage, "success");
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.left = "-999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }

  function shareRaffle() {
    const message = [
      "💙 Rifa Solidária — Ajude Davi e Vitória",
      "",
      "Estamos realizando esta rifa para ajudar nos custos de transporte da mamãe Juliana até o hospital em Juiz de Fora.",
      "",
      `🎟️ Valor: ${formatCurrency(getValuePerNumber())} por número`,
      `🏆 Prêmio: ${CFG.PREMIO_RIFA || "A definir"}`,
      `📅 Sorteio: ${CFG.DATA_SORTEIO || "A definir"}`,
      `🔑 Chave Pix: ${getPixKey()}`,
      "",
      "Escolha seu número e participe. Toda ajuda faz a diferença! 🙏"
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function buildWhatsAppProofMessage(reservation) {
    return [
      "Olá! Fiz uma reserva na Rifa Solidária — Ajude Davi e Vitória.",
      "",
      `Nome: ${reservation.nome}`,
      `WhatsApp: ${reservation.whatsapp}`,
      `Números escolhidos: ${reservation.numeros.join(", ")}`,
      `Valor total: ${formatCurrency(reservation.total)}`,
      `Chave Pix: ${getPixKey()}`,
      "",
      "Já realizei o Pix e estou enviando o comprovante para conferência. Obrigado(a)!"
    ].join("\n");
  }

  function buildWhatsAppUrl(message) {
    const phone = String(CFG.WHATSAPP_RESPONSAVEL || "").replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function getValuePerNumber() {
    return Number(CFG.VALOR_NUMERO || 10);
  }

  function getTotalQuantity() {
    return Number(CFG.QUANTIDADE_NUMEROS || 100);
  }

  function getPixKey() {
    return String(CFG.PIX_KEY || "").trim();
  }

  function normalizeStatus(status) {
    const clean = String(status || "livre").toLowerCase().trim();
    return ["livre", "reservado", "pago"].includes(clean) ? clean : "livre";
  }

  function isDemoMode() {
    return !CFG.API_URL || CFG.API_URL.includes("COLE_AQUI");
  }

  async function apiCall(action, data) {
    if (isDemoMode()) return localDemoApi(action, data);

    const response = await fetch(CFG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...data }),
      redirect: "follow"
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error("A API respondeu em formato inválido. Verifique a publicação do Apps Script.");
    }
    if (!json.ok) throw new Error(json.error || "Erro na API.");
    return json;
  }

  function localDemoApi(action, data) {
    const key = "rifa-solidaria-demo-numeros-v3";
    const now = new Date().toISOString();
    const total = getTotalQuantity();

    function getRows() {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
      const rows = [];
      for (let i = 1; i <= total; i += 1) {
        rows.push({ numero: i, status: "livre", nome: "", whatsapp: "", valor: 0, data_reserva: "", data_pagamento: "", observacao: "", comprovante_url: "", data_comprovante: "" });
      }
      localStorage.setItem(key, JSON.stringify(rows));
      return rows;
    }

    function saveRows(rows) {
      localStorage.setItem(key, JSON.stringify(rows));
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const rows = getRows();
        if (action === "listar") return resolve({ ok: true, numeros: rows });

        if (action === "reservar") {
          const numeros = (data.numeros || []).map(Number);
          for (const numero of numeros) {
            const row = rows.find((item) => Number(item.numero) === numero);
            if (!row || row.status !== "livre") return reject(new Error(`O número ${numero} acabou de ser escolhido.`));
          }
          numeros.forEach((numero) => {
            const row = rows.find((item) => Number(item.numero) === numero);
            Object.assign(row, {
              status: "reservado",
              nome: data.nome || "",
              whatsapp: data.whatsapp || "",
              valor: Number(data.valorPorNumero || getValuePerNumber()),
              data_reserva: now,
              data_pagamento: "",
              observacao: data.observacao || ""
            });
          });
          saveRows(rows);
          return resolve({ ok: true, numeros });
        }

        if (action === "enviarComprovante") {
          const numeros = (data.numeros || []).map(Number);
          numeros.forEach((numero) => {
            const row = rows.find((item) => Number(item.numero) === numero);
            if (row && row.status !== "livre") {
              row.comprovante_url = "Comprovante salvo no modo teste local";
              row.data_comprovante = now;
              if (data.autoConfirmar) {
                row.status = "pago";
                row.data_pagamento = now;
              }
            }
          });
          saveRows(rows);
          return resolve({ ok: true, status: data.autoConfirmar ? "pago" : "reservado" });
        }

        reject(new Error("Ação não disponível no modo teste local."));
      }, 240);
    });
  }

  function buildQrUrl(payload) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(payload)}`;
  }

  function buildPixPayload({ amount, txid }) {
    const key = getPixKey();
    const name = sanitizePixText(CFG.PIX_RECEBEDOR || CFG.RESPONSAVEL_NOME || "RIFA SOLIDARIA", 25);
    const city = sanitizePixText(CFG.PIX_CIDADE || "CARMO", 15);
    const description = sanitizePixText("RIFA DAVI VITORIA", 72);
    const tx = sanitizePixText(txid || "RIFA", 25).replace(/[^A-Z0-9]/g, "") || "RIFA";

    const merchantAccountInfo = tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", key) + tlv("02", description));
    const payloadNoCrc =
      tlv("00", "01") +
      merchantAccountInfo +
      tlv("52", "0000") +
      tlv("53", "986") +
      tlv("54", Number(amount || 0).toFixed(2)) +
      tlv("58", "BR") +
      tlv("59", name) +
      tlv("60", city) +
      tlv("62", tlv("05", tx)) +
      "6304";

    return payloadNoCrc + crc16(payloadNoCrc);
  }

  function tlv(id, value) {
    const text = String(value || "");
    return id + String(text.length).padStart(2, "0") + text;
  }

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i += 1) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j += 1) {
        crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function sanitizePixText(text, maxLen) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 .\-]/g, "")
      .trim()
      .toUpperCase()
      .slice(0, maxLen);
  }

  function sanitizeFileName(name) {
    return String(name || "comprovante.jpg")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 90);
  }

  function makeTxid(numbers) {
    return `RIFA${(numbers || []).join("")}${Date.now().toString().slice(-5)}`.slice(0, 25);
  }
})();
