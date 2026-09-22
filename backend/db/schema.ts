/**
 * schema.ts
 * ------------------------------------------------------------------
 * Drizzle ORM database schema definitions for the RAG chatbot project.
 * Defines the "documents" table structure, including columns for
 * storing document content and vector embeddings, as well as an
 * HNSW index for efficient similarity search.
 * ------------------------------------------------------------------
 */

import { pgTable, serial, text, vector, index } from "drizzle-orm/pg-core";

// "documents" table - stores RAG corpus chunks and their vector embeddings
export const documents = pgTable("documents", {
    id: serial("id").primaryKey(),                                      // Auto-incrementing primary key
    content: text("content").notNull(),                                 // Raw text content of the document chunk
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),     // OpenAI text-embedding-ada-002 vector (1536-dim)
}, (table) => [
    // HNSW index for fast approximate nearest-neighbour cosine similarity search
    index("documents_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

// Inferred TypeScript types for insert and select operations
export type InsertDocument = typeof documents.$inferInsert;
export type SelectDocument = typeof documents.$inferSelect;
