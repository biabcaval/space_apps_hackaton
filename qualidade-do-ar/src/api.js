import express from "express";
import axios from "axios";
import dotenv from "dotenv";

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const API_TOKEN = process.env.WAQI_TOKEN;

// Middleware para verificar token
const checkApiToken = (req, res, next) => {
  if (!API_TOKEN) {
    return res.status(500).json({
      error: "Token da API WAQI não configurado"
    });
  }
  next();
};

// Middleware para validar parâmetros
const validateCoordinates = (req, res, next) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({
      error: "Latitude e longitude são obrigatórios"
    });
  }

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({
      error: "Latitude e longitude devem ser números"
    });
  }

  next();
};

app.get("/air-quality", checkApiToken, validateCoordinates, async (req, res) => {
  const { lat, lon } = req.query;
  
  try {
    const response = await axios.get(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${API_TOKEN}`,
      {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status === 'error') {
      return res.status(400).json({
        error: response.data.data
      });
    }

    res.json(response.data);
  } catch (err) {
    console.error('Erro na API WAQI:', err.message);
    
    if (err.response) {
      return res.status(err.response.status).json({
        error: `Erro na API WAQI: ${err.response.data}`
      });
    }

    res.status(500).json({
      error: "Erro interno ao consultar dados de qualidade do ar"
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});