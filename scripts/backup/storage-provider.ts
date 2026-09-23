import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StorageObjectMeta {
  key: string;
  lastModified: Date;
  size: number;
  metadata?: Record<string, string>;
}

export interface BackupStorageProvider {
  putObject(key: string, data: Buffer, metadata?: Record<string, string>, lastModified?: Date): Promise<void>;
  getObject(key: string): Promise<{ data: Buffer; metadata: Record<string, string> } | null>;
  deleteObject(key: string): Promise<void>;
  listObjects(prefix?: string): Promise<StorageObjectMeta[]>;
}

export class MemoryBackupStorage implements BackupStorageProvider {
  private store = new Map<string, { data: Buffer; metadata: Record<string, string>; lastModified: Date }>();

  async putObject(
    key: string,
    data: Buffer,
    metadata: Record<string, string> = {},
    lastModified?: Date
  ): Promise<void> {
    this.store.set(key, { data, metadata, lastModified: lastModified ?? new Date() });
  }

  async getObject(key: string): Promise<{ data: Buffer; metadata: Record<string, string> } | null> {
    const item = this.store.get(key);
    return item ? { data: item.data, metadata: item.metadata } : null;
  }

  async deleteObject(key: string): Promise<void> {
    this.store.delete(key);
  }

  async listObjects(prefix = ''): Promise<StorageObjectMeta[]> {
    const results: StorageObjectMeta[] = [];
    for (const [key, val] of this.store.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        results.push({
          key,
          lastModified: val.lastModified,
          size: val.data.length,
          metadata: val.metadata,
        });
      }
    }
    return results;
  }
}

export class LocalDirectoryBackupStorage implements BackupStorageProvider {
  constructor(private baseDir: string) {}

  private getFilePath(key: string): string {
    return path.join(this.baseDir, key);
  }

  async putObject(key: string, data: Buffer, metadata: Record<string, string> = {}): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata), 'utf-8');
  }

  async getObject(key: string): Promise<{ data: Buffer; metadata: Record<string, string> } | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath);
      let metadata: Record<string, string> = {};
      try {
        const metaStr = await fs.readFile(`${filePath}.meta.json`, 'utf-8');
        metadata = JSON.parse(metaStr);
      } catch {
        // metadata file optional
      }
      return { data, metadata };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(`${filePath}.meta.json`).catch(() => {});
  }

  async listObjects(prefix = ''): Promise<StorageObjectMeta[]> {
    const results: StorageObjectMeta[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries: string[] = [];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.endsWith('.meta.json')) continue;
        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath);
        } else {
          const relKey = path.relative(this.baseDir, fullPath).replace(/\\/g, '/');
          if (!prefix || relKey.startsWith(prefix)) {
            let metadata: Record<string, string> | undefined;
            try {
              const metaStr = await fs.readFile(`${fullPath}.meta.json`, 'utf-8');
              metadata = JSON.parse(metaStr);
            } catch {
              // optional
            }
            results.push({
              key: relKey,
              lastModified: stat.mtime,
              size: stat.size,
              metadata,
            });
          }
        }
      }
    };
    await walk(this.baseDir);
    return results;
  }
}
