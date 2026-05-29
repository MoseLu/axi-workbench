#!/usr/bin/env zsh
set -u

log=/Volumes/code/models/logs/notify-hf-uncensored-done.log
model_file=/Volumes/code/models/huggingface/HauhauCS__Qwen3.5-35B-A3B-Uncensored-HauhauCS-Aggressive/Qwen3.5-35B-A3B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf
expected_size=21169117248
model_name=qwen3.5-35b-a3b-uncensored:q4_k_m
download_sent=/Volumes/code/models/logs/.notify-hf-uncensored-download.sent
import_sent=/Volumes/code/models/logs/.notify-hf-uncensored-import.sent

mkdir -p /Volumes/code/models/logs
exec >> "$log" 2>&1

notify_user() {
  local title="$1"
  local message="$2"

  osascript -e "display notification \"$message\" with title \"$title\" sound name \"Glass\"" || true
  osascript -e "display dialog \"$message\" buttons {\"知道了\"} with title \"$title\" giving up after 60" >/dev/null 2>&1 &
  say "$message" >/dev/null 2>&1 || true
}

echo "==> watcher restarted at $(date)"

while true; do
  size=$(stat -f %z "$model_file" 2>/dev/null || echo 0)
  installed=no
  if ollama list | sed 1d | tr -s " " | cut -d " " -f 1 | grep -Fxq "$model_name"; then
    installed=yes
  fi

  echo "$(date) size=$size expected=$expected_size installed=$installed"

  if [ "$size" -ge "$expected_size" ] && [ ! -f "$download_sent" ]; then
    notify_user "HF 模型下载完成" "无审查 Qwen3.5 35B GGUF 文件已经下载完成，正在等待导入 Ollama。"
    touch "$download_sent"
    echo "==> download notification sent at $(date)"
  fi

  if [ "$installed" = yes ] && [ ! -f "$import_sent" ]; then
    notify_user "模型导入完成" "无审查 Qwen3.5 35B 已经导入 Ollama，可以使用了。"
    touch "$import_sent"
    echo "==> import notification sent at $(date)"
    break
  fi

  sleep 60
done
