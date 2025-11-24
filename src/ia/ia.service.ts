// src/ia/ia.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAStrategy } from './strategies/ia.strategy';
import { GrokStrategy } from './strategies/grok.strategy';
import { GeminiStrategy } from './strategies/gemini.strategy';
import { ChatMessage } from './interfaces/chat-message.interface';

export type IAProvider = 'grok' | 'gemini';

export interface GenerationOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
}

@Injectable()
export class IAService {
  private readonly logger = new Logger(IAService.name);
  private strategies: Map<IAProvider, IAStrategy>;
  private currentProvider: IAProvider;

  constructor(
    private configService: ConfigService,
    private grokStrategy: GrokStrategy,
    private geminiStrategy: GeminiStrategy,
  ) {
    // Inicializar el mapa de estrategias
    this.strategies = new Map<IAProvider, IAStrategy>([
      ['grok', this.grokStrategy],
      ['gemini', this.geminiStrategy],
    ]);

    // Establecer el proveedor predeterminado desde la configuración
    const configProvider = this.configService.get<IAProvider>('IA_PROVIDER');
    this.currentProvider = (configProvider && this.strategies.has(configProvider)) 
      ? configProvider 
      : 'gemini';
    
    this.logger.log(`Servicio de IA inicializado con proveedor: ${this.currentProvider}`);
  }

  /**
   * Cambia el proveedor de IA en tiempo de ejecución
   */
  setProvider(provider: IAProvider): void {
    if (!this.strategies.has(provider)) {
      throw new Error(`Proveedor de IA no soportado: ${provider}`);
    }
    
    this.logger.log(`Cambiando proveedor de IA de ${this.currentProvider} a ${provider}`);
    this.currentProvider = provider;
  }

  /**
   * Obtiene el proveedor actual
   */
  getCurrentProvider(): IAProvider {
    return this.currentProvider;
  }

  /**
   * Obtiene la estrategia actual
   */
  private getCurrentStrategy(): IAStrategy {
    const strategy = this.strategies.get(this.currentProvider);
    if (!strategy) {
      throw new Error(`Estrategia no encontrada para el proveedor: ${this.currentProvider}`);
    }
    return strategy;
  }

  /**
   * Genera texto usando el proveedor actual
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions,
    provider?: IAProvider
  ): Promise<string> {
    try {
      // Si se especifica un proveedor temporal, usarlo
      const strategy = provider 
        ? this.strategies.get(provider)
        : this.getCurrentStrategy();

      if (!strategy) {
        throw new Error(`Proveedor no encontrado: ${provider || this.currentProvider}`);
      }

      this.logger.log(`Generando texto con proveedor: ${strategy.getProviderName()}`);
      
      return await strategy.generateChatCompletion(messages, options);
    } catch (error) {
      this.logger.error('Error al generar texto:', error.message);
      throw error;
    }
  }

  /**
   * Verifica si el proveedor actual está disponible
   */
  async healthCheck(provider?: IAProvider): Promise<boolean> {
    try {
      const strategy = provider 
        ? this.strategies.get(provider)
        : this.getCurrentStrategy();

      if (!strategy) {
        return false;
      }

      return await strategy.healthCheck();
    } catch (error) {
      this.logger.warn('Health check falló:', error.message);
      return false;
    }
  }

  /**
   * Verifica la salud de todos los proveedores
   */
  async healthCheckAll(): Promise<Record<IAProvider, boolean>> {
    const results: Record<IAProvider, boolean> = {} as any;
    
    for (const [provider, strategy] of this.strategies.entries()) {
      try {
        results[provider] = await strategy.healthCheck();
      } catch (error) {
        this.logger.warn(`Health check falló para ${provider}:`, error.message);
        results[provider] = false;
      }
    }
    
    return results;
  }

  /**
   * Obtiene información sobre todos los proveedores disponibles
   */
  getAvailableProviders(): Array<{ name: IAProvider; displayName: string }> {
    return Array.from(this.strategies.keys()).map(key => ({
      name: key,
      displayName: this.strategies.get(key)!.getProviderName()
    }));
  }

  /**
   * Genera un vector de embedding para un texto dado
   * @param text Texto para generar el embedding
   * @param provider Proveedor opcional (usa el actual si no se especifica)
   * @returns Vector de embedding como string
   */
  async generateEmbedding(text: string, provider?: IAProvider): Promise<string> {
    try {
      // Si se especifica un proveedor temporal, usarlo
      const strategy = provider 
        ? this.strategies.get(provider)
        : this.getCurrentStrategy();

      if (!strategy) {
        throw new Error(`Proveedor no encontrado: ${provider || this.currentProvider}`);
      }

      this.logger.log(`Generando embedding con proveedor: ${strategy.getProviderName()}`);
      
      // Verificar si la estrategia implementa la función de embedding
      if (typeof strategy['generateEmbedding'] !== 'function') {
        throw new Error(`El proveedor ${strategy.getProviderName()} no soporta la generación de embeddings`);
      }
      
      return await strategy['generateEmbedding'](text);
    } catch (error) {
      this.logger.error('Error al generar embedding:', error.message);
      // En caso de error, devolver un vector vacío o simulado
      return '[]';
    }
  }
}