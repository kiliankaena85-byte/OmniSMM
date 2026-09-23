# Управление приоритетами процессов, CPU Affinity и параллелизмом сборки (Windows/Node.js)

## 1. Проблема вытеснения планировщика Windows

При запуске тяжелых Node.js компиляторов (`next build --webpack`, `tsc`, `esbuild`) по умолчанию они наследуют класс приоритета `Normal` (`Win32_Process.Priority = 8`). 
Webpack и TypeScript создают пулы воркеров по числу логических ядер процессора ($N$). В результате:
- Нагрузка на CPU возрастает до 100% на всех ядрах.
- Захватываются потоки DPC (Deferred Procedure Calls) и GUI-потоки диспетчера окон (`dwm.exe`).
- Пользователь наблюдает зависание курсора мыши, фризы браузера, задержки ввода с клавиатуры.

## 2. Механизм решения: ProcessPriorityClass.BelowNormal

В Windows класс приоритета `BelowNormal` (приоритет 6-7) дает процессу право потреблять неиспользуемые такты процессора на полной скорости, но **немедленно уступает кванты времени** интерактивным приложениям (браузер, проводник, аудио/видео):

```powershell
$process = Start-Process -FilePath "node.exe" -ArgumentList "..." -PassThru
$process.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
```

## 3. Механизм CPU Affinity (Маска соответствия процессоров)

Если у процессора 8 ядер (логических потоков):
- Маска всех ядер (8 бит): `0xFF` (255)
- Маска с резервированием 1 ядра для ОС (7 ядер): `0x7F` (127)
- Маска с резервированием 2 ядер для ОС (6 ядер): `0x3F` (63)

Установка Affinity в PowerShell:
```powershell
$totalCores = [System.Environment]::ProcessorCount
if ($totalCores -gt 2) {
    # Оставляем 1 ядро свободным
    $mask = (1 -shl ($totalCores - 1)) - 1
    $process.ProcessorAffinity = [IntPtr]$mask
}
```

## 4. Ограничение пула потоков Libuv

Libuv по умолчанию использует пул из 4 потоков. В сборках Next.js интенсивный ввод-вывод файлов можно стабилизировать:
```powershell
$env:UV_THREADPOOL_SIZE = [Math]::Min(4, [System.Environment]::ProcessorCount)
```

## 5. Ограничение кучи V8

Для предотвращения Out of Memory на хосте и свопа:
- `$env:NODE_OPTIONS = "--max-old-space-size=2560"` (2.5 ГБ достаточны для Webpack, но не истощают оперативную память Windows).
