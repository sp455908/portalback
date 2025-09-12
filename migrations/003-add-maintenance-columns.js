'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add maintenanceMessage column if it doesn't exist
      await queryInterface.addColumn('Settings', 'maintenanceMessage', {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: ''
      });
    } catch (error) {
      // Column might already exist, ignore error
      console.log('maintenanceMessage column might already exist:', error.message);
    }

    try {
      // Add maintenanceEndTime column if it doesn't exist
      await queryInterface.addColumn('Settings', 'maintenanceEndTime', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    } catch (error) {
      // Column might already exist, ignore error
      console.log('maintenanceEndTime column might already exist:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('Settings', 'maintenanceMessage');
    } catch (error) {
      console.log('Error removing maintenanceMessage column:', error.message);
    }

    try {
      await queryInterface.removeColumn('Settings', 'maintenanceEndTime');
    } catch (error) {
      console.log('Error removing maintenanceEndTime column:', error.message);
    }
  }
};