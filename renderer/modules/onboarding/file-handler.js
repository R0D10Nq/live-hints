/**
 * Onboarding File Handler - загрузка и обработка файлов
 */

import { logger } from '../utils/logger.js';

export class FileHandler {
  constructor(app) {
    this.app = app;
  }

  setup(type) {
    const elements = this.app.elements;
    const uploadArea = elements[`${type}UploadArea`];
    const fileInput = elements[`${type}FileInput`];
    const btnPaste = elements[`btnPaste${this.capitalize(type)}`];
    const pasteArea = elements[`${type}PasteArea`];
    const textArea = elements[`${type}Text`];
    const btnRemove = elements[`btnRemove${this.capitalize(type)}`];

    uploadArea?.addEventListener('click', () => fileInput?.click());

    uploadArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea?.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFileSelect(file, type);
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileSelect(file, type);
    });

    btnPaste?.addEventListener('click', () => {
      pasteArea?.classList.toggle('hidden');
      uploadArea?.classList.toggle('hidden', !pasteArea?.classList.contains('hidden'));
    });

    textArea?.addEventListener('input', (e) => {
      this.app.settings[`${type}Content`] = e.target.value || null;
    });

    btnRemove?.addEventListener('click', () => this.removeFile(type));
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async handleFileSelect(file, type) {
    const validExtensions = type === 'resume' ? ['.pdf', '.txt', '.docx'] : ['.pdf', '.txt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      this.app.showError(`Поддерживаемые форматы: ${validExtensions.join(', ')}`);
      return;
    }

    try {
      let content = '';

      if (extension === '.txt') {
        content = await this.readTextFile(file);
      } else if (extension === '.pdf') {
        if (window.electronAPI?.parseFile) {
          content = await window.electronAPI.parseFile(file.path, 'pdf');
        } else {
          this.app.showError('Парсинг PDF недоступен');
          return;
        }
      } else if (extension === '.docx') {
        if (window.electronAPI?.parseFile) {
          content = await window.electronAPI.parseFile(file.path, 'docx');
        } else {
          this.app.showError('Парсинг DOCX недоступен');
          return;
        }
      }

      this.app.settings[`${type}Content`] = content;
      this.app.settings[`${type}FileName`] = file.name;

      const uploadArea = this.app.elements[`${type}UploadArea`];
      const fileInfo = this.app.elements[`${type}FileInfo`];
      const fileName = this.app.elements[`${type}FileName`];
      const fileSize = this.app.elements[`${type}FileSize`];

      uploadArea?.classList.add('hidden');
      fileInfo?.classList.remove('hidden');
      if (fileName) fileName.textContent = file.name;
      if (fileSize) fileSize.textContent = this.formatFileSize(file.size);

      this.app.updateUI();
    } catch (err) {
      logger.error('FileHandler', 'Ошибка чтения файла:', err);
      this.app.showError('Ошибка чтения файла: ' + err.message);
    }
  }

  readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'utf-8');
    });
  }

  removeFile(type) {
    this.app.settings[`${type}Content`] = null;
    this.app.settings[`${type}FileName`] = null;

    const uploadArea = this.app.elements[`${type}UploadArea`];
    const fileInfo = this.app.elements[`${type}FileInfo`];
    const fileInput = this.app.elements[`${type}FileInput`];
    const pasteArea = this.app.elements[`${type}PasteArea`];

    uploadArea?.classList.remove('hidden');
    fileInfo?.classList.add('hidden');
    pasteArea?.classList.add('hidden');
    if (fileInput) fileInput.value = '';

    this.app.updateUI();
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
