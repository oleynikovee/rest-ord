import type { EventEnvelope, LoggedEvent } from '../../domain/models.js';
import { EventLog } from '../../domain/ports.js';

interface Entry {
  envelope: EventEnvelope;
  published: boolean;
  at: number;
}

export class MemoryEventLog extends EventLog {
  private readonly entries: Entry[] = [];
  private readonly listeners = new Set<() => void>();
  private seq = 0;

  append(event: LoggedEvent): void {
    const envelope = { ...structuredClone(event), seq: ++this.seq } as EventEnvelope;
    this.entries.push({ envelope, published: false, at: Date.now() });
    queueMicrotask(() => this.listeners.forEach((listener) => listener()));
  }

  currentSeq(): number {
    return this.seq;
  }

  async latestSeq(): Promise<number> {
    return this.seq;
  }

  async readAfter(
    after: number,
    limit: number,
  ): Promise<{ events: EventEnvelope[]; oldestSeq: number | null }> {
    return {
      events: this.entries
        .filter((e) => e.envelope.seq > after)
        .slice(0, limit)
        .map((e) => structuredClone(e.envelope)),
      oldestSeq: this.entries[0]?.envelope.seq ?? null,
    };
  }

  async publishPending(
    publish: (event: EventEnvelope) => Promise<void>,
    batchSize: number,
  ): Promise<number> {
    const pending = this.entries.filter((e) => !e.published).slice(0, batchSize);
    for (const entry of pending) {
      await publish(structuredClone(entry.envelope));
      entry.published = true;
    }
    return pending.length;
  }

  async tryLead(): Promise<boolean> {
    return true;
  }

  onAppended(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async pendingStats(): Promise<{ pending: number; oldestAgeSeconds: number }> {
    const pending = this.entries.filter((e) => !e.published);
    return {
      pending: pending.length,
      oldestAgeSeconds: pending[0] ? (Date.now() - pending[0].at) / 1000 : 0,
    };
  }

  async prune(olderThanMs: number): Promise<number> {
    const threshold = Date.now() - olderThanMs;
    let removed = 0;
    while (this.entries[0]?.published && this.entries[0].at < threshold) {
      this.entries.shift();
      removed++;
    }
    return removed;
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }
}
