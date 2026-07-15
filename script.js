// ── Supabase ──
const SUPABASE_URL = 'https://xalezzewvdlrgqpcpwgi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YfrOu5FpEreNWAxfhDmp_w_xEV6daRe';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ── Helpers ──
const padNum = (n) => String(n).padStart(5, '0');

function formatDateParts(d) {
  return {
    dia: String(d.getDate()).padStart(2, '0'),
    mes: String(d.getMonth() + 1).padStart(2, '0'),
    anio: String(d.getFullYear()),
    hora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ── Storage keys (fallback local, por si no hay conexión) ──
const STORAGE_KEY_COUNTER = 'zeroxsiento_next_receipt';
const STORAGE_KEY_HISTORY = 'zeroxsiento_history';
const MAX_HISTORY = 40;

// ── State ──
let receiptNumber = 1;
let now = new Date();

const state = {
  cliente: '',
  dineroRecibido: '',
  observacion: '',
};

// ── DOM refs ──
const clienteInput = document.getElementById('cliente');
const dineroInput = document.getElementById('dinero');
const observacionInput = document.getElementById('observacion');
const printBtn = document.getElementById('printBtn');

const badgeNumber = document.getElementById('badgeNumber');
const badgeDate = document.getElementById('badgeDate');
const badgeTime = document.getElementById('badgeTime');

const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const refs = {
  Original: {
    num: document.getElementById('numOriginal'),
    dia: document.getElementById('diaOriginal'),
    mes: document.getElementById('mesOriginal'),
    anio: document.getElementById('anioOriginal'),
    hora: document.getElementById('horaOriginal'),
    cliente: document.getElementById('clienteOriginal'),
    dinero: document.getElementById('dineroOriginal'),
    obs: document.getElementById('obsOriginal'),
  },
  Duplicado: {
    num: document.getElementById('numDuplicado'),
    dia: document.getElementById('diaDuplicado'),
    mes: document.getElementById('mesDuplicado'),
    anio: document.getElementById('anioDuplicado'),
    hora: document.getElementById('horaDuplicado'),
    cliente: document.getElementById('clienteDuplicado'),
    dinero: document.getElementById('dineroDuplicado'),
    obs: document.getElementById('obsDuplicado'),
  },
};

// ── Render receipt preview + button state ──
function render() {
  const { dia, mes, anio, hora } = formatDateParts(now);

  badgeNumber.textContent = padNum(receiptNumber);
  badgeDate.textContent = `${dia}/${mes}/${anio}`;
  badgeTime.textContent = hora;

  const dineroFormatted = state.dineroRecibido
    ? `$ ${Number(state.dineroRecibido).toLocaleString('es-AR')}`
    : '';

  for (const key of ['Original', 'Duplicado']) {
    const r = refs[key];
    r.num.textContent = `N° ${padNum(receiptNumber)}`;
    r.dia.textContent = dia;
    r.mes.textContent = mes;
    r.anio.textContent = anio;
    r.hora.textContent = hora;
    r.cliente.textContent = state.cliente;
    r.dinero.textContent = dineroFormatted;
    r.obs.textContent = state.observacion;
  }

  const hasCliente = state.cliente.trim().length > 0;
  // Nunca pisar el botón mientras está generando el PDF
  if (!printBtn.dataset.busy) {
    printBtn.disabled = !hasCliente;
    printBtn.classList.toggle('active', hasCliente);
  }
}

// ── Input listeners ──
clienteInput.addEventListener('input', (e) => {
  state.cliente = e.target.value;
  render();
});

dineroInput.addEventListener('input', (e) => {
  state.dineroRecibido = e.target.value;
  render();
});

observacionInput.addEventListener('input', (e) => {
  state.observacion = e.target.value;
  render();
});

// ── Clock tick (actualiza fecha/hora cada segundo) ──
setInterval(() => {
  now = new Date();
  render();
}, 1000);

// ── Historial de PDFs (localStorage) ──
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('No se pudo leer el historial', err);
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
    return true;
  } catch (err) {
    return false;
  }
}

function addToHistory(entry) {
  let history = loadHistory();
  history.unshift(entry);
  while (history.length > MAX_HISTORY) history.pop();

  let ok = saveHistory(history);
  while (!ok && history.length > 1) {
    history.pop();
    ok = saveHistory(history);
  }
  renderHistory();
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function renderHistory() {
  const history = loadHistory();
  historyEmpty.style.display = history.length ? 'none' : 'block';
  historyList.innerHTML = '';

  history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-item-number">N° ${padNum(entry.number)}</span>
        <span class="history-item-date">${entry.diaMesAnio} · ${entry.hora}</span>
      </div>
      <div class="history-item-cliente">${escapeHtml(entry.cliente)}</div>
      ${entry.dinero ? `<div class="history-item-money">$ ${Number(entry.dinero).toLocaleString('es-AR')}</div>` : ''}
      <button class="history-download-btn" data-id="${entry.id}">⬇ Descargar</button>
    `;
    historyList.appendChild(item);
  });
}

historyList.addEventListener('click', (e) => {
  const btn = e.target.closest('.history-download-btn');
  if (!btn) return;
  const history = loadHistory();
  const entry = history.find((h) => h.id === btn.dataset.id);
  if (!entry) return;
  downloadDataUrl(entry.pdfDataUrl, entry.filename);
});

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar todo el historial de recibos? Esta acción no se puede deshacer.')) {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    renderHistory();
  }
});

// ── Supabase: número siguiente + guardado del recibo ──
async function fetchNextReceiptNumberFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('recibos')
      .select('number')
      .order('number', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) return data[0].number + 1;
    return 1;
  } catch (err) {
    console.warn('No se pudo sincronizar el contador con Supabase, uso el guardado local.', err);
    return null; // señal para usar el fallback local
  }
}

async function saveReceiptToSupabase({ number, cliente, dineroRecibido, observacion }) {
  const { error } = await supabaseClient.from('recibos').insert([
    {
      number,
      cliente,
      dinero_recibido: dineroRecibido ? Number(dineroRecibido) : null,
      observacion: observacion || null,
    },
  ]);
  if (error) throw error;
}

// ── Generar y descargar el PDF ──
printBtn.addEventListener('click', handleGeneratePdf);

async function handleGeneratePdf() {
  if (!state.cliente.trim() || printBtn.disabled) return;

  printBtn.dataset.busy = '1';
  printBtn.disabled = true;
  printBtn.classList.remove('active');
  printBtn.textContent = 'Generando PDF...';

  const currentNumber = receiptNumber;
  let syncedOk = true;

  try {
    const canvas = await html2canvas(document.getElementById('print-area'), {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const { jsPDF } = window.jspdf;
    const widthMM = 72;
    const heightMM = (canvas.height * widthMM) / canvas.width;
    const pdf = new jsPDF({ unit: 'mm', format: [widthMM, heightMM] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMM, heightMM, undefined, 'FAST');

    const { dia, mes, anio, hora } = formatDateParts(now);
    const safeCliente = state.cliente.trim().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_') || 'recibo';
    const filename = `recibo-${padNum(currentNumber)}-${safeCliente}.pdf`;
    const pdfDataUrl = pdf.output('datauristring');

    // Descarga directa del archivo (no abre ni navega la página)
    pdf.save(filename);

    // Guardar los datos del recibo en Supabase (best-effort)
    try {
      await saveReceiptToSupabase({
        number: currentNumber,
        cliente: state.cliente,
        dineroRecibido: state.dineroRecibido,
        observacion: state.observacion,
      });
    } catch (syncErr) {
      syncedOk = false;
      console.warn('El recibo se descargó pero no se pudo guardar en Supabase.', syncErr);
    }

    // Guardar el PDF en el historial local para poder re-descargarlo
    addToHistory({
      id: `${Date.now()}-${currentNumber}`,
      number: currentNumber,
      cliente: state.cliente,
      dinero: state.dineroRecibido,
      observacion: state.observacion,
      diaMesAnio: `${dia}/${mes}/${anio}`,
      hora,
      pdfDataUrl,
      filename,
    });

    // Avanzar el contador y limpiar el formulario solo si el PDF se generó bien
    const next = currentNumber + 1;
    receiptNumber = next;
    localStorage.setItem(STORAGE_KEY_COUNTER, String(next));

    state.cliente = '';
    state.dineroRecibido = '';
    state.observacion = '';
    clienteInput.value = '';
    dineroInput.value = '';
    observacionInput.value = '';

    printBtn.textContent = syncedOk ? '✓ Descargado y guardado' : '✓ Descargado (sin conexión)';
  } catch (err) {
    console.error('Error generando el PDF', err);
    alert('Hubo un problema generando el PDF. Probá de nuevo.');
    // Si falla, el formulario NO se limpia, así el botón se puede reactivar abajo
  } finally {
    delete printBtn.dataset.busy;
    setTimeout(() => {
      printBtn.textContent = '⬇ Descargar PDF';
      render();
    }, 1400);
  }
}

// ── Init ──
async function init() {
  const localStored = localStorage.getItem(STORAGE_KEY_COUNTER);
  const localNumber = localStored ? parseInt(localStored, 10) : 1;

  const remoteNumber = await fetchNextReceiptNumberFromSupabase();
  // Si Supabase respondió, usamos el mayor entre lo remoto y lo local
  // (por si se generaron recibos offline que todavía no sincronizaron)
  receiptNumber = remoteNumber !== null ? Math.max(remoteNumber, localNumber) : localNumber;

  render();
  renderHistory();
}

init();
