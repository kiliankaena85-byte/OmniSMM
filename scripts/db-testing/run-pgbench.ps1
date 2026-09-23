# (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
# PowerShell runner for pgbench within Docker container

param (
    [string]$Container = "smmplan_lite_db",
    [string]$Database = "smmplan_lite",
    [string]$User = "postgres",
    [int]$Clients = 10,
    [int]$Jobs = 2,
    [int]$Duration = 5,
    [string]$Mode = "checkout"
)

npx tsx scripts/db-testing/run-pgbench.ts --container $Container --db $Database --user $User --clients $Clients --jobs $Jobs --duration $Duration --mode $Mode
