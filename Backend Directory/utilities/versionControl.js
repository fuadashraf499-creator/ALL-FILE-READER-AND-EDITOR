const DiffMatchPatch = require('diff-match-patch');
const crypto = require('crypto');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/version-control.log' })
  ]
});

// Initialize diff-match-patch
const dmp = new DiffMatchPatch();

// Configure diff-match-patch settings
dmp.Diff_Timeout = 1.0; // 1 second timeout
dmp.Diff_EditCost = 4; // Cost of an edit operation
dmp.Match_Threshold = 0.8; // Threshold for fuzzy matching
dmp.Match_Distance = 1000; // Distance for fuzzy matching
dmp.Patch_DeleteThreshold = 0.5; // Threshold for patch deletion
dmp.Patch_Margin = 4; // Margin around patches

/**
 * Version Control System for Documents
 * Provides comprehensive version tracking, diffing, and history management
 */
class VersionControl {
  constructor() {
    this.versions = new Map(); // documentId -> versions array
    this.branches = new Map(); // documentId -> branches map
    this.tags = new Map(); // documentId -> tags map
    this.locks = new Map(); // documentId -> lock info
  }

  /**
   * Initialize version control for a document
   * @param {string} documentId - Document identifier
   * @param {string} initialContent - Initial document content
   * @param {Object} metadata - Document metadata
   * @returns {Object} Initial version info
   */
  initializeDocument(documentId, initialContent = '', metadata = {}) {
    const initialVersion = {
      id: this.generateVersionId(),
      documentId,
      version: 1,
      content: initialContent,
      contentHash: this.generateContentHash(initialContent),
      author: metadata.author || 'system',
      authorId: metadata.authorId || null,
      message: metadata.message || 'Initial version',
      timestamp: new Date(),
      parentVersion: null,
      branch: 'main',
      size: Buffer.byteLength(initialContent, 'utf8'),
      changes: {
        additions: initialContent.length,
        deletions: 0,
        modifications: 0
      },
      metadata: {
        ...metadata,
        type: 'initial'
      }
    };

    // Initialize document version history
    this.versions.set(documentId, [initialVersion]);
    
    // Initialize branches
    this.branches.set(documentId, {
      main: {
        name: 'main',
        head: initialVersion.id,
        createdAt: new Date(),
        createdBy: metadata.authorId || 'system',
        protected: true
      }
    });

    // Initialize tags
    this.tags.set(documentId, new Map());

    logger.info('Document version control initialized', {
      documentId,
      versionId: initialVersion.id,
      author: initialVersion.author,
      contentLength: initialContent.length
    });

    return initialVersion;
  }

  /**
   * Create a new version of a document
   * @param {string} documentId - Document identifier
   * @param {string} newContent - New document content
   * @param {Object} metadata - Version metadata
   * @returns {Object} New version info with diff
   */
  createVersion(documentId, newContent, metadata = {}) {
    const versions = this.versions.get(documentId);
    if (!versions || versions.length === 0) {
      throw new Error('Document not initialized for version control');
    }

    const currentBranch = metadata.branch || 'main';
    const branches = this.branches.get(documentId);
    
    if (!branches[currentBranch]) {
      throw new Error(`Branch '${currentBranch}' does not exist`);
    }

    // Get the latest version on the current branch
    const latestVersion = this.getLatestVersion(documentId, currentBranch);
    const oldContent = latestVersion.content;

    // Generate diff
    const diff = this.generateDiff(oldContent, newContent);
    const patches = this.generatePatches(oldContent, newContent);
    
    // Calculate changes
    const changes = this.calculateChanges(diff);
    
    // Create new version
    const newVersion = {
      id: this.generateVersionId(),
      documentId,
      version: latestVersion.version + 1,
      content: newContent,
      contentHash: this.generateContentHash(newContent),
      author: metadata.author || 'unknown',
      authorId: metadata.authorId || null,
      message: metadata.message || `Version ${latestVersion.version + 1}`,
      timestamp: new Date(),
      parentVersion: latestVersion.id,
      branch: currentBranch,
      size: Buffer.byteLength(newContent, 'utf8'),
      changes,
      diff: {
        raw: diff,
        patches: patches,
        html: this.diffToHtml(diff),
        stats: {
          insertions: changes.additions,
          deletions: changes.deletions,
          modifications: changes.modifications,
          unchanged: this.countUnchangedChars(diff)
        }
      },
      metadata: {
        ...metadata,
        type: 'update',
        diffSize: JSON.stringify(diff).length
      }
    };

    // Add to versions array
    versions.push(newVersion);
    
    // Update branch head
    branches[currentBranch].head = newVersion.id;
    branches[currentBranch].updatedAt = new Date();

    logger.info('New document version created', {
      documentId,
      versionId: newVersion.id,
      version: newVersion.version,
      author: newVersion.author,
      branch: currentBranch,
      changes: newVersion.changes,
      contentLength: newContent.length
    });

    return newVersion;
  }

  /**
   * Get version history for a document
   * @param {string} documentId - Document identifier
   * @param {Object} options - Query options
   * @returns {Array} Version history
   */
  getVersionHistory(documentId, options = {}) {
    const versions = this.versions.get(documentId) || [];
    const {
      branch,
      author,
      limit,
      offset = 0,
      includeContent = false,
      includeDiff = false,
      since,
      until
    } = options;

    let filteredVersions = [...versions];

    // Filter by branch
    if (branch) {
      filteredVersions = filteredVersions.filter(v => v.branch === branch);
    }

    // Filter by author
    if (author) {
      filteredVersions = filteredVersions.filter(v => 
        v.author === author || v.authorId === author
      );
    }

    // Filter by date range
    if (since) {
      const sinceDate = new Date(since);
      filteredVersions = filteredVersions.filter(v => v.timestamp >= sinceDate);
    }

    if (until) {
      const untilDate = new Date(until);
      filteredVersions = filteredVersions.filter(v => v.timestamp <= untilDate);
    }

    // Sort by timestamp (newest first)
    filteredVersions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    if (limit) {
      filteredVersions = filteredVersions.slice(offset, offset + limit);
    }

    // Remove content and diff if not requested
    return filteredVersions.map(version => {
      const versionCopy = { ...version };
      
      if (!includeContent) {
        delete versionCopy.content;
      }
      
      if (!includeDiff) {
        delete versionCopy.diff;
      }
      
      return versionCopy;
    });
  }

  /**
   * Get a specific version of a document
   * @param {string} documentId - Document identifier
   * @param {string} versionId - Version identifier
   * @returns {Object|null} Version object
   */
  getVersion(documentId, versionId) {
    const versions = this.versions.get(documentId) || [];
    return versions.find(v => v.id === versionId) || null;
  }

  /**
   * Get the latest version of a document
   * @param {string} documentId - Document identifier
   * @param {string} branch - Branch name (default: 'main')
   * @returns {Object|null} Latest version
   */
  getLatestVersion(documentId, branch = 'main') {
    const versions = this.versions.get(documentId) || [];
    const branchVersions = versions.filter(v => v.branch === branch);
    
    if (branchVersions.length === 0) return null;
    
    return branchVersions.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
  }

  /**
   * Compare two versions of a document
   * @param {string} documentId - Document identifier
   * @param {string} fromVersionId - Source version ID
   * @param {string} toVersionId - Target version ID
   * @returns {Object} Comparison result
   */
  compareVersions(documentId, fromVersionId, toVersionId) {
    const fromVersion = this.getVersion(documentId, fromVersionId);
    const toVersion = this.getVersion(documentId, toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('One or both versions not found');
    }

    const diff = this.generateDiff(fromVersion.content, toVersion.content);
    const changes = this.calculateChanges(diff);

    return {
      from: {
        id: fromVersion.id,
        version: fromVersion.version,
        timestamp: fromVersion.timestamp,
        author: fromVersion.author
      },
      to: {
        id: toVersion.id,
        version: toVersion.version,
        timestamp: toVersion.timestamp,
        author: toVersion.author
      },
      diff: {
        raw: diff,
        html: this.diffToHtml(diff),
        patches: this.generatePatches(fromVersion.content, toVersion.content)
      },
      changes,
      summary: {
        versionsApart: Math.abs(toVersion.version - fromVersion.version),
        timespan: Math.abs(toVersion.timestamp - fromVersion.timestamp),
        sizeChange: toVersion.size - fromVersion.size
      }
    };
  }

  /**
   * Revert document to a previous version
   * @param {string} documentId - Document identifier
   * @param {string} targetVersionId - Version to revert to
   * @param {Object} metadata - Revert metadata
   * @returns {Object} New version created by revert
   */
  revertToVersion(documentId, targetVersionId, metadata = {}) {
    const targetVersion = this.getVersion(documentId, targetVersionId);
    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    const revertMetadata = {
      ...metadata,
      message: metadata.message || `Revert to version ${targetVersion.version}`,
      type: 'revert',
      revertedFrom: targetVersionId
    };

    return this.createVersion(documentId, targetVersion.content, revertMetadata);
  }

  /**
   * Create a new branch
   * @param {string} documentId - Document identifier
   * @param {string} branchName - New branch name
   * @param {string} fromVersionId - Version to branch from
   * @param {Object} metadata - Branch metadata
   * @returns {Object} Branch info
   */
  createBranch(documentId, branchName, fromVersionId, metadata = {}) {
    const branches = this.branches.get(documentId);
    if (!branches) {
      throw new Error('Document not initialized for version control');
    }

    if (branches[branchName]) {
      throw new Error(`Branch '${branchName}' already exists`);
    }

    const fromVersion = this.getVersion(documentId, fromVersionId);
    if (!fromVersion) {
      throw new Error('Source version not found');
    }

    const newBranch = {
      name: branchName,
      head: fromVersionId,
      createdAt: new Date(),
      createdBy: metadata.authorId || 'unknown',
      createdFrom: fromVersionId,
      protected: metadata.protected || false,
      description: metadata.description || ''
    };

    branches[branchName] = newBranch;

    logger.info('New branch created', {
      documentId,
      branchName,
      fromVersion: fromVersion.version,
      createdBy: newBranch.createdBy
    });

    return newBranch;
  }

  /**
   * Merge branches
   * @param {string} documentId - Document identifier
   * @param {string} sourceBranch - Source branch name
   * @param {string} targetBranch - Target branch name
   * @param {Object} metadata - Merge metadata
   * @returns {Object} Merge result
   */
  mergeBranches(documentId, sourceBranch, targetBranch, metadata = {}) {
    const branches = this.branches.get(documentId);
    if (!branches || !branches[sourceBranch] || !branches[targetBranch]) {
      throw new Error('One or both branches not found');
    }

    const sourceVersion = this.getLatestVersion(documentId, sourceBranch);
    const targetVersion = this.getLatestVersion(documentId, targetBranch);

    if (!sourceVersion || !targetVersion) {
      throw new Error('Could not find latest versions for branches');
    }

    // Simple merge strategy: create new version on target branch with source content
    const mergeMetadata = {
      ...metadata,
      message: metadata.message || `Merge ${sourceBranch} into ${targetBranch}`,
      type: 'merge',
      sourceBranch,
      targetBranch,
      branch: targetBranch
    };

    const mergeVersion = this.createVersion(documentId, sourceVersion.content, mergeMetadata);

    logger.info('Branches merged', {
      documentId,
      sourceBranch,
      targetBranch,
      mergeVersionId: mergeVersion.id
    });

    return {
      mergeVersion,
      conflicts: [], // TODO: Implement conflict detection
      success: true
    };
  }

  /**
   * Create a tag for a version
   * @param {string} documentId - Document identifier
   * @param {string} versionId - Version to tag
   * @param {string} tagName - Tag name
   * @param {Object} metadata - Tag metadata
   * @returns {Object} Tag info
   */
  createTag(documentId, versionId, tagName, metadata = {}) {
    const tags = this.tags.get(documentId);
    if (!tags) {
      throw new Error('Document not initialized for version control');
    }

    if (tags.has(tagName)) {
      throw new Error(`Tag '${tagName}' already exists`);
    }

    const version = this.getVersion(documentId, versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const tag = {
      name: tagName,
      versionId,
      version: version.version,
      createdAt: new Date(),
      createdBy: metadata.authorId || 'unknown',
      message: metadata.message || '',
      type: metadata.type || 'manual'
    };

    tags.set(tagName, tag);

    logger.info('Tag created', {
      documentId,
      tagName,
      versionId,
      version: version.version
    });

    return tag;
  }

  // Helper methods

  generateVersionId() {
    return `v_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateContentHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  generateDiff(oldText, newText) {
    return dmp.diff_main(oldText, newText);
  }

  generatePatches(oldText, newText) {
    const diff = this.generateDiff(oldText, newText);
    return dmp.patch_make(oldText, diff);
  }

  applyPatches(text, patches) {
    const results = dmp.patch_apply(patches, text);
    return {
      text: results[0],
      success: results[1].every(Boolean)
    };
  }

  calculateChanges(diff) {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    diff.forEach(([operation, text]) => {
      const length = text.length;
      
      switch (operation) {
        case 1: // Insert
          additions += length;
          break;
        case -1: // Delete
          deletions += length;
          break;
        case 0: // Equal
          // No change
          break;
      }
    });

    // Count modifications as the minimum of additions and deletions
    modifications = Math.min(additions, deletions);
    additions -= modifications;
    deletions -= modifications;

    return { additions, deletions, modifications };
  }

  countUnchangedChars(diff) {
    return diff
      .filter(([operation]) => operation === 0)
      .reduce((count, [, text]) => count + text.length, 0);
  }

  diffToHtml(diff) {
    return dmp.diff_prettyHtml(diff);
  }

  // Statistics and analytics

  getDocumentStats(documentId) {
    const versions = this.versions.get(documentId) || [];
    const branches = this.branches.get(documentId) || {};
    const tags = this.tags.get(documentId) || new Map();

    if (versions.length === 0) {
      return null;
    }

    const authors = [...new Set(versions.map(v => v.author))];
    const totalChanges = versions.reduce((total, v) => ({
      additions: total.additions + (v.changes?.additions || 0),
      deletions: total.deletions + (v.changes?.deletions || 0),
      modifications: total.modifications + (v.changes?.modifications || 0)
    }), { additions: 0, deletions: 0, modifications: 0 });

    return {
      documentId,
      totalVersions: versions.length,
      totalBranches: Object.keys(branches).length,
      totalTags: tags.size,
      authors: authors.length,
      authorList: authors,
      firstVersion: versions[0],
      latestVersion: versions[versions.length - 1],
      totalChanges,
      averageVersionSize: versions.reduce((sum, v) => sum + v.size, 0) / versions.length,
      createdAt: versions[0]?.timestamp,
      lastModified: versions[versions.length - 1]?.timestamp
    };
  }
}

// Export the version control system
module.exports = {
  VersionControl,
  DiffMatchPatch: dmp
};