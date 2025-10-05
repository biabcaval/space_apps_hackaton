import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsappService from './WhatsappService.js';

class SchedulerService {
  constructor() {
    this.activeJobs = new Map();
    this.TIMEOUT_BETWEEN_USERS = 60000; // 60 segundos entre mensagens para diferentes usuários
  }

  async initialize() {
    try {
      // Remove todos os jobs existentes
      this.activeJobs.forEach(job => job.stop());
      this.activeJobs.clear();

      // Agenda verificação de horários a cada minuto
      cron.schedule('* * * * *', () => this.checkScheduledNotifications());
      console.log('Agendador de notificações iniciado');
    } catch (error) {
      console.error('Erro ao inicializar SchedulerService:', error);
      throw error;
    }
  }

  async checkScheduledNotifications() {
    try {
      const now = moment();
      const users = await User.find({ active: true });

      for (const user of users) {
        const shouldSendNotification = this.shouldSendNotification(user, now);
        if (shouldSendNotification) {
          await this.processUserNotification(user);
          // Aguarda timeout entre usuários
          await new Promise(resolve => setTimeout(resolve, this.TIMEOUT_BETWEEN_USERS));
        }
      }
    } catch (error) {
      console.error('Erro ao verificar notificações agendadas:', error);
    }
  }

  shouldSendNotification(user, currentTime) {
    if (!user.notificationPreferences || !user.notificationPreferences.timeOfDay) {
      return false;
    }

    const { frequency, timeOfDay } = user.notificationPreferences;
    const userTime = moment.tz(currentTime, user.notificationPreferences.timezone || 'America/Recife');
    const [scheduledHour, scheduledMinute] = timeOfDay.split(':');
    
    switch (frequency) {
      case 'realtime':
        return true; // Envia a cada verificação
      case '15min':
        return userTime.minutes() % 15 === 0;
      case 'hourly':
        return userTime.minutes() === 0;
      case 'daily':
        return userTime.hours() === parseInt(scheduledHour) && 
               userTime.minutes() === parseInt(scheduledMinute);
      case 'weekly':
        return userTime.day() === 1 && // Segunda-feira
               userTime.hours() === parseInt(scheduledHour) && 
               userTime.minutes() === parseInt(scheduledMinute);
      default:
        return false;
    }
  }

  async processUserNotification(user) {
    try {
      // Aqui você implementará a chamada para sua API de qualidade do ar
      const airData = await this.fetchAirQualityData(user.location);
      const message = this.formatNotificationMessage(airData);

      // Registra a notificação
      const notification = await Notification.create({
        user: user._id,
        message: message,
        scheduledFor: new Date(),
        status: 'pending'
      });

      // Envia via WhatsApp
      await WhatsappService.enqueueMessage(user.phoneNumber, message);
      
      // Atualiza status
      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();

      console.log(`Notificação enviada para ${user.phoneNumber} às ${moment().format('HH:mm:ss')}`);
    } catch (error) {
      console.error(`Erro ao processar notificação para ${user.phoneNumber}:`, error);
    }
  }

  async fetchAirQualityData(location) {
    // Implemente a chamada para sua API aqui
    return {
      aqi: 50,
      status: 'Bom',
      pollutants: {
        pm25: 15,
        pm10: 25
      }
    };
  }

  formatNotificationMessage(airData) {
    return `🌤️ Atualização da Qualidade do Ar:
- Índice: ${airData.aqi}
- Status: ${airData.status}
- PM2.5: ${airData.pollutants.pm25} µg/m³
- PM10: ${airData.pollutants.pm10} µg/m³`;
  }
}

export default new SchedulerService();