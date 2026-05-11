import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? "development";

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

function parseClientUrls(value) {
  const configuredUrls = String(value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const developmentUrls =
    nodeEnv === "production" ? [] : ["http://localhost:5173", "http://localhost:5174"];

  const urls = Array.from(new Set([...configuredUrls, ...developmentUrls]));
  return urls.length > 0 ? urls : ["http://localhost:5173"];
}

const clientUrls = parseClientUrls(process.env.CLIENT_URL);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  clientUrl: clientUrls[0],
  clientUrls,
  mysqlHost: process.env.MYSQL_HOST,
  mysqlPort: Number(process.env.MYSQL_PORT ?? 3306),
  mysqlDatabase: process.env.MYSQL_DATABASE,
  mysqlUser: process.env.MYSQL_USER,
  mysqlPassword: process.env.MYSQL_PASSWORD ?? "",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h"
};
