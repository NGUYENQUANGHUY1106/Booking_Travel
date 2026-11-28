import { useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
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
} from "../shared/ui";
import {
  useAdminHotelReport,
  useAdminHotelReports,
  type AdminHotelReport,
} from "./api";

const reasonLabels: Record<string, string> = {
  INCORRECT_INFORMATION: "ThÃ´ng tin khÃ´ng Ä‘Ãºng",
  MISLEADING_IMAGES: "HÃ¬nh áº£nh gÃ¢y hiá»ƒu nháº§m",
  FRAUD: "Dáº¥u hiá»‡u gian láº­n",
  SAFETY: "An toÃ n lÆ°u trÃº",
  OTHER: "LÃ½ do khÃ¡c",
};
const statusLabels: Record<string, string> = {
  OPEN: "Má»Ÿ",
  IN_REVIEW: "Äang xem xÃ©t",
  RESOLVED: "ÄÃ£ xá»­ lÃ½",
  REJECTED: "ÄÃ£ bÃ¡c bá»",
};

export function ReportsScreen({ kind }: { kind: "REVIEW" | "REPORT" }) {
  if (kind === "REPORT") return <LiveHotelReportsScreen />;
  return <LiveReviewModerationScreen />;
}

function LiveReviewModerationScreen() {
  type Review = { id: string; rating: number; content: string; isVisible: boolean; author: { fullName: string }; hotel: { name: string }; reply: { content: string; isVisible: boolean; reports: { id: string; reason: string }[] } | null };
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ['admin-reviews'], queryFn: async () => (await apiClient.get<Review[]>('/admin/reviews')).data });
  const [error, setError] = useState('');
  const change = async (id: string, reply: boolean, visible: boolean) => {
    setError('');
    try {
      await apiClient.patch(`/admin/reviews/${id}${reply ? '/reply' : ''}/visibility`, { visible });
      await queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    } catch { setError('KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c tráº¡ng thÃ¡i. Thá»­ láº¡i.'); }
  };
  return <AdminPage title="Kiá»ƒm duyá»‡t Ä‘Ã¡nh giÃ¡">
    {reviews.isPending ? <ActivityIndicator /> : null}
    {reviews.isError ? <AdminButton label="Thá»­ láº¡i" onPress={() => void reviews.refetch()} /> : null}
    {error ? <AdminText>{error}</AdminText> : null}
    {reviews.data?.length === 0 ? <AdminCard><AdminText>ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡.</AdminText></AdminCard> : null}
    {reviews.data?.map((review) => <AdminCard key={review.id} title={`${review.hotel.name} Â· ${review.rating}/10`}>
      <AdminText>KhÃ¡ch: {review.author.fullName}</AdminText>
      <AdminText>{review.content}</AdminText>
      <AdminText>ÄÃ¡nh giÃ¡: {review.isVisible ? 'CÃ´ng khai' : 'ÄÃ£ áº©n'}</AdminText>
      <AdminButton label={review.isVisible ? 'áº¨n Ä‘Ã¡nh giÃ¡' : 'KhÃ´i phá»¥c Ä‘Ã¡nh giÃ¡'} onPress={() => void change(review.id, false, !review.isVisible)} />
      {review.reply ? <><AdminText>Pháº£n há»“i tá»« khÃ¡ch sáº¡n: {review.reply.content}</AdminText><AdminText>Pháº£n há»“i: {review.reply.isVisible ? 'CÃ´ng khai' : 'ÄÃ£ áº©n'}</AdminText>{review.reply.reports.map((report) => <AdminText key={report.id}>Báo cáo: {report.reason}</AdminText>)}<AdminButton label={review.reply.isVisible ? 'áº¨n pháº£n há»“i' : 'KhÃ´i phá»¥c pháº£n há»“i'} onPress={() => void change(review.id, true, !review.reply!.isVisible)} /></> : null}
    </AdminCard>)}
  </AdminPage>;
}

function LiveHotelReportsScreen() {
  const session = useTravelerStore((state) => state.session);
  const reports = useAdminHotelReports();
  return (
    <AdminPage
      title="BÃ¡o cÃ¡o khÃ¡ch sáº¡n"
      subtitle="BÃ¡o cÃ¡o tháº­t tá»« khÃ¡ch Ä‘Ã£ hoÃ n thÃ nh ká»³ lÆ°u trÃº, gá»­i trá»±c tiáº¿p Ä‘áº¿n Admin tá»•ng."
    >
      {session?.mode !== "api" || session.role !== "ADMIN" ? (
        <AdminCard>
          <AdminText>
            ÄÄƒng nháº­p tÃ i khoáº£n Admin tá»•ng Ä‘á»ƒ xem hÃ ng Ä‘á»£i tháº­t.
          </AdminText>
        </AdminCard>
      ) : reports.isPending ? (
        <ActivityIndicator />
      ) : reports.isError ? (
        <AdminCard>
          <AdminText>KhÃ´ng táº£i Ä‘Æ°á»£c hÃ ng Ä‘á»£i bÃ¡o cÃ¡o.</AdminText>
          <AdminButton label="Thá»­ láº¡i" onPress={() => void reports.refetch()} />
        </AdminCard>
      ) : (
        <AdminCard title={`HÃ ng Ä‘á»£i Â· ${reports.data?.length ?? 0} bÃ¡o cÃ¡o`}>
          {reports.data?.length ? (
            reports.data.map((report) => (
              <AdminRow
                key={report.id}
                title={report.hotel.name}
                subtitle={`${reasonLabels[report.reason] ?? report.reason} Â· Booking ${report.booking.code} Â· ${new Date(report.createdAt).toLocaleString("vi-VN")}`}
                status={statusLabels[report.status] ?? report.status}
                onPress={() => openAdminDetail("reports", report.id)}
              />
            ))
          ) : (
            <AdminText>ChÆ°a cÃ³ bÃ¡o cÃ¡o khÃ¡ch sáº¡n.</AdminText>
          )}
        </AdminCard>
      )}
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
        <AdminPage title="Chi tiáº¿t bÃ¡o cÃ¡o">
          <ActivityIndicator />
        </AdminPage>
      );
    if (live.isError || !live.data)
      return (
        <AdminPage title="Chi tiáº¿t bÃ¡o cÃ¡o">
          <AdminCard>
            <AdminText>KhÃ´ng tÃ¬m tháº¥y hoáº·c khÃ´ng táº£i Ä‘Æ°á»£c bÃ¡o cÃ¡o.</AdminText>
            <AdminButton label="Thá»­ láº¡i" onPress={() => void live.refetch()} />
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
      title="Chi tiáº¿t bÃ¡o cÃ¡o"
      subtitle="Danh tÃ­nh ngÆ°á»i bÃ¡o cÃ¡o chá»‰ hiá»ƒn thá»‹ cho Admin tá»•ng."
    >
      <AdminCard title={report.hotel.name}>
        <AdminText>{reasonLabels[report.reason] ?? report.reason}</AdminText>
        <AdminText>{report.description}</AdminText>
        <AdminText>
          Tráº¡ng thÃ¡i: {statusLabels[report.status] ?? report.status}
        </AdminText>
        <AdminText>
          Gá»­i lÃºc: {new Date(report.createdAt).toLocaleString("vi-VN")}
        </AdminText>
      </AdminCard>
      <AdminCard title="Booking Ä‘Ã£ Ä‘á»‘i chiáº¿u">
        <AdminText>
          {report.booking.code} Â· {report.booking.roomNameSnapshot}
        </AdminText>
        <AdminText>
          {report.booking.checkIn.slice(0, 10)} â†’{" "}
          {report.booking.checkOut.slice(0, 10)}
        </AdminText>
        <AdminText>Tráº¡ng thÃ¡i booking: {report.booking.status}</AdminText>
      </AdminCard>
      <AdminCard title="NgÆ°á»i bÃ¡o cÃ¡o (chá»‰ Admin)">
        <AdminText>{report.reporter.fullName}</AdminText>
        <AdminText>
          {report.reporter.email ?? report.reporter.phone ?? report.reporter.id}
        </AdminText>
      </AdminCard>
      <AdminCard title="Báº±ng chá»©ng">
        <AdminText>
          {report.evidenceUrls.length
            ? report.evidenceUrls.join("\n")
            : "KhÃ´ng Ä‘Ã­nh kÃ¨m báº±ng chá»©ng."}
        </AdminText>
      </AdminCard>
      <AdminCard>
        <AdminText>
          Viá»‡c duyá»‡t, bÃ¡c bá» hoáº·c Ã¡p dá»¥ng biá»‡n phÃ¡p vá»›i khÃ¡ch sáº¡n thuá»™c task
          ST-ADM-08; mÃ n hÃ¬nh nÃ y khÃ´ng tá»± thay Ä‘á»•i tráº¡ng thÃ¡i khÃ¡ch sáº¡n.
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
      <AdminPage title="Chi tiáº¿t bÃ¡o cÃ¡o">
        <AdminCard>
          <AdminText>KhÃ´ng tÃ¬m tháº¥y bÃ¡o cÃ¡o.</AdminText>
        </AdminCard>
      </AdminPage>
    );
  const openDecision = (next: "resolve" | "reject") => {
    if (report.status === "OPEN")
      mockReportService.update(report.id, { status: "IN_REVIEW" });
    setDecision(next);
  };
  return (
    <AdminPage title="Chi tiáº¿t bÃ¡o cÃ¡o">
      <AdminCard title={`BÃ¡o cÃ¡o khÃ¡ch sáº¡n ${hotel?.name}`}>
        <AdminText>{report.reason}</AdminText>
        <AdminText>Tráº¡ng thÃ¡i: {report.status}</AdminText>
      </AdminCard>
      <AdminCard title="Báº±ng chá»©ng cáº§n kiá»ƒm tra">
        <AdminText>{report.evidence}</AdminText>
      </AdminCard>
      {(report.status === "OPEN" || report.status === "IN_REVIEW") && (
        <>
          <AdminButton
            label="Ra quyáº¿t Ä‘á»‹nh bÃ¡o cÃ¡o"
            onPress={() => openDecision("resolve")}
            style={{ width: 340 }}
          />
          <AdminButton
            label="BÃ¡c bá» bÃ¡o cÃ¡o"
            variant="outline"
            onPress={() => openDecision("reject")}
            style={{ width: 340 }}
          />
        </>
      )}
      <AdminDecisionDialog
        visible={decision !== null}
        title="Ra quyáº¿t Ä‘á»‹nh bÃ¡o cÃ¡o"
        target={`BÃ¡o cÃ¡o khÃ¡ch sáº¡n ${hotel?.name}`}
        evidence={report.evidence}
        reasonRequired
        confirmLabel="XÃ¡c nháº­n xá»­ lÃ½"
        danger={decision === "reject"}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => {
          mockReportService.update(report.id, {
            status: decision === "resolve" ? "RESOLVED" : "REJECTED",
          });
          appendMockAudit("Xá»­ lÃ½ bÃ¡o cÃ¡o", hotel?.name ?? report.id, reason);
          setDecision(null);
        }}
      />
    </AdminPage>
  );
}
