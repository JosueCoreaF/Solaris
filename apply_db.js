// Resetea el schema y aplica schema.sql + stored_procedures.sql
// Ejecutar desde: C:\Users\Zyros RK\Desktop\Solaris
// Comando:        node apply_db.js

const { Client } = require('./node_modules/pg');
const fs   = require('fs');
const path = require('path');

// Leer DATABASE_URL directamente del .env (sin depender de dotenv)
const envPath = path.join(__dirname, 'backend', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const DB_URL  = (envText.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();

if (!DB_URL) {
  console.error('ERROR: DATABASE_URL no encontrado en backend/.env');
  process.exit(1);
}

async function resetSchema(client) {
  // 1. Funciones
  const { rows: fns } = await client.query(`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
  `);
  for (const { routine_name } of fns) {
    await client.query(`DROP FUNCTION IF EXISTS public."${routine_name}" CASCADE`);
  }

  // 2. Vistas
  const { rows: views } = await client.query(`
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public'
  `);
  for (const { table_name } of views) {
    await client.query(`DROP VIEW IF EXISTS public."${table_name}" CASCADE`);
  }

  // 3. Tablas
  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  for (const { tablename } of tables) {
    await client.query(`DROP TABLE IF EXISTS public."${tablename}" CASCADE`);
  }
}

(async () => {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Conectado:', DB_URL.replace(/:([^@]+)@/, ':***@'));

    console.log('\n Limpiando schema...');
    await resetSchema(client);
    console.log('Reset OK');

    for (const nombre of ['schema.sql', 'stored_procedures.sql']) {
      const archivo = path.join(__dirname, 'database', nombre);
      const sql = fs.readFileSync(archivo, 'utf8');
      console.log(`\n Ejecutando ${nombre}...`);
      await client.query(sql);
      console.log(`${nombre} OK`);
    }

    console.log('\nBase de datos lista.');
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
