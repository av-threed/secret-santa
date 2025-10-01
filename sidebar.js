// Import Supabase functions
import { getMyGifts, deleteGift, addGiftToList, signOut as supaSignOut, getKids, getKidGifts, deleteKidGift, getRecipientForBuyer, getUserGifts, getProfile, listProfilesExcludingSelf, upsertMyRecipient, isAssignmentsLocked } from './supabase.js';
import { confirmDialog, showToast, editGiftDialog } from './ui.js';

// Sidebar functionality
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const appBar = document.querySelector('.app-bar');
    const sidebarPin = document.getElementById('sidebarPin');
    const myGiftListBtn = document.getElementById('myGiftList');
    const kidsGiftListBtn = document.getElementById('kidsGiftList');
    const recipientGiftsBtn = document.getElementById('recipientGifts');
    const setRecipientBtn = document.getElementById('setRecipient');
    const settingsBtn = document.getElementById('settingsBtn');
    const myGiftListModal = document.getElementById('myGiftListModal');
    const kidsGiftListModal = document.getElementById('kidsGiftListModal');
    const recipientGiftsModal = document.getElementById('recipientGiftsModal');
    const setRecipientModal = document.getElementById('setRecipientModal');
    const settingsModal = document.getElementById('settingsModal');
    const settingsForm = document.getElementById('settingsForm');
    const settingPinSidebar = document.getElementById('settingPinSidebar');
    const settingTheme = document.getElementById('settingTheme');
    const closeButtons = document.querySelectorAll('.modal-close');
    const myGiftsList = document.getElementById('myGiftsList');
    const addGiftForm = document.getElementById('addGiftForm');
    const kidSelector = document.getElementById('kidSelector');
    const selectedKidGifts = document.getElementById('selectedKidGifts');
    const recipientHeader = document.getElementById('recipientHeader');
    const recipientGiftsList = document.getElementById('recipientGiftsList');
    const recipientSelect = document.getElementById('recipientSelect');
    const saveRecipientBtn = document.getElementById('saveRecipientBtn');
    const recipientStatus = document.getElementById('recipientStatus');
    const badgeMyGifts = document.getElementById('badgeMyGifts');
    const badgeKids = document.getElementById('badgeKids');
    let currentModal = null;

    // Multi-select controls (My Gifts)
    const multiSelectToggle = document.getElementById('multiSelectToggle');
    const multiSelectActions = document.getElementById('multiSelectActions');
    const multiSelectCount = document.getElementById('multiSelectCount');
    const multiDeleteBtn = document.getElementById('multiDeleteBtn');
    const multiCancelBtn = document.getElementById('multiCancelBtn');
    let multiSelectMode = false;
    const selectedMyGiftIds = new Set();

    // SVG icon helpers for claim / unclaim (inline for portability)
    function claimSvg() {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5 11-11"/><path d="M2 12l5 5" opacity=".35"/></svg>';
    }
    function unclaimSvg() {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
    }

    function editSvg() {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" opacity=".35"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    }
    function deleteSvg() {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2" opacity=".55"/><path d="M10 11v6M14 11v6"/><rect x="5" y="6" width="14" height="14" rx="2" ry="2"/></svg>';
    }

    // --- Helpers shared with dev page ---
    function domainFromUrl(href) {
        try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
    }

    function extractLinkFromName(name) {
        const text = String(name || '');
        // 1) (https://....) at end
        let m = text.match(/\((https?:[^)\s]+)\)\s*$/i);
        if (m) return m[1];
        // 2) any http(s) substring
        m = text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
        if (m) return m[0].replace(/[)\]]+$/, '');
        return null;
    }

    // Local kids fallback & claims
    function localKeyForKid(kidId) { return `kid_gifts_local:${kidId}`; }
    function localClaimKeyForKid(kidId) { return `kid_gifts_claims:${kidId}`; }
    function getLocalClaimSet(kidId) {
        try { return new Set(JSON.parse(localStorage.getItem(localClaimKeyForKid(kidId)) || '[]')); } catch { return new Set(); }
    }
    function saveLocalClaimSet(kidId, set) {
        try { localStorage.setItem(localClaimKeyForKid(kidId), JSON.stringify(Array.from(set))); } catch {}
    }
    function getLocalKidGifts(kidId) {
        try {
            const arr = JSON.parse(localStorage.getItem(localKeyForKid(kidId)) || '[]');
            const claims = getLocalClaimSet(kidId);
            return arr.map(raw => {
                const link = extractLinkFromName(raw);
                const claimed_by = claims.has(raw) ? 'local' : null;
                return { id: `local-kid-${kidId}-${encodeURIComponent(raw)}`, name: raw, link, claimed_by, local_key: raw };
            });
        } catch { return []; }
    }
    function deleteLocalKidGift(kidId, rawName) {
        try {
            const key = localKeyForKid(kidId);
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(arr.filter(x => x !== rawName)));
            const claims = getLocalClaimSet(kidId);
            if (claims.has(rawName)) { claims.delete(rawName); saveLocalClaimSet(kidId, claims); }
        } catch {}
    }

    // Guard to avoid attaching duplicate delegated handlers
    let kidsDeleteBound = false;
    let kidsClaimBound = false;

    // Settings helpers
    function getSettings() {
        try { return JSON.parse(localStorage.getItem('app_settings') || '{}'); } catch { return {}; }
    }

    function saveSettings(settings) {
        try { localStorage.setItem('app_settings', JSON.stringify(settings || {})); } catch {}
    }

    function applyPinnedFromSettings(settings) {
        const wantPinned = !!settings?.pinSidebarDefault;
        if (wantPinned) {
            sidebar.classList.add('pinned');
            sidebarPin?.classList.add('active');
            if (appBar) appBar.classList.add('pinned');
        } else {
            sidebar.classList.remove('pinned');
            sidebarPin?.classList.remove('active');
            if (appBar) appBar.classList.remove('pinned');
        }
    }

    function applyThemeFromSettings(settings) {
        const raw = (settings && settings.theme) ? settings.theme : 'system';
        const applied = (raw === 'light' || raw === 'dark') ? raw : 'system';
        document.documentElement.setAttribute('data-theme', applied);
    }

    // Apply saved settings on load
    (function initSettingsOnLoad(){
        const s = getSettings();
        applyPinnedFromSettings(s);
        applyThemeFromSettings(s);
    })();

    // Sidebar pin toggle
    sidebarPin.addEventListener('click', () => {
        sidebar.classList.toggle('pinned');
        sidebarPin.classList.toggle('active');
        // Sync app bar padding when sidebar pins
        if (appBar) {
            if (sidebar.classList.contains('pinned')) {
                appBar.classList.add('pinned');
            } else {
                appBar.classList.remove('pinned');
            }
        }
    });

    // Load and display gifts
    async function loadMyGifts() {
        try {
            let gifts = [];
            try {
                gifts = await getMyGifts();
            } catch (e) {
                // ignore and fall back to local storage
            }

            // If no gifts from DB, try localStorage fallback
            if (!gifts || gifts.length === 0) {
                const local = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
                gifts = local.map(name => ({ id: `local-${name}`, name }));
            }

            displayGifts(gifts);
            try { if (badgeMyGifts) badgeMyGifts.textContent = String(gifts?.length || 0); } catch {}
        } catch (error) {
            console.error('Error loading gifts:', error);
        }
    }

    // Display gifts in the modal (render link cards)
    function displayGifts(gifts) {
        myGiftsList.innerHTML = '';
        
        if (!gifts || gifts.length === 0) {
            myGiftsList.innerHTML = '<p class="no-gifts-message">No gifts added yet.</p>';
            return;
        }

        gifts.forEach(gift => {
            const giftElement = document.createElement('div');
            const link = gift.link || extractLinkFromName(gift.name);
            const hasLink = !!link;
            giftElement.className = `gift-item ${hasLink ? 'link-card' : 'compact'}`;
            if (multiSelectMode) giftElement.classList.add('multi-selectable');
                        if (hasLink) {
                const dom = domainFromUrl(link);
                const titleText = String(gift.name||'').replace(/\s*\((https?:[^)]+)\)\s*$/i,'').trim() || '(Link)';
                                giftElement.innerHTML = `
                    <div style="display:flex; gap:12px; align-items:center; width:100%;">
                                            <a ${multiSelectMode ? '' : `href="${link}" target="_blank" rel="noopener noreferrer"`} style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; flex:1 1 auto; min-width:0; ${multiSelectMode ? 'pointer-events:none; user-select:none;' : ''}">
                        <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                          <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">
                        </div>
                        <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">
                          <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}</h3>
                          <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px; overflow-wrap:anywhere;">${dom} ↗</p>
                        </div>
                      </a>
                      <div class="gift-item-actions" style="margin-left:auto;">
                        <button class="btn-icon btn-edit-my" aria-label="Edit gift" data-id="${gift.id}">${editSvg()}</button>
                                                    <button class="btn-icon" aria-label="Delete gift" onclick="deleteGift('${gift.id}')">${deleteSvg()}</button>
                      </div>
                    </div>`;
            } else {
                giftElement.innerHTML = `
                    <div class="gift-item-info">
                      <h3 style="overflow-wrap:anywhere; word-break:break-word;">${gift.name}</h3>
                    </div>
                    <div class="gift-item-actions">
                      <button class="btn-icon btn-edit-my" aria-label="Edit gift" data-id="${gift.id}">${editSvg()}</button>
                                                <button class="btn-icon" aria-label="Delete gift" onclick="deleteGift('${gift.id}')">${deleteSvg()}</button>
                    </div>`;
            }
            if (multiSelectMode) {
                const box = document.createElement('span');
                box.className = 'multi-select-checkbox';
                const idStr = String(gift.id);
                if (selectedMyGiftIds.has(idStr)) {
                    giftElement.dataset.selected = 'true';
                    box.textContent = '✓';
                }
                giftElement.prepend(box);
                giftElement.tabIndex = 0;
                giftElement.addEventListener('click', (ev) => {
                    if (ev.target.closest('.gift-item-actions')) return;
                    toggleGiftSelection(idStr, giftElement);
                }, { capture: true });
                giftElement.addEventListener('keydown', (ev) => {
                    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleGiftSelection(idStr, giftElement); }
                });
            }
            myGiftsList.appendChild(giftElement);
        });

        // Edit buttons
        if (!multiSelectMode) {
          myGiftsList.querySelectorAll('.btn-edit-my').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const card = btn.closest('.gift-item');
                const titleEl = card?.querySelector('.gift-item-info h3');
                const currentName = (titleEl?.textContent || '').trim();
                const currentLink = card?.querySelector('a[href]')?.getAttribute('href') || '';
                const res = await editGiftDialog({ title: 'Edit gift', initialName: currentName, initialLink: currentLink });
                if (!res) return;
                const newName = res.name || currentName; const newLink = res.link || '';
                // Local-only gifts
                if (typeof id === 'string' && id.startsWith('local-')) {
                    const oldName = id.slice('local-'.length);
                    const stored = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
                    const idx = stored.indexOf(oldName);
                    const display = newLink ? `${newName} (${newLink})` : newName;
                    if (idx >= 0) stored[idx] = display;
                    localStorage.setItem('my_gift_ideas', JSON.stringify(stored));
                    loadMyGifts();
                    return;
                }
                // DB path: simulate update via delete+insert
                try {
                    await deleteGift(id);
                    const payload = newLink ? { name: newName, link: newLink } : { name: newName };
                    await addGiftToList(payload);
                    loadMyGifts();
                } catch (e) { showToast('Failed to edit gift', 'error'); }
            });
          });
        }
    }

    function toggleGiftSelection(idStr, el) {
        if (!multiSelectMode) return;
        if (selectedMyGiftIds.has(idStr)) {
            selectedMyGiftIds.delete(idStr);
            el.removeAttribute('data-selected');
            const box = el.querySelector('.multi-select-checkbox'); if (box) box.textContent='';
        } else {
            selectedMyGiftIds.add(idStr);
            el.dataset.selected='true';
            const box = el.querySelector('.multi-select-checkbox'); if (box) box.textContent='✓';
        }
        updateMultiSelectBar();
    }

    function updateMultiSelectBar() {
        if (!multiSelectActions || !multiSelectToggle) return;
        if (multiSelectMode) {
            multiSelectActions.style.display='inline-flex';
            multiSelectToggle.style.display='none';
            document.body.classList.add('multi-select-mode');
        } else {
            multiSelectActions.style.display='none';
            multiSelectToggle.style.display='inline-block';
            document.body.classList.remove('multi-select-mode');
        }
        if (multiSelectCount) multiSelectCount.textContent = `${selectedMyGiftIds.size} selected`;
    }

    multiSelectToggle?.addEventListener('click', () => {
        multiSelectMode = true;
        selectedMyGiftIds.clear();
        updateMultiSelectBar();
        loadMyGifts();
    });
    multiCancelBtn?.addEventListener('click', () => {
        multiSelectMode = false;
        selectedMyGiftIds.clear();
        updateMultiSelectBar();
        loadMyGifts();
    });
    multiDeleteBtn?.addEventListener('click', async () => {
        if (!selectedMyGiftIds.size) { showToast('No gifts selected', 'error'); return; }
        const ok = await confirmDialog({ title: 'Delete Gifts', message: `Delete ${selectedMyGiftIds.size} selected gift(s)?`, confirmText: 'Delete' });
        if (!ok) return;
        let failures = 0;
        for (const id of Array.from(selectedMyGiftIds)) {
            try {
                if (id.startsWith('local-')) {
                    const name = id.slice('local-'.length);
                    const stored = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
                    const idx = stored.indexOf(name);
                    if (idx >= 0) { stored.splice(idx,1); localStorage.setItem('my_gift_ideas', JSON.stringify(stored)); }
                } else {
                    await deleteGift(id);
                }
            } catch { failures++; }
        }
        if (failures) showToast(`Deleted with ${failures} error(s)`, 'error'); else showToast('Deleted selected');
        multiSelectMode = false;
        selectedMyGiftIds.clear();
        updateMultiSelectBar();
        loadMyGifts();
    });

    async function loadRecipientGifts() {
        recipientGiftsList.innerHTML = '';
        recipientHeader.textContent = '';
        try {
            const recipientId = await getRecipientForBuyer();
            if (!recipientId) {
                recipientHeader.textContent = 'No assignment found yet.';
                return;
            }
            const profile = await getProfile(recipientId);
            recipientHeader.textContent = profile?.full_name ? `You\'re buying for: ${profile.full_name}` : '';
            const gifts = await getUserGifts(recipientId);
            if (!gifts || gifts.length === 0) {
                recipientGiftsList.innerHTML = '<p class="no-gifts-message">No gift ideas yet.</p>';
                return;
            }
            gifts.forEach(gift => {
                const el = document.createElement('div');
                el.className = 'gift-item';
                el.innerHTML = `
                    <div class="gift-item-info">
                        <h3>${gift.name}</h3>
                        ${gift.price ? `<p class="gift-price">Price: ${gift.price}</p>` : ''}
                        ${gift.link ? `<p class="gift-link"><a href="${gift.link}" target="_blank">View Item</a></p>` : ''}
                        ${gift.notes ? `<p class="gift-notes">${gift.notes}</p>` : ''}
                    </div>
                `;
                recipientGiftsList.appendChild(el);
            });
        } catch (e) {
            console.error('Failed to load recipient gifts', e);
            recipientGiftsList.innerHTML = '<p class="no-gifts-message">Unable to load recipient gifts.</p>';
        }
    }

    async function populateRecipientOptions() {
        recipientSelect.innerHTML = '<option value="">Select a person...</option>';
        try {
            const list = await listProfilesExcludingSelf();
            list.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.full_name || p.id;
                recipientSelect.appendChild(opt);
            });
        } catch (e) { console.error('Failed to load profiles', e); }
    }

    async function populateKidsInModal() {
        try {
            const kids = await getKids();
            while (kidSelector.options.length > 1) kidSelector.remove(1);
            kids.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k.id;
                opt.textContent = k.name;
                kidSelector.appendChild(opt);
            });
            try { if (badgeKids) badgeKids.textContent = String(kids?.length || 0); } catch {}
        } catch (e) { console.error('Failed to load kids', e); }
    }

    async function loadKidGifts(kidId) {
        if (!kidId) { selectedKidGifts.innerHTML = ''; return; }
        try {
            // Determine current user id for claim ownership
            let me = null; let myProfileName = '';
            try {
                const { supabase } = await import('./supabase.js');
                const { data: userData } = await supabase.auth.getUser();
                me = userData?.user?.id || null;
                if (me) {
                    try { const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', me).single(); myProfileName = prof?.full_name || ''; } catch {}
                }
            } catch {}
            const giftsDb = await getKidGifts(kidId); // includes potential claimed_by
            const gifts = [ ...(giftsDb || []), ...getLocalKidGifts(kidId) ]; // merge local offline
            selectedKidGifts.innerHTML = '';
            // Insert filter toggle once (unclaimed filter)
            if (!document.getElementById('unclaimedFilterToggle')) {
                const filterWrap = document.createElement('div');
                filterWrap.className = 'unclaimed-filter-toggle';
                filterWrap.innerHTML = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">\n                  <input id="unclaimedFilterToggle" type="checkbox" />\n                  <span>Show only unclaimed</span>\n                </label>`;
                selectedKidGifts.parentElement?.insertBefore(filterWrap, selectedKidGifts);
                filterWrap.addEventListener('change', () => loadKidGifts(kidId));
            }
            const onlyUnclaimed = !!document.getElementById('unclaimedFilterToggle')?.checked;
            if (!gifts || gifts.length === 0) {
                selectedKidGifts.innerHTML = '<p class="no-gifts-message">No suggestions yet.</p>';
                return;
            }
            gifts.forEach(g => {
                const el = document.createElement('div');
                const link = g.link || extractLinkFromName(g.name);
                const hasLink = !!link;
                const isLocal = String(g.id).startsWith('local-kid-');
                const isClaimed = !!g.claimed_by;
                const isMine = isClaimed && me && String(g.claimed_by) === String(me);
                // When filtering for only unclaimed, exclude all claimed items (including mine or local)
                if (onlyUnclaimed && isClaimed) return; // skip any claimed items
                let itemStateClass = 'gift-unclaimed';
                if (isClaimed && isMine) itemStateClass = 'gift-claimed-mine';
                else if (isClaimed) itemStateClass = 'gift-claimed-other';
                el.className = `gift-item ${itemStateClass} ${hasLink ? 'link-card' : 'compact'}`;
                let claimerLabel = '';
                if (!isLocal && isClaimed && !isMine) {
                    // try to show claimer name (best effort, we might not have it in g)
                    // attempt to parse joined profile if present: g.profiles?.full_name
                    const full = g.profiles?.full_name || g.full_name || '';
                    const shortened = full ? full.split(/\s+/).slice(0,2).map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(' ') : 'Someone';
                    claimerLabel = `<span class=\"claimer-badge other\" title=\"${full || 'Claimed by another user'}\">${shortened || 'Claimed'}<\/span>`;
                } else if (!isLocal && isMine) {
                    claimerLabel = `<span class=\"claimer-badge\" title=\"You claimed this\">You</span>`;
                } else if (isLocal && isClaimed) {
                    claimerLabel = `<span class=\"claimer-badge\" title=\"Local only claim (not synced)\">Local</span>`;
                }
                const actionHtml = (() => {
                    if (isLocal) {
                        return !isClaimed
                          ? `<button class="btn-icon btn-claim-kid claim-btn" aria-label="Claim gift: ${g.name}" data-id="${g.id}" data-kid="${kidId}">${claimSvg()}</button>`
                          : `<button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${kidId}">${unclaimSvg()}</button>`;
                    }
                    if (!isClaimed) {
                        return `<button class="btn-icon btn-claim-kid claim-btn" aria-label="Claim gift: ${g.name}" data-id="${g.id}" data-kid="${kidId}">${claimSvg()}</button>`;
                    }
                    if (isMine) {
                        return `<button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${kidId}">${unclaimSvg()}</button>`;
                    }
                    return `<span class="claim-status-text" role="status">${claimerLabel || 'Claimed'}</span>`;
                })();
                if (hasLink) {
                    const dom = domainFromUrl(link);
                    const titleText = String(g.name||'').replace(/\s*\((https?:[^)]+)\)\s*$/i,'').trim() || '(Link)';
                    el.innerHTML = `
                    <div style="display:flex; gap:12px; align-items:center; width:100%;">\n                      <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; flex:1 1 auto; min-width:0;">\n                        <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">\n                          <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">\n                        </div>\n                        <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">\n                          <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}<\/h3>\n                          <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px;">${dom} ↗<\/p>\n                        <\/div>\n                      <\/a>\n                      <div class="gift-item-actions" style="margin-left:auto;">\n                        ${claimerLabel && !isMine ? claimerLabel : ''}\n                        ${actionHtml}\n                        <button class="btn-icon btn-delete-kid-dev" aria-label="Delete suggestion" data-id="${g.id}" data-kid="${kidId}">${deleteSvg()}<\/button>\n                      <\/div>\n                    <\/div>`;
                } else {
                    el.innerHTML = `
                      <div class="gift-item-info">\n                        <h3>${g.name}<\/h3>\n                      <\/div>\n                      <div class="gift-item-actions" style="margin-left:auto;">\n                        ${claimerLabel && !isMine ? claimerLabel : ''}\n                        ${actionHtml}\n                        <button class="btn-icon btn-delete-kid-dev" aria-label="Delete suggestion" data-id="${g.id}" data-kid="${kidId}">${deleteSvg()}<\/button>\n                      <\/div>`;
                }
                selectedKidGifts.appendChild(el);
            });
            // Delegated delete (attach once)
            if (!kidsDeleteBound) {
                selectedKidGifts.addEventListener('click', async (ev) => {
                    const btn = ev.target.closest('.btn-delete-kid-dev');
                    if (!btn) return;
                    const id = btn.getAttribute('data-id');
                    const currentKidId = kidSelector.value;
                    const ok = await confirmDialog({ title: 'Delete Suggestion', message: 'Delete this suggestion?', confirmText: 'Delete' });
                    if (!ok) return;
                    try {
                        if (id.startsWith('local-kid-')) {
                            const enc = id.substring(id.indexOf(currentKidId + '-') + (currentKidId + '-').length);
                            deleteLocalKidGift(currentKidId, decodeURIComponent(enc));
                        } else {
                            await deleteKidGift(id);
                        }
                        showToast('Deleted');
                        loadKidGifts(currentKidId);
                    } catch (e) { showToast('Failed to delete', 'error'); }
                });
                kidsDeleteBound = true;
            }

            // Delegated claim/unclaim (attach once)
            if (!kidsClaimBound) {
                // helpers
                async function claimKidGift(idAttr, currentKidId, btnEl) {
                    if (idAttr.startsWith('local-kid-')) {
                        const enc = idAttr.substring(idAttr.indexOf(currentKidId + '-') + (currentKidId + '-').length);
                        const raw = decodeURIComponent(enc);
                        const set = getLocalClaimSet(currentKidId); set.add(raw); saveLocalClaimSet(currentKidId, set); showToast('Claimed (local)');
                        return true;
                    }
                    try {
                        const { supabase } = await import('./supabase.js');
                        const { data: userData } = await supabase.auth.getUser();
                        const me = userData?.user?.id;
                        if (!me) { showToast('Sign in to claim', 'error'); return false; }
                        const { data, error } = await supabase
                          .from('kid_gifts')
                          .update({ claimed_by: me, claimed_at: new Date().toISOString() })
                          .eq('id', idAttr)
                          .is('claimed_by', null)
                          .select('id');
                        if (error) throw error;
                        if (!data || data.length === 0) { showToast('Already claimed by someone else', 'error'); return false; }
                        showToast('Claimed');
                        return true;
                    } catch (e) { console.error(e); showToast('Failed to claim', 'error'); return false; }
                }
                async function unclaimKidGift(idAttr, currentKidId, btnEl) {
                    if (idAttr.startsWith('local-kid-')) {
                        const enc = idAttr.substring(idAttr.indexOf(currentKidId + '-') + (currentKidId + '-').length);
                        const raw = decodeURIComponent(enc);
                        const set = getLocalClaimSet(currentKidId); set.delete(raw); saveLocalClaimSet(currentKidId, set); showToast('Unclaimed (local)');
                        return true;
                    }
                    try {
                        const { supabase } = await import('./supabase.js');
                        const { data: userData } = await supabase.auth.getUser();
                        const me = userData?.user?.id;
                        if (!me) { showToast('Sign in to unclaim', 'error'); return false; }
                        const { data, error } = await supabase
                          .from('kid_gifts')
                          .update({ claimed_by: null, claimed_at: null })
                          .eq('id', idAttr)
                          .select('id');
                        if (error) throw error;
                        if (!data || data.length === 0) { showToast('Cannot unclaim (not yours)', 'error'); return false; }
                        showToast('Unclaimed');
                        return true;
                    } catch (e) { console.error(e); showToast('Failed to unclaim', 'error'); return false; }
                }
                selectedKidGifts.addEventListener('click', async (ev) => {
                    const claimBtn = ev.target.closest('.btn-claim-kid');
                    const unclaimBtn = ev.target.closest('.btn-unclaim-kid');
                    if (!claimBtn && !unclaimBtn) return;
                    const btn = claimBtn || unclaimBtn;
                    const idAttr = btn.getAttribute('data-id');
                    const currentKidId = kidSelector.value;
                    btn.classList.add('is-loading');
                    const ok = claimBtn
                      ? await claimKidGift(idAttr, currentKidId, btn)
                      : await unclaimKidGift(idAttr, currentKidId, btn);
                    btn.classList.remove('is-loading');
                    if (ok) loadKidGifts(currentKidId); // refresh only if state changed
                });
                kidsClaimBound = true;
            }
        } catch (e) { console.error('Failed to load kid gifts', e); }
    }

    // Handle adding new gifts
    addGiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const giftData = {
            name: document.getElementById('giftName').value,
            price: document.getElementById('giftPrice').value,
            link: document.getElementById('giftLink').value,
            notes: document.getElementById('giftNotes').value
        };

        try {
            await addGiftToList(giftData);
            addGiftForm.reset();
            loadMyGifts(); // Reload the gifts list
        } catch (error) {
            console.error('Error adding gift:', error);
        }
    });

    // Refresh modal when gifts are updated elsewhere
    window.addEventListener('my-gifts-updated', () => {
        loadMyGifts();
    });

    // Modal functionality
    async function openModal(modal) {
        if (!modal) return;
        
        // Close any open modal first
        if (currentModal) {
            closeModal(currentModal);
        }

        // If it's the gift list modal, load the gifts
        if (modal === myGiftListModal) {
            if (addGiftForm) {
                addGiftForm.classList.add('hidden');
            }
            loadMyGifts();
        }
        if (modal === kidsGiftListModal) {
            await populateKidsInModal();
            selectedKidGifts.innerHTML = '';
            // Prefer current selection from main form if available
            const mainChildSelect = document.getElementById('childSelect');
            const preferred = mainChildSelect ? mainChildSelect.value : '';
            if (preferred) {
                kidSelector.value = preferred;
            }
            if (!kidSelector.value && kidSelector.options.length > 1) {
                kidSelector.selectedIndex = 1; // first kid
            }
            if (kidSelector.value) {
                loadKidGifts(kidSelector.value);
            } else {
                selectedKidGifts.innerHTML = '<p class="no-gifts-message">No children yet. Use "+ Add child" to add one.</p>';
            }
        }
        if (modal === recipientGiftsModal) {
            await loadRecipientGifts();
        }
        if (modal === setRecipientModal) {
            const locked = await isAssignmentsLocked();
            recipientStatus.textContent = locked ? 'Assignments are locked. Changes are disabled.' : '';
            saveRecipientBtn.disabled = locked;
            await populateRecipientOptions();
        }
        if (modal === settingsModal) {
            const s = getSettings();
            if (settingPinSidebar) settingPinSidebar.checked = !!s.pinSidebarDefault;
            if (settingTheme) settingTheme.value = s.theme || 'system';
        }

        // Show the modal
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        currentModal = modal;

        // Add one-time click listener for outside clicks
        const outsideClickHandler = (e) => {
            if (e.target === modal) {
                closeModal(modal);
                modal.removeEventListener('click', outsideClickHandler);
            }
        };
        modal.addEventListener('click', outsideClickHandler);
    }

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.style.display = 'none';
            }
        }, 300);

        if (currentModal === modal) {
            currentModal = null;
        }
        // Clear active state when closing any modal
        [myGiftListBtn, kidsGiftListBtn, recipientGiftsBtn, setRecipientBtn, settingsBtn].forEach(b => b && b.classList.remove('active'));
    }

    // Open modals from sidebar buttons
    const markActive = (btn) => {
        [myGiftListBtn, kidsGiftListBtn, recipientGiftsBtn, setRecipientBtn, settingsBtn].forEach(b => b && b.classList.remove('active'));
        btn && btn.classList.add('active');
    };

    myGiftListBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(myGiftListBtn);
        await openModal(myGiftListModal);
    });

    kidsGiftListBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(kidsGiftListBtn);
        await openModal(kidsGiftListModal);
    });

    recipientGiftsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(recipientGiftsBtn);
        await openModal(recipientGiftsModal);
    });

    setRecipientBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(setRecipientBtn);
        await openModal(setRecipientModal);
    });

    settingsBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(settingsBtn);
        await openModal(settingsModal);
    });

    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const s = getSettings();
        s.pinSidebarDefault = !!settingPinSidebar?.checked;
        s.theme = settingTheme?.value || 'system';
        saveSettings(s);
        applyPinnedFromSettings(s);
        applyThemeFromSettings(s);
        showToast('Settings saved');
        closeModal(settingsModal);
    });

    saveRecipientBtn.addEventListener('click', async () => {
        const val = recipientSelect.value;
        if (!val) { showToast('Please select a recipient', 'error'); return; }
        const ok = await confirmDialog({ title: 'Confirm Recipient', message: 'Save this recipient for this year?', confirmText: 'Save' });
        if (!ok) return;
        try {
            await upsertMyRecipient(val);
            showToast('Recipient saved');
            closeModal(setRecipientModal);
        } catch (e) {
            const msg = String(e?.message || '').toLowerCase();
            if (msg.includes('duplicate key')) {
                showToast('That person is already taken. Please choose another.', 'error');
            } else {
                showToast('Failed to save recipient', 'error');
            }
        }
    });

    kidSelector.addEventListener('change', (e) => {
        loadKidGifts(e.target.value);
    });

    window.addEventListener('kid-gifts-updated', (e) => {
        const kidId = e.detail?.kidId || kidSelector.value;
        if (kidId) loadKidGifts(kidId);
    });

    // Close button functionality
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = button.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentModal) {
            closeModal(currentModal);
        }
    });

    // Handle gift deletion
    window.deleteGift = async (giftId) => {
        const ok = await confirmDialog({
            title: 'Delete Gift',
            message: 'Are you sure you want to delete this gift?',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });
        if (!ok) return;
        
        // Handle local-only gifts (not logged in)
        if (typeof giftId === 'string' && giftId.startsWith('local-')) {
            const name = giftId.slice('local-'.length);
            const stored = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
            const updated = stored.filter(n => n !== name);
            localStorage.setItem('my_gift_ideas', JSON.stringify(updated));
            showToast('Gift deleted', 'success', 1500);
            loadMyGifts();
            return;
        }

        try {
            await deleteGift(giftId);
            showToast('Gift deleted', 'success', 1500);
            loadMyGifts();
        } catch (error) {
            console.error('Error deleting gift:', error);
            showToast('Failed to delete gift', 'error', 2000);
        }
    };

    // Expose global signOut handler for the inline onclick in HTML
    window.signOut = async () => {
        try {
            await supaSignOut();
        } catch (err) {
            console.error('Error during sign out:', err);
        } finally {
            // Clear local fallback data and redirect to sign-in page
            try { localStorage.removeItem('my_gift_ideas'); } catch (_) {}
            window.location.href = 'signin.html';
        }
    };
});
