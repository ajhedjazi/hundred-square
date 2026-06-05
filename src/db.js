const { Pool } = require("pg");
const { createHttpError } = require("./errors");

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

async function listPublicSquares(pool) {
  const result = await pool.query(`
    SELECT number, status
    FROM squares
    ORDER BY number ASC;
  `);

  return result.rows;
}

async function listAdminSquares(pool, status) {
  const query = status
    ? {
        sql: "SELECT * FROM squares WHERE status = $1 ORDER BY number ASC;",
        values: [status],
      }
    : {
        sql: "SELECT * FROM squares ORDER BY number ASC;",
        values: [],
      };

  const result = await pool.query(query.sql, query.values);
  return result.rows;
}

async function reserveSquare(pool, reservation) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const existing = await client.query(
      "SELECT id, number, status FROM squares WHERE number = $1 FOR UPDATE",
      [reservation.number]
    );

    if (existing.rowCount === 0) {
      throw createHttpError(404, "That square does not exist.");
    }

    if (existing.rows[0].status !== "available") {
      throw createHttpError(409, "That square has already been reserved. Please choose another one.");
    }

    const donationReference = `Square ${reservation.number} - ${reservation.name}`;
    const updated = await client.query(
      `
        UPDATE squares
        SET status = 'reserved',
            name = $1,
            email = $2,
            donation_reference = $3,
            reserved_at = NOW(),
            paid_at = NULL,
            updated_at = NOW()
        WHERE number = $4
        RETURNING *;
      `,
      [reservation.name, reservation.email, donationReference, reservation.number]
    );

    await client.query("COMMIT");
    inTransaction = false;

    return {
      square: updated.rows[0],
      donationReference,
    };
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function markSquarePaid(pool, number) {
  const result = await pool.query(
    `
      UPDATE squares
      SET status = 'paid',
          paid_at = NOW(),
          updated_at = NOW()
      WHERE number = $1
        AND status = 'reserved'
      RETURNING *;
    `,
    [number]
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, "Only reserved squares can be marked as paid.");
  }

  return result.rows[0];
}

async function releaseSquare(pool, number) {
  const result = await pool.query(
    `
      UPDATE squares
      SET status = 'available',
          name = NULL,
          email = NULL,
          donation_reference = NULL,
          reserved_at = NULL,
          paid_at = NULL,
          updated_at = NOW()
      WHERE number = $1
        AND status = 'reserved'
      RETURNING *;
    `,
    [number]
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, "Only reserved squares can be released.");
  }

  return result.rows[0];
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

function createPostgresStore(pool) {
  return {
    name: "PostgreSQL",
    listPublicSquares: () => listPublicSquares(pool),
    listAdminSquares: (status) => listAdminSquares(pool, status),
    getStatusCounts: () => getStatusCounts(pool),
    reserveSquare: (reservation) => reserveSquare(pool, reservation),
    markSquarePaid: (number) => markSquarePaid(pool, number),
    releaseSquare: (number) => releaseSquare(pool, number),
    close: () => pool.end(),
  };
}

module.exports = {
  createPool,
  createPostgresStore,
  getStatusCounts,
  initDatabase,
  listAdminSquares,
  listPublicSquares,
  mapAdminSquare,
  mapPublicSquare,
  markSquarePaid,
  releaseSquare,
  reserveSquare,
};
