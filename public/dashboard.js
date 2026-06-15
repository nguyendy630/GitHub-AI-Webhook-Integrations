let GH_TOKEN = null;

// ── Bootstrap ──────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      showLogin();
      return;
    }

    const user = await res.json();
    GH_TOKEN = user.token;

    showDashboard(user);
    await loadRepos();
  } catch (err) {
    console.error('Init error:', err);
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('user-login').textContent = user.login;
  document.getElementById('user-avatar').src = user.avatar_url;
  document.getElementById('user-avatar').alt = user.login;
}

function logout() {
  window.location.href = '/api/auth/logout';
}

// ── Repos ──────────────────────────────────────────────────

async function loadRepos() {
  const select = document.getElementById('repo-select');
  select.innerHTML = '<option value="">Loading repos…</option>';

  try {
    const repos = await ghFetch('/user/repos?sort=pushed&per_page=100');

    select.innerHTML = '<option value="">Select a repository…</option>';
    repos.forEach(repo => {
      const opt = document.createElement('option');
      opt.value = repo.full_name;
      opt.textContent = repo.full_name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      if (select.value) loadRepoData(select.value);
    });
  } catch (err) {
    console.error('Failed to load repos:', err);
    select.innerHTML = '<option value="">Failed to load repos</option>';
  }
}

// ── Repo data ──────────────────────────────────────────────

async function loadRepoData(fullName) {
  resetStats();
  setTableLoading();

  try {
    const [allPRs, commits] = await Promise.all([
      fetchAllPRs(fullName),
      ghFetch(`/repos/${fullName}/commits?per_page=100`),
    ]);

    const openPRs = allPRs.filter(pr => pr.state === 'open');
    const mergedPRs = allPRs.filter(pr => pr.merged_at);

    document.getElementById('stat-total').textContent = allPRs.length;
    document.getElementById('stat-open').textContent = openPRs.length;
    document.getElementById('stat-commits').textContent = commits.length;
    document.getElementById('stat-avg-time').textContent = calcAvgReviewTime(mergedPRs);
    document.getElementById('table-subtitle').textContent = `${allPRs.length} total`;

    renderPRTable(allPRs.slice(0, 50)); // cap at 50 rows for MVP
  } catch (err) {
    console.error('Failed to load repo data:', err);
    setTableError();
  }
}

async function fetchAllPRs(fullName) {
  // Fetch both open and closed PRs in parallel
  const [open, closed] = await Promise.all([
    ghFetch(`/repos/${fullName}/pulls?state=open&per_page=100`),
    ghFetch(`/repos/${fullName}/pulls?state=closed&per_page=100`),
  ]);
  return [...open, ...closed].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

// ── Stats ──────────────────────────────────────────────────

function calcAvgReviewTime(mergedPRs) {
  if (!mergedPRs.length) return '—';

  const totalMs = mergedPRs.reduce((sum, pr) => {
    return sum + (new Date(pr.merged_at) - new Date(pr.created_at));
  }, 0);

  const avgMs = totalMs / mergedPRs.length;
  const avgHours = avgMs / 1000 / 60 / 60;

  if (avgHours < 1) return `${Math.round(avgHours * 60)}m`;
  if (avgHours < 24) return `${avgHours.toFixed(1)}h`;
  return `${(avgHours / 24).toFixed(1)}d`;
}

function resetStats() {
  ['stat-total', 'stat-open', 'stat-commits', 'stat-avg-time'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  document.getElementById('table-subtitle').textContent = '';
}

// ── PR table ───────────────────────────────────────────────

function renderPRTable(prs) {
  const tbody = document.getElementById('pr-table-body');

  if (!prs.length) {
    tbody.innerHTML = '<tr class="state-row"><td colspan="5">No pull requests found.</td></tr>';
    return;
  }

  tbody.innerHTML = prs.map(pr => {
    const status = pr.merged_at ? 'merged' : pr.state;
    const badgeLabel = status === 'merged' ? 'merged' : status === 'open' ? 'open' : 'closed';
    const avatarUrl = pr.user?.avatar_url ?? '';
    const login = pr.user?.login ?? 'unknown';
    const filesChanged = pr.changed_files ?? '—';
    const opened = timeAgo(pr.created_at);
    const base = pr.base?.ref ?? '';
    const head = pr.head?.ref ?? '';

    return `
      <tr>
        <td>
          <span class="pr-title" title="${escHtml(pr.title)}">#${pr.number} — ${escHtml(pr.title)}</span>
          <div class="pr-meta">${escHtml(base)} ← ${escHtml(head)}</div>
        </td>
        <td>
          <div class="author-chip">
            <img class="author-avatar" src="${avatarUrl}" alt="${escHtml(login)}" />
            ${escHtml(login)}
          </div>
        </td>
        <td><span class="badge badge-${badgeLabel}">${badgeLabel}</span></td>
        <td style="color:var(--text-secondary)">${filesChanged}</td>
        <td style="color:var(--text-muted)">${opened}</td>
      </tr>
    `;
  }).join('');
}

function setTableLoading() {
  document.getElementById('pr-table-body').innerHTML =
    '<tr class="state-row"><td colspan="5">Loading…</td></tr>';
}

function setTableError() {
  document.getElementById('pr-table-body').innerHTML =
    '<tr class="state-row"><td colspan="5">Failed to load pull requests.</td></tr>';
}

// ── Helpers ────────────────────────────────────────────────

async function ghFetch(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${path}`);
  return res.json();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ──────────────────────────────────────────────────

init();