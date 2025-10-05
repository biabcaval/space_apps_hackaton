import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  active: {
    type: Boolean,
    default: true
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  notificationPreferences: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'realtime'],
      default: 'daily'
    },
    timeOfDay: {
      type: String,
      default: '08:00'  // formato HH:mm
    },
    timezone: {
      type: String,
      default: 'America/Recife'
    }
  }
});

export default mongoose.model('User', userSchema);