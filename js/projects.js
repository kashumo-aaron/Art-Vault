// js/projects.js
// ArtVault - Project Management and Auto-folder Creation

window.ArtVaultProjects = {
  // Available project types
  types: [
    "Bande dessinée",
    "Manga",
    "Illustration",
    "Character Design",
    "Concept Art",
    "Environnement",
    "Galerie personnelle",
    "Dessin traditionnel",
    "Autre"
  ],

  // Automatic folder structures based on project type
  autoFolders: {
    "Bande dessinée": [
      "Personnages",
      "Environnements",
      "Armes",
      "Créatures",
      "Costumes",
      "Expressions",
      "Storyboard",
      "Références"
    ],
    "Character Design": [
      "Visages",
      "Expressions",
      "Coiffures",
      "Vêtements",
      "Accessoires",
      "Inspirations"
    ],
    "Environnement": [
      "Architecture",
      "Forêts",
      "Villes",
      "Intérieurs",
      "Paysages",
      "Lumières"
    ]
  },

  /**
   * Generates a beautiful CSS gradient placeholder based on the project name.
   */
  generatePlaceholderCover(name) {
    const colors = [
      ["#3b82f6", "#1e3a8a"], // Blue
      ["#ec4899", "#831843"], // Pink
      ["#10b981", "#064e3b"], // Green
      ["#f59e0b", "#78350f"], // Yellow/Amber
      ["#8b5cf6", "#4c1d95"], // Purple
      ["#ef4444", "#7f1d1d"], // Red
      ["#06b6d4", "#164e63"], // Cyan
      ["#f97316", "#7c2d12"]  // Orange
    ];
    
    // Simple hash function to select colors
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    const selected = colors[index];
    
    // Create an SVG data URL for a gorgeous visual pattern
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${selected[0]}" />
            <stop offset="100%" stop-color="${selected[1]}" />
          </linearGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <rect width="100%" height="100%" fill="url(#grid)"/>
        <circle cx="200" cy="125" r="70" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
        <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" letter-spacing="1">
          ${name.substring(0, 2).toUpperCase()}
        </text>
      </svg>
    `.trim();
    
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  },

  /**
   * Handles creating a new project.
   */
  async createProject(name, description, type, coverFile) {
    if (!name.trim()) throw new Error("Le nom du projet est requis.");
    
    const projectId = "proj_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    
    let coverImage = "";
    if (coverFile) {
      coverImage = await this.fileToDataURL(coverFile);
    } else {
      coverImage = this.generatePlaceholderCover(name);
    }

    const project = {
      id: projectId,
      name: name.trim(),
      description: description.trim(),
      type: type || "Autre",
      coverImage: coverImage,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save project in DB
    await window.ArtVaultDB.saveProject(project);

    // Create automatic folders based on type
    const folderNames = this.autoFolders[project.type] || [];
    for (const folderName of folderNames) {
      const folderId = "fold_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      const folder = {
        id: folderId,
        projectId: projectId,
        parentId: null, // Root level folders
        name: folderName,
        isDeleted: false,
        createdAt: Date.now()
      };
      await window.ArtVaultDB.saveFolder(folder);
    }

    return project;
  },

  /**
   * Helper to convert file to Base64 data URL.
   */
  fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Renders the project list on the screen.
   */
  async renderProjectsList(searchTerm = "") {
    const container = document.getElementById("projects-container");
    if (!container) return;

    container.innerHTML = "";

    // Load projects from database
    const allProjects = await window.ArtVaultDB.getAllProjects();
    // Filter active (non-deleted) projects and by search term
    const activeProjects = allProjects.filter(p => !p.isDeleted && 
      (searchTerm === "" || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.type.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Render "New Project" Card first
    const newProjectCard = document.createElement("div");
    newProjectCard.className = "card card-neumorphic flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:scale-[1.02] transition-transform aspect-[4/3] border border-dashed border-slate-300 dark:border-slate-700 min-h-[220px]";
    newProjectCard.onclick = () => window.ArtVaultApp.openNewProjectModal();
    newProjectCard.innerHTML = `
      <div class="w-16 h-16 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-inner mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <h3 class="font-bold text-lg text-slate-800 dark:text-slate-200">Nouveau Projet</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">Commencez une nouvelle collection artistique</p>
    `;
    container.appendChild(newProjectCard);

    if (activeProjects.length === 0) {
      return;
    }

    // Render all projects
    for (const project of activeProjects) {
      // Count images and folders in this project to display
      const folders = await window.ArtVaultDB.getFoldersInProject(project.id);
      const activeFoldersCount = folders.filter(f => !f.isDeleted).length;
      const images = await window.ArtVaultDB.getImagesInProject(project.id);
      const activeImagesCount = images.filter(img => !img.isDeleted).length;

      const card = document.createElement("div");
      card.className = "card card-neumorphic overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer flex flex-col min-h-[220px]";
      card.onclick = () => window.ArtVaultApp.openProject(project.id);
      
      card.innerHTML = `
        <div class="relative w-100 aspect-[16/10] overflow-hidden bg-slate-200 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <img src="${project.coverImage}" alt="${project.name}" class="w-full h-full object-cover" onerror="this.src='${this.generatePlaceholderCover(project.name)}'">
          <span class="absolute top-3 right-3 px-2 py-1 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-black/40 text-white backdrop-blur-sm">
            ${project.type}
          </span>
        </div>
        <div class="p-4 flex-grow flex flex-col justify-between">
          <div>
            <h3 class="font-bold text-base text-slate-800 dark:text-slate-100 truncate mb-1" title="${project.name}">
              ${project.name}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
              ${project.description || "Aucune description."}
            </p>
          </div>
          <div class="flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/50 pt-2.5">
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              ${activeFoldersCount} dossiers
            </span>
            <span class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ${activeImagesCount} images
            </span>
          </div>
        </div>
      `;
      container.appendChild(card);
    }
  }
};
