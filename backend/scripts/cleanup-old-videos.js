/**
 * Cleanup script to remove old videos without gridFsFileId
 * These are videos uploaded before the GridFS migration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('../src/models/Video');

async function cleanupOldVideos() {
  try {
    console.log('Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/video-platform-dev';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');

    // Find videos without gridFsFileId (old videos)
    const oldVideos = await Video.find({ gridFsFileId: { $exists: false } });
    
    console.log(`\nFound ${oldVideos.length} old video(s) without gridFsFileId:`);
    
    if (oldVideos.length === 0) {
      console.log('✅ No old videos to clean up!');
      await mongoose.disconnect();
      return;
    }

    // Display old videos
    oldVideos.forEach((video, index) => {
      console.log(`\n${index + 1}. ID: ${video._id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Owner: ${video.ownerUserId}`);
      console.log(`   Created: ${video.createdAt}`);
      console.log(`   Status: ${video.status}`);
    });

    // Delete old videos
    console.log(`\n🗑️  Deleting ${oldVideos.length} old video(s)...`);
    
    const result = await Video.deleteMany({ gridFsFileId: { $exists: false } });
    
    console.log(`✅ Deleted ${result.deletedCount} video(s)`);
    
    // Also delete their assignments
    const VideoAssignment = require('../src/models/VideoAssignment');
    const videoIds = oldVideos.map(v => v._id);
    const assignmentResult = await VideoAssignment.deleteMany({ 
      videoId: { $in: videoIds } 
    });
    
    console.log(`✅ Deleted ${assignmentResult.deletedCount} video assignment(s)`);
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupOldVideos();
