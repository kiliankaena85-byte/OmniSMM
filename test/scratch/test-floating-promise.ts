import { db } from "@/lib/db";
import { requestMagicLink } from "@/actions/auth/request-magic-link";

async function run() {
  // We can just look at the code of requestMagicLink and simulate the floating promise part.
  
  const isNewUser = true;
  const cleanEmail = "test@example.com";
  const user = { id: "test-id" };
  
  const p = Promise.resolve().then(async () => {
      try {
        throw new Error("SMTP Failed");
      } catch (smtpError) {
        console.error("Exact SMTP error:", smtpError);
        if (isNewUser) {
          try {
            throw new Error("DB Delete failed");
          } catch (e) {
            console.error('Failed to delete newly created user', { error: e });
          }
        }
      }
  });

  await p;
}

run();
