import { AdminText, RevenueBarChart } from '../dashboard/components';
import { ADMIN_DASHBOARD_DEMO } from '../dashboard/mock';
import { AdminCard, AdminPage, AdminRow } from '../shared/ui';

export function AnalyticsScreen() {
  return <AdminPage title="Phân tích hệ thống"><AdminCard title="Tổng quan hệ thống"><AdminText>Lượt đặt phòng · Doanh thu · Tỷ lệ hủy · khách sạn hoạt động</AdminText></AdminCard><AdminCard><AdminRow title="Đặt phòng tháng này" subtitle="1.284" status="↑ 8%" /><AdminRow title="Doanh thu" subtitle="2,46 tỷ ₫" status="↑ 12%" /><AdminRow title="Tỷ lệ hủy" subtitle="4,2%" /><AdminRow title="Khách sạn hoạt động" subtitle="246" /></AdminCard><AdminCard title="Doanh thu theo ngày"><RevenueBarChart data={ADMIN_DASHBOARD_DEMO.revenueByDay} /></AdminCard></AdminPage>;
}
