import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_FILE = path.resolve(__dirname, '../../.dev-complaints.json');

/**
 * File-backed Development Store for Complaints
 * Persists complaints across server reloads when MongoDB Atlas is not yet configured.
 */
class ComplaintMemoryStore {
  constructor() {
    this.complaints = this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('⚠️ [DevStore] Could not load local storage:', e.message);
    }
    return [];
  }

  saveToFile() {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.complaints, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ [DevStore] Could not persist local storage:', e.message);
    }
  }

  async create(data) {
    const now = new Date().toISOString();
    const doc = {
      _id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      complaintId: data.complaintId,
      category: data.category,
      description: data.description,
      location: data.location || { address: '', latitude: null, longitude: null },
      imageUrl: data.imageUrl || null,
      audioUrl: data.audioUrl || null,
      severity: data.severity || null,
      status: data.status || 'Pending',
      department: data.department || 'Municipal Public Works',
      aiAnalysis: data.aiAnalysis || { analysisStatus: 'Pending' },
      duplicateGroupId: data.duplicateGroupId || null,
      statusHistory: data.statusHistory || [],
      createdAt: now,
      updatedAt: now,
    };
    this.complaints.unshift(doc);
    this.saveToFile();
    return doc;
  }

  async find(filter = {}) {
    let result = [...this.complaints];

    if (filter.category) {
      result = result.filter((c) => c.category === filter.category);
    }
    if (filter.status) {
      result = result.filter((c) => c.status === filter.status);
    }
    if (filter.severity) {
      result = result.filter((c) => c.severity === filter.severity);
    }
    if (filter.$or) {
      const searchTerms = filter.$or;
      result = result.filter((c) => {
        return searchTerms.some((term) => {
          if (term.title && term.title.$regex) {
            return new RegExp(term.title.$regex, 'i').test(c.title || '');
          }
          if (term.description && term.description.$regex) {
            return new RegExp(term.description.$regex, 'i').test(c.description || '');
          }
          if (term.complaintId && term.complaintId.$regex) {
            return new RegExp(term.complaintId.$regex, 'i').test(c.complaintId || '');
          }
          if (term['location.address'] && term['location.address'].$regex) {
            return new RegExp(term['location.address'].$regex, 'i').test(c.location?.address || '');
          }
          return false;
        });
      });
    }

    return result;
  }

  async findOne(filter = {}) {
    if (filter.complaintId) {
      return this.complaints.find((c) => c.complaintId === filter.complaintId) || null;
    }
    if (filter._id) {
      return this.complaints.find((c) => c._id === filter._id) || null;
    }
    if (filter.$or) {
      return (
        this.complaints.find((c) => {
          return filter.$or.some((condition) => {
            if (condition.complaintId) return c.complaintId === condition.complaintId;
            if (condition._id) return c._id === condition._id;
            return false;
          });
        }) || null
      );
    }
    return null;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const index = this.complaints.findIndex((c) => c._id === id || c.complaintId === id);
    if (index === -1) return null;

    const current = this.complaints[index];
    const updated = {
      ...current,
      ...(update.$set || update),
      updatedAt: new Date().toISOString(),
    };

    if (update.$push && update.$push.statusHistory) {
      updated.statusHistory = [...(current.statusHistory || []), update.$push.statusHistory];
    }

    this.complaints[index] = updated;
    this.saveToFile();
    return updated;
  }

  async countDocuments(filter = {}) {
    const list = await this.find(filter);
    return list.length;
  }

  async getStats() {
    const total = this.complaints.length;
    const byStatus = {
      Pending: 0,
      'Under Review': 0,
      'In Progress': 0,
      Resolved: 0,
      Rejected: 0,
    };
    const byCategory = {};
    const bySeverity = { Low: 0, Moderate: 0, High: 0, Critical: 0, Unassigned: 0 };

    this.complaints.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      if (c.severity) {
        bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
      } else {
        bySeverity.Unassigned += 1;
      }
    });

    return {
      total,
      byStatus,
      byCategory,
      bySeverity,
    };
  }
}

export const memoryStore = new ComplaintMemoryStore();
