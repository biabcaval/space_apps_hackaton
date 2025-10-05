import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsappService from './WhatsappService.js';
import SchedulerService from './SchedulerService.js';

class NotificationService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      console.log('NotificationService já inicializado');
      return;
    }

    try {
      await WhatsappService.initialize();
      this.initialized = true;
      console.log('Serviço de WhatsApp inicializado com sucesso');
      
      // Inicia o agendador após a inicialização do WhatsApp
      await SchedulerService.initialize();
      console.log('Serviço de agendamento inicializado com sucesso');
    } catch (error) {
      console.error('Erro na inicialização dos serviços:', error);
      throw error;
    }
  }
}

export default new NotificationService();