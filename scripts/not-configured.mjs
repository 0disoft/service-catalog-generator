const [, , name, reason = "This validation is not configured yet."] = process.argv;

console.error(`${name}: not configured`);
console.error(reason);
process.exit(1);
