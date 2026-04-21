import dotenv from "dotenv";

dotenv.config();

const required = [
  "MYSQL_HOST",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "JWT_SECRET"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  mysqlHost: process.env.MYSQL_HOST,
  mysqlPort: Number(process.env.MYSQL_PORT ?? 3306),
  mysqlDatabase: process.env.MYSQL_DATABASE,
  mysqlUser: process.env.MYSQL_USER,
  mysqlPassword: process.env.MYSQL_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h"
};
