/**
 * config.ts
 * ------------------------------------------------------------------
 * Drizzle ORM database configuration for the RAG chatbot project.
 * Specifies the database connection credentials and initializes
 * the Drizzle ORM instance for interacting with the Postgres database.
 * ------------------------------------------------------------------
 */

import { neon } from "@neondatabase/serverless";   // Neon serverless Postgres driver
import { drizzle } from "drizzle-orm/neon-http";   // Drizzle adapter for Neon's HTTP-based queries
import { config } from "dotenv";                   // Loads environment variables from .env

// Load environment variables from the repository-root .env
config({ path: "../.env" });

// Create the Neon SQL query function using the database connection string
const sql = neon(process.env.NEON_DATABASE_URL!);

export const db = drizzle(sql);

