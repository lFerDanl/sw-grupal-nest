// src/ia/ia.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IAService } from './ia.service';
import { GrokStrategy } from './strategies/grok.strategy';
import { GeminiStrategy } from './strategies/gemini.strategy';

@Module({
  imports: [ConfigModule],
  providers: [
    IAService,
    GrokStrategy,
    GeminiStrategy,
  ],
  exports: [IAService],
})
export class IAModule {}