import nodemailer from 'nodemailer';

async function testSend() {
  console.log('=== TESTING DIRECT YANDEX SMTP SEND ===');
  const user = 'infosokoloff@yandex.ru';
  const pass = 'ifuiolnydxqgipvy';

  console.log(`Connecting with user: ${user}`);

  // Test 1: Port 465 with direct SSL
  console.log('\n--- Attempt 1: Port 465 (SSL) ---');
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
    });
    await transporter.verify();
    console.log('✅ Port 465 Verified!');
  } catch (err: any) {
    console.error('❌ Port 465 Error:', err.message || err);
  }

  // Test 2: Port 587 with STARTTLS
  console.log('\n--- Attempt 2: Port 587 (STARTTLS) ---');
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
    });
    await transporter.verify();
    console.log('✅ Port 587 Verified!');
  } catch (err: any) {
    console.error('❌ Port 587 Error:', err.message || err);
  }
}

testSend();
