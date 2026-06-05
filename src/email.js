function buildReservationEmail({ name, number, donationReference, fundraiserUrl }) {
  return {
    subject: "Your 100 Square Number",
    text: `Hi ${name},

Thanks for supporting my Andy's Man Club fundraiser.

You have reserved square ${number}.

Please donate \u00a35 using this official fundraiser link:
${fundraiserUrl}

Use this donation reference:
${donationReference}

Your square is reserved for now and will be confirmed once the \u00a35 donation has been received.

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
  sendReservationEmail,
};
