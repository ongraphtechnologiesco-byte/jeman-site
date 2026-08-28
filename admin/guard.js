/* Demo-only gate. Replace with real server-side admin auth before launch. */
if (!sessionStorage.getItem('jeman_admin_session')) {
  location.href = 'login.html';
}
document.addEventListener('DOMContentLoaded', () => {
  const l = document.getElementById('logoutLink');
  if (l) l.onclick = (e) => { e.preventDefault(); sessionStorage.removeItem('jeman_admin_session'); location.href = 'login.html'; };
});
