const express = require("express");
const path = require("path");
const {
  createPostgresStore,
  mapAdminSquare,
  mapPublicSquare,
  reserveSquares,
} = require("./db");
const { createSquaresCsv } = require("./csv");
const { sendReservationEmail } = require("./email");
const { createHttpError } = require("./errors");
const {
  normalizeStatusFilter,
  validateReservationPayload,
  validateSquareNumber,
} = require("./validation");

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

function createApp({ store, pool, config }) {
  const app = express();
  const publicDir = path.resolve(__dirname, "..", "public");
  const storage = store || createPostgresStore(pool);

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

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/squares", async (req, res, next) => {
    try {
      const squares = await storage.listPublicSquares();

      res.json({
        squares: squares.map(mapPublicSquare),
        totals: await storage.getStatusCounts(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reservations", async (req, res, next) => {
    try {
      const squares = await storage.listPublicSquares();
      const reservations = squares.filter((square) => square.status !== "available");

      res.json({
        reservations: reservations.map(mapPublicSquare),
        totals: await storage.getStatusCounts(),
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

      const reserve = storage.reserveSquares || storage.reserveSquare;
      const { squares, totalAmount } = await reserve(validation.data);
      const numbers = squares.map((square) => square.number);

      const message = `Your square${numbers.length === 1 ? " has" : "s have"} been reserved. Please now donate \u00a3${totalAmount} using the button below. Only paid squares will be entered into the draw.`;

      try {
        await sendReservationEmail(config, {
          name: validation.data.name,
          email: validation.data.email,
          numbers,
          totalAmount,
          fundraiserUrl: config.fundraiserUrl,
        });
      } catch (emailError) {
        console.error("Reservation email failed:", emailError.message);
      }

      res.status(201).json({
        message,
        fundraiserUrl: config.fundraiserUrl,
        numbers,
        totalAmount,
        squares: squares.map(mapPublicSquare),
        square: mapPublicSquare(squares[0]),
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

      const squares = await storage.listAdminSquares(status);

      res.json({
        squares: squares.map(mapAdminSquare),
        totals: await storage.getStatusCounts(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/squares.csv", requireAdmin(config), async (req, res, next) => {
    try {
      const squares = await storage.listAdminSquares(null);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"hundred-square-entries.csv\"");
      res.send(createSquaresCsv(squares));
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

      const square = await storage.markSquarePaid(number);

      res.json({
        square: mapAdminSquare(square),
        totals: await storage.getStatusCounts(),
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

      const square = await storage.releaseSquare(number);

      res.json({
        square: mapAdminSquare(square),
        totals: await storage.getStatusCounts(),
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
  reserveSquares,
};
