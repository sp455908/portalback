@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   IIFTL Portal - Load Courses Script
echo ========================================
echo.

echo 📚 Starting courses data loading process...
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
echo 🚀 Running courses loading script...
echo.

REM Run the Node.js script
node scripts/loadCourses.js

echo.
echo ========================================
echo.

if %errorlevel% equ 0 (
    echo 🎉 SUCCESS: Courses have been loaded into the database!
    echo.
    echo Next steps:
    echo 1. Check your courses page to see the new courses
    echo 2. Verify students can browse and enroll
    echo 3. Test course creation and management
    echo.
) else (
    echo 💥 FAILED: Courses could not be loaded
    echo.
    echo Please check the error messages above and try again.
    echo.
)

echo Press any key to exit...
pause >nul 