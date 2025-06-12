document.addEventListener('DOMContentLoaded', async () => {
    const DOMElements = {
        loginBtnNav: document.getElementById('loginBtnNav'),
        signinBtnNav: document.getElementById('signinBtnNav'),
        profileDropdownContainer: document.getElementById('profileDropdownContainer'),
        profileDropdownButton: document.getElementById('profileDropdownButton'),
        profileDropdownMenu: document.getElementById('profileDropdownMenu'),
        profileInitials: document.getElementById('profileInitials'),
        dropdownProfileInitials: document.getElementById('dropdownProfileInitials'),
        dropdownUserName: document.getElementById('dropdownUserName'),
        dropdownUserEmail: document.getElementById('dropdownUserEmail'),
        logoutBtnDropdown: document.getElementById('logoutBtnDropdown'),
        loginBtnNavMobile: document.getElementById('loginBtnNavMobile'),
        signinBtnNavMobile: document.getElementById('signinBtnNavMobile'),
        profileContainerMobile: document.getElementById('profileContainerMobile'),
        profileInitialsMobile: document.getElementById('profileInitialsMobile'),
        userNameMobile: document.getElementById('userNameMobile'),
        userEmailMobile: document.getElementById('userEmailMobile'),
        logoutBtnNavMobile: document.getElementById('logoutBtnNavMobile'),
        loginPromptDiv: document.getElementById('login-prompt'),
        albumsMainContentDiv: document.getElementById('albums-main-content'),
        navTabButtons: document.querySelectorAll('.nav-tab-button'),
        viewContainer: document.getElementById('view-container'),
        manageAlbumsView: document.getElementById('manage-albums-view'),
        albumDetailView: document.getElementById('album-detail-view'),
        createAlbumBtn: document.getElementById('createAlbumBtn'),
        createAlbumFormContainer: document.getElementById('createAlbumFormContainer'),
        createAlbumForm: document.getElementById('createAlbumForm'),
        newAlbumNameInput: document.getElementById('newAlbumName'),
        cancelCreateAlbumBtn: document.getElementById('cancelCreateAlbumBtn'),
        albumGrid: document.getElementById('album-grid'),
        albumGridLoader: document.getElementById('album-grid-loader'),
        noAlbumsMessage: document.getElementById('no-albums-message'),
        photoGrid: null,
        photoGridLoader: null,
        noPhotosMessage: null,
        photoActionBar: null,
        selectionCountSpan: null,
        lightboxModal: document.getElementById('lightbox-modal'),
        lightboxImage: document.getElementById('lightbox-image'),
        lightboxCaption: document.getElementById('lightbox-caption'),
        closeLightboxBtn: document.getElementById('close-lightbox'),
        lightboxPrevBtn: document.getElementById('lightbox-prev'),
        lightboxNextBtn: document.getElementById('lightbox-next'),
        toastContainer: document.getElementById('toast-container'),
        hamburger: document.getElementById('hamburger'),
        mobileNavLinksMenu: document.getElementById('mobileNavLinksMenu'),
        shareModal: document.getElementById('share-modal'),
        closeShareModalBtn: document.getElementById('close-share-modal'),
        shareLinkInput: document.getElementById('share-link-input'),
        copyShareLinkBtn: document.getElementById('copy-share-link-btn'),
    };

    let currentUser = null;
    let currentAlbums = [];
    let currentAlbumPhotos = [];
    let selectedPhotos = new Set();
    let lightboxCurrentIndex = -1;

    const API_BASE_URL = '';
    const ML_API_BASE_URL = 'https://facerecognitionphotography-app-200111791636.asia-south1.run.app/';

    function showToast(message, type = 'info') {
        if (!DOMElements.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.innerHTML = `<span class="toast-message">${message}</span><button class="toast-close">&times;</button>`;
        DOMElements.toastContainer.appendChild(toast);
        const autoDismiss = setTimeout(() => {
            toast.remove();
        }, 5000);
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(autoDismiss);
            toast.remove();
        });
    }

    function updateUserNav(isLoggedIn, userData = null) {
        currentUser = isLoggedIn ? userData : null;
        const display = isLoggedIn ? 'none' : 'block';
        const profileDisplay = isLoggedIn ? 'block' : 'none';
        [DOMElements.loginBtnNav, DOMElements.signinBtnNav, DOMElements.loginBtnNavMobile, DOMElements.signinBtnNavMobile].forEach(el => {
            if (el) el.style.display = display;
        });
        [DOMElements.profileDropdownContainer, DOMElements.profileContainerMobile].forEach(el => {
            if (el) el.style.display = profileDisplay;
        });
        if (isLoggedIn && userData) {
            const initials = userData.username.charAt(0).toUpperCase();
            [DOMElements.profileInitials, DOMElements.dropdownProfileInitials, DOMElements.profileInitialsMobile].forEach(el => {
                if (el) el.textContent = initials;
            });
            [DOMElements.dropdownUserName, DOMElements.userNameMobile].forEach(el => {
                if (el) el.textContent = userData.username;
            });
            if (DOMElements.dropdownUserEmail) DOMElements.dropdownUserEmail.textContent = userData.email || `${userData.username}@example.com`;
            if (DOMElements.userEmailMobile) DOMElements.userEmailMobile.textContent = userData.email || `${userData.username}@example.com`;
        }
    }

    async function checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            updateUserNav(false);
            if (DOMElements.loginPromptDiv) DOMElements.loginPromptDiv.style.display = 'block';
            if (DOMElements.albumsMainContentDiv) DOMElements.albumsMainContentDiv.style.display = 'none';
            return false;
        }
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Session expired');
            const data = await response.json();
            updateUserNav(true, {
                username: data.username
            });
            if (DOMElements.loginPromptDiv) DOMElements.loginPromptDiv.style.display = 'none';
            if (DOMElements.albumsMainContentDiv) DOMElements.albumsMainContentDiv.style.display = 'block';
            return true;
        } catch (error) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            updateUserNav(false);
            return false;
        }
    }

    function switchView(viewId) {
        if (DOMElements.viewContainer) {
            Array.from(DOMElements.viewContainer.children).forEach(child => {
                child.style.display = 'none'
            });
        }
        const activeSection = document.getElementById(viewId);
        if (activeSection) {
            activeSection.style.display = 'block';
        }
    }

    async function fetchUserAlbums() {
        const token = localStorage.getItem('authToken');
        if (DOMElements.albumGridLoader) DOMElements.albumGridLoader.style.display = 'grid';
        try {
            const response = await fetch('/api/albums', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch albums');
            currentAlbums = await response.json();
            displayAlbums(currentAlbums);
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            if (DOMElements.albumGridLoader) DOMElements.albumGridLoader.style.display = 'none';
        }
    }

    function displayAlbums(albums) {
        if (!DOMElements.albumGrid || !DOMElements.noAlbumsMessage) return;

        DOMElements.albumGrid.innerHTML = '';
        const hasAlbums = albums && albums.length > 0;
        DOMElements.noAlbumsMessage.style.display = hasAlbums ? 'none' : 'block';
        DOMElements.albumGrid.style.display = hasAlbums ? 'grid' : 'none';

        if (!hasAlbums) return;

        albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card-item bg-white rounded-xl shadow-lg overflow-hidden group';
            const coverUrl = album.cover || `https://placehold.co/400x300/e0e0e0/777?text=${encodeURIComponent(album.name)}`;
            card.innerHTML = `
                <div class="relative">
                    <div class="w-full h-48 bg-gray-200 overflow-hidden cursor-pointer img-container">
                        <img src="${coverUrl}" alt="${album.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                    </div>
                    <div class="absolute top-2 right-2">
                        <button class="share-album-btn bg-black bg-opacity-40 text-white rounded-full h-9 w-9 flex items-center justify-center" data-album-id="${album.id}" title="Share Album">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="p-5 info-container cursor-pointer">
                    <h3 class="text-lg font-semibold truncate">${album.name}</h3>
                    <p class="text-xs text-gray-500">${album.photo_count || 0} photos</p>
                </div>`;
            card.querySelector('.img-container').addEventListener('click', () => loadAlbumDetailView(album.id, album.name));
            card.querySelector('.info-container').addEventListener('click', () => loadAlbumDetailView(album.id, album.name));
            DOMElements.albumGrid.appendChild(card);
        });
    }

    async function loadAlbumDetailView(albumId, albumName) {
        switchView('album-detail-view');
        DOMElements.albumDetailView.innerHTML = `<div class="text-center py-10"><div class="spinner"></div></div>`;
        try {
            const templateResponse = await fetch('album_detail_template.html');
            if (!templateResponse.ok) throw new Error("Could not load album view template.");
            DOMElements.albumDetailView.innerHTML = await templateResponse.text();
            assignAlbumDetailDOMElements();
            DOMElements.albumDetailView.querySelector('#breadcrumb-album-name').textContent = albumName;
            DOMElements.albumDetailView.querySelector('#detail-album-title').textContent = albumName;
            DOMElements.albumDetailView.querySelector('#breadcrumb-albums').addEventListener('click', () => switchView('manage-albums-view'));
            DOMElements.albumDetailView.querySelector('#uploadToAlbumBtn').addEventListener('click', () => DOMElements.albumDetailView.querySelector('#uploadPhotosInput').click());
            DOMElements.albumDetailView.querySelector('#uploadPhotosInput').addEventListener('change', (e) => handlePhotoUpload(e.target.files, albumId, albumName));
            await fetchAndDisplayPhotos(albumId);
        } catch (error) {
            showToast(error.message, 'error');
            DOMElements.albumDetailView.innerHTML = `<p class="text-red-500 text-center">Error loading view.</p>`;
        }
    }

    function assignAlbumDetailDOMElements() {
        DOMElements.photoGrid = DOMElements.albumDetailView.querySelector('#photo-grid');
        DOMElements.photoGridLoader = DOMElements.albumDetailView.querySelector('#photo-grid-loader');
        DOMElements.noPhotosMessage = DOMElements.albumDetailView.querySelector('#no-photos-message');
    }

    async function fetchAndDisplayPhotos(albumId) {
        if (DOMElements.photoGridLoader) DOMElements.photoGridLoader.style.display = 'grid';
        try {
            const token = localStorage.getItem('authToken');
            const username = currentUser ? currentUser.username : 'user';
            const response = await fetch(`/api/event/${username}/${albumId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch photos');
            currentAlbumPhotos = await response.json();
            displayPhotosInGrid(currentAlbumPhotos);
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            if (DOMElements.photoGridLoader) DOMElements.photoGridLoader.style.display = 'none';
        }
    }

    function displayPhotosInGrid(photos) {
        if (!DOMElements.photoGrid || !DOMElements.noPhotosMessage) return;
        DOMElements.photoGrid.innerHTML = '';
        const hasPhotos = photos && photos.length > 0;
        DOMElements.noPhotosMessage.style.display = hasPhotos ? 'none' : 'block';
        DOMElements.photoGrid.style.display = hasPhotos ? 'grid' : 'none';

        if (!hasPhotos) return;

        photos.forEach((photo) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item group aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer';
            photoItem.innerHTML = `<img src="${photo.url}" class="w-full h-full object-cover">`;
            DOMElements.photoGrid.appendChild(photoItem);
        });
    }

    async function handlePhotoUpload(files, albumId, albumName) {
        if (!files || files.length === 0) return;

        const token = localStorage.getItem('authToken');
        if (!token) {
            showToast("You must be logged in to upload photos.", "error");
            return;
        }

        const uploadButton = DOMElements.albumDetailView?.querySelector('#uploadToAlbumBtn');
        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span class="ml-2">Uploading 0/${files.length}...</span>`;
        }

        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('album', albumId);
            const promise = fetch('/api/upload-single-file', {
                method: 'POST',
                body: formData,
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json());
            uploadPromises.push(promise);
        }
        
        const results = await Promise.all(uploadPromises);
        const successfulUrls = results.filter(r => r.success).map(r => r.url);
        
        if (uploadButton) {
            uploadButton.innerHTML = `<i class="fas fa-check-circle"></i><span class="ml-2">Uploads Complete!</span>`;
        }
        showToast(`${successfulUrls.length} of ${files.length} photos uploaded.`, "success");

        if (successfulUrls.length > 0) {
            showToast(`Now processing faces... This may take a moment.`, "info");
            if (uploadButton) {
                uploadButton.innerHTML = `<i class="fas fa-brain"></i><span class="ml-2">Processing Faces...</span>`;
            }

            try {
                const embedding_filename = `${currentUser.username}-${albumId}_embeddings.json`;
                const mlPayload = new FormData();
                successfulUrls.forEach(url => mlPayload.append('urls', url));
                mlPayload.append('embedding_file', embedding_filename);
                
                const mlResponse = await fetch(`${ML_API_BASE_URL}add_embeddings_from_urls/`, {
                    method: 'POST',
                    body: mlPayload,
                });

                if (!mlResponse.ok) {
                    const mlError = await mlResponse.json();
                    throw new Error(mlError.detail || "Face processing on the ML server failed.");
                }
                
                const mlResult = await mlResponse.json();
                showToast(`Face processing complete! Added ${mlResult.added_count} new faces.`, "success");

            } catch (error) {
                console.error("Error during ML batch processing:", error);
                showToast(`Face processing failed: ${error.message}`, "error");
            }
        }

        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.innerHTML = `<i class="fas fa-upload"></i><span class="ml-2">Upload Photos</span>`;
        }
        
        loadAlbumDetailView(albumId, albumName);
    }

    async function handleShareAlbumClick(albumId) {
        if (!currentUser || !currentUser.username) {
            showToast("You must be logged in to share.", "error");
            return;
        }
        const photographerUsername = currentUser.username;
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/album/${photographerUsername}/${albumId}/share`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate link.');
            DOMElements.shareLinkInput.value = data.share_link;
            DOMElements.shareModal.style.display = 'flex';
        } catch (error) {
            showToast(`Error: ${error.message}`, "error");
        }
    }

    function handleLogout() {
        localStorage.clear();
        window.location.href = 'login.html';
    }

    // --- Event Listeners ---
    if (DOMElements.createAlbumBtn) {
        DOMElements.createAlbumBtn.addEventListener('click', () => DOMElements.createAlbumFormContainer.style.display = 'block');
    }
    if (DOMElements.cancelCreateAlbumBtn) {
        DOMElements.cancelCreateAlbumBtn.addEventListener('click', () => DOMElements.createAlbumFormContainer.style.display = 'none');
    }
    if (DOMElements.createAlbumForm) {
        DOMElements.createAlbumForm.addEventListener('submit', async e => {
            e.preventDefault();
            const token = localStorage.getItem('authToken');
            const albumName = DOMElements.newAlbumNameInput.value;
            if (!albumName) {
                showToast("Album name cannot be empty.", "error");
                return;
            }
            await fetch('/api/create-album', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: albumName
                })
            });
            DOMElements.createAlbumFormContainer.style.display = 'none';
            DOMElements.createAlbumForm.reset();
            fetchUserAlbums();
        });
    }

    if (DOMElements.albumGrid) {
        DOMElements.albumGrid.addEventListener('click', e => {
            const shareButton = e.target.closest('.share-album-btn');
            if (shareButton) {
                e.stopPropagation();
                handleShareAlbumClick(shareButton.dataset.albumId);
            }
        });
    }

    if (DOMElements.closeShareModalBtn) {
        DOMElements.closeShareModalBtn.addEventListener('click', () => DOMElements.shareModal.style.display = 'none');
    }
    if (DOMElements.copyShareLinkBtn) {
        DOMElements.copyShareLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(DOMElements.shareLinkInput.value).then(() => showToast("Link copied!", "success"));
        });
    }
    
    if (DOMElements.shareModal) {
        DOMElements.shareModal.addEventListener('click', (e) => {
            if (e.target === DOMElements.shareModal) {
                DOMElements.shareModal.style.display = 'none';
            }
        });
    }

    [DOMElements.logoutBtnDropdown, DOMElements.logoutBtnNavMobile].forEach(btn => {
        if (btn) btn.addEventListener('click', handleLogout);
    });

    async function initializePage() {
        if (await checkLoginStatus()) {
            switchView('manage-albums-view');
            fetchUserAlbums();
        }
    }

    initializePage();
});