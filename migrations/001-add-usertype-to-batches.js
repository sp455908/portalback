'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Batches', 'userType', {
      type: Sequelize.ENUM('student', 'corporate', 'government'),
      allowNull: false,
      defaultValue: 'student'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Batches', 'userType');
    // Drop the ENUM type as well
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Batches_userType";');
  }
}; 