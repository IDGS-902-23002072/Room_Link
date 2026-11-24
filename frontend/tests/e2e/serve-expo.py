"""Serve the Expo static export, including extensionless client routes."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ExpoHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        filename = Path(super().translate_path(path))
        if not filename.exists() and not filename.suffix:
            page = filename.with_suffix(".html")
            if page.is_file():
                return str(page)
        return str(filename)


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("directory")
    args.add_argument("--port", type=int, default=8081)
    options = args.parse_args()

    def handler(*args, **kwargs):
        return ExpoHandler(*args, directory=options.directory, **kwargs)

    ThreadingHTTPServer(("127.0.0.1", options.port), handler).serve_forever()
