import bcrypt from 'bcryptjs';
import { MIN_PASSWORD_LENGTH } from '@gastos/shared';
import { PASSWORD_HASH_COST } from '../modules/users/users.service';

/**
 * Prints the bcrypt hash to put in AUTH_PASSWORD_HASH: the password of the
 * first user, the admin, created the first time the server starts. Every other
 * user and password is managed from the app.
 * Usage: npm run hash-password -w backend -- "your password"
 */
const password = process.argv[2];

if (!password || password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Pass a password of at least ${MIN_PASSWORD_LENGTH} characters as the first argument.`);
  process.exit(1);
}
console.log(await bcrypt.hash(password, PASSWORD_HASH_COST));
