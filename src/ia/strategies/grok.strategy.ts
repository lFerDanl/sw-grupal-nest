// src/ia/strategies/grok.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IAStrategy, GenerationOptions } from './ia.strategy';
import { ChatMessage } from '../interfaces/chat-message.interface';

interface GrokResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class GrokStrategy implements IAStrategy {
  private readonly logger = new Logger(GrokStrategy.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'GROK_API_URL', 
      'https://api.x.ai/v1'
    );
    this.apiKey = this.configService.get<string>('GROK_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn('⚠️ GROK_API_KEY no configurada. Este proveedor no funcionará.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  getProviderName(): string {
    return 'X Grok';
  }

  /**
   * Genera un vector de embedding para un texto dado usando Grok
   * @param text Texto para generar el embedding
   * @returns Vector de embedding como string (formato JSON)
   */
  async generateEmbedding(text: string): Promise<string> {
    try {
      this.logger.log('Generando embedding con Grok');
      
      // Endpoint para embeddings de Grok
      const response = await this.axiosInstance.post('/embeddings', {
        input: text,
        model: 'grok-embedding-001', // Modelo de embeddings de Grok
      });
      
      if (response.data && response.data.data && response.data.data[0]) {
        return JSON.stringify(response.data.data[0].embedding);
      } else {
        throw new Error('Respuesta de embedding inválida');
      }
    } catch (error) {
      this.logger.error('Error al generar embedding con Grok:', error.message);
      throw new Error(`Error al generar embedding: ${error.message}`);
    }
  }

  async generateChatCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): Promise<string> {
    try {
      this.logger.log(`[${this.getProviderName()}] Generando texto con chat completions`);
      
      const response = await this.axiosInstance.post<GrokResponse>(
        '/chat/completions',
        {
          model: 'grok-beta',
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 1000,
          top_p: options?.top_p ?? 0.95,
          stop: options?.stop,
          stream: false
        }
      );

      const generatedText = response.data.choices[0]?.message?.content || '';
      
      this.logger.log(`[${this.getProviderName()}] Texto generado. Tokens: ${response.data.usage.total_tokens}`);
      
      return generatedText.trim();
    } catch (error) {
      this.logger.error(`[${this.getProviderName()}] Error:`, error.message);
      if (axios.isAxiosError(error)) {
        throw new Error(`Error de API ${this.getProviderName()}: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/models', {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`[${this.getProviderName()}] Health check falló:`, error.message);
      return false;
    }
  }
}