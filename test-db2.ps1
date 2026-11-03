# Test Supabase database connection
$ErrorActionPreference = 'SilentlyContinue'
$dbHost = 'aws-0-ap-northeast-1.pooler.supabase.com'
$dbPort = 6543

Write-Host "Testing database: ${dbHost}:${dbPort}"

# Test TCP connection
$test = Test-NetConnection -ComputerName $dbHost -Port $dbPort -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) {
    Write-Host "TCP: OK"
    Write-Host "Ping: $($test.PingSucceeded)"
} else {
    Write-Host "TCP: FAILED"
}

# Test port 5432 (direct connection)
$test2 = Test-NetConnection -ComputerName $dbHost -Port 5432 -WarningAction SilentlyContinue
Write-Host "Port 5432: $($test2.TcpTestSucceeded)"
