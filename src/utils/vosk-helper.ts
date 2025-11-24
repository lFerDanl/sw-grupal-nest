const fs = require('fs');
const path = require('path');
const wav = require('wav');
const vosk = require('vosk');

/**
 * Transcribe un archivo WAV usando Vosk.
 * Requiere tener un modelo Vosk descargado en la carpeta 'models/vosk-model'.
 */
async function transcribeWithVosk(audioPath) {
  const modelPath = path.resolve('./models/vosk-model');
  if (!fs.existsSync(modelPath)) {
    throw new Error('Modelo Vosk no encontrado en ./models/vosk-model');
  }

  // Crear el modelo
  const model = new vosk.Model(modelPath);

  // Opcional: reducir logs de Vosk
  vosk.setLogLevel(0);

  const reader = fs.createReadStream(audioPath);
  const wfReader = new wav.Reader();

  return new Promise((resolve, reject) => {
    let transcription = '';

    wfReader.on('format', ({ sampleRate }) => {
      // Crear el recognizer con el modelo y la frecuencia de sampleo
      const rec = new vosk.Recognizer({ model, sampleRate });

      wfReader.on('data', (chunk) => {
        rec.acceptWaveform(chunk);
      });

      wfReader.on('end', () => {
        const finalResult = rec.finalResult();
        rec.free();    // liberar recursos del recognizer
        model.free();  // liberar recursos del modelo
        transcription = finalResult.text || '';
        resolve(transcription);
      });
    });

    wfReader.on('error', reject);
    reader.pipe(wfReader);
  });
}

module.exports = {
  transcribeWithVosk,
};
