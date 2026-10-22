"""Check ST-ADM-02 API-backed Admin screens at desktop and mobile widths.

Run the backend, export Expo web to .admin-export-check, start
admin-static-server.py, then set ADM_QA_EMAIL / ADM_QA_PASSWORD and run this file.
Screenshots are written to a temporary directory printed on success.
"""

import importlib.util
import json
import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket


SCRIPT = Path(__file__).with_name("admin-visual-qa.py")
SPEC = importlib.util.spec_from_file_location("admin_visual_qa", SCRIPT)
assert SPEC and SPEC.loader
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)


def main():
    email = os.environ["ADM_QA_EMAIL"]
    password = os.environ["ADM_QA_PASSWORD"]
    login_request = urllib.request.Request(
        "http://localhost:3000/api/auth/login",
        data=json.dumps({"identifier": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(login_request) as response:
        login = json.load(response)
    if login["user"]["role"] != "ADMIN":
        raise RuntimeError("Tài khoản kiểm tra không có quyền ADMIN.")

    qa.OUTPUT = Path(tempfile.mkdtemp(prefix="st-adm-02-qa-"))
    with tempfile.TemporaryDirectory(prefix="st-adm-02-chrome-") as profile:
        process = subprocess.Popen(
            [
                str(qa.CHROME), "--headless=new", "--disable-gpu", "--no-first-run",
                "--remote-allow-origins=*", f"--remote-debugging-port={qa.DEBUG_PORT}",
                f"--user-data-dir={profile}", "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            for _ in range(50):
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{qa.DEBUG_PORT}/json/version"):
                        break
                except Exception:
                    time.sleep(0.2)
            request = urllib.request.Request(
                f"http://127.0.0.1:{qa.DEBUG_PORT}/json/new?about:blank", method="PUT"
            )
            with urllib.request.urlopen(request) as response:
                tab = json.load(response)
            ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
            try:
                qa.command(ws, "Page.enable")
                qa.command(ws, "Runtime.enable")
                qa.navigate(ws, "/auth/login", "Đăng nhập")
                session = {
                    "mode": "api", "userId": login["user"]["id"],
                    "email": login["user"]["email"], "role": "ADMIN",
                    "accessToken": login["accessToken"],
                    "refreshToken": login["refreshToken"],
                    "sessionId": login["sessionId"],
                }
                persisted = json.dumps({"state": {"session": session}, "version": 0})
                qa.evaluate(
                    ws,
                    "localStorage.setItem(" + json.dumps("booking-travel-user-mock-v1")
                    + "," + json.dumps(persisted) + ")",
                )
                for width in [320, 360, 375, 390, 412, 430, 768, 1024, 1440]:
                    qa.command(ws, "Emulation.setDeviceMetricsOverride", {
                        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False,
                    })
                    qa.navigate(ws, "/admin/users", "Quản lý người dùng")
                    qa.wait_text(ws, "Người dùng (")
                    qa.assert_no_page_overflow(ws, width)
                    if width in [320, 390, 1024, 1440]:
                        qa.screenshot(ws, "st-adm-02-users", width)
                    if width == 390:
                        qa.click_button(ws, "Bộ lọc và sắp xếp")
                        qa.wait_text(ws, "Vai trò")
                        qa.click_button(ws, "Khách hàng")
                        qa.click_button(ws, "Tên A–Z")
                        qa.set_input(
                            ws,
                            "input[aria-label='Tên, email hoặc số điện thoại']",
                            "traveler@bookingtravel.vn",
                        )
                        qa.wait_text(ws, "Người dùng (1)")
                        qa.assert_no_page_overflow(ws, width)
                        qa.screenshot(ws, "st-adm-02-filters", width)
                        qa.click_button_containing(ws, "Xem chi tiết")
                        qa.wait_text(ws, "Quản lý trạng thái")
                        qa.click_button(ws, "← Quay lại danh sách")
                        qa.wait_text(ws, "Người dùng (1)")
                        value = qa.evaluate(
                            ws,
                            "document.querySelector(\"input[aria-label='Tên, email hoặc số điện thoại']\").value",
                        )
                        assert value == "traveler@bookingtravel.vn", "Bộ lọc bị mất khi quay lại danh sách"

                    qa.navigate(
                        ws, "/admin/detail/users?id=seed-user-traveler", "Chi tiết người dùng"
                    )
                    qa.wait_text(ws, "Quản lý trạng thái")
                    qa.assert_no_page_overflow(ws, width)
                    if width in [320, 1024]:
                        qa.screenshot(ws, "st-adm-02-detail", width)
                        qa.click_button_containing(ws, "Đình chỉ tài khoản")
                        qa.wait_text(ws, "Xác nhận đình chỉ người dùng")
                        qa.screenshot(ws, "st-adm-02-confirm", width)
                        qa.click_button(ws, "Xác nhận đình chỉ")
                        qa.wait_text(ws, "Vui lòng nhập lý do đình chỉ tài khoản.")
                    print("PASS responsive", width, flush=True)
            finally:
                ws.close()
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    print("Screenshots:", qa.OUTPUT)


if __name__ == "__main__":
    main()
