import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsappService from './WhatsappService.js';
import dotenv from 'dotenv';

dotenv.config();

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

      console.log(`Verificando notificações agendadas para ${users.length} usuários às ${now.format('HH:mm:ss')}`);
      for (const user of users) {
        const shouldSendNotification = this.shouldSendNotification(user, now);
        console.log(`Usuário ${user.phoneNumber} - Deve enviar notificação: ${shouldSendNotification}`);
        console.log(user)
        if (shouldSendNotification) {
          console.log(`Enviando notificação para ${user.phoneNumber}...`);
          await this.processUserNotification(user);
          
          // atualiza usuário para ativo: false
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                active: false,
                notificationPreferences: {
                  frequency: 'daily',
                  timeOfDay: '08:00',
                  timezone: 'America/Recife'
                }
              }
            }
          );
          // Aguarda timeout entre usuários
          await new Promise(resolve => setTimeout(resolve, this.TIMEOUT_BETWEEN_USERS));
        }
      }
    } catch (error) {
      console.error('Erro ao verificar notificações agendadas:', error);
    }
  }

  shouldSendNotification(user, currentTime) {
    if (user.active) {
      return true;
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
      //const message = this.formatNotificationMessage(airData);

      const healthAdvice = await this.fetchHealthAdvice(airData);
      const message = `${this.formatNotificationMessage(airData)}\nHealth Advice:\n${healthAdvice}\n\n\nIf you want more advice, just send me your location again!`;

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

  async fetchHealthAdvice(airData) {
    const API_URL_PRIMARY = process.env.API_URL_PRIMARY;
    const API_URL_FALLBACK = process.env.API_URL_FALLBACK;
    const TIMEOUT = 5000;

    const fetchWithTimeout = async (baseUrl) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      console.log(`Tentando conectar em: ${baseUrl}`);
      console.log('Headers:', {
        'Content-Type': 'application/json'
      });

      console.log
      
      const response = await fetch(`${baseUrl}/health/advice`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aqi: airData.aqi,
          risk_group: "General Population",
          pm2_5: airData.pollutants.pm25,
          pm10: airData.pollutants.pm10,
          no2: airData.pollutants.no2,
          o3: airData.pollutants.o3
        })
      });

      console.log('Status da resposta:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.advice || 'No specific health advice available.';
    } catch (error) {
      console.error(`Erro detalhado para ${baseUrl}:`, {
        message: error.message,
        code: error.code,
        cause: error.cause
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

    try {
      // Tenta primeiro a API primária
      console.log('Trying primary API for health advice...');
      return await fetchWithTimeout(API_URL_PRIMARY);
    } catch (primaryError) {
      console.warn('Primary API failed for health advice, trying fallback...', primaryError);
      
      try {
        // Tenta a API de fallback
        return await fetchWithTimeout(API_URL_FALLBACK);
      } catch (fallbackError) {
        console.error('Both APIs failed for health advice:', fallbackError);
        return 'Unable to fetch health advice at this time.';
      }
    }
  }

  async fetchAirQualityData(location) {
    const API_URL_PRIMARY = process.env.API_URL_PRIMARY;
    const API_URL_FALLBACK = process.env.API_URL_FALLBACK;
    const TIMEOUT = 5000;

    const fetchWithTimeout = async (baseUrl) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      try {
        const response = await fetch(
          `${baseUrl}/air-pollution/current?lat=${location.latitude}&lon=${location.longitude}`,
          {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      // Tenta primeiro a API primária
      console.log('Trying primary API...');
      const data = await fetchWithTimeout(API_URL_PRIMARY);
      console.log('Data received from primary API:', data);
      return {
        aqi: data.data.list[0].main.aqi,
        status: this.getAqiStatus(data.data.list[0].main.aqi),
        pollutants: {
          pm25: data.data.list[0].components.pm2_5,
          pm10: data.data.list[0].components.pm10,
          no2: data.data.list[0].components.no2,
          o3: data.data.list[0].components.o3
        }
      };
    } catch (primaryError) {
      console.warn('Primary API failed, trying fallback...', primaryError);
      
      try {
        // Tenta a API de fallback
        const data = await fetchWithTimeout(API_URL_FALLBACK);
        return {
          aqi: data.data.list[0].main.aqi,
          status: this.getAqiStatus(data.data.list[0].main.aqi),
          pollutants: {
            pm25: data.data.list[0].components.pm2_5,
            pm10: data.data.list[0].components.pm10,
            no2: data.data.list[0].components.no2,
            o3: data.data.list[0].components.o3
          }
        };
      } catch (fallbackError) {
        console.error('Both APIs failed:', fallbackError);
        throw new Error('Não foi possível obter dados de qualidade do ar');
      }
    }
  }
  formatNotificationMessage(airData) {
    return `Air Quality Index (AQI): ${airData.aqi} (${airData.status})
Main pollutants:
- PM2.5: ${airData.pollutants.pm25} µg/m³
- PM10: ${airData.pollutants.pm10} µg/m³
- NO2: ${airData.pollutants.no2} µg/m³
- O3: ${airData.pollutants.o3} µg/m³

`;
  }

  getAqiStatus(aqi) {
    if (aqi === 1) return 'Good';
    if (aqi === 2) return 'Moderate';
    if (aqi === 3) return 'Unhealthy for Sensitive Groups';
    if (aqi === 4) return 'Unhealthy';
    if (aqi === 5) return 'Very Unhealthy';
    return 'Hazardous';
  }
}

export default new SchedulerService();