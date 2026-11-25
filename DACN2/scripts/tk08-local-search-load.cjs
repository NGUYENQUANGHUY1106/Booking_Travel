/* Exploratory local load rehearsal on a disposable PostgreSQL database. */
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'apps', 'booking-travel-be');
const sourceUrl = process.env.DATABASE_URL;
const hotelCount = 5_000;
const concurrency = 100;
const rounds = 2;
const databaseName = `booking_travel_tk08_load_${randomBytes(4).toString('hex')}`;

if (!sourceUrl) throw new Error('DATABASE_URL is required.');
const parsedUrl = new URL(sourceUrl);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname)) {
  throw new Error('Only a local PostgreSQL instance is allowed.');
}
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
adminUrl.searchParams.delete('schema');
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const testDb = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function migrate() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
    'migrate', 'deploy',
  ], {
    cwd: backend,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Migration failed: ${result.error?.message ?? result.status}`);
  }
}

async function seed() {
  const ownerId = `tk08-load-owner-${randomBytes(4).toString('hex')}`;
  await testDb.user.create({
    data: {
      id: ownerId,
      fullName: 'TK-08 Load Owner',
      passwordHash: 'unused-in-load-test',
      role: 'HOTEL_OWNER',
      status: 'ACTIVE',
      isActive: true,
    },
  });
  for (let offset = 0; offset < hotelCount; offset += 500) {
    const end = Math.min(offset + 500, hotelCount);
    const hotels = [];
    const rooms = [];
    for (let index = offset; index < end; index += 1) {
      const id = `${databaseName}-hotel-${index}`;
      hotels.push({
        id,
        ownerId,
        name: `TK08 Da Nang Hotel ${index}`,
        slug: `${databaseName}-hotel-${index}`,
        city: 'Da Nang',
        province: 'Da Nang',
        status: 'APPROVED',
        isVisible: true,
        starRating: 3,
      });
      rooms.push({
        id: `${databaseName}-room-${index}`,
        hotelId: id,
        name: 'Standard',
        type: 'STANDARD',
        bedInfo: '1 queen',
        quantity: 2,
        capacityAdults: 2,
        basePrice: '1000000',
        status: 'ACTIVE',
      });
    }
    await testDb.hotel.createMany({ data: hotels });
    await testDb.room.createMany({ data: rooms });
  }
  const actual = await testDb.hotel.count({ where: { status: 'APPROVED' } });
  if (actual !== hotelCount) throw new Error(`Expected ${hotelCount} hotels, got ${actual}.`);
}

async function awaitReady(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health/database`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch { /* wait for server */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API did not become ready within 30 seconds.');
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

async function measure(url) {
  const started = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const result = await response.json();
    return {
      milliseconds: performance.now() - started,
      ok: response.ok && result.pagination?.total === hotelCount,
      error: !response.ok ? `HTTP ${response.status}` : result.pagination?.total !== hotelCount ? 'Unexpected total' : null,
    };
  } catch (error) {
    return { milliseconds: performance.now() - started, ok: false, error: error?.name ?? 'Unknown' };
  }
}

async function run() {
  let databaseCreated = false;
  let child;
  let serverErrors = '';
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    console.log(`[TK-08 load] Disposable database: ${databaseName}`);
    migrate();
    await seed();
    await testDb.$disconnect();

    const port = await unusedPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['dist/src/main.js'], {
      cwd: backend,
      env: {
        ...process.env,
        DATABASE_URL: testUrl.toString(),
        API_PORT: String(port),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr.on('data', (chunk) => {
      serverErrors = `${serverErrors}${chunk.toString()}`.slice(-100_000);
    });
    await awaitReady(baseUrl, child);

    const checkIn = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
    const query = new URLSearchParams({
      destination: 'Da Nang', checkIn, checkOut,
      adults: '2', children: '0', rooms: '1', limit: '20',
    });
    const url = `${baseUrl}/api/hotels/search?${query}`;
    const warmup = await measure(url);
    if (!warmup.ok) throw new Error('Warmup search did not return all fixture hotels.');

    const started = performance.now();
    const samples = [];
    for (let round = 0; round < rounds; round += 1) {
      samples.push(...await Promise.all(Array.from({ length: concurrency }, () => measure(url))));
    }
    const elapsedSeconds = (performance.now() - started) / 1_000;
    const successful = samples.filter((sample) => sample.ok).map((sample) => sample.milliseconds);
    const errorTypes = Object.fromEntries(
      [...new Set(samples.filter((sample) => !sample.ok).map((sample) => sample.error))]
        .map((type) => [type, samples.filter((sample) => !sample.ok && sample.error === type).length]),
    );
    const summary = {
      environment: 'local-only; not staging or 4G',
      approvedHotels: hotelCount,
      rooms: hotelCount,
      concurrentRequests: concurrency,
      samples: samples.length,
      warmupMilliseconds: Math.round(warmup.milliseconds),
      successful: successful.length,
      errors: samples.length - successful.length,
      errorTypes,
      p50Milliseconds: successful.length ? Math.round(percentile(successful, 0.5)) : null,
      p95Milliseconds: successful.length ? Math.round(percentile(successful, 0.95)) : null,
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    };
    console.log(`[TK-08 load] ${JSON.stringify(summary)}`);
    if (summary.errors) {
      const codes = [...serverErrors.matchAll(/code: '([^']+)'/g)].map((match) => match[1]);
      console.log(`[TK-08 load] Backend error codes: ${JSON.stringify(Object.fromEntries([...new Set(codes)].map((code) => [code, codes.filter((value) => value === code).length])))}`);
      const message = serverErrors.match(/Timed out fetching a new connection[^\r\n]*/);
      if (message) console.log(`[TK-08 load] Backend connection error: ${message[0]}`);
    }
    if (summary.errors) process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await testDb.$disconnect();
    if (databaseCreated) {
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      console.log(`[TK-08 load] Removed disposable database: ${databaseName}`);
    }
    await admin.$disconnect();
  }
}

run().catch((error) => {
  console.error(`[TK-08 load] ${error.message}`);
  process.exitCode = 1;
});
