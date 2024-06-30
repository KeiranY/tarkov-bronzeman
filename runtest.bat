@echo off
echo Running build
call npm run build

REM Copy the files to the local directory
REM Local bronzeman mod directory
set bronzemanDir=C:\Games\SPT-AKI\user\mods\kcy-bronzeman-1.1.2\src

REM Copy each file pattern individually
echo Copying .ts files
copy /Y dist\src\*.ts %bronzemanDir%