(function () {
  const DONATION_PER_SQUARE = 5;

  const requiredIds = {
    grid: "squareGrid",
    statusMessage: "statusMessage",
    publicTotals: "publicTotals",
    dialog: "reservationDialog",
    form: "reservationForm",
    closeDialogButton: "closeDialogButton",
    selectedSquareLabel: "selectedSquareLabel",
    reservationTotal: "reservationTotal",
    formError: "formError",
    nameInput: "name",
    confirmedInput: "confirmed",
    reserveSubmitButton: "reserveSubmitButton",
    selectedSquaresSummary: "selectedSquaresSummary",
    selectedCount: "selectedCount",
    selectedTotal: "selectedTotal",
    reserveSelectedButton: "reserveSelectedButton",
    clearSelectionButton: "clearSelectionButton",
    confirmationDialog: "confirmationDialog",
    closeConfirmationButton: "closeConfirmationButton",
    confirmationSquares: "confirmationSquares",
    confirmationAmount: "confirmationAmount",
    confirmationDonateButton: "confirmationDonateButton",
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
    reservationTotal,
    formError,
    nameInput,
    confirmedInput,
    reserveSubmitButton,
    selectedSquaresSummary,
    selectedCount,
    selectedTotal,
    reserveSelectedButton,
    clearSelectionButton,
    confirmationDialog,
    closeConfirmationButton,
    confirmationSquares,
    confirmationAmount,
    confirmationDonateButton,
  } = elements;

  const pickSquaresButton = document.getElementById("pickSquaresButton");
  const gridPanel = document.getElementById("gridPanel");
  const selectedNumbers = new Set();

  function formatCurrency(amount) {
    return `\u00a3${amount}`;
  }

  function getSelectedNumbers() {
    return Array.from(selectedNumbers).sort((a, b) => a - b);
  }

  function formatNumbers(numbers) {
    return numbers.join(", ");
  }

  function setStatus(message) {
    statusMessage.textContent = message || "";
  }

  function renderTotals(totals) {
    publicTotals.textContent = `${totals.available} available | ${totals.reserved} reserved | ${totals.paid} paid`;
  }

  function updateSubmitButton() {
    reserveSubmitButton.disabled = !confirmedInput.checked;
  }

  function renderSelectionSummary() {
    const numbers = getSelectedNumbers();
    const count = numbers.length;
    const total = count * DONATION_PER_SQUARE;

    selectedSquaresSummary.textContent = count === 0 ? "None yet" : formatNumbers(numbers);
    selectedCount.textContent = `${count} selected`;
    selectedTotal.textContent = formatCurrency(total);
    reserveSelectedButton.disabled = count === 0;
    clearSelectionButton.disabled = count === 0;
  }

  function clearSelection() {
    selectedNumbers.clear();

    for (const button of grid.querySelectorAll(".square.selected")) {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    }

    renderSelectionSummary();
  }

  function toggleSquare(number, button) {
    if (selectedNumbers.has(number)) {
      selectedNumbers.delete(number);
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    } else {
      selectedNumbers.add(number);
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
    }

    renderSelectionSummary();
  }

  function openReservationForm() {
    const numbers = getSelectedNumbers();

    if (numbers.length === 0) {
      setStatus("Choose at least one available square first.");
      return;
    }

    selectedSquareLabel.textContent = numbers.length === 1
      ? `square ${numbers[0]}`
      : `squares ${formatNumbers(numbers)}`;
    reservationTotal.textContent = formatCurrency(numbers.length * DONATION_PER_SQUARE);
    form.reset();
    formError.textContent = "";
    updateSubmitButton();

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    nameInput.focus();
  }

  function closeReservationForm() {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function closeConfirmation() {
    if (typeof confirmationDialog.close === "function" && confirmationDialog.open) {
      confirmationDialog.close();
    } else {
      confirmationDialog.removeAttribute("open");
    }
  }

  function showConfirmation(data) {
    const numbers = Array.isArray(data.numbers) && data.numbers.length > 0
      ? data.numbers
      : data.squares.map((square) => square.number);
    const totalAmount = data.totalAmount || numbers.length * DONATION_PER_SQUARE;

    confirmationSquares.textContent = formatNumbers(numbers);
    confirmationAmount.textContent = formatCurrency(totalAmount);
    confirmationDonateButton.href = data.fundraiserUrl;
    confirmationDonateButton.textContent = `Donate ${formatCurrency(totalAmount)} now`;

    if (typeof confirmationDialog.showModal === "function") {
      confirmationDialog.showModal();
    } else {
      confirmationDialog.setAttribute("open", "");
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

    const availableNumbers = new Set(
      squares
        .filter((square) => square.status === "available")
        .map((square) => square.number)
    );

    for (const number of getSelectedNumbers()) {
      if (!availableNumbers.has(number)) {
        selectedNumbers.delete(number);
      }
    }

    grid.innerHTML = "";

    for (const square of squares) {
      const status = square.status || "available";
      const button = document.createElement("button");
      const isSelected = selectedNumbers.has(square.number);

      button.type = "button";
      button.className = `square ${status}${isSelected ? " selected" : ""}`;
      button.textContent = square.number;
      button.disabled = status !== "available";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `Square ${square.number}, ${status}`);

      if (status === "available") {
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        button.addEventListener("click", () => toggleSquare(square.number, button));
      }

      grid.appendChild(button);
    }

    renderSelectionSummary();
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.textContent = "";

    const numbers = getSelectedNumbers();

    if (numbers.length === 0) {
      formError.textContent = "Choose at least one available square before submitting the form.";
      return;
    }

    if (!confirmedInput.checked) {
      formError.textContent = "Confirm the fundraiser eligibility and Gift Aid statement before reserving.";
      return;
    }

    reserveSubmitButton.disabled = true;
    reserveSubmitButton.textContent = "Reserving...";

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numbers,
          name: getFieldValue("name"),
          email: getFieldValue("email"),
          confirmed: Boolean(getFieldValue("confirmed")),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(" ") : data.error;
        throw new Error(detail || "Could not reserve those squares.");
      }

      closeReservationForm();
      clearSelection();
      showConfirmation(data);
      await loadSquares();
    } catch (error) {
      formError.textContent = error.message;
    } finally {
      reserveSubmitButton.textContent = "Reserve selected square(s)";
      updateSubmitButton();
    }
  });

  closeDialogButton.addEventListener("click", closeReservationForm);
  confirmedInput.addEventListener("change", updateSubmitButton);
  reserveSelectedButton.addEventListener("click", openReservationForm);
  clearSelectionButton.addEventListener("click", clearSelection);
  closeConfirmationButton.addEventListener("click", closeConfirmation);

  if (pickSquaresButton && gridPanel) {
    pickSquaresButton.addEventListener("click", (event) => {
      event.preventDefault();
      gridPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  renderLoadingSquares();
  renderSelectionSummary();
  loadSquares();
})();
