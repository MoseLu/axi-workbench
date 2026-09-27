#!/usr/bin/env python3
"""Forward 127.0.0.1:443 to 127.0.0.1:8443 so the default HTTPS port works locally."""

from __future__ import annotations

import os
import socket
import sys
import threading

LISTEN = ("127.0.0.1", 443)
UPSTREAM = ("127.0.0.1", 8443)
PID_FILE = "/tmp/axi-workbench-443.pid"
LOG_FILE = "/tmp/axi-workbench-443.log"


def daemonize() -> None:
    if os.fork() > 0:
        os._exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)
    os.chdir("/")
    os.umask(0)
    with open(LOG_FILE, "ab", buffering=0) as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
    with open(os.devnull, "rb") as devnull:
        os.dup2(devnull.fileno(), 0)
    with open(PID_FILE, "w", encoding="utf-8") as handle:
        handle.write(str(os.getpid()))


def pipe(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for sock in (src, dst):
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(client: socket.socket) -> None:
    try:
        upstream = socket.create_connection(UPSTREAM, timeout=5)
    except OSError:
        client.close()
        return
    threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
    pipe(upstream, client)
    client.close()
    upstream.close()


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(LISTEN)
    server.listen(128)
    while True:
        client, _addr = server.accept()
        threading.Thread(target=handle, args=(client,), daemon=True).start()


if __name__ == "__main__":
    daemonize()
    try:
        main()
    except Exception as error:
        sys.stderr.write(f"{error}\n")
        raise
