@echo off
title Git Push — iamjasem
color 0A

echo.
echo  ================================
echo   Pushing to GitHub...
echo  ================================
echo.

git remote set-url origin https://github.com/jasem109/classtrack.git

git add .
echo.
git status
echo.

git commit -m "update"

echo.
git push -f origin main

echo.
echo  ================================
if %ERRORLEVEL%==0 (
    echo   Done! Changes pushed successfully.
) else (
    color 0C
    echo   Something went wrong. Check above.
)
echo  ================================
echo.
pause