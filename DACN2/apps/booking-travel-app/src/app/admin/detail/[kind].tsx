import { useLocalSearchParams } from 'expo-router';

import { BookingDetailScreen } from '@/features/admin/bookings/screens';
import { AdminText } from '@/features/admin/dashboard/components';
import { FraudDetailScreen } from '@/features/admin/fraud/screens';
import { HotelDetailScreen } from '@/features/admin/hotel-management/screens';
import { HotelApprovalDetailScreen } from '@/features/admin/hotel-moderation/screens';
import { OwnerDetailScreen } from '@/features/admin/owner-verification/screens';
import { PaymentDetailScreen } from '@/features/admin/payments/screens';
import { ReportDetailScreen } from '@/features/admin/reports/screens';
import { AdminCard, AdminPage } from '@/features/admin/shared/ui';
import { UserDetailScreen } from '@/features/admin/users/screens';

export default function AdminDetailRoute() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  if (!id) return <AdminPage title="Không tìm thấy hồ sơ"><AdminCard><AdminText>Thiếu mã hồ sơ.</AdminText></AdminCard></AdminPage>;
  switch (kind) {
    case 'users': return <UserDetailScreen id={id} />;
    case 'owner-verification': return <OwnerDetailScreen id={id} />;
    case 'hotel-moderation': return <HotelApprovalDetailScreen id={id} />;
    case 'hotels': return <HotelDetailScreen id={id} />;
    case 'bookings': return <BookingDetailScreen id={id} />;
    case 'payments': return <PaymentDetailScreen id={id} />;
    case 'reports': return <ReportDetailScreen id={id} />;
    case 'fraud': return <FraudDetailScreen id={id} />;
    default: return <AdminPage title="Không tìm thấy hồ sơ"><AdminCard><AdminText>Loại hồ sơ không hợp lệ.</AdminText></AdminCard></AdminPage>;
  }
}
