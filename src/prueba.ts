import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as dotenv from "dotenv";

dotenv.config();

// No existe el contexto de Nest aquí, así que usamos ConfigService directamente
const config = new ConfigService();

export default new DataSource({
  type: "postgres",
  host: config.get("DB_HOST"),
  port: config.get("DB_PORT"),
  username: config.get("DB_USER"),
  password: config.get("DB_PASSWORD"),
  database: config.get("DB_NAME"),
  entities: ["dist/**/*.entity.js"],
  migrations: ["dist/migrations/*.js"],
  ssl: process.env.POSTGRES_SSL === "true",
});