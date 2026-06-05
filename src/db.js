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
      phone TEXT,
      donation_reference TEXT,
      reserved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE squares
    ADD COLUMN IF NOT EXISTS phone TEXT;
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
    confirmedRaised: counts.paid * 5,
    pendingAmount: counts.reserved * 5,
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

async function reserveSquares(pool, reservation) {
  const client = await pool.connect();
  let inTransaction = false;
  const numbers = reservation.numbers || [reservation.number];

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const existing = await client.query(
      "SELECT id, number, status FROM squares WHERE number = ANY($1::int[]) ORDER BY number ASC FOR UPDATE",
      [numbers]
    );

    if (existing.rowCount !== numbers.length) {
      throw createHttpError(404, "One or more selected squares do not exist.");
    }

    const unavailable = existing.rows.filter((row) => row.status !== "available");

    if (unavailable.length > 0) {
      throw createHttpError(409, "One or more selected squares have already been reserved. Please choose another one.");
    }

    const updated = await client.query(
      `
        UPDATE squares
        SET status = 'reserved',
            name = $1,
            email = $2,
            phone = $3,
            donation_reference = NULL,
            reserved_at = NOW(),
            paid_at = NULL,
            updated_at = NOW()
        WHERE number = ANY($4::int[])
        RETURNING *;
      `,
      [reservation.name, reservation.email, reservation.phone || null, numbers]
    );

    await client.query("COMMIT");
    inTransaction = false;

    return {
      squares: updated.rows.sort((a, b) => a.number - b.number),
      totalAmount: numbers.length * 5,
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

async function reserveSquare(pool, reservation) {
  const result = await reserveSquares(pool, {
    ...reservation,
    numbers: reservation.numbers || [reservation.number],
  });

  return {
    ...result,
    square: result.squares[0],
  };
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
          phone = NULL,
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
    phone: row.phone,
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
    reserveSquares: (reservation) => reserveSquares(pool, reservation),
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
  reserveSquares,
};
