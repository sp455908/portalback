# 📚 Courses Data Loading Guide

This guide explains how to load comprehensive course data into the IIFTL Portal database.

## 🎯 **What's Included**

### **Student Courses (2 courses)**
1. **Introduction to Advanced Certificate in International Trade (ACIT)**
   - Duration: 2 months
   - Fee: ₹15,000
   - Modules: 8
   - Focus: International trade, export-import, compliance

2. **Introduction to Advanced Certificate in Logistics and Supply Chain (ACLSC)**
   - Duration: 2 months
   - Fee: ₹18,000
   - Modules: 10
   - Focus: Supply chain, logistics, warehouse management

### **Corporate Courses (9 courses)**
1. **FLEET MANAGEMENT** - 1 year, ₹45,000
2. **WAREHOUSE MANAGEMENT** - 1 year, ₹42,000
3. **IMPORT EXPORT MANAGEMENT** - 1 year, ₹48,000
4. **COLD STORAGE MANAGEMENT** - 6 months, ₹28,000
5. **INTERNATIONAL SALES AND MARKETING** - 3 months, ₹22,000
6. **LOGISTICS AND SUPPLY CHAIN MANAGEMENT** - 1 year, ₹50,000
7. **LOGISTICS AND FOREIGN TRADE MANAGEMENT** - 3 months, ₹25,000
8. **EXPORT-IMPORT MANAGEMENT** - 3 months, ₹24,000
9. **E COMMERCE SUPPLY CHAIN MANAGEMENT** - 3 months, ₹26,000

## 🔧 **Enhanced Course Fields**

Each course includes comprehensive information:

### **Basic Fields (Required)**
- `title` - Course name
- `description` - Detailed description
- `duration` - Course length
- `modules` - Number of modules
- `fee` - Course fee
- `isActive` - Whether course is available

### **Enhanced Fields (Optional)**
- `category` - Course category
- `targetUserType` - Student/Corporate/Government
- `features` - Array of course features
- `syllabus` - Array of syllabus topics
- `learningOutcomes` - Array of learning objectives
- `prerequisites` - Entry requirements
- `certification` - Certificate details
- `placementSupport` - Placement assistance
- `maxStudents` - Maximum enrollment
- `startDate` - Course start date
- `endDate` - Course end date

## 🚀 **How to Load Courses**

### **Method 1: Windows Batch File (Easiest)**

1. **Navigate to backend directory:**
   ```bash
   cd "IIFTL Backend"
   ```

2. **Run the batch file:**
   ```bash
   scripts\loadCourses.bat
   ```

### **Method 2: Direct Node.js Script**

1. **Navigate to backend directory:**
   ```bash
   cd "IIFTL Backend"
   ```

2. **Run the script:**
   ```bash
   node scripts/loadCourses.js
   ```

### **Method 3: Unix/Linux/Mac**

1. **Navigate to backend directory:**
   ```bash
   cd "IIFTL Backend"
   ```

2. **Run the script:**
   ```bash
   node scripts/loadCourses.js
   ```

## 📋 **Prerequisites**

Before running the script, ensure:

1. ✅ **Database connection** is configured in `.env`
2. ✅ **Backend server** is accessible
3. ✅ **Admin user exists** (for instructor assignment)
4. ✅ **Course model** is properly defined
5. ✅ **Node.js** is installed

## 🔍 **What the Script Does**

1. **Connects to database** and syncs models
2. **Finds admin users** for instructor assignment
3. **Processes student courses** (create or update)
4. **Processes corporate courses** (create or update)
5. **Handles existing courses** (updates if found)
6. **Provides detailed feedback** on the process
7. **Shows summary** of results

## 📊 **Expected Output**

```
🚀 Starting Courses Data Loading Process...
==========================================
✅ Database connection successful
✅ Database models synced
✅ Using admin user ID: 1 as default instructor

📚 Processing Student Courses...
--------------------------------
✅ Created: Introduction to Advanced Certificate in International Trade (ACIT)
✅ Created: Introduction to Advanced Certificate in Logistics and Supply Chain (ACLSC)

🏢 Processing Corporate Courses...
----------------------------------
✅ Created: Certification In FLEET MANAGEMENT
✅ Created: Certification In WAREHOUSE MANAGEMENT
✅ Created: Certification In IMPORT EXPORT MANAGEMENT
✅ Created: Certification In COLD STORAGE MANAGEMENT
✅ Created: Certification In INTERNATIONAL SALES AND MARKETING (FREIGHT FORWARDING)
✅ Created: Certification In LOGISTICS AND SUPPLY CHAIN MANAGEMENT
✅ Created: Certification In LOGISTICS AND FOREIGN TRADE MANAGEMENT
✅ Created: Certification In EXPORT-IMPORT MANAGEMENT
✅ Created: Certification In E COMMERCE SUPPLY CHAIN MANAGEMENT

📊 COURSES LOADING SUMMARY
============================
Total Courses Processed: 11
✅ New Courses Created: 11
🔄 Existing Courses Updated: 0
❌ Courses Skipped (Errors): 0
🎯 Success Rate: 100.0%

📚 Total Courses in Database: 11

🎉 SUCCESS: Courses have been loaded into the database!
Students and corporate users can now browse and enroll in these courses.
```

## 🆘 **Troubleshooting**

### **Common Issues**

**1. Database Connection Failed**
```
💥 ERROR: Failed to load courses: connect ECONNREFUSED
```
**Solution:** Check DATABASE_URL in .env file

**2. No Admin Users Found**
```
⚠️  No admin users found. Courses will be created without instructor assignment.
```
**Solution:** Create an admin user first

**3. Course Model Not Found**
```
💥 ERROR: Cannot find module '../models/course.model'
```
**Solution:** Ensure course model exists and path is correct

**4. Permission Denied**
```
💥 ERROR: permission denied for table "Courses"
```
**Solution:** Check database user permissions

### **Environment Variables**

Ensure these are set in your `.env` file:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/iiftl_db
NODE_ENV=development
PORT=5000
```

## 🔄 **Updating Existing Courses**

The script automatically handles existing courses:
- **If course exists** → Updates with new data
- **If course doesn't exist** → Creates new course
- **No duplicate courses** → Uses title as unique identifier

## 📱 **After Loading Courses**

Once courses are loaded:

1. **Check courses page** - Should show all 11 courses
2. **Test student enrollment** - Students can browse and enroll
3. **Test corporate access** - Corporate users can see relevant courses
4. **Verify course details** - All enhanced fields should be populated
5. **Test course management** - Admin can edit and manage courses

## 📚 **File Structure**

```
IIFTL Backend/scripts/
├── coursesData.js          # Course data definitions
├── loadCourses.js          # Main loading script
├── loadCourses.bat         # Windows batch file
└── README_COURSES.md       # This documentation
```

## 🎯 **Customization**

To add more courses or modify existing ones:

1. **Edit `coursesData.js`** - Add/modify course data
2. **Run the script again** - It will update existing courses
3. **Add new fields** - Extend the course model if needed

## 🆘 **Need Help?**

If you encounter issues:

1. **Check backend logs** for error messages
2. **Verify database connection** and credentials
3. **Ensure all services are running** (database, backend)
4. **Check file permissions** for script execution
5. **Review environment variables** configuration

---

**Note:** This script creates a comprehensive course catalog for your IIFTL Portal. All courses are set to active by default and ready for student enrollment. 