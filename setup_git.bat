@echo off
setlocal
set REPO_URL=https://github.com/igashira0324/dance-challenge.git

echo ========================================
echo   GitHub Registration Tool for Windows
echo ========================================

:: Gitがインストールされているか確認
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed. Please install Git for Windows.
    pause
    exit /b
)

:: すでに.gitがあるか確認
if exist .git (
    echo [INFO] Local Git repository already exists.
) else (
    echo [STEP 1] Initializing local repository...
    git init
)

echo [STEP 2] Adding files to staging area...
git add .

echo [STEP 3] Creating initial commit...
git commit -m "Initial commit: AI Dance Challenge Application"

echo [STEP 4] Setting remote origin to GitHub...
:: すでにoriginがある場合は一度削除
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [STEP 5] Setting main branch...
git branch -M main

echo [STEP 6] Pushing to GitHub (Requires Authentication)...
echo Please follow the GitHub login prompt if it appears.
git push -u origin main

if %errorlevel% equ 0 (
    echo ========================================
    echo   SUCCESS: Registered on GitHub!
    echo   URL: %REPO_URL%
    echo ========================================
) else (
    echo [ERROR] Push failed. Check your network or GitHub permissions.
)

pause
endlocal
