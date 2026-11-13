import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentDestination } from '../src/features/traveler/payment-state.ts';

test('a browser success return cannot show success while the server still has a pending payment', () => {
  assert.equal(paymentDestination({ paymentStatus: 'PENDING', bookingStatus: 'PENDING_PAYMENT' }), 'processing');
  assert.equal(paymentDestination({ paymentStatus: 'SUCCESS', bookingStatus: 'PENDING_PAYMENT' }), 'processing');
});

test('only a confirmed booking and successful payment can show the success screen', () => {
  assert.equal(paymentDestination({ paymentStatus: 'SUCCESS', bookingStatus: 'CONFIRMED' }), 'success');
  assert.equal(paymentDestination({ paymentStatus: 'SUCCESS', bookingStatus: 'EXPIRED' }), 'failed');
});

test('a verified failure or released booking exits processing', () => {
  assert.equal(paymentDestination({ paymentStatus: 'FAILED', bookingStatus: 'PENDING_PAYMENT' }), 'failed');
  assert.equal(paymentDestination({ paymentStatus: 'PENDING', bookingStatus: 'CANCELLED' }), 'failed');
  assert.equal(paymentDestination({ paymentStatus: 'PENDING', bookingStatus: 'EXPIRED' }), 'failed');
});
