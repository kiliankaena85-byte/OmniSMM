Write-Host "Starting Autonomous Server Migration & Verification..." -ForegroundColor Cyan

# 1. Copy local dump from container
Write-Host "1. Copying DB dump from local Docker container..." -ForegroundColor Yellow
docker cp smmplan_lite_db:/tmp/local_dump.sql local_dump.sql
if ($LASTEXITCODE -ne 0) { throw "Docker copy failed!" }

# 2. Upload dump to remote server
Write-Host "2. Uploading database dump to root@smmplan.pro..." -ForegroundColor Yellow
scp local_dump.sql root@smmplan.pro:/tmp/local_dump.sql
if ($LASTEXITCODE -ne 0) { throw "SCP upload failed!" }

# 3. Remote operations
Write-Host "3. Executing remote migration steps..." -ForegroundColor Yellow

$remoteCmds = @(
    "echo '--- Flushing Redis cache ---'",
    "docker exec -i smmplan_lite_prod_redis redis-cli flushall",
    
    "echo '--- Stopping application containers ---'",
    "cd /opt/smmplan_lite",
    "docker compose -f docker-compose.prod.yml stop app worker bot",
    
    "echo '--- Dropping and recreating DB schema ---'",
    "docker exec -i smmplan_lite_prod_db psql -U postgres -d smmplan_lite -c 'drop schema public cascade; create schema public;'",
    
    "echo '--- Restoring database dump ---'",
    "docker exec -i smmplan_lite_prod_db psql -U postgres -d smmplan_lite < /tmp/local_dump.sql",
    
    "echo '--- Starting application containers ---'",
    "docker compose -f docker-compose.prod.yml up -d",
    
    "echo '--- Restarting Nginx to clear upstream cache ---'",
    "docker restart smmplan_lite_prod_nginx",
    
    "echo '--- Cleaning up remote files ---'",
    "rm /tmp/local_dump.sql",
    
    "echo '--- Checking container statuses ---'",
    "docker ps --filter name=smmplan_lite_prod_",
    
    "echo '--- Remote migration steps finished! ---'"
) -join " && "

ssh root@smmplan.pro $remoteCmds
if ($LASTEXITCODE -ne 0) { throw "Remote execution failed!" }

# 4. Clean up local dump
Write-Host "4. Cleaning up local temp files..." -ForegroundColor Yellow
Remove-Item local_dump.sql -ErrorAction SilentlyContinue

Write-Host "Migration and Deployment completed successfully!" -ForegroundColor Green
