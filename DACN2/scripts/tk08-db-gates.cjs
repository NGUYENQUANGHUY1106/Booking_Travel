/* Run PostgreSQL integration gates against a disposable database. */
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'apps', 'booking-travel-be');
const databaseName = `booking_travel_tk08_${randomBytes(4).toString('hex')}`;
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) {
  console.error('DATABASE_URL is required. Run: node --env-file=.env scripts/tk08-db-gates.cjs');
  process.exit(2);
}

const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('schema');
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const testDb = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });

function run(label, args, extraEnv = {}) {
  console.log(`\n[TK-08] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: backend,
    env: { ...process.env, DATABASE_URL: testUrl.toString(), ...extraEnv },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}: exit ${result.status}`);
}

async function main() {
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    console.log(`[TK-08] Isolated PostgreSQL database created: ${databaseName}`);
    run('Clean-schema migration', [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy']);
    run('Seed deterministic fixtures', ['-r', 'ts-node/register', 'prisma/seed.ts']);
    run('Verify seeded fixtures', ['-r', 'ts-node/register', 'prisma/verify-seed.ts']);
    const source = await testDb.dataSource.create({ data: {
      key: 'TK08_TEST_ADDRESS', name: 'TK-08 test address', publisher: 'Booking Travel QA',
      url: 'https://example.invalid/tk08', version: '1', retrievedAt: new Date(), coverage: 'TEST_ONLY',
    } });
    const province = await testDb.administrativeUnit.create({ data: {
      officialCode: 'TK08-PROVINCE', name: 'Thành phố Đà Nẵng', normalizedName: 'da nang',
      level: 'PROVINCE', unitType: 'MUNICIPALITY', catalogMode: 'CURRENT',
      sourceId: source.id, validFrom: new Date('2025-01-01T00:00:00.000Z'),
    } });
    await testDb.administrativeUnit.create({ data: {
      officialCode: 'TK08-WARD', name: 'Phường Kiểm thử', normalizedName: 'kiem thu',
      level: 'COMMUNE', unitType: 'WARD', catalogMode: 'CURRENT', parentId: province.id,
      sourceId: source.id, validFrom: new Date('2025-01-01T00:00:00.000Z'),
    } });
    await testDb.$disconnect();
    run('Database and HTTP integration regression', [path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), '--config', './test/jest-e2e.json', '--runInBand'], {
      RUN_DB_INVENTORY_E2E: '1',
      RUN_DB_PAYMENT_E2E: '1',
      RUN_DB_AUTH_E2E: '1',
      RUN_DB_HTL09_E2E: '1',
      RUN_DB_ADM_E2E: '1',
      RUN_DB_OWNER_E2E: '1',
      RUN_DB_HOTEL_E2E: '1',
      RUN_DB_STAY_E2E: '1',
      RUN_DB_PRICING_E2E: '1',
      RUN_DB_REV01_E2E: '1',
    });
    console.log('[TK-08] Database gates passed.');
  } finally {
    if (created) {
      await testDb.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log(`[TK-08] Isolated database removed: ${databaseName}`);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error('[TK-08] Database gate failed:', error.message);
  process.exitCode = 1;
});
