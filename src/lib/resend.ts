import { resend } from "../config/resend.js";

export const sendWelcomeEmail = async (email: string, name: string) => {
  await resend.emails.send({
    from: "Timmy <anthony@quizergo.com>",
    to: email,
    subject: "Welcome to QUIZERGO!",
    html: `<!DOCTYPE html>
    <html>
    <head>  <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to QUIZERGO!</title>
      <style>    body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
          color: #333333;
        }
        
        p {
          color: #666666;
        }
        
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #007BFF;
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
        }
        
        .button:hover {
          background-color: #0056b3;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          color: #888888;
        }
      </style>
    </head>
    <body>
      <div class="container">   <h1>Welcome to QUIZERGO, ${name}!</h1>
        <p>Thank you for joining our community! We are excited to have you here.</p>
        <p>Best regards,<br>
          The QUIZERGO Team</p>
        <p class="footer">If you have any questions, please contact us at <a href="mailto:s4d0g@example.com">s4d0g@example.com</a></p>
      </div>
    </body>
    </html>`,
  });

  try {
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
};

export const sendOTPEmail = async (email: string, otp: string) => {
  await resend.emails.send({
    from: "Timmy <anthony@quizergo.com>",
    to: email,
    subject: "QUIZERGO OTP",
    html: `<!DOCTYPE html>
    <html>
    <head>  <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to QUIZERGO!</title>
      <style>    body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
          color: #333333;
        }
        
        p {
          color: #666666;
        }
        
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #007BFF;
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
        }
        
        .button:hover {
          background-color: #0056b3;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          color: #888888;
        }
      </style>
    </head>
    <body>
      <div class="container">   <h1>QUIZERGO OTP</h1>
        <p>OTP: ${otp}</p>
        <p>Best regards,<br>
          The QUIZERGO Team</p>
        <p class="footer">If you have any questions, please contact us at <a href="mailto:s4d0g@example.com">s4d0g@example.com</a></p>
      </div>
    </body>
    </html>`,
  });

  try {
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
};
