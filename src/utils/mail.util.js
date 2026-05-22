const nodemailer = require('nodemailer');

function clean(value) {
  return String(value || '').trim();
}

function cleanAppPassword(value) {
  // Gmail app password is often shown as groups with spaces. Nodemailer/Gmail
  // should receive the 16-character value without spaces.
  return clean(value).replace(/\s+/g, '');
}

function hasMailConfig() {
  return Boolean(
    clean(process.env.SMTP_HOST) &&
      clean(process.env.SMTP_PORT) &&
      clean(process.env.SMTP_USER) &&
      cleanAppPassword(process.env.SMTP_PASS)
  );
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? (port === 465 ? 'true' : 'false')) === 'true';

  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST),
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: cleanAppPassword(process.env.SMTP_PASS),
    },
  });
}

function fromAddress() {
  const appName = clean(process.env.SMTP_FROM_NAME) || 'Comic Cultivation';
  const email = clean(process.env.SMTP_FROM_EMAIL) || clean(process.env.SMTP_USER);
  return `"${appName}" <${email}>`;
}

async function sendOtpEmail({ to, otp, purpose = 'reset_password' }) {
  const appName = clean(process.env.SMTP_FROM_NAME) || 'Comic Cultivation';
  const cleanTo = clean(to).toLowerCase();
  const isChangePassword = purpose === 'change_password';

  const subject = isChangePassword
    ? `[${appName}] Mã OTP đổi mật khẩu`
    : `[${appName}] Mã OTP đặt lại mật khẩu`;

  const title = isChangePassword ? 'Xác nhận đổi mật khẩu' : 'Đặt lại mật khẩu';
  const intro = isChangePassword
    ? 'Bạn vừa yêu cầu đổi mật khẩu tài khoản.'
    : 'Bạn vừa yêu cầu đặt lại mật khẩu.';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:560px">
      <h2>${appName}</h2>
      <h3>${title}</h3>
      <p>${intro}</p>
      <p>Mã OTP của bạn là:</p>
      <div style="
        font-size:28px;
        font-weight:800;
        letter-spacing:6px;
        background:#f3f4f6;
        padding:14px 18px;
        border-radius:10px;
        display:inline-block;
      ">
        ${otp}
      </div>
      <p>Mã này có hiệu lực trong <b>10 phút</b>.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
    </div>
  `;

  const text = `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 10 phút.`;

  if (!hasMailConfig()) {
    console.log('[MAIL DEV] Missing SMTP config. OTP:', otp, 'TO:', cleanTo);
    return {
      skipped: true,
      reason: 'Missing SMTP config',
    };
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    const result = await transporter.sendMail({
      from: fromAddress(),
      to: cleanTo,
      subject,
      text,
      html,
    });

    console.log('[MAIL] OTP sent to', cleanTo, 'messageId:', result.messageId || 'n/a');

    return {
      sent: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('[MAIL] Send OTP failed:', error && error.message ? error.message : error);
    throw error;
  }
}

async function sendResetPasswordOtpEmail({ to, otp }) {
  return sendOtpEmail({ to, otp, purpose: 'reset_password' });
}

async function sendChangePasswordOtpEmail({ to, otp }) {
  return sendOtpEmail({ to, otp, purpose: 'change_password' });
}

module.exports = {
  sendOtpEmail,
  sendResetPasswordOtpEmail,
  sendChangePasswordOtpEmail,
};
