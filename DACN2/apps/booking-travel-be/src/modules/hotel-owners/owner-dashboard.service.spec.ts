import { dashboardPeriod } from './owner-dashboard.service';

describe('Owner dashboard reporting calendar', () => {
  const query = {
    dateFrom: '2026-11-01',
    dateTo: '2026-11-01',
    timeZone: 'Asia/Ho_Chi_Minh',
  };
  it('changes the reporting day at midnight Vietnam time, including month boundary', () => {
    expect(
      dashboardPeriod(query, new Date('2026-10-31T16:59:59.999Z')).today,
    ).toBe('2026-10-31');
    expect(
      dashboardPeriod(query, new Date('2026-10-31T17:00:00Z')),
    ).toMatchObject({
      today: '2026-11-01',
      previousFrom: '2026-10-31',
      previousTo: '2026-10-31',
    });
  });
  it('compares an equal length prior period across leap February', () => {
    expect(
      dashboardPeriod({
        ...query,
        dateFrom: '2024-03-01',
        dateTo: '2024-03-07',
      }),
    ).toMatchObject({ previousFrom: '2024-02-23', previousTo: '2024-02-29' });
  });
  it.each([
    { dateFrom: '2026-02-30' },
    { dateTo: '2026-10-31' },
    { dateFrom: 'invalid' },
    { timeZone: 'UTC' },
    { timeZone: 'invalid' },
    { dateFrom: '0000-01-01' },
    { dateFrom: '0001-01-01', dateTo: '0001-01-01' },
  ])('rejects invalid or unconfirmed periods: %j', (patch) => {
    expect(() => dashboardPeriod({ ...query, ...patch })).toThrow();
  });
});
