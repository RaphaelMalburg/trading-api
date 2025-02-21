import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../../shared/schema";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const neonClient = neon(process.env.DATABASE_URL);
export { neonClient };
export const db = drizzle(neonClient);

export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async testConnection(): Promise<string> {
    try {
      const result = await neonClient`SELECT version()`;
      return result[0]?.version || "Unknown version";
    } catch (error) {
      console.error("[Database] Connection test failed:", error);
      throw error;
    }
  }

  public async findTrades() {
    try {
      return await db.select().from(schema.trades);
    } catch (error) {
      console.error("[Database] Find trades failed:", error);
      throw error;
    }
  }

  public async insertTrade(data: schema.InsertTrade) {
    try {
      const [trade] = await db.insert(schema.trades).values(data).returning();
      return trade;
    } catch (error) {
      console.error("[Database] Insert trade failed:", error);
      throw error;
    }
  }

  public async deleteTrade(id: number) {
    try {
      await db.delete(schema.trades).where(sql`${schema.trades.id} = ${id}`);
    } catch (error) {
      console.error("[Database] Delete trade failed:", error);
      throw error;
    }
  }
}
