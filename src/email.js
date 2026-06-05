function formatSquares(numbers) {
  return numbers.length === 1 ? String(numbers[0]) : numbers.join(", ");
}

function buildReservationEmail({ name, numbers, totalAmount, fundraiserUrl }) {
  const squareNumbers = formatSquares(numbers || []);
  const isSingleSquare = numbers && numbers.length === 1;
  const squareLabel = isSingleSquare ? "square" : "squares";
  const enteredCopy = isSingleSquare
    ? "Your square is reserved for now and will only be entered into the draw once payment has been confirmed."
    : "Your squares are reserved for now and will only be entered into the draw once payment has been confirmed.";

  return {
    subject: "Your 100-square reservation",
    text: `Hi ${name},

Thanks for supporting my Andy's Man Club fundraiser.

You have reserved ${squareLabel} ${squareNumbers}.

Please now donate \u00a3${totalAmount} using this official fundraiser link:
${fundraiserUrl}

${enteredCopy}

Important: please do not claim Gift Aid if this donation is being made as payment for a prize square/raffle entry.

Thank you,
Amir`,
  };
}

async function sendReservationEmail(config, reservation) {
  const email = buildReservationEmail(reservation);

  if (!config.resendApiKey || !config.fromEmail) {
    console.log("Reservation email not sent because Resend is not configured.");
    console.log(`To: ${reservation.email}`);
    console.log(`Subject: ${email.subject}`);
    console.log(email.text);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [reservation.email],
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend email failed with status ${response.status}: ${detail}`);
  }
}

module.exports = {
  buildReservationEmail,
  formatSquares,
  sendReservationEmail,
};
