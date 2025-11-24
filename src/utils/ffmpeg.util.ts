import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Extrae el audio de un video y devuelve la ruta al archivo .mp3 generado.
 * Requiere tener FFmpeg instalado en el sistema.
 */
export async function extractAudioFFmpeg(videoPath: string): Promise<string> {
  const audioPath = path.join(
    path.dirname(videoPath),
    `${path.basename(videoPath, path.extname(videoPath))}.mp3`
  );

  await execPromise(`ffmpeg -i "${videoPath}" -q:a 0 -map a "${audioPath}" -y`);
  return audioPath;
}

/**
 * Convierte cualquier archivo de audio a WAV mono 16kHz para Vosk.
 * -ac 1 → mono
 * -ar 16000 → 16 kHz
 */
export async function convertToWav(inputPath: string): Promise<string> {
  const wavPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}.wav`
  );

  await execPromise(
    `ffmpeg -i "${inputPath}" -ac 1 -ar 16000 "${wavPath}" -y`
  );

  return wavPath;
}
