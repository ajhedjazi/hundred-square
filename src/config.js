function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL,
    adminPassword: process.env.ADMIN_PASSWORD,
    fundraiserUrl: process.env.FUNDRAISER_URL,
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
  };
}

function validateRuntimeConfig(config) {
  const missing = [];

  if (!config.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (!config.adminPassword) {
    missing.push("ADMIN_PASSWORD");
  }

  if (!config.fundraiserUrl) {
    missing.push("FUNDRAISER_URL");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

module.exports = {
  getConfig,
  validateRuntimeConfig,
};
