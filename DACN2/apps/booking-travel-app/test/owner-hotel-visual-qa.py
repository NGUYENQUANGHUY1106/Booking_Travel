"""Smoke ST-OWN-04 Expo Web at mobile widths against the seeded local API.

Run API, export Expo Web, then set OWN_QA_EMAIL / OWN_QA_PASSWORD and execute this script.
The script creates and deletes its own draft; screenshots go to a temporary directory.
"""

import importlib.util
import json
import os
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import websocket


ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("admin_visual_qa", ROOT / "admin-visual-qa.py")
assert SPEC and SPEC.loader
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)
qa.PORT = 19007
qa.DEBUG_PORT = 19223


def color_png(red, green, blue):
    def chunk(kind, data):
        payload = kind + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xffffffff)

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    pixel = zlib.compress(bytes([0, red, green, blue]))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixel) + chunk(b"IEND", b"")


class FallbackHandler(SimpleHTTPRequestHandler):
    export_dir: Path

    def do_GET(self):
        relative = unquote(urlsplit(self.path).path).lstrip("/")
        if not (self.export_dir / relative).is_file():
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], ConnectionResetError):
            return
        super().handle_error(request, client_address)


def api(path, bearer=None, data=None, method=None):
    headers = {"Content-Type": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    request = urllib.request.Request(
        f"http://localhost:3000/api{path}",
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
        method=method or ("POST" if data is not None else "GET"),
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response) if response.status != 204 else None


def main():
    export_dir = Path(os.environ["OWN_QA_EXPORT_DIR"]).resolve()
    if not (export_dir / "index.html").is_file():
        raise RuntimeError("Chưa có Expo Web export ở OWN_QA_EXPORT_DIR.")
    login = api("/auth/login", data={"identifier": os.environ["OWN_QA_EMAIL"], "password": os.environ["OWN_QA_PASSWORD"]})
    if login["user"]["role"] != "HOTEL_OWNER":
        raise RuntimeError("Tài khoản kiểm thử không có quyền Chủ khách sạn.")
    token = login["accessToken"]
    user = login["user"]
    existing_hotels = api("/owner/hotels", token)
    before_ids = {item["id"] for item in existing_hotels}
    unique_name = f"QA OWN04 {int(time.time())}"
    qa.OUTPUT = Path(tempfile.mkdtemp(prefix="st-own-04-qa-"))

    FallbackHandler.export_dir = export_dir
    server = QuietServer(("127.0.0.1", qa.PORT), partial(FallbackHandler, directory=str(export_dir)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    created_id = None
    created_room_id = None
    media_ids = []
    try:
        with tempfile.TemporaryDirectory(prefix="st-own-04-chrome-") as profile:
            process = subprocess.Popen([
                str(qa.CHROME), "--headless=new", "--disable-gpu", "--no-first-run",
                "--remote-allow-origins=*", f"--remote-debugging-port={qa.DEBUG_PORT}",
                f"--user-data-dir={profile}", "about:blank",
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(50):
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{qa.DEBUG_PORT}/json/version"):
                            break
                    except Exception:
                        time.sleep(0.2)
                request = urllib.request.Request(f"http://127.0.0.1:{qa.DEBUG_PORT}/json/new?about:blank", method="PUT")
                with urllib.request.urlopen(request) as response:
                    tab = json.load(response)
                ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
                try:
                    qa.command(ws, "Page.enable")
                    qa.command(ws, "Runtime.enable")
                    qa.navigate(ws, "/auth/login", "Đăng nhập")
                    session = {
                        "mode": "api", "userId": user["id"], "email": user["email"],
                        "role": "HOTEL_OWNER", "accessToken": token,
                        "refreshToken": login["refreshToken"], "sessionId": login["sessionId"],
                    }
                    persisted = json.dumps({"state": {"session": session}, "version": 0})
                    qa.evaluate(ws, "localStorage.setItem('booking-travel-user-mock-v1'," + json.dumps(persisted) + ")")

                    for width in (320, 360, 375, 390, 412, 430, 768):
                        qa.command(ws, "Emulation.setDeviceMetricsOverride", {
                            "width": width, "height": 844, "deviceScaleFactor": 1, "mobile": False,
                        })
                        qa.navigate(ws, "/hotel-owner/hotels", "Chỗ ở của tôi")
                        qa.assert_no_page_overflow(ws, width)
                        if width in (320, 390):
                            qa.screenshot(ws, "owner-hotels", width)

                    approved = next((item for item in existing_hotels if item["status"] == "APPROVED"), None)
                    if approved:
                        qa.command(ws, "Emulation.setDeviceMetricsOverride", {
                            "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": False,
                        })
                        qa.navigate(ws, f"/hotel-owner/screen/hotel-detail?hotelId={approved['id']}", "Chi tiết chỗ ở")
                        qa.assert_no_page_overflow(ws, 390)
                        qa.screenshot(ws, "approved-detail", 390)

                    for width in (320, 360, 375, 390, 412, 430, 768):
                        qa.command(ws, "Emulation.setDeviceMetricsOverride", {
                            "width": width, "height": 844, "deviceScaleFactor": 1, "mobile": False,
                        })
                        qa.navigate(ws, "/hotel-owner/screen/hotel-basic", "Tạo chỗ ở · cơ bản")
                        qa.wait_text(ws, "Loại chỗ ở")
                        qa.assert_no_page_overflow(ws, width)
                        if width in (320, 390):
                            qa.screenshot(ws, "basic-empty", width)
                    qa.command(ws, "Emulation.setDeviceMetricsOverride", {
                        "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": False,
                    })
                    qa.set_input(ws, "input[aria-label='Tên chỗ ở *']", unique_name)
                    qa.click_button(ws, "Lưu & tiếp tục")
                    qa.wait_text(ws, "Vui lòng chọn loại chỗ ở.")
                    qa.screenshot(ws, "basic-validation", 390)
                    selected = qa.evaluate(ws, "(() => { const el=document.querySelector('[role=radio][aria-label=\"Resort\"]'); if (!el) return false; el.click(); return true; })()")
                    assert selected, "Không tìm thấy ô Resort."
                    qa.wait_text(ws, "Đã lưu bản nháp")
                    qa.screenshot(ws, "basic-saved", 390)
                    created = [item for item in api("/owner/hotels", token) if item["id"] not in before_ids and item["name"] == unique_name]
                    assert len(created) == 1, f"Phải có đúng một bản nháp: {len(created)}"
                    created_id = created[0]["id"]
                    assert created[0]["accommodationType"] == "RESORT"
                    assert created[0]["status"] == "DRAFT"
                    qa.click_button(ws, "Lưu & tiếp tục")
                    qa.wait_text(ws, "Tạo khách sạn · vị trí")
                    qa.screenshot(ws, "location-empty", 390)
                    provinces = api("/addresses/catalog/provinces?mode=CURRENT")
                    province = provinces[0]
                    ward = api(f"/addresses/catalog/provinces/{province['id']}/communes")[0]
                    saved_location = api(f"/owner/hotels/{created_id}/location", token, {
                        "expectedVersion": created[0]["profileVersion"],
                        "addressLine": "123 Đường Biển", "provinceUnitId": province["id"],
                        "wardUnitId": ward["id"], "latitude": 16.0544, "longitude": 108.2022,
                    }, method="PATCH")
                    assert saved_location["completion"]["location"] is True
                    qa.navigate(ws, f"/hotel-owner/screen/hotel-media?hotelId={created_id}", "Tạo chỗ ở · hình ảnh")
                    qa.screenshot(ws, "media-empty", 390)
                    for red, green, blue in ((239, 68, 68), (34, 197, 94), (59, 130, 246)):
                        contents = color_png(red, green, blue)
                        reserved = api(f"/owner/hotels/{created_id}/media/presign", token, {"mimeType": "image/png", "sizeBytes": len(contents)})
                        media_ids.append(reserved["mediaId"])
                        put_url = reserved["uploadUrl"]
                        if put_url.startswith("/"):
                            put_url = "http://localhost:3000" + put_url
                        upload = urllib.request.Request(put_url, data=contents, headers={"Content-Type": "image/png"}, method="PUT")
                        with urllib.request.urlopen(upload) as response:
                            assert response.status == 204
                        api(f"/owner/hotels/{created_id}/media/finalize", token, {"mediaId": reserved["mediaId"]})
                    with_media = api(f"/owner/hotels/{created_id}", token)
                    with_media = api(f"/owner/hotels/{created_id}/media/cover", token, {"expectedVersion": with_media["profileVersion"], "mediaId": media_ids[1]}, method="PATCH")
                    assert len(with_media["gallery"]) == 3
                    assert next(item["id"] for item in with_media["gallery"] if item["isCover"]) == media_ids[1]
                    qa.navigate(ws, f"/hotel-owner/screen/hotel-media?hotelId={created_id}", "Tạo chỗ ở · hình ảnh")
                    qa.screenshot(ws, "media-gallery", 390)
                    qa.navigate(ws, "/hotel-owner/hotels", "Chỗ ở của tôi")
                    qa.screenshot(ws, "owner-hotels-cover", 390)
                    qa.navigate(ws, f"/hotel-owner/screen/hotel-amenities?hotelId={created_id}", "Tạo chỗ ở · tiện ích")
                    qa.wait_text(ws, "Liên hệ và giờ nhận/trả")
                    qa.set_input(ws, "input[aria-label='Email liên hệ']", "qa-own04@example.com")
                    qa.set_input(ws, "input[aria-label='Giờ nhận phòng (HH:mm)']", "14:00")
                    qa.set_input(ws, "input[aria-label='Giờ trả phòng (HH:mm)']", "12:00")
                    changed_policy = qa.evaluate(ws, """(() => {const el=document.querySelector('textarea[aria-label="Chính sách hủy"]'); if (!el) return false; const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; setter.call(el,'Hủy trước 48 giờ'); el.dispatchEvent(new Event('input',{bubbles:true})); return true;})()""")
                    assert changed_policy, "Không tìm thấy ô chính sách hủy."
                    qa.screenshot(ws, "amenities-policy", 390)
                    qa.click_button(ws, "Lưu & tiếp tục")
                    qa.wait_text(ws, "Kiểm tra và gửi duyệt")
                    qa.screenshot(ws, "review-incomplete", 390)
                    reloaded = api(f"/owner/hotels/{created_id}", token)
                    assert reloaded["contactEmail"] == "qa-own04@example.com"
                    assert reloaded["completion"]["contact"] is True
                    assert reloaded["policy"]["cancellationPolicy"] == "Hủy trước 48 giờ"
                    assert reloaded["completion"]["policy"] is True
                    qa.assert_no_page_overflow(ws, 390)
                    qa.navigate(ws, f"/hotel-owner/screen/room-edit?hotelId={created_id}", "Thêm hạng phòng")
                    qa.click_button(ws, "Chọn hạng phòng")
                    qa.click_button(ws, "Deluxe")
                    qa.click_button(ws, "Không có hướng nhìn cụ thể")
                    qa.click_button(ws, "Hướng biển")
                    qa.click_button(ws, "+ Thêm loại giường")
                    qa.click_button(ws, "1 King")
                    qa.set_input(ws, "input[aria-label='Diện tích (m²)']", "32")
                    qa.set_input(ws, "input[aria-label='Số khách người lớn']", "2")
                    qa.set_input(ws, "input[aria-label='Tổng số phòng cùng hạng']", "10")
                    qa.set_input(ws, "input[aria-label='Giá cơ bản (VND / đêm)']", "1450000")
                    qa.wait_text(ws, "DLX-SEA-KING")
                    qa.assert_no_page_overflow(ws, 390)
                    qa.screenshot(ws, "room-editor", 390)
                    qa.click_button(ws, "Lưu hạng phòng")
                    qa.wait_text(ws, "Kiểm tra và gửi duyệt")
                    saved_rooms = api(f"/hotels/{created_id}/rooms", token)
                    assert len(saved_rooms) == 1
                    created_room_id = saved_rooms[0]["id"]
                    assert saved_rooms[0]["type"] == "DLX-SEA-KING"
                    assert saved_rooms[0]["quantity"] == 10
                    assert saved_rooms[0]["bedConfigurations"] == [{"bedType": "KING", "quantity": 1}]
                    ready = api(f"/owner/hotels/{created_id}", token)
                    assert ready["readyForReview"] is True
                    qa.navigate(ws, f"/hotel-owner/screen/rooms?hotelId={created_id}", "Hạng phòng")
                    qa.wait_text(ws, "Deluxe")
                    qa.screenshot(ws, "room-list", 390)
                    qa.navigate(ws, f"/hotel-owner/screen/hotel-detail?hotelId={created_id}", "Chi tiết chỗ ở")
                    qa.screenshot(ws, "owner-detail", 390)
                    print("PASS ST-OWN-04 web smoke", created_id, flush=True)
                finally:
                    ws.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
    finally:
        if created_room_id:
            api(f"/rooms/{created_room_id}", token, method="DELETE")
        if created_id:
            api(f"/owner/hotels/{created_id}", token, method="DELETE")
        for media_id in media_ids:
            (ROOT.parents[2] / ".local-media" / media_id).unlink(missing_ok=True)
        server.shutdown()
    print("Screenshots:", qa.OUTPUT)


if __name__ == "__main__":
    main()
