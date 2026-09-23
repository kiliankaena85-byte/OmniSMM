// SC12 Positive Fixture: Logging secrets
export function authUser(password: string, secretToken: string) {
  console.log(`User password: ${password}, token: ${secretToken}`);
}
