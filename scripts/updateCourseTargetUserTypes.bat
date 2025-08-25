@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   IIFTL Portal - Update Course Types
echo ========================================
echo.

echo 🎯 Starting course target user type update process...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Then run this script again.
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ ERROR: This script must be run from the IIFTL Backend directory
    echo.
    echo Please navigate to the "IIFTL Backend" folder and run this script again.
    echo.
    pause
    exit /b 1
)

echo ✅ Backend directory confirmed
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  WARNING: No .env file found
    echo.
    echo Please ensure your environment variables are configured.
    echo You may need to copy env.example to .env and update the values.
    echo.
    echo Press any key to continue anyway...
    pause >nul
)

echo.
echo 🚀 Running course target user type update script...
echo.

REM Run the Node.js script
node scripts/updateCourseTargetUserTypes.js

echo.
echo ========================================
echo.

if %errorlevel% equ 0 (
    echo 🎉 SUCCESS: Course target user types have been updated!
    echo.
    echo Next steps:
    echo 1. Check your courses page to see the updated categorization
    echo 2. Verify students can see student courses
    echo 3. Verify corporate users can see corporate courses
    echo.
) else (
    echo 💥 FAILED: Course target user types could not be updated
    echo.
    echo Please check the error messages above and try again.
    echo.
)

echo Press any key to exit...
pause >nul 