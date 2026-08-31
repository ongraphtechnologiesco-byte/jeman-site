/* Auth guard for all /admin pages.
   Demo mode: checks the hardcoded sessionStorage flag.
   Live mode (JEMAN_API_BASE_URL set): checks for a real admin token
   issued by POST /api/admin/login. */
(function () {
  const live = window.JemanAPI && JemanAPI.live();
  const ok = live ? !!sessionStorage.getItem('jeman_admin_token') : !!sessionStorage.getItem('jeman_admin_session');
  if (!ok) location.href = 'login.html';
})();

document.addEventListener('DOMContentLoaded', () => {
  const l = document.getElementById('logoutLink');
  if (l) l.onclick = async (e) => {
    e.preventDefault();
    if (window.JemanAPI && JemanAPI.live()) await JemanAPI.adminLogout();
    else sessionStorage.removeItem('jeman_admin_session');
    location.href = 'login.html';
  };
});
