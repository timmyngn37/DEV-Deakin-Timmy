/**
 * drizzle.config.ts
 * ------------------------------------------------------------------
 * Drizzle Kit configuration file for the RAG chatbot project.
 * Specifies the database schema, migration output directory, and
 * database connection credentials for Drizzle Kit to generate
 * migrations and manage the Postgres database schema.
 * ------------------------------------------------------------------
 */

import { defineConfig } from "drizzle-kit";   // Drizzle Kit's config helper
import { config } from "dotenv";              // Loads .env variables

// Load NEON_DATABASE_URL from the repository-root .env before the config is read
config({ path: "../.env" });

export default defineConfig({
    schema: "./db/schema.ts",        // Path to the Drizzle table definitions
    out: "./db/migrations",          // Output directory for generated migration files
    dialect: "postgresql",           // Target database dialect (Neon is Postgres-compatible)
    dbCredentials: {
        url: process.env.NEON_DATABASE_URL!,   // Connection string from .env
    },
});

