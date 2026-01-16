import { CONFIG } from "../config/config.js";
import { Logger } from "../utils/logger.js";

export class GoogleDriveService {
  constructor() {
    this.SYNC_FILENAME = CONFIG.SYNC.FILENAME;
  }

  // 获取 OAuth Token
  async getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError || !token) {
          Logger.warn("Auth failed:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  // 移除缓存的 Token (用于注销或 Token 过期)
  async removeCachedAuthToken(token) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        resolve();
      });
    });
  }

  // 查找云端备份文件
  async findBackupFile(token) {
    const query = `name = '${this.SYNC_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id, modifiedTime)`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) {
        const errText = await response.text();
        Logger.error(`Google Drive API Error (${response.status}):`, errText);
        
        if (response.status === 401 || response.status === 403) {
            Logger.warn("Token expired or permission denied, removing cached token.");
            await this.removeCachedAuthToken(token);
            // Return specific message if API is not enabled
            if (errText.includes("Google Drive API has not been used")) {
                 throw new Error("请在 Google Cloud Console 中启用 Google Drive API");
            }
        }
        throw new Error(`Find file failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  // 上传/更新文件
  async uploadFile(token, content, fileId = null) {
    const metadata = {
      name: this.SYNC_FILENAME,
      mimeType: 'application/json',
      parents: fileId ? undefined : ['appDataFolder'] // 新文件放入 appDataFolder
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (fileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload failed ${response.status}: ${errText}`);
    }

    return await response.json();
  }

  // 下载文件
  async downloadFile(token, fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
    }

    return await response.json();
  }
}

export const driveService = new GoogleDriveService();
