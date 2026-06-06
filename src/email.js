function formatSquares(numbers) {
  return numbers.length === 1 ? String(numbers[0]) : numbers.join(", ");
}

const BANK_DETAILS = {
  accountName: "Amir Hedjazi",
  bankName: "NatWest Bank",
  sortCode: "53-61-54",
  accountNumber: "69902852",
};

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
    ["Expected payment", amount],
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
Expected payment: ${amount}
Status: Reserved / awaiting payment
Reserved at: ${reservedAt}

Admin reminder:
Only mark this reservation as paid once the bank transfer payment has been received and confirmed.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">New square reservation received.</h1>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #dddddd;">
        ${buildDetailRows(detailRows)}
      </table>
      <p style="margin:0;padding:12px 14px;background:#fff7d6;border-left:4px solid #d7a900;font-weight:700;">
        Only mark this reservation as paid once the bank transfer payment has been received and confirmed.
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
Amount to pay: ${amount}

Please send payment by bank transfer:

${BANK_DETAILS.accountName}
${BANK_DETAILS.bankName}
Sort code: ${BANK_DETAILS.sortCode}
Account number: ${BANK_DETAILS.accountNumber}

Your square(s) will be entered into the draw once payment has been received and confirmed.

Because this is a prize square/raffle entry, please do not claim Gift Aid for your square payment.

Thank you for supporting my Andy's Man Club fundraiser.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 14px;">Hi ${escapeHtml(reservation.name)},</p>
      <p style="margin:0 0 14px;">Thanks for reserving your square(s).</p>
      <p style="margin:0 0 6px;"><strong>Reserved square(s):</strong> ${escapeHtml(squareNumbers)}</p>
      <p style="margin:0 0 18px;"><strong>Amount to pay:</strong> ${escapeHtml(amount)}</p>
      <div style="margin:0 0 18px;padding:14px;background:#fff7d6;border:1px solid #d7a900;">
        <p style="margin:0 0 10px;font-weight:700;">Please send payment by bank transfer:</p>
        <p style="margin:0;line-height:1.6;">
          <strong>${escapeHtml(BANK_DETAILS.accountName)}</strong><br>
          ${escapeHtml(BANK_DETAILS.bankName)}<br>
          Sort code: <strong>${escapeHtml(BANK_DETAILS.sortCode)}</strong><br>
          Account number: <strong>${escapeHtml(BANK_DETAILS.accountNumber)}</strong>
        </p>
      </div>
      <p style="margin:0 0 14px;font-weight:700;">Your square(s) will be entered into the draw once payment has been received and confirmed.</p>
      <p style="margin:0 0 14px;">Because this is a prize square/raffle entry, please do not claim Gift Aid for your square payment.</p>
      <p style="margin:0;">Thank you for supporting my Andy's Man Club fundraiser.</p>
    </div>
  </body>
</html>`,
  };
}

function buildPaidConfirmationEmail(reservation) {
  const numbers = reservation.numbers || [];
  const squareNumbers = formatSquares(numbers);
  const amount = formatCurrency(reservation.totalAmount);

  return {
    to: reservation.email,
    subject: "Your square is confirmed \u2014 thank you",
    text: `Hi ${reservation.name},

Thank you \u2014 your payment has been received and your square entry is now confirmed.

Confirmed square(s): ${squareNumbers}
Amount received: ${amount}

Your square(s) will be entered into the \u00a3200 prize draw.

Thank you for supporting my Andy's Man Club fundraiser. Your generosity may have helped save another man's life.

Amir`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <p style="margin:0 0 14px;">Hi ${escapeHtml(reservation.name)},</p>
      <p style="margin:0 0 14px;font-weight:700;">Thank you &mdash; your payment has been received and your square entry is now confirmed.</p>
      <p style="margin:0 0 6px;"><strong>Confirmed square(s):</strong> ${escapeHtml(squareNumbers)}</p>
      <p style="margin:0 0 18px;"><strong>Amount received:</strong> ${escapeHtml(amount)}</p>
      <p style="margin:0 0 14px;">Your square(s) will be entered into the &pound;200 prize draw.</p>
      <p style="margin:0 0 14px;">Thank you for supporting my Andy's Man Club fundraiser. Your generosity may have helped save another man's life.</p>
      <p style="margin:0;">Amir</p>
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

async function sendPaidConfirmationEmail(config, reservation, options = {}) {
  const logger = options.logger || console;
  const fetchImpl = options.fetchImpl || fetch;
  const result = {
    paidConfirmationEmailSent: false,
    paidConfirmationEmailStatus: "skipped",
  };

  if (!config.resendApiKey || !config.fromEmail) {
    logger.log("Paid confirmation email skipped because RESEND_API_KEY or FROM_EMAIL is not configured.");
    return result;
  }

  if (!canSendSupporterEmail(config, reservation.email)) {
    warn(
      logger,
      "Paid confirmation email skipped because FROM_EMAIL uses Resend's onboarding@resend.dev test sender. Resend test emails only deliver to the Resend account email address; verify a custom domain before sending supporter confirmations."
    );
    return result;
  }

  try {
    await postResendEmail(config, buildPaidConfirmationEmail(reservation), fetchImpl);
    return {
      paidConfirmationEmailSent: true,
      paidConfirmationEmailStatus: "sent",
    };
  } catch (error) {
    logger.error(`Paid confirmation email failed: ${error.message}`);
    return {
      paidConfirmationEmailSent: false,
      paidConfirmationEmailStatus: "failed",
    };
  }
}

module.exports = {
  buildAdminReservationEmail,
  buildPaidConfirmationEmail,
  buildSupporterReservationEmail,
  canSendSupporterEmail,
  escapeHtml,
  extractEmailAddress,
  formatReservedAt,
  formatSquares,
  isResendTestSender,
  sendPaidConfirmationEmail,
  sendReservationEmails,
};
