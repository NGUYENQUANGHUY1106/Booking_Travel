import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { calendarDate, clearOwnerDashboardCache, dashboardKey, validDateRange } from '../src/features/hotel-owner/dashboard/model.ts';

const filter = { dateFrom: '2026-11-01', dateTo: '2026-11-01', timeZone: 'Asia/Ho_Chi_Minh' };
test('Vietnam midnight and invalid real calendar dates', () => {
  assert.equal(calendarDate(new Date('2026-10-31T16:59:59.999Z')), '2026-10-31');
  assert.equal(calendarDate(new Date('2026-10-31T17:00:00Z')), '2026-11-01');
  assert.equal(validDateRange('2024-02-29', '2024-03-01'), true);
  for (const dates of [['2026-02-29', '2026-03-01'], ['2026-11-02', '2026-11-01'], ['0000-01-01', '2026-11-01']]) assert.equal(validDateRange(...dates), false);
});
test('cache cannot supply another hotel, period, owner or login session', () => {
  const client = new QueryClient();
  client.setQueryData(dashboardKey('A', 'session-1', filter), { count: 90 });
  for (const key of [dashboardKey('B', 'session-1', filter), dashboardKey('A', 'session-2', filter), dashboardKey('A', 'session-1', { ...filter, hotelId: 'hotel-2' }), dashboardKey('A', 'session-1', { ...filter, dateTo: '2026-11-02' })]) assert.equal(client.getQueryData(key), undefined);
  client.clear();
});
test('logout aborts requests and a late old-owner response cannot restore private cache', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = dashboardKey('A', 'session-1', filter);
  let release;
  let signal;
  const pending = client.fetchQuery({ queryKey: key, queryFn: (context) => { signal = context.signal; return new Promise((resolve) => { release = resolve; }); } }).catch(() => undefined);
  client.setQueryData(['unrelated'], 'keep');
  clearOwnerDashboardCache(client);
  assert.equal(signal.aborted, true);
  release({ count: 90 }); await pending;
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(client.getQueryData(['unrelated']), 'keep');
  client.clear();
});
test('a late hotel A response remains separate from the active hotel B filter', async () => {
  const client = new QueryClient();
  const a = dashboardKey('A', 'session-1', { ...filter, hotelId: 'A' });
  const b = dashboardKey('A', 'session-1', { ...filter, hotelId: 'B' });
  let finish;
  const old = client.fetchQuery({ queryKey: a, queryFn: () => new Promise((resolve) => { finish = resolve; }) });
  await client.fetchQuery({ queryKey: b, queryFn: () => ({ hotel: 'B', count: 2 }) });
  finish({ hotel: 'A', count: 90 }); await old;
  assert.deepEqual(client.getQueryData(b), { hotel: 'B', count: 2 }); client.clear();
});
