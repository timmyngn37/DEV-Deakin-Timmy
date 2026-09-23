/**
 * ingest-pdf.ts
 * ------------------------------------------------------------------
 * This script ingests a PDF file, extracts its text content, splits
 * the content into chunks, generates embeddings for each chunk, and
 * stores the chunks and their embeddings in the database.
 * ------------------------------------------------------------------
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { db } from "./config";
import { documents } from "./schema";
import { generateEmbeddings } from "./embedding";
import { chunkContent } from "./chunking";

export async function ingestPdf(filePath: string) {
    if (!filePath.toLowerCase().endsWith(".pdf")) {
        throw new Error("The input file must have a .pdf extension");
    }

    const absolutePath = path.resolve(filePath);
    const buffer = await fs.readFile(absolutePath);
    const parser = new PDFParse({ data: buffer });
    let data;

    try {
        data = await parser.getText();
    } finally {
        await parser.destroy();
    }

    if (!data.text || data.text.trim().length === 0) {
        throw new Error("No text found in PDF");
    }

    const chunks = await chunkContent(data.text);
    const storedRows = await db.select({ content: documents.content }).from(documents);
    const newChunks = chunks.filter((chunk) => !storedRows.some((row) => row.content === chunk));

    if (newChunks.length === 0) {
        console.log(`Skipped ${absolutePath}; all chunks are already stored.`);
        return;
    }

    const embeddings = await generateEmbeddings(newChunks);

    if (newChunks.length !== embeddings.length) {
        throw new Error("The embedding count does not match the chunk count");
    }

    const records = newChunks.map((content, index) => ({
        content,
        embedding: embeddings[index],
    }));

    await db.insert(documents).values(records);
    console.log(`Inserted ${records.length} searchable chunks from ${absolutePath}`);
}

if (process.argv[1]?.endsWith("ingest-pdf.ts")) {
    const filePath = process.argv[2];

    if (!filePath) {
        console.error("Usage: npm run ingest:pdf -- ./path/to/file.pdf");
        process.exitCode = 1;
    } else {
        ingestPdf(filePath).catch((error: unknown) => {
            console.error("PDF ingestion failed:", error);
            process.exitCode = 1;
        });
    }
}