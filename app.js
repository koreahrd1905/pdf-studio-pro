/**
 * PDF Studio Pro - Core Application Logic
 * Supports Multi-PDF Upload, Page Drag & Drop Sequential Merge,
 * In-Place Title & Text Writing/Editing, 1-Click Page Reordering (Prev/Next/Jump),
 * and Guaranteed 100% Reliable PDF Generation & Direct Download.
 */

// Initialize PDF.js worker (use local file if available, otherwise CDN fallback)
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
}

// Global State
const state = {
  // Array of loaded source files: { id, name, size, arrayBuffer, pdfDoc, pageCount, pages: [...] }
  sourceFiles: [],
  activeFileId: null,
  
  // Selection set of source page numbers: Set of integers (1-based)
  selectedSourcePages: new Set(),
  lastSelectedSourcePage: null,
  
  // Target pages array in current order:
  // Array of { id, sourceFileId, sourceFileName, sourcePageNum, thumbnailDataUrl, width, height, textItems: [] }
  targetPages: [],
  
  // Set of selected target page indexes (0-based) for multi-selection and drag-insert
  selectedTargetPages: new Set(),
  lastSelectedTargetIndex: null,

  // History stack for Undo / Redo
  undoStack: [],
  redoStack: [],

  // Current modal editing context
  editingTargetPageIndex: null,
  activeTextItemId: null,
  activePageDraftTexts: [],

  // Move page modal context
  movingTargetIndex: null,

  // Drag and drop tracking
  draggedSourcePayload: null,
  draggedTargetIndexes: null,
  activeDropInsertPos: null,

  // Last exported PDF blob info
  lastGeneratedBlobUrl: null,
  lastGeneratedFileName: null
};

// DOM References
const DOM = {
  // Header
  headerTargetCount: document.getElementById('headerTargetCount'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  guideBtn: document.getElementById('guideBtn'),

  // Source Panel
  pdfFileInput: document.getElementById('pdfFileInput'),
  sourceDropArea: document.getElementById('sourceDropArea'),
  fileTabsWrapper: document.getElementById('fileTabsWrapper'),
  fileTabs: document.getElementById('fileTabs'),
  sourceSubToolbar: document.getElementById('sourceSubToolbar'),
  activeFileInfo: document.getElementById('activeFileInfo'),
  sourceSelectionCount: document.getElementById('sourceSelectionCount'),
  selectAllPagesBtn: document.getElementById('selectAllPagesBtn'),
  deselectAllPagesBtn: document.getElementById('deselectAllPagesBtn'),
  addSelectedToTargetBtn: document.getElementById('addSelectedToTargetBtn'),
  sourcePageGrid: document.getElementById('sourcePageGrid'),
  sourceEmptyState: document.getElementById('sourceEmptyState'),

  // Target Panel
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  targetSelectionCount: document.getElementById('targetSelectionCount'),
  deselectTargetBtn: document.getElementById('deselectTargetBtn'),
  deleteSelectedTargetBtn: document.getElementById('deleteSelectedTargetBtn'),
  reverseTargetBtn: document.getElementById('reverseTargetBtn'),
  clearTargetBtn: document.getElementById('clearTargetBtn'),
  targetDropZone: document.getElementById('targetDropZone'),
  targetPageGrid: document.getElementById('targetPageGrid'),
  targetEmptyState: document.getElementById('targetEmptyState'),
  targetFileLegendBar: document.getElementById('targetFileLegendBar'),
  targetFileLegendChips: document.getElementById('targetFileLegendChips'),
  outputFileName: document.getElementById('outputFileName'),
  footerTargetCount: document.getElementById('footerTargetCount'),

  // Modal Text Editor
  textEditorModal: document.getElementById('textEditorModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  saveModalBtn: document.getElementById('saveModalBtn'),
  modalPageDesc: document.getElementById('modalPageDesc'),
  canvasViewport: document.getElementById('canvasViewport'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  editorPreviewCanvas: document.getElementById('editorPreviewCanvas'),
  detectedTextLayer: document.getElementById('detectedTextLayer'),
  textOverlaysContainer: document.getElementById('textOverlaysContainer'),
  toggleTextDetectOverlayBtn: document.getElementById('toggleTextDetectOverlayBtn'),
  detectBtnText: document.getElementById('detectBtnText'),
  detectExistingTextBtn: document.getElementById('detectExistingTextBtn'),
  addReplacePatchBtn: document.getElementById('addReplacePatchBtn'),
  addEraserOnlyBtn: document.getElementById('addEraserOnlyBtn'),
  eraserOnlyCheckbox: document.getElementById('eraserOnlyCheckbox'),
  textContentGroup: document.getElementById('textContentGroup'),
  textTypographyRow: document.getElementById('textTypographyRow'),
  textStyleRow: document.getElementById('textStyleRow'),
  addHeaderPresetBtn: document.getElementById('addHeaderPresetBtn'),
  addFooterPresetBtn: document.getElementById('addFooterPresetBtn'),
  addCustomTextBtn: document.getElementById('addCustomTextBtn'),
  textInspectorCard: document.getElementById('textInspectorCard'),
  inspectorTitle: document.getElementById('inspectorTitle'),
  deleteActiveTextBtn: document.getElementById('deleteActiveTextBtn'),
  textInputContent: document.getElementById('textInputContent'),
  textFontSizeRange: document.getElementById('textFontSizeRange'),
  textFontSizeVal: document.getElementById('textFontSizeVal'),
  textColorPicker: document.getElementById('textColorPicker'),
  textColorHex: document.getElementById('textColorHex'),
  bgCustomColorPicker: document.getElementById('bgCustomColorPicker'),
  boxPaddingControl: document.getElementById('boxPaddingControl'),
  pageTextList: document.getElementById('pageTextList'),
  pageTextListCount: document.getElementById('pageTextListCount'),

  // Move Page Order Modal
  movePageModal: document.getElementById('movePageModal'),
  closeMoveModalBtn: document.getElementById('closeMoveModalBtn'),
  cancelMoveModalBtn: document.getElementById('cancelMoveModalBtn'),
  confirmMoveBtn: document.getElementById('confirmMoveBtn'),
  targetPosInput: document.getElementById('targetPosInput'),
  maxTargetPageNum: document.getElementById('maxTargetPageNum'),
  moveModalSubtitle: document.getElementById('moveModalSubtitle'),
  moveFirstBtn: document.getElementById('moveFirstBtn'),
  movePrevBtn: document.getElementById('movePrevBtn'),
  moveNextBtn: document.getElementById('moveNextBtn'),
  moveLastBtn: document.getElementById('moveLastBtn'),

  // Guaranteed Download Modal
  downloadReadyModal: document.getElementById('downloadReadyModal'),
  closeDownloadReadyBtn: document.getElementById('closeDownloadReadyBtn'),
  finishDownloadModalBtn: document.getElementById('finishDownloadModalBtn'),
  readyFileNameText: document.getElementById('readyFileNameText'),
  readyPageCountText: document.getElementById('readyPageCountText'),
  directDownloadLink: document.getElementById('directDownloadLink'),
  previewNewTabBtn: document.getElementById('previewNewTabBtn'),
  serverExportFallbackBtn: document.getElementById('serverExportFallbackBtn'),

  // Guide Modal
  guideModal: document.getElementById('guideModal'),
  closeGuideBtn: document.getElementById('closeGuideBtn'),
  confirmGuideBtn: document.getElementById('confirmGuideBtn'),

  // Hover Zoom Preview
  hoverPreviewPopup: document.getElementById('hoverPreviewPopup'),
  hoverPreviewTitle: document.getElementById('hoverPreviewTitle'),
  hoverPreviewScaleBadge: document.getElementById('hoverPreviewScaleBadge'),
  hoverPreviewImg: document.getElementById('hoverPreviewImg'),

  // 300% Zoom Preview Modal (Click to Zoom)
  zoomPreviewModal: document.getElementById('zoomPreviewModal'),
  zoomModalTitle: document.getElementById('zoomModalTitle'),
  zoomModalBadge: document.getElementById('zoomModalBadge'),
  zoomModalImg: document.getElementById('zoomModalImg'),
  closeZoomModalBtn: document.getElementById('closeZoomModalBtn'),
  confirmZoomModalBtn: document.getElementById('confirmZoomModalBtn'),

  // Loading Overlay
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingTitle: document.getElementById('loadingTitle'),
  loadingMsg: document.getElementById('loadingMsg'),
  loadingProgressFill: document.getElementById('loadingProgressFill')
};

/* ==========================================================================
   File Color Distinction Theme System (A파일, B파일, C파일 등 시각적 구분)
   ========================================================================== */
const FILE_COLOR_THEMES = [
  {
    name: 'blue',
    primary: '#2563eb',
    border: '#3b82f6',
    borderHover: '#1d4ed8',
    bgLight: '#f8faff',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    accentBar: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
    dot: '#2563eb'
  },
  {
    name: 'emerald',
    primary: '#059669',
    border: '#10b981',
    borderHover: '#047857',
    bgLight: '#f0fdf4',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    accentBar: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
    dot: '#059669'
  },
  {
    name: 'amber',
    primary: '#d97706',
    border: '#f59e0b',
    borderHover: '#b45309',
    bgLight: '#fffdf5',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    accentBar: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
    dot: '#d97706'
  },
  {
    name: 'purple',
    primary: '#7c3aed',
    border: '#8b5cf6',
    borderHover: '#6d28d9',
    bgLight: '#faf5ff',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    accentBar: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)',
    dot: '#7c3aed'
  },
  {
    name: 'rose',
    primary: '#e11d48',
    border: '#f43f5e',
    borderHover: '#be123c',
    bgLight: '#fff5f7',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239',
    accentBar: 'linear-gradient(90deg, #e11d48 0%, #fb7185 100%)',
    dot: '#e11d48'
  },
  {
    name: 'teal',
    primary: '#0d9488',
    border: '#14b8a6',
    borderHover: '#0f766e',
    bgLight: '#f0fdfa',
    badgeBg: '#ccfbf1',
    badgeText: '#115e59',
    accentBar: 'linear-gradient(90deg, #0d9488 0%, #2dd4bf 100%)',
    dot: '#0d9488'
  },
  {
    name: 'orange',
    primary: '#ea580c',
    border: '#f97316',
    borderHover: '#c2410c',
    bgLight: '#fff7ed',
    badgeBg: '#ffedd5',
    badgeText: '#9a3412',
    accentBar: 'linear-gradient(90deg, #ea580c 0%, #fb923c 100%)',
    dot: '#ea580c'
  },
  {
    name: 'slate',
    primary: '#475569',
    border: '#64748b',
    borderHover: '#334155',
    bgLight: '#f8fafc',
    badgeBg: '#e2e8f0',
    badgeText: '#1e293b',
    accentBar: 'linear-gradient(90deg, #475569 0%, #94a3b8 100%)',
    dot: '#475569'
  }
];

function getFileTheme(sourceFileId) {
  const index = state.sourceFiles.findIndex(f => f.id === sourceFileId);
  const safeIndex = index >= 0 ? index : 0;
  const theme = FILE_COLOR_THEMES[safeIndex % FILE_COLOR_THEMES.length];
  const fileNum = safeIndex + 1;
  const fileObj = state.sourceFiles.find(f => f.id === sourceFileId);
  return {
    ...theme,
    fileNum: fileNum,
    fileLabel: `파일 ${fileNum}`,
    fileName: fileObj ? fileObj.name : ''
  };
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
function generateId() {
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

function showLoading(title, message, progress = 0) {
  DOM.loadingTitle.textContent = title;
  DOM.loadingMsg.textContent = message;
  DOM.loadingProgressFill.style.width = `${progress}%`;
  DOM.loadingOverlay.style.display = 'flex';
}

function updateLoadingProgress(progress, message = null) {
  DOM.loadingProgressFill.style.width = `${progress}%`;
  if (message) DOM.loadingMsg.textContent = message;
}

function hideLoading() {
  DOM.loadingOverlay.style.display = 'none';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ==========================================================================
   Source File Handling & Rendering
   ========================================================================== */

async function handlePdfFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    alert('PDF 파일만 선택하거나 드래그해 주세요.');
    return;
  }

  showLoading('PDF 분석 중', '문서 구조 및 썸네일을 렌더링하고 있습니다...', 10);

  const totalFiles = files.length;
  for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
    const file = files[fileIndex];
    try {
      const rawBuffer = await file.arrayBuffer();
      // Keep an independent Uint8Array copy so PDF.js worker transfers will NEVER neuter our master bytes!
      const pdfBytes = new Uint8Array(rawBuffer);
      // Pass a cloned slice to PDF.js worker
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const fileObj = {
        id: generateId(),
        name: file.name,
        size: file.size,
        pdfBytes: pdfBytes,
        arrayBuffer: pdfBytes.buffer,
        pdfDoc: pdfDoc,
        pageCount: numPages,
        pages: []
      };

      for (let p = 1; p <= numPages; p++) {
        const page = await pdfDoc.getPage(p);
        // Use crisp 1.8x scale so that 500% zoom preview is crystal sharp and legible
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.92);

        fileObj.pages.push({
          pageNum: p,
          thumbnailDataUrl: thumbnailDataUrl,
          width: page.view[2] - page.view[0],
          height: page.view[3] - page.view[1]
        });

        const overallProgress = Math.round(
          ((fileIndex + (p / numPages)) / totalFiles) * 90
        );
        updateLoadingProgress(overallProgress, `${file.name} (${p}/${numPages} 페이지 분석 중)`);
      }

      state.sourceFiles.push(fileObj);
      if (!state.activeFileId) {
        state.activeFileId = fileObj.id;
      }
    } catch (err) {
      console.error('Error loading PDF file:', file.name, err);
      alert(`[${file.name}] 파일을 불러오는 중 오류가 발생했습니다: ` + err.message);
    }
  }

  hideLoading();
  state.selectedSourcePages.clear();
  state.lastSelectedSourcePage = null;

  renderFileTabs();
  renderSourcePages();
}

function renderFileTabs() {
  DOM.fileTabs.innerHTML = '';
  const totalCountEl = document.getElementById('totalSourceFilesCount');
  if (totalCountEl) totalCountEl.textContent = state.sourceFiles.length;

  if (state.sourceFiles.length === 0) {
    if (DOM.sourceDropArea) DOM.sourceDropArea.style.display = 'flex';
    DOM.fileTabsWrapper.style.display = 'none';
    DOM.sourceSubToolbar.style.display = 'none';
    DOM.sourceEmptyState.style.display = 'flex';
    DOM.sourcePageGrid.style.display = 'none';
    return;
  }

  // Hide the large empty dropzone once files are uploaded so tabs and pages are fully visible
  if (DOM.sourceDropArea) DOM.sourceDropArea.style.display = 'none';
  DOM.fileTabsWrapper.style.display = 'block';
  DOM.sourceSubToolbar.style.display = 'flex';
  DOM.sourceEmptyState.style.display = 'none';
  DOM.sourcePageGrid.style.display = 'grid';

  state.sourceFiles.forEach((file) => {
    const theme = getFileTheme(file.id);
    const tab = document.createElement('div');
    tab.className = `file-tab ${file.id === state.activeFileId ? 'active' : ''}`;
    tab.style.setProperty('--file-tab-border', theme.border);
    if (file.id === state.activeFileId) {
      tab.style.background = theme.bgLight;
      tab.style.borderColor = theme.border;
    }

    tab.innerHTML = `
      <span class="file-color-dot" style="background:${theme.dot}; box-shadow:0 0 6px ${theme.border};"></span>
      <span class="file-tab-num-badge" style="background:${theme.badgeBg}; color:${theme.badgeText}; border:1px solid ${theme.border};">파일 ${theme.fileNum}</span>
      <span class="file-tab-name" title="${file.name}">${file.name}</span>
      <span class="file-tab-badge">${file.pageCount}p</span>
      <span class="file-tab-close" title="파일 닫기">✕</span>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('file-tab-close')) {
        e.stopPropagation();
        removeSourceFile(file.id);
        return;
      }
      if (state.activeFileId !== file.id) {
        state.activeFileId = file.id;
        state.selectedSourcePages.clear();
        state.lastSelectedSourcePage = null;
        renderFileTabs();
        renderSourcePages();
      }
    });

    DOM.fileTabs.appendChild(tab);
  });
}

function removeSourceFile(fileId) {
  const idx = state.sourceFiles.findIndex(f => f.id === fileId);
  if (idx !== -1) {
    state.sourceFiles.splice(idx, 1);
    if (state.activeFileId === fileId) {
      state.activeFileId = state.sourceFiles.length > 0 ? state.sourceFiles[0].id : null;
      state.selectedSourcePages.clear();
      state.lastSelectedSourcePage = null;
    }
    renderFileTabs();
    renderSourcePages();
  }
}

/* ==========================================================================
   Zoom Hover Preview Popup Logic (400% Left Source / 300% Right Target)
   ========================================================================== */
function getCompositePreviewUrl(targetPage) {
  if (!targetPage.textItems || targetPage.textItems.length === 0) {
    return targetPage.thumbnailDataUrl;
  }
  try {
    const img = new Image();
    img.src = targetPage.thumbnailDataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 800;
    canvas.height = img.height || 1130;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    targetPage.textItems.forEach(item => {
      const cx = (item.xPercent / 100) * canvas.width;
      const cy = (item.yPercent / 100) * canvas.height;

      // Handle pure whiteout eraser
      if (item.isEraserOnly) {
        const padX = (item.padding || 14) * (canvas.width / 500);
        const padY = (item.padding || 10) * (canvas.width / 500);
        const boxW = (item.boxWidth || 120) * (canvas.width / 500) + padX * 2;
        const boxH = (item.boxHeight || 36) * (canvas.width / 500) + padY * 2;
        ctx.fillStyle = item.bg === 'custom' && item.customBg ? item.customBg : '#ffffff';
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        return;
      }

      if (!item.text) return;

      const fontSize = (item.fontSize || 20) * (canvas.width / 500);
      const isBold = item.fontWeight === 'bold';
      ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px "Pretendard", -apple-system, sans-serif`;

      const lines = item.text.split('\n');
      const lineH = fontSize * 1.35;
      const totalH = lines.length * lineH;

      let maxW = 0;
      lines.forEach(l => {
        const w = ctx.measureText(l).width;
        if (w > maxW) maxW = w;
      });

      const padX = (item.padding !== undefined ? item.padding : 14) * (canvas.width / 500);
      const padY = (item.padding !== undefined ? Math.round(item.padding * 0.6) : 8) * (canvas.width / 500);
      const boxW = maxW + padX * 2;
      const boxH = totalH + padY * 2;
      const bx = cx - boxW / 2;
      const by = cy - boxH / 2;

      // Solid Whiteout covers original text completely
      if (item.bg === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, boxW, boxH);
      } else if (item.bg === 'custom' && item.customBg) {
        ctx.fillStyle = item.customBg;
        ctx.fillRect(bx, by, boxW, boxH);
      } else if (item.bg === 'yellow') {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.96)';
        ctx.fillRect(bx, by, boxW, boxH);
      } else if (item.bg === 'dark') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fillRect(bx, by, boxW, boxH);
      }

      ctx.fillStyle = (item.bg === 'dark' && item.color === '#1e293b') ? '#ffffff' : item.color;
      ctx.textBaseline = 'middle';
      const startY = cy - totalH / 2 + lineH / 2;
      lines.forEach((l, idx) => {
        const ly = startY + idx * lineH;
        if (item.align === 'left') {
          ctx.textAlign = 'left';
          ctx.fillText(l, bx + padX, ly);
        } else if (item.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(l, bx + boxW - padX, ly);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(l, cx, ly);
        }
      });
    });

    return canvas.toDataURL('image/jpeg', 0.90);
  } catch (err) {
    return targetPage.thumbnailDataUrl;
  }
}

function showHoverPreview(card, pageItem, titleText, zoomPercent = 400) {
  if (!DOM.hoverPreviewPopup) return;

  DOM.hoverPreviewTitle.textContent = titleText;
  DOM.hoverPreviewScaleBadge.textContent = `${zoomPercent}% 확대`;

  // Use composite image if target page with text items, otherwise raw thumbnail
  const previewImgUrl = pageItem.textItems ? getCompositePreviewUrl(pageItem) : pageItem.thumbnailDataUrl;
  DOM.hoverPreviewImg.src = previewImgUrl;

  DOM.hoverPreviewPopup.classList.toggle('scale-400', zoomPercent === 400);
  DOM.hoverPreviewPopup.classList.toggle('scale-300', zoomPercent === 300);
  DOM.hoverPreviewPopup.style.display = 'flex';

  const rect = card.getBoundingClientRect();
  const popupWidth = zoomPercent === 400 ? 580 : 460;

  // Smart horizontal positioning
  let left = rect.right + 16;
  if (left + popupWidth > window.innerWidth - 16) {
    const leftPos = rect.left - popupWidth - 16;
    if (leftPos >= 16) {
      left = leftPos;
    } else {
      left = Math.max(16, window.innerWidth - popupWidth - 20);
    }
  }

  // Vertical placement clamped inside viewport
  const estimatedHeight = Math.min(window.innerHeight * 0.90, zoomPercent === 400 ? 780 : 620);
  let top = rect.top - 20;
  if (top < 16) top = 16;
  if (top + estimatedHeight > window.innerHeight - 16) {
    top = Math.max(16, window.innerHeight - estimatedHeight - 16);
  }

  DOM.hoverPreviewPopup.style.left = `${left}px`;
  DOM.hoverPreviewPopup.style.top = `${top}px`;

  requestAnimationFrame(() => {
    DOM.hoverPreviewPopup.classList.add('show');
  });
}

function hideHoverPreview() {
  if (!DOM.hoverPreviewPopup) return;
  DOM.hoverPreviewPopup.classList.remove('show');
  DOM.hoverPreviewPopup.style.display = 'none';
}

/* ==========================================================================
   300% Zoom Preview Modal (Click-to-zoom for Target Cards)
   ========================================================================== */
function openZoomModal(targetPage, displayIndex) {
  if (!DOM.zoomPreviewModal) {
    DOM.zoomPreviewModal = document.getElementById('zoomPreviewModal');
  }
  if (!DOM.zoomPreviewModal) return;

  const theme = getFileTheme(targetPage.sourceFileId);

  if (DOM.zoomModalTitle) {
    DOM.zoomModalTitle.innerHTML = `<span class="file-color-dot" style="background:${theme.dot}; width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:6px;"></span>[편집창 ${displayIndex}페이지] <strong style="color:${theme.primary}">[파일 ${theme.fileNum}]</strong> ${targetPage.sourceFileName} (원래 ${targetPage.sourcePageNum}p)`;
  }

  let previewImgUrl = targetPage.thumbnailDataUrl;
  try {
    if (targetPage.textItems && targetPage.textItems.length > 0) {
      previewImgUrl = getCompositePreviewUrl(targetPage);
    }
  } catch (err) {
    console.warn('Composite preview error:', err);
    previewImgUrl = targetPage.thumbnailDataUrl;
  }

  if (DOM.zoomModalImg) {
    DOM.zoomModalImg.src = previewImgUrl;
  }

  DOM.zoomPreviewModal.style.display = 'flex';
}

function closeZoomModal() {
  if (!DOM.zoomPreviewModal) {
    DOM.zoomPreviewModal = document.getElementById('zoomPreviewModal');
  }
  if (DOM.zoomPreviewModal) {
    DOM.zoomPreviewModal.style.display = 'none';
  }
}

function renderSourcePages() {
  DOM.sourcePageGrid.innerHTML = '';
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId);

  if (!activeFile) {
    DOM.sourceSubToolbar.style.display = 'none';
    DOM.sourceEmptyState.style.display = 'flex';
    return;
  }

  const theme = getFileTheme(activeFile.id);
  DOM.activeFileInfo.innerHTML = `<span class="file-color-dot" style="background:${theme.dot}; width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:5px;"></span><strong style="color:${theme.primary}">[파일 ${theme.fileNum}]</strong> ${activeFile.name} (${formatFileSize(activeFile.size)})`;
  DOM.activeFileInfo.title = `[파일 ${theme.fileNum}] ${activeFile.name} (${formatFileSize(activeFile.size)})`;
  updateSourceSelectionUI();

  activeFile.pages.forEach((pageItem) => {
    const isSelected = state.selectedSourcePages.has(pageItem.pageNum);
    const card = document.createElement('div');
    card.className = `page-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('draggable', 'true');
    card.dataset.pageNum = pageItem.pageNum;

    card.innerHTML = `
      <div class="card-check-pill">${isSelected ? '✓' : ''}</div>
      <div class="thumbnail-wrap">
        <img src="${pageItem.thumbnailDataUrl}" alt="Page ${pageItem.pageNum}" draggable="false" loading="lazy">
      </div>
      <span class="card-page-label">
        <span class="file-color-dot" style="background:${theme.dot}; width:6px; height:6px; border-radius:50%; display:inline-block; margin-right:3px;"></span>
        [파일 ${theme.fileNum}] ${pageItem.pageNum}p
      </span>
    `;

    // 400% Hover Zoom Preview Listeners (Left Source Panel)
    card.addEventListener('mouseenter', () => {
      showHoverPreview(card, pageItem, `[파일 ${theme.fileNum}] ${activeFile.name} - ${pageItem.pageNum}페이지`, 400);
    });

    card.addEventListener('mouseleave', () => {
      hideHoverPreview();
    });

    card.addEventListener('click', (e) => {
      handleSourcePageClick(pageItem.pageNum, e.shiftKey, e.ctrlKey || e.metaKey);
    });

    card.addEventListener('dragstart', (e) => {
      hideHoverPreview(); // Instantly hide so it doesn't obstruct dragging
      handleSourcePageDragStart(e, pageItem.pageNum);
    });

    card.addEventListener('dragend', () => {
      document.querySelectorAll('.page-card.dragging').forEach(el => el.classList.remove('dragging'));
      DOM.targetDropZone.classList.remove('drag-active');
      clearTargetInsertionFeedback();
      state.draggedSourcePayload = null;
      state.activeDropInsertPos = null;
    });

    DOM.sourcePageGrid.appendChild(card);
  });
}

function handleSourcePageClick(pageNum, isShift, isCtrl) {
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId);
  if (!activeFile) return;

  if (isShift && state.lastSelectedSourcePage !== null) {
    const start = Math.min(state.lastSelectedSourcePage, pageNum);
    const end = Math.max(state.lastSelectedSourcePage, pageNum);
    for (let p = start; p <= end; p++) {
      state.selectedSourcePages.add(p);
    }
  } else {
    if (state.selectedSourcePages.has(pageNum)) {
      state.selectedSourcePages.delete(pageNum);
    } else {
      state.selectedSourcePages.add(pageNum);
    }
    state.lastSelectedSourcePage = pageNum;
  }

  updateSourceSelectionUI();
  updateSourcePageCardsDOM();
}

function updateSourceSelectionUI() {
  const count = state.selectedSourcePages.size;
  DOM.sourceSelectionCount.textContent = `${count}개 선택됨`;
  DOM.addSelectedToTargetBtn.disabled = count === 0;
}

function updateSourcePageCardsDOM() {
  DOM.sourcePageGrid.querySelectorAll('.page-card').forEach((card) => {
    const pageNum = parseInt(card.dataset.pageNum, 10);
    const isSelected = state.selectedSourcePages.has(pageNum);
    card.classList.toggle('selected', isSelected);
    const pill = card.querySelector('.card-check-pill');
    if (pill) {
      pill.textContent = isSelected ? '✓' : '';
    }
  });
}

function handleSourcePageDragStart(e, pageNum) {
  if (!state.selectedSourcePages.has(pageNum)) {
    state.selectedSourcePages.clear();
    state.selectedSourcePages.add(pageNum);
    state.lastSelectedSourcePage = pageNum;
    updateSourceSelectionUI();
    updateSourcePageCardsDOM();
  }

  e.currentTarget.classList.add('dragging');

  const sortedPages = Array.from(state.selectedSourcePages).sort((a, b) => a - b);
  const payload = {
    type: 'source-pages',
    fileId: state.activeFileId,
    pages: sortedPages
  };

  state.draggedSourcePayload = payload;
  state.draggedTargetIndexes = null;

  try {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  } catch (err) {
    console.warn('DataTransfer setData error:', err);
  }
  e.dataTransfer.effectAllowed = 'copyMove';
  DOM.targetDropZone.classList.add('drag-active');
}

/* ==========================================================================
   Target Workspace (Merge sequentially & 1-Click Order Switching)
   ========================================================================== */

/* ==========================================================================
   Target Workspace (Undo / Redo, Multi-Select, Drop Insert, 300% Zoom)
   ========================================================================== */

function recordTargetHistory() {
  const snapshot = JSON.parse(JSON.stringify(state.targetPages));
  state.undoStack.push(snapshot);
  if (state.undoStack.length > 50) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  updateHistoryButtonsUI();
}

function updateHistoryButtonsUI() {
  if (DOM.undoBtn) DOM.undoBtn.disabled = state.undoStack.length === 0;
  if (DOM.redoBtn) DOM.redoBtn.disabled = state.redoStack.length === 0;
}

function undo() {
  if (state.undoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(state.targetPages));
  state.redoStack.push(currentSnapshot);

  const prevSnapshot = state.undoStack.pop();
  state.targetPages = prevSnapshot;
  state.selectedTargetPages.clear();
  state.lastSelectedTargetIndex = null;
  renderTargetPages();
  updateHistoryButtonsUI();
}

function redo() {
  if (state.redoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(state.targetPages));
  state.undoStack.push(currentSnapshot);

  const nextSnapshot = state.redoStack.pop();
  state.targetPages = nextSnapshot;
  state.selectedTargetPages.clear();
  state.lastSelectedTargetIndex = null;
  renderTargetPages();
  updateHistoryButtonsUI();
}

function addPagesToTarget(fileId, pageNumbers) {
  insertSourcePagesAt(fileId, pageNumbers, state.targetPages.length);
}

function insertSourcePagesAt(fileId, pageNumbers, insertAtIndex) {
  const file = state.sourceFiles.find(f => f.id === fileId);
  if (!file) return;

  recordTargetHistory(); // Save snapshot for Undo

  const sortedNums = Array.from(pageNumbers).sort((a, b) => a - b);
  const newItems = [];
  sortedNums.forEach((pageNum) => {
    const pageObj = file.pages.find(p => p.pageNum === pageNum);
    if (pageObj) {
      newItems.push({
        id: generateId(),
        sourceFileId: file.id,
        sourceFileName: file.name,
        sourcePageNum: pageNum,
        thumbnailDataUrl: pageObj.thumbnailDataUrl,
        width: pageObj.width,
        height: pageObj.height,
        textItems: []
      });
    }
  });

  const safeIndex = Math.max(0, Math.min(insertAtIndex, state.targetPages.length));
  state.targetPages.splice(safeIndex, 0, ...newItems);

  // Automatically select the newly inserted pages
  state.selectedTargetPages.clear();
  for (let i = 0; i < newItems.length; i++) {
    state.selectedTargetPages.add(safeIndex + i);
  }
  state.lastSelectedTargetIndex = safeIndex;

  renderTargetPages();
}

// Move multiple pages to a target insertion position between pages
function moveMultipleTargetPages(indexesToMove, insertAtIndex) {
  if (!indexesToMove || indexesToMove.length === 0) return;

  recordTargetHistory(); // Save snapshot for Undo

  // Extract objects to move in their current relative order
  const sortedAsc = [...indexesToMove].sort((a, b) => a - b);
  const itemsToMove = sortedAsc.map(idx => state.targetPages[idx]);

  // Remove from targetPages from highest index to lowest
  const sortedDesc = [...sortedAsc].sort((a, b) => b - a);
  sortedDesc.forEach(idx => {
    state.targetPages.splice(idx, 1);
    // If removed item was before insertion target, adjust index down
    if (idx < insertAtIndex) {
      insertAtIndex--;
    }
  });

  // Clamp insertAtIndex
  insertAtIndex = Math.max(0, Math.min(insertAtIndex, state.targetPages.length));

  // Insert items at the target position
  state.targetPages.splice(insertAtIndex, 0, ...itemsToMove);

  // Update selection to the newly moved items
  state.selectedTargetPages.clear();
  for (let i = 0; i < itemsToMove.length; i++) {
    state.selectedTargetPages.add(insertAtIndex + i);
  }
  state.lastSelectedTargetIndex = insertAtIndex;

  renderTargetPages();
}

// 1-Click Shift Page Position Left or Right
function shiftTargetPage(index, offset) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= state.targetPages.length) return;

  recordTargetHistory(); // Save snapshot for Undo

  const item = state.targetPages.splice(index, 1)[0];
  state.targetPages.splice(targetIndex, 0, item);

  state.selectedTargetPages.clear();
  state.selectedTargetPages.add(targetIndex);
  state.lastSelectedTargetIndex = targetIndex;
  renderTargetPages();
}

// Move to arbitrary page index
function moveTargetPageTo(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.targetPages.length || fromIndex === toIndex) return;
  moveMultipleTargetPages([fromIndex], toIndex > fromIndex ? toIndex + 1 : toIndex);
}

// Reverse all pages order
function reverseTargetPages() {
  if (state.targetPages.length <= 1) return;
  recordTargetHistory(); // Save snapshot for Undo
  state.targetPages.reverse();
  state.selectedTargetPages.clear();
  state.lastSelectedTargetIndex = null;
  renderTargetPages();
}

// Update Target Selection Status in UI
function updateTargetSelectionUI() {
  const count = state.selectedTargetPages.size;
  if (count > 0) {
    DOM.targetSelectionCount.textContent = `${count}개 선택됨`;
    DOM.targetSelectionCount.style.display = 'inline-block';
    DOM.deselectTargetBtn.style.display = 'inline-block';
    DOM.deleteSelectedTargetBtn.style.display = 'inline-block';
  } else {
    DOM.targetSelectionCount.style.display = 'none';
    DOM.deselectTargetBtn.style.display = 'none';
    DOM.deleteSelectedTargetBtn.style.display = 'none';
  }
}

// Handle clicking a target page card (single or Shift-click multi select)
function handleTargetPageClick(index, isShift) {
  if (isShift && state.lastSelectedTargetIndex !== null) {
    const start = Math.min(state.lastSelectedTargetIndex, index);
    const end = Math.max(state.lastSelectedTargetIndex, index);
    for (let i = start; i <= end; i++) {
      state.selectedTargetPages.add(i);
    }
  } else {
    if (state.selectedTargetPages.has(index)) {
      state.selectedTargetPages.delete(index);
    } else {
      state.selectedTargetPages.add(index);
    }
    state.lastSelectedTargetIndex = index;
  }

  updateTargetSelectionUI();
  updateTargetPageCardsDOM();
}

function updateTargetPageCardsDOM() {
  DOM.targetPageGrid.querySelectorAll('.target-card').forEach(card => {
    const idx = parseInt(card.dataset.index, 10);
    const isSelected = state.selectedTargetPages.has(idx);
    card.classList.toggle('selected-card', isSelected);
    const checkPill = card.querySelector('.card-check-pill');
    if (checkPill) checkPill.textContent = isSelected ? '✓' : '';
  });
}

// Open move page modal
function openMovePageModal(index) {
  state.movingTargetIndex = index;
  const targetPage = state.targetPages[index];
  const total = state.targetPages.length;
  const theme = getFileTheme(targetPage.sourceFileId);

  DOM.moveModalSubtitle.textContent = `현재 ${index + 1}번째 페이지 (출처: [파일 ${theme.fileNum}] ${targetPage.sourceFileName} - ${targetPage.sourcePageNum}p)`;
  DOM.maxTargetPageNum.textContent = total;
  DOM.targetPosInput.max = total;
  DOM.targetPosInput.value = index + 1;

  DOM.moveFirstBtn.disabled = index === 0;
  DOM.movePrevBtn.disabled = index === 0;
  DOM.moveNextBtn.disabled = index === total - 1;
  DOM.moveLastBtn.disabled = index === total - 1;

  DOM.movePageModal.style.display = 'flex';
  DOM.targetPosInput.focus();
}

// Update Target File Legend (Legend Bar above Grid)
function updateTargetFileLegend() {
  if (!DOM.targetFileLegendBar || !DOM.targetFileLegendChips) return;
  if (state.targetPages.length === 0) {
    DOM.targetFileLegendBar.style.display = 'none';
    return;
  }

  // Group pages by sourceFileId preserving order of first appearance
  const fileGroups = [];
  const seenIds = new Set();
  state.targetPages.forEach(p => {
    if (!seenIds.has(p.sourceFileId)) {
      seenIds.add(p.sourceFileId);
      fileGroups.push({ id: p.sourceFileId, name: p.sourceFileName, count: 0 });
    }
  });

  fileGroups.forEach(grp => {
    grp.count = state.targetPages.filter(p => p.sourceFileId === grp.id).length;
  });

  DOM.targetFileLegendChips.innerHTML = '';
  fileGroups.forEach(grp => {
    const theme = getFileTheme(grp.id);
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    chip.style.background = theme.badgeBg;
    chip.style.color = theme.badgeText;
    chip.style.borderColor = theme.border;
    chip.title = `클릭하면 [파일 ${theme.fileNum}]의 모든 페이지(${grp.count}장)를 일괄 선택합니다`;

    const shortName = grp.name.length > 16 ? grp.name.substring(0, 16) + '…' : grp.name;
    chip.innerHTML = `
      <span class="chip-dot" style="background:${theme.dot}; box-shadow:0 0 5px ${theme.border};"></span>
      <strong>파일 ${theme.fileNum}</strong>
      <span>${shortName}</span>
      <span class="chip-count">${grp.count}장</span>
    `;

    chip.addEventListener('click', () => {
      // Select all target pages from this source file
      state.selectedTargetPages.clear();
      state.targetPages.forEach((p, idx) => {
        if (p.sourceFileId === grp.id) {
          state.selectedTargetPages.add(idx);
        }
      });
      state.lastSelectedTargetIndex = null;
      updateTargetSelectionUI();
      updateTargetPageCardsDOM();

      // Trigger card highlight flash for instant visual identification
      DOM.targetPageGrid.querySelectorAll(`.target-card[data-file-id="${grp.id}"]`).forEach(card => {
        card.classList.remove('highlight-flash');
        void card.offsetWidth; // trigger reflow
        card.classList.add('highlight-flash');
      });
    });

    DOM.targetFileLegendChips.appendChild(chip);
  });

  DOM.targetFileLegendBar.style.display = 'flex';
}

// Render target workspace pages
function renderTargetPages() {
  DOM.targetPageGrid.innerHTML = '';
  const count = state.targetPages.length;

  DOM.headerTargetCount.textContent = count;
  DOM.footerTargetCount.textContent = count;
  DOM.exportPdfBtn.disabled = count === 0;
  DOM.clearTargetBtn.disabled = count === 0;
  DOM.reverseTargetBtn.disabled = count <= 1;

  updateTargetSelectionUI();
  updateTargetFileLegend();

  if (count === 0) {
    DOM.targetEmptyState.style.display = 'flex';
    DOM.targetPageGrid.style.display = 'none';
    state.selectedTargetPages.clear();
    state.lastSelectedTargetIndex = null;
    return;
  }

  DOM.targetEmptyState.style.display = 'none';
  DOM.targetPageGrid.style.display = 'grid';

  state.targetPages.forEach((targetPage, index) => {
    const displayIndex = index + 1;
    const hasText = targetPage.textItems && targetPage.textItems.length > 0;
    const isSelected = state.selectedTargetPages.has(index);
    const theme = getFileTheme(targetPage.sourceFileId);

    const card = document.createElement('div');
    card.className = `target-card ${hasText ? 'has-text' : ''} ${isSelected ? 'selected-card' : ''}`;
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;
    card.dataset.fileId = targetPage.sourceFileId;

    // Apply custom dynamic CSS properties for the card's file theme
    card.style.setProperty('--card-accent', theme.accentBar);
    card.style.setProperty('--card-border', theme.border);
    card.style.setProperty('--card-bg', theme.bgLight);

    card.innerHTML = `
      <div class="target-card-accent-bar" style="background:${theme.accentBar};"></div>
      <div class="card-check-pill">${isSelected ? '✓' : ''}</div>

      <!-- Prominent File Source Banner Badge -->
      <div class="target-file-source-banner" style="background:${theme.badgeBg}; color:${theme.badgeText}; border-color:${theme.border};">
        <span class="file-color-dot" style="background:${theme.dot};"></span>
        <strong class="file-tag-num">파일 ${theme.fileNum}</strong>
        <span class="file-tag-name" title="${targetPage.sourceFileName}">${targetPage.sourceFileName}</span>
        <span class="file-tag-orig-page">원래 ${targetPage.sourcePageNum}p</span>
      </div>

      <div class="target-card-topbar">
        <span class="target-badge-index" title="클릭하여 원하는 페이지 번호로 순서 직접 변경">
          ${displayIndex}p ✎
        </span>
        <div class="target-shift-group">
          <button class="btn-shift btn-shift-zoom" title="300% 확대 보기">🔍</button>
          <button class="btn-shift btn-shift-prev" title="앞으로(좌측으로) 1칸 이동" ${index === 0 ? 'disabled' : ''}>◀</button>
          <button class="btn-shift btn-shift-next" title="뒤로(우측으로) 1칸 이동" ${index === count - 1 ? 'disabled' : ''}>▶</button>
        </div>
      </div>

      <div class="thumbnail-wrap">
        <img src="${targetPage.thumbnailDataUrl}" alt="Page ${displayIndex}" draggable="false" loading="lazy">
      </div>

      <div class="card-origin-info">
        <span class="card-origin-pill" style="background:${theme.badgeBg}; color:${theme.badgeText}; border:1px solid ${theme.border};" title="${targetPage.sourceFileName} [${targetPage.sourcePageNum}페이지]">
          📁 [파일 ${theme.fileNum}] ${targetPage.sourcePageNum}p
        </span>
      </div>

      <div class="target-card-actions">
        <button class="btn btn-xs btn-card-zoom" title="이 페이지 300% 확대 보기">
          🔍 확대
        </button>
        <button class="btn btn-xs btn-edit-text" title="이 페이지에 제목이나 텍스트 작성">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          ${hasText ? '글 (' + targetPage.textItems.length + ')' : '글쓰기'}
        </button>
        <button class="btn btn-xs btn-card-del" title="이 페이지 제거">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Click-to-Zoom (Magnifier 300% Zoom on click, not hover)
    const handleZoomClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openZoomModal(targetPage, displayIndex);
    };

    const shiftZoomBtn = card.querySelector('.btn-shift-zoom');
    if (shiftZoomBtn) shiftZoomBtn.addEventListener('click', handleZoomClick);

    const cardZoomBtn = card.querySelector('.btn-card-zoom');
    if (cardZoomBtn) cardZoomBtn.addEventListener('click', handleZoomClick);

    // 1-Click Page Badge: Open Move Page Modal
    card.querySelector('.target-badge-index').addEventListener('click', (e) => {
      e.stopPropagation();
      openMovePageModal(index);
    });

    // 1-Click Shift Left Button (◀)
    card.querySelector('.btn-shift-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      shiftTargetPage(index, -1);
    });

    // 1-Click Shift Right Button (▶)
    card.querySelector('.btn-shift-next').addEventListener('click', (e) => {
      e.stopPropagation();
      shiftTargetPage(index, 1);
    });

    // Edit Text Button
    card.querySelector('.btn-edit-text').addEventListener('click', (e) => {
      e.stopPropagation();
      openTextEditorModal(index);
    });

    // Delete Single Target Page
    card.querySelector('.btn-card-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTargetPage(index);
    });

    // Click Card with Shift support for Multi-Selection
    card.addEventListener('click', (e) => {
      handleTargetPageClick(index, e.shiftKey);
    });

    // Drag Start for Single or Multi-Selected Pages
    card.addEventListener('dragstart', (e) => {
      hideHoverPreview(); // Hide zoom popup during drag

      // If dragging a card that is not in current selection, select it exclusively
      if (!state.selectedTargetPages.has(index)) {
        state.selectedTargetPages.clear();
        state.selectedTargetPages.add(index);
        state.lastSelectedTargetIndex = index;
        updateTargetSelectionUI();
        updateTargetPageCardsDOM();
      }

      const sortedIndexes = Array.from(state.selectedTargetPages).sort((a, b) => a - b);
      state.draggedTargetIndexes = sortedIndexes;
      state.draggedSourcePayload = null;
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'target-pages',
        indexes: sortedIndexes
      }));
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'target-pages',
        indexes: sortedIndexes
      }));
      e.dataTransfer.effectAllowed = 'copyMove';

      // Visual feedback on all dragging cards
      DOM.targetPageGrid.querySelectorAll('.target-card').forEach(c => {
        const cIdx = parseInt(c.dataset.index, 10);
        if (state.selectedTargetPages.has(cIdx)) {
          c.classList.add('dragging');
        }
      });
    });

    card.addEventListener('dragend', () => {
      document.querySelectorAll('.target-card.dragging').forEach(el => el.classList.remove('dragging'));
      clearTargetInsertionFeedback();
      DOM.targetDropZone.classList.remove('drag-active');
      state.draggedTargetIndexes = null;
      state.activeDropInsertPos = null;
    });

    // Drag Over on Card with Insertion Indicator
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = state.draggedSourcePayload ? 'copy' : 'move';

      const rect = card.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertPos = (e.clientX < midX) ? index : index + 1;
      state.activeDropInsertPos = insertPos;

      applyTargetInsertionFeedback(insertPos);
    });

    // Drop on Card
    card.addEventListener('drop', (e) => {
      handleUniversalTargetDrop(e, index);
    });

    DOM.targetPageGrid.appendChild(card);
  });
}

// Calculate the exact insertion index from mouse coordinates relative to cards in target grid
function getTargetInsertPosFromCoords(clientX, clientY) {
  const allCards = Array.from(DOM.targetPageGrid.querySelectorAll('.target-card:not(.dragging)'));
  if (allCards.length === 0) return 0;

  let closestCard = null;
  let minDistance = Infinity;

  allCards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const dy = Math.max(0, rect.top - clientY, clientY - rect.bottom);
    const dx = Math.max(0, rect.left - clientX, clientX - rect.right);
    const dist = Math.sqrt(dx * dx + (dy * 2.5) * (dy * 2.5));

    if (dist < minDistance) {
      minDistance = dist;
      closestCard = card;
    }
  });

  if (!closestCard) return state.targetPages.length;

  const cardIndex = parseInt(closestCard.dataset.index, 10);
  const rect = closestCard.getBoundingClientRect();
  const midX = rect.left + rect.width / 2;

  return (clientX < midX) ? cardIndex : cardIndex + 1;
}

// Clear all drop insertion lines and right-shift animation classes
function clearTargetInsertionFeedback() {
  DOM.targetPageGrid.querySelectorAll('.target-card').forEach(c => {
    c.classList.remove('drop-insert-left', 'drop-insert-right', 'shift-right-motion');
  });
}

// Apply rear shift motion to all subsequent cards and show glowing insertion line
function applyTargetInsertionFeedback(insertPos) {
  const allCards = Array.from(DOM.targetPageGrid.querySelectorAll('.target-card'));
  if (allCards.length === 0) return;

  allCards.forEach(c => {
    const cIdx = parseInt(c.dataset.index, 10);
    c.classList.remove('drop-insert-left', 'drop-insert-right', 'shift-right-motion');

    if (c.classList.contains('dragging')) return;

    // Shift cards at or after insertPos
    if (cIdx >= insertPos) {
      c.classList.add('shift-right-motion');
    }
  });

  // Highlight the insertion boundary line with neon bar and floating badge
  if (insertPos < allCards.length) {
    allCards[insertPos].classList.add('drop-insert-left');
  } else if (allCards.length > 0) {
    allCards[allCards.length - 1].classList.add('drop-insert-right');
  }
}

// Universal target drop handler
function handleUniversalTargetDrop(e, fallbackIndex = null) {
  e.preventDefault();
  e.stopPropagation();

  DOM.targetDropZone.classList.remove('drag-active');

  const targetPos = (state.activeDropInsertPos !== null && state.activeDropInsertPos !== undefined)
    ? state.activeDropInsertPos
    : (fallbackIndex !== null ? fallbackIndex : state.targetPages.length);

  clearTargetInsertionFeedback();

  // 1. Check if source pages were dragged from left panel (In-memory priority)
  if (state.draggedSourcePayload) {
    const { fileId, pages } = state.draggedSourcePayload;
    state.draggedSourcePayload = null;
    state.draggedTargetIndexes = null;
    state.activeDropInsertPos = null;
    insertSourcePagesAt(fileId, pages, targetPos);
    state.selectedSourcePages.clear();
    updateSourceSelectionUI();
    updateSourcePageCardsDOM();
    return;
  }

  // 2. Check if internal target pages were dragged
  let indexesToMove = state.draggedTargetIndexes;

  // 3. Fallback to dataTransfer if needed
  if (!indexesToMove || indexesToMove.length === 0) {
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload.type === 'source-pages') {
          insertSourcePagesAt(payload.fileId, payload.pages, targetPos);
          state.selectedSourcePages.clear();
          updateSourceSelectionUI();
          updateSourcePageCardsDOM();
          state.draggedSourcePayload = null;
          state.draggedTargetIndexes = null;
          state.activeDropInsertPos = null;
          return;
        } else if (payload.type === 'target-pages') {
          indexesToMove = payload.indexes;
        }
      }
    } catch (err) {
      console.error('Target drop parsing error:', err);
    }
  }

  if (indexesToMove && indexesToMove.length > 0) {
    moveMultipleTargetPages(indexesToMove, targetPos);
  }

  state.draggedSourcePayload = null;
  state.draggedTargetIndexes = null;
  state.activeDropInsertPos = null;
}

function removeTargetPage(index) {
  state.targetPages.splice(index, 1);
  state.selectedTargetPages.delete(index);
  // Re-index remaining selections
  const newSet = new Set();
  state.selectedTargetPages.forEach(idx => {
    if (idx < index) newSet.add(idx);
    else if (idx > index) newSet.add(idx - 1);
  });
  state.selectedTargetPages = newSet;
  state.lastSelectedTargetIndex = null;
  renderTargetPages();
}

function reorderTargetPages(fromIndex, toIndex) {
  moveTargetPageTo(fromIndex, toIndex);
}

/* Target Panel Drag and Drop Listeners (Drop outside cards / in gaps) */
DOM.targetDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = state.draggedSourcePayload ? 'copy' : 'move';
  DOM.targetDropZone.classList.add('drag-active');

  const insertPos = getTargetInsertPosFromCoords(e.clientX, e.clientY);
  state.activeDropInsertPos = insertPos;
  applyTargetInsertionFeedback(insertPos);
});

DOM.targetDropZone.addEventListener('dragleave', (e) => {
  if (!DOM.targetDropZone.contains(e.relatedTarget)) {
    DOM.targetDropZone.classList.remove('drag-active');
    clearTargetInsertionFeedback();
    state.activeDropInsertPos = null;
  }
});

DOM.targetDropZone.addEventListener('drop', (e) => {
  handleUniversalTargetDrop(e, state.targetPages.length);
});

DOM.targetPageGrid.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = state.draggedSourcePayload ? 'copy' : 'move';

  const insertPos = getTargetInsertPosFromCoords(e.clientX, e.clientY);
  state.activeDropInsertPos = insertPos;
  applyTargetInsertionFeedback(insertPos);
});

DOM.targetPageGrid.addEventListener('drop', (e) => {
  handleUniversalTargetDrop(e, state.targetPages.length);
});

if (DOM.targetEmptyState) {
  DOM.targetEmptyState.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = state.draggedSourcePayload ? 'copy' : 'move';
    DOM.targetDropZone.classList.add('drag-active');
    state.activeDropInsertPos = state.targetPages.length;
  });
  DOM.targetEmptyState.addEventListener('drop', (e) => {
    handleUniversalTargetDrop(e, state.targetPages.length);
  });
}

// Fallback drop handler for the entire right panel
const targetWorkspacePanel = document.getElementById('targetWorkspacePanel');
if (targetWorkspacePanel) {
  targetWorkspacePanel.addEventListener('dragover', (e) => {
    if (state.draggedSourcePayload || state.draggedTargetIndexes) {
      e.preventDefault();
      e.dataTransfer.dropEffect = state.draggedSourcePayload ? 'copy' : 'move';
    }
  });
  targetWorkspacePanel.addEventListener('drop', (e) => {
    if (!e.defaultPrevented && (state.draggedSourcePayload || state.draggedTargetIndexes)) {
      handleUniversalTargetDrop(e, state.targetPages.length);
    }
  });
}

/* Move Page Modal Listeners */
DOM.closeMoveModalBtn.addEventListener('click', () => {
  DOM.movePageModal.style.display = 'none';
});
DOM.cancelMoveModalBtn.addEventListener('click', () => {
  DOM.movePageModal.style.display = 'none';
});

DOM.moveFirstBtn.addEventListener('click', () => {
  if (state.movingTargetIndex !== null) {
    moveTargetPageTo(state.movingTargetIndex, 0);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.movePrevBtn.addEventListener('click', () => {
  if (state.movingTargetIndex !== null) {
    shiftTargetPage(state.movingTargetIndex, -1);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.moveNextBtn.addEventListener('click', () => {
  if (state.movingTargetIndex !== null) {
    shiftTargetPage(state.movingTargetIndex, 1);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.moveLastBtn.addEventListener('click', () => {
  if (state.movingTargetIndex !== null) {
    moveTargetPageTo(state.movingTargetIndex, state.targetPages.length - 1);
    DOM.movePageModal.style.display = 'none';
  }
});

DOM.confirmMoveBtn.addEventListener('click', () => {
  if (state.movingTargetIndex === null) return;
  const desiredPos = parseInt(DOM.targetPosInput.value, 10);
  if (isNaN(desiredPos) || desiredPos < 1 || desiredPos > state.targetPages.length) {
    alert(`1부터 ${state.targetPages.length} 사이의 유효한 페이지 번호를 입력하세요.`);
    return;
  }
  const targetIdx = desiredPos - 1;
  moveTargetPageTo(state.movingTargetIndex, targetIdx);
  DOM.movePageModal.style.display = 'none';
});

/* ==========================================================================
   Text & Title In-Place Visual Editor Modal
   ========================================================================== */

async function openTextEditorModal(targetIndex) {
  const targetPage = state.targetPages[targetIndex];
  if (!targetPage) return;

  state.editingTargetPageIndex = targetIndex;
  state.activePageDraftTexts = JSON.parse(JSON.stringify(targetPage.textItems || []));
  state.activeTextItemId = state.activePageDraftTexts.length > 0 ? state.activePageDraftTexts[0].id : null;
  state.isTextDetectMode = false;
  state.detectedPdfTexts = [];

  DOM.modalPageDesc.textContent = `편집창 제 ${targetIndex + 1}페이지 (출처: ${targetPage.sourceFileName} - ${targetPage.sourcePageNum}p)`;
  DOM.textEditorModal.style.display = 'flex';

  if (DOM.detectedTextLayer) DOM.detectedTextLayer.style.display = 'none';
  if (DOM.detectBtnText) DOM.detectBtnText.textContent = '원본 글자 감지 모드';

  await renderModalPreviewPage(targetPage);
  refreshTextOverlays();
  refreshPageTextList();
  syncInspectorWithActiveItem();
}

async function renderModalPreviewPage(targetPage) {
  const file = state.sourceFiles.find(f => f.id === targetPage.sourceFileId);
  if (!file || !file.pdfDoc) return;

  const page = await file.pdfDoc.getPage(targetPage.sourcePageNum);
  const viewport = page.getViewport({ scale: 1.25 });
  
  const canvas = DOM.editorPreviewCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport: viewport }).promise;

  DOM.canvasWrapper.style.width = `${viewport.width}px`;
  DOM.canvasWrapper.style.height = `${viewport.height}px`;

  // Scan and cache detected existing texts on page for 1-click edit
  await scanPageDetectedTexts(page, viewport);
}

// Extract existing text items from PDF page to enable 1-click modification
async function scanPageDetectedTexts(page, viewport) {
  state.detectedPdfTexts = [];
  if (!DOM.detectedTextLayer) return;
  DOM.detectedTextLayer.innerHTML = '';

  try {
    const textContent = await page.getTextContent();
    const items = textContent.items || [];
    const canvasWidth = viewport.width;
    const canvasHeight = viewport.height;

    items.forEach((item, idx) => {
      const text = (item.str || '').trim();
      if (!text) return;

      const pdfX = item.transform[4];
      const pdfY = item.transform[5];
      const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfY);

      const fontHeight = Math.hypot(item.transform[0], item.transform[1]) * viewport.scale;
      const itemWidth = Math.max(item.width * viewport.scale, 18);
      const itemHeight = Math.max(fontHeight * 1.25, 16);

      const top = Math.max(0, vy - fontHeight);
      const left = Math.max(0, vx);

      const xPercent = Math.max(2, Math.min(98, ((left + itemWidth / 2) / canvasWidth) * 100));
      const yPercent = Math.max(2, Math.min(98, ((top + itemHeight / 2) / canvasHeight) * 100));

      const detected = {
        id: `detect_${idx}`,
        text: item.str,
        left,
        top,
        width: itemWidth,
        height: itemHeight,
        xPercent: Math.round(xPercent * 10) / 10,
        yPercent: Math.round(yPercent * 10) / 10,
        fontSize: Math.max(12, Math.min(48, Math.round(fontHeight * 0.85)))
      };

      state.detectedPdfTexts.push(detected);

      // Create interactive hover pill on canvas
      const div = document.createElement('div');
      div.className = 'detected-text-item';
      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      div.style.width = `${itemWidth}px`;
      div.style.height = `${itemHeight}px`;

      const safeSnippet = detected.text.length > 20 ? detected.text.substring(0, 20) + '…' : detected.text;
      div.innerHTML = `<span class="detected-text-badge">✏️ 클릭하여 수정: "${safeSnippet.replace(/"/g, '&quot;')}"</span>`;

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        applyDetectedTextCorrection(detected);
      });

      DOM.detectedTextLayer.appendChild(div);
    });

    if (DOM.detectBtnText) {
      DOM.detectBtnText.textContent = `원본 글자 감지 (${state.detectedPdfTexts.length}개)`;
    }
  } catch (err) {
    console.warn('PDF text extraction error:', err);
  }
}

// Toggle detection overlay mode
function toggleTextDetectionMode(forceState = null) {
  state.isTextDetectMode = (forceState !== null) ? forceState : !state.isTextDetectMode;

  if (DOM.detectedTextLayer) {
    DOM.detectedTextLayer.style.display = state.isTextDetectMode ? 'block' : 'none';
  }

  if (DOM.toggleTextDetectOverlayBtn) {
    DOM.toggleTextDetectOverlayBtn.style.background = state.isTextDetectMode ? 'rgba(56, 189, 248, 0.3)' : 'none';
  }

  if (DOM.detectExistingTextBtn) {
    DOM.detectExistingTextBtn.textContent = state.isTextDetectMode 
      ? '✕ 감지 모드 끄기 (화면의 글자를 클릭해 수정)' 
      : '🔍 원본 글자 감지하여 클릭 수정';
  }
}

// 1-Click Replace Detected Text: Masks original with whiteout and allows typing new text
function applyDetectedTextCorrection(detected) {
  const newItem = {
    id: generateId(),
    text: detected.text,
    xPercent: detected.xPercent,
    yPercent: detected.yPercent,
    fontSize: detected.fontSize,
    color: '#0f172a',
    fontWeight: 'bold',
    align: 'center',
    bg: 'white',
    padding: 12,
    isEraserOnly: false
  };

  state.activePageDraftTexts.push(newItem);
  selectTextItem(newItem.id);
  refreshPageTextList();
  refreshTextOverlays();

  // Turn off detection mode so user sees their clean edit in place
  toggleTextDetectionMode(false);

  // Focus input and select all text for immediate typing
  setTimeout(() => {
    if (DOM.textInputContent) {
      DOM.textInputContent.focus();
      DOM.textInputContent.select();
    }
  }, 100);
}

function refreshTextOverlays() {
  DOM.textOverlaysContainer.innerHTML = '';

  state.activePageDraftTexts.forEach((item) => {
    const el = document.createElement('div');
    const isSelected = item.id === state.activeTextItemId;
    el.className = `text-overlay-item ${isSelected ? 'active' : ''} ${item.isEraserOnly ? 'eraser-item' : ''} ${item.bg === 'white' ? 'bg-whiteout' : ''}`;
    el.dataset.id = item.id;

    if (item.isEraserOnly) {
      el.textContent = '🧼 [ 가림 영역 (지우개) ]';
      el.style.minWidth = `${item.boxWidth || 120}px`;
      el.style.minHeight = `${item.boxHeight || 34}px`;
      el.style.background = item.bg === 'custom' && item.customBg ? item.customBg : '#ffffff';
      el.style.padding = `${item.padding || 12}px`;
    } else {
      el.textContent = item.text || '(내용 없음)';
      el.style.fontSize = `${item.fontSize}px`;
      el.style.color = item.color;
      el.style.fontWeight = item.fontWeight === 'bold' ? '700' : '400';
      el.style.textAlign = item.align || 'center';

      const pad = item.padding !== undefined ? item.padding : (item.bg === 'white' ? 12 : 8);
      el.style.padding = `${Math.round(pad * 0.6)}px ${pad}px`;

      if (item.bg === 'white') {
        el.style.background = '#ffffff';
        el.style.borderRadius = '3px';
        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)';
      } else if (item.bg === 'yellow') {
        el.style.background = 'rgba(254, 240, 138, 0.96)';
        el.style.borderRadius = '4px';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
      } else if (item.bg === 'dark') {
        el.style.background = 'rgba(15, 23, 42, 0.95)';
        el.style.color = item.color === '#1e293b' ? '#ffffff' : item.color;
        el.style.borderRadius = '4px';
      } else if (item.bg === 'custom') {
        el.style.background = item.customBg || '#ffffff';
        el.style.borderRadius = '3px';
      } else {
        el.style.background = 'transparent';
      }
    }

    el.style.left = `${item.xPercent}%`;
    el.style.top = `${item.yPercent}%`;

    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectTextItem(item.id);
      startDraggingTextItem(e, item.id);
    });

    DOM.textOverlaysContainer.appendChild(el);
  });
}

function startDraggingTextItem(e, itemId) {
  const containerRect = DOM.canvasWrapper.getBoundingClientRect();
  const item = state.activePageDraftTexts.find(t => t.id === itemId);
  if (!item) return;

  function onMouseMove(moveEvent) {
    const mouseX = moveEvent.clientX - containerRect.left;
    const mouseY = moveEvent.clientY - containerRect.top;

    const xPct = Math.max(2, Math.min(98, (mouseX / containerRect.width) * 100));
    const yPct = Math.max(2, Math.min(98, (mouseY / containerRect.height) * 100));

    item.xPercent = Math.round(xPct * 10) / 10;
    item.yPercent = Math.round(yPct * 10) / 10;

    const domEl = DOM.textOverlaysContainer.querySelector(`[data-id="${itemId}"]`);
    if (domEl) {
      domEl.style.left = `${item.xPercent}%`;
      domEl.style.top = `${item.yPercent}%`;
    }
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function selectTextItem(itemId) {
  state.activeTextItemId = itemId;
  refreshTextOverlays();
  syncInspectorWithActiveItem();
  highlightTextListRow();
}

function syncInspectorWithActiveItem() {
  const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);

  if (!item) {
    DOM.textInspectorCard.style.opacity = '0.5';
    DOM.textInspectorCard.style.pointerEvents = 'none';
    DOM.textInputContent.value = '';
    return;
  }

  DOM.textInspectorCard.style.opacity = '1';
  DOM.textInspectorCard.style.pointerEvents = 'auto';

  if (DOM.eraserOnlyCheckbox) {
    DOM.eraserOnlyCheckbox.checked = !!item.isEraserOnly;
  }

  if (DOM.textContentGroup) {
    DOM.textContentGroup.style.display = item.isEraserOnly ? 'none' : 'block';
  }
  if (DOM.textTypographyRow) {
    DOM.textTypographyRow.style.display = item.isEraserOnly ? 'none' : 'flex';
  }
  if (DOM.textStyleRow) {
    DOM.textStyleRow.style.display = item.isEraserOnly ? 'none' : 'flex';
  }

  DOM.textInputContent.value = item.text || '';
  DOM.textFontSizeRange.value = item.fontSize || 20;
  DOM.textFontSizeVal.textContent = `${item.fontSize || 20}px`;
  DOM.textColorPicker.value = item.color || '#1e293b';
  DOM.textColorHex.textContent = (item.color || '#1e293b').toUpperCase();

  DOM.textInspectorCard.querySelectorAll('[data-weight]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.weight === (item.fontWeight || 'bold'));
  });

  DOM.textInspectorCard.querySelectorAll('[data-align]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === (item.align || 'center'));
  });

  DOM.textInspectorCard.querySelectorAll('[data-bg]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bg === (item.bg || 'white'));
  });

  if (DOM.bgCustomColorPicker) {
    DOM.bgCustomColorPicker.style.display = item.bg === 'custom' ? 'inline-block' : 'none';
    if (item.customBg) DOM.bgCustomColorPicker.value = item.customBg;
  }

  const currentPad = item.padding !== undefined ? item.padding : 12;
  DOM.textInspectorCard.querySelectorAll('[data-pad]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.pad, 10) === currentPad);
  });
}

function refreshPageTextList() {
  DOM.pageTextList.innerHTML = '';
  DOM.pageTextListCount.textContent = state.activePageDraftTexts.length;

  state.activePageDraftTexts.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = `text-item-row ${item.id === state.activeTextItemId ? 'active' : ''}`;
    li.dataset.id = item.id;
    li.innerHTML = `
      <span class="text-item-snippet">${idx + 1}. ${item.text ? item.text.replace(/\n/g, ' ') : '(내용 없음)'}</span>
      <button class="text-item-delete" title="삭제">✕</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('text-item-delete')) {
        e.stopPropagation();
        deleteTextItem(item.id);
        return;
      }
      selectTextItem(item.id);
    });

    DOM.pageTextList.appendChild(li);
  });
}

function highlightTextListRow() {
  DOM.pageTextList.querySelectorAll('.text-item-row').forEach(row => {
    row.classList.toggle('active', row.dataset.id === state.activeTextItemId);
  });
}

function addNewTextItem(preset = {}) {
  const newItem = {
    id: generateId(),
    text: preset.text || '제목을 입력하세요',
    xPercent: preset.xPercent !== undefined ? preset.xPercent : 50,
    yPercent: preset.yPercent !== undefined ? preset.yPercent : 15,
    fontSize: preset.fontSize || 26,
    color: preset.color || '#1e293b',
    fontWeight: preset.fontWeight || 'bold',
    align: preset.align || 'center',
    bg: preset.bg || 'white'
  };

  state.activePageDraftTexts.push(newItem);
  selectTextItem(newItem.id);
  refreshPageTextList();
  refreshTextOverlays();
}

function deleteTextItem(itemId) {
  const idx = state.activePageDraftTexts.findIndex(t => t.id === itemId);
  if (idx !== -1) {
    state.activePageDraftTexts.splice(idx, 1);
    state.activeTextItemId = state.activePageDraftTexts.length > 0 ? state.activePageDraftTexts[0].id : null;
    refreshPageTextList();
    refreshTextOverlays();
    syncInspectorWithActiveItem();
  }
}

function saveModalEdits() {
  if (state.editingTargetPageIndex === null) return;
  const targetPage = state.targetPages[state.editingTargetPageIndex];
  if (!targetPage) return;

  targetPage.textItems = JSON.parse(JSON.stringify(state.activePageDraftTexts));
  DOM.textEditorModal.style.display = 'none';
  renderTargetPages();
}

/* Modal Event Handlers */
DOM.closeModalBtn.addEventListener('click', () => {
  DOM.textEditorModal.style.display = 'none';
});
DOM.cancelModalBtn.addEventListener('click', () => {
  DOM.textEditorModal.style.display = 'none';
});
DOM.saveModalBtn.addEventListener('click', saveModalEdits);

DOM.addHeaderPresetBtn.addEventListener('click', () => {
  addNewTextItem({
    text: '문서 대제목',
    xPercent: 50,
    yPercent: 10,
    fontSize: 28,
    color: '#0f172a',
    fontWeight: 'bold',
    align: 'center',
    bg: 'white'
  });
});

DOM.addFooterPresetBtn.addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  addNewTextItem({
    text: `작성일: ${today} | PDF Studio Pro`,
    xPercent: 50,
    yPercent: 93,
    fontSize: 14,
    color: '#475569',
    fontWeight: 'normal',
    align: 'center',
    bg: 'none'
  });
});

DOM.addCustomTextBtn.addEventListener('click', () => {
  addNewTextItem({
    text: '새로운 메모 또는 텍스트',
    xPercent: 50,
    yPercent: 50,
    fontSize: 20,
    color: '#1e293b',
    fontWeight: 'normal',
    align: 'center',
    bg: 'yellow'
  });
});

DOM.deleteActiveTextBtn.addEventListener('click', () => {
  if (state.activeTextItemId) {
    deleteTextItem(state.activeTextItemId);
  }
});

DOM.textInputContent.addEventListener('input', (e) => {
  const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
  if (item) {
    item.text = e.target.value;
    refreshTextOverlays();
    refreshPageTextList();
  }
});

DOM.textFontSizeRange.addEventListener('input', (e) => {
  const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
  if (item) {
    item.fontSize = parseInt(e.target.value, 10);
    DOM.textFontSizeVal.textContent = `${item.fontSize}px`;
    refreshTextOverlays();
  }
});

DOM.textColorPicker.addEventListener('input', (e) => {
  const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
  if (item) {
    item.color = e.target.value;
    DOM.textColorHex.textContent = item.color.toUpperCase();
    refreshTextOverlays();
  }
});

if (DOM.detectExistingTextBtn) {
  DOM.detectExistingTextBtn.addEventListener('click', () => {
    toggleTextDetectionMode();
  });
}

if (DOM.toggleTextDetectOverlayBtn) {
  DOM.toggleTextDetectOverlayBtn.addEventListener('click', () => {
    toggleTextDetectionMode();
  });
}

if (DOM.addReplacePatchBtn) {
  DOM.addReplacePatchBtn.addEventListener('click', () => {
    addNewTextItem({
      text: '수정할 글씨 입력',
      xPercent: 50,
      yPercent: 45,
      fontSize: 22,
      color: '#0f172a',
      fontWeight: 'bold',
      align: 'center',
      bg: 'white',
      padding: 14,
      isEraserOnly: false
    });
    setTimeout(() => {
      if (DOM.textInputContent) {
        DOM.textInputContent.focus();
        DOM.textInputContent.select();
      }
    }, 100);
  });
}

if (DOM.addEraserOnlyBtn) {
  DOM.addEraserOnlyBtn.addEventListener('click', () => {
    addNewTextItem({
      text: '',
      xPercent: 50,
      yPercent: 50,
      fontSize: 16,
      color: '#64748b',
      fontWeight: 'normal',
      align: 'center',
      bg: 'white',
      padding: 16,
      isEraserOnly: true,
      boxWidth: 140,
      boxHeight: 38
    });
  });
}

if (DOM.eraserOnlyCheckbox) {
  DOM.eraserOnlyCheckbox.addEventListener('change', (e) => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.isEraserOnly = e.target.checked;
      if (item.isEraserOnly && !item.bg) {
        item.bg = 'white';
      }
      refreshTextOverlays();
      refreshPageTextList();
      syncInspectorWithActiveItem();
    }
  });
}

DOM.textInspectorCard.querySelectorAll('[data-weight]').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.fontWeight = btn.dataset.weight;
      DOM.textInspectorCard.querySelectorAll('[data-weight]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshTextOverlays();
    }
  });
});

DOM.textInspectorCard.querySelectorAll('[data-align]').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.align = btn.dataset.align;
      DOM.textInspectorCard.querySelectorAll('[data-align]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshTextOverlays();
    }
  });
});

DOM.textInspectorCard.querySelectorAll('[data-bg]').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.bg = btn.dataset.bg;
      DOM.textInspectorCard.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (DOM.bgCustomColorPicker) {
        DOM.bgCustomColorPicker.style.display = item.bg === 'custom' ? 'inline-block' : 'none';
      }
      refreshTextOverlays();
    }
  });
});

if (DOM.bgCustomColorPicker) {
  DOM.bgCustomColorPicker.addEventListener('input', (e) => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.bg = 'custom';
      item.customBg = e.target.value;
      refreshTextOverlays();
    }
  });
}

if (DOM.boxPaddingControl) {
  DOM.boxPaddingControl.querySelectorAll('[data-pad]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
      if (item) {
        item.padding = parseInt(btn.dataset.pad, 10);
        DOM.boxPaddingControl.querySelectorAll('[data-pad]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refreshTextOverlays();
      }
    });
  });
}

/* ==========================================================================
   Guaranteed 100% Reliable PDF Generation & Direct Download
   ========================================================================== */

function renderTextOverlayToPng(targetPage, pdfWidth, pdfHeight) {
  if (!targetPage.textItems || targetPage.textItems.length === 0) {
    return null;
  }

  try {
    const scale = 2.0;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pdfWidth * scale);
    canvas.height = Math.round(pdfHeight * scale);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    targetPage.textItems.forEach(item => {
      const centerX = (item.xPercent / 100) * canvas.width;
      const centerY = (item.yPercent / 100) * canvas.height;

      // Handle pure whiteout eraser (no text printed)
      if (item.isEraserOnly) {
        const padX = (item.padding || 14) * scale;
        const padY = (item.padding || 10) * scale;
        const boxWidth = (item.boxWidth || 120) * scale + padX * 2;
        const boxHeight = (item.boxHeight || 36) * scale + padY * 2;
        const boxX = centerX - boxWidth / 2;
        const boxY = centerY - boxHeight / 2;

        ctx.fillStyle = item.bg === 'custom' && item.customBg ? item.customBg : '#ffffff';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        return;
      }

      if (!item.text) return;

      const itemFontSize = (item.fontSize || 20) * scale;
      const itemWeight = item.fontWeight === 'bold' ? 'bold' : 'normal';
      ctx.font = `${itemWeight} ${itemFontSize}px "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      const lines = item.text.split('\n');
      const lineHeight = itemFontSize * 1.35;
      const totalBlockHeight = lines.length * lineHeight;

      let maxLineWidth = 0;
      lines.forEach(line => {
        const w = ctx.measureText(line).width;
        if (w > maxLineWidth) maxLineWidth = w;
      });

      const padX = (item.padding !== undefined ? item.padding : 14) * scale;
      const padY = (item.padding !== undefined ? Math.round(item.padding * 0.6) : 8) * scale;
      const boxWidth = maxLineWidth + padX * 2;
      const boxHeight = totalBlockHeight + padY * 2;
      const boxX = centerX - boxWidth / 2;
      const boxY = centerY - boxHeight / 2;

      // Solid Whiteout covers original text completely (Seamless mask)
      if (item.bg === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      } else if (item.bg === 'custom' && item.customBg) {
        ctx.fillStyle = item.customBg;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      } else if (item.bg === 'yellow') {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.98)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4 * scale);
        ctx.fill();
      } else if (item.bg === 'dark') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4 * scale);
        ctx.fill();
      }

      ctx.fillStyle = (item.bg === 'dark' && item.color === '#1e293b') ? '#ffffff' : item.color;
      ctx.textBaseline = 'middle';

      const startY = centerY - (totalBlockHeight / 2) + (lineHeight / 2);
      lines.forEach((line, lIdx) => {
        const lineY = startY + lIdx * lineHeight;
        if (item.align === 'left') {
          ctx.textAlign = 'left';
          ctx.fillText(line, boxX + padX, lineY);
        } else if (item.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(line, boxX + boxWidth - padX, lineY);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(line, centerX, lineY);
        }
      });
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Text overlay canvas error:', err);
    return null;
  }
}

// Perform Browser Download & Show Ready Modal for Guaranteed User Action
function triggerBrowserDownload(blob, outputFileName) {
  if (state.lastGeneratedBlobUrl) {
    URL.revokeObjectURL(state.lastGeneratedBlobUrl);
  }

  const url = URL.createObjectURL(blob);
  state.lastGeneratedBlobUrl = url;
  state.lastGeneratedFileName = outputFileName;

  // 1. Programmatic click attempt
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  } catch (err) {
    console.warn('Auto download click failed, ready modal will handle it:', err);
  }

  // 2. Open Guaranteed Download Ready Modal
  DOM.readyFileNameText.textContent = outputFileName;
  DOM.readyPageCountText.textContent = state.targetPages.length;
  DOM.directDownloadLink.href = url;
  DOM.directDownloadLink.download = outputFileName;
  DOM.downloadReadyModal.style.display = 'flex';
}

// Fallback: Export using local python server backend API (/api/merge)
async function exportMergedPdfViaServer(outputFileName) {
  showLoading('서버 엔진으로 PDF 결합 중', '로컬 파이썬 엔진에서 확실하게 문서를 생성하고 있습니다...', 50);
  try {
    const payload = {
      outputFileName: outputFileName,
      pages: state.targetPages.map(tp => ({
        fileName: tp.sourceFileName,
        pageNum: tp.sourcePageNum,
        textItems: tp.textItems || []
      }))
    };

    const response = await fetch('/api/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`서버 응답 오류 (상태 코드: ${response.status})`);
    }

    const blob = await response.blob();
    hideLoading();
    triggerBrowserDownload(blob, outputFileName);
  } catch (err) {
    hideLoading();
    alert('서버 엔진 변환 중 오류가 발생했습니다: ' + err.message);
  }
}

// Prompt user to select folder and filename via native File System Access API
async function savePdfWithFilePicker(blob, defaultFileName) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: [{
          description: 'PDF 문서 (*.pdf)',
          accept: { 'application/pdf': ['.pdf'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true; // Successfully saved
    } catch (err) {
      if (err.name === 'AbortError') {
        return null; // User cancelled the picker dialog
      }
      console.warn('showSaveFilePicker error, fallback to standard download:', err);
    }
  }
  return false;
}

// Main PDF Export Pipeline (Browser Engine first, Server Engine fallback)
async function exportMergedPdf() {
  if (state.targetPages.length === 0) {
    alert('편집창에 추가된 페이지가 없습니다. 먼저 페이지를 추가해 주세요.');
    return;
  }

  let rawName = DOM.outputFileName.value.trim() || '새로운_편집문서';
  if (!rawName.toLowerCase().endsWith('.pdf')) {
    rawName += '.pdf';
  }

  // If PDFLib is unavailable or offline, immediately fallback to server
  if (typeof PDFLib === 'undefined' || !PDFLib.PDFDocument) {
    console.warn('PDFLib not available, falling back to server engine.');
    await exportMergedPdfViaServer(rawName);
    return;
  }

  const totalPages = state.targetPages.length;
  showLoading('새 PDF 결합 및 제작 중', '페이지를 순서대로 병합하고 제목/글씨를 합성하고 있습니다...', 10);

  try {
    const PDFDocument = PDFLib.PDFDocument;
    const mergedDoc = await PDFDocument.create();

    const loadedPdfLibMap = new Map();

    for (let i = 0; i < totalPages; i++) {
      const targetPage = state.targetPages[i];
      const sourceFile = state.sourceFiles.find(f => f.id === targetPage.sourceFileId);
      if (!sourceFile) continue;

      let srcPdfLibDoc = loadedPdfLibMap.get(sourceFile.id);
      if (!srcPdfLibDoc) {
        // Use cloned pdfBytes to ensure bytes are intact and never neutered
        const inputBytes = sourceFile.pdfBytes ? sourceFile.pdfBytes.slice(0) : sourceFile.arrayBuffer;
        srcPdfLibDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
        loadedPdfLibMap.set(sourceFile.id, srcPdfLibDoc);
      }

      const pageIndexToCopy = targetPage.sourcePageNum - 1;
      const [copiedPage] = await mergedDoc.copyPages(srcPdfLibDoc, [pageIndexToCopy]);
      const addedPage = mergedDoc.addPage(copiedPage);

      const pageWidth = addedPage.getWidth();
      const pageHeight = addedPage.getHeight();

      // Safely apply text overlay
      try {
        const overlayPngUrl = renderTextOverlayToPng(targetPage, pageWidth, pageHeight);
        if (overlayPngUrl) {
          const pngImage = await mergedDoc.embedPng(overlayPngUrl);
          addedPage.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });
        }
      } catch (overlayErr) {
        console.warn(`Overlay error on page ${i + 1}, proceeding without overlay:`, overlayErr);
      }

      const progress = Math.round(15 + ((i + 1) / totalPages) * 75);
      updateLoadingProgress(progress, `${i + 1} / ${totalPages} 페이지 결합 완료`);
    }

    updateLoadingProgress(95, 'PDF 파일 패키징 중...');
    const mergedPdfBytes = await mergedDoc.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

    hideLoading();

    // 1. Prompt user to select target folder on local PC via File System Access API
    const savedDirectly = await savePdfWithFilePicker(blob, rawName);
    if (savedDirectly === true) {
      alert(`[${rawName}] 파일이 지정하신 폴더에 성공적으로 저장되었습니다!`);
      return;
    }
    if (savedDirectly === null) {
      // User cancelled save dialog
      return;
    }

    // 2. Fallback to direct browser download and ready modal
    triggerBrowserDownload(blob, rawName);
  } catch (err) {
    console.error('Browser PDF-Lib generation error, trying server fallback:', err);
    hideLoading();
    // Guaranteed fallback: Attempt server-side merge
    await exportMergedPdfViaServer(rawName);
  }
}

/* Download Modal Action Listeners */
DOM.closeDownloadReadyBtn.addEventListener('click', () => {
  DOM.downloadReadyModal.style.display = 'none';
});
DOM.finishDownloadModalBtn.addEventListener('click', () => {
  DOM.downloadReadyModal.style.display = 'none';
});
DOM.previewNewTabBtn.addEventListener('click', () => {
  if (state.lastGeneratedBlobUrl) {
    window.open(state.lastGeneratedBlobUrl, '_blank');
  }
});
DOM.serverExportFallbackBtn.addEventListener('click', async () => {
  let rawName = state.lastGeneratedFileName || DOM.outputFileName.value.trim() || '새로운_편집문서.pdf';
  if (!rawName.toLowerCase().endsWith('.pdf')) rawName += '.pdf';
  DOM.downloadReadyModal.style.display = 'none';
  await exportMergedPdfViaServer(rawName);
});

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */

DOM.pdfFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handlePdfFiles(e.target.files);
    e.target.value = '';
  }
});

DOM.sourceDropArea.addEventListener('click', () => {
  DOM.pdfFileInput.click();
});

DOM.sourceDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  DOM.sourceDropArea.classList.add('dragover');
});

DOM.sourceDropArea.addEventListener('dragleave', () => {
  DOM.sourceDropArea.classList.remove('dragover');
});

DOM.sourceDropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  DOM.sourceDropArea.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handlePdfFiles(e.dataTransfer.files);
  }
});

// Allow dropping external PDF files anywhere onto the source panel even when sourceDropArea is hidden
const sourcePanel = document.querySelector('.source-panel');
if (sourcePanel) {
  sourcePanel.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
    }
  });
  sourcePanel.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      handlePdfFiles(e.dataTransfer.files);
    }
  });
}

DOM.selectAllPagesBtn.addEventListener('click', () => {
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId);
  if (!activeFile) return;

  activeFile.pages.forEach(p => state.selectedSourcePages.add(p.pageNum));
  updateSourceSelectionUI();
  updateSourcePageCardsDOM();
});

DOM.deselectAllPagesBtn.addEventListener('click', () => {
  state.selectedSourcePages.clear();
  state.lastSelectedSourcePage = null;
  updateSourceSelectionUI();
  updateSourcePageCardsDOM();
});

DOM.addSelectedToTargetBtn.addEventListener('click', () => {
  if (state.selectedSourcePages.size === 0 || !state.activeFileId) return;

  addPagesToTarget(state.activeFileId, state.selectedSourcePages);
  state.selectedSourcePages.clear();
  state.lastSelectedSourcePage = null;
  updateSourceSelectionUI();
  updateSourcePageCardsDOM();
});

DOM.deselectTargetBtn.addEventListener('click', () => {
  state.selectedTargetPages.clear();
  state.lastSelectedTargetIndex = null;
  updateTargetSelectionUI();
  updateTargetPageCardsDOM();
});

DOM.deleteSelectedTargetBtn.addEventListener('click', () => {
  const count = state.selectedTargetPages.size;
  if (count === 0) return;
  if (confirm(`선택한 ${count}개 페이지를 편집창에서 삭제하시겠습니까?`)) {
    const sortedDesc = Array.from(state.selectedTargetPages).sort((a, b) => b - a);
    sortedDesc.forEach(idx => {
      state.targetPages.splice(idx, 1);
    });
    state.selectedTargetPages.clear();
    state.lastSelectedTargetIndex = null;
    renderTargetPages();
  }
});

DOM.undoBtn.addEventListener('click', undo);
DOM.redoBtn.addEventListener('click', redo);

// Global Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), ESC (Close Modals)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeZoomModal();
    DOM.guideModal.style.display = 'none';
    DOM.movePageModal.style.display = 'none';
    DOM.downloadReadyModal.style.display = 'none';
  }

  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || e.key === 'Z') {
      e.preventDefault();
      redo();
    }
  }
});

DOM.reverseTargetBtn.addEventListener('click', reverseTargetPages);

DOM.clearTargetBtn.addEventListener('click', () => {
  if (state.targetPages.length === 0) return;
  if (confirm('편집창에 추가된 모든 페이지를 삭제하시겠습니까?')) {
    recordTargetHistory();
    state.targetPages = [];
    renderTargetPages();
  }
});

DOM.exportPdfBtn.addEventListener('click', exportMergedPdf);

DOM.guideBtn.addEventListener('click', () => {
  DOM.guideModal.style.display = 'flex';
});
DOM.closeGuideBtn.addEventListener('click', () => {
  DOM.guideModal.style.display = 'none';
});
DOM.confirmGuideBtn.addEventListener('click', () => {
  DOM.guideModal.style.display = 'none';
});

// 300% Zoom Preview Modal Listeners
if (DOM.closeZoomModalBtn) {
  DOM.closeZoomModalBtn.addEventListener('click', closeZoomModal);
}
if (DOM.confirmZoomModalBtn) {
  DOM.confirmZoomModalBtn.addEventListener('click', closeZoomModal);
}
if (DOM.zoomPreviewModal) {
  DOM.zoomPreviewModal.addEventListener('click', (e) => {
    if (e.target === DOM.zoomPreviewModal) {
      closeZoomModal();
    }
  });
}

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
window.addEventListener('scroll', hideHoverPreview, true);

