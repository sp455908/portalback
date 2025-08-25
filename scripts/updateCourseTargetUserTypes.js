#!/usr/bin/env node

/**
 * Script to Update Existing Courses with targetUserType
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Update existing courses with correct targetUserType
 * 3. Provide detailed feedback on the process
 * 
 * Usage:
 * node scripts/updateCourseTargetUserTypes.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const Course = require('../models/course.model');

async function updateCourseTargetUserTypes() {
  try {
    console.log('🚀 Starting Course Target User Type Update Process...');
    console.log('==================================================');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Sync models to ensure targetUserType field exists
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced');
    
    // Define course mappings based on titles
    const courseMappings = {
      // Student courses
      'Introduction to Advanced Certificate in International Trade (ACIT)': 'student',
      'Introduction to Advanced Certificate in Logistics and Supply Chain (ACLSC)': 'student',
      
      // Corporate courses
      'Certification In FLEET MANAGEMENT': 'corporate',
      'Certification In WAREHOUSE MANAGEMENT': 'corporate',
      'Certification In IMPORT EXPORT MANAGEMENT': 'corporate',
      'Certification In COLD STORAGE MANAGEMENT': 'corporate',
      'Certification In INTERNATIONAL SALES AND MARKETING (FREIGHT FORWARDING)': 'corporate',
      'Certification In LOGISTICS AND SUPPLY CHAIN MANAGEMENT': 'corporate',
      'Certification In LOGISTICS AND FOREIGN TRADE MANAGEMENT': 'corporate',
      'Certification In EXPORT-IMPORT MANAGEMENT': 'corporate',
      'Certification In E COMMERCE SUPPLY CHAIN MANAGEMENT': 'corporate'
    };
    
    let totalCourses = 0;
    let updatedCourses = 0;
    let skippedCourses = 0;
    
    console.log('\n📚 Processing Courses for targetUserType Updates...');
    console.log('---------------------------------------------------');
    
    // Get all courses
    const allCourses = await Course.findAll();
    totalCourses = allCourses.length;
    
    for (const course of allCourses) {
      try {
        const targetUserType = courseMappings[course.title];
        
        if (targetUserType) {
          // Update the course with targetUserType
          await course.update({ targetUserType });
          console.log(`✅ Updated: ${course.title} → ${targetUserType}`);
          updatedCourses++;
        } else {
          console.log(`⚠️  Skipped: ${course.title} (no mapping found)`);
          skippedCourses++;
        }
      } catch (error) {
        console.error(`❌ Error updating course "${course.title}":`, error.message);
        skippedCourses++;
      }
    }
    
    // Display Summary
    console.log('\n📊 COURSE TARGET USER TYPE UPDATE SUMMARY');
    console.log('==========================================');
    console.log(`Total Courses Processed: ${totalCourses}`);
    console.log(`✅ Courses Updated: ${updatedCourses}`);
    console.log(`⚠️  Courses Skipped: ${skippedCourses}`);
    console.log(`🎯 Success Rate: ${(updatedCourses / totalCourses * 100).toFixed(1)}%`);
    
    // Verify courses in database
    const studentCourses = await Course.count({ where: { targetUserType: 'student' } });
    const corporateCourses = await Course.count({ where: { targetUserType: 'corporate' } });
    const governmentCourses = await Course.count({ where: { targetUserType: 'government' } });
    
    console.log(`\n📚 Courses by Target User Type:`);
    console.log(`Student Courses: ${studentCourses}`);
    console.log(`Corporate Courses: ${corporateCourses}`);
    console.log(`Government Courses: ${governmentCourses}`);
    
    if (updatedCourses > 0) {
      console.log('\n🎉 SUCCESS: Course target user types have been updated!');
      console.log('Courses are now properly categorized for different user types.');
    } else {
      console.log('\n⚠️  WARNING: No courses were updated.');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR: Failed to update course target user types:', error.message);
    console.error('\nStack trace:', error.stack);
    
    // Provide helpful troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Check your DATABASE_URL environment variable');
    console.log('2. Ensure the database is running and accessible');
    console.log('3. Verify database credentials are correct');
    console.log('4. Check if the Course table exists');
    
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
  updateCourseTargetUserTypes()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { updateCourseTargetUserTypes }; 