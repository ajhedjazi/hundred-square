require("dotenv").config();

const { createApp } = require("./app");
const { getConfig, validateRuntimeConfig } = require("./config");
const { createStore } = require("./store");

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
