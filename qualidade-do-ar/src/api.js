import express from "express";
import dotenv from "dotenv";
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import NotificationService from './services/NotificationService.js';

dotenv.config();

const app = express();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air-quality')
  .then(() => {
    console.log('Connected to MongoDB');
    // Inicializa o serviço de notificações após conectar ao banco
    NotificationService.initialize()
      .then(() => console.log('Notification service initialized'))
      .catch(err => console.error('Error initializing notification service:', err));
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