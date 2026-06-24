// js/app.js
// ArtVault - Main Coordinator

window.ArtVaultApp = {
  // Application State
  state: {
    currentView: "home", // 'home', 'explorer', 'dashboard', 'trash', 'backup'
    currentProjectId: null,
    currentFolderId: null,
    viewMode: "grid", // 'grid' or 'pinterest'
    theme: "light", // 'light' or 'dark'
    searchQuery: "",
    moveSelection: null, // { id: '...', type: 'folder'|'image', name: '...' }
  },

  /**
   * Initializes the application.
   */
  async init() {
    console.log("Initializing ArtVault Application...");
    
    // 1. Initialize Database
    try {
      await window.ArtVaultDB.init();
    } catch (err) {
      alert("Impossible d'initialiser la base de données IndexedDB. " + err.message);
      return;
    }

    // 2. Load Theme
    await this.initTheme();

    // 3. Bind Event Listeners
    this.bindEvents();

    // 4. Generate and Cache PWA Icons
    try {
      await this.generateAndCacheIcons();
    } catch (err) {
      console.warn("Could not generate PWA icons:", err);
    }

    // 5. Handle PWA installation and service worker
    this.registerServiceWorker();

    // 6. Navigate to Home
    this.navigateTo("home");

    // 7. Check for drag & drop zones
    this.setupDragAndDrop();

    // 8. Update dashboard stats in background
    this.updateDashboardStats();
  },

  /**
   * Generates beautiful artistic icons on a Canvas and stores them in Cache Storage
   * so the PWA service worker can serve them as real PNGs.
   */
  async generateAndCacheIcons() {
    if (!("caches" in window)) return;
    
    const cache = await caches.open("artvault-cache-v1");
    
    // Check if already cached
    const match192 = await cache.match("icons/icon-192.png");
    const match512 = await cache.match("icons/icon-512.png");
    
    if (match192 && match512) {
      console.log("PWA icons are already cached.");
      return;
    }
    
    const createIconBlob = (size) => {
      return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        
        // Background: Deep dark blue gradient
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, "#0b0f19");
        grad.addColorStop(1, "#1e293b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        // Soft glowing center
        const glowGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        glowGrad.addColorStop(0, "rgba(14, 165, 233, 0.25)");
        glowGrad.addColorStop(1, "rgba(11, 15, 25, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
        ctx.fill();

        // Draw Neumorphic Vault Arch
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = size * 0.08;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
        ctx.lineWidth = size * 0.04;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.beginPath();
        // Draw arched door
        ctx.moveTo(size * 0.25, size * 0.78);
        ctx.lineTo(size * 0.25, size * 0.45);
        ctx.arcTo(size * 0.5, size * 0.15, size * 0.75, size * 0.45, size * 0.25);
        ctx.lineTo(size * 0.75, size * 0.78);
        ctx.stroke();
        
        // Reset shadow for brush strokes
        ctx.shadowBlur = 0;
        
        // Draw colorful artistic brush strokes (emotional heart)
        // Pink stroke
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = size * 0.045;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.52, size * 0.18, 0.8 * Math.PI, 1.8 * Math.PI);
        ctx.stroke();
        
        // Cyan stroke
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = size * 0.035;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.52, size * 0.14, 1.3 * Math.PI, 0.3 * Math.PI);
        ctx.stroke();
        
        // Gold stroke
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = size * 0.025;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.52, size * 0.22, 0.1 * Math.PI, 1.1 * Math.PI);
        ctx.stroke();
        
        // Vault lock / Artist Seal
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = size * 0.012;
        
        // Circle keyhole
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.60, size * 0.035, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Core glow
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = size * 0.03;
        ctx.beginPath();
        ctx.arc(size * 0.5, size * 0.48, size * 0.02, 0, 2 * Math.PI);
        ctx.fill();

        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png");
      });
    };
    
    console.log("Generating PWA icons in background...");
    const blob192 = await createIconBlob(192);
    const blob512 = await createIconBlob(512);
    
    // Create base path
    const rootPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    
    await cache.put(rootPath + "icons/icon-192.png", new Response(blob192, { headers: { "Content-Type": "image/png" } }));
    await cache.put(rootPath + "icons/icon-512.png", new Response(blob512, { headers: { "Content-Type": "image/png" } }));
    console.log("Artistic PWA icons generated and stored in cache successfully!");
  },

  // =========================================================================
  // THEME MANAGEMENT
  // =========================================================================
  
  async initTheme() {
    // Check saved theme in metadata, fallback to light
    let savedTheme = await window.ArtVaultDB.getMetadata("theme");
    if (!savedTheme) {
      savedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    this.setTheme(savedTheme);
  },

  setTheme(theme) {
    this.state.theme = theme;
    const htmlEl = document.documentElement;
    
    if (theme === "dark") {
      htmlEl.setAttribute("data-theme", "dark");
      htmlEl.classList.add("dark");
    } else {
      htmlEl.removeAttribute("data-theme");
      htmlEl.classList.remove("dark");
    }
    
    window.ArtVaultDB.setMetadata("theme", theme);
    localStorage.setItem("theme", theme);
    
    // Update theme toggle button icon
    const themeIcon = document.getElementById("theme-toggle-icon");
    if (themeIcon) {
      if (theme === "dark") {
        themeIcon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        `;
      } else {
        themeIcon.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        `;
      }
    }
  },

  toggleTheme() {
    const newTheme = this.state.theme === "light" ? "dark" : "light";
    this.setTheme(newTheme);
  },

  // =========================================================================
  // NAVIGATION
  // =========================================================================

  async navigateTo(view) {
    this.state.currentView = view;
    
    // Hide all sections
    const sections = ["home", "explorer", "dashboard", "trash", "backup"];
    sections.forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.classList.add("hidden");
    });

    // Reset search query on section change
    this.state.searchQuery = "";
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";

    // Show selected section
    const activeEl = document.getElementById(`section-${view}`);
    if (activeEl) activeEl.classList.remove("hidden");

    // Update Bottom Nav active state
    this.updateBottomNavUI(view);

    // Load content specific to the view
    if (view === "home") {
      this.state.currentProjectId = null;
      this.state.currentFolderId = null;
      await window.ArtVaultProjects.renderProjectsList();
      this.updatePasteBanner();
    } else if (view === "dashboard") {
      await this.renderDashboard();
    } else if (view === "trash") {
      await this.renderTrash();
    } else if (view === "backup") {
      // Nothing special to load immediately
    }

    // Scroll to top
    window.scrollTo(0, 0);
  },

  updateBottomNavUI(activeView) {
    const navItems = ["home", "dashboard", "trash", "backup"];
    navItems.forEach(item => {
      const btn = document.getElementById(`nav-btn-${item}`);
      if (btn) {
        if (item === activeView || (item === "home" && activeView === "explorer")) {
          btn.classList.add("text-indigo-600", "dark:text-sky-400");
          btn.classList.remove("text-slate-400", "dark:text-slate-500");
          // Inner dot/glow indicator
          const dot = btn.querySelector(".nav-dot");
          if (dot) dot.classList.remove("opacity-0");
        } else {
          btn.classList.add("text-slate-400", "dark:text-slate-500");
          btn.classList.remove("text-indigo-600", "dark:text-sky-400");
          const dot = btn.querySelector(".nav-dot");
          if (dot) dot.classList.add("opacity-0");
        }
      }
    });
  },

  // =========================================================================
  // EXPLORER VIEW ACTIONS
  // =========================================================================

  async openProject(projectId) {
    this.state.currentProjectId = projectId;
    this.state.currentFolderId = null;
    
    // Save as last opened
    window.ArtVaultDB.setMetadata("lastOpenedProject", projectId);
    
    await this.enterExplorer();
  },

  async openFolder(folderId) {
    this.state.currentFolderId = folderId;
    await this.enterExplorer();
  },

  async goBack() {
    if (this.state.currentFolderId) {
      const folder = await window.ArtVaultDB.getFolder(this.state.currentFolderId);
      if (folder && folder.parentId) {
        await this.openFolder(folder.parentId);
      } else {
        await this.openProject(this.state.currentProjectId);
      }
    } else {
      await this.navigateTo("home");
    }
  },

  async enterExplorer() {
    this.state.currentView = "explorer";
    
    // Show explorer section, hide others
    const sections = ["home", "explorer", "dashboard", "trash", "backup"];
    sections.forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.classList.add("hidden");
    });
    document.getElementById("section-explorer").classList.remove("hidden");
    
    this.updateBottomNavUI("home"); // Keep "Home" highlighted in bottom nav
    this.updatePasteBanner();

    // Get current project details
    const project = await window.ArtVaultDB.getProject(this.state.currentProjectId);
    if (!project) {
      alert("Projet introuvable.");
      this.navigateTo("home");
      return;
    }

    // 1. Render Breadcrumbs
    await window.ArtVaultFolders.renderBreadcrumbs(project, this.state.currentFolderId);

    // 2. Render Folders
    await window.ArtVaultFolders.renderFoldersList(
      this.state.currentProjectId,
      this.state.currentFolderId,
      this.state.searchQuery
    );

    // 3. Render Images
    await window.ArtVaultGallery.renderImagesList(
      this.state.currentProjectId,
      this.state.currentFolderId,
      this.state.viewMode,
      this.state.searchQuery
    );

    // Check empty state
    const foldersContainer = document.getElementById("explorer-folders-container");
    const imagesContainer = document.getElementById("explorer-images-container");
    const emptyState = document.getElementById("explorer-empty-state");

    const foldersEmpty = !foldersContainer || foldersContainer.children.length === 0;
    const imagesEmpty = !imagesContainer || imagesContainer.children.length === 0;

    if (foldersEmpty && imagesEmpty) {
      if (emptyState) emptyState.classList.remove("hidden");
    } else {
      if (emptyState) emptyState.classList.add("hidden");
    }
  },

  toggleViewMode() {
    this.state.viewMode = this.state.viewMode === "grid" ? "pinterest" : "grid";
    
    // Update button styling
    const gridBtn = document.getElementById("view-btn-grid");
    const pinBtn = document.getElementById("view-btn-pinterest");

    if (this.state.viewMode === "pinterest") {
      if (gridBtn) gridBtn.classList.remove("shadow-in-sm", "text-indigo-600", "dark:text-sky-400");
      if (pinBtn) pinBtn.classList.add("shadow-in-sm", "text-indigo-600", "dark:text-sky-400");
    } else {
      if (gridBtn) gridBtn.classList.add("shadow-in-sm", "text-indigo-600", "dark:text-sky-400");
      if (pinBtn) pinBtn.classList.remove("shadow-in-sm", "text-indigo-600", "dark:text-sky-400");
    }

    // Rerender if in explorer
    if (this.state.currentView === "explorer") {
      this.enterExplorer();
    }
  },

  // =========================================================================
  // SEARCH FUNCTIONALITY
  // =========================================================================

  handleSearch(query) {
    this.state.searchQuery = query.trim();
    
    if (this.state.currentView === "home") {
      window.ArtVaultProjects.renderProjectsList(this.state.searchQuery);
    } else if (this.state.currentView === "explorer") {
      this.enterExplorer();
    }
  },

  // =========================================================================
  // DRAG & DROP & IMAGE UPLOAD
  // =========================================================================

  setupDragAndDrop() {
    const dropZone = document.getElementById("drop-zone-overlay");
    if (!dropZone) return;

    window.addEventListener("dragenter", (e) => {
      if (this.state.currentView !== "explorer") return;
      e.preventDefault();
      dropZone.classList.remove("hidden");
      dropZone.classList.add("flex");
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      // Only hide if leaving the main overlay
      if (e.relatedTarget === null || !dropZone.contains(e.relatedTarget)) {
        dropZone.classList.add("hidden");
        dropZone.classList.remove("flex");
      }
    });

    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.classList.add("hidden");
      dropZone.classList.remove("flex");

      if (this.state.currentView !== "explorer") return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.showLoading(true, "Importation des images...");
        await window.ArtVaultGallery.importImages(
          this.state.currentProjectId,
          this.state.currentFolderId,
          files
        );
        this.showLoading(false);
        await this.enterExplorer();
        this.updateDashboardStats();
      }
    });

    // File Input trigger
    const fileInput = document.getElementById("hidden-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.showLoading(true, "Importation des images...");
          await window.ArtVaultGallery.importImages(
            this.state.currentProjectId,
            this.state.currentFolderId,
            files
          );
          this.showLoading(false);
          fileInput.value = ""; // clear
          await this.enterExplorer();
          this.updateDashboardStats();
        }
      });
    }
  },

  triggerImageUpload() {
    const fileInput = document.getElementById("hidden-file-input");
    if (fileInput) fileInput.click();
  },

  showLoading(show, message = "Chargement...") {
    const loader = document.getElementById("loading-overlay");
    const text = document.getElementById("loading-text");
    if (loader) {
      if (show) {
        if (text) text.textContent = message;
        loader.classList.remove("hidden");
        loader.classList.add("flex");
      } else {
        loader.classList.add("hidden");
        loader.classList.remove("flex");
      }
    }
  },

  // =========================================================================
  // MODALS & CONTEXT DRAWERS
  // =========================================================================

  openNewProjectModal() {
    const modal = document.getElementById("new-project-modal");
    if (modal) {
      // Clear form
      document.getElementById("proj-name").value = "";
      document.getElementById("proj-desc").value = "";
      document.getElementById("proj-type").value = "Bande dessinée";
      document.getElementById("proj-cover").value = "";
      
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closeNewProjectModal() {
    const modal = document.getElementById("new-project-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  async submitNewProjectForm(e) {
    e.preventDefault();
    const name = document.getElementById("proj-name").value;
    const desc = document.getElementById("proj-desc").value;
    const type = document.getElementById("proj-type").value;
    const coverFile = document.getElementById("proj-cover").files[0];

    this.showLoading(true, "Création du projet...");
    try {
      const project = await window.ArtVaultProjects.createProject(name, desc, type, coverFile);
      this.closeNewProjectModal();
      this.showLoading(false);
      // Directly open the newly created project!
      await this.openProject(project.id);
      this.updateDashboardStats();
    } catch (err) {
      this.showLoading(false);
      alert("Erreur lors de la création du projet : " + err.message);
    }
  },

  openNewFolderModal() {
    const modal = document.getElementById("new-folder-modal");
    if (modal) {
      document.getElementById("folder-name").value = "";
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closeNewFolderModal() {
    const modal = document.getElementById("new-folder-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  async submitNewFolderForm(e) {
    e.preventDefault();
    const name = document.getElementById("folder-name").value;

    try {
      await window.ArtVaultFolders.createFolder(
        this.state.currentProjectId,
        this.state.currentFolderId,
        name
      );
      this.closeNewFolderModal();
      await this.enterExplorer();
      this.updateDashboardStats();
    } catch (err) {
      alert("Erreur lors de la création du dossier : " + err.message);
    }
  },

  // Context Menu drawers (Mobile-friendly modal overlays)
  activeContextItem: null, // { id: '...', type: 'folder'|'image' }

  showFolderContextMenu(event, folderId, folderName) {
    event.stopPropagation();
    this.activeContextItem = { id: folderId, type: "folder", name: folderName };
    
    document.getElementById("context-title").textContent = `Options : ${folderName}`;
    this.setContextMoveVisible(true);
    
    // Show drawer
    const drawer = document.getElementById("context-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
    }
  },

  showImageContextMenu(event, imageId, imageName) {
    event.stopPropagation();
    this.activeContextItem = { id: imageId, type: "image", name: imageName };
    
    document.getElementById("context-title").textContent = `Options : ${imageName}`;
    this.setContextMoveVisible(true);
    
    // Show drawer
    const drawer = document.getElementById("context-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
    }
  },

  showProjectContextMenu(event, projectId, projectName) {
    if (event) event.stopPropagation();
    this.activeContextItem = { id: projectId, type: "project", name: projectName };
    
    document.getElementById("context-title").textContent = `Options : ${projectName}`;
    // Projects cannot be moved, hide the Move option
    this.setContextMoveVisible(false);
    
    // Show drawer
    const drawer = document.getElementById("context-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
    }
  },

  setContextMoveVisible(visible) {
    const moveBtn = document.getElementById("context-move-btn");
    if (moveBtn) moveBtn.classList.toggle("hidden", !visible);
  },

  closeContextMenu() {
    const drawer = document.getElementById("context-drawer");
    if (drawer) {
      drawer.classList.add("hidden");
      drawer.classList.remove("flex");
    }
  },

  triggerRename() {
    const item = this.activeContextItem;
    this.closeContextMenu();
    if (!item) return;

    const modal = document.getElementById("rename-modal");
    if (modal) {
      const input = document.getElementById("rename-input");
      input.value = item.name;
      
      const typeLabels = { folder: "le dossier", image: "l'image", project: "le projet" };
      document.getElementById("rename-title").textContent = `Renommer ${typeLabels[item.type] || ""}`;
      
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  },

  closeRenameModal() {
    const modal = document.getElementById("rename-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  },

  async submitRenameForm(e) {
    e.preventDefault();
    const item = this.activeContextItem;
    const newName = document.getElementById("rename-input").value;
    if (!item) return;

    if (!newName.trim()) return;

    try {
      if (item.type === "folder") {
        await window.ArtVaultFolders.renameFolder(item.id, newName);
      } else if (item.type === "project") {
        const proj = await window.ArtVaultDB.getProject(item.id);
        if (proj) {
          proj.name = newName.trim();
          await window.ArtVaultDB.saveProject(proj);
        }
      } else {
        const img = await window.ArtVaultDB.getImage(item.id);
        if (img) {
          img.name = newName.trim();
          await window.ArtVaultDB.saveImage(img);
        }
      }
      this.closeRenameModal();
      await this.refreshCurrentView();
      this.updateDashboardStats();
    } catch (err) {
      alert("Erreur lors du renommage : " + err.message);
    }
  },

  // Re-renders whichever view is currently active.
  async refreshCurrentView() {
    if (this.state.currentView === "explorer") {
      await this.enterExplorer();
    } else if (this.state.currentView === "home") {
      await window.ArtVaultProjects.renderProjectsList(this.state.searchQuery);
    } else if (this.state.currentView === "trash") {
      await this.renderTrash();
    } else if (this.state.currentView === "dashboard") {
      await this.renderDashboard();
    }
  },

  // =========================================================================
  // MOVE ITEM SYSTEM
  // =========================================================================

  triggerMove() {
    const item = this.activeContextItem;
    this.closeContextMenu();
    if (!item) return;

    this.state.moveSelection = {
      id: item.id,
      type: item.type,
      name: item.name
    };

    this.updatePasteBanner();
    
    // Visual indicator: show a toast/notification
    this.showToast(`Prêt à déplacer "${item.name}". Naviguez vers le dossier de destination et cliquez sur "Placer ici" en haut.`);
  },

  cancelMove() {
    this.state.moveSelection = null;
    this.updatePasteBanner();
  },

  async executeMove() {
    const selection = this.state.moveSelection;
    if (!selection) return;

    this.showLoading(true, "Déplacement en cours...");
    try {
      if (selection.type === "folder") {
        await window.ArtVaultFolders.moveFolder(selection.id, this.state.currentFolderId);
      } else {
        await window.ArtVaultGallery.moveImage(selection.id, this.state.currentFolderId);
      }
      
      this.state.moveSelection = null;
      this.updatePasteBanner();
      this.showLoading(false);
      this.showToast("Élément déplacé avec succès !");
      await this.enterExplorer();
    } catch (err) {
      this.showLoading(false);
      alert("Impossible de déplacer l'élément : " + err.message);
    }
  },

  updatePasteBanner() {
    const banner = document.getElementById("move-banner");
    const text = document.getElementById("move-banner-text");
    
    if (!banner) return;

    if (this.state.moveSelection && (this.state.currentView === "explorer" || this.state.currentView === "home")) {
      if (text) {
        text.innerHTML = `Déplacement de <span class="font-bold">${this.state.moveSelection.name}</span>. Naviguez vers la destination.`;
      }
      banner.classList.remove("hidden");
      banner.classList.add("flex");
      
      // If we are on the Home view, we can't paste, paste button only in explorer.
      const pasteBtn = document.getElementById("move-paste-btn");
      if (pasteBtn) {
        if (this.state.currentView === "home") {
          pasteBtn.classList.add("hidden");
        } else {
          pasteBtn.classList.remove("hidden");
        }
      }
    } else {
      banner.classList.add("hidden");
      banner.classList.remove("flex");
    }
  },

  // =========================================================================
  // TRASHING / DELETION
  // =========================================================================

  async triggerDelete() {
    const item = this.activeContextItem;
    this.closeContextMenu();
    if (!item) return;

    const confirmMsg = `Voulez-vous envoyer "${item.name}" à la corbeille ?`;
    if (confirm(confirmMsg)) {
      try {
        if (item.type === "folder") {
          await window.ArtVaultFolders.trashFolder(item.id);
          await this.enterExplorer();
        } else if (item.type === "project") {
          await window.ArtVaultDB.setProjectDeleteStatus(item.id, true);
          await this.navigateTo("home");
        } else {
          await window.ArtVaultGallery.trashImage(item.id);
          await this.enterExplorer();
        }
        this.updateDashboardStats();
        this.showToast(`"${item.name}" envoyé à la corbeille.`);
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  },

  async triggerProjectDelete(projectId, projectName) {
    if (confirm(`Voulez-vous envoyer le projet "${projectName}" à la corbeille ?`)) {
      try {
        await window.ArtVaultDB.setProjectDeleteStatus(projectId, true);
        await this.navigateTo("home");
        this.updateDashboardStats();
        this.showToast(`Projet "${projectName}" envoyé à la corbeille.`);
      } catch (err) {
        alert("Erreur lors de la suppression du projet : " + err.message);
      }
    }
  },

  async renderTrash() {
    const container = document.getElementById("trash-container");
    if (!container) return;

    container.innerHTML = "";

    const trash = await window.ArtVaultDB.getTrashItems();
    const totalDeleted = trash.projects.length + trash.folders.length + trash.images.length;

    const emptyTrashBtn = document.getElementById("empty-trash-btn");
    if (emptyTrashBtn) {
      if (totalDeleted > 0) {
        emptyTrashBtn.removeAttribute("disabled");
        emptyTrashBtn.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        emptyTrashBtn.setAttribute("disabled", "true");
        emptyTrashBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    }

    if (totalDeleted === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <p class="font-semibold text-base text-slate-500 dark:text-slate-400">La corbeille est vide</p>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Les éléments que vous supprimez apparaîtront ici.</p>
        </div>
      `;
      return;
    }

    // Render Deleted Projects
    trash.projects.forEach(project => {
      const el = document.createElement("div");
      el.className = "card card-neumorphic p-4 flex flex-col justify-between aspect-[4/3]";
      el.innerHTML = `
        <div>
          <div class="flex items-center gap-2 text-indigo-600 dark:text-sky-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-xs font-semibold uppercase tracking-wider">Projet</span>
          </div>
          <h4 class="font-bold text-base text-slate-800 dark:text-slate-100 truncate">${project.name}</h4>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">${project.description || "Aucune description."}</p>
        </div>
        <div class="flex gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button class="flex-grow py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-sky-400 font-semibold text-xs shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center gap-1"
                  onclick="window.ArtVaultApp.restoreItem('${project.id}', 'project')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
            </svg>
            Restaurer
          </button>
          <button class="py-2 px-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 font-semibold text-xs shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center"
                  onclick="window.ArtVaultApp.deleteItemPermanently('${project.id}', 'project', '${project.name}')" title="Supprimer définitivement">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;
      container.appendChild(el);
    });

    // Render Deleted Folders
    for (const folder of trash.folders) {
      const project = await window.ArtVaultDB.getProject(folder.projectId);
      const el = document.createElement("div");
      el.className = "card card-neumorphic p-4 flex flex-col justify-between aspect-[4/3]";
      el.innerHTML = `
        <div>
          <div class="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span class="text-xs font-semibold uppercase tracking-wider">Dossier</span>
          </div>
          <h4 class="font-bold text-base text-slate-800 dark:text-slate-100 truncate">${folder.name}</h4>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
            Projet: ${project ? project.name : "Inconnu"}
          </p>
        </div>
        <div class="flex gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button class="flex-grow py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-sky-400 font-semibold text-xs shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center gap-1"
                  onclick="window.ArtVaultApp.restoreItem('${folder.id}', 'folder')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
            </svg>
            Restaurer
          </button>
          <button class="py-2 px-3 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 font-semibold text-xs shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center"
                  onclick="window.ArtVaultApp.deleteItemPermanently('${folder.id}', 'folder', '${folder.name}')" title="Supprimer définitivement">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;
      container.appendChild(el);
    }

    // Render Deleted Images
    for (const image of trash.images) {
      const project = await window.ArtVaultDB.getProject(image.projectId);
      const sizeStr = window.ArtVaultGallery.formatBytes(image.size);
      
      const el = document.createElement("div");
      el.className = "card card-neumorphic overflow-hidden flex flex-col justify-between aspect-[4/3]";
      el.innerHTML = `
        <div class="relative w-full h-1/2 bg-slate-200 dark:bg-slate-900 overflow-hidden border-b border-slate-100 dark:border-slate-800">
          <img src="${image.dataUrl}" alt="${image.name}" class="w-full h-full object-cover">
          <span class="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded-full bg-black/40 text-white backdrop-blur-sm">
            Image
          </span>
        </div>
        <div class="p-3 flex-grow flex flex-col justify-between">
          <div>
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate" title="${image.name}">${image.name}</h4>
            <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Projet: ${project ? project.name : "Inconnu"} • ${sizeStr}
            </p>
          </div>
          <div class="flex gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-850">
            <button class="flex-grow py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-sky-400 font-semibold text-[10px] shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center gap-1"
                    onclick="window.ArtVaultApp.restoreItem('${image.id}', 'image')">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
              </svg>
              Restaurer
            </button>
            <button class="py-1.5 px-2 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 font-semibold text-[10px] shadow-out-sm hover:scale-[1.03] transition-transform flex items-center justify-center"
                    onclick="window.ArtVaultApp.deleteItemPermanently('${image.id}', 'image', '${image.name}')" title="Supprimer définitivement">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      `;
      container.appendChild(el);
    }
  },

  async restoreItem(id, type) {
    this.showLoading(true, "Restauration en cours...");
    try {
      if (type === "project") {
        await window.ArtVaultDB.setProjectDeleteStatus(id, false);
      } else if (type === "folder") {
        await window.ArtVaultFolders.restoreFolder(id);
      } else if (type === "image") {
        await window.ArtVaultGallery.restoreImage(id);
      }
      this.showLoading(false);
      this.showToast("Élément restauré avec succès !");
      await this.renderTrash();
      this.updateDashboardStats();
    } catch (err) {
      this.showLoading(false);
      alert("Erreur lors de la restauration : " + err.message);
    }
  },

  async deleteItemPermanently(id, type, name) {
    const confirmMsg = `ATTENTION ! Voulez-vous supprimer DÉFINITIVEMENT "${name}" ? Cette action est irréversible et supprimera tout le contenu associé.`;
    if (confirm(confirmMsg)) {
      this.showLoading(true, "Suppression en cours...");
      try {
        if (type === "project") {
          await window.ArtVaultDB.deleteProjectPermanently(id);
        } else if (type === "folder") {
          await window.ArtVaultDB.deleteFolderPermanently(id);
        } else if (type === "image") {
          await window.ArtVaultDB.deleteImagePermanently(id);
        }
        this.showLoading(false);
        this.showToast(`"${name}" a été définitivement supprimé.`);
        await this.renderTrash();
        this.updateDashboardStats();
      } catch (err) {
        this.showLoading(false);
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  },

  async emptyTrash() {
    if (confirm("Voulez-vous vider ENTIÈREMENT la corbeille ? Tous les éléments seront supprimés définitivement. Cette action est irréversible !")) {
      this.showLoading(true, "Vidage de la corbeille...");
      try {
        const trash = await window.ArtVaultDB.getTrashItems();
        
        // Delete all projects
        for (const p of trash.projects) {
          await window.ArtVaultDB.deleteProjectPermanently(p.id);
        }
        // Delete all folders
        for (const f of trash.folders) {
          await window.ArtVaultDB.deleteFolderPermanently(f.id);
        }
        // Delete all images
        for (const img of trash.images) {
          await window.ArtVaultDB.deleteImagePermanently(img.id);
        }

        this.showLoading(false);
        this.showToast("La corbeille a été vidée.");
        await this.renderTrash();
        this.updateDashboardStats();
      } catch (err) {
        this.showLoading(false);
        alert("Erreur lors du vidage de la corbeille : " + err.message);
      }
    }
  },

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  
  async updateDashboardStats() {
    // Keeps stats fresh in the background
    try {
      this.stats = await window.ArtVaultDB.getDashboardStats();
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    }
  },

  async renderDashboard() {
    await this.updateDashboardStats();
    const stats = this.stats;
    if (!stats) return;

    // 1. Write core counters
    document.getElementById("stats-projects-count").textContent = stats.projectsCount;
    document.getElementById("stats-folders-count").textContent = stats.foldersCount;
    document.getElementById("stats-images-count").textContent = stats.imagesCount;

    // 2. Render last opened project card
    const lastProjContainer = document.getElementById("dashboard-last-project");
    if (lastProjContainer) {
      if (stats.lastOpenedProject) {
        const lp = stats.lastOpenedProject;
        lastProjContainer.innerHTML = `
          <div class="flex items-center gap-4 cursor-pointer hover:scale-[1.01] transition-transform" onclick="window.ArtVaultApp.openProject('${lp.id}')">
            <img src="${lp.coverImage}" alt="${lp.name}" class="w-16 h-16 rounded-xl object-cover shadow-out-sm" onerror="this.src='${window.ArtVaultProjects.generatePlaceholderCover(lp.name)}'">
            <div class="overflow-hidden">
              <h4 class="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">${lp.name}</h4>
              <p class="text-xs text-indigo-600 dark:text-sky-400 font-semibold mt-0.5">${lp.type}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Cliquez pour ouvrir rapidement</p>
            </div>
          </div>
        `;
      } else {
        lastProjContainer.innerHTML = `
          <div class="text-center py-4 text-slate-400 dark:text-slate-500 text-xs">
            Aucun projet ouvert récemment.
          </div>
        `;
      }
    }

    // 3. Render last image added card
    const lastImgContainer = document.getElementById("dashboard-last-image");
    if (lastImgContainer) {
      if (stats.lastImageAdded) {
        const li = stats.lastImageAdded;
        const sizeStr = window.ArtVaultGallery.formatBytes(li.size);
        lastImgContainer.innerHTML = `
          <div class="flex items-center gap-4 cursor-pointer hover:scale-[1.01] transition-transform" onclick="window.ArtVaultApp.openProject('${li.projectId}')">
            <img src="${li.dataUrl}" alt="${li.name}" class="w-16 h-16 rounded-xl object-cover shadow-out-sm">
            <div class="overflow-hidden">
              <h4 class="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">${li.name}</h4>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">${sizeStr}</p>
              <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Cliquez pour aller au projet</p>
            </div>
          </div>
        `;
      } else {
        lastImgContainer.innerHTML = `
          <div class="text-center py-4 text-slate-400 dark:text-slate-500 text-xs">
            Aucune image ajoutée récemment.
          </div>
        `;
      }
    }
  },

  // =========================================================================
  // BACKUP & RESTORE
  // =========================================================================

  async exportBackup() {
    this.showLoading(true, "Préparation de la sauvegarde...");
    try {
      const backupObj = await window.ArtVaultDB.exportAllData();
      const jsonString = JSON.stringify(backupObj);
      
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `ArtVault_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showLoading(false);
      this.showToast("Sauvegarde exportée avec succès !");
    } catch (err) {
      this.showLoading(false);
      alert("Erreur lors de l'exportation : " + err.message);
    }
  },

  async triggerImportBackup() {
    const filePicker = document.getElementById("import-file-picker");
    if (filePicker) filePicker.click();
  },

  async handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("ATTENTION ! L'importation d'une sauvegarde va ÉCRASER toutes les données actuelles de votre application ArtVault. Voulez-vous continuer ?")) {
      event.target.value = ""; // Clear
      return;
    }

    this.showLoading(true, "Restauration des données...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await window.ArtVaultDB.importAllData(data);
        
        this.showLoading(false);
        this.showToast("Sauvegarde restaurée avec succès !");
        
        // Reset app state and go home
        this.state.currentProjectId = null;
        this.state.currentFolderId = null;
        await this.navigateTo("home");
        this.updateDashboardStats();
      } catch (err) {
        this.showLoading(false);
        alert("Erreur lors de la restauration de la sauvegarde : " + err.message);
      }
      event.target.value = ""; // Clear
    };
    
    reader.onerror = () => {
      this.showLoading(false);
      alert("Erreur de lecture du fichier de sauvegarde.");
      event.target.value = ""; // Clear
    };
    
    reader.readAsText(file);
  },

  // =========================================================================
  // BIND DOM EVENTS
  // =========================================================================

  bindEvents() {
    // Search input
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // Modal forms
    const newProjForm = document.getElementById("new-project-form");
    if (newProjForm) {
      newProjForm.addEventListener("submit", (e) => this.submitNewProjectForm(e));
    }

    const newFolderForm = document.getElementById("new-folder-form");
    if (newFolderForm) {
      newFolderForm.addEventListener("submit", (e) => this.submitNewFolderForm(e));
    }

    const renameForm = document.getElementById("rename-form");
    if (renameForm) {
      renameForm.addEventListener("submit", (e) => this.submitRenameForm(e));
    }

    // Import file picker binding
    const importPicker = document.getElementById("import-file-picker");
    if (importPicker) {
      importPicker.addEventListener("change", (e) => this.handleImportFile(e));
    }
  },

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toast-text");
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.remove("translate-y-20", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");

    // Clear previous timeout
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove("translate-y-0", "opacity-100");
      toast.classList.add("translate-y-20", "opacity-0");
    }, duration);
  },

  // =========================================================================
  // PWA & SERVICE WORKER
  // =========================================================================

  registerServiceWorker() {
    // Only register service worker if supported and on https/localhost
    if ("serviceWorker" in navigator) {
      // Compatibility with GitHub Pages: base URL might be /ArtVault/ or just /
      // The SW is registered relative to the current path
      const rootPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register(rootPath + "service-worker.js", { scope: rootPath })
          .then((reg) => {
            console.log("Service Worker registered successfully with scope: ", reg.scope);
          })
          .catch((err) => {
            console.warn("Service Worker registration failed: ", err);
          });
      });
    }
  }
};

// Start the application when everything is loaded
window.addEventListener("DOMContentLoaded", () => {
  window.ArtVaultApp.init();
});
