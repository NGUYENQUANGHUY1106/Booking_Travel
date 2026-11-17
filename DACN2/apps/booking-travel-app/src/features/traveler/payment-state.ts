export type PaymentRouteState = {
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  bookingStatus: string;
};

export function paymentDestination(state: PaymentRouteState): 'processing' | 'success' | 'failed' {
  if (state.paymentStatus === 'REFUNDED' || state.paymentStatus === 'PARTIALLY_REFUNDED') return 'processing';
  if (state.paymentStatus === 'SUCCESS' && state.bookingStatus === 'CONFIRMED') return 'success';
  if (state.paymentStatus === 'FAILED' || state.paymentStatus === 'CANCELLED' || state.bookingStatus === 'EXPIRED' || state.bookingStatus === 'CANCELLED') return 'failed';
  return 'processing';
}
