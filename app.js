import { addGiftToList } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const adultGiftForm = document.getElementById('adultGiftForm');
    
    adultGiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const giftIdeas = document.getElementById('adultGiftIdeas').value;
        
        try {
            // Each line is a separate gift
            const gifts = giftIdeas.split('\n').filter(line => line.trim() !== '');
            
            // Add each gift to the database
            for (const giftText of gifts) {
                await addGiftToList({
                    name: giftText.trim(),
                });
            }
            
            // Clear the form
            document.getElementById('adultGiftIdeas').value = '';
            
            // Show success message
            alert('Gift ideas saved successfully!');
            
        } catch (error) {
            console.error('Error saving gifts:', error);
            alert('Error saving gift ideas. Please try again.');
        }
    });
});
