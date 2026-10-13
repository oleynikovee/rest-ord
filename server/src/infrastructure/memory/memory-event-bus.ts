import { EventEmitter } from 'node:events';
import { EventBus } from '../../domain/ports.js';

export class MemoryEventBus extends EventBus {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  async publish<T>(topic: string, payload: T): Promise<void> {
    this.emitter.emit(topic, payload);
  }

  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }
}
