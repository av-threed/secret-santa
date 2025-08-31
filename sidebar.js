// Import Supabase functions
import { getMyGifts, deleteGift } from './supabase.js';

// Sidebar functionality
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarPin = document.getElementById('sidebarPin');
    const myGiftListBtn = document.getElementById('myGiftList');
    const kidsGiftListBtn = document.getElementById('kidsGiftList');
    const myGiftListModal = document.getElementById('myGiftListModal');
    const kidsGiftListModal = document.getElementById('kidsGiftListModal');
    const closeButtons = document.querySelectorAll('.modal-close');
    const myGiftsList = document.getElementById('myGiftsList');
    const addGiftForm = document.getElementById('addGiftForm');
    let currentModal = null;

    // Sidebar pin toggle
    sidebarPin.addEventListener('click', () => {
        sidebar.classList.toggle('pinned');
        sidebarPin.classList.toggle('active');
    });

    // Load and display gifts
    async function loadMyGifts() {
        try {
            const gifts = await getMyGifts();
            displayGifts(gifts);
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

    // Modal functionality
    function openModal(modal) {
        if (!modal) return;
        
        // Close any open modal first
        if (currentModal) {
            closeModal(currentModal);
        }

        // If it's the gift list modal, load the gifts
        if (modal === myGiftListModal) {
            loadMyGifts();
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
    }

    // Open modals from sidebar buttons
    myGiftListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(myGiftListModal);
    });

    kidsGiftListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(kidsGiftListModal);
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
        if (confirm('Are you sure you want to delete this gift?')) {
            try {
                await deleteGift(giftId);
                loadMyGifts(); // Reload the gifts list
            } catch (error) {
                console.error('Error deleting gift:', error);
            }
        }
    };
});
