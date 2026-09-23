try {
  throw new Error("test");
} catch(e) {
  console.log("catch");
  process.exit(1);
} finally {
  console.log("finally");
}
