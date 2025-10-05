import wwebjs from "whatsapp-web.js";
const { Client, MessageMedia, LocalAuth } = wwebjs;
import fs from "fs";
import qrcode from "qrcode-terminal";
import moment from "moment-timezone";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import dotenv from "dotenv";
import axios from "axios";
import { getAirQuality } from './query_api.js';



console.log("Running starter script...");
dotenv.config();
// using mongoose model (this should be separated  from this file)
import mongoose from 'mongoose';

// connect to mongodb
mongoose.connect(`mongodb://${process.env.MONGO_USER || 'admin'}:${process.env.MONGO_PASSWORD || 'senha123'}@localhost:27017/${process.env.DB_NAME || 'default'}?authSource=admin`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const messageSchema = mongoose.Schema({
  message: String,
  messageId: String,
  groupId: String,
  date: {type: Date, default: Date.now}
});

const messageModel = mongoose.model('Message', messageSchema);

// every user has its preferred location (which can be its current location)
const userSchema = mongoose.Schema({
  phone: String,
  location: {
    address: String,
    latitude: Number,
    longitude: Number
  }
});

const userModel = mongoose.model('User', userSchema);

const previsionsSchema = mongoose.Schema({
  location: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  // others (pm25, pm10, o3, no2, so2, co)
  aqi: Number,
  date: {type: Date, default: Date.now}
});

const previsionsModel = mongoose.model('Previsions', previsionsSchema);
//             ---------------                           //

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || null;
const GROUP_ID = process.env.GROUP_ID || null;
const API_URL = process.env.API_URL || null;

moment.locale("pt-br");
// use recife time
moment.tz.setDefault("America/Recife");
const currentDate = moment().format("L LTS");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  session: false,
});
  
client.on("qr", (qr) => {
  // Gera o QR code no terminal
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  // started at dd/mm/yyyy hh:mm:ss
  console.log(`Client is ready! @ ${currentDate}`);

  // inicia o envio de mensagens a cada certo tempo
  setInterval(sendMessage, 1 * 60 * 1000);
});

client.on("authenticated", () => {
  console.log("Client is authenticated!");
});

client.on("message", async (msg) => {
  try {
    var USER_PHONE;
    var SENDER_TYPE;
    const contact = await msg.getContact();
    const name = contact.name || contact.pushname;

    // se for grupo, identificar
    // check if it is a group or individual chat
    // if it is from a group, get group name
    var latitude = null;
    var longitude = null;
    if (msg.from.split("@")[1] === "g.us") {
      const group = await client.getChatById(msg.from);
      const groupName = group.name;
      SENDER_TYPE = "GROUP";
      USER_PHONE = msg.author.split("@")[0];
      if (msg.type === "location") {
        console.log(
          `Localização recebida de ${name} ${USER_PHONE} (em grupo: ${groupName}): "${JSON.stringify(msg.location)}"\n`
        );
        //console.log(`latitude: ${msg.location.latitude}, longitude: ${msg.location.longitude}`);
        latitude = msg.location.latitude;
        longitude = msg.location.longitude;
        
        const response = await getAirQuality(latitude, longitude);
        console.log(response);
        if (response.status === 'ok') {
          const aqi = response.data.aqi;
          let aqiMessage = `O índice de qualidade do ar (AQI) na sua localização é ${aqi}. `;
          if (aqi <= 50) {
            aqiMessage += "A qualidade do ar está boa.";
          } else if (aqi <= 100) {
            aqiMessage += "A qualidade do ar está moderada.";
          } else if (aqi <= 150) {
            aqiMessage += "A qualidade do ar está ruim para grupos sensíveis.";
          } else if (aqi <= 200) {
            aqiMessage += "A qualidade do ar está ruim.";
          } else if (aqi <= 300) {
            aqiMessage += "A qualidade do ar está muito ruim.";
          } else {
            aqiMessage += "A qualidade do ar está perigosa.";
          }
          await client.sendMessage(msg.from, aqiMessage);
          
          // save to database
          await previsionsModel.create({
            location: {
              address: response.data.city.name,
              latitude: latitude,
              longitude: longitude
            },
            aqi: aqi
          });
        } else {
          await client.sendMessage(msg.from, `Não foi possível obter os dados de qualidade do ar para sua localização.`);
        }

        // check if user is already registered
        const user = await userModel.findOne({ phone: USER_PHONE });
        if (user) {
          // update user informations
          //await userModel.updateOne({ phone: USER_PHONE }, { location: { address, latitude, longitude }, busStop: closestBusStop.codigo });
          //console.log(`Usuário ${USER_PHONE} atualizado com localização: ${latitude}, ${longitude} e parada: ${closestBusStop.codigo}`);
          console.log(`Usuário ${USER_PHONE} atualizado com localização: ${latitude}, ${longitude}`);
          //await client.sendMessage(msg.from, `Localização atualizada com sucesso!`);
        } else {
          // create new user
          //await userModel.create({ phone: USER_PHONE, location: { address, latitude, longitude }, busStop: closestBusStop.codigo });
          //console.log(`Usuário ${USER_PHONE} criado com localização: ${latitude}, ${longitude} e parada: ${closestBusStop.codigo}`);
          console.log(`Usuário ${USER_PHONE} criado com localização: ${latitude}, ${longitude}`);
          //await client.sendMessage(msg.from, `Localização cadastrada com sucesso!`);
        }
      } else {
        console.log(
          `Mensagem recebida de ${name} ${USER_PHONE} (em grupo: ${groupName}): "${msg.body}"`
        );
      }
    } else {
      SENDER_TYPE = "PRIVATE";
      USER_PHONE = msg.from.split("@")[0];
      console.log(
        `Mensagem recebida de ${name} ${USER_PHONE}: "${msg.body}"`
      );
    }
  } catch (e) {
    console.log("Error in message listening event:", e);
  }
});

client.on("disconnected", (reason) => {
  console.error("===CLIENT WAS LOGGED OUT===: ", reason);
  
});

client.initialize();