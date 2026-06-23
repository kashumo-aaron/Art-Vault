// js/database.js
// ArtVault - IndexedDB Database Management

window.ArtVaultDB = {
  db: null,
  dbName: "ArtVault",
  dbVersion: 1,

  /**
   * Initializes the IndexedDB database.
   * Creates stores for projects, folders, images, and metadata.
   */
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error("Database initialization failed:", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("Database initialized successfully.");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Projects Store
        if (!db.objectStoreNames.contains("projects")) {
          const projectStore = db.createObjectStore("projects", { keyPath: "id" });
          projectStore.createIndex("isDeleted", "isDeleted", { unique: false });
          projectStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // 2. Folders Store
        if (!db.objectStoreNames.contains("folders")) {
          const folderStore = db.createObjectStore("folders", { keyPath: "id" });
          folderStore.createIndex("projectId", "projectId", { unique: false });
          folderStore.createIndex("parentId", "parentId", { unique: false });
          folderStore.createIndex("isDeleted", "isDeleted", { unique: false });
        }

        // 3. Images Store
        if (!db.objectStoreNames.contains("images")) {
          const imageStore = db.createObjectStore("images", { keyPath: "id" });
          imageStore.createIndex("projectId", "projectId", { unique: false });
          imageStore.createIndex("folderId", "folderId", { unique: false });
          imageStore.createIndex("isDeleted", "isDeleted", { unique: false });
        }

        // 4. Metadata Store (Settings, Dashboard stats, etc.)
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "key" });
        }
      };
    });
  },

  /**
   * Helper to execute a read-write or read-only transaction.
   */
  _transaction(storeNames, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized. Call init() first."));
        return;
      }
      const transaction = this.db.transaction(storeNames, mode);
      const stores = {};
      
      if (Array.isArray(storeNames)) {
        storeNames.forEach(name => {
          stores[name] = transaction.objectStore(name);
        });
      } else {
        stores[storeNames] = transaction.objectStore(storeNames);
      }

      let result;
      try {
        result = callback(stores, transaction);
      } catch (err) {
        reject(err);
        return;
      }

      transaction.oncomplete = () => {
        resolve(result);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  },

  // =========================================================================
  // PROJECTS CRUD
  // =========================================================================

  getAllProjects() {
    return this._transaction("projects", "readonly", (stores) => {
      return new Promise((resolve) => {
        const request = stores.projects.getAll();
        request.onsuccess = () => {
          // Sort by updatedAt descending
          const projects = request.result || [];
          projects.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(projects);
        };
      });
    });
  },

  getProject(id) {
    return this._transaction("projects", "readonly", (stores) => {
      return new Promise((resolve) => {
        const request = stores.projects.get(id);
        request.onsuccess = () => resolve(request.result || null);
      });
    });
  },

  saveProject(project) {
    return this._transaction("projects", "readwrite", (stores) => {
      project.updatedAt = Date.now();
      if (project.isDeleted === undefined) project.isDeleted = false;
      stores.projects.put(project);
      return project;
    });
  },

  // Soft delete or restore project
  setProjectDeleteStatus(id, isDeleted) {
    return this._transaction("projects", "readwrite", (stores) => {
      return new Promise((resolve, reject) => {
        const getReq = stores.projects.get(id);
        getReq.onsuccess = () => {
          const project = getReq.result;
          if (project) {
            project.isDeleted = isDeleted;
            project.updatedAt = Date.now();
            stores.projects.put(project);
            resolve(project);
          } else {
            reject(new Error("Project not found"));
          }
        };
      });
    });
  },

  deleteProjectPermanently(id) {
    return this._transaction(["projects", "folders", "images"], "readwrite", (stores) => {
      // 1. Delete project itself
      stores.projects.delete(id);
      
      // 2. Delete all folders associated with this project
      const folderIndex = stores.folders.index("projectId");
      const folderKeyRange = IDBKeyRange.only(id);
      folderIndex.openCursor(folderKeyRange).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          stores.folders.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // 3. Delete all images associated with this project
      const imageIndex = stores.images.index("projectId");
      const imageKeyRange = IDBKeyRange.only(id);
      imageIndex.openCursor(imageKeyRange).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          stores.images.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    });
  },

  // =========================================================================
  // FOLDERS CRUD
  // =========================================================================

  getFoldersInProject(projectId) {
    return this._transaction("folders", "readonly", (stores) => {
      return new Promise((resolve) => {
        const index = stores.folders.index("projectId");
        const request = index.getAll(IDBKeyRange.only(projectId));
        request.onsuccess = () => {
          const folders = request.result || [];
          resolve(folders);
        };
      });
    });
  },

  getFolder(id) {
    return this._transaction("folders", "readonly", (stores) => {
      return new Promise((resolve) => {
        const request = stores.folders.get(id);
        request.onsuccess = () => resolve(request.result || null);
      });
    });
  },

  saveFolder(folder) {
    return this._transaction("folders", "readwrite", (stores) => {
      if (folder.isDeleted === undefined) folder.isDeleted = false;
      if (!folder.createdAt) folder.createdAt = Date.now();
      stores.folders.put(folder);
      return folder;
    });
  },

  setFolderDeleteStatus(id, isDeleted) {
    return this._transaction("folders", "readwrite", (stores) => {
      return new Promise((resolve, reject) => {
        const getReq = stores.folders.get(id);
        getReq.onsuccess = () => {
          const folder = getReq.result;
          if (folder) {
            folder.isDeleted = isDeleted;
            stores.folders.put(folder);
            resolve(folder);
          } else {
            reject(new Error("Folder not found"));
          }
        };
      });
    });
  },

  deleteFolderPermanently(id) {
    return this._transaction(["folders", "images"], "readwrite", (stores) => {
      // Helper to recursively collect and delete child folders & images
      const deleteRecursive = (folderId) => {
        // Delete folder itself
        stores.folders.delete(folderId);

        // Delete images in this folder
        const imgIndex = stores.images.index("folderId");
        imgIndex.openCursor(IDBKeyRange.only(folderId)).onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            stores.images.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        // Find subfolders and delete them
        const subIndex = stores.folders.index("parentId");
        subIndex.openCursor(IDBKeyRange.only(folderId)).onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            deleteRecursive(cursor.primaryKey);
            cursor.continue();
          }
        };
      };

      deleteRecursive(id);
    });
  },

  // =========================================================================
  // IMAGES CRUD
  // =========================================================================

  getImagesInProject(projectId) {
    return this._transaction("images", "readonly", (stores) => {
      return new Promise((resolve) => {
        const index = stores.images.index("projectId");
        const request = index.getAll(IDBKeyRange.only(projectId));
        request.onsuccess = () => resolve(request.result || []);
      });
    });
  },

  getImage(id) {
    return this._transaction("images", "readonly", (stores) => {
      return new Promise((resolve) => {
        const request = stores.images.get(id);
        request.onsuccess = () => resolve(request.result || null);
      });
    });
  },

  saveImage(image) {
    return this._transaction("images", "readwrite", (stores) => {
      if (image.isDeleted === undefined) image.isDeleted = false;
      if (!image.createdAt) image.createdAt = Date.now();
      stores.images.put(image);
      return image;
    });
  },

  setImageDeleteStatus(id, isDeleted) {
    return this._transaction("images", "readwrite", (stores) => {
      return new Promise((resolve, reject) => {
        const getReq = stores.images.get(id);
        getReq.onsuccess = () => {
          const image = getReq.result;
          if (image) {
            image.isDeleted = isDeleted;
            stores.images.put(image);
            resolve(image);
          } else {
            reject(new Error("Image not found"));
          }
        };
      });
    });
  },

  deleteImagePermanently(id) {
    return this._transaction("images", "readwrite", (stores) => {
      stores.images.delete(id);
    });
  },

  // =========================================================================
  // METADATA & STATS
  // =========================================================================

  getMetadata(key) {
    return this._transaction("metadata", "readonly", (stores) => {
      return new Promise((resolve) => {
        const request = stores.metadata.get(key);
        request.onsuccess = () => {
          resolve(request.result ? request.result.value : null);
        };
      });
    });
  },

  setMetadata(key, value) {
    return this._transaction("metadata", "readwrite", (stores) => {
      stores.metadata.put({ key, value });
      return value;
    });
  },

  /**
   * Computes dashboard statistics.
   */
  async getDashboardStats() {
    const projects = await this.getAllProjects();
    const activeProjects = projects.filter(p => !p.isDeleted);
    
    // Get all folders and images
    let totalFolders = 0;
    let totalImages = 0;
    let lastImageAdded = null;
    
    // We can count them by opening transactions on folders and images
    const foldersCount = await this._transaction("folders", "readonly", (stores) => {
      return new Promise((resolve) => {
        const req = stores.folders.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          resolve(list.filter(f => !f.isDeleted).length);
        };
      });
    });

    const imagesData = await this._transaction("images", "readonly", (stores) => {
      return new Promise((resolve) => {
        const req = stores.images.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          const activeImages = list.filter(img => !img.isDeleted);
          
          // Find the last image added
          let latest = null;
          if (activeImages.length > 0) {
            activeImages.sort((a, b) => b.createdAt - a.createdAt);
            latest = activeImages[0];
          }
          resolve({ count: activeImages.length, latest });
        };
      });
    });

    const lastOpenedProjectId = await this.getMetadata("lastOpenedProject");
    let lastOpenedProject = null;
    if (lastOpenedProjectId) {
      lastOpenedProject = await this.getProject(lastOpenedProjectId);
      if (lastOpenedProject && lastOpenedProject.isDeleted) {
        lastOpenedProject = null;
      }
    }

    return {
      projectsCount: activeProjects.length,
      foldersCount,
      imagesCount: imagesData.count,
      lastOpenedProject,
      lastImageAdded: imagesData.latest
    };
  },

  // =========================================================================
  // TRASH LIST
  // =========================================================================

  /**
   * Retrieves all directly deleted items (projects, folders, images).
   * For folders and images, we only return them if their parent folder/project is not also deleted.
   */
  async getTrashItems() {
    const allProjects = await this.getAllProjects();
    
    // Get all folders
    const allFolders = await this._transaction("folders", "readonly", (stores) => {
      return new Promise((resolve) => {
        const req = stores.folders.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    });

    // Get all images
    const allImages = await this._transaction("images", "readonly", (stores) => {
      return new Promise((resolve) => {
        const req = stores.images.getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    });

    // Create maps for quick lookup
    const projectMap = new Map(allProjects.map(p => [p.id, p]));
    const folderMap = new Map(allFolders.map(f => [f.id, f]));

    // Check if an item has a deleted ancestor
    const hasDeletedAncestor = (item, type) => {
      if (type === "project") return false; // Projects have no parent
      
      const project = projectMap.get(item.projectId);
      if (project && project.isDeleted) return true; // Parent project is deleted
      
      if (type === "folder") {
        let parentId = item.parentId;
        while (parentId) {
          const parent = folderMap.get(parentId);
          if (!parent) break;
          if (parent.isDeleted) return true;
          parentId = parent.parentId;
        }
      } else if (type === "image") {
        let folderId = item.folderId;
        if (folderId) {
          const directFolder = folderMap.get(folderId);
          if (directFolder && directFolder.isDeleted) return true;
          
          let parentId = directFolder ? directFolder.parentId : null;
          while (parentId) {
            const parent = folderMap.get(parentId);
            if (!parent) break;
            if (parent.isDeleted) return true;
            parentId = parent.parentId;
          }
        }
      }
      return false;
    };

    // Filter directly deleted items
    const deletedProjects = allProjects.filter(p => p.isDeleted);
    
    const deletedFolders = allFolders.filter(f => {
      // Must be marked deleted, and must NOT have an ancestor that is also marked deleted
      if (!f.isDeleted) return false;
      
      // Check parent project
      const proj = projectMap.get(f.projectId);
      if (proj && proj.isDeleted) return false; // It's part of a deleted project
      
      // Check parent folder
      if (f.parentId) {
        let parentId = f.parentId;
        while (parentId) {
          const parent = folderMap.get(parentId);
          if (parent && parent.isDeleted) return false; // It's part of a deleted folder
          parentId = parent ? parent.parentId : null;
        }
      }
      return true;
    });

    const deletedImages = allImages.filter(img => {
      if (!img.isDeleted) return false;
      
      // Check project
      const proj = projectMap.get(img.projectId);
      if (proj && proj.isDeleted) return false;
      
      // Check folder
      if (img.folderId) {
        let folderId = img.folderId;
        while (folderId) {
          const parent = folderMap.get(folderId);
          if (parent && parent.isDeleted) return false;
          folderId = parent ? parent.parentId : null;
        }
      }
      return true;
    });

    return {
      projects: deletedProjects,
      folders: deletedFolders,
      images: deletedImages
    };
  },

  // =========================================================================
  // IMPORT & EXPORT
  // =========================================================================

  /**
   * Exports the entire database as a JSON-serializable object.
   */
  async exportAllData() {
    const projects = await this._transaction("projects", "readonly", (stores) => {
      return new Promise((resolve) => {
        stores.projects.getAll().onsuccess = (e) => resolve(e.target.result || []);
      });
    });

    const folders = await this._transaction("folders", "readonly", (stores) => {
      return new Promise((resolve) => {
        stores.folders.getAll().onsuccess = (e) => resolve(e.target.result || []);
      });
    });

    const images = await this._transaction("images", "readonly", (stores) => {
      return new Promise((resolve) => {
        stores.images.getAll().onsuccess = (e) => resolve(e.target.result || []);
      });
    });

    const metadata = await this._transaction("metadata", "readonly", (stores) => {
      return new Promise((resolve) => {
        stores.metadata.getAll().onsuccess = (e) => resolve(e.target.result || []);
      });
    });

    return {
      version: 1,
      appName: "ArtVault",
      exportedAt: Date.now(),
      projects,
      folders,
      images,
      metadata
    };
  },

  /**
   * Clears the database and imports a full backup.
   */
  async importAllData(backupData) {
    if (!backupData || backupData.appName !== "ArtVault") {
      throw new Error("Format de sauvegarde invalide.");
    }

    return this._transaction(["projects", "folders", "images", "metadata"], "readwrite", (stores) => {
      // 1. Clear everything
      stores.projects.clear();
      stores.folders.clear();
      stores.images.clear();
      stores.metadata.clear();

      // 2. Populate
      if (Array.isArray(backupData.projects)) {
        backupData.projects.forEach(p => stores.projects.put(p));
      }
      if (Array.isArray(backupData.folders)) {
        backupData.folders.forEach(f => stores.folders.put(f));
      }
      if (Array.isArray(backupData.images)) {
        backupData.images.forEach(img => stores.images.put(img));
      }
      if (Array.isArray(backupData.metadata)) {
        backupData.metadata.forEach(meta => stores.metadata.put(meta));
      }
      
      console.log("Database imported successfully.");
      return true;
    });
  }
};
