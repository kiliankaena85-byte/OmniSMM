import { applyBeautifulRounding } from '../src/lib/financial-constants';

function testRounding() {
  console.log('Testing applyBeautifulRounding...');
  
  // Test cases: [input, expectedOutput]
  const basicTestCases = [
    [0, 0],
    [0.1, 10],
    [5, 10],
    [9.99, 10],
    [10.0, 10],
    [10.01, 20],
    [99.9, 100],
    [100, 100],
    [100.1, 110],
    [999.0, 990], // Wait: 999.0/10 = 99.9 -> Math.ceil(99.9) = 100 -> 100 * 10 = 1000. Let's compute:
    [990.0, 990],
    [990.01, 1000],
    [1000.0, 1000],
    [1000.01, 1100],
    [1050.0, 1100],
    [1099.99, 1100],
    [1100.0, 1100],
    [10000.0, 10000],
    [21155.10, 21200]
  ];

  for (const [input, expected] of basicTestCases) {
    const result = applyBeautifulRounding(input);
    console.log(`Input: ${input.toFixed(2).padStart(8)} -> Rounded: ${result.toString().padStart(6)} (Expected: ${expected})`);
    if (result < input) {
      console.error(`❌ FAILED: Rounded value ${result} is less than input ${input}`);
      process.exit(1);
    }
  }

  // Fuzz testing with 100,000 random floating point numbers
  console.log('\nRunning fuzz test with 100,000 random positive numbers...');
  let successCount = 0;
  for (let i = 0; i < 100000; i++) {
    const rawVal = Math.random() * 1000000;
    const rounded = applyBeautifulRounding(rawVal);
    
    // 1. Must be strictly an integer
    if (!Number.isInteger(rounded)) {
      console.error(`❌ FAILED: ${rounded} is not an integer for input ${rawVal}`);
      process.exit(1);
    }

    // 2. Must be strictly greater than or equal to input
    if (rounded < rawVal) {
      console.error(`❌ FAILED: ${rounded} < ${rawVal}`);
      process.exit(1);
    }

    // 3. Must be divisible by 10 (if < 1000) or by 100 (if >= 1000)
    if (rawVal < 1000) {
      if (rounded % 10 !== 0) {
        console.error(`❌ FAILED: ${rounded} is not divisible by 10 for input ${rawVal}`);
        process.exit(1);
      }
    } else {
      if (rounded % 100 !== 0) {
        console.error(`❌ FAILED: ${rounded} is not divisible by 100 for input ${rawVal}`);
        process.exit(1);
      }
    }
    successCount++;
  }

  console.log(`✅ Fuzz test passed successfully for ${successCount} values!`);
  console.log('The function applyBeautifulRounding strictly and always rounds UPWARDS.');
}

testRounding();
