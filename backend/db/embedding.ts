/**
 * embedding.ts
 * ------------------------------------------------------------------
 * Provides a utility function to generate vector embeddings for text
 * using Google's Gemini embedding model. The embeddings are used
 * for semantic search and retrieval in the RAG chatbot project.
 * ------------------------------------------------------------------
 */
import { embed, embedMany } from "ai";
import { google } from "@ai-sdk/google";

const embeddingModel = google.embedding("gemini-embedding-001");
const embeddingProviderOptions = {
    google: {
        outputDimensionality: 1536,
        taskType: "RETRIEVAL_DOCUMENT" as const,
    },
};

export async function generateEmbedding(text: string): Promise<number[]> {
    const input = text.replaceAll("\n", " "); // Replace newlines with spaces for better embedding quality

    const { embedding } = await embed({
        model: embeddingModel,
        value: input,
        providerOptions: embeddingProviderOptions,
    });

    return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((text) => text.replaceAll("\n", " ")); // Replace newlines with spaces for better embedding quality

    const { embeddings } = await embedMany({
        model: embeddingModel,
        values: inputs,
        providerOptions: embeddingProviderOptions,
    });

    return embeddings;
}