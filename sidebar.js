// Import Supabase functions
import { getMyGifts, deleteGift, addGiftToList, signOut as supaSignOut, getKids, getKidGifts, deleteKidGift, getRecipientForBuyer, getUserGifts, getProfile, listProfilesExcludingSelf, upsertMyRecipient, isAssignmentsLocked } from './supabase.js';
import { confirmDialog, showToast } from './ui.js';

// Sidebar functionality
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const appBar = document.querySelector('.app-bar');
    const sidebarPin = document.getElementById('sidebarPin');
    const myGiftListBtn = document.getElementById('myGiftList');
    const kidsGiftListBtn = document.getElementById('kidsGiftList');
    const recipientGiftsBtn = document.getElementById('recipientGifts');
    const setRecipientBtn = document.getElementById('setRecipient');
    const myGiftListModal = document.getElementById('myGiftListModal');
    const kidsGiftListModal = document.getElementById('kidsGiftListModal');
    const recipientGiftsModal = document.getElementById('recipientGiftsModal');
    const setRecipientModal = document.getElementById('setRecipientModal');
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

    // Display gifts in the modal
    function displayGifts(gifts) {
        myGiftsList.innerHTML = '';
        
        if (!gifts || gifts.length === 0) {
            myGiftsList.innerHTML = '<p class="no-gifts-message">No gifts added yet.</p>';
            return;
        }

        gifts.forEach(gift => {
            const giftElement = document.createElement('div');
            giftElement.className = 'gift-item';
            giftElement.innerHTML = `
                <div class="gift-item-info">
                    <h3>${gift.name}</h3>
                    ${gift.price ? `<p class="gift-price">Price: ${gift.price}</p>` : ''}
                    ${gift.link ? `<p class="gift-link"><a href="${gift.link}" target="_blank">View Item</a></p>` : ''}
                    ${gift.notes ? `<p class="gift-notes">${gift.notes}</p>` : ''}
                </div>
                <div class="gift-item-actions">
                    <button class="btn-delete" onclick="deleteGift('${gift.id}')">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                        </svg>
                        Delete
                    </button>
                </div>
            `;
            myGiftsList.appendChild(giftElement);
        });
    }

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
            const gifts = await getKidGifts(kidId);
            selectedKidGifts.innerHTML = '';
            if (!gifts || gifts.length === 0) {
                selectedKidGifts.innerHTML = '<p class="no-gifts-message">No suggestions yet.</p>';
                return;
            }
            gifts.forEach(g => {
                const el = document.createElement('div');
                el.className = 'gift-item';
                el.innerHTML = `
                    <div class="gift-item-info">
                        <h3>${g.name}</h3>
                        ${g.kids?.name ? `<p class="gift-kid-name">For: ${g.kids.name}</p>` : ''}
                    </div>
                    <div class="gift-item-actions">
                        <button class="btn-delete" data-id="${g.id}">Delete</button>
                    </div>
                `;
                selectedKidGifts.appendChild(el);
                el.querySelector('.btn-delete').addEventListener('click', async () => {
                    const ok = await confirmDialog({ title: 'Delete Suggestion', message: 'Delete this suggestion?', confirmText: 'Delete' });
                    if (!ok) return;
                    try { await deleteKidGift(g.id); showToast('Deleted'); loadKidGifts(kidId); } catch (e) { showToast('Failed to delete', 'error'); }
                });
            });
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
        [myGiftListBtn, kidsGiftListBtn, recipientGiftsBtn, setRecipientBtn].forEach(b => b && b.classList.remove('active'));
    }

    // Open modals from sidebar buttons
    const markActive = (btn) => {
        [myGiftListBtn, kidsGiftListBtn, recipientGiftsBtn, setRecipientBtn].forEach(b => b && b.classList.remove('active'));
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

    // Onboarding: prompt new users to set their recipient first
    (async function runRecipientOnboarding() {
        try {
            // Only show once per session until they set a recipient
            const sessionFlagKey = 'recipient_onboarding_shown';
            if (sessionStorage.getItem(sessionFlagKey)) return;

            const recipientId = await getRecipientForBuyer();
            if (!recipientId) {
                sessionStorage.setItem(sessionFlagKey, '1');
                await openModal(setRecipientModal);
            }
        } catch (e) {
            // Non-blocking
            console.warn('Onboarding check failed:', e);
        }
    })();
});
