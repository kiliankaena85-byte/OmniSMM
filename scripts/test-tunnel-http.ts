export {};

async function main() {
  const url = "https://0ba97dae0349f3.lhr.life/api/health";
  console.log(`Sending GET request to tunnel health check: ${url}`);
  try {
    const res = await fetch(url);
    console.log("HTTP Status:", res.status);
    console.log("Response text:", await res.text());
  } catch (err) {
    console.error("Request failed:", err);
  }
}

main();
