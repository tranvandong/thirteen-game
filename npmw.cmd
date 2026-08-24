@echo off
REM Wrapper for `npm` when the Volta shim is broken (Cannot determine Node.js install directory).
REM Calls npm-cli.js bundled inside Volta's node image via node (which works).
SETLOCAL
SET NPM_CLI=C:\Users\ASUS\AppData\Local\Volta\tools\image\node\22.18.0\node_modules\npm\bin\npm-cli.js
IF NOT EXIST "%NPM_CLI%" (
  for /f "delims=" %%i in ('node -p "require('path').join(process.execPath,'..','node_modules','npm','bin','npm-cli.js')"') do SET NPM_CLI=%%i
)
node "%NPM_CLI%" %*
ENDLOCAL
