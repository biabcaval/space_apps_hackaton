import wwebjs from "whatsapp-web.js";
const { Client, LocalAuth } = wwebjs;
import qrcode from "qrcode-terminal";
import moment from "moment-timezone";
import UserService from "./UserService.js";

class WhatsappService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.messageQueue = [];
    this.isProcessing = false;
    this.rateLimitDelay = process.env.WHATSAPP_RATE_LIMIT_DELAY || 3000;
  }

  async initialize() {
    if (this.client) {
      return; // Já inicializado
    }
    
    // Inicializa o cliente com as mesmas configurações que funcionam em wweb.js
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      session: false,
    });

    // Eventos do cliente
    this.client.on("qr", (qr) => {
      qrcode.generate(qr, { small: true });
      console.log('Por favor, escaneie o QR code acima');
    });

    this.client.on("ready", () => {
      this.isReady = true;
      console.log('Cliente WhatsApp está pronto!');
      // Inicia processamento da fila se houver mensagens
      if (this.messageQueue.length > 0) {
        this.processQueue();
      }
    });

    this.client.on("authenticated", () => {
      console.log("Cliente WhatsApp autenticado!");
    });

    this.client.on("disconnected", (reason) => {
      this.isReady = false;
      console.error("Cliente WhatsApp desconectado:", reason);
    });

    this.client.on("message", async (msg) => {
      try {
        // Extrai o número do remetente (remove o @c.us)
        const sender = msg.from.split('@')[0];
        
        // Obtém informações do contato
        const contact = await msg.getContact();
        const name = contact.name || contact.pushname || 'Usuário';

        let user = await UserService.getUserByWhatsAppNumber(sender);
        // if user not found, create a new one
        if (!user) {
          user = await UserService.createUser({
            phoneNumber: sender,
            name: name,
            active: true,
            notificationPreferences: {}
          });
          console.log(`Novo usuário criado: ${name} (${sender})`);
        } else {
          console.log(`Usuário existente: ${name} (${sender})`);
        }

        console.log(`Mensagem recebida de ${name} (${sender}): ${msg.body}`);

        // Se for uma localização
        if (msg.type === 'location') {
          // update user location
          await UserService.updateUserLocation(user._id, {
            latitude: msg.location.latitude,
            longitude: msg.location.longitude
          });

          // update user date time to receive updates do in the next minute
          await UserService.updateUserNotificationPreferences(user._id, {
            frequency: 'realtime',
            // right now + 1 minute
            timeOfDay: moment().add(1, 'minute').format('HH:mm'),
            timezone: 'America/Recife'
          });

          await UserService.setUserActive(user._id, true);

          const response = `Just received your location! Latitude: ${msg.location.latitude}, Longitude: ${msg.location.longitude}. You will receive air quality updates shortly.`;
          await this.enqueueMessage(sender, response);
        }

      } catch (error) {
        console.error('Erro ao processar mensagem recebida:', error);
      }
    });

    try {
      await this.client.initialize();
    } catch (error) {
      console.error('Erro ao inicializar cliente WhatsApp:', error);
      throw error;
    }
  }

  async enqueueMessage(to, message) {
    const messageItem = {
      to,
      message,
      timestamp: Date.now()
    };

    this.messageQueue.push(messageItem);
    console.log(`Mensagem enfileirada para ${to}`);

    if (this.isReady && !this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0 || !this.isReady) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const messageItem = this.messageQueue[0];

      try {
        const formattedNumber = `${messageItem.to}@c.us`;
        await this.client.sendMessage(formattedNumber, messageItem.message);
        console.log(`Mensagem enviada com sucesso para ${messageItem.to}`);
        
        this.messageQueue.shift();
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      } catch (error) {
        console.error(`Erro ao enviar mensagem para ${messageItem.to}:`, error);
        this.messageQueue.shift();
      }
    }

    this.isProcessing = false;
  }

  getQueueStatus() {
    return {
      queueLength: this.messageQueue.length,
      isProcessing: this.isProcessing,
      isReady: this.isReady,
      currentQueue: this.messageQueue
    };
  }
}

export default new WhatsappService();