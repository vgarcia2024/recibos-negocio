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

// ── Render ──
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
  printBtn.disabled = !hasCliente;
  printBtn.classList.toggle('active', hasCliente);
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

// ── Clock tick (updates date/time every second) ──
setInterval(() => {
  now = new Date();
  render();
}, 1000);

// ── Print handling ──
printBtn.addEventListener('click', () => {
  if (!state.cliente.trim()) return;

  const next = receiptNumber + 1;
  localStorage.setItem('zeroxsiento_next_receipt', String(next));

  printBtn.textContent = '✓ Guardando...';

  setTimeout(() => {
    window.print();
    receiptNumber = next;
    state.cliente = '';
    state.dineroRecibido = '';
    state.observacion = '';

    clienteInput.value = '';
    dineroInput.value = '';
    observacionInput.value = '';

    printBtn.textContent = '🖨 Imprimir / Exportar PDF';
    render();
  }, 100);
});

// ── Init ──
function init() {
  const stored = localStorage.getItem('zeroxsiento_next_receipt');
  receiptNumber = stored ? parseInt(stored, 10) : 1;
  render();
}

init();
