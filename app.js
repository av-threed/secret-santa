import { addGiftToList, getCurrentUser, getKids, findOrCreateKid, addKidGift, getCurrentYear, signOut as supaSignOut, supabase, initAuthRouteGuards } from './supabase.js';
import { inputDialog } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        initAuthRouteGuards();

        // Optional: force sign-out when sharing onboarding links like ?new=1
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('new') === '1') {
                await supaSignOut();
            }
        } catch {}
        
        // Lightweight "Signed in as" indicator with Sign Out
        try {
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || '';
            if (email) {
                const chip = document.createElement('div');
                chip.style.position = 'fixed';
                chip.style.top = '10px';
                chip.style.right = '10px';
                chip.style.padding = '6px 10px';
                chip.style.background = '#0E5A3A';
                chip.style.color = '#fffbe7';
                chip.style.borderRadius = '14px';
                chip.style.fontSize = '12px';
                chip.style.zIndex = '1000';
                chip.style.display = 'flex';
                chip.style.gap = '8px';
                chip.style.alignItems = 'center';
                chip.textContent = `Signed in as ${email}`;
                const btn = document.createElement('button');
                btn.textContent = 'Sign Out';
                btn.style.all = 'unset';
                btn.style.cursor = 'pointer';
                btn.style.padding = '4px 6px';
                btn.style.borderRadius = '10px';
                btn.style.background = '#0B4A2F';
                btn.style.color = '#fffbe7';
                btn.addEventListener('click', async () => {
                    try { await supaSignOut(); window.location.href = 'signin.html'; } catch {}
                });
                chip.appendChild(btn);
                document.body.appendChild(chip);
            }
        } catch {}
    })();
    const adultGiftForm = document.getElementById('adultGiftForm');
    const addChildBtn = document.getElementById('addChildBtn');
    const childSelect = document.getElementById('childSelect');
    const kidsGiftForm = document.getElementById('kidsGiftForm');
    const appYearChip = document.getElementById('appYearChip');
    const userMenuButton = null;
    const userDropdown = null;
    const signOutTop = null;
    const userInitials = null;
    const userFullName = null;
    
    function showNotification(type, message) {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        const note = document.createElement('div');
        note.className = `notification ${type === 'error' ? 'error' : 'success'}`;
        note.textContent = message;
        document.body.appendChild(note);
        setTimeout(() => {
            note.classList.add('fade-out');
            note.addEventListener('animationend', () => note.remove(), { once: true });
        }, 2000);
    }

    // Initialize app bar content
    (async () => {
        try {
            const year = await getCurrentYear();
            if (appYearChip) appYearChip.textContent = year;
        } catch {}
        // No user avatar/menu in header; keep only year
    })();

    // User menu toggle
    // No user menu interactions

    // Load kids into select
    async function populateKids() {
        try {
            const kids = await getKids();
            while (childSelect.options.length > 1) childSelect.remove(1);
            kids.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k.id;
                opt.textContent = k.name;
                childSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Failed to load kids', e);
        }
    }
    populateKids();

    // Add child flow
    addChildBtn?.addEventListener('click', async () => {
        const name = await inputDialog({ title: 'Add Child', label: "Child's name", placeholder: 'e.g., Emma' , confirmText: 'Add Child'});
        if (!name) return;
        try {
            const kid = await findOrCreateKid(name);
            await populateKids();
            childSelect.value = kid.id;
            showNotification('success', 'Child added');
        } catch (e) {
            console.error('Failed to add child', e);
            showNotification('error', 'Failed to add child');
        }
    });
    
    adultGiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const giftIdeas = document.getElementById('adultGiftIdeas').value;
        
        try {
            // Each line is a separate gift
            const gifts = giftIdeas.split('\n').filter(line => line.trim() !== '');
            
            // If not authenticated, store locally so modal can display immediately
            const user = getCurrentUser ? await getCurrentUser() : null;
            const addedGifts = [];
            if (user && user.id) {
                // Add each gift to the database
                for (const giftText of gifts) {
                    await addGiftToList({ name: giftText.trim() });
                    addedGifts.push(giftText.trim());
                }
            } else {
                // Local fallback storage
                const existing = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
                gifts.forEach(g => existing.push(g.trim()));
                localStorage.setItem('my_gift_ideas', JSON.stringify(existing));
                addedGifts.push(...gifts.map(g => g.trim()));
            }
            
            // Clear the form
            document.getElementById('adultGiftIdeas').value = '';
            
            // Emit a custom event so the modal refreshes immediately
            window.dispatchEvent(new CustomEvent('my-gifts-updated', { detail: { source: 'adultGiftForm' } }));

            // In-app success notification
            showNotification('success', 'Gift ideas saved successfully!');
            
        } catch (error) {
            console.error('Error saving gifts:', error);
            showNotification('error', 'Error saving gift ideas. Please try again.');
        }
    });

    // Kids gift suggestions submit
    kidsGiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kidId = childSelect.value;
        if (!kidId) { showNotification('error', 'Select a child'); return; }
        const raw = document.getElementById('kidsGiftIdeas').value;
        const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
        try {
            let successCount = 0;
            for (const line of lines) {
                try {
                    await addKidGift(kidId, { name: line });
                    successCount++;
                } catch (err) {
                    // Ignore duplicates (unique index violation)
                    const msg = String(err?.message || '');
                    if (err?.code === '23505' || msg.toLowerCase().includes('duplicate key')) {
                        continue;
                    }
                    throw err;
                }
            }
            document.getElementById('kidsGiftIdeas').value = '';
            window.dispatchEvent(new CustomEvent('kid-gifts-updated', { detail: { kidId } }));
            if (successCount > 0) {
                showNotification('success', 'Suggestions added');
            } else {
                showNotification('success', 'No new suggestions (duplicates ignored)');
            }
        } catch (e) {
            console.error('Failed to add kid suggestions', e);
            showNotification('error', `Failed to add suggestions: ${e.message || 'Unknown error'}`);
        }
    });
});
