Option Explicit

Dim shell, fso, baseDir, pythonwPath, launcherPath, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonwPath = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\pythonw.exe"
launcherPath = fso.BuildPath(baseDir, "run_app.pyw")

If Not fso.FileExists(pythonwPath) Then
  MsgBox "Nao encontrei o Python embutido em:" & vbCrLf & pythonwPath, vbCritical, "Erro ao abrir o sistema"
  WScript.Quit 1
End If

If Not fso.FileExists(launcherPath) Then
  MsgBox "Nao encontrei o launcher em:" & vbCrLf & launcherPath, vbCritical, "Erro ao abrir o sistema"
  WScript.Quit 1
End If

shell.CurrentDirectory = baseDir
command = """" & pythonwPath & """ """ & launcherPath & """"
shell.Run command, 0, False
