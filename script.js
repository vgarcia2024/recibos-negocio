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
  dni: '',
  dineroRecibido: '',
  observacion: '',
};

// ── DOM refs ──
const clienteInput = document.getElementById('cliente');
const dniInput = document.getElementById('dni');
const dineroInput = document.getElementById('dinero');
const observacionInput = document.getElementById('observacion');
const printBtn = document.getElementById('printBtn');
const resetCounterBtn = document.getElementById('resetCounterBtn');

const badgeNumber = document.getElementById('badgeNumber');
const badgeDate = document.getElementById('badgeDate');
const badgeTime = document.getElementById('badgeTime');

const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyNoResults = document.getElementById('historyNoResults');
const historySearchInput = document.getElementById('historySearch');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const refs = {
  Original: {
    num: document.getElementById('numOriginal'),
    dia: document.getElementById('diaOriginal'),
    mes: document.getElementById('mesOriginal'),
    anio: document.getElementById('anioOriginal'),
    hora: document.getElementById('horaOriginal'),
    cliente: document.getElementById('clienteOriginal'),
    dni: document.getElementById('dniOriginal'),
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
    dni: document.getElementById('dniDuplicado'),
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
    r.dni.textContent = state.dni;
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

dniInput.addEventListener('input', (e) => {
  state.dni = e.target.value;
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
  const query = historySearchInput.value.trim().toLowerCase();

  const filtered = query
    ? history.filter((entry) => {
        const dniMatch = (entry.dni || '').toLowerCase().includes(query);
        const clienteMatch = (entry.cliente || '').toLowerCase().includes(query);
        return dniMatch || clienteMatch;
      })
    : history;

  historyEmpty.style.display = history.length ? 'none' : 'block';
  historyNoResults.style.display = history.length && query && filtered.length === 0 ? 'block' : 'none';
  historyList.innerHTML = '';

  filtered.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-item-number">N° ${padNum(entry.number)}</span>
        <span class="history-item-date">${entry.diaMesAnio} · ${entry.hora}</span>
      </div>
      <div class="history-item-cliente">${escapeHtml(entry.cliente)}</div>
      ${entry.dni ? `<div class="history-item-dni">DNI: ${escapeHtml(entry.dni)}</div>` : ''}
      ${entry.dinero ? `<div class="history-item-money">$ ${Number(entry.dinero).toLocaleString('es-AR')}</div>` : ''}
      <div class="history-item-actions">
        <button class="history-download-btn" data-id="${entry.id}">⬇ Descargar</button>
        <button class="history-delete-btn" data-id="${entry.id}" title="Eliminar este recibo">🗑</button>
      </div>
    `;
    historyList.appendChild(item);
  });
}

historyList.addEventListener('click', (e) => {
  const downloadBtn = e.target.closest('.history-download-btn');
  if (downloadBtn) {
    const history = loadHistory();
    const entry = history.find((h) => h.id === downloadBtn.dataset.id);
    if (entry) downloadDataUrl(entry.pdfDataUrl, entry.filename);
    return;
  }

  const deleteBtn = e.target.closest('.history-delete-btn');
  if (deleteBtn) {
    const history = loadHistory();
    const entry = history.find((h) => h.id === deleteBtn.dataset.id);
    if (!entry) return;
    if (confirm(`¿Eliminar el recibo N° ${padNum(entry.number)} de ${entry.cliente}? Esta acción no se puede deshacer.`)) {
      const updated = history.filter((h) => h.id !== deleteBtn.dataset.id);
      saveHistory(updated);
      renderHistory();
    }
  }
});

historySearchInput.addEventListener('input', renderHistory);

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

async function saveReceiptToSupabase({ number, cliente, dni, dineroRecibido, observacion }) {
  const { error } = await supabaseClient.from('recibos').insert([
    {
      number,
      cliente,
      dni: dni || null,
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

  // La vista previa puede estar achicada visualmente (transform: scale) para
  // entrar en pantalla; para el PDF necesitamos capturarla a tamaño real.
  const previousTransform = printArea.style.transform;
  printArea.style.transform = 'scale(1)';

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
        dni: state.dni,
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
      dni: state.dni,
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
    state.dni = '';
    state.dineroRecibido = '';
    state.observacion = '';
    clienteInput.value = '';
    dniInput.value = '';
    dineroInput.value = '';
    observacionInput.value = '';

    printBtn.textContent = syncedOk ? '✓ Descargado y guardado' : '✓ Descargado (sin conexión)';
  } catch (err) {
    console.error('Error generando el PDF', err);
    alert('Hubo un problema generando el PDF. Probá de nuevo.');
    // Si falla, el formulario NO se limpia, así el botón se puede reactivar abajo
  } finally {
    delete printBtn.dataset.busy;
    // Restauramos el escalado visual de la vista previa (no afecta al PDF ya generado)
    printArea.style.transform = previousTransform;
    fitPreview();
    setTimeout(() => {
      printBtn.textContent = '⬇ Descargar PDF';
      render();
    }, 1400);
  }
}

// ── Reiniciar el contador a 1 ──
// El próximo número siempre se calcula como max(number)+1 de la tabla
// 'recibos' en Supabase, así que reiniciar de verdad requiere borrar esos
// registros; si no, al recargar la página el contador volvería a subir solo.
resetCounterBtn.addEventListener('click', handleResetCounter);

async function handleResetCounter() {
  const confirmed = confirm(
    '¿Reiniciar el contador a 1?\n\n' +
    'Esto va a BORRAR TODOS los recibos guardados en la tabla de Supabase (no se puede deshacer).\n' +
    'El historial local de PDFs de la derecha NO se toca.'
  );
  if (!confirmed) return;

  resetCounterBtn.disabled = true;
  const originalIcon = resetCounterBtn.textContent;
  resetCounterBtn.textContent = '…';

  try {
    const { error } = await supabaseClient.from('recibos').delete().gte('id', 0);
    if (error) throw error;

    receiptNumber = 1;
    localStorage.setItem(STORAGE_KEY_COUNTER, '1');
    render();
    alert('Listo, el contador se reinició a 1.');
  } catch (err) {
    console.error('No se pudo reiniciar el contador', err);
    alert('No se pudo borrar los recibos en Supabase, así que el contador no se reinició (para evitar que se desincronice). Revisá tu conexión e intentá de nuevo.');
  } finally {
    resetCounterBtn.disabled = false;
    resetCounterBtn.textContent = originalIcon;
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

// ── Auto-ajuste de la vista previa ──
// Escala #print-area para que SIEMPRE entren completos el ORIGINAL y el
// DUPLICADO dentro del espacio disponible, sin importar el zoom del
// navegador ni el tamaño de la ventana. Nunca se corta el contenido.
const previewFitWrap = document.getElementById('previewFitWrap');
const printArea = document.getElementById('print-area');

function fitPreview() {
  if (!previewFitWrap || !printArea) return;

  // Medimos el tamaño natural (sin escalar) del recibo
  printArea.style.transform = 'scale(1)';
  const naturalWidth = printArea.offsetWidth;
  const naturalHeight = printArea.offsetHeight;
  const availableWidth = previewFitWrap.clientWidth;
  const availableHeight = previewFitWrap.clientHeight;

  if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) return;

  // Nunca agrandamos más allá del 100%, solo achicamos si no entra
  const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
  printArea.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', fitPreview);
window.addEventListener('load', fitPreview);

if (window.ResizeObserver) {
  new ResizeObserver(fitPreview).observe(previewFitWrap);
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitPreview);
}

document.querySelectorAll('.logo-row img').forEach((img) => {
  if (img.complete) fitPreview();
  else img.addEventListener('load', fitPreview);
});

fitPreview();
setTimeout(fitPreview, 300);
