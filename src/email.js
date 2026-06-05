function formatSquares(numbers) {
  return numbers.length === 1 ? String(numbers[0]) : numbers.join(", ");
}

function formatCurrency(amount) {
  return `\u00a3${amount}`;
}

function formatReservedAt(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractEmailAddress(value) {
  const text = String(value || "").trim();
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim().toLowerCase();
}

function isResendTestSender(fromEmail) {
  return extractEmailAddress(fromEmail) === "onboarding@resend.dev";
}

function emailsMatch(first, second) {
  return extractEmailAddress(first) === extractEmailAddress(second);
}

function canSendSupporterEmail(config, supporterEmail) {
  if (!isResendTestSender(config.fromEmail)) {
    return true;
  }

  return Boolean(config.adminNotifyEmail && emailsMatch(supporterEmail, config.adminNotifyEmail));
}

function warn(logger, message) {
  if (typeof logger.warn === "function") {
    logger.warn(message);
    return;
  }

  logger.log(message);
}

function buildDetailRows(rows) {
  return rows
    .map(([label, value]) => {
      return `
        <tr>
          <th align="left" style="padding:8px 12px;border-bottom:1px solid #dddddd;color:#222222;">${escapeHtml(label)}</th>
          <td style="padding:8px 12px;border-bottom:1px solid #dddddd;color:#222222;">${escapeHtml(value)}</td>
        </tr>`;
    })
    .join("");
}

function buildAdminReservationEmail(reservation) {
  const numbers = reservation.numbers || [];
  const squareNumbers = formatSquares(numbers);
  const amount = formatCurrency(reservation.totalAmount);
  const reservedAt = formatReservedAt(reservation.reservedAt);
  const detailRows = [
    ["Name", reservation.name],
    ["Email", reservation.email],
    ...(reservation.phone ? [["Phone", reservation.phone]] : []),
    ["Square(s)", squareNumbers],
    ["Number of squares", String(numbers.length)],
    ["Expected donation", amount],
    ["Status", "Reserved / awaiting payment"],
    ["Reserved at", reservedAt],
  ];

  const phoneLine = reservation.phone ? `Phone: ${reservation.phone}\n` : "";

  return {
    to: reservation.adminNotifyEmail,
    replyTo: reservation.email,
    subject: `New square reservation: ${reservation.name} - Square(s) ${squareNumbers}`,
    text: `New square reservation received.

Name: ${reservation.name}
Email: ${reservation.email}
${phoneLine}Square(s): ${squareNumbers}
Number of squares: ${numbers.length}
Expected donation: ${amount}
Status: Reserved / awaiting payment
Reserved at: ${reservedAt}

Fundraiser link:
${reservation.fundraiserUrl}

Admin reminder:
Only mark this reservation as paid once the donation has been confirmed.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">New square reservation received.</h1>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #dddddd;">
        ${buildDetailRows(detailRows)}
      </table>
      <p style="margin:20px 0 6px;font-weight:700;">Fundraiser link:</p>
      <p style="margin:0 0 20px;"><a href="${escapeHtml(reservation.fundraiserUrl)}" style="color:#6b5300;">${escapeHtml(reservation.fundraiserUrl)}</a></p>
      <p style="margin:0;padding:12px 14px;background:#fff7d6;border-left:4px solid #d7a900;font-weight:700;">
        Only mark this reservation as paid once the donation has been confirmed.
      </p>
    </div>
  </body>
</html>`,
  };
}

function buildSupporterReservationEmail(reservation) {
  const numbers = reservation.numbers || [];
  const squareNumbers = formatSquares(numbers);
  const amount = formatCurrency(reservation.totalAmount);

  return {
    to: reservation.email,
    subject: "Your square reservation",
    text: `Hi ${reservation.name},

Thanks for reserving your square(s).

Reserved square(s): ${squareNumbers}
Amount to donate: ${amount}

Please complete your donation here:
${reservation.fundraiserUrl}

Your square(s) will be entered into the draw once payment has been confirmed.

Thank you for supporting Andy's Man Club.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 14px;">Hi ${escapeHtml(reservation.name)},</p>
      <p style="margin:0 0 14px;">Thanks for reserving your square(s).</p>
      <p style="margin:0 0 6px;"><strong>Reserved square(s):</strong> ${escapeHtml(squareNumbers)}</p>
      <p style="margin:0 0 18px;"><strong>Amount to donate:</strong> ${escapeHtml(amount)}</p>
      <p style="margin:0 0 6px;">Please complete your donation here:</p>
      <p style="margin:0 0 18px;"><a href="${escapeHtml(reservation.fundraiserUrl)}" style="color:#6b5300;font-weight:700;">${escapeHtml(reservation.fundraiserUrl)}</a></p>
      <p style="margin:0 0 14px;">Your square(s) will be entered into the draw once payment has been confirmed.</p>
      <p style="margin:0;">Thank you for supporting Andy's Man Club.</p>
    </div>
  </body>
</html>`,
  };
}

async function postResendEmail(config, message, fetchImpl) {
  const body = {
    from: config.fromEmail,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  if (message.replyTo) {
    body.reply_to = message.replyTo;
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend email failed with status ${response.status}: ${detail}`);
  }
}

async function sendOneEmail({ label, config, message, fetchImpl, logger }) {
  try {
    await postResendEmail(config, message, fetchImpl);
    return true;
  } catch (error) {
    logger.error(`${label} reservation email failed: ${error.message}`);
    return false;
  }
}

async function sendReservationEmails(config, reservation, options = {}) {
  const logger = options.logger || console;
  const fetchImpl = options.fetchImpl || fetch;
  const result = {
    supporterEmailSent: false,
    adminEmailSent: false,
  };

  if (!config.resendApiKey || !config.fromEmail) {
    logger.log("Reservation emails not sent because RESEND_API_KEY or FROM_EMAIL is not configured.");
    return result;
  }

  const baseReservation = {
    ...reservation,
    fundraiserUrl: reservation.fundraiserUrl || config.fundraiserUrl,
  };

  if (!config.adminNotifyEmail) {
    logger.log("Admin reservation email not sent because ADMIN_NOTIFY_EMAIL is not configured.");
  } else {
    result.adminEmailSent = await sendOneEmail({
      label: "Admin",
      config,
      message: buildAdminReservationEmail({
        ...baseReservation,
        adminNotifyEmail: config.adminNotifyEmail,
      }),
      fetchImpl,
      logger,
    });
  }

  if (!canSendSupporterEmail(config, baseReservation.email)) {
    warn(
      logger,
      "Supporter reservation email not sent because FROM_EMAIL uses Resend's onboarding@resend.dev test sender. Resend test emails only deliver to the Resend account email address; verify a custom domain before sending supporter confirmations."
    );
    return result;
  }

  result.supporterEmailSent = await sendOneEmail({
    label: "Supporter",
    config,
    message: buildSupporterReservationEmail(baseReservation),
    fetchImpl,
    logger,
  });

  return result;
}

module.exports = {
  buildAdminReservationEmail,
  buildSupporterReservationEmail,
  canSendSupporterEmail,
  escapeHtml,
  extractEmailAddress,
  formatReservedAt,
  formatSquares,
  isResendTestSender,
  sendReservationEmails,
};
