let AUTH_TOKEN = localStorage.getItem('auth_token') || '';
let AUTH_USER = JSON.parse(localStorage.getItem('auth_user') || 'null');
let AUTH_VERIFIED = false;

function updateAuthUI() {
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const currentUser = document.getElementById('current-user');
  const authCard = document.getElementById('auth-card');
  const appContent = document.getElementById('app-content');
  const userbar = document.getElementById('userbar');
  const userMenuUsername = document.getElementById('user-menu-username');
  if (AUTH_TOKEN && AUTH_USER && AUTH_VERIFIED) {
    if (logoutBtn) logoutBtn.style.display = '';
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    if (currentUser) currentUser.textContent = `Signed in as: ${AUTH_USER.username}`;
    if (authCard) authCard.style.display = 'none';
    if (appContent) appContent.style.display = '';
    if (userbar) userbar.style.display = '';
    if (userMenuUsername) userMenuUsername.textContent = AUTH_USER.username;
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginBtn) loginBtn.style.display = '';
    if (registerBtn) registerBtn.style.display = '';
    if (currentUser) currentUser.textContent = '';
    if (authCard) authCard.style.display = '';
    if (appContent) appContent.style.display = 'none';
    if (userbar) userbar.style.display = 'none';
  }
}

async function verifyAuth() {
  try {
    if (!AUTH_TOKEN || !AUTH_USER) return false;
    const res = await fetch('/api/health', { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } });
    if (res.ok) return true;
    return false;
  } catch {
    return false;
  }
}

async function submitForm(e) {
  e.preventDefault();
  const form = document.getElementById('upload-form');
  const status = document.getElementById('status');
  const btn = document.getElementById('submit-btn');
  status.textContent = '';
  status.className = '';
  btn.disabled = true;

  try {
    const data = new FormData(form);
    const res = await fetch('/api/submissions', {
      method: 'POST',
      body: data,
      headers: AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Upload failed');
    }
    status.textContent = 'Saved!';
    status.className = 'success';
    form.reset();
    await loadRecent();
  } catch (err) {
    status.textContent = err.message;
    status.className = 'error';
  } finally {
    btn.disabled = false;
  }
}

function fileChanged(input, labelId) {
  const label = document.getElementById(labelId);
  const defaultText = labelId === 'file-btn-label'
    ? 'Drop your resume here'
    : 'Upload job description';
  label.textContent = input.files && input.files[0] ? input.files[0].name : defaultText;
}

function renderATSScorecard(data, containerId) {
  const container = document.getElementById(containerId);
  if (!data.ats_result) {
    container.innerHTML = '<div class="error">No ATS result data available</div>';
    return;
  }

  const ats = data.ats_result;
  const scorePercentage = (ats.ats_score / 100) * 360;

  const sb = ats.score_breakdown || {};
  // Compute improvement recommendation based on missing keywords
  const missingKeywords = [
    ...(ats.missing_skills?.required || []),
    ...(ats.missing_skills?.preferred || [])
  ].filter((skill, index, self) => self.indexOf(skill) === index);
  const km = sb.keywords_match || {};
  const totalKeywords = km.total_keywords || 0;
  const matchedKeywords = km.matched_count || 0;
  const remainingKeywords = Math.max(totalKeywords - matchedKeywords, 0);
  // Weight of keywords in overall score (see atsScoring.js)
  const KEYWORD_WEIGHT = 0.25;
  const pointsGain = totalKeywords ? Math.round(((remainingKeywords) / totalKeywords) * 100 * KEYWORD_WEIGHT) : 0;

  const recommendationText = missingKeywords.length
    ? `Include ${missingKeywords.map(k => `"${k}"`).join(', ').replace(/, ([^,]*)$/, ', and $1')} in your experience section`
    : 'No high-impact keyword gaps detected.';
  // Format recommendations
  const formatMeta = sb.format_structure || {};
  const failedChecks = Array.isArray(formatMeta.failed_checks) ? formatMeta.failed_checks : [];
  // Format score weight in overall score (see atsScoring.js)
  const FORMAT_WEIGHT = 0.10;
  const perCheckPoints = formatMeta.total_checks ? Math.ceil((100 / formatMeta.total_checks) * FORMAT_WEIGHT) : 0;

  const scorecardHTML = `
    <div class="ats-scorecard">
      <div class="ats-header">
        <div class="ats-score-circle" style="--percentage: ${scorePercentage}deg;">
          <span class="ats-score-text">${ats.ats_score}%</span>
        </div>
        <h3 class="ats-title">ATS Compatibility Score</h3>
      </div>
      
      <div class="score-breakdown">
        <div class="sb-row">
          <span class="sb-label">Keywords Match</span>
          <div class="sb-bar"><div class="sb-fill" style="width:${(sb.keywords_match?.percentage ?? 0)}%"></div></div>
          <span class="sb-value">${(sb.keywords_match?.percentage ?? 0)}%</span>
        </div>
        <div class="sb-row">
          <span class="sb-label">Skills Alignment</span>
          <div class="sb-bar"><div class="sb-fill" style="width:${(sb.skills_alignment?.percentage ?? 0)}%"></div></div>
          <span class="sb-value">${(sb.skills_alignment?.percentage ?? 0)}%</span>
        </div>
        <div class="sb-row">
          <span class="sb-label">Experience Relevance</span>
          <div class="sb-bar"><div class="sb-fill" style="width:${(sb.experience_relevance?.percentage ?? 0)}%"></div></div>
          <span class="sb-value">${(sb.experience_relevance?.percentage ?? 0)}%</span>
        </div>
        <div class="sb-row">
          <span class="sb-label">Format & Structure</span>
          <div class="sb-bar"><div class="sb-fill" style="width:${(sb.format_structure?.percentage ?? 0)}%"></div></div>
          <span class="sb-value">${(sb.format_structure?.percentage ?? 0)}%</span>
        </div>
        <div class="sb-row">
          <span class="sb-label">Education Match</span>
          <div class="sb-bar"><div class="sb-fill" style="width:${(sb.education_match?.percentage ?? 0)}%"></div></div>
          <span class="sb-value">${(sb.education_match?.percentage ?? 0)}%</span>
        </div>
      </div>

      <h3 style="margin-top:16px;">Improvement Recommendations</h3>
      <div class="card" style="margin-top:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="badge" style="background:#ffd6d6;color:#a33;padding:6px 10px;border-radius:9999px;font-weight:600;">HIGH</span>
            <div style="font-weight:700;">Add Missing Keywords</div>
          </div>
          <div style="color:#0a8a0a; font-weight:700; white-space:nowrap;">+${pointsGain} points</div>
        </div>
        <div style="margin-top:8px;">${recommendationText}</div>
        ${missingKeywords.length ? `<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">${missingKeywords.map(k => `<span class=\"ats-skill-tag ats-skill-missing\">${k}</span>`).join('')}</div>` : ''}
      </div>
      ${failedChecks.map(chk => `
        <div class=\"card\" style=\"margin-top:8px;\">
          <div style=\"display:flex; align-items:center; justify-content:space-between; gap:12px;\">
            <div style=\"display:flex; align-items:center; gap:12px;\">
              <span class=\"badge\" style=\"background:#fff2cc;color:#8a6d00;padding:6px 10px;border-radius:9999px;font-weight:600;\">MEDIUM</span>
              <div style=\"font-weight:700;\">${chk}</div>
            </div>
            <div style=\"color:#0a8a0a; font-weight:700; white-space:nowrap;\">+${perCheckPoints} points</div>
          </div>
          <div class=\"muted\" style=\"margin-top:6px;\">This will improve format & structure for ATS parsing.</div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = scorecardHTML;
}

function renderCoverLetter(data, containerId) {
  const container = document.getElementById(containerId);
  if (!data.cover_letter) {
    container.innerHTML = '<div class="error">No cover letter data available</div>';
    return;
  }

  const idTail = containerId.replace('analyze-output-', '');
  const submissionId = idTail.split('-').pop();

  const coverLetterDiv = document.createElement('div');
  coverLetterDiv.innerHTML = `
    <div class="cover-letter-section">
      <div class="cover-letter-header">
        <h3 class="cover-letter-title">📄 Generated Cover Letter</h3>
        <div class="cover-letter-subtitle">Personalized based on your resume and the job posting</div>
      </div>

      <div class="cover-letter-content">${data.cover_letter}</div>

      <div class="cover-letter-controls">
        <label for="tone-${containerId}" class="muted">Tone</label>
        <select id="tone-${containerId}">
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="enthusiastic">Enthusiastic</option>
          <option value="concise">Concise</option>
        </select>

        <label for="length-${containerId}" class="muted">Length</label>
        <select id="length-${containerId}">
          <option value="short">Short (~2 paragraphs)</option>
          <option value="medium" selected>Medium (3-4 paragraphs)</option>
          <option value="long">Long (5+ paragraphs)</option>
        </select>

        <button class="regenerate-button" id="regenerate-${containerId}">🔁 Regenerate</button>
      </div>

      <div class="cover-letter-actions">
        <button class="copy-button" id="copy-btn-${containerId}">📋 Copy Cover Letter</button>
        <div class="export-buttons">
          <button class="export-button" id="export-word-${containerId}">📄 Export as Word</button>
          <button class="export-button" id="export-pdf-${containerId}">📑 Export as PDF</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(coverLetterDiv);

  const copyBtn = document.getElementById(`copy-btn-${containerId}`);
  copyBtn.addEventListener('click', () => {
    copyCoverLetter(copyBtn, data.cover_letter);
  });

  const exportWordBtn = document.getElementById(`export-word-${containerId}`);
  const exportPdfBtn = document.getElementById(`export-pdf-${containerId}`);
  exportWordBtn.addEventListener('click', () => {
    const tone = /** @type {HTMLSelectElement} */(document.getElementById(`tone-${containerId}`))?.value;
    const length = /** @type {HTMLSelectElement} */(document.getElementById(`length-${containerId}`))?.value;
    exportCoverLetter(submissionId, 'word', exportWordBtn, tone, length);
  });
  exportPdfBtn.addEventListener('click', () => {
    const tone = /** @type {HTMLSelectElement} */(document.getElementById(`tone-${containerId}`))?.value;
    const length = /** @type {HTMLSelectElement} */(document.getElementById(`length-${containerId}`))?.value;
    exportCoverLetter(submissionId, 'pdf', exportPdfBtn, tone, length);
  });

  const regenerateBtn = document.getElementById(`regenerate-${containerId}`);
  regenerateBtn.addEventListener('click', async () => {
    const tone = /** @type {HTMLSelectElement} */(document.getElementById(`tone-${containerId}`)).value;
    const length = /** @type {HTMLSelectElement} */(document.getElementById(`length-${containerId}`)).value;
    regenerateBtn.disabled = true;
    const originalText = regenerateBtn.textContent;
    regenerateBtn.textContent = '⏳ Regenerating...';
    try {
      const res = await fetch('/api/generate-cover-letter', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
        body: JSON.stringify({ submissionId, tone, length })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to regenerate');
      renderCoverLetter(json, containerId);
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      regenerateBtn.textContent = originalText;
      regenerateBtn.disabled = false;
    }
  });
}

function copyCoverLetter(button, text) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = '✅ Copied!';
    button.style.background = '#00b894';
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#00d4aa';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    button.textContent = '❌ Copy failed';
    setTimeout(() => {
      button.textContent = '📋 Copy Cover Letter';
    }, 2000);
  });
}

async function exportCoverLetter(submissionId, format, button, tone, length) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = format === 'word' ? '⏳ Generating Word...' : '⏳ Generating PDF...';

  try {
    const response = await fetch(`/api/export-cover-letter/${format}`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
      body: JSON.stringify({ submissionId: submissionId, tone, length })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to export as ${format.toUpperCase()}`);
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `cover_letter.${format === 'word' ? 'docx' : 'pdf'}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    button.textContent = format === 'word' ? '✅ Word Downloaded!' : '✅ PDF Downloaded!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);

  } catch (error) {
    console.error(`${format.toUpperCase()} export error:`, error);
    button.textContent = `❌ ${format.toUpperCase()} failed`;
    setTimeout(() => {
      button.textContent = originalText;
    }, 3000);
  } finally {
    button.disabled = false;
  }
}

function renderSubmissions(items, containerId, scope) {
  const list = document.getElementById(containerId);
  list.innerHTML = '';
  (items || []).forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    const dt = new Date(item.createdAt).toLocaleString();
    div.innerHTML = `
      <div><strong>Created</strong>: ${dt}</div>
      ${item.fileOriginalName ? `<div><strong>Resume</strong>: <a href="/uploads/${item.fileStoredName}" target="_blank" rel="noopener">${item.fileOriginalName}</a> <span class="muted">(${item.fileMimeType || ''}, ${item.fileSize || 0} bytes)</span></div>` : ''}
      ${item.jobPostOriginalName ? `<div><strong>Job Posting</strong>: <a href="/uploads/${item.jobPostStoredName}" target="_blank" rel="noopener">${item.jobPostOriginalName}</a> <span class="muted">(${item.jobPostMimeType || ''}, ${item.jobPostFileSize || 0} bytes)</span></div>` : ''}
      ${item.message ? `<div><strong>Message</strong>: ${item.message}</div>` : ''}
      <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
        <button data-action="analyze" data-scope="${scope}" data-id="${item._id}" ${item.fileStoredName ? '' : 'disabled'}>Analyze Resume</button>
        ${item.fileStoredName && item.jobPostStoredName ? `<button data-action="ats-score" data-scope="${scope}" data-id="${item._id}">Calculate ATS Score</button>` : ''}
        <button data-action="cover-letter" data-scope="${scope}" data-id="${item._id}" ${item.fileStoredName && item.jobPostStoredName ? '' : 'disabled'}>📄 Generate Cover Letter</button>
        <span class="muted" id="analyze-status-${scope}-${item._id}"></span>
      </div>
      <div class="muted" id="analyze-output-${scope}-${item._id}" style="white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px; display:none;"></div>
    `;
    list.appendChild(div);
  });
  if (!list.children.length) {
    list.innerHTML = '<div class="muted">No submissions yet.</div>';
  }

  list.querySelectorAll('button[data-action="analyze"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const sc = btn.getAttribute('data-scope');
      const statusEl = document.getElementById(`analyze-status-${sc}-${id}`);
      const outEl = document.getElementById(`analyze-output-${sc}-${id}`);
      statusEl.textContent = 'Analyzing...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const form = new FormData();
        form.append('submissionId', id);
        const res = await fetch('/api/analyze', { method: 'POST', body: form, headers: AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : undefined });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to analyze');
        statusEl.textContent = json.structured ? 'Done' : 'Done (raw shown)';
        const pretty = json.structured ? JSON.stringify(json.structured, null, 2) : (json.raw || '');
        outEl.innerHTML = `<pre style="white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px; margin:0;">${pretty}</pre>`;
        outEl.style.display = 'block';
      } catch (err) {
        statusEl.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  });

  list.querySelectorAll('button[data-action="ats-score"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const sc = btn.getAttribute('data-scope');
      const statusEl = document.getElementById(`analyze-status-${sc}-${id}`);
      const outEl = document.getElementById(`analyze-output-${sc}-${id}`);
      statusEl.textContent = 'Calculating ATS Score...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const form = new FormData();
        form.append('submissionId', id);
        form.append('calculateATS', 'true');
        const res = await fetch('/api/analyze', { method: 'POST', body: form, headers: AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : undefined });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to calculate ATS score');
        statusEl.textContent = 'ATS Score Calculated';
        if (json.ats_result) {
          renderATSScorecard(json, `analyze-output-${sc}-${id}`);
        } else {
          outEl.innerHTML = `<pre style=\"white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px;\">${JSON.stringify(json, null, 2)}</pre>`;
        }
        outEl.style.display = 'block';
      } catch (err) {
        statusEl.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  });

  list.querySelectorAll('button[data-action="cover-letter"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const sc = btn.getAttribute('data-scope');
      const statusEl = document.getElementById(`analyze-status-${sc}-${id}`);
      const outEl = document.getElementById(`analyze-output-${sc}-${id}`);
      statusEl.textContent = 'Generating Cover Letter...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const res = await fetch('/api/generate-cover-letter', { 
          method: 'POST', 
          headers: Object.assign({ 'Content-Type': 'application/json' }, AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
          body: JSON.stringify({ submissionId: id })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to generate cover letter');
        statusEl.textContent = 'Cover Letter Generated';
        if (json.cover_letter) {
          renderCoverLetter(json, `analyze-output-${sc}-${id}`);
        } else {
          outEl.innerHTML = `<pre style=\"white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px;\">${JSON.stringify(json, null, 2)}</pre>`;
        }
        outEl.style.display = 'block';
      } catch (err) {
        statusEl.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function loadRecent() {
  const recentList = document.getElementById('recent');
  const historyList = document.getElementById('history');
  if (recentList) recentList.innerHTML = '<div class="muted">Loading...</div>';
  if (historyList) historyList.innerHTML = '<div class="muted">Loading...</div>';
  const res = await fetch('/api/submissions', {
    headers: AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : undefined,
  });
  if (res.status === 401) {
    AUTH_TOKEN = '';
    AUTH_USER = null;
    AUTH_VERIFIED = false;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    updateAuthUI();
    return;
  }
  const json = await res.json();
  const items = json.items || [];
  const latest = items[0] ? [items[0]] : [];
  renderSubmissions(latest, 'recent', 'recent');
  renderSubmissions(items, 'history', 'history');
}

// Initial load: verify stored token before showing app
window.addEventListener('DOMContentLoaded', async () => {
  AUTH_VERIFIED = false;
  updateAuthUI();
  if (AUTH_TOKEN && AUTH_USER) {
    const ok = await verifyAuth();
    if (ok) {
      AUTH_VERIFIED = true;
      updateAuthUI();
      loadRecent();
    } else {
      AUTH_TOKEN = '';
      AUTH_USER = null;
      AUTH_VERIFIED = false;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      updateAuthUI();
    }
  }

  // Tabs setup
  const tabSubmit = document.getElementById('tab-submit');
  const tabHistory = document.getElementById('tab-history');
  const submitSection = document.getElementById('submit-section');
  const historySection = document.getElementById('history-section');
  if (tabSubmit && tabHistory && submitSection && historySection) {
    const activate = (which) => {
      if (which === 'submit') {
        tabSubmit.classList.add('active');
        tabHistory.classList.remove('active');
        submitSection.style.display = '';
        historySection.style.display = 'none';
      } else {
        tabSubmit.classList.remove('active');
        tabHistory.classList.add('active');
        submitSection.style.display = 'none';
        historySection.style.display = '';
      }
    };
    tabSubmit.addEventListener('click', () => activate('submit'));
    tabHistory.addEventListener('click', () => activate('history'));
  }
});

// Auth handlers
window.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  const status = document.getElementById('auth-status');
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userMenuButton = document.getElementById('user-menu-button');
  const userMenu = document.getElementById('user-menu');
  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.style.display = userMenu.style.display === 'none' || userMenu.style.display === '' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { userMenu.style.display = 'none'; });
    userMenu.addEventListener('click', (e) => { e.stopPropagation(); });
    userMenu.querySelectorAll('.user-menu-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        userMenu.style.display = 'none';
        if (action === 'logout') {
          try {
            if (AUTH_TOKEN) {
              await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } });
            }
          } catch {}
          AUTH_TOKEN = '';
          AUTH_USER = null;
          AUTH_VERIFIED = false;
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          updateAuthUI();
        } else if (action === 'account') {
          alert('Account page is not implemented yet.');
        } else if (action === 'premium') {
          alert('Premium page is not implemented yet.');
        } else if (action === 'shortcuts') {
          alert('Shortcuts: Use buttons on each submission item to analyze, score, or generate cover letter.');
        } else if (action === 'delete-account') {
          const confirmDelete = confirm('Are you sure you want to delete your account? This cannot be undone.');
          if (confirmDelete) {
            alert('Delete account flow not implemented.');
          }
        }
      });
    });
  }

  if (loginBtn) loginBtn.addEventListener('click', async () => {
    status.textContent = '';
    try {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Login failed');
      AUTH_TOKEN = json.token;
      AUTH_USER = json.user;
      AUTH_VERIFIED = true;
      localStorage.setItem('auth_token', AUTH_TOKEN);
      localStorage.setItem('auth_user', JSON.stringify(AUTH_USER));
      status.textContent = 'Logged in';
      status.className = 'success';
      updateAuthUI();
      await loadRecent();
    } catch (err) {
      status.textContent = err.message;
      status.className = 'error';
    }
  });

  if (registerBtn) registerBtn.addEventListener('click', async () => {
    status.textContent = '';
    try {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Register failed');
      status.textContent = 'Registered. You can log in now.';
      status.className = 'success';
    } catch (err) {
      status.textContent = err.message;
      status.className = 'error';
    }
  });

  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try {
      if (AUTH_TOKEN) {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } });
      }
    } catch {}
    AUTH_TOKEN = '';
    AUTH_USER = null;
    AUTH_VERIFIED = false;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    updateAuthUI();
  });
});

