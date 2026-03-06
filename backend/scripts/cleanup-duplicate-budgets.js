/**
 * MongoDB Script to Remove Duplicate Budgets
 * 
 * This script finds and removes duplicate budgets based on:
 * user + category + month + year
 * 
 * It keeps the oldest record (first created) and deletes the others.
 * 
 * Usage:
 *   1. Make sure MongoDB is running
 *   2. Run: node scripts/cleanup-duplicate-budgets.js
 * 
 * Or run directly in MongoDB shell:
 *   use finance_manager
 *   db.budgets.aggregate([...])
 */

const mongoose = require('mongoose');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance_manager';

async function cleanupDuplicateBudgets() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const budgetsCollection = db.collection('budgets');

    // Find duplicate budgets and keep the oldest one
    const duplicates = await budgetsCollection.aggregate([
      {
        $group: {
          _id: {
            user: '$user',
            category: '$category',
            month: '$month',
            year: '$year'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          minId: { $min: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    console.log(`\nFound ${duplicates.length} sets of duplicate budgets\n`);

    let totalDeleted = 0;

    for (const dup of duplicates) {
      const idsToDelete = dup.ids.filter(id => id.toString() !== dup.minId.toString());
      
      console.log(`Category: ${dup._id.category}, Month: ${dup._id.month}/${dup._id.year}`);
      console.log(`  Total: ${dup.count}, Keeping: 1, Deleting: ${idsToDelete.length}`);
      
      const result = await budgetsCollection.deleteMany({
        _id: { $in: idsToDelete }
      });
      
      totalDeleted += result.deletedCount;
      console.log(`  Deleted: ${result.deletedCount}\n`);
    }

    console.log(`✅ Total duplicates removed: ${totalDeleted}`);
    console.log(`✅ Cleanup complete!`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the cleanup
cleanupDuplicateBudgets();
