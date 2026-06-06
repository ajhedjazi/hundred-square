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

  function setMessage(message, type = "") {
    adminMessage.textContent = message || "";
    adminMessage.classList.toggle("success-message", type === "success");
    adminMessage.classList.toggle("error-message", type === "error");
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

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return amount > 0 ? `\u00a3${amount}` : "";
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

  function createCell(text, label) {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    cell.textContent = text || "";
    return cell;
  }

  function createStatusCell(status, label) {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    const pill = document.createElement("span");
    pill.className = `status-pill ${status}`;
    pill.textContent = status;
    cell.appendChild(pill);
    return cell;
  }

  function createActionsCell(square) {
    const cell = document.createElement("td");
    cell.className = "actions-cell";
    cell.dataset.label = "Actions";
    const row = document.createElement("div");
    row.className = "action-row";

    const markPaid = document.createElement("button");
    markPaid.type = "button";
    markPaid.className = "secondary-button";
    markPaid.textContent = "Mark paid";
    markPaid.disabled = square.status !== "reserved";
    markPaid.addEventListener("click", () => updateSquare(square.number, "paid", row, markPaid));

    const release = document.createElement("button");
    release.type = "button";
    release.className = "secondary-button";
    release.textContent = "Release";
    release.disabled = square.status !== "reserved";
    release.addEventListener("click", () => updateSquare(square.number, "release", row, release));

    row.appendChild(markPaid);
    row.appendChild(release);
    cell.appendChild(row);
    return cell;
  }

  function renderTable(squares) {
    tableBody.innerHTML = "";

    for (const square of squares) {
      const row = document.createElement("tr");
      row.appendChild(createCell(String(square.number), "Square"));
      row.appendChild(createStatusCell(square.status, "Status"));
      row.appendChild(createCell(square.name, "Name"));
      row.appendChild(createCell(square.email, "Email"));
      row.appendChild(createCell(square.phone, "Phone"));
      row.appendChild(createCell(formatCurrency(square.expectedDonation), "Expected payment"));
      row.appendChild(createCell(formatDate(square.createdAt), "Created"));
      row.appendChild(createCell(formatDate(square.reservedAt), "Reserved"));
      row.appendChild(createCell(formatDate(square.paidAt), "Paid"));
      row.appendChild(createActionsCell(square));
      tableBody.appendChild(row);
    }

    if (squares.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.className = "empty-cell";
      cell.colSpan = 10;
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

  async function updateSquare(number, action, actionRow, clickedButton) {
    const buttons = actionRow.querySelectorAll("button");
    const originalLabel = clickedButton.textContent;

    for (const button of buttons) {
      button.disabled = true;
    }

    clickedButton.textContent = action === "paid" ? "Marking paid..." : "Releasing...";
    setMessage(action === "paid" ? "Marking reservation as paid..." : "Releasing reservation...");

    try {
      const data = await adminFetch(`/api/admin/squares/${number}/${action}`, {
        method: "POST",
      });
      await loadAdminSquares();

      if (action === "paid") {
        const emailMessage = data.paidConfirmationEmailStatus === "sent"
          ? "Confirmation email sent."
          : `Confirmation email ${data.paidConfirmationEmailStatus || "skipped"}.`;
        const messageType = data.paidConfirmationEmailStatus === "failed" ? "error" : "success";
        setMessage(`Marked as paid. ${emailMessage}`, messageType);
      } else {
        setMessage("Reservation released.", "success");
      }
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      if (clickedButton.isConnected) {
        clickedButton.textContent = originalLabel;

        for (const button of buttons) {
          button.disabled = false;
        }
      }
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
