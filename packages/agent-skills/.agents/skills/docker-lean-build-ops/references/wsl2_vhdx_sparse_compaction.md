# Обуздание виртуальной памяти и дисков WSL2 (VHDX & Memory Reclamation)

## 1. Проблема роста виртуального диска `ext4.vhdx`

Виртуальная машина WSL2 (включая Docker Desktop на WSL2 бэкенде) использует виртуальные диски VHDX.
Когда Docker скачивает образы, компилирует слои или Next.js пишет кэши:
1. Диск `ext4.vhdx` расширяется новыми 2MB блоками.
2. При удалении контейнеров (`docker rm`) или очистке кэша (`rm -rf .next/cache`) свободное место освобождается **внутри ext4**, но физический файл `.vhdx` на Windows NTFS диске **не уменьшается**!
3. Со временем `ext4.vhdx` может разрастись до 50–100 ГБ, забивая весь системный диск C:.

## 2. Автоматическое сжатие: `sparseVhd=true`

Начиная с Windows 11 22H2 и WSL версии 2.0+, Microsoft внедрила поддержку разреженных дисков (Sparse VHD):
В файле `C:\Users\Shadow\.wslconfig`:
```ini
[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
```
- `sparseVhd=true`: Windows автоматически возвращает освободившиеся блоки файловой системе хоста при вызове `fstrim` в Linux.
- `autoMemoryReclaim=gradual`: WSL автоматически освобождает кэшированную оперативную память (`cached memory / page cache`) обратно в Windows, предотвращая раздувание процесса `vmmem`.

## 3. Команда ручной компактизации

Если диск уже раздут, его можно сжать через официальную команду:
```powershell
# Сжатие диска WSL по умолчанию
wsl --manage --compact

# Либо сжатие конкретного дистрибутива docker-desktop
wsl --manage docker-desktop --compact
```

## 4. Экстренный сброс дискового кэша Linux (Page Cache Drop)

Когда Docker выполняет интенсивные операции чтения/записи, оперативная память Linux заполняется page cache:
```bash
wsl -e sh -c "sync; echo 3 > /proc/sys/vm/drop_caches"
```
Это высвобождает сотни мегабайт ОЗУ без остановки работающих контейнеров.
