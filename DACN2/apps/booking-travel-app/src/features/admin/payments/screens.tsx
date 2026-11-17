import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { bookingApiError } from '@/features/traveler/booking-quote-api';
import { useTravelerStore } from '@/features/traveler/store';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminInput, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

type Status = 'PENDING_REVIEW' | 'APPROVED' | 'PROCESSING' | 'FAILED' | 'REJECTED' | 'COMPLETED';
type RefundItem = { id: string; bookingId: string; bookingCode?: string; hotelName?: string; paymentId: string; provider: string; providerRefundRef: string | null; amount: string | null; currency: string; reason: string; status: Status; reviewReason: string | null; createdAt: string };
type PaymentItem = { id: string; bookingCode: string; hotelName: string; provider: string | null; amount: string; currency: string; status: string; reconciliationRequired: boolean; createdAt: string };
type RefundDetail = RefundItem & { booking: { code: string; cancellationPolicySnapshot: string | null; checkIn: string; hotel: { name: string } }; payment: { amount: string; currency: string; status: string; providerTxnId: string | null; merchantReference: string | null }; events: { id: string; eventType: string; createdAt: string }[]; completedAmount: string; reservedAmount: string; remainingAmount: string };
const LABEL: Record<Status, string> = { PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', PROCESSING: 'Đang xử lý', FAILED: 'Thất bại', REJECTED: 'Từ chối', COMPLETED: 'Đã hoàn' };
const FILTERS: { label: string; value?: Status }[] = [{ label: 'Tất cả' }, { label: 'Chờ duyệt', value: 'PENDING_REVIEW' }, { label: 'Đã duyệt', value: 'APPROVED' }, { label: 'Đang xử lý', value: 'PROCESSING' }, { label: 'Đã hoàn', value: 'COMPLETED' }, { label: 'Thất bại', value: 'FAILED' }, { label: 'Từ chối', value: 'REJECTED' }];
function money(value: string | null, currency: string) { if (value === null) return 'Chờ đối soát thủ công'; const parsed = Number(value); return Number.isFinite(parsed) ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(parsed) : 'Chưa xác định'; }

export function PaymentsScreen() {
  const userId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const [status, setStatus] = useState<Status | undefined>();
  const [search, setSearch] = useState('');
  const refunds = useQuery({ queryKey: ['admin-refunds', userId, status, search], queryFn: async () => (await apiClient.get<RefundItem[]>('/admin/refunds', { params: { status, search: search.trim() || undefined } })).data, staleTime: 0 });
  const payments = useQuery({ queryKey: ['admin-payment-list', userId], queryFn: async () => (await apiClient.get<PaymentItem[]>('/admin/refunds/payments')).data, staleTime: 0 });
  return <AdminPage title="Thanh toán và hoàn tiền" subtitle="Yêu cầu hoàn tiền từ booking đã hủy; chỉ callback hợp lệ mới xác nhận hoàn tất.">
    <AdminCard title="Lọc yêu cầu"><AdminInput label="Tìm theo mã booking, khách sạn, cổng hoặc mã yêu cầu" value={search} onChangeText={setSearch} placeholder="Nhập từ khóa" />{FILTERS.map((filter) => <AdminButton key={filter.label} label={filter.label} variant={status === filter.value ? 'primary' : 'outline'} onPress={() => setStatus(filter.value)} style={{ alignSelf: 'flex-start' }} />)}</AdminCard>
    <AdminCard title="Danh sách hoàn tiền">
      {refunds.isLoading ? <AdminText>Đang tải yêu cầu...</AdminText> : null}
      {refunds.error ? <><AdminText>{bookingApiError(refunds.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void refunds.refetch()} /></> : null}
      {refunds.data?.length ? refunds.data.map((item) => <AdminRow key={item.id} title={`${item.bookingCode ?? item.bookingId} · ${item.hotelName ?? 'Khách sạn'}`} subtitle={`${money(item.amount, item.currency)} · ${item.provider} · ${new Date(item.createdAt).toLocaleString('vi-VN')}`} status={LABEL[item.status]} onPress={() => openAdminDetail('payments', item.id)} />) : !refunds.isLoading && !refunds.error ? <AdminText>Không có yêu cầu phù hợp.</AdminText> : null}
      <AdminButton label="Làm mới" variant="outline" onPress={() => void refunds.refetch()} />
    </AdminCard>
    <AdminCard title="Giao dịch thanh toán gần đây">
      {payments.isLoading ? <AdminText>Đang tải giao dịch...</AdminText> : null}
      {payments.error ? <><AdminText>{bookingApiError(payments.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void payments.refetch()} /></> : null}
      {payments.data?.length ? payments.data.map((item) => <AdminRow key={item.id} title={`${item.bookingCode} · ${item.hotelName}`} subtitle={`${money(item.amount, item.currency)} · ${item.provider ?? 'Chưa có cổng'} · ${new Date(item.createdAt).toLocaleString('vi-VN')}`} status={item.reconciliationRequired ? 'Cần đối soát' : item.status === 'PARTIALLY_REFUNDED' ? 'Đã hoàn một phần' : item.status === 'REFUNDED' ? 'Đã hoàn' : item.status} />) : !payments.isLoading && !payments.error ? <AdminText>Chưa có giao dịch.</AdminText> : null}
      <AdminButton label="Làm mới giao dịch" variant="outline" onPress={() => void payments.refetch()} />
    </AdminCard>
  </AdminPage>;
}

export function PaymentDetailScreen({ id }: { id: string }) {
  const userId = useTravelerStore((state) => state.session?.mode === 'api' ? state.session.userId : '');
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'APPROVE' | 'REJECT' | null>(null);
  const detail = useQuery({ queryKey: ['admin-refund', userId, id], queryFn: async () => (await apiClient.get<RefundDetail>(`/admin/refunds/${id}`)).data, staleTime: 0 });
  const action = useMutation({
    mutationFn: async (decision: 'APPROVE' | 'REJECT' | 'DISPATCH' | 'REOPEN') => (await apiClient.post(`/admin/refunds/${id}/${decision === 'DISPATCH' ? 'dispatch' : decision === 'REOPEN' ? 'reopen' : 'decision'}`, decision === 'DISPATCH' ? {} : decision === 'REOPEN' ? { reason: reason.trim() } : { decision, reason: reason.trim() })).data,
    onSuccess: async () => { setReason(''); setError(''); setConfirmation(null); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-refund', userId, id] }), queryClient.invalidateQueries({ queryKey: ['admin-refunds', userId] })]); },
    onError: (caught) => setError(bookingApiError(caught)),
  });
  const item = detail.data;
  return <AdminPage title="Chi tiết hoàn tiền" subtitle="Đối chiếu booking, khoản đã thu và lịch sử xử lý trước khi quyết định.">
    {detail.isLoading ? <AdminCard><AdminText>Đang tải...</AdminText></AdminCard> : null}
    {detail.error ? <AdminCard><AdminText>{bookingApiError(detail.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void detail.refetch()} /></AdminCard> : null}
    {item ? <>
      <AdminCard title={`Booking ${item.booking.code} · ${item.booking.hotel.name}`}>
        <AdminText>Trạng thái: {LABEL[item.status]}</AdminText><AdminText>Đã thu: {money(item.payment.amount, item.payment.currency)} · {item.payment.status}</AdminText><AdminText>Dự kiến hoàn: {money(item.amount, item.currency)}</AdminText><AdminText>Ngày nhận phòng: {new Date(item.booking.checkIn).toLocaleDateString('vi-VN')}</AdminText><AdminText>Chính sách lúc đặt: {item.booking.cancellationPolicySnapshot || 'Chưa có'}</AdminText><AdminText>Lý do khách: {item.reason}</AdminText>{item.reviewReason ? <AdminText>Quyết định: {item.reviewReason}</AdminText> : null}
      </AdminCard>
      <AdminCard title="Đối soát giao dịch"><AdminText>Mã thanh toán: {item.paymentId}</AdminText><AdminText>Đã hoàn: {money(item.completedAmount, item.currency)}</AdminText><AdminText>Đang giữ để hoàn: {money(item.reservedAmount, item.currency)}</AdminText><AdminText>Còn có thể hoàn theo số đã thu: {money(item.remainingAmount, item.currency)}</AdminText><AdminText>Tham chiếu gốc: {item.payment.providerTxnId || 'Chưa có'}</AdminText><AdminText>Tham chiếu hoàn: {item.providerRefundRef || 'Chưa có'}</AdminText>{item.amount === null ? <AdminText>Booking cũ chưa có quy tắc hoàn cấu trúc. Giữ chờ đối soát thủ công; không thể duyệt tiền tự động.</AdminText> : null}</AdminCard>
      {item.status === 'PENDING_REVIEW' ? <AdminCard title="Quyết định của quản trị viên"><AdminInput label="Lý do và bằng chứng đối soát" value={reason} onChangeText={setReason} placeholder="Nhập lý do quyết định" /><AdminButton label="Duyệt số tiền đề xuất" disabled={action.isPending || !reason.trim() || item.amount === null} onPress={() => setConfirmation('APPROVE')} /><AdminButton label="Từ chối yêu cầu" variant="danger" disabled={action.isPending || !reason.trim()} onPress={() => setConfirmation('REJECT')} />{confirmation ? <AdminCard title="Xác nhận quyết định"><AdminText>{confirmation === 'APPROVE' ? `Duyệt yêu cầu hoàn ${money(item.amount, item.currency)}?` : 'Từ chối yêu cầu hoàn tiền này?'}</AdminText><AdminText>Lý do: {reason}</AdminText><AdminButton label="Xác nhận" disabled={action.isPending} onPress={() => action.mutate(confirmation)} /><AdminButton label="Quay lại" variant="outline" onPress={() => setConfirmation(null)} /></AdminCard> : null}</AdminCard> : null}
      {item.status === 'APPROVED' ? <AdminCard title="Mô phỏng hoàn tiền"><AdminText>Chuyển sang chờ callback mô phỏng. Đây chưa phải lệnh chuyển tiền thật; chỉ callback có chữ ký mới xác nhận hoàn tất.</AdminText><AdminButton label="Chờ callback mô phỏng" disabled={action.isPending} onPress={() => action.mutate('DISPATCH')} /></AdminCard> : null}
      {item.status === 'FAILED' ? <AdminCard title="Xem xét thử lại"><AdminText>Chỉ thử lại sau khi xác nhận cổng đã báo thất bại. Giữ nguyên mã tham chiếu hoàn tiền để chống gửi trùng.</AdminText><AdminInput label="Lý do thử lại" value={reason} onChangeText={setReason} placeholder="Ghi kết quả đối soát" /><AdminButton label="Đưa lại vào hàng duyệt" disabled={action.isPending || !reason.trim()} onPress={() => action.mutate('REOPEN')} /></AdminCard> : null}
      {error ? <AdminCard><AdminText>{error}</AdminText></AdminCard> : null}
      <AdminCard title="Lịch sử xử lý">{item.events.map((event) => <AdminText key={event.id}>{new Date(event.createdAt).toLocaleString('vi-VN')} · {event.eventType}</AdminText>)}</AdminCard><AdminButton label="Làm mới trạng thái" variant="outline" onPress={() => void detail.refetch()} />
    </> : null}
  </AdminPage>;
}
