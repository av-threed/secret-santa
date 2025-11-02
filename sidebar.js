// Import Supabase functions
import { getMyGifts, deleteGift, addGiftToList, signOut as supaSignOut, getKids, getKidGifts, deleteKidGift, getRecipientForBuyer, getUserGifts, getProfile, listProfilesExcludingSelf, upsertMyRecipient, isAssignmentsLocked } from './supabase.js';
import { confirmDialog, showToast, editGiftDialog } from './ui.js';

// Sidebar functionality
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const backdrop = document.getElementById('sidebarBackdrop');
    const appBar = document.querySelector('.app-bar');
    const sidebarPin = document.getElementById('sidebarPin');
    const myGiftListBtn = document.getElementById('myGiftList');
    const kidsGiftListBtn = document.getElementById('kidsGiftList');
    const shoppingListBtn = document.getElementById('shoppingListBtn');
    const recipientGiftsBtn = document.getElementById('recipientGifts');
    const setRecipientBtn = document.getElementById('setRecipient');
    const settingsBtn = document.getElementById('settingsBtn');
    const myGiftListModal = document.getElementById('myGiftListModal');
    const kidsGiftListModal = document.getElementById('kidsGiftListModal');
    const shoppingListModal = document.getElementById('shoppingListModal');
    const recipientGiftsModal = document.getElementById('recipientGiftsModal');
    const setRecipientModal = document.getElementById('setRecipientModal');
    const settingsModal = document.getElementById('settingsModal');
    const settingsForm = document.getElementById('settingsForm');
    const settingPinSidebar = document.getElementById('settingPinSidebar');
    const settingTheme = document.getElementById('settingTheme');
    const shoppingListContainer = document.getElementById('shoppingListContainer');
    const adminPortalBtn = document.getElementById('adminPortalBtn');
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

    // Kids multi-select (for deleting multiple suggestions in the selected child's list)
    let kidsMultiSelectMode = false;
    const selectedKidGiftIds = new Set();
    let kidsMultiSelectToggle = null;
    let kidsMultiSelectActions = null;
    let kidsMultiSelectCount = null;
    let kidsMultiDeleteBtn = null;
    let kidsMultiCancelBtn = null;

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
    let shoppingClaimBound = false;

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

    // --- Mobile drawer controls ---
    function openDrawer() {
        if (!sidebar) return;
        // Optional: close any open modal so the drawer doesn't share focus layers
        document.querySelectorAll('.modal.active').forEach(m => {
            m.classList.remove('active');
            m.style.display = 'none';
        });
        sidebar.classList.add('open');
        backdrop?.classList.add('active');
    }
    function closeDrawer() {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('active');
    }
    mobileBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (sidebar?.classList.contains('open')) closeDrawer(); else openDrawer();
    });
    backdrop?.addEventListener('click', closeDrawer);

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
                const link = gift.link || extractLinkFromName(gift.name);
                const hasLink = !!link;
                if (hasLink) {
                    const dom = domainFromUrl(link);
                    const titleText = String(gift.name || '')
                        .replace(/\s*\((https?:[^)]+)\)\s*$/i, '')
                        .trim() || '(Link)';
                    el.className = 'gift-item link-card';
                    // Entire card is a link
                    el.innerHTML = `
                      <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; width:100%; min-width:0;">
                        <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                          <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">
                        </div>
                        <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">
                          <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}</h3>
                          <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px; overflow-wrap:anywhere;">${dom} ↗</p>
                          ${gift.price ? `<p class="gift-price" style="margin-top:6px;">Price: ${gift.price}</p>` : ''}
                          ${gift.notes ? `<p class="gift-notes" style="margin-top:4px;">${gift.notes}</p>` : ''}
                        </div>
                      </a>`;
                } else {
                    el.className = 'gift-item compact';
                    el.innerHTML = `
                      <div class="gift-item-info">
                        <h3 style="overflow-wrap:anywhere; word-break:break-word;">${gift.name}</h3>
                        ${gift.price ? `<p class="gift-price">Price: ${gift.price}</p>` : ''}
                        ${gift.notes ? `<p class="gift-notes">${gift.notes}</p>` : ''}
                      </div>`;
                }
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
            const gifts = giftsDb || [];
            selectedKidGifts.innerHTML = '';
            // Inject kids multi-select toolbar above list once
            if (!document.getElementById('kidsMultiSelectBar')) {
                const bar = document.createElement('div');
                bar.id = 'kidsMultiSelectBar';
                bar.style.display = 'flex';
                bar.style.alignItems = 'center';
                bar.style.gap = '12px';
                bar.style.margin = '4px 0 12px 0';
                bar.style.flexWrap = 'wrap';
                bar.innerHTML = `
                  <button type="button" id="kidsMultiSelectToggle" class="btn-secondary" style="font-size:13px; padding:6px 10px;">Select Multiple</button>
                  <div id="kidsMultiSelectActions" style="display:none; gap:8px; align-items:center;">
                    <span id="kidsMultiSelectCount" style="font-size:12px; opacity:.75;">0 selected</span>
                    <button type="button" id="kidsMultiDeleteBtn" class="btn-delete" style="padding:6px 10px; font-size:13px;">Delete Selected</button>
                    <button type="button" id="kidsMultiCancelBtn" class="btn-secondary" style="font-size:13px; padding:6px 10px;">Cancel</button>
                  </div>`;
                selectedKidGifts.parentElement?.insertBefore(bar, selectedKidGifts);
                kidsMultiSelectToggle = document.getElementById('kidsMultiSelectToggle');
                kidsMultiSelectActions = document.getElementById('kidsMultiSelectActions');
                kidsMultiSelectCount = document.getElementById('kidsMultiSelectCount');
                kidsMultiDeleteBtn = document.getElementById('kidsMultiDeleteBtn');
                kidsMultiCancelBtn = document.getElementById('kidsMultiCancelBtn');
                kidsMultiSelectToggle?.addEventListener('click', () => {
                  kidsMultiSelectMode = true; selectedKidGiftIds.clear(); updateKidsMultiBar(); loadKidGifts(kidId);
                });
                kidsMultiCancelBtn?.addEventListener('click', () => {
                  kidsMultiSelectMode = false; selectedKidGiftIds.clear(); updateKidsMultiBar(); loadKidGifts(kidId);
                });
                kidsMultiDeleteBtn?.addEventListener('click', async () => {
                  if (!selectedKidGiftIds.size) { showToast('No gifts selected', 'error'); return; }
                  const ok = await confirmDialog({ title: 'Delete Suggestions', message: `Delete ${selectedKidGiftIds.size} selected item(s)?`, confirmText: 'Delete' });
                  if (!ok) return;
                  let failures = 0;
                  for (const id of Array.from(selectedKidGiftIds)) {
                    try { await deleteKidGift(id); } catch { failures++; }
                  }
                  if (failures) showToast(`Deleted with ${failures} error(s)`, 'error'); else showToast('Deleted selected');
                  kidsMultiSelectMode = false; selectedKidGiftIds.clear(); updateKidsMultiBar(); loadKidGifts(kidId);
                });
            }
            // Insert claimed-all toggle once
            if (!document.getElementById('claimedAllToggle')) {
                const filterWrap = document.createElement('div');
                filterWrap.className = 'unclaimed-filter-toggle';
                filterWrap.style.display = 'flex';
                filterWrap.style.gap = '16px';
                const savedClaimedAll = localStorage.getItem('ui_claimed_all') === '1';
                filterWrap.innerHTML = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">\n                  <input id="claimedAllToggle" type="checkbox" ${savedClaimedAll ? 'checked' : ''} />\n                  <span>Show all claimed gifts</span>\n                </label>`;
                selectedKidGifts.parentElement?.insertBefore(filterWrap, selectedKidGifts);
                filterWrap.addEventListener('change', (e) => {
                    const claimedAll = document.getElementById('claimedAllToggle');
                    // Persist preferences
                    localStorage.setItem('ui_claimed_all', document.getElementById('claimedAllToggle')?.checked ? '1' : '0');
                    loadKidGifts(kidId);
                });
            }
            const showClaimedAll = !!document.getElementById('claimedAllToggle')?.checked;
            if (!gifts || gifts.length === 0) {
                selectedKidGifts.innerHTML = '<p class="no-gifts-message">No suggestions yet.</p>';
                return;
            }
            // If showing all claimed across kids, render unified list and return early
            if (showClaimedAll) {
                await renderAllClaimedAcrossKids();
                return;
            }
            gifts.forEach(g => {
                const el = document.createElement('div');
                const link = g.link || extractLinkFromName(g.name);
                const hasLink = !!link;
                const isClaimed = !!g.claimed_by;
                const isMine = isClaimed && me && String(g.claimed_by) === String(me);
                // No unclaimed-only filtering; show items regardless of claim status in per-kid view
                let itemStateClass = 'gift-unclaimed';
                if (isClaimed && isMine) itemStateClass = 'gift-claimed-mine';
                else if (isClaimed) itemStateClass = 'gift-claimed-other';
                el.className = `gift-item ${itemStateClass} ${hasLink ? 'link-card' : 'compact'}`;
                let claimerLabel = '';
                if (isClaimed && !isMine) {
                    const full = g.full_name || '';
                    const shortened = full ? full.split(/\s+/).slice(0, 2).join(' ') : 'Someone';
                    claimerLabel = `<span class="claimer-badge other" title="${full || 'Claimed by another user'}">${shortened}</span>`;
                } else if (isClaimed && isMine) {
                    claimerLabel = `<span class="claimer-badge" title="You claimed this">You</span>`;
                }
                const actionHtml = (() => {
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
                if (kidsMultiSelectMode) {
                  const box = document.createElement('span');
                  box.className = 'multi-select-checkbox';
                  const idStr = String(g.id);
                  if (selectedKidGiftIds.has(idStr)) { el.dataset.selected='true'; box.textContent='✓'; }
                  el.prepend(box);
                  el.tabIndex = 0;
                  el.addEventListener('click', (ev) => {
                    if (ev.target.closest('.gift-item-actions')) return;
                    toggleKidMultiSelection(idStr, el);
                  }, { capture: true });
                  el.addEventListener('keydown', (ev) => {
                    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleKidMultiSelection(idStr, el); }
                  });
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
                        await deleteKidGift(id);
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
                    try {
                        const { supabase } = await import('./supabase.js');
                        const { data: userData } = await supabase.auth.getUser();
                        const me = userData?.user?.id;
                        if (!me) { showToast('Sign in to claim', 'error'); return false; }
                        const { data, error } = await supabase.rpc('claim_kid_gift', { p_id: idAttr });
                        if (error) throw error;
                        if (!data) { showToast('Already claimed by someone else', 'error'); return false; }
                        showToast('Claimed');
                        return true;
                    } catch (e) { console.error(e); showToast('Failed to claim', 'error'); return false; }
                }
                async function unclaimKidGift(idAttr, currentKidId, btnEl) {
                    try {
                        const { supabase } = await import('./supabase.js');
                        const { data: userData } = await supabase.auth.getUser();
                        const me = userData?.user?.id;
                        if (!me) { showToast('Sign in to unclaim', 'error'); return false; }
                        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idAttr);
                        if (!isUuid) { showToast('Could not unclaim (invalid id)', 'error'); return false; }
                        if (btnEl) btnEl.disabled = true;
                        const { data, error } = await supabase.rpc('unclaim_kid_gift', { p_id: idAttr });
                        if (btnEl) btnEl.disabled = false;
                        if (error) throw error;
                        if (!data) { showToast('Cannot unclaim (not yours)', 'error'); return false; }
                        showToast('Unclaimed');
                        return true;
                    } catch (e) { console.error(e); if (btnEl) btnEl.disabled = false; showToast('Failed to unclaim', 'error'); return false; }
                }
                selectedKidGifts.addEventListener('click', async (ev) => {
                    const claimBtn = ev.target.closest('.btn-claim-kid');
                    const unclaimBtn = ev.target.closest('.btn-unclaim-kid');
                    if (!claimBtn && !unclaimBtn) return;
                    const btn = claimBtn || unclaimBtn;
                    const idAttr = btn.getAttribute('data-id');
                    const currentKidId = btn.getAttribute('data-kid') || kidSelector.value;
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

    function toggleKidMultiSelection(idStr, el) {
        if (!kidsMultiSelectMode) return;
        if (selectedKidGiftIds.has(idStr)) {
            selectedKidGiftIds.delete(idStr);
            el.removeAttribute('data-selected');
            const box = el.querySelector('.multi-select-checkbox'); if (box) box.textContent='';
        } else {
            selectedKidGiftIds.add(idStr);
            el.dataset.selected='true';
            const box = el.querySelector('.multi-select-checkbox'); if (box) box.textContent='✓';
        }
        updateKidsMultiBar();
    }

    function updateKidsMultiBar() {
        if (!kidsMultiSelectToggle || !kidsMultiSelectActions) return;
        if (kidsMultiSelectMode) {
            kidsMultiSelectActions.style.display = 'inline-flex';
            kidsMultiSelectToggle.style.display = 'none';
            document.body.classList.add('multi-select-mode');
        } else {
            kidsMultiSelectActions.style.display = 'none';
            kidsMultiSelectToggle.style.display = 'inline-block';
            document.body.classList.remove('multi-select-mode');
        }
        if (kidsMultiSelectCount) kidsMultiSelectCount.textContent = `${selectedKidGiftIds.size} selected`;
    }

    async function renderAllClaimedAcrossKids() {
        try {
            const container = selectedKidGifts;
            container.innerHTML = '<p class="no-gifts-message">Loading your claimed gifts…</p>';
            const { getMyClaimedKidGifts } = await import('./supabase.js');
            let from = 0; const pageSize = 50; let list = await getMyClaimedKidGifts({ from, limit: pageSize });
            if (!list || list.length === 0) {
                container.innerHTML = '<p class="no-gifts-message">No claimed gifts yet. <button id="backToChildLists" class="btn-secondary" style="margin-left:8px">Back to child lists</button></p>';
                const backBtn = document.getElementById('backToChildLists');
                backBtn?.addEventListener('click', () => {
                    const claimedAll = document.getElementById('claimedAllToggle');
                    if (claimedAll) { claimedAll.checked = false; localStorage.setItem('ui_claimed_all', '0'); }
                    loadKidGifts(kidSelector.value);
                });
                return;
            }
            container.innerHTML = '';
            function renderItem(g) {
                const el = document.createElement('div');
                const link = g.link || extractLinkFromName(g.name);
                const hasLink = !!link;
                const kidName = g.kids?.name || g.kid_name || 'Unknown child';
                const titleSuffix = kidName ? ` — <span style="color:#047857">${kidName}</span>` : '';
                if (hasLink) {
                    const dom = domainFromUrl(link);
                    const titleText = String(g.name||'').replace(/\s*\((https?:[^)]+)\)\s*$/i,'').trim() || '(Link)';
                    el.className = 'gift-item link-card gift-claimed-mine';
                    el.innerHTML = `
                    <div style="display:flex; gap:12px; align-items:center; width:100%">\n                      <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; flex:1 1 auto; min-width:0;">\n                        <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">\n                          <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">\n                        </div>\n                        <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">\n                          <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}${titleSuffix}<\/h3>\n                          <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px;">${dom} ↗<\/p>\n                        <\/div>\n                      <\/a>\n                      <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">\n                        <span class="claimer-badge" title="You claimed this">You<\/span>\n                        <button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${g.kid_id}">${unclaimSvg()}<\/button>\n                      <\/div>\n                    <\/div>`;
                } else {
                    el.className = 'gift-item compact gift-claimed-mine';
                    el.innerHTML = `
                      <div class="gift-item-info">\n                        <h3>${g.name}${titleSuffix}<\/h3>\n                      <\/div>\n                      <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">\n                        <span class="claimer-badge" title="You claimed this">You<\/span>\n                        <button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${g.kid_id}">${unclaimSvg()}<\/button>\n                      <\/div>`;
                }
                container.appendChild(el);
            }
            list.forEach(renderItem);
            if (list.length === pageSize) {
                const loadMore = document.createElement('div');
                loadMore.style.textAlign = 'center';
                loadMore.style.margin = '12px 0 4px 0';
                const btn = document.createElement('button');
                btn.className = 'btn-secondary';
                btn.textContent = 'Load more';
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    from += pageSize;
                    const next = await getMyClaimedKidGifts({ from, limit: pageSize });
                    next.forEach(renderItem);
                    if (next.length < pageSize) loadMore.remove(); else btn.disabled = false;
                });
                loadMore.appendChild(btn);
                container.appendChild(loadMore);
            }
        } catch (e) {
            console.error('Failed to render all claimed gifts', e);
            selectedKidGifts.innerHTML = '<p class="no-gifts-message">Unable to load claimed gifts.</p>';
        }
    }

    async function renderShoppingList() {
        try {
            if (!shoppingListContainer) return;
            shoppingListContainer.innerHTML = '<p class="no-gifts-message">Loading your claimed gifts…</p>';
            const { getMyClaimedKidGifts } = await import('./supabase.js');
            let from = 0; const pageSize = 50; let list = await getMyClaimedKidGifts({ from, limit: pageSize });
            if (!list || list.length === 0) {
                shoppingListContainer.innerHTML = '<p class="no-gifts-message">No claimed gifts yet.</p>';
                return;
            }
            shoppingListContainer.innerHTML = '';
            function renderItem(g) {
                const el = document.createElement('div');
                const link = g.link || extractLinkFromName(g.name);
                const hasLink = !!link;
                const kidName = g.kids?.name || g.kid_name || 'Unknown child';
                const titleSuffix = kidName ? ` — <span style="color:#047857">${kidName}</span>` : '';
                if (hasLink) {
                    const dom = domainFromUrl(link);
                    const titleText = String(g.name||'').replace(/\s*\((https?:[^)]+)\)\s*$/i,'').trim() || '(Link)';
                    el.className = 'gift-item link-card gift-claimed-mine';
                    el.innerHTML = `
                    <div style="display:flex; gap:12px; align-items:center; width:100%">
                      <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:flex; gap:12px; align-items:center; text-decoration:none; color:inherit; flex:1 1 auto; min-width:0;">
                        <div style="flex:0 0 56px; height:56px; border-radius:8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                          <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=64" alt="${dom}" width="24" height="24" loading="lazy">
                        </div>
                        <div class="gift-item-info" style="flex:1 1 auto; min-width:0;">
                          <h3 style="margin:0 0 4px 0; overflow-wrap:anywhere; word-break:break-word;">${titleText}${titleSuffix}<\/h3>
                          <p class="gift-link" style="margin:0; color:#4b5563; font-size:13px;">${dom} ↗<\/p>
                        <\/div>
                      <\/a>
                      <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">
                        <span class="claimer-badge" title="You claimed this">You<\/span>
                        <button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${g.kid_id}">${unclaimSvg()}<\/button>
                      <\/div>
                    <\/div>`;
                } else {
                    el.className = 'gift-item compact gift-claimed-mine';
                    el.innerHTML = `
                      <div class="gift-item-info">
                        <h3>${g.name}${titleSuffix}<\/h3>
                      <\/div>
                      <div class="gift-item-actions" style="margin-left:auto; display:flex; gap:8px; align-items:center;">
                        <span class="claimer-badge" title="You claimed this">You<\/span>
                        <button class="btn-icon btn-unclaim-kid unclaim-btn" aria-label="Unclaim gift: ${g.name}" data-id="${g.id}" data-kid="${g.kid_id}">${unclaimSvg()}<\/button>
                      <\/div>`;
                }
                shoppingListContainer.appendChild(el);
            }
            list.forEach(renderItem);
            if (list.length === pageSize) {
                const loadMore = document.createElement('div');
                loadMore.style.textAlign = 'center';
                loadMore.style.margin = '12px 0 4px 0';
                const btn = document.createElement('button');
                btn.className = 'btn-secondary';
                btn.textContent = 'Load more';
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    from += pageSize;
                    const next = await getMyClaimedKidGifts({ from, limit: pageSize });
                    next.forEach(renderItem);
                    if (next.length < pageSize) loadMore.remove(); else btn.disabled = false;
                });
                loadMore.appendChild(btn);
                shoppingListContainer.appendChild(loadMore);
            }

            if (!shoppingClaimBound) {
                shoppingListContainer.addEventListener('click', async (ev) => {
                    const unclaimBtn = ev.target.closest('.btn-unclaim-kid');
                    if (!unclaimBtn) return;
                    const idAttr = unclaimBtn.getAttribute('data-id');
                    unclaimBtn.classList.add('is-loading');
                    try {
                        const { supabase } = await import('./supabase.js');
                        const { data: userData } = await supabase.auth.getUser();
                        const me = userData?.user?.id;
                        if (!me) { showToast('Sign in to unclaim', 'error'); return; }
                        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idAttr);
                        if (!isUuid) { showToast('Could not unclaim (invalid id)', 'error'); return; }
                        const { data, error } = await supabase.rpc('unclaim_kid_gift', { p_id: idAttr });
                        if (error) throw error;
                        if (!data) { showToast('Cannot unclaim (not yours)', 'error'); return; }
                        showToast('Unclaimed');
                        await renderShoppingList();
                    } catch (e) { console.error(e); showToast('Failed to unclaim', 'error'); }
                    finally { unclaimBtn.classList.remove('is-loading'); }
                });
                shoppingClaimBound = true;
            }
        } catch (e) {
            console.error('Failed to render shopping list', e);
            if (shoppingListContainer) shoppingListContainer.innerHTML = '<p class="no-gifts-message">Unable to load shopping list.</p>';
        }
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
        if (modal === shoppingListModal) {
            await renderShoppingList();
        }
        if (modal === setRecipientModal) {
            const locked = await isAssignmentsLocked();
            // Build status message and disable controls if locked
            let statusMsg = locked ? 'Assignments are locked. Changes are disabled.' : '';
            saveRecipientBtn.disabled = locked;
            if (recipientSelect) recipientSelect.disabled = locked;
            // Populate options, then preselect current recipient if one exists
            await populateRecipientOptions();
            try {
                const currentRecipientId = await getRecipientForBuyer();
                if (currentRecipientId) {
                    // Ensure the current recipient exists in the options list
                    let opt = Array.from(recipientSelect.options).find(o => String(o.value) === String(currentRecipientId));
                    if (!opt) {
                        const prof = await getProfile(currentRecipientId).catch(() => ({ full_name: null }));
                        opt = document.createElement('option');
                        opt.value = currentRecipientId;
                        opt.textContent = prof?.full_name || currentRecipientId;
                        recipientSelect.appendChild(opt);
                    }
                    recipientSelect.value = currentRecipientId;
                    const displayName = opt?.textContent || '';
                    statusMsg = statusMsg ? `${statusMsg} Currently selected: ${displayName}.` : `Currently selected: ${displayName}.`;
                }
            } catch (_) { /* best-effort preselect */ }
            recipientStatus.textContent = statusMsg;
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
        [myGiftListBtn, kidsGiftListBtn, shoppingListBtn, recipientGiftsBtn, setRecipientBtn, settingsBtn].forEach(b => b && b.classList.remove('active'));
    }

    // Open modals from sidebar buttons
    const markActive = (btn) => {
        [myGiftListBtn, kidsGiftListBtn, shoppingListBtn, recipientGiftsBtn, setRecipientBtn, settingsBtn].forEach(b => b && b.classList.remove('active'));
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

    shoppingListBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        markActive(shoppingListBtn);
        await openModal(shoppingListModal);
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

    // Close drawer when a sidebar link is clicked (mobile UX)
    document.querySelectorAll('.sidebar-button, .sidebar-signout').forEach(el => {
        el.addEventListener('click', () => {
            // Only relevant on mobile widths, but harmless otherwise
            if (sidebar?.classList.contains('open')) {
                sidebar.classList.remove('open');
                backdrop?.classList.remove('active');
            }
        });
    });

    // Show Admin portal button only for admin email
    (async function showAdminButtonIfAllowed(){
        try {
            if (!adminPortalBtn) return;
            const { supabase } = await import('./supabase.js');
            const { data: userData } = await supabase.auth.getUser();
            const email = String(userData?.user?.email || '').toLowerCase();
            const adminEmail = 'antonio.villasenor08@gmail.com';
            if (email && email === adminEmail) {
                adminPortalBtn.style.display = '';
                adminPortalBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'admin.html'; });
            }
        } catch {}
    })();

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
        if (e.key === 'Escape') {
            if (currentModal) {
                closeModal(currentModal);
                return;
            }
            // Also close mobile drawer on Esc
            if (sidebar?.classList.contains('open')) {
                sidebar.classList.remove('open');
                backdrop?.classList.remove('active');
            }
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
