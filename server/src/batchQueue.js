export class BatchQueue {
  constructor(intervalMs) {
    this.intervalMs = intervalMs;
    this.pending = new Map();
    this.timer = setInterval(() => this.flush(), intervalMs);
    this.timer.unref?.();
  }

  enqueue(key, task) {
    const existing = this.pending.get(key);
    if (existing) {
      return existing.promise;
    }

    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.pending.set(key, { task, promise, resolve, reject });
    return promise;
  }

  async flush() {
    if (this.pending.size === 0) return;

    const batch = [...this.pending.values()];
    this.pending.clear();

    for (const item of batch) {
      try {
        item.resolve(await item.task());
      } catch (error) {
        item.reject(error);
      }
    }
  }

  close() {
    clearInterval(this.timer);
  }
}
