import express from "express";
import dotenv from "dotenv";
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import NotificationService from './services/NotificationService.js';
import SchedulerService from "./services/SchedulerService.js";

dotenv.config();

const app = express();

const mongoUri = `mongodb://${process.env.MONGO_USER || 'admin'}:${process.env.MONGO_PASSWORD || 'senha123'}@localhost:27017/${process.env.DB_NAME || 'air-quality'}?authSource=admin`;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      await NotificationService.initialize();
      console.log('Todos os serviços inicializados com sucesso');
    } catch (err) {
      console.error('Erro na inicialização dos serviços:', err);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());
app.use('/api', userRoutes);
app.use('/api', notificationRoutes);

app.get("/air-quality-tempo", checkApiToken, validateCoordinates, async (req, res) => {
  const { lat, lon } = req.query;
  
 
});


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});