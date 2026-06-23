// js/folders.js
// ArtVault - Folder Navigation and Management

window.ArtVaultFolders = {
  /**
   * Creates a new subfolder in the current project and folder.
   */
  async createFolder(projectId, parentId, name) {
    if (!name.trim()) throw new Error("Le nom du dossier est requis.");

    const folderId = "fold_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    const folder = {
      id: folderId,
      projectId: projectId,
      parentId: parentId || null, // null means root of project
      name: name.trim(),
      isDeleted: false,
      createdAt: Date.now()
    };

    await window.ArtVaultDB.saveFolder(folder);
    return folder;
  },

  /**
   * Renames a folder.
   */
  async renameFolder(folderId, newName) {
    if (!newName.trim()) throw new Error("Le nom du dossier ne peut pas être vide.");

    const folder = await window.ArtVaultDB.getFolder(folderId);
    if (!folder) throw new Error("Dossier introuvable.");

    folder.name = newName.trim();
    await window.ArtVaultDB.saveFolder(folder);
    return folder;
  },

  /**
   * Soft deletes a folder (moves it and its contents to trash).
   * Note: The children are not individually marked as deleted, which preserves
   * their status when the parent folder is restored!
   */
  async trashFolder(folderId) {
    await window.ArtVaultDB.setFolderDeleteStatus(folderId, true);
  },

  /**
   * Restores a folder from trash.
   */
  async restoreFolder(folderId) {
    await window.ArtVaultDB.setFolderDeleteStatus(folderId, false);
  },

  /**
   * Helper to check if folder A is an ancestor of folder B.
   * Used to prevent moving a folder into itself or its own subfolders.
   */
  async isAncestor(folderIdA, folderIdB) {
    if (!folderIdB) return false;
    if (folderIdA === folderIdB) return true;

    let currentId = folderIdB;
    while (currentId) {
      const folder = await window.ArtVaultDB.getFolder(currentId);
      if (!folder) break;
      if (folder.parentId === folderIdA) return true;
      currentId = folder.parentId;
    }
    return false;
  },

  /**
   * Moves a folder to a new parent.
   */
  async moveFolder(folderId, newParentId) {
    // 1. Check if trying to move to itself
    if (folderId === newParentId) {
      throw new Error("Impossible de déplacer un dossier dans lui-même.");
    }

    // 2. Check if trying to move into its own subfolder
    if (newParentId) {
      const isLoop = await this.isAncestor(folderId, newParentId);
      if (isLoop) {
        throw new Error("Impossible de déplacer un dossier dans un de ses sous-dossiers.");
      }
    }

    const folder = await window.ArtVaultDB.getFolder(folderId);
    if (!folder) throw new Error("Dossier introuvable.");

    folder.parentId = newParentId || null;
    await window.ArtVaultDB.saveFolder(folder);
    return folder;
  },

  /**
   * Renders the breadcrumb navigation.
   * Format: Accueil > Project Name > Folder 1 > Folder 2
   */
  async renderBreadcrumbs(project, currentFolderId) {
    const breadcrumbContainer = document.getElementById("explorer-breadcrumb");
    if (!breadcrumbContainer) return;

    breadcrumbContainer.innerHTML = "";

    // 1. Home Item
    const homeItem = document.createElement("li");
    homeItem.className = "flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400 cursor-pointer transition-colors";
    homeItem.onclick = () => window.ArtVaultApp.navigateTo("home");
    homeItem.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      Accueil
    `;
    breadcrumbContainer.appendChild(homeItem);

    if (!project) return;

    // Divider
    const divider1 = this.createBreadcrumbDivider();
    breadcrumbContainer.appendChild(divider1);

    // 2. Project Item (Root of Explorer)
    const projectItem = document.createElement("li");
    projectItem.className = "flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400 cursor-pointer transition-colors font-medium";
    projectItem.onclick = () => window.ArtVaultApp.openProject(project.id);
    
    // Truncate long project names in breadcrumb on mobile
    const projName = project.name.length > 20 ? project.name.substring(0, 18) + "..." : project.name;
    projectItem.innerHTML = `
      <span title="${project.name}">${projName}</span>
    `;
    breadcrumbContainer.appendChild(projectItem);

    if (!currentFolderId) {
      // We are at project root, make it active
      projectItem.className = "flex items-center text-indigo-600 dark:text-sky-400 font-semibold";
      projectItem.onclick = null; // already here
      return;
    }

    // 3. Build path of folders from current up to root
    const path = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = await window.ArtVaultDB.getFolder(currentId);
      if (!folder) break;
      path.unshift(folder); // Add to beginning of array to get top-down order
      currentId = folder.parentId;
    }

    // Render folder path items
    path.forEach((folder, index) => {
      const divider = this.createBreadcrumbDivider();
      breadcrumbContainer.appendChild(divider);

      const folderItem = document.createElement("li");
      const isLast = index === path.length - 1;
      
      const fName = folder.name.length > 15 ? folder.name.substring(0, 13) + "..." : folder.name;

      if (isLast) {
        folderItem.className = "flex items-center text-indigo-600 dark:text-sky-400 font-semibold";
        folderItem.innerHTML = `<span title="${folder.name}">${fName}</span>`;
      } else {
        folderItem.className = "flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400 cursor-pointer transition-colors";
        folderItem.onclick = () => window.ArtVaultApp.openFolder(folder.id);
        folderItem.innerHTML = `<span title="${folder.name}">${fName}</span>`;
      }
      breadcrumbContainer.appendChild(folderItem);
    });
  },

  createBreadcrumbDivider() {
    const divider = document.createElement("li");
    divider.className = "text-slate-300 dark:text-slate-600 mx-1.5 flex items-center";
    divider.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    `;
    return divider;
  },

  /**
   * Renders the folders inside the explorer view.
   */
  async renderFoldersList(projectId, currentFolderId, searchTerm = "") {
    const container = document.getElementById("explorer-folders-container");
    if (!container) return;

    container.innerHTML = "";

    // 1. Get all folders for this project
    const allFolders = await window.ArtVaultDB.getFoldersInProject(projectId);
    
    // 2. Filter folders that belong to the current level and are not deleted
    let foldersToShow = allFolders.filter(f => {
      const matchesParent = currentFolderId ? f.parentId === currentFolderId : f.parentId === null;
      const matchesSearch = searchTerm === "" || f.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesParent && !f.isDeleted && matchesSearch;
    });

    if (foldersToShow.length === 0) {
      container.className = "hidden"; // Hide container if empty to avoid empty margins
      return;
    }
    container.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6";

    // 3. Render folders
    for (const folder of foldersToShow) {
      // Get subfolders and images count
      const childFolders = allFolders.filter(f => f.parentId === folder.id && !f.isDeleted);
      const allImages = await window.ArtVaultDB.getImagesInProject(projectId);
      const childImages = allImages.filter(img => img.folderId === folder.id && !img.isDeleted);

      const card = document.createElement("div");
      card.className = "card card-neumorphic-sm p-3.5 flex items-center gap-3 cursor-pointer hover:scale-[1.03] transition-transform group relative";
      card.onclick = () => window.ArtVaultApp.openFolder(folder.id);

      card.innerHTML = `
        <div class="text-amber-500 dark:text-amber-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.5 21a3 3 0 003-3v-7.5a3 3 0 00-3-3h-6.879l-2.707-2.707A1.498 1.498 0 008.879 4.5H4.5A3 3 0 001.5 7.5v10.5a3 3 0 003 3h15z" />
          </svg>
        </div>
        <div class="overflow-hidden pr-6">
          <h4 class="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title="${folder.name}">
            ${folder.name}
          </h4>
          <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            ${childFolders.length} dossiers • ${childImages.length} images
          </p>
        </div>
        
        <!-- Context Menu Button (three dots) -->
        <button class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full transition-opacity z-10" 
                onclick="event.stopPropagation(); window.ArtVaultApp.showFolderContextMenu(event, '${folder.id}', '${folder.name}')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      `;
      container.appendChild(card);
    }
  }
};
