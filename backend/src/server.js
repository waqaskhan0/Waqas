import { app } from "./app.js";
import { assertDatabaseConnection } from "./config/db.js";
import { env } from "./config/env.js";

try {
  await assertDatabaseConnection();

  app.listen(env.port, () => {
    console.log(`IMS backend listening on port ${env.port}`);
  });
} catch (error) {
  console.error("IMS backend failed to start because the database connection could not be established.");
  console.error(error);
  process.exit(1);
}
