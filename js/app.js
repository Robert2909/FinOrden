// /js/app.js

let movimientos = [];
let chart = null;
const STORAGE_KEY = "finorden_movimientos";

// Utilidades
function formatoMoneda(valor) {
  return "$" + valor.toFixed(2);
}

function obtenerPeriodo(fechaStr) {
  // retorna "YYYY-MM"
  return fechaStr.slice(0, 7);
}

// Navegación entre vistas
function configurarNavegacion() {
  const botones = document.querySelectorAll(".nav-btn");
  const vistas = document.querySelectorAll(".view");

  botones.forEach((btn) => {
    btn.addEventListener("click", () => {
      const destino = btn.dataset.view;

      botones.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      vistas.forEach((vista) => {
        vista.classList.toggle("active", vista.id === destino);
      });
    });
  });
}

// Cargar movimientos: primero localStorage, luego demo.json, luego demo interno
async function cargarMovimientos() {
  // 1. Intentar leer desde localStorage
  try {
    const guardados = localStorage.getItem(STORAGE_KEY);
    if (guardados) {
      const parsed = JSON.parse(guardados);
      if (Array.isArray(parsed)) {
        movimientos = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn("No se pudo leer desde localStorage, usando demo:", e);
  }

  // 2. Si no hay datos guardados, intentar leer data/demo.json
  try {
    const resp = await fetch("data/demo.json");
    if (resp.ok) {
      movimientos = await resp.json();
      guardarMovimientos(); // sembramos los datos demo en localStorage
      return;
    }
  } catch (e) {
    console.warn("No se pudo leer data/demo.json, usando datos internos.");
  }

  // 3. Fallback interno si todo falla
  movimientos = obtenerDatosDemo();
  guardarMovimientos();
}

function guardarMovimientos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movimientos));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
}

// Demo interno por si no se puede leer demo.json
function obtenerDatosDemo() {
  const hoy = new Date();
  const ymd = (d) => d.toISOString().slice(0, 10);

  const d1 = new Date(hoy);
  d1.setDate(hoy.getDate() - 3);

  const d2 = new Date(hoy);
  d2.setDate(hoy.getDate() - 2);

  const d3 = new Date(hoy);
  d3.setDate(hoy.getDate() - 1);

  return [
    {
      id: 1,
      tipo: "ingreso",
      monto: 850.0,
      fecha: ymd(d1),
      categoria: "ventas",
      descripcion: "Venta en efectivo"
    },
    {
      id: 2,
      tipo: "gasto",
      monto: 320.5,
      fecha: ymd(d2),
      categoria: "insumos",
      descripcion: "Compra de materia prima"
    },
    {
      id: 3,
      tipo: "ingreso",
      monto: 1200.0,
      fecha: ymd(d3),
      categoria: "servicios",
      descripcion: "Servicio terminado"
    }
  ];
}

// Filtro por periodo (todos, mes actual, mes anterior)
function filtrarPorPeriodo(lista, periodo) {
  if (periodo === "todos") return lista;

  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth(); // 0-11
  const pad = (n) => (n < 10 ? "0" + n : "" + n);

  let objetivo;
  if (periodo === "mes-actual") {
    objetivo = `${year}-${pad(month + 1)}`;
  } else if (periodo === "mes-anterior") {
    const anterior = new Date(year, month - 1, 1);
    objetivo = `${anterior.getFullYear()}-${pad(anterior.getMonth() + 1)}`;
  } else {
    return lista;
  }

  return lista.filter((m) => obtenerPeriodo(m.fecha) === objetivo);
}

// Render dashboard
function renderDashboard() {
  const periodo = document.getElementById("filtro-mes").value;
  const datosFiltrados = filtrarPorPeriodo(movimientos, periodo);

  const totalIngresos = datosFiltrados
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const totalGastos = datosFiltrados
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);

  const balance = totalIngresos - totalGastos;

  document.getElementById("total-ingresos").textContent = formatoMoneda(
    totalIngresos
  );
  document.getElementById("total-gastos").textContent = formatoMoneda(
    totalGastos
  );
  document.getElementById("balance").textContent = formatoMoneda(balance);

  // Alerta si los gastos superan a los ingresos en este periodo
  const alerta = document.getElementById("alerta-balance");
  if (datosFiltrados.length > 0 && totalGastos > totalIngresos) {
    alerta.textContent =
      "En este periodo los gastos superan a los ingresos. Revisa tus registros.";
    alerta.classList.remove("hidden");
  } else {
    alerta.textContent = "";
    alerta.classList.add("hidden");
  }

  // Últimos movimientos (máx 5, dentro del periodo seleccionado)
  const cuerpo = document.getElementById("tabla-ultimos-movimientos");
  cuerpo.innerHTML = "";

  const ultimos = [...datosFiltrados]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 5);

  ultimos.forEach((m) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${m.fecha}</td>
      <td>${m.tipo}</td>
      <td>${m.categoria}</td>
      <td>${formatoMoneda(m.monto)}</td>
    `;
    cuerpo.appendChild(fila);
  });
}

// Render historial
function renderHistorial() {
  const filtro = document.getElementById("filtro-tipo").value;
  const cuerpo = document.getElementById("tabla-historial");
  cuerpo.innerHTML = "";

  const lista = movimientos.filter((m) =>
    filtro === "todos" ? true : m.tipo === filtro
  );

  lista
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .forEach((m) => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${m.fecha}</td>
        <td>${m.tipo}</td>
        <td>${m.categoria}</td>
        <td>${m.descripcion || ""}</td>
        <td>${formatoMoneda(m.monto)}</td>
      `;
      cuerpo.appendChild(fila);
    });
}

// Render gráfica
function renderChart() {
  const periodo = document.getElementById("filtro-mes").value;
  const datosFiltrados = filtrarPorPeriodo(movimientos, periodo);

  const totalIngresos = datosFiltrados
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const totalGastos = datosFiltrados
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);

  const ctx = document.getElementById("balanceChart");
  if (!ctx) return;

  const data = {
    labels: ["Ingresos", "Gastos"],
    datasets: [
      {
        label: "Resumen",
        data: [totalIngresos, totalGastos]
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false }
    }
  };

  if (chart) {
    chart.data = data;
    chart.update();
  } else {
    chart = new Chart(ctx, {
      type: "bar",
      data,
      options
    });
  }
}

// Formulario
function configurarFormulario() {
  const form = document.getElementById("form-registro");
  const fechaInput = document.getElementById("fecha");
  const mensajeEstado = document.getElementById("mensaje-estado");

  const hoy = new Date().toISOString().slice(0, 10);
  fechaInput.value = hoy;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const tipo = document.getElementById("tipo").value;
    const monto = parseFloat(document.getElementById("monto").value || "0");
    const fecha = document.getElementById("fecha").value;
    const categoria = document.getElementById("categoria").value;
    const descripcion = document.getElementById("descripcion").value.trim();

    if (!fecha || isNaN(monto) || monto <= 0) {
      alert("Por favor ingresa un monto válido y una fecha.");
      return;
    }

    const nuevo = {
      id: Date.now(),
      tipo,
      monto,
      fecha,
      categoria,
      descripcion
    };

    movimientos.push(nuevo);
    guardarMovimientos();

    renderDashboard();
    renderHistorial();
    renderChart();

    form.reset();
    fechaInput.value = hoy;

    mensajeEstado.textContent = "Movimiento guardado correctamente.";
    mensajeEstado.classList.remove("hidden");

    setTimeout(() => {
      mensajeEstado.classList.add("hidden");
    }, 2000);
  });

  document
    .getElementById("filtro-tipo")
    .addEventListener("change", renderHistorial);

  document
    .getElementById("filtro-mes")
    .addEventListener("change", () => {
      renderDashboard();
      renderChart();
    });
}

// Exportar CSV
function configurarExportacion() {
  const btn = document.getElementById("btn-exportar");
  btn.addEventListener("click", () => {
    if (movimientos.length === 0) {
      alert("No hay movimientos para exportar.");
      return;
    }

    const encabezados = [
      "id",
      "tipo",
      "monto",
      "fecha",
      "categoria",
      "descripcion"
    ];
    const filas = movimientos.map((m) =>
      [
        m.id,
        m.tipo,
        m.monto.toFixed(2),
        m.fecha,
        m.categoria,
        (m.descripcion || "").replace(/,/g, " ")
      ].join(",")
    );

    const contenido = [encabezados.join(","), ...filas].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "finorden_movimientos.csv";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  });
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  configurarNavegacion();
  cargarMovimientos().then(() => {
    configurarFormulario();
    configurarExportacion();
    renderDashboard();
    renderHistorial();
    renderChart();
  });
});

// Función opcional de apoyo para depuración
function reiniciar() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    alert("Datos de FinOrden reiniciados. Vuelve a cargar la página.");
  } catch (e) {
    console.warn("No se pudieron borrar los datos:", e);
  }
}
