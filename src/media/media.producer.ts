// src/media/media.producer.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

@Injectable()
export class MediaProducer {
  constructor(
    @InjectQueue('video-processing-queue') 
    private readonly queue: Queue
  ) {}

  async enqueue(mediaId: number) {
    const id = randomUUID();
    
    return await this.queue.add(
      'process-media', 
      { mediaId }, 
      { 
        jobId: id,
      }
    );
  }
}