import type { SchemaObject } from '@nestjs/swagger';

const NUMBER: SchemaObject = { type: 'integer', minimum: 0 };
const DATE: SchemaObject = { type: 'string', format: 'date' };
const NULL_VALUE: SchemaObject = { nullable: true, enum: [null] };
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});
const unavailable = (reason: string, fields: string[] = []) =>
  object({
    availability: { type: 'string', enum: ['unavailable'] },
    reason: { type: 'string', enum: [reason] },
    ...Object.fromEntries(fields.map((field) => [field, NULL_VALUE])),
  });
const HOTEL = object({
  id: { type: 'string' },
  name: { type: 'string' },
  status: {
    type: 'string',
    enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
  },
});

export const OWNER_DASHBOARD_HOTELS_SCHEMA = object({
  items: { type: 'array', items: HOTEL },
  nextCursor: { type: 'string', nullable: true },
});
export const OWNER_DASHBOARD_RESPONSE_SCHEMA = object({
  scope: object({
    hotel: { ...HOTEL, nullable: true },
    hotelCount: NUMBER,
    dateFrom: DATE,
    dateTo: DATE,
    previousFrom: DATE,
    previousTo: DATE,
    today: DATE,
    timeZone: { type: 'string', enum: ['Asia/Ho_Chi_Minh'] },
  }),
  updatedAt: { type: 'string', format: 'date-time' },
  summary: object({
    hotelCount: NUMBER,
    roomCount: NUMBER,
    upcomingBookings: NUMBER,
    currentGuests: NUMBER,
  }),
  bookings: object({
    availability: { type: 'string', enum: ['available'] },
    basis: { type: 'string', enum: ['createdAt'] },
    count: NUMBER,
    previousCount: NUMBER,
    difference: { type: 'integer' },
  }),
  occupancy: unavailable('INVENTORY_NOT_IMPLEMENTED', [
    'percentage',
    'soldRoomNights',
    'sellableRoomNights',
  ]),
  revenue: unavailable('PAYMENT_REFUND_NOT_IMPLEMENTED', [
    'amount',
    'currency',
    'comparison',
  ]),
  revenueSeries: unavailable('REVENUE_POLICY_NOT_BASELINED', ['points']),
  rating: unavailable('REVIEWS_NOT_IMPLEMENTED', ['score', 'count']),
  actions: object({
    date: DATE,
    arrivals: NUMBER,
    departures: NUMBER,
    support: unavailable('INBOX_NOT_IMPLEMENTED'),
  }),
  ai: unavailable('AI_NOT_IMPLEMENTED'),
});
