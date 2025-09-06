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

  const submissionId = containerId.replace('analyze-output-', '');

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
        headers: { 'Content-Type': 'application/json' },
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
      headers: {
        'Content-Type': 'application/json'
      },
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

async function loadRecent() {
  const list = document.getElementById('recent');
  list.innerHTML = '<div class="muted">Loading...</div>';
  const res = await fetch('/api/submissions');
  const json = await res.json();
  list.innerHTML = '';
  (json.items || []).forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    const dt = new Date(item.createdAt).toLocaleString();
    div.innerHTML = `
      <div><strong>Created</strong>: ${dt}</div>
      ${item.fileOriginalName ? `<div><strong>Resume</strong>: <a href="/uploads/${item.fileStoredName}" target="_blank" rel="noopener">${item.fileOriginalName}</a> <span class="muted">(${item.fileMimeType || ''}, ${item.fileSize || 0} bytes)</span></div>` : ''}
      ${item.jobPostOriginalName ? `<div><strong>Job Posting</strong>: <a href="/uploads/${item.jobPostStoredName}" target="_blank" rel="noopener">${item.jobPostOriginalName}</a> <span class="muted">(${item.jobPostMimeType || ''}, ${item.jobPostFileSize || 0} bytes)</span></div>` : ''}
      ${item.message ? `<div><strong>Message</strong>: ${item.message}</div>` : ''}
      <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
        <button data-action="analyze" data-id="${item._id}" ${item.fileStoredName ? '' : 'disabled'}>Analyze Resume</button>
        ${item.fileStoredName && item.jobPostStoredName ? `<button data-action="ats-score" data-id="${item._id}">Calculate ATS Score</button>` : ''}
        <button data-action="cover-letter" data-id="${item._id}" ${item.fileStoredName && item.jobPostStoredName ? '' : 'disabled'}>📄 Generate Cover Letter</button>
        <span class="muted" id="analyze-status-${item._id}"></span>
      </div>
      <div class="muted" id="analyze-output-${item._id}" style="white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px; display:none;"></div>
    `;
    list.appendChild(div);
  });
  if (!list.children.length) {
    list.innerHTML = '<div class="muted">No submissions yet.</div>';
  }

  list.querySelectorAll('button[data-action="analyze"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const statusEl = document.getElementById(`analyze-status-${id}`);
      const outEl = document.getElementById(`analyze-output-${id}`);
      statusEl.textContent = 'Analyzing...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const form = new FormData();
        form.append('submissionId', id);
        const res = await fetch('/api/analyze', { method: 'POST', body: form });
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
      const statusEl = document.getElementById(`analyze-status-${id}`);
      const outEl = document.getElementById(`analyze-output-${id}`);
      statusEl.textContent = 'Calculating ATS Score...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const form = new FormData();
        form.append('submissionId', id);
        form.append('calculateATS', 'true');
        const res = await fetch('/api/analyze', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to calculate ATS score');
        statusEl.textContent = 'ATS Score Calculated';
        if (json.ats_result) {
          renderATSScorecard(json, `analyze-output-${id}`);
        } else {
          outEl.innerHTML = `<pre style="white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px;">${JSON.stringify(json, null, 2)}</pre>`;
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
      const statusEl = document.getElementById(`analyze-status-${id}`);
      const outEl = document.getElementById(`analyze-output-${id}`);
      statusEl.textContent = 'Generating Cover Letter...';
      outEl.style.display = 'none';
      outEl.innerHTML = '';
      btn.disabled = true;
      try {
        const res = await fetch('/api/generate-cover-letter', { 
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ submissionId: id })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to generate cover letter');
        statusEl.textContent = 'Cover Letter Generated';
        if (json.cover_letter) {
          renderCoverLetter(json, `analyze-output-${id}`);
        } else {
          outEl.innerHTML = `<pre style="white-space:pre-wrap; background:#f6f8fa; padding:8px; border-radius:6px;">${JSON.stringify(json, null, 2)}</pre>`;
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

window.addEventListener('DOMContentLoaded', loadRecent);


