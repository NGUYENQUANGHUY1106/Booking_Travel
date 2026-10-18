"""Capture Admin Expo Web screens for direct Figma comparison.

Requires local Chrome and a running Expo Web server with EXPO_PUBLIC_ENABLE_ADMIN_DEMO=true.
For stable screenshots, serve a production export through admin-static-server.py.
"""

import base64
import argparse
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket


PORT = 19006
DEBUG_PORT = 19222
ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "artifacts"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
SCREENS = [
    ("01-login", "/auth/admin-demo", "Đăng nhập quản trị"),
    ("02-dashboard", "/admin", "Tổng quan hệ thống"),
    ("03-users", "/admin/users", "Quản lý người dùng"),
    ("04-user-detail", "/admin/detail/users?id=user-quang", "Chi tiết người dùng"),
    ("05-owner-queue", "/admin/owner-verification", "Hồ sơ chủ khách sạn"),
    ("06-owner-detail", "/admin/detail/owner-verification?id=verify-an", "Chi tiết hồ sơ xác minh"),
    ("07-accommodation-queue", "/admin/hotel-moderation", "Chỗ ở chờ duyệt"),
    ("08-accommodation-detail", "/admin/detail/hotel-moderation?id=hotel-blue", "Blue Horizon My Khe Hotel"),
    ("09-hotels", "/admin/hotels", "Quản lý khách sạn"),
    ("10-hotel-detail", "/admin/detail/hotels?id=hotel-blue", "Chi tiết khách sạn"),
    ("11-bookings", "/admin/bookings", "Giám sát đặt phòng"),
    ("12-booking-detail", "/admin/detail/bookings?id=BT-2027-DN-00128", "Chi tiết đặt phòng"),
    ("13-payments", "/admin/payments", "Thanh toán và hoàn tiền"),
    ("14-payment-detail", "/admin/detail/payments?id=PAY-2027-DN-00128", "Chi tiết giao dịch"),
    ("15-reviews", "/admin/reviews", "Kiểm duyệt đánh giá"),
    ("16-reports", "/admin/reports", "Quản lý báo cáo"),
    ("17-report-detail", "/admin/detail/reports?id=report-blue", "Chi tiết báo cáo"),
    ("18-promotions", "/admin/promotions", "Ưu đãi và mã giảm giá"),
    ("19-voucher", "/admin/voucher", "Tạo mã ưu đãi"),
    ("20-analytics", "/admin/analytics", "Phân tích hệ thống"),
    ("21-fraud", "/admin/fraud", "Cảnh báo giao dịch bất thường"),
    ("22-fraud-detail", "/admin/detail/fraud?id=fraud-117", "Chi tiết cảnh báo"),
    ("23-audit", "/admin/audit", "Nhật ký hệ thống"),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=768)
    args = parser.parse_args()
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="booking-admin-chrome-") as profile:
        process = subprocess.Popen([
            str(CHROME), "--headless=new", "--disable-gpu", "--no-first-run",
            "--remote-allow-origins=*", f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={profile}", "about:blank",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(50):
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/version"):
                        break
                except Exception:
                    time.sleep(0.2)
            req = urllib.request.Request(f"http://127.0.0.1:{DEBUG_PORT}/json/new?about:blank", method="PUT")
            with urllib.request.urlopen(req) as response:
                tab = json.load(response)
            ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
            try:
                run_screens(ws, args.width, args.height)
            finally:
                ws.close()
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


def command(ws, method, params=None):
    command.counter += 1
    request_id = command.counter
    ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == request_id:
            if "error" in message:
                raise RuntimeError(message["error"])
            return message.get("result", {})


command.counter = 0


def evaluate(ws, expression):
    result = command(ws, "Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    if "exceptionDetails" in result:
        raise RuntimeError(result["exceptionDetails"])
    return result.get("result", {}).get("value")


def navigate(ws, path, expected):
    command(ws, "Page.navigate", {"url": f"http://localhost:{PORT}{path}"})
    for _ in range(100):
        body = evaluate(ws, "document.body ? document.body.innerText : ''") or ""
        if expected in body:
            return body
        time.sleep(0.15)
    raise AssertionError(f"Missing {expected!r} at {path}; location={evaluate(ws, 'location.href')}; body={body[:500]!r}")


def screenshot(ws, name, width):
    time.sleep(0.4)
    data = command(ws, "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})["data"]
    (OUTPUT / f"{name}-{width}.png").write_bytes(base64.b64decode(data))


def click_button(ws, label):
    script = """(() => {const el=[...document.querySelectorAll('[role=button]')].filter(el=>el.getAttribute('aria-label')===%s || el.innerText?.trim()===%s).at(-1); if(!el) return false; el.click(); return true;})()""" % (json.dumps(label), json.dumps(label))
    assert evaluate(ws, script), f"Button missing: {label}"


def click_button_containing(ws, text):
    script = """(() => {const el=[...document.querySelectorAll('[role=button]')].find(el=>el.innerText?.includes(%s)); if(!el) return false; el.click(); return true;})()""" % json.dumps(text)
    assert evaluate(ws, script), f"Button missing text: {text}"


def set_input(ws, selector, value):
    script = """(() => {const el=document.querySelector(%s); if(!el) return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,%s); el.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""" % (json.dumps(selector), json.dumps(value))
    assert evaluate(ws, script), selector


def wait_text(ws, text):
    for _ in range(50):
        if text in (evaluate(ws, "document.body.innerText") or ""):
            return
        time.sleep(0.1)
    raise AssertionError(f"Missing text after action: {text}")


def run_screens(ws, width, height):
    command(ws, "Page.enable")
    command(ws, "Runtime.enable")
    command(ws, "Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
    navigate(ws, SCREENS[0][1], SCREENS[0][2])
    screenshot(ws, SCREENS[0][0], width)
    for selector, value in [("input[aria-label='Email Admin demo']", "admin@bookingtravel.vn"), ("input[aria-label='Mật khẩu Admin demo']", "admin123")]:
        set_input(ws, selector, value)
    click_button(ws, "Đăng nhập")
    for _ in range(50):
        if evaluate(ws, "location.pathname") == "/admin":
            break
        time.sleep(0.1)
    if evaluate(ws, "location.pathname") != "/admin":
        raise AssertionError("Admin login did not reach /admin")
    click_button(ws, "Người dùng")
    wait_text(ws, "Quản lý người dùng")
    for name, path, expected in SCREENS[1:]:
        navigate(ws, path, expected)
        if width == 1024 or name in {"02-dashboard", "07-accommodation-queue", "08-accommodation-detail", "19-voucher", "21-fraud"}:
            screenshot(ws, name, width)
        print(name, path)

    navigate(ws, "/admin", "Tổng quan hệ thống")
    click_button(ws, "Xem nhật ký")
    wait_text(ws, "Nhật ký hệ thống")
    navigate(ws, "/admin", "Tổng quan hệ thống")
    click_button(ws, "3 Xác minh chủ khách sạn")
    wait_text(ws, "Hồ sơ chủ khách sạn")

    navigate(ws, "/admin/hotel-moderation", "24 hồ sơ chờ duyệt")
    click_button(ws, "Resort")
    wait_text(ws, "4 hồ sơ Resort chờ duyệt")
    if width == 1024: screenshot(ws, "07-resort-filter", width)
    click_button(ws, "Khách sạn")
    wait_text(ws, "14 hồ sơ · Khách sạn + Resort")
    if width == 1024: screenshot(ws, "07-hotel-resort-filter", width)

    navigate(ws, "/admin/detail/users?id=user-quang", "Chi tiết người dùng")
    click_button(ws, "Xem quyết định đình chỉ")
    wait_text(ws, "Xác nhận đình chỉ người dùng")
    if width == 1024: screenshot(ws, "04-suspend-confirm", width)
    click_button(ws, "Xác nhận đình chỉ")
    wait_text(ws, "Vui lòng nhập lý do quyết định.")
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Vi phạm chính sách sử dụng")
    click_button(ws, "Xác nhận đình chỉ")
    wait_text(ws, "Khôi phục tài khoản")
    click_button(ws, "Nhật ký")
    wait_text(ws, "Đình chỉ người dùng")
    click_button(ws, "Người dùng")
    wait_text(ws, "Quản lý người dùng")
    click_button(ws, "Đình chỉ")
    wait_text(ws, "Nguyễn Phan Nhật Quang")
    navigate(ws, "/admin/detail/owner-verification?id=verify-an", "Chi tiết hồ sơ xác minh")
    click_button(ws, "Phê duyệt hồ sơ")
    if width == 1024: screenshot(ws, "06-owner-approval", width)
    click_button(ws, "Phê duyệt hồ sơ")
    wait_text(ws, "VERIFIED")
    click_button(ws, "Xác minh chủ KS")
    wait_text(ws, "Hồ sơ chủ khách sạn")
    click_button_containing(ws, "Sun Coast Resort")
    wait_text(ws, "Chi tiết hồ sơ xác minh")
    click_button(ws, "Từ chối hồ sơ")
    if width == 1024: screenshot(ws, "06-owner-rejection", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Tài liệu xác minh chưa hợp lệ")
    click_button(ws, "Xác nhận từ chối")
    wait_text(ws, "REJECTED")
    click_button(ws, "Xác minh chủ KS")
    wait_text(ws, "Không có yêu cầu đang chờ")
    if width == 1024: screenshot(ws, "05-owner-empty", width)

    navigate(ws, "/admin/detail/hotel-moderation?id=hotel-blue", "Blue Horizon My Khe Hotel")
    click_button(ws, "Duyệt chỗ ở")
    if width == 1024: screenshot(ws, "08-hotel-decision", width)
    click_button(ws, "Xác nhận duyệt")
    wait_text(ws, "APPROVED")
    click_button(ws, "Xem quản lý chỗ ở")
    wait_text(ws, "Chi tiết khách sạn")
    click_button(ws, "Xem đình chỉ khách sạn")
    if width == 1024: screenshot(ws, "10-hotel-suspension", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Mô tả không khớp bằng chứng")
    click_button(ws, "Xác nhận đình chỉ")
    wait_text(ws, "SUSPENDED")
    click_button(ws, "Khôi phục khách sạn")
    if width == 1024: screenshot(ws, "10-hotel-restore", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Đã xác minh ảnh và chính sách cập nhật")
    click_button(ws, "Xác nhận khôi phục")
    wait_text(ws, "APPROVED")
    navigate(ws, "/admin/detail/hotel-moderation?id=resort-sun", "Sun Coast Resort")
    click_button(ws, "Từ chối · cần lý do")
    if width == 1024: screenshot(ws, "08-hotel-rejection", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Loại chỗ ở không khớp hình ảnh")
    click_button(ws, "Từ chối với lý do")
    wait_text(ws, "REJECTED")

    navigate(ws, "/admin/detail/payments?id=PAY-2027-DN-00128", "Chi tiết giao dịch")
    click_button(ws, "Tra soát hoàn tiền một phần")
    if width == 1024: screenshot(ws, "14-partial-refund", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Đối chiếu phí không hoàn lại")
    click_button(ws, "Ghi nhận tra soát minh họa")
    wait_text(ws, "PARTIALLY_REFUNDED")

    navigate(ws, "/admin/detail/reports?id=report-blue", "Chi tiết báo cáo")
    click_button(ws, "Ra quyết định báo cáo")
    if width == 1024: screenshot(ws, "17-report-decision", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Đã đối chiếu ảnh và trao đổi")
    click_button(ws, "Xác nhận xử lý")
    wait_text(ws, "RESOLVED")

    navigate(ws, "/admin/detail/fraud?id=fraud-117", "Chi tiết cảnh báo")
    click_button(ws, "Đánh dấu đã xem xét")
    if width == 1024: screenshot(ws, "22-fraud-reviewed", width)
    set_input(ws, "input[aria-label='Lý do quyết định (bắt buộc)']", "Đã rà soát tín hiệu, chưa xác định gian lận")
    click_button(ws, "Đánh dấu đã xem xét")
    wait_text(ws, "Đã xem xét")

    navigate(ws, "/admin/voucher", "Tạo mã ưu đãi")
    click_button(ws, "Lưu mã ưu đãi")
    wait_text(ws, "Vui lòng điền đủ các trường bắt buộc.")
    for label, value in [("Mã ưu đãi *", "AUTUMN15"), ("Giá trị giảm *", "15"), ("Giảm tối đa *", "500000"), ("Giới hạn sử dụng *", "50")]:
        set_input(ws, f"input[aria-label='{label}']", value)
    click_button(ws, "Lưu mã ưu đãi")
    wait_text(ws, "AUTUMN15")
    navigate(ws, "/admin/voucher?id=voucher-travel12", "Chỉnh sửa mã ưu đãi")
    wait_text(ws, "TRAVEL12")
    navigate(ws, "/admin/voucher", "Tạo mã ưu đãi")
    for label, value in [("Mã ưu đãi *", "TRAVEL12"), ("Giá trị giảm *", "10"), ("Giảm tối đa *", "300000"), ("Giới hạn sử dụng *", "20")]:
        set_input(ws, f"input[aria-label='{label}']", value)
    click_button(ws, "Lưu mã ưu đãi")
    wait_text(ws, "Mã ưu đãi đã tồn tại.")
    set_input(ws, "input[aria-label='Mã ưu đãi *']", "WINTER10")
    set_input(ws, "input[aria-label='Kết thúc (YYYY-MM-DD) *']", "2026-10-01")
    click_button(ws, "Lưu mã ưu đãi")
    wait_text(ws, "Khoảng ngày hiệu lực không hợp lệ.")
    navigate(ws, "/admin/users?demoState=error", "Không thể tải dữ liệu")
    click_button(ws, "Thử lại")
    wait_text(ws, "Tìm người dùng")
    navigate(ws, "/admin/users?demoState=empty", "Không có dữ liệu phù hợp.")
    navigate(ws, "/admin/users?demoState=loading", "Quản lý người dùng")
    print("Interaction checks: filters, decisions, audit, refund, report, fraud and voucher passed")


if __name__ == "__main__":
    main()
