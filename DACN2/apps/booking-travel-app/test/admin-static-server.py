"""Serve an Expo Web export with SPA route fallback on port 19006."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1] / ".admin-export-check"


class FallbackHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip("/")
        if not (ROOT / path).is_file():
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], ConnectionResetError):
            return
        super().handle_error(request, client_address)


if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Run Expo Web export to .admin-export-check first.")
    handler = partial(FallbackHandler, directory=str(ROOT))
    print("Admin visual QA server: http://localhost:19006", flush=True)
    QuietServer(("127.0.0.1", 19006), handler).serve_forever()
