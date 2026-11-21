export function voucherErrorMessage(code?: string): string | null {
  switch (code) {
    case "VOUCHER_INVALID":
      return "Mã ưu đãi không tồn tại hoặc không hợp lệ.";
    case "VOUCHER_INACTIVE":
      return "Chương trình ưu đãi chưa kích hoạt hoặc đã kết thúc.";
    case "VOUCHER_EXPIRED":
      return "Mã ưu đãi đã hết hạn.";
    case "VOUCHER_EXHAUSTED":
      return "Mã ưu đãi đã hết lượt hoặc ngân sách.";
    case "VOUCHER_USER_LIMIT":
      return "Bạn đã dùng hết số lượt áp dụng mã ưu đãi này.";
    case "VOUCHER_HOTEL_INELIGIBLE":
      return "Mã ưu đãi không áp dụng cho khách sạn này.";
    case "VOUCHER_USER_INELIGIBLE":
      return "Tài khoản của bạn không thuộc phạm vi áp dụng mã ưu đãi.";
    case "VOUCHER_MINIMUM_NOT_MET":
      return "Đơn đặt phòng chưa đạt điều kiện tối thiểu của mã ưu đãi.";
    case "VOUCHER_MINIMUM_NIGHTS":
      return "Số đêm lưu trú chưa đạt điều kiện áp dụng mã ưu đãi.";
    case "VOUCHER_CHANGED":
      return "Ưu đãi đã thay đổi. Vui lòng lấy báo giá mới.";
    default:
      return null;
  }
}
