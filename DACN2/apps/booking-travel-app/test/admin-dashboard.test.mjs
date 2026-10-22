import assert from 'node:assert/strict';
import test from 'node:test';

import { ADMIN_DASHBOARD_DEMO } from '../src/features/admin/dashboard/mock.ts';
import { canOpenAdminDashboard, isAdminDemoEnabled } from '../src/features/admin/session.ts';

test('ADM-UI-02 fixture preserves the four KPIs, seven bars, queues and activities', () => {
  const dashboard = ADMIN_DASHBOARD_DEMO;

  assert.deepEqual(dashboard.kpis.map((item) => item.displayValue), ['48,25 tr', '128', '2', '1']);
  assert.deepEqual(dashboard.revenueByDay.map((item) => item.day), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
  assert.deepEqual(dashboard.revenueByDay.filter((item) => item.highlighted).map((item) => item.day), ['T7']);
  assert.deepEqual(dashboard.pendingTasks.map((item) => item.count), [3, 2, 1]);
  assert.equal(dashboard.recentActivities.length, 3);
});

test('Admin demo route guard rejects User and Hotel Owner sessions', () => {
  assert.equal(canOpenAdminDashboard('USER', true), false);
  assert.equal(canOpenAdminDashboard('HOTEL_OWNER', true), false);
  assert.equal(canOpenAdminDashboard(undefined, true), false);
  assert.equal(canOpenAdminDashboard('ADMIN', false), false);
  assert.equal(canOpenAdminDashboard('ADMIN', true), true);
  assert.equal(canOpenAdminDashboard('ADMIN', false, 'api'), true);
  assert.equal(canOpenAdminDashboard('USER', true, 'api'), false);
  assert.equal(isAdminDemoEnabled('false'), false);
  assert.equal(isAdminDemoEnabled('true'), true);
});
