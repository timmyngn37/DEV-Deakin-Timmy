/**
 * embedding.ts
 * ------------------------------------------------------------------
 * Provides a utility function to generate vector embeddings for text
 * using OpenAI's text-embedding-3-small model. The embeddings are used
 * for semantic search and retrieval in the RAG chatbot project.
 * ------------------------------------------------------------------
 */
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateEmbedding(text: string): Promise<number[]> {
    const input = text.replaceAll("\n", " "); // Replace newlines with spaces for better embedding quality

    const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: input,
    });

    return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((text) => text.replaceAll("\n", " ")); // Replace newlines with spaces for better embedding quality

    const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: inputs,
    });

    return embeddings;
}