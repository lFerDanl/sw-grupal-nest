// src/ia/strategies/gemini.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold
} from '@google/generative-ai';
import { IAStrategy, GenerationOptions } from './ia.strategy';
import { ChatMessage } from '../interfaces/chat-message.interface';

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

@Injectable()
export class GeminiStrategy implements IAStrategy {
  private readonly logger = new Logger(GeminiStrategy.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash-exp');
    
    if (!apiKey) {
      this.logger.warn('⚠️ GEMINI_API_KEY no configurada. Este proveedor no funcionará.');
    }

    // Inicializar el cliente del SDK oficial
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  getProviderName(): string {
    return 'Gemini';
  }

  /**
   * Genera un vector de embedding para un texto dado usando Gemini
   * @param text Texto para generar el embedding
   * @returns Vector de embedding como string (formato JSON)
   */
  async generateEmbedding(text: string): Promise<string> {
    try {
      this.logger.log('Generando embedding con Gemini');
      
      // Modelo de embeddings de Gemini
      const embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
      
      // Generar el embedding
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;
      
      return JSON.stringify(embedding);
    } catch (error) {
      this.logger.error('Error al generar embedding con Gemini:', error.message);
      throw new Error(`Error al generar embedding: ${error.message}`);
    }
  }

  private convertMessagesToGemini(messages: ChatMessage[]): GeminiContent[] {
    const geminiMessages: GeminiContent[] = [];
    
    for (const msg of messages) {
      // Gemini usa 'user' y 'model' en lugar de 'user' y 'assistant'
      const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role;
      
      // Si es un mensaje de sistema, lo combinamos con el siguiente mensaje de usuario
      if (msg.role === 'system') {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else {
        geminiMessages.push({
          role,
          parts: [{ text: msg.content }]
        });
      }
    }
    
    return geminiMessages;
  }

  async generateChatCompletion(
    messages: ChatMessage[],
    options?: GenerationOptions
  ): Promise<string> {
    try {
      this.logger.log(`[${this.getProviderName()}] Generando texto con chat completions`);
      
      const geminiContents = this.convertMessagesToGemini(messages);
      
      // 🔧 SOLUCIÓN: Aumentar maxOutputTokens dinámicamente para modelos 2.5
      let maxTokens = options?.max_tokens ?? 8192;
      
      // Para gemini-2.5-flash, usar tokens más altos por defecto debido al thinking
      if (this.model.includes('2.5')) {
        // Si el max_tokens solicitado es bajo, usar un mínimo seguro
        const minTokensFor25 = 6000;
        if (maxTokens < minTokensFor25) {
          this.logger.log(
            `[${this.getProviderName()}] 📈 Aumentando max_tokens de ${maxTokens} a ${minTokensFor25} ` +
            `para ${this.model} (compensa thinking tokens)`
          );
          maxTokens = minTokensFor25;
        }
      }
      
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: maxTokens,
          topP: options?.top_p ?? 0.95,
          topK: options?.top_k ?? 40,
          stopSequences: options?.stop,
        }
      });

      this.logger.debug(`[${this.getProviderName()}] Configuración: maxOutputTokens=${maxTokens}, model=${this.model}`);

      // Generar contenido usando el SDK
      const result = await model.generateContent({
        contents: geminiContents
      });

      const response = result.response;

      // ✅ Verificar si el contenido fue bloqueado
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Contenido bloqueado por Gemini: ${response.promptFeedback.blockReason}`);
      }

      // ✅ Verificar estructura de respuesta
      if (!response.candidates || response.candidates.length === 0) {
        this.logger.error(`[${this.getProviderName()}] No se recibieron candidatos en la respuesta`);
        throw new Error('La API de Gemini no devolvió candidatos. Verifica la estructura de la petición.');
      }

      const candidate = response.candidates[0];
      const metadata = response.usageMetadata as any;
      
      // ⚠️ Manejar finishReason MAX_TOKENS
      if (candidate.finishReason === 'MAX_TOKENS') {
        this.logger.warn(
          `[${this.getProviderName()}] ⚠️ La respuesta fue truncada por MAX_TOKENS. ` +
          `Tokens usados: ${metadata?.totalTokenCount}, ` +
          `Output: ${metadata?.candidatesTokenCount}, ` +
          `Thinking: ${metadata?.thoughtsTokenCount || 0}`
        );
        
        // Si hay mucho thinking, advertir al usuario
        if (metadata?.thoughtsTokenCount > maxTokens * 0.3) {
          this.logger.warn(
            `[${this.getProviderName()}] 💭 El modelo usó ${metadata.thoughtsTokenCount} tokens en "thinking" ` +
            `(${Math.round(metadata.thoughtsTokenCount / maxTokens * 100)}% del límite). ` +
            `La respuesta puede estar incompleta.`
          );
        }
      }

      // 🔧 Intentar obtener el texto
      let generatedText = '';
      
      try {
        generatedText = response.text();
        this.logger.debug(`[${this.getProviderName()}] Texto obtenido con response.text()`);
      } catch (error) {
        this.logger.warn(`[${this.getProviderName()}] response.text() falló: ${error.message}`);
        
        // Fallback: acceso directo a parts
        if (candidate.content?.parts && candidate.content.parts.length > 0) {
          generatedText = candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('');
        }
      }

      // ❌ Si no hay texto, es un error
      if (!generatedText || generatedText.trim() === '') {
        const debugInfo = {
          finishReason: candidate.finishReason,
          hasContent: !!candidate.content,
          thoughtsTokenCount: metadata?.thoughtsTokenCount || 0,
          totalTokenCount: metadata?.totalTokenCount || 0,
          maxOutputTokens: maxTokens
        };
        
        this.logger.error(`[${this.getProviderName()}] No se pudo extraer texto. Debug:`, debugInfo);
        
        if (candidate.finishReason === 'MAX_TOKENS' && metadata?.thoughtsTokenCount) {
          throw new Error(
            `El modelo usó ${metadata.thoughtsTokenCount} tokens en "pensamiento" ` +
            `y se quedó sin tokens para la respuesta. ` +
            `Aumenta maxOutputTokens a ${Math.max(maxTokens * 2, 10000)}.`
          );
        }
        
        throw new Error('El candidato de Gemini no contiene texto generado.');
      }

      const tokens = metadata?.totalTokenCount || 0;
      const thoughtsTokens = metadata?.thoughtsTokenCount || 0;
      const outputTokens = metadata?.candidatesTokenCount || 0;
      
      this.logger.log(
        `[${this.getProviderName()}] ✅ Texto generado exitosamente. ` +
        `Tokens: ${tokens} (output: ${outputTokens}, thinking: ${thoughtsTokens}), ` +
        `Razón: ${candidate.finishReason}`
      );
      
      return generatedText.trim();
    } catch (error) {
      this.logger.error(`[${this.getProviderName()}] Error:`, error.message);
      
      if (error.response) {
        this.logger.error(`[${this.getProviderName()}] Detalles del error:`, error.response);
      }
      
      throw new Error(`Error de API ${this.getProviderName()}: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.model,
        generationConfig: { maxOutputTokens: 10 }
      });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }]
      });
      
      return !!result.response.candidates;
    } catch (error) {
      this.logger.warn(`[${this.getProviderName()}] Health check falló:`, error.message);
      return false;
    }
  }
}