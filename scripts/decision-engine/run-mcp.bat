@echo off
chcp 65001 >nul
set LAYA_ENGINE_URL=http://127.0.0.1:8150
cd /d "E:\Omnismm"
call npx.cmd tsx "E:\Omnismm\scripts\decision-engine\mcp-server.ts"
