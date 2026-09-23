import { requestMagicLink } from '../../src/actions/auth/request-magic-link';
import { db } from '../../src/lib/db';
import * as smtp from '../../src/lib/smtp';
import { RateLimitService } from '../../src/services/core/rate-limit.service';

// Mock dependencies manually
RateLimitService.check = async () => true;

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined
  })
}));

(db as any).$transaction = async (cb: any) => {
  return {
    type: 'success',
    user: { id: 'user-1', email: 'test@example.com' },
    isNewUser: true,
    rawToken: 'token123'
  };
};

(smtp as any).sendMagicLink = async () => {
  throw new Error('SMTP disconnected');
};

(db as any).user = {
  delete: async () => {
    throw new Error('DB Connection lost');
  }
};

async function run() {
  const formData = new FormData();
  formData.append('email', 'test@example.com');

  process.on('unhandledRejection', (reason) => {
    console.error('CAUGHT UNHANDLED REJECTION:', (reason as Error).message);
    process.exit(1);
  });

  const result = await requestMagicLink(null, formData);
  console.log('Result from requestMagicLink:', result);

  // Wait a bit for the background task
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Test finished cleanly (unhandled rejection was not caught)');
}

run();
