import bcrypt from 'bcryptjs';

/**
 * Prints the bcrypt hash to put in AUTH_PASSWORD_HASH.
 * Usage: npm run hash-password -w backend -- "your password"
 */
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Pass a password of at least 8 characters as the first argument.');
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
