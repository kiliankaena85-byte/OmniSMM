import { CBRRateService } from "../src/services/system/cbr-rate.service";

async function test() {
  const result = await CBRRateService.syncCBRExchangeRate();
  console.log("CBR Sync Result:", result);
}
test();
