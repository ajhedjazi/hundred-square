const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.resolve(__dirname, "..", "public");
const indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
const adminJs = fs.readFileSync(path.join(publicDir, "admin.js"), "utf8");
const styles = fs.readFileSync(path.join(publicDir, "styles.css"), "utf8");

test("reservation confirmation uses bank transfer details without a fundraiser payment button", () => {
  assert.match(indexHtml, /Your square\(s\) have been reserved\./);
  assert.match(indexHtml, /Amir Hedjazi/);
  assert.match(indexHtml, /NatWest Bank/);
  assert.match(indexHtml, /53-61-54/);
  assert.match(indexHtml, /69902852/);
  assert.match(indexHtml, /only be entered into the draw once payment has been received and confirmed/);
  assert.doesNotMatch(indexHtml, /confirmationDonateButton/);
  assert.doesNotMatch(indexHtml, />Donate now</);
});

test("public rules explain how the prize and fundraiser proceeds are funded", () => {
  assert.match(indexHtml, /The &pound;200 prize is paid from entry money, with remaining proceeds supporting my Andy&rsquo;s Man Club Great North Run fundraiser\./);
});

test("confirmation total is applied to the bank transfer instruction", () => {
  assert.match(appJs, /confirmationAmount\.textContent = formatCurrency\(totalAmount\)/);
  assert.match(appJs, /confirmationPaymentAmount\.textContent = formatCurrency\(totalAmount\)/);
  assert.match(appJs, /numbers\.length \* PAYMENT_PER_SQUARE/);
});

test("bank details stack into one column on narrow mobile screens", () => {
  assert.match(styles, /\.bank-details\s*\{[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.bank-details\s*\{[\s\S]*grid-template-columns: 1fr/);
});

test("admin paid action shows loading and confirmation email feedback", () => {
  assert.match(adminJs, /Marking paid\.\.\./);
  assert.match(adminJs, /Marked as paid\./);
  assert.match(adminJs, /Confirmation email sent\./);
  assert.match(adminJs, /Confirmation email \$\{data\.paidConfirmationEmailStatus/);
});
