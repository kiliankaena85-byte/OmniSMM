import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmergencyEmailService } from '../emergency-email';
import nodemailer from 'nodemailer';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe('EmergencyEmailService', () => {
  const sendMailMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'admin@test.com';
    process.env.SMTP_PASSWORD = 'password';

    sendMailMock.mockResolvedValue({ messageId: 'msg-test-123' });
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail: sendMailMock,
    } as unknown as nodemailer.Transporter);
  });

  it('should format and send emergency email for CRITICAL incidents', async () => {
    const result = await EmergencyEmailService.sendAlert({
      severity: 'CRITICAL',
      title: 'Database Cluster Down',
      details: 'Unable to connect to PostgreSQL replica on port 5432.',
      suggestedAction: 'Restart docker db container.',
      metadata: { replicaId: 'rep-01', errorsCount: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-test-123');
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.any(String),
        subject: expect.stringContaining('[CRITICAL] Database Cluster Down'),
        html: expect.stringContaining('SMMpanel 1.0 Emergency Alert'),
      })
    );
  });

  it('should gracefully handle missing SMTP credentials without throwing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_PASS;

    // Reset transporter singleton
    (EmergencyEmailService as unknown as { transporter: unknown }).transporter = null;

    const result = await EmergencyEmailService.sendAlert({
      severity: 'WARNING',
      title: 'High Latency',
      details: 'Ping > 800ms',
    });

    expect(result.success).toBe(false);
  });
});
