// js/gallery.js
// ArtVault - Image Management and Gallery View

window.ArtVaultGallery = {
  activeImages: [], // Stores currently displayed images for lightbox navigation

  /**
   * Imports one or more image files.
   */
  async importImages(projectId, folderId, files) {
    if (!files || files.length === 0) return;
    
    const errors = [];
    
    for (const file of files) {
      // Check if it is an image
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} n'est pas une image valide.`);
        continue;
      }
      
      // Check file size (IndexedDB can store large files, but keeping base64 under 15MB is recommended for performance)
      if (file.size > 15 * 1024 * 1024) {
        errors.push(`${file.name} est trop grande (max 15 Mo).`);
        continue;
      }

      try {
        const dataUrl = await window.ArtVaultProjects.fileToDataURL(file);
        const imageId = "img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        
        const image = {
          id: imageId,
          projectId: projectId,
          folderId: folderId || null, // null means project root
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: dataUrl,
          isDeleted: false,
          createdAt: Date.now()
        };

        await window.ArtVaultDB.saveImage(image);
      } catch (err) {
        console.error("Error importing image:", err);
        errors.push(`Erreur lors de l'import de ${file.name}`);
      }
    }

    if (errors.length > 0) {
      alert("Certaines images n'ont pas pu être importées :\n" + errors.join("\n"));
    }
  },

  /**
   * Soft deletes an image (moves to Trash).
   */
  async trashImage(imageId) {
    await window.ArtVaultDB.setImageDeleteStatus(imageId, true);
  },

  /**
   * Restores an image from Trash.
   */
  async restoreImage(imageId) {
    await window.ArtVaultDB.setImageDeleteStatus(imageId, false);
  },

  /**
   * Moves an image to another folder in the same project.
   */
  async moveImage(imageId, newFolderId) {
    const image = await window.ArtVaultDB.getImage(imageId);
    if (!image) throw new Error("Image introuvable.");

    image.folderId = newFolderId || null;
    await window.ArtVaultDB.saveImage(image);
    return image;
  },

  /**
   * Format bytes to readable size
   */
  formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return "0 Octet";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Octets", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  },

  /**
   * Renders the image gallery.
   * View modes: 'grid' (classic grid) or 'pinterest' (masonry)
   */
  async renderImagesList(projectId, currentFolderId, viewMode = "grid", searchTerm = "") {
    const container = document.getElementById("explorer-images-container");
    if (!container) return;

    container.innerHTML = "";

    // 1. Get all images in the project
    const allImages = await window.ArtVaultDB.getImagesInProject(projectId);
    
    // 2. Filter images for current level and by search query
    this.activeImages = allImages.filter(img => {
      const matchesParent = currentFolderId ? img.folderId === currentFolderId : img.folderId === null;
      const matchesSearch = searchTerm === "" || img.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesParent && !img.isDeleted && matchesSearch;
    });

    if (this.activeImages.length === 0) {
      // If there are also no folders, show an empty state in the parent app
      return;
    }

    // 3. Set layout classes
    if (viewMode === "pinterest") {
      container.className = "pinterest-grid w-full";
    } else {
      container.className = "classic-grid w-full";
    }

    // 4. Render images
    this.activeImages.forEach((image, index) => {
      const wrapper = document.createElement("div");
      
      if (viewMode === "pinterest") {
        wrapper.className = "pinterest-item card-neumorphic overflow-hidden hover:scale-[1.02] transition-transform group relative cursor-pointer";
      } else {
        wrapper.className = "card card-neumorphic overflow-hidden hover:scale-[1.02] transition-transform group relative cursor-pointer aspect-square flex flex-col justify-between";
      }

      wrapper.onclick = () => this.openLightbox(index);

      const sizeStr = this.formatBytes(image.size);

      if (viewMode === "pinterest") {
        wrapper.innerHTML = `
          <div class="relative w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
            <img src="${image.dataUrl}" alt="${image.name}" class="w-full h-auto object-cover select-none">
          </div>
          <div class="p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div class="overflow-hidden pr-6">
              <h4 class="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title="${image.name}">
                ${image.name}
              </h4>
              <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                ${sizeStr}
              </p>
            </div>
            <!-- Context Menu Button -->
            <button class="absolute right-2 bottom-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full transition-opacity z-10" 
                    onclick="event.stopPropagation(); window.ArtVaultApp.showImageContextMenu(event, '${image.id}', '${image.name}')">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        `;
      } else {
        // Classic Grid: square preview
        wrapper.innerHTML = `
          <div class="relative w-full flex-grow overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            <img src="${image.dataUrl}" alt="${image.name}" class="w-full h-full object-cover select-none">
          </div>
          <div class="p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
            <div class="overflow-hidden pr-6">
              <h4 class="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title="${image.name}">
                ${image.name}
              </h4>
              <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                ${sizeStr}
              </p>
            </div>
            <!-- Context Menu Button -->
            <button class="absolute right-2 bottom-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full transition-opacity z-10" 
                    onclick="event.stopPropagation(); window.ArtVaultApp.showImageContextMenu(event, '${image.id}', '${image.name}')">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        `;
      }

      container.appendChild(wrapper);
    });
  },

  // =========================================================================
  // LIGHTBOX / PREVIEW
  // =========================================================================
  
  currentLightboxIndex: 0,
  zoomScale: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,

  openLightbox(index) {
    if (index < 0 || index >= this.activeImages.length) return;
    this.currentLightboxIndex = index;
    
    const lightbox = document.getElementById("lightbox");
    if (!lightbox) return;

    // Reset zoom & pan
    this.zoomScale = 1;
    this.panX = 0;
    this.panY = 0;

    this.updateLightboxContent();
    
    lightbox.classList.remove("hidden");
    lightbox.classList.add("flex");
    document.body.style.overflow = "hidden"; // Disable scroll

    // Bind key events for navigation
    window.addEventListener("keydown", this.handleLightboxKeys);
  },

  closeLightbox() {
    const lightbox = document.getElementById("lightbox");
    if (lightbox) {
      lightbox.classList.add("hidden");
      lightbox.classList.remove("flex");
    }
    document.body.style.overflow = ""; // Enable scroll
    window.removeEventListener("keydown", this.handleLightboxKeys);
  },

  updateLightboxContent() {
    const image = this.activeImages[this.currentLightboxIndex];
    if (!image) return;

    const imgElement = document.getElementById("lightbox-img");
    const nameElement = document.getElementById("lightbox-name");
    const infoElement = document.getElementById("lightbox-info");

    if (imgElement) {
      imgElement.src = image.dataUrl;
      imgElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomScale})`;
    }
    if (nameElement) {
      nameElement.textContent = image.name;
    }
    if (infoElement) {
      const sizeStr = this.formatBytes(image.size);
      const dateStr = new Date(image.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      infoElement.textContent = `${sizeStr} • Ajouté le ${dateStr}`;
    }
  },

  nextImage() {
    if (this.currentLightboxIndex < this.activeImages.length - 1) {
      this.currentLightboxIndex++;
      this.zoomScale = 1;
      this.panX = 0;
      this.panY = 0;
      this.updateLightboxContent();
    }
  },

  prevImage() {
    if (this.currentLightboxIndex > 0) {
      this.currentLightboxIndex--;
      this.zoomScale = 1;
      this.panX = 0;
      this.panY = 0;
      this.updateLightboxContent();
    }
  },

  zoomIn() {
    this.zoomScale = Math.min(this.zoomScale + 0.25, 4);
    this.updateTransform();
  },

  zoomOut() {
    this.zoomScale = Math.max(this.zoomScale - 0.25, 0.5);
    this.updateTransform();
  },

  resetZoom() {
    this.zoomScale = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  },

  updateTransform() {
    const imgElement = document.getElementById("lightbox-img");
    if (imgElement) {
      imgElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomScale})`;
    }
  },

  handleLightboxKeys: (e) => {
    const gallery = window.ArtVaultGallery;
    if (e.key === "Escape") gallery.closeLightbox();
    if (e.key === "ArrowRight") gallery.nextImage();
    if (e.key === "ArrowLeft") gallery.prevImage();
  },

  // Touch and mouse dragging for panning zoomed image
  startDrag(e) {
    if (this.zoomScale <= 1) return; // Only pan when zoomed in
    this.isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.startX = clientX - this.panX;
    this.startY = clientY - this.panY;
    e.preventDefault();
  },

  drag(e) {
    if (!this.isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    this.panX = clientX - this.startX;
    this.panY = clientY - this.startY;
    this.updateTransform();
  },

  endDrag() {
    this.isDragging = false;
  }
};
