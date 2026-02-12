const nodemailer = require('nodemailer');

// 1. Create Transporter (Singleton with Timeouts)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // 587 uses STARTTLS
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  // Hardening: Prevent hanging connections
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000
});

// 2. Verify Connection (Runs on server startup)
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server Ready');
  }
});

const sendEmail = async (options) => {
  try {
    const message = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message
    };

    const info = await transporter.sendMail(message);
    console.log('Email sent: %s', info.messageId);
    return true;

  } catch (error) {
    console.error('Email Send Failed:', error);
    return false;
  }
};

module.exports = sendEmail;