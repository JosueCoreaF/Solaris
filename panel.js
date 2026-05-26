const blessed = require('blessed');
const contrib = require('blessed-contrib');
const { spawn, execSync } = require('child_process');

const DIRECTORIO = __dirname;
const servicios = [
    { id: 'hub', name: 'HUB', color: 'blue', port: 5174 },
    { id: 'backend', name: 'BACKEND', color: 'green', port: 4000 },
    { id: 'hotel', name: 'HOTEL', color: 'yellow', port: 5173 },
    { id: 'restaurant', name: 'RESTAURANT', color: 'red', port: 5176 },
    { id: 'gym', name: 'GYM', color: 'magenta', port: 5175 }
];

const screen = blessed.screen({ smartCSR: true, title: 'Solaris Control Panel' });
const layout = new contrib.grid({ rows: 12, cols: 12, screen: screen });
const logWindow = layout.set(3, 0, 9, 12, contrib.log, { label: 'LOGS DE SERVICIOS', fg: 'white', border: { type: 'line' }, tags: true });
const menuBox = layout.set(0, 0, 3, 12, blessed.list, {
    label: 'PANEL DE CONTROL (ENTER para alternar | R: Reiniciar | Q: Salir)',
    border: 'line', keys: true, interactive: true, style: { selected: { bg: 'blue' } }
});

const estados = {};
const procesos = {};

function liberarPuerto(puerto) {
    try { execSync(`netstat -ano | findstr :${puerto} | for /f "tokens=5" %a in ('more') do taskkill /PID %a /F >nul 2>&1`); } catch (e) { }
}

function limpiarZombis(id) {
    try { execSync(`powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'dev:${id}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' }); } catch (e) { }
}

function iniciarServicio(id) {
    const s = servicios.find(srv => srv.id === id);
    liberarPuerto(s.port);
    limpiarZombis(id);

    const cp = spawn('npm', ['run', `dev:${id}`], { cwd: DIRECTORIO, shell: true });
    procesos[id] = cp.pid;
    estados[id] = true;

    logWindow.log(`{bold}{green-fg}Iniciado:{/green-fg} ${s.name} en puerto ${s.port}{/bold}`);

    cp.stdout.on('data', (d) => {
        const msg = d.toString()
            .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
            .replace(/\{/g, '{{')
            .replace(/\}/g, '}}')
            .trim();
        if (msg) logWindow.log(`{${s.color}-fg}[${s.name}]{/${s.color}-fg} ${msg}`);
    });
}

function detenerServicio(id) {
    if (procesos[id]) {
        try { execSync(`taskkill /PID ${procesos[id]} /T /F >nul 2>&1`); } catch (e) { }
        estados[id] = false;
        logWindow.log(`{red-fg}Detenido:{/red-fg} ${servicios.find(s => s.id === id).name}`);
    }
}

// Renderizado inicial
function renderMenu() {
    menuBox.setItems(servicios.map(s => `${estados[s.id] ? '🟢 [ACTIVO]   ' : '🔴 [INACTIVO] '} ${s.name}`));
    screen.render();
}

menuBox.on('select', (item, index) => {
    const s = servicios[index];
    if (estados[s.id]) detenerServicio(s.id);
    else iniciarServicio(s.id);
    renderMenu();
});

// Teclas rápidas
screen.key(['r'], () => {
    servicios.forEach(s => {
        if (estados[s.id]) {
            detenerServicio(s.id);
            iniciarServicio(s.id);
        }
    });
    renderMenu();
});

screen.key(['escape', 'q', 'C-c'], () => {
    Object.values(procesos).forEach(pid => { try { execSync(`taskkill /PID ${pid} /T /F >nul 2>&1`); } catch (e) { } });
    process.exit(0);
});

renderMenu();
menuBox.focus();