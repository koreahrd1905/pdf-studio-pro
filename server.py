#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Studio Pro - Local Application Server & Robust Merge Fallback API
"""

import http.server
import socketserver
import json
import os
import sys
import io
import urllib.parse
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

PORT = int(os.environ.get('PORT', 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class PDFStudioHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Health check
        if self.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'message': 'PDF Studio Server Running'}).encode('utf-8'))
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/merge':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))

                # data: { pages: [{ fileName, pageNum, textItems: [...] }], outputFileName }
                pages_meta = data.get('pages', [])
                output_name = data.get('outputFileName', '새로운_편집문서.pdf')
                if not output_name.lower().endswith('.pdf'):
                    output_name += '.pdf'

                writer = PdfWriter()

                # Cache opened readers
                reader_cache = {}

                for page_info in pages_meta:
                    file_name = page_info.get('fileName')
                    page_num = int(page_info.get('pageNum', 1)) # 1-based
                    text_items = page_info.get('textItems', [])

                    file_path = os.path.join(DIRECTORY, file_name)
                    if not os.path.exists(file_path):
                        continue

                    if file_path not in reader_cache:
                        reader_cache[file_path] = PdfReader(file_path)

                    reader = reader_cache[file_path]
                    idx = page_num - 1
                    if idx < 0 or idx >= len(reader.pages):
                        continue

                    page = reader.pages[idx]

                    # If textItems exist, overlay text using reportlab
                    if text_items:
                        pw = float(page.mediabox.width)
                        ph = float(page.mediabox.height)

                        packet = io.BytesIO()
                        can = canvas.Canvas(packet, pagesize=(pw, ph))

                        for item in text_items:
                            is_eraser = item.get('isEraserOnly', False)
                            text = item.get('text', '')
                            x_pct = float(item.get('xPercent', 50))
                            y_pct = float(item.get('yPercent', 50))
                            font_size = float(item.get('fontSize', 20))
                            bg = item.get('bg', 'transparent')
                            pad = float(item.get('padding', 14))

                            # PDF coordinates (origin at bottom-left)
                            cx = (x_pct / 100.0) * pw
                            cy = ph - ((y_pct / 100.0) * ph)

                            # Pure whiteout eraser
                            if is_eraser:
                                box_w = float(item.get('boxWidth', 120)) + pad * 2
                                box_h = float(item.get('boxHeight', 36)) + pad * 2
                                bx = cx - box_w / 2.0
                                by = cy - box_h / 2.0
                                can.setFillColorRGB(1, 1, 1)
                                can.rect(bx, by, box_w, box_h, fill=1, stroke=0)
                                continue

                            if not text:
                                continue

                            lines = text.split('\n')
                            line_h = font_size * 1.3
                            total_h = len(lines) * line_h

                            # Solid whiteout background behind text
                            if bg == 'white':
                                max_w = max([can.stringWidth(l, "Helvetica-Bold", font_size) for l in lines] or [100])
                                box_w = max_w + pad * 2
                                box_h = total_h + pad * 1.2
                                bx = cx - box_w / 2.0
                                by = cy - box_h / 2.0
                                can.setFillColorRGB(1, 1, 1)
                                can.rect(bx, by, box_w, box_h, fill=1, stroke=0)

                            can.setFont("Helvetica-Bold", font_size)
                            can.setFillColorRGB(0.12, 0.16, 0.23)
                            start_y = cy + (total_h / 2.0) - (line_h / 2.0)

                            for l_idx, line in enumerate(lines):
                                cur_y = start_y - (l_idx * line_h)
                                can.drawCentredString(cx, cur_y, line)

                        can.save()
                        packet.seek(0)
                        overlay_pdf = PdfReader(packet)
                        if len(overlay_pdf.pages) > 0:
                            page.merge_page(overlay_pdf.pages[0])

                    writer.add_page(page)

                out_stream = io.BytesIO()
                writer.write(out_stream)
                out_stream.seek(0)
                pdf_bytes = out_stream.read()

                self.send_response(200)
                encoded_filename = urllib.parse.quote(output_name)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'attachment; filename*=UTF-8\'\'{encoded_filename}')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                return

        return super().do_POST()

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), PDFStudioHandler) as httpd:
        print(f"==========================================================")
        print(f"  PDF Studio Pro Server Running at http://localhost:{PORT}")
        print(f"==========================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    run_server()
