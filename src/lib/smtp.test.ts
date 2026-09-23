import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMagicLink, sendAuthMail, sendWelcomeLetter, sendOrderCompletedMail } from './smtp';
import nodemailer from 'nodemailer';

// Mock the settings provider to return test values
vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getContactAndLegalSettings: vi.fn().mockResolvedValue({
      COMPANY_NAME: 'TestBrand',
    }),
    getSupportEmailDomain: vi.fn().mockResolvedValue('testbrand.com'),
    getEmailSettings: vi.fn().mockResolvedValue({
      emailProvider: 'SMTP',
      smtpHost: 'smtp.test.com',
      smtpPort: 465,
      smtpUser: 'no-reply@testbrand.com',
      smtpPassword: 'secretpassword',
      supportEmailDomain: 'testbrand.com',
    }),
  }
}));

// Mock nodemailer to prevent actual emails
vi.mock('nodemailer', () => {
  const sendMailMock = vi.fn().mockResolvedValue(true);
  return {
    default: {
      createTransport: vi.fn().mockReturnValue({
        sendMail: sendMailMock,
      }),
    },
  };
});

describe('SMTP Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.testbrand.com';
  });

  it('sendMagicLink uses dynamic companyName', async () => {
    await sendMagicLink('test@example.com', 'token123');
    const transportMock = nodemailer.createTransport().sendMail;
    expect(transportMock).toHaveBeenCalled();
    const mailArgs = (transportMock as any).mock.calls[0][0];
    
    // Check if the html content has the dynamically injected brand name
    expect(mailArgs.html).toContain('Вход в TestBrand');
    expect(mailArgs.from).toContain('"TestBrand Support"');
  });

  it('sendAuthMail uses dynamic companyName', async () => {
    await sendAuthMail('test@example.com', '123456');
    const transportMock = nodemailer.createTransport().sendMail;
    expect(transportMock).toHaveBeenCalled();
    const mailArgs = (transportMock as any).mock.calls[0][0];
    
    expect(mailArgs.html).toContain('Вход в TestBrand');
    expect(mailArgs.subject).toContain('Код входа в TestBrand');
  });

  it('sendWelcomeLetter uses dynamic companyName', async () => {
    await sendWelcomeLetter('test@example.com');
    const transportMock = nodemailer.createTransport().sendMail;
    expect(transportMock).toHaveBeenCalled();
    const mailArgs = (transportMock as any).mock.calls[0][0];
    
    expect(mailArgs.html).toContain('Добро пожаловать в TestBrand!');
    expect(mailArgs.subject).toContain('Добро пожаловать в TestBrand!');
  });

  it('sendOrderCompletedMail uses dynamic supportDomain', async () => {
    // Unset NEXT_PUBLIC_APP_URL to force the fallback to supportDomain
    delete process.env.NEXT_PUBLIC_APP_URL;
    
    await sendOrderCompletedMail('test@example.com', 'order-123', 'Telegram Subscribers');
    const transportMock = nodemailer.createTransport().sendMail;
    expect(transportMock).toHaveBeenCalled();
    const mailArgs = (transportMock as any).mock.calls[0][0];
    
    // It should fallback to http(s)://${supportDomain}/dashboard/orders
    expect(mailArgs.html).toMatch(/https?:\/\/testbrand\.com\/dashboard\/orders/);
  });
});
