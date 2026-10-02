"""Start local servers without visible Windows console windows."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / '.runtime'
LOGS.mkdir(exist_ok=True)


def port_open(port):
    with socket.socket() as connection:
        connection.settimeout(1)
        return connection.connect_ex(('127.0.0.1', port)) == 0


def start():
    if port_open(8000) or port_open(5173):
        raise RuntimeError('Port 8000 or 5173 is already in use. Stop the previous servers before starting ClassSense.')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    specs = {
        'backend': ([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], ROOT / 'backend'),
        'frontend': ([sys.argv[1], str(ROOT / 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'frontend'),
    }
    processes = {}
    for name, (command, directory) in specs.items():
        with (LOGS / f'{name}.log').open('w') as output, (LOGS / f'{name}-errors.log').open('w') as errors:
            processes[name] = subprocess.Popen(command, cwd=directory, stdout=output, stderr=errors, creationflags=flags, env=dict(os.environ))
    try:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if any(process.poll() is not None for process in processes.values()):
                raise RuntimeError('A server exited during startup. See .runtime logs.')
            try:
                with urlopen('http://127.0.0.1:8000/api/v1/health', timeout=1) as response:
                    healthy = response.status == 200
                if healthy and port_open(5173):
                    break
            except OSError:
                pass
            time.sleep(0.25)
        else:
            raise RuntimeError('Server startup timed out. See .runtime logs.')
    except Exception:
        for process in processes.values():
            process.terminate()
        raise
    (LOGS / 'processes.json').write_text(json.dumps({name: process.pid for name, process in processes.items()}))
    print('ClassSense: http://localhost:5173 | API docs: http://localhost:8000/docs | Logs: .runtime')


if __name__ == '__main__':
    start()
