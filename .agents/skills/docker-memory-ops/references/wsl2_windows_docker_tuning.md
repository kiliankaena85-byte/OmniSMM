# Windows & WSL2 Docker Memory Tuning & Crisis Management

## 1. Архитектура Docker Desktop под Windows / WSL2

На Windows разработчики и тестовые контуры используют Docker Desktop или Rancher Desktop, работающие поверх подсистемы **WSL2 (Windows Subsystem for Linux 2)**.

В этой архитектуре:
1. Docker daemon выполняется внутри виртуальной машины WSL2 (`docker-desktop` или дистрибутив `Ubuntu`).
2. Вся память виртуальной машины управляется процессом Windows **`vmmem`** (или `vmmemWSL`).
3. Виртуальный жесткий диск расположен в файле `ext4.vhdx` (обычно в `%LOCALAPPDATA%\Docker\wsl\data\ext4.vhdx`).

---

## 2. Синдром «Раздувания `vmmem`» и невозврат памяти

### Механика проблемы:
Linux-ядро внутри WSL2 кеширует прочитанные и записанные файлы в Page Cache. Windows видит эти страницы памяти как «занятые» и оставляет их выделенными для процесса `vmmem`.
В результате процесс `vmmem` в Windows Task Manager разрастается до 80–95% всей физической RAM компьютера, замораживая IDE, браузер и сторонние сервисы, даже когда контейнеры Docker находятся в простое!

### Решение 1: Конфигурация `.wslconfig` (Глобальный барьер)
Создайте или отредактируйте файл `C:\Users\<Ваш_Пользователь>\.wslconfig`:

```ini
[wsl2]
# Ограничить память WSL2 максимум 8-12 GB (или 50% RAM хоста)
memory=10GB

# Ограничить swap-файл на диске
swap=4GB

# Включить автоматическое освобождение страниц памяти ядром обратно в Windows (WSL 2.0+)
autoMemoryReclaim=gradual

# Ограничить число используемых ядер CPU
processors=6
```

После изменения файла выполните в PowerShell:
```powershell
wsl --shutdown
```
При следующем старте Docker Desktop применит жесткие лимиты.

---

## 3. Сброс кэшей памяти изнутри WSL2 без перезагрузки

Если `vmmem` съел всю память прямо во время работы:
```powershell
# Из Windows PowerShell:
wsl -u root -e bash -c "sync && echo 3 > /proc/sys/vm/drop_caches"
```
Эта команда мгновенно сбрасывает неактивный Page Cache и slab-объекты ядра Linux, возвращая до нескольких гигабайт физической ОЗУ хосту Windows за доли секунды.

---

## 4. Разрастание виртуального диска `ext4.vhdx` и сжатие

При интенсивных сборках (`docker build`), загрузке базовых образов и создании volumes виртуальный диск `ext4.vhdx` постоянно растет. Однако при удалении образов (`docker system prune`) размер файла `ext4.vhdx` на диске Windows **НЕ уменьшается автоматически** — он остается «раздутым».

### Регулярное обслуживание через скрипт проекта:
В проекте уже подготовлен специализированный скрипт:
```powershell
# Запуск сжатия виртуального диска:
powershell -ExecutionPolicy Bypass -File scripts/compact-docker-vdisk.ps1
```

### Ручная процедура сжатия через `diskpart`:
```powershell
# 1. Остановить Docker Desktop и WSL
wsl --shutdown

# 2. Запустить diskpart
# select vdisk file="C:\Users\<User>\AppData\Local\Docker\wsl\data\ext4.vhdx"
# attach vdisk readonly
# compact vdisk
# detach vdisk
# exit
```
Это высвобождает от 20 до 100 GB свободного пространства на SSD-накопителе хоста.
