param (
    [string]$ServerHost = "root@smmplan.pro",
    [string]$ServerPath = "/opt/smmplan_staging"
)

Write-Host "Starting STAGING Deployment (Port 3005)..."

Write-Host "1. Building Docker image locally..."
docker buildx build --platform linux/amd64 -t smmplan_staging_app:latest .
if ($LASTEXITCODE -ne 0) { throw "Build failed!" }

Write-Host "2. Saving image to tar file..."
if (Test-Path smmplan_staging_app.tar) { Remove-Item smmplan_staging_app.tar }
docker save smmplan_staging_app:latest -o smmplan_staging_app.tar
if ($LASTEXITCODE -ne 0) { throw "Save failed!" }

Write-Host "3. Preparing remote folder and sending files to $ServerHost..."
ssh $ServerHost "mkdir -p $ServerPath"
scp smmplan_staging_app.tar "$($ServerHost):/tmp/smmplan_staging_app.tar"
scp docker-compose.staging.yml "$($ServerHost):$ServerPath/docker-compose.yml"
scp .env.staging "$($ServerHost):$ServerPath/.env"
if ($LASTEXITCODE -ne 0) { throw "File transfer failed!" }

Write-Host "4. Deploying on server..."
$commands = @(
    "echo 'Tagging previous image for rollback...'",
    "docker tag smmplan_staging_app:latest smmplan_staging_app:previous || true",
    "echo 'Loading new image...'",
    "docker load -i /tmp/smmplan_staging_app.tar",
    "rm -f /tmp/smmplan_staging_app.tar",
    "echo 'Restarting containers...'",
    "cd $ServerPath",
    "docker-compose down --remove-orphans",
    "docker-compose up -d",
    "echo 'Running database migrations...'",
    "docker exec smmplan_staging_app npx prisma migrate deploy",
    "echo 'Waiting for application to start (15s)...'",
    "sleep 15",
    "echo 'Running health check...'",
    "HTTP_STATUS=``curl -s -o /dev/null -w `"%{http_code}`" http://localhost:3005/api/health``",
    "if [ `"`$HTTP_STATUS`" != `"200`" ]; then",
    "  echo 'Health check failed! HTTP Status: `$HTTP_STATUS'",
    "  echo 'Rolling back to previous version...'",
    "  docker tag smmplan_staging_app:previous smmplan_staging_app:latest",
    "  docker-compose down",
    "  docker-compose up -d",
    "  echo 'Rollback completed. Deployment failed.'",
    "  exit 1",
    "fi",
    "echo 'Cleaning up old images...'",
    "docker image prune -f",
    "echo 'Staging deployment finished! URL: http://198.18.0.19:3005'"
) -join "`n"

ssh $ServerHost $commands
if ($LASTEXITCODE -ne 0) { throw "Remote deployment failed!" }

Write-Host "5. Cleaning up local temporary files..."
if (Test-Path smmplan_staging_app.tar) { Remove-Item smmplan_staging_app.tar }

Write-Host "Staging is ready: http://198.18.0.19:3005"
