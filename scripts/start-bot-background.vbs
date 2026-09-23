Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\SMM_plan_2"
WshShell.Run "cmd.exe /c npm run bot", 0, False
