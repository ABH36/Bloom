const nodemailer = require('nodemailer');

// 1. Create Transporter (Singleton - Created only once)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Helps avoid self-signed cert errors in dev
  }
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
    return true; // Success signal

  } catch (error) {
    console.error('Email Send Failed:', error);
    return false; // Failure signal
  }
};

module.exports = sendEmail;