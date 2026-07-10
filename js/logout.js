// js/logout.js — loaded by every authenticated screen
// Exposes window._zytSignOut() so plain <script> and module screens both work.
import { signOut } from './supabase.js';

window._zytSignOut = async function () {
  try {
    await signOut(); // signs out + redirects to index.html via supabase.js
  } catch (e) {
    // Fallback: clear localStorage and hard-redirect
    localStorage.clear();
    window.location.href = 'index.html';
  }
};
