
import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR } from './config.js';

export interface VectorDocument {
    id: string;
    text: string;
    metadata: Record<string, any>;
    embedding: number[];
}

export class LocalVectorStore {
    private filePath: string;
    private documents: VectorDocument[] = [];
    private loaded = false;

    constructor() {
        this.filePath = path.join(DATA_DIR, 'vectors.json');
    }

    async load() {
        if (this.loaded) return;
        try {
            if (await fs.pathExists(this.filePath)) {
                this.documents = await fs.readJSON(this.filePath);
            }
        } catch (e) {
            console.error('[VectorStore] Failed to load vectors', e);
            this.documents = [];
        }
        this.loaded = true;
    }

    async save() {
        try {
            await fs.writeJSON(this.filePath, this.documents);
        } catch (e) {
            console.error('[VectorStore] Failed to save vectors', e);
        }
    }

    async addDocuments(docs: VectorDocument[]) {
        await this.load();
        const newIds = new Set(docs.map(d => d.id));
        // Remove existing documents with same ID (upsert)
        this.documents = this.documents.filter(d => !newIds.has(d.id));
        this.documents.push(...docs);
        await this.save();
    }

    async search(queryEmbedding: number[], k: number = 5): Promise<VectorDocument[]> {
        await this.load();
        if (this.documents.length === 0) return [];

        const scores = this.documents.map(doc => {
            return {
                doc,
                score: cosineSimilarity(queryEmbedding, doc.embedding)
            };
        });

        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, k).map(s => s.doc);
    }
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
