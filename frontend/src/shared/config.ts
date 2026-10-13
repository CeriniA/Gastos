/**
 * What this installation says about itself, set when the site is built
 * (frontend/.env locally, the static site's Environment in Render). All of it
 * is public: it ends up in the pages anybody can read.
 */

/** Where to write to whoever runs this installation. Shown on the legal pages. Empty when not set. */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();
