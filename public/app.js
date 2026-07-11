const API = './api';

const userList = document.getElementById('userList');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statTraffic = document.getElementById('statTraffic');

const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const configModal = document.getElementById('configModal');

function bytesToGb(bytes) {
  return (bytes / (1024 ** 3)).toFixed(2);
}

function fmtBytes(bytes) {
  if (bytes === 0) return '0 GB';
  return `${bytesToGb(bytes)} GB`;
}

function fmtExpiry(expireAt) {
  if (!expireAt) return 'بدون انقضا';
  const days = Math.ceil((expireAt * 1000 - Date.now()) / 86400000);
  if (days < 0) return 'منقضی شده';
  return `${days} روز مانده`;
}

function meterHtml(user) {
  const segments = 20;
  if (!user.trafficLimitGb) {
    // unlimited: show a single quiet full row in neutral color
    return `<div class="meter">${'<span class="meter-seg filled" style="background:var(--muted)"></span>'.repeat(segments)}</div>`;
  }
  const limitBytes = user.trafficLimitGb * 1024 ** 3;
  const ratio = Math.min(1, user.trafficUsedBytes / limitBytes);
  const filledCount = Math.round(ratio * segments);
  let html = '<div class="meter">';
  for (let i = 0; i < segments; i++) {
    if (i < filledCount) {
      html += `<span class="meter-seg ${ratio >= 1 ? 'over' : 'filled'}"></span>`;
    } else {
      html += '<span class="meter-seg"></span>';
    }
  }
  html += '</div>';
  return html;
}

function userCardHtml(user) {
  const limitLabel = user.trafficLimitGb ? `${fmtBytes(user.trafficUsedBytes)} / ${user.trafficLimitGb} GB` : `${fmtBytes(user.trafficUsedBytes)} / نامحدود`;
  return `
    <div class="user-card ${user.enabled ? '' : 'disabled'}" data-id="${user.id}">
      <div class="user-top">
        <span class="user-remark">${escapeHtml(user.remark)}</span>
        <span class="user-uuid mono">${user.uuid.slice(0, 8)}…</span>
      </div>
      ${meterHtml(user)}
      <div class="user-meta">
        <span>${limitLabel}</span>
        <span>${fmtExpiry(user.expireAt)}</span>
      </div>
      <div class="user-actions">
        <button class="btn btn-ghost btn-small" data-action="config">اتصال / QR</button>
        <button class="btn btn-ghost btn-small" data-action="reset">ریست ترافیک</button>
        <button class="btn btn-ghost btn-small" data-action="toggle">${user.enabled ? 'غیرفعال کردن' : 'فعال کردن'}</button>
        <button class="btn btn-danger btn-small" data-action="delete">حذف</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadUsers() {
  const res = await fetch(`${API}/users`);
  if (!res.ok) {
    statusDot.className = 'dot off';
    statusText.textContent = 'خطا در اتصال';
    return;
  }
  statusDot.className = 'dot on';
  statusText.textContent = 'آنلاین';

  const users = await res.json();
  statTotal.textContent = users.length;
  statActive.textContent = users.filter((u) => u.enabled).length;
  const totalBytes = users.reduce((sum, u) => sum + u.trafficUsedBytes, 0);
  statTraffic.textContent = fmtBytes(totalBytes);

  userList.innerHTML = users.length
    ? users.map(userCardHtml).join('')
    : '<p style="color:var(--muted)">هنوز کاربری ساخته نشده.</p>';
}

userList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const card = e.target.closest('.user-card');
  const id = card.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    if (!confirm('این کاربر برای همیشه حذف شود؟')) return;
    await fetch(`${API}/users/${id}`, { method: 'DELETE' });
    loadUsers();
  } else if (action === 'reset') {
    await fetch(`${API}/users/${id}/reset`, { method: 'POST' });
    loadUsers();
  } else if (action === 'toggle') {
    const isDisabled = card.classList.contains('disabled');
    await fetch(`${API}/users/${id}/${isDisabled ? 'enable' : 'disable'}`, { method: 'POST' });
    loadUsers();
  } else if (action === 'config') {
    const res = await fetch(`${API}/users/${id}/config`);
    const data = await res.json();
    document.getElementById('qrImage').src = data.qrDataUrl;
    document.getElementById('linkText').value = data.link;
    configModal.showModal();
  }
});

document.getElementById('openCreate').addEventListener('click', () => {
  userForm.reset();
  userModal.showModal();
});
document.getElementById('cancelModal').addEventListener('click', () => userModal.close());
document.getElementById('closeConfigModal').addEventListener('click', () => configModal.close());
document.getElementById('copyLink').addEventListener('click', () => {
  const ta = document.getElementById('linkText');
  ta.select();
  navigator.clipboard.writeText(ta.value);
});

userForm.addEventListener('submit', async (e) => {
  const remark = document.getElementById('fRemark').value.trim();
  const trafficLimitGb = parseFloat(document.getElementById('fTraffic').value) || 0;
  const expireDays = parseInt(document.getElementById('fExpireDays').value, 10) || 0;
  const flow = document.getElementById('fFlow').value.trim();
  const expireAt = expireDays > 0 ? Math.floor(Date.now() / 1000) + expireDays * 86400 : 0;

  await fetch(`${API}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remark, trafficLimitGb, expireAt, flow }),
  });
  userModal.close();
  loadUsers();
});

loadUsers();
setInterval(loadUsers, 15000);
