import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsappService from '../services/WhatsappService.js';

class NotificationController {
  async registerUser(req, res) {
    try {
      const { phoneNumber, location, preferences } = req.body;
      
      const user = await User.create({
        phoneNumber,
        location,
        notificationPreferences: preferences
      });

      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePreferences(req, res) {
    try {
      const { userId } = req.params;
      const { preferences } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { notificationPreferences: preferences },
        { new: true }
      );

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getHistory(req, res) {
    try {
      const { userId } = req.params;
      
      const notifications = await Notification.find({
        user: userId
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: notifications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async sendTestNotification(req, res) {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Aqui você implementará a lógica de teste com dados fictícios
      const testMessage = "This is a test notification for the air quality alert system.";
      
      await WhatsappService.sendMessage(user.phoneNumber, testMessage);

      await Notification.create({
        user: userId,
        message: testMessage,
        status: 'sent',
        sentAt: new Date()
      });

      res.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new NotificationController();