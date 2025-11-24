// src/ia/strategies/ia.strategy.ts
import { ChatMessage } from '../interfaces/chat-message.interface';

export interface GenerationOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
}

export interface GenerationResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interfaz base para todas las estrategias de IA
 */
export interface IAStrategy {
  /**
   * Genera texto usando mensajes de chat
   */
  generateChatCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): Promise<string>;

  /**
   * Verifica si el servicio está disponible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Obtiene el nombre del proveedor
   */
  getProviderName(): string;
  
  /**
   * Genera un vector de embedding para un texto dado
   * @param text Texto para generar el embedding
   * @returns Vector de embedding como string (formato JSON)
   */
  generateEmbedding?(text: string): Promise<string>;
}