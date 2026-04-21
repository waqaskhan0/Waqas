import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`IMS backend listening on port ${env.port}`);
});
