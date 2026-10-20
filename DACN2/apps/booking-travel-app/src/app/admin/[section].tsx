import { useLocalSearchParams } from 'expo-router';

import { AnalyticsScreen } from '@/features/admin/analytics/screen';
import { AuditScreen } from '@/features/admin/audit/screen';
import { BookingsScreen } from '@/features/admin/bookings/screens';
import { FraudFlagsScreen } from '@/features/admin/fraud/screens';
import { HotelsScreen } from '@/features/admin/hotel-management/screens';
import { HotelModerationScreen } from '@/features/admin/hotel-moderation/screens';
import { OwnerQueueScreen } from '@/features/admin/owner-verification/screens';
import { PaymentsScreen } from '@/features/admin/payments/screens';
import { PromotionsScreen, VoucherScreen } from '@/features/admin/promotions/screens';
import { ReportsScreen } from '@/features/admin/reports/screens';
import { AdminPage, AdminCard } from '@/features/admin/shared/ui';
import { UsersScreen } from '@/features/admin/users/screens';
import { AdminText } from '@/features/admin/dashboard/components';

export default function AdminScreenRoute() {
  const { section, id } = useLocalSearchParams<{ section: string; id?: string }>();
  switch (section) {
    case 'users': return <UsersScreen />;
    case 'owner-verification': return <OwnerQueueScreen />;
    case 'hotel-moderation': return <HotelModerationScreen />;
    case 'hotels': return <HotelsScreen />;
    case 'bookings': return <BookingsScreen />;
    case 'payments': return <PaymentsScreen />;
    case 'reviews': return <ReportsScreen kind="REVIEW" />;
    case 'reports': return <ReportsScreen kind="REPORT" />;
    case 'promotions': return <PromotionsScreen />;
    case 'voucher': return <VoucherScreen key={id ?? 'new'} id={id} />;
    case 'analytics': return <AnalyticsScreen />;
    case 'fraud': return <FraudFlagsScreen />;
    case 'audit': return <AuditScreen />;
    default: return <AdminPage title="Không tìm thấy trang"><AdminCard><AdminText>Đường dẫn Admin không hợp lệ.</AdminText></AdminCard></AdminPage>;
  }
}
