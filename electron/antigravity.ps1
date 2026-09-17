$ErrorActionPreference='Stop'
$processes=Get-CimInstance Win32_Process -Filter "Name LIKE 'language_server%'" | Where-Object { $_.ExecutablePath -match 'Antigravity' }
$result=@()
foreach($process in $processes) {
 $match=[regex]::Match($process.CommandLine,'--csrf_token[=\s]+["'']?([^\s"'']+)')
 if(-not $match.Success){continue}
 $ports=@(Get-NetTCPConnection -State Listen -OwningProcess $process.ProcessId -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique)
 if($ports.Count){$result+=@{token=$match.Groups[1].Value;ports=$ports}}
}
ConvertTo-Json -InputObject @($result) -Compress -Depth 4
