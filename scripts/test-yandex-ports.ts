import nodemailer from 'nodemailer';
import dns from 'dns';

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

async function testYandex() {
  const user = 'infosokoloff@yandex.ru';
  const pass = 'ifuiolnydxqgipvy';

  console.log('Testing Port 465 SSL/TLS...');
  try {
    const t465 = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    await t465.verify();
    console.log('✅ Port 465 verified successfully!');
    const info = await t465.sendMail({
      from: `"SMMplan Test" <${user}>`,
      to: user,
      subject: 'Тест почты SMMplan (Port 465)',
      text: 'Тестовое письмо от SMMplan через порт 465',
    });
    console.log('✅ Email sent via Port 465! MessageId:', info.messageId);
    return;
  } catch (e: any) {
    console.error('❌ Port 465 failed:', e.message);
  }

  console.log('\nTesting Port 587 STARTTLS...');
  try {
    const t587 = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    await t587.verify();
    console.log('✅ Port 587 verified successfully!');
    const info = await t587.sendMail({
      from: `"SMMplan Test" <${user}>`,
      to: user,
      subject: 'Тест почты SMMplan (Port 587)',
      text: 'Тестовое письмо от SMMplan через порт 587',
    });
    console.log('✅ Email sent via Port 587! MessageId:', info.messageId);
  } catch (e: any) {
    console.error('❌ Port 587 failed:', e.message);
  }
}

testYandex().catch(console.error);
