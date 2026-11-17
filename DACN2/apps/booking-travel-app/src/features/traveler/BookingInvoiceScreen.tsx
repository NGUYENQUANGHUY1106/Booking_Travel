import { useState } from "react";
import { Platform, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { isAxiosError } from "axios";
import { useLocalSearchParams } from "expo-router";
import { downloadBookingInvoicePdf, useBookingInvoice } from "./invoice-api";
import { useTravelerStore } from "./store";
import { colors } from "./theme";
import { Button, Card, T, TravelerScaffold } from "./ui";

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(
    Number(amount),
  );
}

function errorMessage(error: unknown) {
  if (!isAxiosError(error)) return "Không thể tải chứng từ lúc này.";
  if (!error.response)
    return "Không kết nối được máy chủ. Hãy kiểm tra backend và mạng.";
  if (error.response.status === 404)
    return "Không tìm thấy booking hoặc bạn không có quyền xem.";
  const message = error.response.data?.message;
  return typeof message === "string"
    ? message
    : "Không thể tải chứng từ lúc này.";
}

export function BookingInvoiceScreen() {
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const selectedBookingId = useTravelerStore((state) => state.serverBooking?.id);
  const bookingId = params.bookingId ?? selectedBookingId;
  const invoice = useBookingInvoice(bookingId);
  const [downloadState, setDownloadState] = useState("");

  const downloadPdf = async () => {
    if (!invoice.data || !bookingId) return;
    setDownloadState("Đang tải PDF...");
    try {
      const bytes = await downloadBookingInvoicePdf(bookingId);
      if (Platform.OS === "web") {
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = invoice.data.pdfFileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, invoice.data.pdfFileName);
        file.create({ overwrite: true, intermediates: true });
        await file.write(bytes);
        await file.preview({
          title: invoice.data.invoiceNumber,
          mimeType: "application/pdf",
        });
      }
      setDownloadState("Đã mở file PDF.");
    } catch {
      setDownloadState("Không thể tải PDF trên thiết bị này.");
    }
  };

  const downloadHtml = async () => {
    if (!invoice.data) return;
    setDownloadState("Đang chuẩn bị chứng từ...");
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([invoice.data.documentHtml], {
          type: "text/html;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = invoice.data.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, invoice.data.fileName);
        file.create({ overwrite: true, intermediates: true });
        await file.write(invoice.data.documentHtml);
        await file.preview({
          title: invoice.data.invoiceNumber,
          mimeType: "text/html",
        });
      }
      setDownloadState("Đã mở chứng từ.");
    } catch {
      setDownloadState("Không thể mở file trên thiết bị này.");
    }
  };

  return (
    <TravelerScaffold title="Hóa đơn / Biên nhận" back>
      {!bookingId ? (
        <Card>
          <T accessibilityRole="alert">
            Hãy chọn một booking trước khi xem chứng từ.
          </T>
        </Card>
      ) : null}
      {invoice.isLoading ? (
        <Card>
          <T accessibilityRole="alert">
            Đang tạo chứng từ từ dữ liệu máy chủ...
          </T>
        </Card>
      ) : null}
      {invoice.error ? (
        <Card>
          <T accessibilityRole="alert" style={{ color: colors.error }}>
            {errorMessage(invoice.error)}
          </T>
          <Button label="Thử lại" onPress={() => void invoice.refetch()} />
        </Card>
      ) : null}
      {invoice.data ? (
        <>
          <Card style={{ borderWidth: 1, borderColor: colors.line }}>
            <T weight="semibold" style={{ fontSize: 18 }}>
              {invoice.data.documentType === "PAYMENT_RECEIPT"
                ? "Biên nhận thanh toán"
                : "Tóm tắt booking"}
            </T>
            <T style={{ color: colors.muted }}>{invoice.data.invoiceNumber}</T>
            <T style={{ color: colors.muted }}>
              Phát hành:{" "}
              {new Date(invoice.data.issuedAt).toLocaleString("vi-VN")}
            </T>
          </Card>
          <Card>
            <T weight="semibold" style={{ fontSize: 17 }}>
              {invoice.data.snapshot.hotel.name}
            </T>
            {invoice.data.snapshot.hotel.address ? (
              <T style={{ color: colors.muted }}>
                {invoice.data.snapshot.hotel.address}
              </T>
            ) : null}
            <View
              style={{
                height: 1,
                backgroundColor: colors.line,
                marginVertical: 8,
              }}
            />
            <T>Mã booking: {invoice.data.snapshot.booking.code}</T>
            <T>Hạng phòng: {invoice.data.snapshot.booking.roomName}</T>
            <T>
              Lưu trú: {invoice.data.snapshot.booking.checkIn} –{" "}
              {invoice.data.snapshot.booking.checkOut}
            </T>
            <T>
              {invoice.data.snapshot.booking.adults} người lớn ·{" "}
              {invoice.data.snapshot.booking.children} trẻ em ·{" "}
              {invoice.data.snapshot.booking.roomCount} phòng
            </T>
            <T>Người đại diện: {invoice.data.snapshot.guest.name}</T>
            <T>Trạng thái: {invoice.data.snapshot.booking.status}</T>
          </Card>
          <Card>
            <T weight="semibold">Thanh toán</T>
            <T
              style={{
                color: invoice.data.snapshot.payment
                  ? colors.primaryDark
                  : colors.orange,
              }}
            >
              {invoice.data.snapshot.payment
                ? "Đã ghi nhận thanh toán"
                : "Chưa có thanh toán thành công"}
            </T>
            {invoice.data.snapshot.payment ? (
              <T>
                Mã giao dịch:{" "}
                {invoice.data.snapshot.payment.reference ??
                  invoice.data.snapshot.payment.id}
              </T>
            ) : (
              <T style={{ color: colors.muted }}>
                Chứng từ hiện tại chỉ là bản tóm tắt booking, không phải biên
                nhận thanh toán.
              </T>
            )}
            <T
              weight="bold"
              style={{ color: colors.primaryDark, fontSize: 22 }}
            >
              {money(
                invoice.data.snapshot.booking.totalAmount,
                invoice.data.snapshot.booking.currency,
              )}
            </T>
          </Card>
          <Button
            label={Platform.OS === "web" ? "Tải chứng từ PDF" : "Mở file PDF"}
            onPress={() => void downloadPdf()}
          />
          <Button
            label={Platform.OS === "web" ? "Tải bản HTML" : "Mở bản HTML"}
            secondary
            onPress={() => void downloadHtml()}
          />
          {downloadState ? (
            <T
              accessibilityRole="alert"
              style={{ color: colors.muted, textAlign: "center" }}
            >
              {downloadState}
            </T>
          ) : null}
          <T style={{ color: colors.muted, fontSize: 12 }}>
            Chứng từ tóm tắt booking, không phải hóa đơn thuế điện tử và không
            chứa dữ liệu thẻ.
          </T>
        </>
      ) : null}
    </TravelerScaffold>
  );
}
