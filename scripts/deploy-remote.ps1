param (
    [string]$ServerHost = "root@smmplan.pro",
    [string]$ServerPath = "/opt/smmplan_lite"
)

Write-Host "Starting Remote Deployment (Bypassing Windows Docker issues)..." -ForegroundColor Cyan

Write-Host "1. Archiving source code..." -ForegroundColor Yellow
# Exclude node_modules, .next, .git, etc.
git archive --format=tar.gz -o src_archive.tar.gz HEAD
if ($LASTEXITCODE -ne 0) { throw "Archive failed! Make sure git is tracking the files." }

Write-Host "2. Sending archive to $ServerHost..." -ForegroundColor Yellow
scp src_archive.tar.gz "$($ServerHost):/tmp/src_archive.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "SCP transfer failed!" }

Write-Host "3. Building and deploying on server..." -ForegroundColor Yellow
$remoteCommands = "
echo 'Cleaning up old files...';
rm -rf $ServerPath/src $ServerPath/components $ServerPath/app $ServerPath/.next $ServerPath/prisma;
echo 'Extracting source code...';
mkdir -p $ServerPath;
tar -xzf /tmp/src_archive.tar.gz -C $ServerPath;
rm /tmp/src_archive.tar.gz;
cd $ServerPath;
echo 'Installing dependencies and building Next.js standalone + workers...';
npm ci;
npm run build;
echo 'Building Docker image natively on Ubuntu...';
docker compose -f docker-compose.prod.yml build;
echo 'Restarting containers...';
docker compose -f docker-compose.prod.yml up -d;
echo 'Running migrations...';
docker exec -u 0 smmplan_app npx prisma migrate deploy;
echo 'Restarting Nginx to clear upstream cache...';
docker restart smmplan_nginx;
echo 'Remote deployment finished!';
"

ssh $ServerHost $remoteCommands
if ($LASTEXITCODE -ne 0) { throw "Remote execution failed!" }

Write-Host "4. Cleanup local files..." -ForegroundColor Yellow
Remove-Item src_archive.tar.gz -ErrorAction SilentlyContinue

Write-Host "Remote Deployment Successful!" -ForegroundColor Green
