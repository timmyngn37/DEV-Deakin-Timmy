/**
 * rag.js
 * ------------------------------------------------------------------
 * This file contains the implementation of the retrieveRelevantChunks function, which retrieves relevant chunks of text from a database based on a given query.
 * It uses the Neon database client and the AI embedding model to perform semantic search.
 * ------------------------------------------------------------------
 */

const { neon } = require('@neondatabase/serverless');

let sql;

function getDatabaseClient() {
    if (!sql) {
        const databaseUrl = process.env.NEON_DATABASE_URL?.trim();
        if (!databaseUrl) {
            throw new Error('NEON_DATABASE_URL is missing from the server configuration.');
        }
        sql = neon(databaseUrl);
    }
    return sql;
}

async function retrieveRelevantChunks(query, limit = 5) {
    const { embed } = await import('ai');
    const { google } = await import('@ai-sdk/google');
    const { embedding } = await embed({
        model: google.embedding('gemini-embedding-001'),
        value: query.replaceAll('\n', ' '),
        providerOptions: {
            google: {
                outputDimensionality: 1536,
                taskType: 'RETRIEVAL_QUERY',
            },
        },
    });

    const vector = `[${embedding.join(',')}]`;
    const rows = await getDatabaseClient()`
        SELECT id, content, 1 - (embedding <=> ${vector}::vector) AS similarity
        FROM documents
        ORDER BY embedding <=> ${vector}::vector
        LIMIT ${limit}
    `;

    return rows.filter((row) => Number(row.similarity) >= 0.35);
}

module.exports = { retrieveRelevantChunks };