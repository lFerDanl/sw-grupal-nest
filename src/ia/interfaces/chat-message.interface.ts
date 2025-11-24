// src/ia/interfaces/chat-message.interface.ts
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }