const { Pool } = require("pg");

function shouldUseSsl() {
  return (
    process.env.PGSSLMODE === "require" ||
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true"
  );
}

function createPool(databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
  });
}

async function initDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS squares (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 100),
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'paid')),
      name TEXT,
      email TEXT,
      donation_reference TEXT,
      reserved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_squares_status ON squares(status);
  `);

  await pool.query(`
    INSERT INTO squares (number, status)
    SELECT number, 'available'
    FROM generate_series(1, 100) AS number
    ON CONFLICT (number) DO NOTHING;
  `);
}

async function getStatusCounts(pool) {
  const result = await pool.query(`
    SELECT status, COUNT(*)::integer AS count
    FROM squares
    GROUP BY status;
  `);

  const counts = {
    available: 0,
    reserved: 0,
    paid: 0,
  };

  for (const row of result.rows) {
    counts[row.status] = row.count;
  }

  return {
    ...counts,
    estimatedRaised: counts.paid * 5,
  };
}

function mapPublicSquare(row) {
  return {
    number: row.number,
    status: row.status,
  };
}

function mapAdminSquare(row) {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    name: row.name,
    email: row.email,
    donationReference: row.donation_reference,
    reservedAt: row.reserved_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  createPool,
  getStatusCounts,
  initDatabase,
  mapAdminSquare,
  mapPublicSquare,
};
