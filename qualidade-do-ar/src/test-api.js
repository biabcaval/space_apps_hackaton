import { getAirQuality } from './query_api.js';

// Exemplo de uso
const buscarQualidadeDoAr = async () => {
  try {
    const dados = await getAirQuality("-23.4", "-46.5");
    console.log(dados);
  } catch (error) {
    console.error('Erro:', error);
  }
};

console.log(buscarQualidadeDoAr());