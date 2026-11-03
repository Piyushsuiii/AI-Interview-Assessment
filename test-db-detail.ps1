# Test Supabase database connection with credentials from .env
$envFile = Get-Content "D:\AI Interview Assessment platform\.env" | Where-Object { $_ -match '^DATABASE_URL=' }
$dbUrl = $envFile -replace '^DATABASE_URL="', '' -replace '"$', ''

# Extract components
$uri = [System.Uri]($dbUrl -replace '\?.*$', '')
$host = $uri.Host
$port = $uri.Port
$user = $uri.UserInfo.Split(':')[0]
$pass = $uri.UserInfo.Split(':')[1]
$dbname = $uri.AbsolutePath.Trim('/')

Write-Host "Host: $host"
Write-Host "Port: $port"
Write-Host "User: $user"
Write-Host "Database: $dbname"

# Try TCP connection first
$test = Test-NetConnection -ComputerName $host -Port $port -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) {
    Write-Host "TCP Connection: OK"
} else {
    Write-Host "TCP Connection: FAILED"
    exit 1
}
