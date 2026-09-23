/**
 * ingest-corpus.ts
 * ------------------------------------------------------------------
 * This script ingests all PDF files from the "../corpus" directory,
 * extracts their text content, generates vector embeddings using Google's Gemini embedding model,
 * and stores the chunks and their embeddings in the database.
 * ------------------------------------------------------------------
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ingestPdf } from "./ingest-pdf";

const corpusDirectory = path.resolve(process.cwd(), "../corpus");

async function ingestCorpus() {
    const entries = await fs.readdir(corpusDirectory, { withFileTypes: true });
    const pdfFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
        .map((entry) => path.join(corpusDirectory, entry.name));

    if (pdfFiles.length === 0) {
        console.log(`No PDF files found in ${corpusDirectory}`);
        return;
    }

    for (const pdfFile of pdfFiles) {
        await ingestPdf(pdfFile);
    }

    console.log(`Corpus ingestion complete: ${pdfFiles.length} PDF file(s) checked.`);
}

ingestCorpus().catch((error: unknown) => {
    console.error("Corpus ingestion failed:", error);
    process.exitCode = 1;
});