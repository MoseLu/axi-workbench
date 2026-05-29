@echo off
REM SOP同步批处理脚本
REM 用于Windows计划任务调用

cd /d "%~dp0"

echo ========================================
echo SOP文件同步任务
echo 时间: %date% %time%
echo ========================================

python sync_sop.py --sync

echo.
echo 同步任务完成
echo 时间: %date% %time%