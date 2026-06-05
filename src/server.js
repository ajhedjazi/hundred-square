require("dotenv").config();

const path = require("path");
const { createApp } = require("./app");
const { getConfig, validateRuntimeConfig } = require("./config");
const { createPool, createPostgresStore, initDatabase } = require("./db");
const { createLocalFileStore } = require("./local-store");

function describeError(error) {
  if (error && error.message) {
    return error.message;
  }

  if (error && error.code) {
    return error.code;
  }

  if (error && Array.isArray(error.errors) && error.errors.length > 0) {
    return describeError(error.errors[0]);
  }

  return String(error);
}

async function createStore(config) {
  if (config.databaseUrl) {
    const pool = createPool(config.databaseUrl);

    try {
      await initDatabase(pool);
      console.log("Storage: using PostgreSQL.");
      return createPostgresStore(pool);
    } catch (error) {
      await pool.end().catch(() => {});

      if (config.isProduction) {
        throw error;
      }

      console.warn(`PostgreSQL unavailable, using local development storage instead: ${describeError(error)}`);
    }
  } else if (!config.isProduction) {
    console.warn("DATABASE_URL is not set, using local development storage.");
  }

  const filePath = path.resolve(__dirname, "..", ".data", "reservations.json");
  const store = await createLocalFileStore(filePath);
  console.log(`Storage: using local development JSON file at ${filePath}.`);
  return store;
}

async function start() {
  const config = getConfig();
  validateRuntimeConfig(config);

  const store = await createStore(config);
  const app = createApp({ store, config });
  const server = app.listen(config.port, () => {
    console.log(`100-square fundraiser app listening on port ${config.port}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close(async () => {
      await store.close();
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
