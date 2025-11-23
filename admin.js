// Admin Portal logic
import { supabase, inviteUser, getKids } from './supabase.js';
import { confirmDialog, showToast, inputDialog, editGiftDialog } from './ui.js';

export const ADMIN_EMAIL = 'antonio.villasenor08@gmail.com';

async function requireAdmin() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user || null;
  if (!user) { window.location.href = 'signin.html'; throw new Error('Redirecting'); }
  const email = String(user.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) { window.location.href = 'index.html'; throw new Error('Redirecting'); }
  return user;
}

async function adminInvoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, ...payload }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await requireAdmin(); } catch { return; }

  // Elements
  const inviteEmail = document.getElementById('adminInviteEmail');
  const inviteName = document.getElementById('adminInviteName');
  const inviteBtn = document.getElementById('adminInviteBtn');
  const usersTableBody = document.querySelector('#adminUsersTable tbody');

  const newKidName = document.getElementById('adminNewKidName');
  const addKidBtn = document.getElementById('adminAddKidBtn');
  const kidsList = document.getElementById('adminKidsList');

  const kidFilter = document.getElementById('adminKidFilter');
  const kidGiftsList = document.getElementById('adminKidGiftsList');

  const currentYearInput = document.getElementById('adminCurrentYear');
  const lockAssignmentsChk = document.getElementById('adminLockAssignments');
  const saveSettingsBtn = document.getElementById('adminSaveSettingsBtn');

  const buyerSelect = document.getElementById('adminBuyerSelect');
  const recipientSelect = document.getElementById('adminRecipientSelect');
  const setAssignmentBtn = document.getElementById('adminSetAssignmentBtn');
  const assignmentsTBody = document.querySelector('#adminAssignmentsTable tbody');

  let cachedProfiles = [];
  let cachedKids = [];

  // Users
  async function loadUsers() {
    let rows = [];
    try {
      const res = await adminInvoke('list_profiles');
      rows = res?.data || [];
    } catch (e) {
      console.error('list_profiles failed, falling back to profiles table', e);
    }
    if (!rows.length) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name', { ascending: true });
        if (error) throw error;
        rows = (data || []).map(p => ({ id: p.id, full_name: p.full_name || null, email: null }));
        try { showToast('Loaded users (fallback)'); } catch {}
      } catch (e2) {
        console.error('Fallback profiles query failed', e2);
        try { showToast('Unable to load users', 'error'); } catch {}
        rows = [];
      }
    }
    usersTableBody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const fullName = r.full_name || '';
      tr.innerHTML = `<td>${r.id}</td><td>${fullName}</td><td>${r.email || ''}</td>`;
      usersTableBody.appendChild(tr);
    });
    cachedProfiles = rows;
    // Populate assignment selects
    function fillPeople(select) {
      select.innerHTML = '<option value="">Select...</option>';
      rows.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.full_name || p.email || p.id; select.appendChild(o); });
    }
    fillPeople(buyerSelect); fillPeople(recipientSelect);
  }

  inviteBtn?.addEventListener('click', async () => {
    const email = (inviteEmail.value || '').trim();
    const fullName = (inviteName.value || '').trim();
    if (!email) { showToast('Email required', 'error'); return; }
    const prev = inviteBtn.textContent;
    inviteBtn.disabled = true;
    inviteBtn.textContent = 'Inviting…';
    inviteBtn.setAttribute('aria-busy', 'true');
    try {
      await inviteUser(email, fullName || undefined);
      showToast('Invite sent');
      inviteEmail.value = '';
      inviteName.value = '';
    } catch(e){
      console.error(e);
      showToast('Failed to invite', 'error');
    } finally {
      inviteBtn.disabled = false;
      inviteBtn.textContent = prev;
      inviteBtn.removeAttribute('aria-busy');
    }
  });

  // Kids
  async function loadKids() {
    let kids = [];
    try {
      const res = await adminInvoke('list_kids');
      kids = res?.data || [];
    } catch (e) {
      console.error('list_kids failed, falling back to direct select', e);
    }
    if (!kids.length) {
      try {
        kids = await getKids();
        try { showToast('Loaded kids (fallback)'); } catch {}
      } catch (e2) {
        console.error('Fallback getKids failed', e2);
        try { showToast('Unable to load kids', 'error'); } catch {}
        kids = [];
      }
    }
    cachedKids = kids;
    // list items
    kidsList.innerHTML = '';
    if (!kids.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No kids yet';
      kidsList.appendChild(li);
    } else {
      kids.forEach(k => {
        const li = document.createElement('li');
        li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center'; li.style.padding = '6px 0';
        li.innerHTML = `<span>${k.name}</span>
          <span style="display:flex; gap:8px;">
            <button class="btn-secondary" data-action="rename" data-id="${k.id}">Rename</button>
            <button class="btn-delete" data-action="delete" data-id="${k.id}">Delete</button>
          </span>`;
        kidsList.appendChild(li);
      });
    }
    // filter select
    kidFilter.innerHTML = '<option value="">Select a child...</option>';
    kids.forEach(k => { const o=document.createElement('option'); o.value=k.id; o.textContent=k.name; kidFilter.appendChild(o); });
  }

  addKidBtn?.addEventListener('click', async () => {
    const name = (newKidName.value || '').trim();
    if (!name) { showToast('Enter a name', 'error'); return; }
    try { await adminInvoke('add_kid', { name }); newKidName.value=''; await loadKids(); showToast('Child added'); }
    catch(e){ console.error(e); showToast('Failed to add child', 'error'); }
  });

  kidsList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const action = btn.getAttribute('data-action'); const id = btn.getAttribute('data-id');
    if (action === 'rename') {
      const cur = cachedKids.find(k => String(k.id) === String(id));
      const name = await inputDialog({ title: 'Rename Child', label: "Child's name", placeholder: cur?.name || '' });
      if (!name) return;
      try { await adminInvoke('rename_kid', { id, name }); await loadKids(); showToast('Renamed'); }
      catch(e){ console.error(e); showToast('Failed to rename', 'error'); }
    } else if (action === 'delete') {
      const ok = await confirmDialog({ title: 'Delete Child', message: 'Delete this child and all their suggestions?', confirmText: 'Delete' });
      if (!ok) return;
      try { await adminInvoke('delete_kid', { id }); await loadKids(); showToast('Deleted'); }
      catch(e){ console.error(e); showToast('Failed to delete', 'error'); }
    }
  });

  // Kid gifts
  async function loadKidGiftsAdmin(kidId) {
    kidGiftsList.innerHTML = '';
    const header = document.getElementById('adminKidGiftsHeader');
    if (!kidId) { if (header) header.textContent = ''; return; }
    const res = await adminInvoke('list_kid_gifts', { kid_id: kidId });
    const gifts = res?.data || [];
    // Update header with counts
    try {
      const kid = (cachedKids || []).find(k => String(k.id) === String(kidId));
      const claimed = (gifts || []).filter(g => !!g.claimed_by_full_name).length;
      const total = (gifts || []).length;
      if (header) {
        const name = kid?.name || '';
        header.innerHTML = name ? `<div><strong>${total}</strong> gifts for <strong>${name}</strong></div><div class="count">${claimed} claimed<\/div>` : `<div><strong>${total}</strong> gifts</div><div class="count">${claimed} claimed<\/div>`;
      }
    } catch {}
    if (!gifts.length) { kidGiftsList.innerHTML = '<p class="no-gifts-message">No gifts yet.</p>'; return; }
    gifts.forEach(g => {
      const link = g.link || null;
      const hasLink = !!link;
      const dom = hasLink ? (()=>{ try{ return new URL(link).hostname.replace(/^www\./,''); } catch { return ''; } })() : '';
      const titleText = String(g.name||'').replace(/\s*\((https?:[^)]+)\)\s*$/i,'').trim() || (hasLink ? '(Link)' : '');
      const el = document.createElement('div');
      el.className = `gift-item ${hasLink ? 'link-card' : 'compact'}`;
      el.innerHTML = hasLink ? `
        <div style="display:flex; gap:12px; align-items:center; width:100%">
          <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; flex:1 1 auto; min-width:0;">
            <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">
              <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">
            </div>
            <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">
              <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}<\/h3>
              <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px;">${dom} ↗<\/p>
              ${g.notes ? `<p class="gift-notes" style="margin-top:4px;">${g.notes}<\/p>` : ''}
            <\/div>
          <\/a>
          <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">
            ${g.claimed_by_full_name ? `<span class="claimer-badge other" title="${g.claimed_by_full_name}">${(g.claimed_by_full_name||'').split(/\s+/).slice(0,2).join(' ')}<\/span>` : ''}
            <button class="btn-secondary" data-action="edit" data-id="${g.id}" data-kid="${g.kid_id}">Edit<\/button>
            <button class="btn-secondary" data-action="clear" data-id="${g.id}">Clear Claim<\/button>
            <button class="btn-delete" data-action="delete" data-id="${g.id}">Delete<\/button>
          <\/div>
        <\/div>` : `
        <div style="display:flex; gap:12px; align-items:center; width:100%">
          <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">
            <h3 style="overflow-wrap:anywhere; word-break:break-word; margin:0 0 4px 0;">${g.name}<\/h3>
            ${g.notes ? `<p class="gift-notes" style="margin:0;">${g.notes}<\/p>` : ''}
          <\/div>
          <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">
            ${g.claimed_by_full_name ? `<span class="claimer-badge other" title="${g.claimed_by_full_name}">${(g.claimed_by_full_name||'').split(/\s+/).slice(0,2).join(' ')}<\/span>` : ''}
            <button class="btn-secondary" data-action="edit" data-id="${g.id}" data-kid="${g.kid_id}">Edit<\/button>
            <button class="btn-secondary" data-action="clear" data-id="${g.id}">Clear Claim<\/button>
            <button class="btn-delete" data-action="delete" data-id="${g.id}">Delete<\/button>
          <\/div>
        <\/div>`;
      // Claim setter block
      const claimWrap = document.createElement('div');
      claimWrap.style.marginTop = '8px';
      claimWrap.innerHTML = `<div style="display:flex; gap:8px; align-items:center;">
        <select data-action="set-claim" data-id="${g.id}"><option value="">Set claim to...</option></select>
        <button class="btn-secondary" data-action="apply-claim" data-id="${g.id}">Apply<\/button>
      <\/div>`;
      el.appendChild(claimWrap);
      const select = claimWrap.querySelector('select');
      (cachedProfiles||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.full_name||p.email||p.id; select.appendChild(o); });
      kidGiftsList.appendChild(el);
    });
  }

  kidFilter?.addEventListener('change', async () => { await loadKidGiftsAdmin(kidFilter.value); });

  kidGiftsList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const action = btn.getAttribute('data-action'); const id = btn.getAttribute('data-id');
    if (action === 'delete') {
      const ok = await confirmDialog({ title: 'Delete Gift', message: 'Delete this suggestion?', confirmText: 'Delete' }); if (!ok) return;
      try { await adminInvoke('delete_kid_gift', { id }); await loadKidGiftsAdmin(kidFilter.value); showToast('Deleted'); } catch(e){ console.error(e); showToast('Failed to delete', 'error'); }
    } else if (action === 'clear') {
      try { await adminInvoke('clear_claim', { id }); await loadKidGiftsAdmin(kidFilter.value); showToast('Claim cleared'); } catch(e){ console.error(e); showToast('Failed to clear', 'error'); }
    } else if (action === 'edit') {
      const card = btn.closest('.gift-item');
      const currentName = card?.querySelector('.gift-item-info h3')?.textContent?.trim() || '';
      const currentLink = card?.querySelector('a[href]')?.getAttribute('href') || '';
      const res = await editGiftDialog({ title: 'Edit kid gift', initialName: currentName, initialLink: currentLink });
      if (!res) return; const name = res.name || currentName; const link = res.link || null;
      try { await adminInvoke('update_kid_gift', { id, fields: { name, link } }); await loadKidGiftsAdmin(kidFilter.value); showToast('Updated'); } catch(e){ console.error(e); showToast('Failed to update', 'error'); }
    } else if (action === 'apply-claim') {
      const wrap = btn.parentElement; const select = wrap?.querySelector('select[data-action="set-claim"][data-id="'+id+'"]');
      const userId = select?.value || '';
      if (!userId) { showToast('Select a user', 'error'); return; }
      try { await adminInvoke('set_claim', { id, user_id: userId }); await loadKidGiftsAdmin(kidFilter.value); showToast('Claim set'); } catch(e){ console.error(e); showToast('Failed to set claim', 'error'); }
    }
  });

  // Settings
  async function loadSettings() {
    const res = await adminInvoke('get_app_settings');
    const map = Object.fromEntries((res?.data||[]).map(r => [r.key, r.value]));
    const year = parseInt(map['current_year'] || '') || (new Date().getFullYear());
    currentYearInput.value = String(year);
    lockAssignmentsChk.checked = String(map['lock_assignments']||'').toLowerCase() === 'true';
  }

  saveSettingsBtn?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Save Settings', message: 'Update current year and lock flag?', confirmText: 'Save' });
    if (!ok) return;
    const year = String(parseInt(currentYearInput.value||'') || new Date().getFullYear());
    const locked = lockAssignmentsChk.checked ? 'true' : 'false';
    try {
      await adminInvoke('set_app_setting', { key: 'current_year', value: year });
      await adminInvoke('set_app_setting', { key: 'lock_assignments', value: locked });
      await loadSettings();
      showToast('Settings saved');
      await loadAssignments();
    } catch(e){ console.error(e); showToast('Failed to save settings', 'error'); }
  });

  // Assignments
  async function loadAssignments() {
    const year = parseInt(currentYearInput.value||'') || new Date().getFullYear();
    const res = await adminInvoke('list_assignments', { year });
    const rows = res?.data || [];
    assignmentsTBody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.buyer_name || r.buyer_user_id}</td><td>${r.recipient_name || r.recipient_user_id || ''}</td><td>${r.year}</td>`;
      assignmentsTBody.appendChild(tr);
    });
  }

  setAssignmentBtn?.addEventListener('click', async () => {
    const buyer = buyerSelect.value; const recipient = recipientSelect.value; const year = parseInt(currentYearInput.value||'') || new Date().getFullYear();
    if (!buyer || !recipient) { showToast('Select buyer and recipient', 'error'); return; }
    try {
      await adminInvoke('upsert_assignment', { buyer_user_id: buyer, recipient_user_id: recipient, year });
      await loadAssignments();
      showToast('Assignment saved');
    } catch(e){
      console.error(e);
      const msg = e?.message || 'Failed to save assignment';
      showToast(msg, 'error');
    }
  });

  // Initial loads
  try { await loadSettings(); } catch(e){ console.error('loadSettings failed', e); }
  try { await loadUsers(); } catch(e){ console.error('loadUsers failed', e); }
  try { await loadKids(); } catch(e){ console.error('loadKids failed', e); }
  try { await loadAssignments(); } catch(e){ console.error('loadAssignments failed', e); }
});


