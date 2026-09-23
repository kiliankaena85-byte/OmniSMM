export {};

async function main() {
  const key = "5jG8DOFkpi1302QMSrEnc46ViH558qamfsPScvoLD14w4f34yyVrogaoVtts";
  const url = "https://vexboost.ru/api/v2/";

  console.log("Testing raw fetch request to Vexboost...");
  
  const body = new URLSearchParams();
  body.append('key', key);
  body.append('action', 'balance');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    const status = res.status;
    const text = await res.text();
    console.log("HTTP Status:", status);
    console.log("Raw Response Text:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

main();
