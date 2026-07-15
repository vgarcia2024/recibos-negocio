// ── Supabase ──
const SUPABASE_URL = 'https://xalezzewvdlrgqpcpwgi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YfrOu5FpEreNWAxfhDmp_w_xEV6daRe';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const STORAGE_BUCKET = 'recibos-pdf';

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

function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// ── Storage keys (fallback local solo para el contador offline) ──
const STORAGE_KEY_COUNTER = 'zeroxsiento_next_receipt';

// ── State ──
let receiptNumber = 1;
let now = new Date();
let historyCache = []; // último snapshot traído de Supabase

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

// ── Clock tick ──
setInterval(() => {
  now = new Date();
  render();
}, 1000);

// ── Historial: ahora vive en Supabase (tabla recibos + Storage) ──
async function fetchHistoryFromSupabase() {
  const { data, error } = await supabaseClient
    .from('recibos')
    .select('id, number, cliente, dni, dinero_recibido, observacion, created_at, pdf_url, pdf_path')
    .not('pdf_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('No se pudo cargar el historial desde Supabase.', error);
    return null;
  }
  return data;
}

function renderHistory() {
  const query = historySearchInput.value.trim().toLowerCase();

  const filtered = query
    ? historyCache.filter((entry) => {
        const dniMatch = (entry.dni || '').toLowerCase().includes(query);
        const clienteMatch = (entry.cliente || '').toLowerCase().includes(query);
        return dniMatch || clienteMatch;
      })
    : historyCache;

  historyEmpty.style.display = historyCache.length ? 'none' : 'block';
  historyNoResults.style.display = historyCache.length && query && filtered.length === 0 ? 'block' : 'none';
  historyList.innerHTML = '';

  filtered.forEach((entry) => {
    const d = new Date(entry.created_at);
    const { dia, mes, anio, hora } = formatDateParts(d);

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-item-number">N° ${padNum(entry.number)}</span>
        <span class="history-item-date">${dia}/${mes}/${anio} · ${hora}</span>
      </div>
      <div class="history-item-cliente">${escapeHtml(entry.cliente)}</div>
      ${entry.dni ? `<div class="history-item-dni">DNI: ${escapeHtml(entry.dni)}</div>` : ''}
      ${entry.dinero_recibido ? `<div class="history-item-money">$ ${Number(entry.dinero_recibido).toLocaleString('es-AR')}</div>` : ''}
      <div class="history-item-actions">
        <button class="history-download-btn" data-id="${entry.id}">⬇ Descargar</button>
        <button class="history-delete-btn" data-id="${entry.id}" title="Eliminar este recibo">🗑</button>
      </div>
    `;
    historyList.appendChild(item);
  });
}

async function refreshHistory() {
  const data = await fetchHistoryFromSupabase();
  if (data !== null) historyCache = data;
  renderHistory();
}

async function downloadFromUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('No se pudo descargar el PDF desde Storage', err);
    alert('No se pudo descargar ese PDF. Revisá tu conexión e intentá de nuevo.');
  }
}

historyList.addEventListener('click', async (e) => {
  const downloadBtn = e.target.closest('.history-download-btn');
  if (downloadBtn) {
    const entry = historyCache.find((h) => String(h.id) === downloadBtn.dataset.id);
    if (entry) {
      const safeDni = slugify(entry.dni) || slugify(entry.cliente) || 'recibo';
      downloadFromUrl(entry.pdf_url, `recibo-${padNum(entry.number)}-${safeDni}.pdf`);
    }
    return;
  }

  const deleteBtn = e.target.closest('.history-delete-btn');
  if (deleteBtn) {
    const entry = historyCache.find((h) => String(h.id) === deleteBtn.dataset.id);
    if (!entry) return;
    if (!confirm(`¿Eliminar el recibo N° ${padNum(entry.number)} de ${entry.cliente}? Esta acción no se puede deshacer.`)) return;

    deleteBtn.disabled = true;
    try {
      if (entry.pdf_path) {
        await supabaseClient.storage.from(STORAGE_BUCKET).remove([entry.pdf_path]);
      }
      const { error } = await supabaseClient.from('recibos').delete().eq('id', entry.id);
      if (error) throw error;
      await refreshHistory();
    } catch (err) {
      console.error('No se pudo eliminar el recibo', err);
      alert('No se pudo eliminar el recibo. Revisá tu conexión e intentá de nuevo.');
      deleteBtn.disabled = false;
    }
  }
});

historySearchInput.addEventListener('input', renderHistory);

clearHistoryBtn.addEventListener('click', async () => {
  if (!historyCache.length) return;
  if (!confirm('¿Vaciar todo el historial de recibos? Esto borra los PDF de Supabase Storage y no se puede deshacer.')) return;

  clearHistoryBtn.disabled = true;
  try {
    const paths = historyCache.map((h) => h.pdf_path).filter(Boolean);
    if (paths.length) await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);

    const ids = historyCache.map((h) => h.id);
    if (ids.length) {
      const { error } = await supabaseClient.from('recibos').delete().in('id', ids);
      if (error) throw error;
    }
    await refreshHistory();
  } catch (err) {
    console.error('No se pudo vaciar el historial', err);
    alert('No se pudo vaciar el historial completo. Probá de nuevo.');
  } finally {
    clearHistoryBtn.disabled = false;
  }
});

// ── Supabase: número siguiente ──
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
    return null;
  }
}

// ── Subir el PDF a Supabase Storage ──
async function uploadPdfToStorage(blob, path) {
  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function saveReceiptToSupabase({ number, cliente, dni, dineroRecibido, observacion, pdfUrl, pdfPath }) {
  const { error } = await supabaseClient.from('recibos').insert([
    {
      number,
      cliente,
      dni: dni || null,
      dinero_recibido: dineroRecibido ? Number(dineroRecibido) : null,
      observacion: observacion || null,
      pdf_url: pdfUrl,
      pdf_path: pdfPath,
    },
  ]);
  if (error) throw error;
}

// ── Generar, subir y descargar el PDF ──
printBtn.addEventListener('click', handleGeneratePdf);

async function handleGeneratePdf() {
  if (!state.cliente.trim() || printBtn.disabled) return;

  printBtn.dataset.busy = '1';
  printBtn.disabled = true;
  printBtn.classList.remove('active');
  printBtn.textContent = 'Generando PDF...';

  const currentNumber = receiptNumber;
  let syncedOk = true;

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

    const safeDni = slugify(state.dni) || slugify(state.cliente) || 'recibo';
    const filename = `recibo-${padNum(currentNumber)}-${safeDni}.pdf`;
    const storagePath = filename; // el nombre en Storage queda igual al del DNI/cliente

    // Descarga inmediata en este dispositivo
    pdf.save(filename);

    // Subida a Supabase Storage + guardado en la tabla (best-effort)
    try {
      const pdfBlob = pdf.output('blob');
      const pdfUrl = await uploadPdfToStorage(pdfBlob, storagePath);

      await saveReceiptToSupabase({
        number: currentNumber,
        cliente: state.cliente,
        dni: state.dni,
        dineroRecibido: state.dineroRecibido,
        observacion: state.observacion,
        pdfUrl,
        pdfPath: storagePath,
      });
    } catch (syncErr) {
      syncedOk = false;
      console.warn('El recibo se descargó pero no se pudo subir/guardar en Supabase.', syncErr);
    }

    await refreshHistory();

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
  } finally {
    delete printBtn.dataset.busy;
    printArea.style.transform = previousTransform;
    fitPreview();
    setTimeout(() => {
      printBtn.textContent = '⬇ Descargar PDF';
      render();
    }, 1400);
  }
}

// ── Reiniciar el contador a 1 ──
resetCounterBtn.addEventListener('click', handleResetCounter);

async function handleResetCounter() {
  const confirmed = confirm(
    '¿Reiniciar el contador a 1?\n\n' +
    'Esto va a BORRAR TODOS los recibos guardados en Supabase (tabla y PDFs en Storage), no se puede deshacer.'
  );
  if (!confirmed) return;

  resetCounterBtn.disabled = true;
  const originalIcon = resetCounterBtn.textContent;
  resetCounterBtn.textContent = '…';

  try {
    const data = await fetchHistoryFromSupabase();
    const paths = (data || []).map((h) => h.pdf_path).filter(Boolean);
    if (paths.length) await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);

    const { error } = await supabaseClient.from('recibos').delete().gte('id', 0);
    if (error) throw error;

    receiptNumber = 1;
    localStorage.setItem(STORAGE_KEY_COUNTER, '1');
    await refreshHistory();
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
  receiptNumber = remoteNumber !== null ? Math.max(remoteNumber, localNumber) : localNumber;

  render();
  await refreshHistory();
}

init();

// ── Auto-ajuste de la vista previa ──
const previewFitWrap = document.getElementById('previewFitWrap');
const printArea = document.getElementById('print-area');

function fitPreview() {
  if (!previewFitWrap || !printArea) return;

  printArea.style.transform = 'scale(1)';
  const naturalWidth = printArea.offsetWidth;
  const naturalHeight = printArea.offsetHeight;
  const availableWidth = previewFitWrap.clientWidth;
  const availableHeight = previewFitWrap.clientHeight;

  if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) return;

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
