"""
Axi Docs Project Manager
NSSM-managed service - monitors and keeps project processes alive.
"""
import subprocess
import time
import os
import sys
import signal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = r"D:\logs"
PROJECT_LOG = os.path.join(LOG_DIR, "axi-docs.log")
FRONTEND_LOG = os.path.join(LOG_DIR, "axi-docs-frontend.log")

RUNNING = True


def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    sys.stdout.flush()
    try:
        with open(PROJECT_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except:
        pass


def kill_proc_tree(pid):
    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                      capture_output=True,
                      creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS)
    except:
        pass


def get_port_in_use(port):
    import socket
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except Exception:
        return False


class ProjectManager:
    def __init__(self):
        self.frontend_proc = None

    def cleanup(self):
        log("Cleaning up...")
        if self.frontend_proc:
            try:
                kill_proc_tree(self.frontend_proc.pid)
                log("[frontend] Stopped")
            except:
                pass

    def start_frontend(self):
        log("Starting frontend...")
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE

        try:
            self.frontend_proc = subprocess.Popen(
                ["pnpm", "run", "preview"],
                cwd=BASE_DIR,
                startupinfo=startupinfo,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                env=os.environ.copy()
            )
            log(f"[frontend] Started PID={self.frontend_proc.pid}")
            return True
        except Exception as e:
            log(f"[frontend] Failed: {e}")
            return False

    def run(self):
        log("=" * 50)
        log("Axi Docs Project Manager Started")
        log("=" * 50)

        os.makedirs(LOG_DIR, exist_ok=True)
        self.start_frontend()
        time.sleep(2)

        while RUNNING:
            time.sleep(10)

            if not get_port_in_use(3005):
                log("[frontend] Not responding, restarting...")
                if self.frontend_proc:
                    kill_proc_tree(self.frontend_proc.pid)
                self.frontend_proc = None
                self.start_frontend()
                time.sleep(2)
            else:
                log(f"[frontend] Health OK")

        self.cleanup()
        log("Project Manager stopped")


def signal_handler(signum, frame):
    global RUNNING
    RUNNING = False


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    manager = ProjectManager()
    try:
        manager.run()
    except KeyboardInterrupt:
        manager.cleanup()
    except Exception as e:
        log(f"FATAL: {e}")
        manager.cleanup()
        sys.exit(1)
