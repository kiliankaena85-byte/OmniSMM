// SC04 Positive Fixture: Webhook Fail-Open Pattern
export function handleWebhook(secret: string, signature: string) {
  if (secret && signature) {
    // Bad signature check skipped when signature is missing!
  }
}
