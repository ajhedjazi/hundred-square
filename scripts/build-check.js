const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "src/server.js",
  "src/app.js",
  "src/csv.js",
  "src/db.js",
  "src/email.js",
  "src/errors.js",
  "src/local-store.js",
  "public/index.html",
  "public/admin.html",
  "public/app.js",
  "public/admin.js",
  "public/styles.css",
];

const missing = requiredFiles.filter((file) => {
  return !fs.existsSync(path.join(process.cwd(), file));
});

if (missing.length > 0) {
  console.error("Build check failed. Missing files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Build check passed.");
