const prompts = require('prompts');
const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIRECTORIO = 'C:\\Users\\Zyros RK\\Desktop\\Solaris';
const LOG_DIR = path.join(DIRECTORIO, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const servicios = [
    { id: 'hub', name: 'HUB', color: '#00bfff', port: 5174 },
    { id: 'backend', name: 'BACKEND', color: '#32cd32', port: 4000 },
    { id: 'hotel', name: 'HOTEL', color: '#ffd700', port: 5173 },
    { id: 'restaurant', name: 'RESTAURANT', color: '#ff4500', port: 5176 },
    { id: 'gym', name: 'GYM', color: '#da70d6', port: 5175 }
];

servicios.forEach(s => {
    const logPath = path.join(LOG_DIR, `${s.id}.log`);
    if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '=== INICIO DE REGISTRO ===\n');
});

const procesosActivos = {};
const pestanasAbiertas = new Set();

// --- FUNCIONES DE CONTROL ---

function liberarPuerto(puerto) {
    if (!puerto) return;
    try {
        const salida = execSync(`netstat -ano | findstr :${puerto}`, { encoding: 'utf8' });
        const lineas = salida.split('\n');
        for (let linea of lineas) {
            const partes = linea.trim().split(/\s+/);
            const pid = partes[partes.length - 1];
            if (pid && pid !== '0') {
                execSync(`taskkill /PID ${pid} /F >nul 2>&1`);
            }
        }
    } catch (error) { }
}

function matarProceso(id, pid) {
    try { execSync(`taskkill /PID ${pid} /T /F >nul 2>&1`); } catch (error) { }
    const logPath = path.join(LOG_DIR, `${id}.log`);
    try {
        fs.appendFileSync(logPath, `\n========================================\n 🔴 SERVICIO DETENIDO MANUALMENTE\n========================================\n\n`);
    } catch (error) { }
}

function iniciarProceso(id) {
    const s = servicios.find(srv => srv.id === id);
    const logPath = path.join(LOG_DIR, `${s.id}.log`);

    // 1. Limpieza absoluta: Por puerto y por comando
    liberarPuerto(s.port);
    try {
        execSync(`powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'dev:${id}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' });
    } catch (error) { }

    // 2. Iniciamos lienzo limpio
    fs.writeFileSync(logPath, `========================================\n 🚀 INICIANDO SERVICIO: ${id.toUpperCase()}\n========================================\n\n`);

    const out = fs.openSync(logPath, 'a');
    const cp = spawn('npm', ['run', `dev:${id}`], {
        cwd: DIRECTORIO,
        shell: true,
        stdio: ['ignore', out, out]
    });

    procesosActivos[id] = cp.pid;
}

function abrirPestanaIndividual(id) {
    const s = servicios.find(srv => srv.id === id);
    const wtCommand = `wt -w Solaris new-tab -d "${DIRECTORIO}" --suppressApplicationTitle --title "${s.name}" --tabColor "${s.color}" powershell -NoExit -Command "Get-Content -Path '.\\logs\\${s.id}.log' -Wait -Tail 30 -Encoding UTF8"`;
    exec(wtCommand);
}

function cerrarTodo() {
    Object.entries(procesosActivos).forEach(([id, pid]) => matarProceso(id, pid));
    try { execSync(`taskkill /F /IM WindowsTerminal.exe /T >nul 2>&1`); } catch (error) { }
}

// --- MENÚ ---

async function mostrarMenu() {
    console.clear();
    console.log('==============================================');
    console.log('         GESTOR DE PROCESOS SOLARIS           ');
    console.log('==============================================\n');

    const opciones = servicios.map(s => {
        const estaActivo = !!procesosActivos[s.id];
        return { title: `${estaActivo ? '🟢 ACTIVO  ' : '🔴 INACTIVO'} | ${s.name}`, value: s.id };
    });

    opciones.push({ title: '----------------------------------------------', value: 'sep', disabled: true });
    opciones.push({ title: '🔄 Reiniciar servicios ACTIVOS', value: 'reiniciar' });
    opciones.push({ title: '❌ Apagar todo y Salir', value: 'salir' });

    const respuesta = await prompts({ type: 'select', name: 'accion', message: 'Selecciona acción:', choices: opciones });

    if (!respuesta.accion || respuesta.accion === 'salir') {
        cerrarTodo();
        process.exit(0);
    }

    if (respuesta.accion === 'reiniciar') {
        for (const [id, pid] of Object.entries(procesosActivos)) {
            matarProceso(id, pid);
            iniciarProceso(id);
        }
    } else {
        if (procesosActivos[respuesta.accion]) {
            matarProceso(respuesta.accion, procesosActivos[respuesta.accion]);
            delete procesosActivos[respuesta.accion];
        } else {
            iniciarProceso(respuesta.accion);
            abrirPestanaIndividual(respuesta.accion);
        }
    }
    mostrarMenu();
}

mostrarMenu();