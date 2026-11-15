export type PaymentRouteState = {
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  bookingStatus: string;
};

export function paymentDestination(state: PaymentRouteState): 'processing' | 'success' | 'failed' {
  if (state.paymentStatus === 'SUCCESS' && state.bookingStatus === 'CONFIRMED') return 'success';
  if (state.paymentStatus === 'FAILED' || state.bookingStatus === 'EXPIRED' || state.bookingStatus === 'CANCELLED') return 'failed';
  return 'processing';
}
