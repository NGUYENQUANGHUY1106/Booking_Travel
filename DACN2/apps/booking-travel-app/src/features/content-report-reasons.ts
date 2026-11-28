export const CONTENT_REPORT_REASONS = {
  SPAM: "Spam hoặc quảng cáo",
  HARASSMENT: "Quấy rối hoặc xúc phạm",
  MISLEADING: "Thông tin gây hiểu nhầm",
  INAPPROPRIATE: "Nội dung không phù hợp",
  OTHER: "Lý do khác",
} as const;

export type ContentReportReason = keyof typeof CONTENT_REPORT_REASONS;
