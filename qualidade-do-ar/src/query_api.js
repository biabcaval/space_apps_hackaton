import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_TOKEN = process.env.WAQI_TOKEN || 'seu_token_aqui';

/**
 * Consulta os dados de qualidade do ar para uma localização específica
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise} Promise contendo os dados da qualidade do ar
 */
export const getAirQuality = async (latitude, longitude) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'fetch_air_quality.py'),
      latitude.toString(),
      longitude.toString(),
      API_TOKEN
    ]);

    let dataString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Erro Python: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Processo Python terminou com código ${code}`));
        return;
      }
      
      try {
        const result = JSON.parse(dataString);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(new Error('Erro ao processar resposta Python'));
      }
    });
  });
};