# Cria o atalho "Cedro Pagamentos" na Area de Trabalho e no Menu Iniciar.
$pasta = $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell
$destinos = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs')
)
foreach ($destino in $destinos) {
  $atalho = $shell.CreateShortcut((Join-Path $destino 'Cedro Pagamentos.lnk'))
  $atalho.TargetPath = $env:ComSpec
  $atalho.Arguments = "/c `"$pasta\iniciar.bat`""
  $atalho.WorkingDirectory = $pasta
  $atalho.IconLocation = "$pasta\cedro.ico"
  $atalho.WindowStyle = 7
  $atalho.Save()
}
