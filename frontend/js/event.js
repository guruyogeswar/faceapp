// js/event.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const loadingState = document.getElementById('loading-state');
    const guestPrompt = document.getElementById('guest-prompt');
    const eventGallery = document.getElementById('event-gallery');
    const eventTitleGuest = document.getElementById('event-title-guest');
    const eventTitleMain = document.getElementById('event-title-main');
    const loginBtnGuest = document.getElementById('login-btn-guest');
    const signupBtnGuest = document.getElementById('signup-btn-guest');
    
    const myPhotosTab = document.getElementById('my-photos-tab');
    const allPhotosTab = document.getElementById('all-photos-tab');
    const myPhotosView = document.getElementById('my-photos-view');
    const allPhotosView = document.getElementById('all-photos-view');
    const myPhotosGrid = document.createElement('div');
    myPhotosGrid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
    const allPhotosGrid = allPhotosView.querySelector('.grid');

    // --- Initial Setup ---
    const urlParams = new URLSearchParams(window.location.search);
    const photographer = urlParams.get('photographer');
    const album = urlParams.get('album');

    if (!photographer || !album) {
        loadingState.innerHTML = '<p class="text-red-500 text-center">Error: Invalid event link.</p>';
        return;
    }

    const albumDisplayName = album.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    eventTitleGuest.textContent = `Welcome to ${albumDisplayName}`;
    eventTitleMain.textContent = albumDisplayName;

    // --- Tab Switching Logic ---
    const activateTab = (activeTab) => {
        const inactiveTab = activeTab === myPhotosTab ? allPhotosTab : myPhotosTab;
        myPhotosView.style.display = activeTab === myPhotosTab ? 'block' : 'none';
        allPhotosView.style.display = activeTab === allPhotosTab ? 'block' : 'none';
        
        activeTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-primary border-primary';
        inactiveTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent';
    };
    myPhotosTab.addEventListener('click', () => activateTab(myPhotosTab));
    allPhotosTab.addEventListener('click', () => activateTab(allPhotosTab));

    // --- Photo Fetching and Displaying ---
    const renderPhotos = (gridElement, photos, emptyMessage) => {
        gridElement.innerHTML = '';
        if (!photos || photos.length === 0) {
            gridElement.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">${emptyMessage}</p>`;
            return;
        }
        photos.forEach(photo => {
            const photoCard = document.createElement('div');
            photoCard.className = 'aspect-square bg-gray-200 rounded-lg overflow-hidden group relative';
            photoCard.innerHTML = `<img src="${photo.url}" alt="${photo.name}" class="w-full h-full object-cover" loading="lazy">`;
            gridElement.appendChild(photoCard);
        });
    };

    const fetchAndDisplayAllPhotos = async (token) => {
        try {
            const response = await fetch(`/api/event/${photographer}/${album}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error("Could not fetch event photos.");
            const photos = await response.json();
            renderPhotos(allPhotosGrid, photos, "This album has no photos yet.");
        } catch (error) {
            allPhotosGrid.innerHTML = `<p class="col-span-full text-red-500 text-center py-10">${error.message}</p>`;
        }
    };

    const fetchAndDisplayMyPhotos = async (token) => {
        myPhotosView.innerHTML = ''; // Clear "Searching..." message
        myPhotosView.appendChild(myPhotosGrid);
        myPhotosGrid.innerHTML = `<div class="col-span-full text-center py-10"><div class="spinner"></div><p class="mt-2">Finding your photos...</p></div>`;
        try {
            const response = await fetch(`/api/find-my-photos/${photographer}/${album}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error("Could not find your photos.");
            const result = await response.json();
            renderPhotos(myPhotosGrid, result.matches, "No photos featuring you were found in this album.");
        } catch (error) {
            myPhotosGrid.innerHTML = `<p class="col-span-full text-red-500 text-center py-10">${error.message}</p>`;
        }
    };

    // --- Main Logic ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        loadingState.style.display = 'none';
        guestPrompt.style.display = 'block';
        loginBtnGuest?.addEventListener('click', (e) => {
            e.preventDefault(); 
            localStorage.setItem('postLoginRedirectUrl', window.location.href);
            window.location.href = loginBtnGuest.href; 
        });
        signupBtnGuest?.addEventListener('click', (e) => {
            e.preventDefault(); 
            localStorage.setItem('postLoginRedirectUrl', window.location.href);
            window.location.href = signupBtnGuest.href; 
        });
    } else {
        loadingState.style.display = 'none';
        eventGallery.style.display = 'block';
        activateTab(allPhotosTab); // Default to showing all photos first
        
        // Fetch for both tabs
        fetchAndDisplayAllPhotos(token);
        fetchAndDisplayMyPhotos(token);
    }
});