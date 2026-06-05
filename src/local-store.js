const fs = require("fs/promises");
const path = require("path");
const { createHttpError } = require("./errors");

const VALID_STATUSES = new Set(["available", "reserved", "paid"]);

function nowIso() {
  return new Date().toISOString();
}

function createEmptySquare(number, timestamp) {
  return {
    id: number,
    number,
    status: "available",
    name: null,
    email: null,
    donation_reference: null,
    reserved_at: null,
    paid_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createInitialData() {
  const timestamp = nowIso();

  return {
    squares: Array.from({ length: 100 }, (_, index) => createEmptySquare(index + 1, timestamp)),
  };
}

function normalizeData(parsed) {
  const timestamp = nowIso();
  const existingSquares = Array.isArray(parsed && parsed.squares) ? parsed.squares : [];
  const byNumber = new Map();

  for (const square of existingSquares) {
    const number = Number(square && square.number);

    if (Number.isInteger(number) && number >= 1 && number <= 100) {
      byNumber.set(number, square);
    }
  }

  return {
    squares: Array.from({ length: 100 }, (_, index) => {
      const number = index + 1;
      const existing = byNumber.get(number);

      if (!existing) {
        return createEmptySquare(number, timestamp);
      }

      const status = VALID_STATUSES.has(existing.status) ? existing.status : "available";

      return {
        id: Number.isInteger(Number(existing.id)) ? Number(existing.id) : number,
        number,
        status,
        name: existing.name || null,
        email: existing.email || null,
        donation_reference: existing.donation_reference || null,
        reserved_at: existing.reserved_at || null,
        paid_at: existing.paid_at || null,
        created_at: existing.created_at || timestamp,
        updated_at: existing.updated_at || existing.created_at || timestamp,
      };
    }),
  };
}

function cloneRow(row) {
  return { ...row };
}

function sortByNumber(rows) {
  return [...rows].sort((a, b) => a.number - b.number);
}

function calculateStatusCounts(squares) {
  const counts = {
    available: 0,
    reserved: 0,
    paid: 0,
  };

  for (const square of squares) {
    counts[square.status] += 1;
  }

  return {
    ...counts,
    confirmedRaised: counts.paid * 5,
    pendingAmount: counts.reserved * 5,
    estimatedRaised: counts.paid * 5,
  };
}

async function createLocalFileStore(filePath) {
  let data;
  let writeChain = Promise.resolve();

  async function saveData() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  async function loadData() {
    if (data) {
      return data;
    }

    try {
      const content = await fs.readFile(filePath, "utf8");
      data = normalizeData(JSON.parse(content));
      await saveData();
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      data = createInitialData();
      await saveData();
    }

    return data;
  }

  function findSquare(number) {
    return data.squares.find((square) => square.number === number);
  }

  function reserveSelectedSquares(reservation) {
    const numbers = reservation.numbers || [reservation.number];
    const selectedSquares = numbers.map(findSquare);

    if (selectedSquares.some((square) => !square)) {
      throw createHttpError(404, "One or more selected squares do not exist.");
    }

    if (selectedSquares.some((square) => square.status !== "available")) {
      throw createHttpError(409, "One or more selected squares have already been reserved. Please choose another one.");
    }

    const timestamp = nowIso();

    for (const square of selectedSquares) {
      square.status = "reserved";
      square.name = reservation.name;
      square.email = reservation.email;
      square.donation_reference = null;
      square.reserved_at = timestamp;
      square.paid_at = null;
      square.updated_at = timestamp;
    }

    return {
      squares: selectedSquares.map(cloneRow),
      totalAmount: selectedSquares.length * 5,
    };
  }

  async function readRows(getRows) {
    const currentData = await loadData();
    return sortByNumber(getRows(currentData)).map(cloneRow);
  }

  async function mutate(mutator) {
    const operation = writeChain.then(async () => {
      await loadData();
      const result = mutator();
      await saveData();
      return result;
    });

    writeChain = operation.catch(() => {});
    return operation;
  }

  await loadData();

  return {
    name: "local development JSON file",
    filePath,
    listPublicSquares: () => readRows((currentData) => currentData.squares),
    listAdminSquares: (status) =>
      readRows((currentData) => {
        return status
          ? currentData.squares.filter((square) => square.status === status)
          : currentData.squares;
      }),
    getStatusCounts: async () => {
      const currentData = await loadData();
      return calculateStatusCounts(currentData.squares);
    },
    reserveSquares: (reservation) => mutate(() => reserveSelectedSquares(reservation)),
    reserveSquare: async (reservation) => {
      const result = await mutate(() => reserveSelectedSquares(reservation));

      return {
        ...result,
        square: result.squares[0],
      };
    },
    markSquarePaid: (number) =>
      mutate(() => {
        const square = findSquare(number);

        if (!square || square.status !== "reserved") {
          throw createHttpError(404, "Only reserved squares can be marked as paid.");
        }

        const timestamp = nowIso();
        square.status = "paid";
        square.paid_at = timestamp;
        square.updated_at = timestamp;

        return cloneRow(square);
      }),
    releaseSquare: (number) =>
      mutate(() => {
        const square = findSquare(number);

        if (!square || square.status !== "reserved") {
          throw createHttpError(404, "Only reserved squares can be released.");
        }

        square.status = "available";
        square.name = null;
        square.email = null;
        square.donation_reference = null;
        square.reserved_at = null;
        square.paid_at = null;
        square.updated_at = nowIso();

        return cloneRow(square);
      }),
    close: async () => {},
  };
}

module.exports = {
  calculateStatusCounts,
  createInitialData,
  createLocalFileStore,
};
