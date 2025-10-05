import cron from 'node-cron';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsappService from './WhatsappService.js';

class NotificationService {
  constructor() {
    this.schedulers = new Map();
  }

  async initialize() {
    // Inicia o serviço do WhatsApp
    await WhatsappService.initialize();
    
    // Agenda o job principal
    this.scheduleNotifications();
  }

  scheduleNotifications() {
    // Roda a cada 6 horas (configurável via .env)
    cron.schedule(process.env.NOTIFICATION_INTERVAL || '0 */6 * * *', async () => {
      try {
        const users = await User.find({ active: true });
        console.log(`Processing notifications for ${users.length} users`);

        for (const user of users) {
          await this.processUserNotification(user);
          // wait between users to avoid rate limits
          await new Promise(res => setTimeout(res, 20000));
        }
      } catch (error) {
        console.error('Error in notification scheduler:', error);
      }
    });
  }

  async processUserNotification(user) {
    try {
      // Aqui você implementará a lógica de busca da qualidade do ar
      const airQualityData = await this.getAirQualityData(user.location);
      
      // Formata a mensagem (você implementará isso)
      const message = this.formatMessage(airQualityData);

      // Cria a notificação no banco
      const notification = await Notification.create({
        user: user._id,
        message: message,
        scheduledFor: new Date()
      });

      // Envia a mensagem
      await WhatsappService.sendMessage(user.phoneNumber, message);
      
      // Atualiza o status da notificação
      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();
      console.log(`Notification sent to user ${user.phoneNumber}`);

    } catch (error) {
      console.error(`Error processing notification for user ${user.phoneNumber}:`, error);
    }
  }

  // Método a ser implementado por você
  async getAirQualityData(location) {
    // Implementar lógica de busca de dados de qualidade do ar
    throw new Error('getAirQualityData not implemented');
  }

  // Método a ser implementado por você
  formatMessage(airQualityData) {
    // Implementar formatação da mensagem
    throw new Error('formatMessage not implemented');
  }
}

export default new NotificationService();