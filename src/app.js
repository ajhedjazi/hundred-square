const express = require("express");
const path = require("path");
const {
  getStatusCounts,
  mapAdminSquare,
  mapPublicSquare,
} = require("./db");
const { createSquaresCsv } = require("./csv");
const { sendReservationEmail } = require("./email");
const {
  normalizeStatusFilter,
  validateReservationPayload,
  validateSquareNumber,
} = require("./validation");

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function requireAdmin(config) {
  return (req, res, next) => {
    const providedPassword = req.get("X-Admin-Password");

    if (!config.adminPassword) {
      res.status(500).json({ error: "Admin password is not configured." });
      return;
    }

    if (providedPassword !== config.adminPassword) {
      res.status(401).json({ error: "Invalid admin password." });
      return;
    }

    next();
  };
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

function createApp({ pool, config }) {
  const app = express();
  const publicDir = path.resolve(__dirname, "..", "public");

  app.use(express.json({ limit: "32kb" }));

  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use(express.static(publicDir));

  app.get("/admin", (req, res) => {
    res.sendFile(path.join(publicDir, "admin.html"));
  });

  app.use("/admin", express.static(publicDir, { index: false }));

  app.get("/api/config", (req, res) => {
    res.json({
      fundraiserUrl: config.fundraiserUrl,
    });
  });

  app.get("/api/squares", async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT number, status
        FROM squares
        ORDER BY number ASC;
      `);

      res.json({
        squares: result.rows.map(mapPublicSquare),
        totals: await getStatusCounts(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reservations", async (req, res, next) => {
    try {
      const validation = validateReservationPayload(req.body);

      if (!validation.isValid) {
        throw createHttpError(400, "Please check the reservation form.", validation.errors);
      }

      const { square, donationReference } = await reserveSquare(pool, validation.data);

      const message = `Your square has been reserved. Please donate \u00a35 using the fundraiser link below and use the reference: ${donationReference}. Your square is confirmed once payment has been received.`;

      try {
        await sendReservationEmail(config, {
          name: validation.data.name,
          email: validation.data.email,
          number: validation.data.number,
          donationReference,
          fundraiserUrl: config.fundraiserUrl,
        });
      } catch (emailError) {
        console.error("Reservation email failed:", emailError.message);
      }

      res.status(201).json({
        message,
        fundraiserUrl: config.fundraiserUrl,
        donationReference,
        square: mapPublicSquare(square),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/squares", requireAdmin(config), async (req, res, next) => {
    try {
      const status = normalizeStatusFilter(req.query.status);

      if (status === undefined) {
        throw createHttpError(400, "Filter must be Available, Reserved, or Paid.");
      }

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

      res.json({
        squares: result.rows.map(mapAdminSquare),
        totals: await getStatusCounts(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/squares.csv", requireAdmin(config), async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM squares
        ORDER BY number ASC;
      `);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"hundred-square-entries.csv\"");
      res.send(createSquaresCsv(result.rows));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/squares/:number/paid", requireAdmin(config), async (req, res, next) => {
    try {
      const number = validateSquareNumber(req.params.number);

      if (!number) {
        throw createHttpError(400, "Choose a valid square from 1 to 100.");
      }

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

      res.json({
        square: mapAdminSquare(result.rows[0]),
        totals: await getStatusCounts(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/squares/:number/release", requireAdmin(config), async (req, res, next) => {
    try {
      const number = validateSquareNumber(req.params.number);

      if (!number) {
        throw createHttpError(400, "Choose a valid square from 1 to 100.");
      }

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

      res.json({
        square: mapAdminSquare(result.rows[0]),
        totals: await getStatusCounts(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found." });
  });

  app.use((error, req, res, next) => {
    const status = error.status || 500;

    if (status >= 500) {
      console.error(error);
    }

    res.status(status).json({
      error: error.message || "Something went wrong.",
      details: error.details,
    });
  });

  return app;
}

module.exports = {
  createApp,
  reserveSquare,
};
