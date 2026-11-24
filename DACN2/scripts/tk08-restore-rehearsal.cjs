/* Rehearse backup and restore using only disposable local PostgreSQL databases. */
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'apps', 'booking-travel-be');
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) {
  console.error('DATABASE_URL is required. Run: node --env-file=.env scripts/tk08-restore-rehearsal.cjs');
  process.exit(2);
}

const baseUrl = new URL(sourceUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)) {
  console.error('This rehearsal accepts only a local PostgreSQL host.');
  process.exit(2);
}

const suffix = randomBytes(5).toString('hex');
const sourceName = `booking_travel_tk08_backup_${suffix}`;
const restoredName = `booking_travel_tk08_restore_${suffix}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('schema');
const dbUrl = (name) => {
  const url = new URL(sourceUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const source = new PrismaClient({ datasources: { db: { url: dbUrl(sourceName) } } });
const restored = new PrismaClient({ datasources: { db: { url: dbUrl(restoredName) } } });
const pgBin = process.env.TK08_PG_BIN_DIR || '';
const pgEnv = {
  ...process.env,
  PGHOST: baseUrl.hostname.replace(/^\[|\]$/g, ''),
  PGPORT: baseUrl.port || '5432',
  PGUSER: decodeURIComponent(baseUrl.username),
  PGPASSWORD: decodeURIComponent(baseUrl.password),
};

function run(command, args, options = {}) {
  const bin = pgBin && !path.isAbsolute(command) ? path.join(pgBin, command) : command;
  const result = spawnSync(bin, args, {
    cwd: backend,
    env: { ...pgEnv, ...options.env },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (exit ${result.status}): ${(result.stderr || '').trim().slice(0, 1000)}`);
  }
}

async function fingerprint(client) {
  const tables = await client.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const rowCounts = {};
  for (const { tablename } of tables) {
    const escaped = tablename.replaceAll('"', '""');
    const rows = await client.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM public."${escaped}"`);
    rowCounts[tablename] = Number(rows[0].count);
  }
  const indexes = await client.$queryRawUnsafe(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname",
  );
  const constraints = await client.$queryRawUnsafe(
    "SELECT conname, contype FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conname, contype",
  );
  const extensions = await client.$queryRawUnsafe(
    'SELECT extname, extversion FROM pg_extension ORDER BY extname',
  );
  return {
    rowCounts,
    indexes: indexes.map((row) => row.indexname),
    constraints,
    extensions,
  };
}

async function main() {
  const tempRoot = path.resolve(tmpdir());
  const tempDir = mkdtempSync(path.join(tempRoot, 'booking-travel-tk08-'));
  if (path.dirname(path.resolve(tempDir)) !== tempRoot) {
    throw new Error('Backup path escaped the temporary directory.');
  }
  const dumpFile = path.join(tempDir, 'backup.dump');
  let sourceCreated = false;
  let restoredCreated = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${sourceName}"`);
    sourceCreated = true;
    await admin.$executeRawUnsafe(`CREATE DATABASE "${restoredName}"`);
    restoredCreated = true;
    console.log('[TK-08] Created two isolated local databases.');

    run(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
      env: { DATABASE_URL: dbUrl(sourceName) },
    });
    run(process.execPath, ['-r', 'ts-node/register', 'prisma/seed.ts'], {
      env: { DATABASE_URL: dbUrl(sourceName) },
    });
    const before = await fingerprint(source);
    if (!before.rowCounts._prisma_migrations || !before.rowCounts.User || !before.rowCounts.Booking) {
      throw new Error('Source fixture is incomplete.');
    }

    run('pg_dump', ['--format=custom', '--file', dumpFile], { env: { PGDATABASE: sourceName } });
    const restoreStart = process.hrtime.bigint();
    run('pg_restore', ['--no-owner', '--no-privileges', '--dbname', restoredName, dumpFile], {
      env: { PGDATABASE: restoredName },
    });
    const after = await fingerprint(restored);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error('Restored row counts, indexes or extensions differ from the source.');
    }
    run(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'status'], {
      env: { DATABASE_URL: dbUrl(restoredName) },
    });
    const restoreSeconds = Number(process.hrtime.bigint() - restoreStart) / 1e9;
    console.log(`[TK-08] Restore PASS: ${Object.keys(after.rowCounts).length} tables, ${after.indexes.length} indexes, ${after.constraints.length} constraints, ${after.rowCounts._prisma_migrations} migrations.`);
    console.log(`[TK-08] Local restore and verification: ${restoreSeconds.toFixed(2)} s.`);
  } finally {
    const cleanupErrors = [];
    for (const client of [source, restored]) {
      try {
        await client.$disconnect();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const name of [restoredCreated && restoredName, sourceCreated && sourceName].filter(Boolean)) {
      try {
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await admin.$disconnect();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (path.dirname(path.resolve(tempDir)) === tempRoot) {
      rmSync(tempDir, { recursive: true, force: true });
    } else {
      cleanupErrors.push(new Error('Backup path escaped the temporary directory.'));
    }
    if (cleanupErrors.length) {
      throw new AggregateError(cleanupErrors, 'Disposable database cleanup failed.');
    }
    console.log('[TK-08] Isolated databases and temporary backup removed.');
  }
}

main().catch((error) => {
  console.error('[TK-08] Restore rehearsal failed:', error.message);
  process.exitCode = 1;
});
