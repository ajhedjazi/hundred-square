require("dotenv").config();

const serverless = require("serverless-http");
const { createApp } = require("./app");
const { getConfig, validateRuntimeConfig } = require("./config");
const { createStore } = require("./store");

let cachedHandlerPromise;

function normalizeApiPath(pathname) {
  const path = pathname || "/";
  const functionPrefix = "/.netlify/functions/api";

  if (path === functionPrefix) {
    return "/api";
  }

  if (path.startsWith(`${functionPrefix}/`)) {
    return `/api${path.slice(functionPrefix.length)}`;
  }

  if (path === "/api" || path.startsWith("/api/")) {
    return path;
  }

  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeRawUrl(rawUrl, normalizedPath) {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    url.pathname = normalizedPath;
    return url.toString();
  } catch (error) {
    const queryIndex = rawUrl.indexOf("?");
    return queryIndex === -1 ? normalizedPath : `${normalizedPath}${rawUrl.slice(queryIndex)}`;
  }
}

function normalizeEvent(event) {
  const normalizedPath = normalizeApiPath(event.path || event.rawPath || "/");

  return {
    ...event,
    path: normalizedPath,
    rawPath: normalizedPath,
    rawUrl: normalizeRawUrl(event.rawUrl, normalizedPath),
  };
}

async function getHandler() {
  if (!cachedHandlerPromise) {
    cachedHandlerPromise = (async () => {
      const config = getConfig();
      validateRuntimeConfig(config);

      const store = await createStore(config);
      const app = createApp({ store, config });
      return serverless(app);
    })().catch((error) => {
      cachedHandlerPromise = null;
      throw error;
    });
  }

  return cachedHandlerPromise;
}

async function handler(event, context) {
  const expressHandler = await getHandler();
  return expressHandler(normalizeEvent(event), context);
}

module.exports = {
  handler,
  normalizeApiPath,
  normalizeEvent,
};
