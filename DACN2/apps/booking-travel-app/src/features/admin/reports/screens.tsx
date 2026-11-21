import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTravelerStore } from "@/features/traveler/store";
import { AdminText } from "../dashboard/components";
import {
  appendMockAudit,
  mockAccommodationService,
  mockReportService,
} from "../shared/mock";
import {
  AdminButton,
  AdminCard,
  AdminDecisionDialog,
  AdminPage,
  AdminRow,
  openAdminDetail,
  openAdminScreen,
} from "../shared/ui";
import {
  useAdminHotelReport,
  useAdminHotelReports,
  type AdminHotelReport,
} from "./api";

const reasonLabels: Record<string, string> = {
  INCORRECT_INFORMATION: "Thông tin không đúng",
  MISLEADING_IMAGES: "Hình ảnh gây hiểu nhầm",
  FRAUD: "Dấu hiệu gian lận",
  SAFETY: "An toàn lưu trú",
  OTHER: "Lý do khác",
};
const statusLabels: Record<string, string> = {
  OPEN: "Mở",
  IN_REVIEW: "Đang xem xét",
  RESOLVED: "Đã xử lý",
  REJECTED: "Đã bác bỏ",
};

export function ReportsScreen({ kind }: { kind: "REVIEW" | "REPORT" }) {
  if (kind === "REPORT") return <LiveHotelReportsScreen />;
  return <MockReviewReportsScreen />;
}

function LiveHotelReportsScreen() {
  const session = useTravelerStore((state) => state.session);
  const reports = useAdminHotelReports();
  return (
    <AdminPage
      title="Báo cáo khách sạn"
      subtitle="Báo cáo thật từ khách đã hoàn thành kỳ lưu trú, gửi trực tiếp đến Admin tổng."
    >
      {session?.mode !== "api" || session.role !== "ADMIN" ? (
        <AdminCard>
          <AdminText>
            Đăng nhập tài khoản Admin tổng để xem hàng đợi thật.
          </AdminText>
        </AdminCard>
      ) : reports.isPending ? (
        <ActivityIndicator />
      ) : reports.isError ? (
        <AdminCard>
          <AdminText>Không tải được hàng đợi báo cáo.</AdminText>
          <AdminButton label="Thử lại" onPress={() => void reports.refetch()} />
        </AdminCard>
      ) : (
        <AdminCard title={`Hàng đợi · ${reports.data?.length ?? 0} báo cáo`}>
          {reports.data?.length ? (
            reports.data.map((report) => (
              <AdminRow
                key={report.id}
                title={report.hotel.name}
                subtitle={`${reasonLabels[report.reason] ?? report.reason} · Booking ${report.booking.code} · ${new Date(report.createdAt).toLocaleString("vi-VN")}`}
                status={statusLabels[report.status] ?? report.status}
                onPress={() => openAdminDetail("reports", report.id)}
              />
            ))
          ) : (
            <AdminText>Chưa có báo cáo khách sạn.</AdminText>
          )}
        </AdminCard>
      )}
    </AdminPage>
  );
}

function MockReviewReportsScreen() {
  const reports = mockReportService
    .useItems()
    .filter((item) => item.kind === "REVIEW");
  const hotels = mockAccommodationService.useItems();
  return (
    <AdminPage title="Kiểm duyệt đánh giá">
      <AdminCard title="Đánh giá cần xét duyệt">
        <AdminText>Dữ liệu minh họa cho luồng kiểm duyệt đánh giá.</AdminText>
      </AdminCard>
      <AdminCard>
        {reports.map((report) => (
          <AdminRow
            key={report.id}
            title={
              hotels.find((item) => item.id === report.hotelId)?.name ?? "Chỗ ở"
            }
            subtitle={report.evidence}
            status={report.status === "OPEN" ? "Mở" : report.status}
            onPress={() => openAdminDetail("reports", report.id)}
          />
        ))}
      </AdminCard>
      <AdminButton
        label="Quản lý báo cáo khách sạn"
        variant="outline"
        onPress={() => openAdminScreen("reports")}
        style={{ alignSelf: "flex-start" }}
      />
    </AdminPage>
  );
}

export function ReportDetailScreen({ id }: { id: string }) {
  const mock = mockReportService.useItems().find((item) => item.id === id);
  const session = useTravelerStore((state) => state.session);
  const live = useAdminHotelReport(id, !mock);
  if (!mock && session?.mode === "api" && session.role === "ADMIN") {
    if (live.isPending)
      return (
        <AdminPage title="Chi tiết báo cáo">
          <ActivityIndicator />
        </AdminPage>
      );
    if (live.isError || !live.data)
      return (
        <AdminPage title="Chi tiết báo cáo">
          <AdminCard>
            <AdminText>Không tìm thấy hoặc không tải được báo cáo.</AdminText>
            <AdminButton label="Thử lại" onPress={() => void live.refetch()} />
          </AdminCard>
        </AdminPage>
      );
    return <LiveReportDetail report={live.data} />;
  }
  return <MockReportDetail id={id} />;
}

function LiveReportDetail({ report }: { report: AdminHotelReport }) {
  return (
    <AdminPage
      title="Chi tiết báo cáo"
      subtitle="Danh tính người báo cáo chỉ hiển thị cho Admin tổng."
    >
      <AdminCard title={report.hotel.name}>
        <AdminText>{reasonLabels[report.reason] ?? report.reason}</AdminText>
        <AdminText>{report.description}</AdminText>
        <AdminText>
          Trạng thái: {statusLabels[report.status] ?? report.status}
        </AdminText>
        <AdminText>
          Gửi lúc: {new Date(report.createdAt).toLocaleString("vi-VN")}
        </AdminText>
      </AdminCard>
      <AdminCard title="Booking đã đối chiếu">
        <AdminText>
          {report.booking.code} · {report.booking.roomNameSnapshot}
        </AdminText>
        <AdminText>
          {report.booking.checkIn.slice(0, 10)} →{" "}
          {report.booking.checkOut.slice(0, 10)}
        </AdminText>
        <AdminText>Trạng thái booking: {report.booking.status}</AdminText>
      </AdminCard>
      <AdminCard title="Người báo cáo (chỉ Admin)">
        <AdminText>{report.reporter.fullName}</AdminText>
        <AdminText>
          {report.reporter.email ?? report.reporter.phone ?? report.reporter.id}
        </AdminText>
      </AdminCard>
      <AdminCard title="Bằng chứng">
        <AdminText>
          {report.evidenceUrls.length
            ? report.evidenceUrls.join("\n")
            : "Không đính kèm bằng chứng."}
        </AdminText>
      </AdminCard>
      <AdminCard>
        <AdminText>
          Việc duyệt, bác bỏ hoặc áp dụng biện pháp với khách sạn thuộc task
          ST-ADM-08; màn hình này không tự thay đổi trạng thái khách sạn.
        </AdminText>
      </AdminCard>
    </AdminPage>
  );
}

function MockReportDetail({ id }: { id: string }) {
  const report = mockReportService.useItems().find((item) => item.id === id);
  const hotel = mockAccommodationService
    .useItems()
    .find((item) => item.id === report?.hotelId);
  const [decision, setDecision] = useState<"resolve" | "reject" | null>(null);
  if (!report)
    return (
      <AdminPage title="Chi tiết báo cáo">
        <AdminCard>
          <AdminText>Không tìm thấy báo cáo.</AdminText>
        </AdminCard>
      </AdminPage>
    );
  const openDecision = (next: "resolve" | "reject") => {
    if (report.status === "OPEN")
      mockReportService.update(report.id, { status: "IN_REVIEW" });
    setDecision(next);
  };
  return (
    <AdminPage title="Chi tiết báo cáo">
      <AdminCard title={`Báo cáo khách sạn ${hotel?.name}`}>
        <AdminText>{report.reason}</AdminText>
        <AdminText>Trạng thái: {report.status}</AdminText>
      </AdminCard>
      <AdminCard title="Bằng chứng cần kiểm tra">
        <AdminText>{report.evidence}</AdminText>
      </AdminCard>
      {(report.status === "OPEN" || report.status === "IN_REVIEW") && (
        <>
          <AdminButton
            label="Ra quyết định báo cáo"
            onPress={() => openDecision("resolve")}
            style={{ width: 340 }}
          />
          <AdminButton
            label="Bác bỏ báo cáo"
            variant="outline"
            onPress={() => openDecision("reject")}
            style={{ width: 340 }}
          />
        </>
      )}
      <AdminDecisionDialog
        visible={decision !== null}
        title="Ra quyết định báo cáo"
        target={`Báo cáo khách sạn ${hotel?.name}`}
        evidence={report.evidence}
        reasonRequired
        confirmLabel="Xác nhận xử lý"
        danger={decision === "reject"}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => {
          mockReportService.update(report.id, {
            status: decision === "resolve" ? "RESOLVED" : "REJECTED",
          });
          appendMockAudit("Xử lý báo cáo", hotel?.name ?? report.id, reason);
          setDecision(null);
        }}
      />
    </AdminPage>
  );
}
