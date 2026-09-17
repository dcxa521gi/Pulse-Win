param([int]$ParentId = 0)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PulseForeground {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int size; public RECT monitor,work; public int flags; }
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr h,ref MONITORINFO m);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,System.Text.StringBuilder b,int max);
 public static bool Fullscreen() {
  var h=GetForegroundWindow(); if(h==IntPtr.Zero) return false;
  var name=new System.Text.StringBuilder(256); GetClassName(h,name,256);
  if(name.ToString()=="Progman"||name.ToString()=="WorkerW"||name.ToString()=="Shell_TrayWnd") return false;
  RECT r; if(!GetWindowRect(h,out r)) return false;
  var m=new MONITORINFO();m.size=Marshal.SizeOf(m);if(!GetMonitorInfo(MonitorFromWindow(h,2),ref m))return false;
  return r.L<=m.monitor.L && r.T<=m.monitor.T && r.R>=m.monitor.R && r.B>=m.monitor.B;
 }
}
'@
$previous = ''
while ($true) {
 if ($ParentId -gt 0 -and -not (Get-Process -Id $ParentId -ErrorAction SilentlyContinue)) { break }
 $value = if ([PulseForeground]::Fullscreen()) { '1' } else { '0' }
 if ($value -ne $previous) { [Console]::Out.WriteLine($value); [Console]::Out.Flush(); $previous=$value }
 Start-Sleep -Milliseconds 700
}
