$ErrorActionPreference='SilentlyContinue'
$test = Test-NetConnection -ComputerName 'aws-0-ap-northeast-1.pooler.supabase.com' -Port 6543 -WarningAction SilentlyContinue
if ($test.TcpTestSucceeded) { "DB: CONNECTED" } else { "DB: UNREACHABLE" }