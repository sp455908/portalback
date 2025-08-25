#!/usr/bin/env node

/**
 * Script to Load Courses Data into IIFTL Portal Database
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Load all student and corporate courses
 * 3. Handle existing courses (update if needed)
 * 4. Provide detailed feedback on the process
 * 
 * Usage:
 * node scripts/loadCourses.js
 * 
 * Prerequisites:
 * - Database connection configured
 * - Course model exists
 * - User model exists (for instructorId reference)
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const Course = require('../models/course.model');
const User = require('../models/user.model');
const coursesData = require('./coursesData');

async function loadCourses() {
  try {
    console.log('🚀 Starting Courses Data Loading Process...');
    console.log('==========================================');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Sync models to ensure they exist
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced');
    
    // Check if we have any admin users for instructorId
    const adminUsers = await User.findAll({ 
      where: { role: 'admin' },
      limit: 1 
    });
    
    const defaultInstructorId = adminUsers.length > 0 ? adminUsers[0].id : null;
    
    if (!defaultInstructorId) {
      console.log('⚠️  No admin users found. Courses will be created without instructor assignment.');
    } else {
      console.log(`✅ Using admin user ID: ${defaultInstructorId} as default instructor`);
    }
    
    let totalCourses = 0;
    let createdCourses = 0;
    let updatedCourses = 0;
    let skippedCourses = 0;
    
    // Process Student Courses
    console.log('\n📚 Processing Student Courses...');
    console.log('--------------------------------');
    
    for (const courseData of coursesData.student_courses) {
      totalCourses++;
      
      try {
        // Check if course already exists
        const existingCourse = await Course.findOne({
          where: { title: courseData.title }
        });
        
        if (existingCourse) {
          // Update existing course
          await existingCourse.update({
            description: courseData.description,
            duration: courseData.duration,
            modules: courseData.modules,
            fee: courseData.fee,
            isActive: courseData.isActive,
            instructorId: defaultInstructorId,
            // Add new fields if they exist in the model
            ...(courseData.category && { category: courseData.category }),
            ...(courseData.targetUserType && { targetUserType: courseData.targetUserType }),
            ...(courseData.features && { features: courseData.features }),
            ...(courseData.syllabus && { syllabus: courseData.syllabus }),
            ...(courseData.learningOutcomes && { learningOutcomes: courseData.learningOutcomes }),
            ...(courseData.prerequisites && { prerequisites: courseData.prerequisites }),
            ...(courseData.certification && { certification: courseData.certification }),
            ...(courseData.placementSupport && { placementSupport: courseData.placementSupport }),
            ...(courseData.maxStudents && { maxStudents: courseData.maxStudents }),
            ...(courseData.startDate && { startDate: new Date(courseData.startDate) }),
            ...(courseData.endDate && { endDate: new Date(courseData.endDate) })
          });
          
          console.log(`🔄 Updated: ${courseData.title}`);
          updatedCourses++;
        } else {
          // Create new course
          await Course.create({
            title: courseData.title,
            description: courseData.description,
            duration: courseData.duration,
            modules: courseData.modules,
            fee: courseData.fee,
            isActive: courseData.isActive,
            instructorId: defaultInstructorId,
            // Add new fields if they exist in the model
            ...(courseData.category && { category: courseData.category }),
            ...(courseData.targetUserType && { targetUserType: courseData.targetUserType }),
            ...(courseData.features && { features: courseData.features }),
            ...(courseData.syllabus && { syllabus: courseData.syllabus }),
            ...(courseData.learningOutcomes && { learningOutcomes: courseData.learningOutcomes }),
            ...(courseData.prerequisites && { prerequisites: courseData.prerequisites }),
            ...(courseData.certification && { certification: courseData.certification }),
            ...(courseData.placementSupport && { placementSupport: courseData.placementSupport }),
            ...(courseData.maxStudents && { maxStudents: courseData.maxStudents }),
            ...(courseData.startDate && { startDate: new Date(courseData.startDate) }),
            ...(courseData.endDate && { endDate: new Date(courseData.endDate) })
          });
          
          console.log(`✅ Created: ${courseData.title}`);
          createdCourses++;
        }
      } catch (error) {
        console.error(`❌ Error processing course "${courseData.title}":`, error.message);
        skippedCourses++;
      }
    }
    
    // Process Corporate Courses
    console.log('\n🏢 Processing Corporate Courses...');
    console.log('----------------------------------');
    
    for (const courseData of coursesData.corporate_courses) {
      totalCourses++;
      
      try {
        // Check if course already exists
        const existingCourse = await Course.findOne({
          where: { title: courseData.title }
        });
        
        if (existingCourse) {
          // Update existing course
          await existingCourse.update({
            description: courseData.description,
            duration: courseData.duration,
            modules: courseData.modules,
            fee: courseData.fee,
            isActive: courseData.isActive,
            instructorId: defaultInstructorId,
            // Add new fields if they exist in the model
            ...(courseData.category && { category: courseData.category }),
            ...(courseData.targetUserType && { targetUserType: courseData.targetUserType }),
            ...(courseData.features && { features: courseData.features }),
            ...(courseData.syllabus && { syllabus: courseData.syllabus }),
            ...(courseData.learningOutcomes && { learningOutcomes: courseData.learningOutcomes }),
            ...(courseData.prerequisites && { prerequisites: courseData.prerequisites }),
            ...(courseData.certification && { certification: courseData.certification }),
            ...(courseData.placementSupport && { placementSupport: courseData.placementSupport }),
            ...(courseData.maxStudents && { maxStudents: courseData.maxStudents }),
            ...(courseData.startDate && { startDate: new Date(courseData.startDate) }),
            ...(courseData.endDate && { endDate: new Date(courseData.endDate) })
          });
          
          console.log(`🔄 Updated: ${courseData.title}`);
          updatedCourses++;
        } else {
          // Create new course
          await Course.create({
            title: courseData.title,
            description: courseData.description,
            duration: courseData.duration,
            modules: courseData.modules,
            fee: courseData.fee,
            isActive: courseData.isActive,
            instructorId: defaultInstructorId,
            // Add new fields if they exist in the model
            ...(courseData.category && { category: courseData.category }),
            ...(courseData.targetUserType && { targetUserType: courseData.targetUserType }),
            ...(courseData.features && { features: courseData.features }),
            ...(courseData.syllabus && { syllabus: courseData.syllabus }),
            ...(courseData.learningOutcomes && { learningOutcomes: courseData.learningOutcomes }),
            ...(courseData.prerequisites && { prerequisites: courseData.prerequisites }),
            ...(courseData.certification && { certification: courseData.certification }),
            ...(courseData.placementSupport && { placementSupport: courseData.placementSupport }),
            ...(courseData.maxStudents && { maxStudents: courseData.maxStudents }),
            ...(courseData.startDate && { startDate: new Date(courseData.startDate) }),
            ...(courseData.endDate && { endDate: new Date(courseData.endDate) })
          });
          
          console.log(`✅ Created: ${courseData.title}`);
          createdCourses++;
        }
      } catch (error) {
        console.error(`❌ Error processing course "${courseData.title}":`, error.message);
        skippedCourses++;
      }
    }
    
    // Display Summary
    console.log('\n📊 COURSES LOADING SUMMARY');
    console.log('============================');
    console.log(`Total Courses Processed: ${totalCourses}`);
    console.log(`✅ New Courses Created: ${createdCourses}`);
    console.log(`🔄 Existing Courses Updated: ${updatedCourses}`);
    console.log(`❌ Courses Skipped (Errors): ${skippedCourses}`);
    console.log(`🎯 Success Rate: ${((createdCourses + updatedCourses) / totalCourses * 100).toFixed(1)}%`);
    
    // Verify courses in database
    const totalCoursesInDB = await Course.count();
    console.log(`\n📚 Total Courses in Database: ${totalCoursesInDB}`);
    
    if (totalCoursesInDB > 0) {
      console.log('\n🎉 SUCCESS: Courses have been loaded into the database!');
      console.log('Students and corporate users can now browse and enroll in these courses.');
    } else {
      console.log('\n⚠️  WARNING: No courses found in database after loading process.');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR: Failed to load courses:', error.message);
    console.error('\nStack trace:', error.stack);
    
    // Provide helpful troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Check your DATABASE_URL environment variable');
    console.log('2. Ensure the database is running and accessible');
    console.log('3. Verify database credentials are correct');
    console.log('4. Check if the Course and User tables exist');
    console.log('5. Ensure you have at least one admin user in the database');
    
    process.exit(1);
  } finally {
    // Close database connection
    if (sequelize) {
      await sequelize.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  loadCourses()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { loadCourses }; 