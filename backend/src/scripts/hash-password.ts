import bcrypt from 'bcryptjs';

/**
 * Prints the bcrypt hash to put in AUTH_PASSWORD_HASH.
 * Usage: npm run hash-password -w backend -- "your password"
 */
const password = process.argv[2];
const MIN_LENGTH = 8;
/** bcrypt work factor: slow enough to resist guessing, fast enough for one login. */
const COST = 12;

if (!password || password.length < MIN_LENGTH) {
  console.error(`Pass a password of at least ${MIN_LENGTH} characters as the first argument.`);
  process.exit(1);
}
console.log(await bcrypt.hash(password, COST));
