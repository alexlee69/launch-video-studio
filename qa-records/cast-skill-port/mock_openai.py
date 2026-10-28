# -*- coding: utf-8 -*-
# A local stand-in for OpenAI's /v1/images/generations and /edits (QA only, no network): records every request (endpoint,
# fields, uploaded files' bytes, the Authorization header) and answers from a script of behaviours. Generations draw a
# synthetic three-panel sheet (grey with a soft gradient, white 7 px gutters, a dark figure per panel); edits return the
# first uploaded image, brightened and blurred a little (an edit drifts), at the requested size.
import base64, hashlib, io, json, re, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

STATE = {'log': [], 'script': []}      # script: behaviours consumed per request: 'ok', '400size', 429, 500, 401, 401long, 'badjson', 'jpeg',
                                       # 'drop', 'truncate' (200 cut mid-body), 'slow' (5 s, then ok), 'light' (a 195-grey sheet)


def sheet(w, h, seed, base=128):
    rng = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:h, 0:w]
    g = base + 10 * xx / w + 4 * yy / h + rng.normal(0, 0.6, (h, w))
    a = np.stack([g, g, g], -1)
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for x in (w * 3 // 8, w * 2 // 3):
        d.rectangle([x - 3, 0, x + 3, h], fill=(250, 250, 250))
    for cx in (w * 3 // 16, w * 41 // 80, w * 5 // 6):
        d.ellipse([cx - w // 14, h // 5, cx + w // 14, h * 4 // 5], fill=(40 + seed % 50, 60, 90))
    return im


def png(im, fmt='PNG'):
    b = io.BytesIO(); im.save(b, fmt); return b.getvalue()


def parse_multipart(body, ctype):
    b = re.search(r'boundary=(\S+)', ctype).group(1).encode()
    fields, files = {}, []
    for part in body.split(b'--' + b)[1:]:
        if part.startswith(b'--'):
            break
        head, _, data = part.partition(b'\r\n\r\n')
        data = data[:-2] if data.endswith(b'\r\n') else data
        name = re.search(rb'name="([^"]+)"', head).group(1).decode()
        fn = re.search(rb'filename="([^"]*)"', head)
        if fn:
            files.append({'name': name, 'filename': fn.group(1).decode(), 'sha': hashlib.sha256(data).hexdigest(), 'bytes': data})
        else:
            fields[name] = data.decode()
    return fields, files


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, obj=None, raw=None):
        body = raw if raw is not None else json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n)
        ctype = self.headers.get('Content-Type', '')
        ep = self.path.rsplit('/', 1)[-1]
        if ctype.startswith('multipart/'):
            fields, files = parse_multipart(body, ctype)
        else:
            fields, files = json.loads(body), []
        rec = {'path': self.path, 'endpoint': ep, 'auth': self.headers.get('Authorization'), 'fields': fields,
               'files': [{k: v for k, v in f.items() if k != 'bytes'} for f in files]}
        STATE['log'].append(rec)
        beh = STATE['script'].pop(0) if STATE['script'] else 'ok'
        if beh == 'drop':
            self.close_connection = True; self.connection.close(); return
        if beh == 'truncate':
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', '5000000')
            self.end_headers(); self.wfile.write(b'{"data": [{"b64_json": "iVBOR'); self.wfile.flush(); self.close_connection = True; return
        if beh == 'slow':
            import time; time.sleep(5)
        if beh == '401long':
            return self.send(401, {'error': {'message': 'x' * 470 + ' you sent ' + str(self.headers.get('Authorization'))}})
        if beh == '400size':
            return self.send(400, {'error': {'message': "Invalid size '%s'. Supported sizes are ..." % fields.get('size')}})
        if beh in (429, 500, 401):
            return self.send(beh, {'error': {'message': 'mock %s; you sent %s' % (beh, self.headers.get('Authorization'))}})
        if beh == 'badjson':
            return self.send(200, raw=b'<html>gateway</html>')
        if beh == 'redirect':
            self.send_response(307); self.send_header('Location', STATE.get('redirect_to', 'http://127.0.0.1:9/steal')); self.send_header('Content-Length', '0'); self.end_headers(); return
        if beh == 'empty':
            return self.send(200, {'data': [], 'usage': {'input_tokens': 10, 'output_tokens': 7370, 'input_tokens_details': {'text_tokens': 10, 'image_tokens': 0}}})
        w, h = [int(v) for v in str(fields['size']).split('x')]
        k = int(fields.get('n', 1)) - (1 if beh == 'short' else 0)
        out = []
        for i in range(k):
            if files:
                im = Image.open(io.BytesIO(files[0]['bytes'])).convert('RGB').resize((w, h))
                im = Image.fromarray(np.clip(np.asarray(im).astype(int) + 6, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
            else:
                im = sheet(w, h, len(STATE['log']) * 7 + i, 185 if beh == 'light' else 128)
            out.append({'b64_json': base64.b64encode(png(im, 'JPEG' if beh == 'jpeg' else 'PNG')).decode()})
        ptxt = len(fields.get('prompt', '')) // 4
        usage = {'input_tokens': k * (ptxt + 1508 * len(files)), 'output_tokens': 7370 * k,
                 'input_tokens_details': {'text_tokens': k * ptxt, 'image_tokens': k * 1508 * len(files)}}
        self.send(200, {'data': out, 'usage': {'total_tokens': 9000} if beh == 'partialusage' else usage})


def start():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, 'http://127.0.0.1:%d/v1' % srv.server_address[1]
