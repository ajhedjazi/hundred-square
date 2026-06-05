const CSV_COLUMNS = [
  ["Square number", "number"],
  ["Status", "status"],
  ["Name", "name"],
  ["Email", "email"],
  ["Phone", "phone"],
  ["Expected donation", "expected_donation"],
  ["Created time", "created_at"],
  ["Reserved time", "reserved_at"],
  ["Paid time", "paid_at"],
];

function formatCsvDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString();
}

function escapeCsvValue(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function createSquaresCsv(rows) {
  const header = CSV_COLUMNS.map(([label]) => escapeCsvValue(label)).join(",");
  const lines = rows.map((row) => {
    return CSV_COLUMNS.map(([, key]) => {
      const rawValue = key === "expected_donation"
        ? (row.status === "available" ? "" : "\u00a35")
        : row[key];
      const value = key.endsWith("_at") ? formatCsvDate(rawValue) : rawValue;
      return escapeCsvValue(value);
    }).join(",");
  });

  return `${[header, ...lines].join("\r\n")}\r\n`;
}

module.exports = {
  createSquaresCsv,
  escapeCsvValue,
};
