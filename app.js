import { addGiftToList, getCurrentUser, getKids, findOrCreateKid, addKidGift, getCurrentYear } from './supabase.js';
import { inputDialog } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
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
    
    // Parse a single line for optional title and URL into { name, link }
    function parseGiftLine(line) {
        const text = String(line || '').trim();
        if (!text) return null;
        // [Title](https://example.com)
        const mdMatch = text.match(/^\s*\[(.+?)\]\((https?:\/\/[^\s)]+)\)\s*$/i);
        if (mdMatch) {
            return { name: mdMatch[1].trim(), link: mdMatch[2].trim() };
        }
        // Title - https://example.com  OR  Title: https://example.com
        const titleBeforeUrl = text.match(/^(.+?)\s*[\-:\u2013\u2014]\s*(https?:\/\/\S+)\s*$/i);
        if (titleBeforeUrl) {
            return { name: titleBeforeUrl[1].trim(), link: titleBeforeUrl[2].trim() };
        }
        // https://example.com - Title (optional title after URL)
        const urlBeforeTitle = text.match(/^(https?:\/\/\S+)\s*(?:[\-:\u2013\u2014]\s*(.+))?$/i);
        if (urlBeforeTitle) {
            const link = urlBeforeTitle[1].trim();
            const maybeTitle = (urlBeforeTitle[2] || '').trim();
            return { name: maybeTitle || link, link };
        }
        // No URL; treat entire line as name only
        return { name: text };
    }

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
                    const parsed = parseGiftLine(giftText);
                    if (!parsed) continue;
                    const payload = { name: parsed.name };
                    if (parsed.link) payload.link = parsed.link;
                    await addGiftToList(payload);
                    addedGifts.push(parsed.name);
                }
            } else {
                // Local fallback storage
                const existingRaw = JSON.parse(localStorage.getItem('my_gift_ideas') || '[]');
                const existing = Array.isArray(existingRaw) ? existingRaw : [];
                for (const line of gifts) {
                    const parsed = parseGiftLine(line);
                    if (!parsed) continue;
                    existing.push({ name: parsed.name, link: parsed.link || '' });
                    addedGifts.push(parsed.name);
                }
                localStorage.setItem('my_gift_ideas', JSON.stringify(existing));
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
                    const parsed = parseGiftLine(line);
                    if (!parsed) continue;
                    const payload = { name: parsed.name };
                    if (parsed.link) payload.link = parsed.link;
                    await addKidGift(kidId, payload);
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
