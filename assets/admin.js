(function () {
  "use strict";

  const CFG = window.RIFA_CONFIG || {};
  let numbers = [];
  let refreshTimer = null;

  const els = {
    adminLocked: document.getElementById("adminLocked"),
    adminPanel: document.getElementById("adminPanel"),
    pinForm: document.getElementById("pinForm"),
    adminPin: document.getElementById("adminPin"),
    pinError: document.getElementById("pinError"),
    metricArrecadado: document.getElementById("metricArrecadado"),
    metricPagos: document.getElementById("metricPagos"),
    metricComprovantes: document.getElementById("metricComprovantes"),
    metricReservados: document.getElementById("metricReservados"),
    metricLivres: document.getElementById("metricLivres"),
    adminRefreshBtn: document.getElementById("adminRefreshBtn"),
    statusFilter: document.getElementById("statusFilter"),
    copyPaidBtn: document.getElementById("copyPaidBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    adminMessage: document.getElementById("adminMessage"),
    reservasList: document.getElementById("reservasList"),
    autoRefreshNote: document.getElementById("autoRefreshNote")
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindEvents();
    if (sessionStorage.getItem("rifa-admin-ok") === "1") unlockPanel();
  }

  function bindEvents() {
    els.pinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (els.adminPin.value === String(CFG.ADMIN_PIN || "1234")) {
        sessionStorage.setItem("rifa-admin-ok", "1");
        unlockPanel();
      } else {
        els.pinError.hidden = false;
      }
    });

    els.adminRefreshBtn.addEventListener("click", () => loadAdminData(true));
    els.statusFilter.addEventListener("change", renderList);
    els.copyPaidBtn.addEventListener("click", copyPaidList);
    els.exportCsvBtn.addEventListener("click", exportCsv);
  }

  function unlockPanel() {
    els.adminLocked.hidden = true;
    els.adminPanel.hidden = false;
    loadAdminData(true);
    startAutoRefresh();
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => loadAdminData(false), 15000);
  }

  async function loadAdminData(showLoadingMessage) {
    try {
      setLoading(true);
      if (showLoadingMessage) showMessage("Atualizando dados...", "info");
      const response = await apiCall("listar", {});
      numbers = normalizeNumbers(response.numeros || []);
      renderMetrics();
      renderList();
      const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      els.autoRefreshNote.textContent = `Atualização automática ligada. Última atualização: ${time}.`;
      if (isDemoMode()) showMessage("Modo teste local. Configure a URL do Apps Script para usar a planilha real.", "info");
      else if (showLoadingMessage) showMessage("Dados atualizados.", "success", 2200);
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Não foi possível carregar o painel.", "error");
    } finally {
      setLoading(false);
    }
  }

  function normalizeNumbers(rows) {
    const total = Number(CFG.QUANTIDADE_NUMEROS || 100);
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
        comprovante_nome: row.comprovante_nome || "",
        comprovante_url: row.comprovante_url || "",
        data_comprovante: row.data_comprovante || ""
      });
    });

    const list = [];
    for (let i = 1; i <= total; i += 1) {
      list.push(byNumber.get(i) || { numero: i, status: "livre", nome: "", whatsapp: "", valor: 0 });
    }
    return list;
  }

  function renderMetrics() {
    const paid = numbers.filter((n) => n.status === "pago");
    const reserved = numbers.filter((n) => n.status === "reservado");
    const free = numbers.filter((n) => n.status === "livre");
    const proof = numbers.filter((n) => n.comprovante_url && n.status !== "pago");
    const totalPaid = paid.reduce((sum, item) => sum + Number(item.valor || CFG.VALOR_NUMERO || 10), 0);

    els.metricArrecadado.textContent = formatCurrency(totalPaid);
    els.metricPagos.textContent = String(paid.length);
    els.metricComprovantes.textContent = String(proof.length);
    els.metricReservados.textContent = String(reserved.length);
    els.metricLivres.textContent = String(free.length);
  }

  function renderList() {
    const filter = els.statusFilter.value;
    const filtered = numbers.filter((item) => {
      if (filter === "todos") return true;
      if (filter === "comprovante") return Boolean(item.comprovante_url) && item.status !== "pago";
      return item.status === filter;
    });

    const sorted = filtered.slice().sort((a, b) => {
      const weight = (item) => {
        if (item.comprovante_url && item.status !== "pago") return 0;
        if (item.status === "reservado") return 1;
        if (item.status === "pago") return 2;
        return 3;
      };
      return weight(a) - weight(b) || Number(a.numero) - Number(b.numero);
    });

    els.reservasList.innerHTML = "";

    if (!sorted.length) {
      els.reservasList.innerHTML = '<div class="soft-card empty-card">Nenhum número encontrado nesse filtro.</div>';
      return;
    }

    sorted.forEach((item) => {
      const card = document.createElement("article");
      card.className = `reservation-card ${item.status}`;
      if (item.comprovante_url && item.status !== "pago") card.classList.add("has-proof");

      const whats = onlyDigits(item.whatsapp);
      const whatsHref = whats ? `https://wa.me/${normalizeWhatsapp(whats)}` : "";
      const displayStatus = getDisplayStatus(item);

      card.innerHTML = `
        <div class="reservation-head">
          <div class="reservation-number">${String(item.numero).padStart(2, "0")}</div>
          <div>
            <span class="status-badge ${displayStatus.className}">${displayStatus.label}</span>
            <h3>${escapeHtml(item.nome || (item.status === "livre" ? "Número livre" : "Sem nome"))}</h3>
            ${item.whatsapp ? `<p>${escapeHtml(item.whatsapp)}</p>` : ""}
          </div>
        </div>

        <div class="reservation-details">
          <div><span>Valor</span><strong>${formatCurrency(item.valor || CFG.VALOR_NUMERO || 10)}</strong></div>
          <div><span>Reserva</span><strong>${formatDate(item.data_reserva) || "—"}</strong></div>
          <div><span>Pagamento</span><strong>${formatDate(item.data_pagamento) || "—"}</strong></div>
          <div><span>Comprovante</span><strong>${formatDate(item.data_comprovante) || "—"}</strong></div>
        </div>

        ${item.observacao ? `<p class="obs-text"><strong>Obs.:</strong> ${escapeHtml(item.observacao)}</p>` : ""}

        <div class="reservation-actions">
          ${item.comprovante_url ? `<a class="button button-blue" href="${escapeAttr(item.comprovante_url)}" target="_blank" rel="noopener">Ver comprovante</a>` : ""}
          ${whatsHref ? `<a class="button button-whatsapp" href="${whatsHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${item.status !== "pago" && item.status !== "livre" ? `<button class="button button-main" data-action="pay" data-numero="${item.numero}">Confirmar pagamento</button>` : ""}
          ${item.status !== "livre" ? `<button class="button button-danger" data-action="free" data-numero="${item.numero}">Liberar número</button>` : ""}
          ${item.status === "livre" ? `<button class="button button-blue" data-action="reserve" data-numero="${item.numero}">Marcar reservado</button>` : ""}
        </div>
      `;

      card.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => handleAction(button.dataset.action, Number(button.dataset.numero)));
      });

      els.reservasList.appendChild(card);
    });
  }

  async function handleAction(action, numero) {
    try {
      const item = numbers.find((row) => Number(row.numero) === numero) || {};

      if (action === "pay") {
        if (!confirm(`Confirmar pagamento do número ${numero}?`)) return;
        await apiCall("confirmarPagamento", { numero });
        showMessage(`Número ${numero} marcado como pago.`, "success", 2400);
      }

      if (action === "free") {
        if (!confirm(`Liberar o número ${numero}? Isso apaga nome, WhatsApp e comprovante da linha.`)) return;
        await apiCall("liberarNumero", { numero });
        showMessage(`Número ${numero} liberado.`, "success", 2400);
      }

      if (action === "reserve") {
        const nome = prompt(`Nome para reservar o número ${numero}:`, item.nome || "Reserva manual");
        if (nome === null) return;
        const whatsapp = prompt("WhatsApp da pessoa:", item.whatsapp || "") || "";
        await apiCall("atualizarStatus", {
          numero,
          status: "reservado",
          nome,
          whatsapp,
          valorPorNumero: Number(CFG.VALOR_NUMERO || 10)
        });
        showMessage(`Número ${numero} marcado como reservado.`, "success", 2400);
      }

      await loadAdminData(false);
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Não foi possível atualizar.", "error");
    }
  }

  async function copyPaidList() {
    const paid = numbers.filter((n) => n.status === "pago").sort((a, b) => Number(a.numero) - Number(b.numero));
    const text = paid.length
      ? paid.map((n) => `${String(n.numero).padStart(2, "0")} - ${n.nome || "Sem nome"} - ${n.whatsapp || ""}`).join("\n")
      : "Nenhum número pago ainda.";

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      fallbackCopy(text);
    }
    showMessage("Lista dos pagos copiada.", "success", 2400);
  }

  function exportCsv() {
    const header = ["numero", "status", "nome", "whatsapp", "valor", "data_reserva", "data_pagamento", "data_comprovante", "comprovante_url", "observacao"];
    const rows = numbers.map((n) => header.map((key) => csvCell(n[key] || "")).join(";"));
    const csv = [header.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rifa-davi-vitoria-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getDisplayStatus(item) {
    if (item.status === "pago") return { label: "Pago", className: "paid" };
    if (item.comprovante_url) return { label: "Comprovante enviado", className: "proof" };
    if (item.status === "reservado") return { label: "Reservado", className: "reserved" };
    return { label: "Livre", className: "free" };
  }

  function setLoading(isLoading) {
    els.adminRefreshBtn.disabled = isLoading;
  }

  function showMessage(message, type, autoHideMs) {
    els.adminMessage.hidden = false;
    els.adminMessage.textContent = message;
    els.adminMessage.className = `message-box ${type || "info"}`;
    if (autoHideMs) setTimeout(() => { els.adminMessage.hidden = true; }, autoHideMs);
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
      throw new Error("A API respondeu em formato inválido. Confira o Apps Script publicado.");
    }
    if (!json.ok) throw new Error(json.error || "Erro na API.");
    return json;
  }

  function localDemoApi(action, data) {
    const key = "rifa-solidaria-demo-numeros-v3";
    const now = new Date().toISOString();
    const total = Number(CFG.QUANTIDADE_NUMEROS || 100);

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

    function saveRows(rows) { localStorage.setItem(key, JSON.stringify(rows)); }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const rows = getRows();
        if (action === "listar") return resolve({ ok: true, numeros: rows });

        const row = rows.find((item) => Number(item.numero) === Number(data.numero));
        if (["confirmarPagamento", "liberarNumero", "atualizarStatus"].includes(action) && !row) return reject(new Error("Número não encontrado."));

        if (action === "confirmarPagamento") {
          row.status = "pago";
          row.data_pagamento = now;
          saveRows(rows);
          return resolve({ ok: true });
        }

        if (action === "liberarNumero") {
          Object.assign(row, { status: "livre", nome: "", whatsapp: "", valor: 0, data_reserva: "", data_pagamento: "", observacao: "", comprovante_url: "", data_comprovante: "" });
          saveRows(rows);
          return resolve({ ok: true });
        }

        if (action === "atualizarStatus") {
          row.status = normalizeStatus(data.status);
          row.nome = data.nome || row.nome || "Reserva manual";
          row.whatsapp = data.whatsapp || row.whatsapp || "";
          row.valor = Number(data.valorPorNumero || row.valor || CFG.VALOR_NUMERO || 10);
          row.data_reserva = row.data_reserva || now;
          saveRows(rows);
          return resolve({ ok: true });
        }

        reject(new Error("Ação não disponível no modo teste."));
      }, 220);
    });
  }

  function isDemoMode() { return !CFG.API_URL || CFG.API_URL.includes("COLE_AQUI"); }
  function normalizeStatus(status) { const s = String(status || "livre").toLowerCase().trim(); return ["livre", "reservado", "pago"].includes(s) ? s : "livre"; }
  function formatCurrency(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function onlyDigits(value) { return String(value || "").replace(/\D/g, ""); }
  function normalizeWhatsapp(digits) { return digits.startsWith("55") ? digits : `55${digits}`; }
  function escapeHtml(value) { return String(value || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
  function csvCell(value) { return `"${String(value).replace(/"/g, '""')}"`; }
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
})();
