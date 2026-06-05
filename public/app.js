(function () {
  const requiredIds = {
    grid: "squareGrid",
    statusMessage: "statusMessage",
    publicTotals: "publicTotals",
    dialog: "reservationDialog",
    form: "reservationForm",
    closeDialogButton: "closeDialogButton",
    selectedSquareLabel: "selectedSquareLabel",
    formError: "formError",
    successPanel: "successPanel",
    successMessage: "successMessage",
    successReference: "successReference",
    fundraiserButton: "fundraiserButton",
    nameInput: "name",
  };

  function getRequiredElements(ids) {
    const elements = {};
    const missing = [];

    for (const [key, id] of Object.entries(ids)) {
      const element = document.getElementById(id);

      if (!element) {
        missing.push(`#${id}`);
      }

      elements[key] = element;
    }

    if (missing.length > 0) {
      console.error("Fundraiser page could not initialise. Missing elements:", missing.join(", "));
      return null;
    }

    return elements;
  }

  const elements = getRequiredElements(requiredIds);

  if (!elements) {
    return;
  }

  const {
    grid,
    statusMessage,
    publicTotals,
    dialog,
    form,
    closeDialogButton,
    selectedSquareLabel,
    formError,
    successPanel,
    successMessage,
    successReference,
    fundraiserButton,
    nameInput,
  } = elements;

  let selectedSquare = null;

  successPanel.hidden = true;
  successPanel.classList.add("hidden");

  function setStatus(message) {
    statusMessage.textContent = message || "";
  }

  function renderTotals(totals) {
    publicTotals.textContent = `${totals.available} available | ${totals.reserved} reserved | ${totals.paid} paid`;
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

    nameInput.focus();
  }

  function closeReservationForm() {
    selectedSquare = null;

    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function renderSquares(squares) {
    if (!Array.isArray(squares)) {
      console.error("Fundraiser square data was not an array:", squares);
      setStatus("Could not show the square grid.");
      return;
    }

    if (squares.length !== 100) {
      console.error(`Expected 100 squares, received ${squares.length}.`, squares);
    }

    grid.innerHTML = "";

    for (const square of squares) {
      const status = square.status || "available";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `square ${status}`;
      button.textContent = square.number;
      button.disabled = status !== "available";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `Square ${square.number}, ${status}`);

      if (status === "available") {
        button.addEventListener("click", () => openReservationForm(square.number));
      }

      grid.appendChild(button);
    }
  }

  function renderLoadingSquares() {
    const squares = Array.from({ length: 100 }, (_, index) => ({
      number: index + 1,
      status: "loading",
    }));

    renderSquares(squares);
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
    successPanel.hidden = false;
    successPanel.classList.remove("hidden");
    successMessage.textContent = data.message;
    successReference.textContent = `Donation reference: ${data.donationReference}`;
    fundraiserButton.href = data.fundraiserUrl;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    if (!selectedSquare) {
      formError.textContent = "Choose a square before submitting the form.";
      return;
    }

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

  renderLoadingSquares();
  loadSquares();
})();
