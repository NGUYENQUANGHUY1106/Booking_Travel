import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { bookingApiError } from './booking-quote-api';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, Field, T, TravelerScaffold, go } from './ui';

type RefundRequest = {
  id: string;
  bookingId: string;
  paymentId: string;
  provider: string;
  amount: string | null;
  currency: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'PROCESSING' | 'FAILED' | 'REJECTED' | 'COMPLETED';
  reason: string;
  reviewReason: string | null;
  createdAt: string;
  completedAt: string | null;
};
type CancellationPreview = {
  bookingId: string;
  bookingStatus: string;
  canCancel: boolean;
  reason: string | null;
  policySnapshot: string | null;
  paymentMethod: string;
  currency: string;
  paidAmount: string;
  refundEstimate: string | null;
  cancellationFee: string | null;
  refundPercent: number | null;
  requiresManualPolicyReview: boolean;
  requests: RefundRequest[];
};

const STATUS: Record<RefundRequest['status'], string> = {
  PENDING_REVIEW: 'Chờ quản trị viên duyệt',
  APPROVED: 'Đã duyệt, chờ gửi cổng hoàn tiền',
  PROCESSING: 'Đang chờ xác nhận từ cổng hoàn tiền',
  FAILED: 'Cổng hoàn tiền báo thất bại',
  REJECTED: 'Bị từ chối',
  COMPLETED: 'Đã hoàn tiền',
};

function amount(value: string | null, currency: string) {
  if (value === null) return 'Chờ đối soát thủ công';
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(parsed)
    : 'Chưa xác định';
}

export function LiveCancellationScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const localId = useTravelerStore((state) => state.serverBooking?.id);
  const sessionId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const bookingId = params.bookingId ?? localId;
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ['cancellation-preview', sessionId, bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => (await apiClient.get<CancellationPreview>(`/bookings/${bookingId}/cancellation-preview`)).data,
    staleTime: 0,
  });
  const cancel = useMutation({
    mutationFn: async () => (await apiClient.post(`/bookings/${bookingId}/cancel`, { reason: reason.trim() })).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-server-bookings', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['cancellation-preview', sessionId, bookingId] }),
        queryClient.invalidateQueries({ queryKey: ['my-refunds', sessionId] }),
      ]);
      go('refund-request', { bookingId: bookingId! });
    },
    onError: (caught) => setError(bookingApiError(caught)),
  });
  const data = preview.data;
  return <TravelerScaffold title="Hủy đặt phòng" back footer={data?.canCancel ? <Button label={cancel.isPending ? 'Đang gửi...' : 'Xác nhận hủy đặt phòng'} disabled={cancel.isPending || reason.trim().length < 2} onPress={() => { setError(''); cancel.mutate(); }} /> : undefined}>
    {!bookingId ? <Card><T>Chưa chọn đặt phòng cần hủy.</T><Button label="Đặt phòng của tôi" onPress={() => go('my-bookings')} /></Card> : null}
    {preview.isLoading ? <Card><T>Đang kiểm tra chính sách hủy...</T></Card> : null}
    {preview.error ? <Card><T style={{ color: colors.error }}>{bookingApiError(preview.error)}</T><Button label="Thử lại" onPress={() => void preview.refetch()} /></Card> : null}
    {data ? <>
      <Card><T weight="semibold">Chính sách hủy và hoàn tiền</T><T>{data.policySnapshot || 'Booking này chưa có chính sách hủy dạng văn bản.'}</T></Card>
      <Card><T>Đã thanh toán: {amount(data.paidAmount, data.currency)}</T>
        {data.paymentMethod === 'PAY_AT_HOTEL' || data.paidAmount === '0' ? <T>Chưa thu tiền trước; không có khoản tiền để hoàn.</T> : data.requiresManualPolicyReview ? <T>Chính sách của booking này chưa có quy tắc cấu trúc. Số tiền hoàn cần được đối soát thủ công; hệ thống chưa thực hiện hoàn tiền.</T> : <><T>Dự kiến hoàn: {amount(data.refundEstimate, data.currency)} ({data.refundPercent ?? 0}%)</T><T>Phí hủy: {amount(data.cancellationFee, data.currency)}</T></>}
      </Card>
      {data.canCancel ? <Field label="Lý do hủy đặt phòng" value={reason} onChangeText={setReason} multiline placeholder="Nhập lý do hủy" /> : <Card><T>{data.reason ?? 'Đặt phòng không còn được phép hủy.'}</T></Card>}
      {error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}
      {data.requests.length ? <Button label="Theo dõi yêu cầu hoàn tiền" secondary onPress={() => go('refund-request', { bookingId: data.bookingId })} /> : null}
    </> : null}
  </TravelerScaffold>;
}

export function LiveRefundRequestScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const sessionId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const refunds = useQuery({
    queryKey: ['my-refunds', sessionId],
    queryFn: async () => (await apiClient.get<RefundRequest[]>('/refunds')).data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => query.state.data?.some((item) => ['PENDING_REVIEW', 'APPROVED', 'PROCESSING'].includes(item.status)) ? 30_000 : false,
  });
  const { refetch } = refunds;
  useEffect(() => { const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refetch(); }); return () => listener.remove(); }, [refetch]);
  const visible = params.bookingId ? refunds.data?.filter((item) => item.bookingId === params.bookingId) : refunds.data;
  return <TravelerScaffold title="Theo dõi hoàn tiền" back>
    <Card><T>Yêu cầu hoàn tiền được tạo khi bạn hủy booking đã thanh toán. Trạng thái hoàn tất chỉ xuất hiện sau khi cổng thanh toán xác nhận.</T></Card>
    {refunds.isLoading ? <Card><T>Đang tải yêu cầu...</T></Card> : null}
    {refunds.error ? <Card><T style={{ color: colors.error }}>{bookingApiError(refunds.error)}</T><Button label="Thử lại" onPress={() => void refunds.refetch()} /></Card> : null}
    {visible?.length ? visible.map((item) => <Card key={item.id}>
      <T weight="semibold">{STATUS[item.status]}</T>
      <T>Mã yêu cầu: {item.id}</T>
      <T>Phương thức: {item.provider === 'SIMULATOR' ? 'Cổng mô phỏng' : item.provider}</T>
      <T>Số tiền hoàn: {amount(item.amount, item.currency)}</T>
      <T>Gửi lúc: {new Date(item.createdAt).toLocaleString('vi-VN')}</T>
      <T>Lý do hủy: {item.reason}</T>
      {item.reviewReason ? <T>Phản hồi quản trị: {item.reviewReason}</T> : null}
      {item.status === 'FAILED' ? <T style={{ color: colors.error }}>Cổng hoàn tiền báo thất bại. Vui lòng liên hệ hỗ trợ để đối soát.</T> : null}
      {item.status === 'COMPLETED' && item.completedAt ? <T>Hoàn tất: {new Date(item.completedAt).toLocaleString('vi-VN')}</T> : null}
    </Card>) : !refunds.isLoading && !refunds.error ? <Card><T>Booking này chưa có yêu cầu hoàn tiền.</T><Button label="Xem đặt phòng" onPress={() => go('my-bookings')} /></Card> : null}
    <Button label="Làm mới trạng thái" secondary onPress={() => void refunds.refetch()} />
  </TravelerScaffold>;
}
