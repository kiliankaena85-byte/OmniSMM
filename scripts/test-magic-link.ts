import { requestMagicLink } from '../src/actions/auth/request-magic-link';

async function main() {
  const fd = new FormData();
  fd.append('email', 'test@example.com');
  const res = await requestMagicLink(null, fd);
  console.log(res);
}

main().catch(console.error);
