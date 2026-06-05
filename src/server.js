require("dotenv").config();

const { createApp } = require("./app");
const { getConfig, validateRuntimeConfig } = require("./config");
const { createPool, initDatabase } = require("./db");

async function start() {
  const config = getConfig();
  validateRuntimeConfig(config);

  const pool = createPool(config.databaseUrl);
  await initDatabase(pool);

  const app = createApp({ pool, config });
  const server = app.listen(config.port, () => {
    console.log(`100-square fundraiser app listening on port ${config.port}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error) => {
  console.error("Failed to start app:", error.message);
  process.exit(1);
});
