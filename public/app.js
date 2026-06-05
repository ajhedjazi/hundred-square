(function () {
  const grid = document.getElementById("squareGrid");
  const statusMessage = document.getElementById("statusMessage");
  const publicTotals = document.getElementById("publicTotals");
  const dialog = document.getElementById("reservationDialog");
  const form = document.getElementById("reservationForm");
  const closeDialogButton = document.getElementById("closeDialogButton");
  const selectedSquareLabel = document.getElementById("selectedSquareLabel");
  const formError = document.getElementById("formError");
  const successPanel = document.getElementById("successPanel");
  const successMessage = document.getElementById("successMessage");
  const successReference = document.getElementById("successReference");
  const fundraiserButton = document.getElementById("fundraiserButton");

  let selectedSquare = null;

  function setStatus(message) {
    statusMessage.textContent = message || "";
  }

  function renderTotals(totals) {
    publicTotals.textContent = `${totals.available} available · ${totals.reserved} reserved · ${totals.paid} paid`;
  }

  function openReservationForm(number) {
    selectedSquare = number;
    selectedSquareLabel.textContent = number;
    form.reset();
    formError.textContent = "";

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    document.getElementById("name").focus();
  }

  function closeReservationForm() {
    selectedSquare = null;
    dialog.close();
  }

  function renderSquares(squares) {
    grid.innerHTML = "";

    for (const square of squares) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `square ${square.status}`;
      button.textContent = square.number;
      button.disabled = square.status !== "available";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `Square ${square.number}, ${square.status}`);

      if (square.status === "available") {
        button.addEventListener("click", () => openReservationForm(square.number));
      }

      grid.appendChild(button);
    }
  }

  async function loadSquares() {
    setStatus("Loading squares...");

    try {
      const response = await fetch("/api/squares");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load squares.");
      }

      renderSquares(data.squares);
      renderTotals(data.totals);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function getFieldValue(name) {
    return new FormData(form).get(name);
  }

  function showSuccess(data) {
    successPanel.classList.remove("hidden");
    successMessage.textContent = data.message;
    successReference.textContent = `Donation reference: ${data.donationReference}`;
    fundraiserButton.href = data.fundraiserUrl;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Reserving...";

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: selectedSquare,
          name: getFieldValue("name"),
          email: getFieldValue("email"),
          confirmed: Boolean(getFieldValue("confirmed")),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(" ") : data.error;
        throw new Error(detail || "Could not reserve that square.");
      }

      closeReservationForm();
      showSuccess(data);
      await loadSquares();
    } catch (error) {
      formError.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Reserve square";
    }
  });

  closeDialogButton.addEventListener("click", closeReservationForm);

  loadSquares();
})();
