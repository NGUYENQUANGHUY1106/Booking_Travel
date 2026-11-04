"""Exercise the real Expo web dashboard against the local API (no API fixtures).

Serve .owner-export-check on port 19006; set OWN_QA_EMAIL/OWN_QA_PASSWORD.
Chrome and websocket-client are required. Artifacts stay in the OS temp folder.
This verifies the Expo web build, not native iOS/Android rendering.
"""
import importlib.util
import json
import os
import subprocess
import shutil
import tempfile
import time
import urllib.request
from pathlib import Path
import websocket

SPEC = importlib.util.spec_from_file_location('dashboard_qa', Path(__file__).with_name('admin-visual-qa.py'))
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)

def main():
    req = urllib.request.Request('http://localhost:3000/api/auth/login', data=json.dumps({'identifier': os.environ['OWN_QA_EMAIL'], 'password': os.environ['OWN_QA_PASSWORD']}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        login = json.load(response)
    assert login['user']['role'] == 'HOTEL_OWNER'
    qa.OUTPUT = Path(tempfile.mkdtemp(prefix='st-own-03-qa-'))
    profile = tempfile.mkdtemp(prefix='st-own-03-chrome-')
    process = subprocess.Popen([str(qa.CHROME), '--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*', f'--remote-debugging-port={qa.DEBUG_PORT}', f'--user-data-dir={profile}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{qa.DEBUG_PORT}/json/version'): break
            except OSError: time.sleep(0.2)
        req = urllib.request.Request(f'http://127.0.0.1:{qa.DEBUG_PORT}/json/new?about:blank', method='PUT')
        with urllib.request.urlopen(req) as response: tab = json.load(response)
        ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=30)
        try:
            qa.command(ws, 'Page.enable'); qa.command(ws, 'Runtime.enable'); qa.command(ws, 'Network.enable')
            qa.navigate(ws, '/auth/login', 'Đăng nhập')
            session = {key: login[key] for key in ['accessToken', 'refreshToken', 'sessionId']}
            session.update(mode='api', userId=login['user']['id'], email=login['user']['email'], role='HOTEL_OWNER')
            persisted = json.dumps({'state': {'session': session}, 'version': 0})
            qa.evaluate(ws, 'localStorage.setItem("booking-travel-user-mock-v1",' + json.dumps(persisted) + ')')
            for width in [390, 360, 375, 412, 430]:
                qa.command(ws, 'Emulation.setDeviceMetricsOverride', {'width': width, 'height': 844, 'deviceScaleFactor': 1, 'mobile': False})
                qa.navigate(ws, '/hotel-owner', 'Hôm nay cần làm gì?')
                qa.wait_text(ws, 'Cập nhật:')
                qa.assert_no_page_overflow(ws, width)
                boxes = qa.evaluate(ws, """['Đặt phòng hôm nay','Lấp đầy','Doanh thu tháng','Đánh giá'].map(label=>{const e=[...document.querySelectorAll('*')].find(e=>!e.children.length&&e.textContent===label)?.parentElement;const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,width:r.width}:null})""")
                assert all(boxes), boxes
                assert abs(boxes[0]['y'] - boxes[1]['y']) < 2 and boxes[2]['y'] > boxes[0]['y'], boxes
                assert all(b['x'] >= 0 and b['right'] <= width + 1 for b in boxes), boxes
                qa.screenshot(ws, 'dashboard-top', width)
                qa.evaluate(ws, "document.querySelector('[data-testid=owner-dashboard-scroll]').scrollTop=10000")
                time.sleep(0.5)
                visible = qa.evaluate(ws, """(()=>{const ai=document.querySelector('[data-testid=owner-dashboard-ai]').getBoundingClientRect();const nav=document.querySelector('[role=tablist]').getBoundingClientRect();return ai.bottom<=nav.top&&ai.top>=0})()""")
                qa.screenshot(ws, 'dashboard-bottom', width)
                assert visible, qa.evaluate(ws, "JSON.stringify({ai:document.querySelector('[data-testid=owner-dashboard-ai]').getBoundingClientRect().toJSON(),nav:document.querySelector('[role=tablist]').getBoundingClientRect().toJSON(),scroll:[...document.querySelectorAll('div')].filter(e=>e.scrollHeight>e.clientHeight+10).map(e=>({tag:e.getAttribute('data-testid'),y:getComputedStyle(e).overflowY,h:e.clientHeight,sh:e.scrollHeight,st:e.scrollTop}))})")
            qa.command(ws, 'Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': False})
            qa.click_button(ws, 'Chọn khoảng ngày thống kê')
            qa.set_input(ws, 'input[aria-label="Từ ngày"]', '2026-02-30')
            qa.click_button(ws, 'Áp dụng'); qa.wait_text(ws, 'Nhập ngày hợp lệ')
            qa.set_input(ws, 'input[aria-label="Từ ngày"]', '2026-01-01')
            qa.set_input(ws, 'input[aria-label="Đến ngày"]', '2026-01-07')
            qa.click_button(ws, 'Áp dụng'); qa.wait_text(ws, 'Đặt phòng trong kỳ')
            qa.click_button_containing(ws, 'TẤT CẢ KHÁCH SẠN')
            for _ in range(50):
                if qa.evaluate(ws, "document.querySelectorAll('[role=radio]').length") > 1: break
                time.sleep(0.1)
            assert qa.evaluate(ws, "document.querySelectorAll('[role=radio]').length") > 1
            qa.evaluate(ws, "document.querySelectorAll('[role=radio]')[1].click()")
            qa.wait_text(ws, 'Đặt phòng trong kỳ')
            qa.command(ws, 'Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': 0, 'uploadThroughput': 0})
            qa.click_button(ws, 'Làm mới tổng quan'); qa.wait_text(ws, 'Đang xem dữ liệu đã lưu')
            qa.screenshot(ws, 'dashboard-offline', 390)
            qa.command(ws, 'Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
            if qa.evaluate(ws, "[...document.querySelectorAll('[role=button]')].some(e=>e.innerText==='Thử lại')"):
                qa.click_button(ws, 'Thử lại')
            for _ in range(50):
                if 'Đang xem dữ liệu đã lưu' not in qa.evaluate(ws, 'document.body.innerText'): break
                time.sleep(0.1)
            assert 'Đang xem dữ liệu đã lưu' not in qa.evaluate(ws, 'document.body.innerText')
            qa.evaluate(ws, "[...document.querySelectorAll('[role=tab]')].find(e=>e.innerText.includes('Khách sạn')).click()")
            qa.wait_text(ws, 'Chức năng chưa khả dụng')
            qa.click_button(ws, 'Đóng')
            qa.command(ws, 'Network.setBlockedURLs', {'urls': ['*/api/*']})
            qa.navigate(ws, '/hotel-owner', 'Không thể kiểm tra quyền')
            assert 'Đặt phòng hôm nay' not in qa.evaluate(ws, 'document.body.innerText')
            qa.command(ws, 'Network.setBlockedURLs', {'urls': []})
            qa.click_button(ws, 'Thử lại'); qa.wait_text(ws, 'Đặt phòng hôm nay')
            revoke = urllib.request.Request('http://localhost:3000/api/auth/logout', data=b'{}', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + login['accessToken']})
            urllib.request.urlopen(revoke).close()
            qa.click_button(ws, 'Làm mới tổng quan'); qa.wait_text(ws, 'Đăng nhập')
            assert 'Đặt phòng hôm nay' not in qa.evaluate(ws, 'document.body.innerText')
            print('PASS: real API, 5 widths, grid, scroll/nav, date validation/range, hotel selector, offline cached/uncached, retry, revoked session, unavailable navigation')
            print('Artifacts: ' + str(qa.OUTPUT))
        finally: ws.close()
    finally:
        process.terminate()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        profile_path = Path(profile).resolve()
        if profile_path.parent == Path(tempfile.gettempdir()).resolve() and profile_path.name.startswith('st-own-03-chrome-'):
            shutil.rmtree(profile_path, ignore_errors=True)
        req = urllib.request.Request('http://localhost:3000/api/auth/logout', data=b'{}', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + login['accessToken']})
        try: urllib.request.urlopen(req).close()
        except OSError: pass

if __name__ == '__main__': main()
