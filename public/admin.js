(function () {
  const loginPanel = document.getElementById("loginPanel");
  const adminContent = document.getElementById("adminContent");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminPasswordInput = document.getElementById("adminPassword");
  const adminLoginError = document.getElementById("adminLoginError");
  const statusFilter = document.getElementById("statusFilter");
  const refreshButton = document.getElementById("refreshButton");
  const exportCsvButton = document.getElementById("exportCsvButton");
  const logoutButton = document.getElementById("logoutButton");
  const adminMessage = document.getElementById("adminMessage");
  const tableBody = document.getElementById("adminTableBody");
  const availableCount = document.getElementById("availableCount");
  const reservedCount = document.getElementById("reservedCount");
  const paidCount = document.getElementById("paidCount");
  const estimatedRaised = document.getElementById("estimatedRaised");
  const pendingAmount = document.getElementById("pendingAmount");

  let adminPassword = sessionStorage.getItem("adminPassword") || "";

  function setMessage(message) {
    adminMessage.textContent = message || "";
  }

  function setLoggedIn(isLoggedIn) {
    loginPanel.classList.toggle("hidden", isLoggedIn);
    adminContent.classList.toggle("hidden", !isLoggedIn);
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  async function adminFetch(url, options) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Admin-Password": adminPassword,
        "Content-Type": "application/json",
        ...((options && options.headers) || {}),
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem("adminPassword");
        setLoggedIn(false);
      }

      throw new Error(data.error || "Admin request failed.");
    }

    return data;
  }

  async function adminBlobFetch(url) {
    const response = await fetch(url, {
      headers: {
        "X-Admin-Password": adminPassword,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem("adminPassword");
        setLoggedIn(false);
      }

      const data = await response.json();
      throw new Error(data.error || "Admin export failed.");
    }

    return response.blob();
  }

  function renderTotals(totals) {
    availableCount.textContent = totals.available;
    reservedCount.textContent = totals.reserved;
    paidCount.textContent = totals.paid;
    estimatedRaised.textContent = `\u00a3${totals.confirmedRaised || totals.estimatedRaised}`;
    pendingAmount.textContent = `\u00a3${totals.pendingAmount || totals.reserved * 5}`;
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text || "";
    return cell;
  }

  function createStatusCell(status) {
    const cell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-pill ${status}`;
    pill.textContent = status;
    cell.appendChild(pill);
    return cell;
  }

  function createActionsCell(square) {
    const cell = document.createElement("td");
    const row = document.createElement("div");
    row.className = "action-row";

    const markPaid = document.createElement("button");
    markPaid.type = "button";
    markPaid.className = "secondary-button";
    markPaid.textContent = "Mark paid";
    markPaid.disabled = square.status !== "reserved";
    markPaid.addEventListener("click", () => updateSquare(square.number, "paid"));

    const release = document.createElement("button");
    release.type = "button";
    release.className = "secondary-button";
    release.textContent = "Release";
    release.disabled = square.status !== "reserved";
    release.addEventListener("click", () => updateSquare(square.number, "release"));

    row.appendChild(markPaid);
    row.appendChild(release);
    cell.appendChild(row);
    return cell;
  }

  function renderTable(squares) {
    tableBody.innerHTML = "";

    for (const square of squares) {
      const row = document.createElement("tr");
      row.appendChild(createCell(String(square.number)));
      row.appendChild(createStatusCell(square.status));
      row.appendChild(createCell(square.name));
      row.appendChild(createCell(square.email));
      row.appendChild(createCell(formatDate(square.reservedAt)));
      row.appendChild(createCell(formatDate(square.paidAt)));
      row.appendChild(createActionsCell(square));
      tableBody.appendChild(row);
    }

    if (squares.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "No squares match this filter.";
      row.appendChild(cell);
      tableBody.appendChild(row);
    }
  }

  async function loadAdminSquares() {
    setMessage("Loading...");

    try {
      const params = new URLSearchParams();

      if (statusFilter.value) {
        params.set("status", statusFilter.value);
      }

      const query = params.toString();
      const data = await adminFetch(`/api/admin/squares${query ? `?${query}` : ""}`);
      renderTotals(data.totals);
      renderTable(data.squares);
      setLoggedIn(true);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      adminLoginError.textContent = error.message;
    }
  }

  async function updateSquare(number, action) {
    setMessage("Updating...");

    try {
      await adminFetch(`/api/admin/squares/${number}/${action}`, {
        method: "POST",
      });
      await loadAdminSquares();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function exportCsv() {
    setMessage("Preparing CSV...");
    exportCsvButton.disabled = true;

    try {
      const blob = await adminBlobFetch("/api/admin/squares.csv");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hundred-square-entries.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      exportCsvButton.disabled = false;
    }
  }

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminLoginError.textContent = "";
    adminPassword = adminPasswordInput.value;
    sessionStorage.setItem("adminPassword", adminPassword);
    await loadAdminSquares();
  });

  statusFilter.addEventListener("change", loadAdminSquares);
  refreshButton.addEventListener("click", loadAdminSquares);
  exportCsvButton.addEventListener("click", exportCsv);
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("adminPassword");
    adminPassword = "";
    adminPasswordInput.value = "";
    setLoggedIn(false);
  });

  if (adminPassword) {
    setLoggedIn(true);
    loadAdminSquares();
  } else {
    setLoggedIn(false);
  }
})();
