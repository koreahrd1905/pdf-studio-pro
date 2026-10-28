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
  movingMultipleIndexes: null,

  // Drag and drop tracking
  draggedSourcePayload: null,
  draggedTargetIndexes: null,
  activeDropInsertPos: null,

  // Zoom modal current scale (default 700%)
  currentZoomPercent: 700,
  isZoomFitMode: false,

  // Pasted screenshot counter
  captureCount: 0,

  // Mobile active view mode ('both', 'source', 'target')
  mobileViewMode: 'both',

  // Last exported PDF blob info
  lastGeneratedBlobUrl: null,
  lastGeneratedFileName: null
};

// DOM References
const DOM = {
  // Header & Mobile Nav
  headerTargetCount: document.getElementById('headerTargetCount'),
  headerPrintBtn: document.getElementById('headerPrintBtn'),
  headerPrintBtnText: document.getElementById('headerPrintBtnText'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  guideBtn: document.getElementById('guideBtn'),
  mainContainer: document.getElementById('mainContainer'),
  mobilePanelNav: document.getElementById('mobilePanelNav'),
  mobileTabBoth: document.getElementById('mobileTabBoth'),
  mobileTabSource: document.getElementById('mobileTabSource'),
  mobileTabTarget: document.getElementById('mobileTabTarget'),
  mobileSourceCount: document.getElementById('mobileSourceCount'),
  mobileTargetCount: document.getElementById('mobileTargetCount'),
  mobileQuickMoveBtn: document.getElementById('mobileQuickMoveBtn'),
  mobileSelectedBadge: document.getElementById('mobileSelectedBadge'),

  // Source Panel & Move Buttons
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
  subtoolbarMoveBadge: document.getElementById('subtoolbarMoveBadge'),
  sourceBottomMoveBar: document.getElementById('sourceBottomMoveBar'),
  bottomSelectedCount: document.getElementById('bottomSelectedCount'),
  bottomMoveSelectedBtn: document.getElementById('bottomMoveSelectedBtn'),
  bottomMoveAllBtn: document.getElementById('bottomMoveAllBtn'),
  bridgeMoveSelectedBtn: document.getElementById('bridgeMoveSelectedBtn'),
  bridgeSelectedCountBadge: document.getElementById('bridgeSelectedCountBadge'),
  bridgeMoveAllBtn: document.getElementById('bridgeMoveAllBtn'),
  sourcePageGrid: document.getElementById('sourcePageGrid'),
  sourceEmptyState: document.getElementById('sourceEmptyState'),

  // Target Panel & Clipboard Paste
  pasteClipboardBtn: document.getElementById('pasteClipboardBtn'),
  uploadImageToTargetBtn: document.getElementById('uploadImageToTargetBtn'),
  pasteImageFileInput: document.getElementById('pasteImageFileInput'),
  emptyStatePasteBtn: document.getElementById('emptyStatePasteBtn'),
  emptyStateImageUploadBtn: document.getElementById('emptyStateImageUploadBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  targetSelectionCount: document.getElementById('targetSelectionCount'),
  selectAllTargetBtn: document.getElementById('selectAllTargetBtn'),
  printTargetBtn: document.getElementById('printTargetBtn'),
  printTargetBtnLabel: document.getElementById('printTargetBtnLabel'),
  moveSelectedTargetBtn: document.getElementById('moveSelectedTargetBtn'),
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
  footerPrintBtn: document.getElementById('footerPrintBtn'),
  footerPrintBtnText: document.getElementById('footerPrintBtnText'),

  // Modal Text Editor
  textEditorModal: document.getElementById('textEditorModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  saveModalBtn: document.getElementById('saveModalBtn'),
  printModalPageBtn: document.getElementById('printModalPageBtn'),
  modalPageDesc: document.getElementById('modalPageDesc'),
  canvasViewport: document.getElementById('canvasViewport'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  editorPreviewCanvas: document.getElementById('editorPreviewCanvas'),
  detectedTextLayer: document.getElementById('detectedTextLayer'),
  areaDragSelectionLayer: document.getElementById('areaDragSelectionLayer'),
  areaDragRect: document.getElementById('areaDragRect'),
  textOverlaysContainer: document.getElementById('textOverlaysContainer'),
  toggleTextDetectOverlayBtn: document.getElementById('toggleTextDetectOverlayBtn'),
  detectBtnText: document.getElementById('detectBtnText'),
  detectExistingTextBtn: document.getElementById('detectExistingTextBtn'),
  dragAreaReplaceBtn: document.getElementById('dragAreaReplaceBtn'),
  smartDetectedListPanel: document.getElementById('smartDetectedListPanel'),
  detectedListCount: document.getElementById('detectedListCount'),
  detectedTextSearchInput: document.getElementById('detectedTextSearchInput'),
  detectedTextQuickList: document.getElementById('detectedTextQuickList'),
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
  fontSizeDownBtn: document.getElementById('fontSizeDownBtn'),
  fontSizeUpBtn: document.getElementById('fontSizeUpBtn'),
  fontSizeStepUpBtn: document.getElementById('fontSizeStepUpBtn'),
  fontSizeStepDownBtn: document.getElementById('fontSizeStepDownBtn'),
  boxResizeGuideRow: document.getElementById('boxResizeGuideRow'),
  boxSizeStatusText: document.getElementById('boxSizeStatusText'),
  resetBoxSizeBtn: document.getElementById('resetBoxSizeBtn'),
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

  // 700% Zoom Preview Modal (Click to Zoom)
  zoomPreviewModal: document.getElementById('zoomPreviewModal'),
  zoomModalTitle: document.getElementById('zoomModalTitle'),
  zoomModalBadge: document.getElementById('zoomModalBadge'),
  zoomModalBody: document.getElementById('zoomModalBody'),
  zoomModalImg: document.getElementById('zoomModalImg'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomReset700Btn: document.getElementById('zoomReset700Btn'),
  zoomFitBtn: document.getElementById('zoomFitBtn'),
  closeZoomModalBtn: document.getElementById('closeZoomModalBtn'),
  confirmZoomModalBtn: document.getElementById('confirmZoomModalBtn'),

  // Toast
  appToast: document.getElementById('appToast'),
  appToastIcon: document.getElementById('appToastIcon'),
  appToastMsg: document.getElementById('appToastMsg'),

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

let toastTimeoutId = null;
function showToast(message, icon = '✅', duration = 2600) {
  if (!DOM.appToast) return;
  if (DOM.appToastIcon) DOM.appToastIcon.textContent = icon;
  if (DOM.appToastMsg) DOM.appToastMsg.textContent = message;
  DOM.appToast.style.display = 'flex';
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    DOM.appToast.style.display = 'none';
  }, duration);
}

function isTouchDevice() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function setMobileViewMode(mode) {
  state.mobileViewMode = mode;
  if (!DOM.mainContainer) return;
  DOM.mainContainer.classList.remove('mobile-view-source', 'mobile-view-target');
  if (mode === 'source') {
    DOM.mainContainer.classList.add('mobile-view-source');
  } else if (mode === 'target') {
    DOM.mainContainer.classList.add('mobile-view-target');
  }
  if (DOM.mobileTabBoth) DOM.mobileTabBoth.classList.toggle('active', mode === 'both');
  if (DOM.mobileTabSource) DOM.mobileTabSource.classList.toggle('active', mode === 'source');
  if (DOM.mobileTabTarget) DOM.mobileTabTarget.classList.toggle('active', mode === 'target');
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
        // Use crisp 1.8x scale so that zoom preview is crystal sharp and legible
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
  const visibleSourceFiles = state.sourceFiles.filter(f => !f.isHiddenCaptureStore);
  const totalCountEl = document.getElementById('totalSourceFilesCount');
  if (totalCountEl) totalCountEl.textContent = visibleSourceFiles.length;
  if (DOM.mobileSourceCount) DOM.mobileSourceCount.textContent = visibleSourceFiles.length;

  if (visibleSourceFiles.length === 0) {
    if (DOM.sourceDropArea) DOM.sourceDropArea.style.display = 'flex';
    DOM.fileTabsWrapper.style.display = 'none';
    DOM.sourceSubToolbar.style.display = 'none';
    if (DOM.sourceBottomMoveBar) DOM.sourceBottomMoveBar.style.display = 'none';
    DOM.sourceEmptyState.style.display = 'flex';
    DOM.sourcePageGrid.style.display = 'none';
    updateSourceSelectionUI();
    return;
  }

  // Hide the large empty dropzone once files are uploaded so tabs and pages are fully visible
  if (DOM.sourceDropArea) DOM.sourceDropArea.style.display = 'none';
  DOM.fileTabsWrapper.style.display = 'block';
  DOM.sourceSubToolbar.style.display = 'flex';
  if (DOM.sourceBottomMoveBar) DOM.sourceBottomMoveBar.style.display = 'flex';
  DOM.sourceEmptyState.style.display = 'none';
  DOM.sourcePageGrid.style.display = 'grid';

  visibleSourceFiles.forEach((file) => {
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
  if (!DOM.hoverPreviewPopup || isTouchDevice()) return;

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
   700% Zoom Preview Modal (Click-to-zoom for Target & Source Cards)
   ========================================================================== */
function applyZoomModalScale(percent, isFit = false) {
  state.currentZoomPercent = percent;
  state.isZoomFitMode = isFit;
  if (!DOM.zoomModalImg) return;

  if (isFit) {
    DOM.zoomModalImg.style.width = '100%';
    DOM.zoomModalImg.style.maxWidth = '100%';
    if (DOM.zoomModalBadge) DOM.zoomModalBadge.textContent = '화면맞춤';
  } else {
    // Base thumbnail card width is ~160px; 700% = 1120px
    const pxWidth = Math.round(160 * (percent / 100));
    DOM.zoomModalImg.style.width = `${pxWidth}px`;
    DOM.zoomModalImg.style.maxWidth = 'none';
    if (DOM.zoomModalBadge) DOM.zoomModalBadge.textContent = `${percent}% 확대`;
  }
}

function drawTextItemsOnCanvas(ctx, canvasWidth, canvasHeight, textItems) {
  if (!textItems || textItems.length === 0) return;
  textItems.forEach(item => {
    const cx = (item.xPercent / 100) * canvasWidth;
    const cy = (item.yPercent / 100) * canvasHeight;

    if (item.isEraserOnly) {
      const padX = (item.padding || 14) * (canvasWidth / 500);
      const padY = (item.padding || 10) * (canvasWidth / 500);
      const boxW = item.widthPercent ? (item.widthPercent / 100) * canvasWidth : ((item.boxWidth || 120) * (canvasWidth / 500) + padX * 2);
      const boxH = item.heightPercent ? (item.heightPercent / 100) * canvasHeight : ((item.boxHeight || 36) * (canvasWidth / 500) + padY * 2);
      ctx.fillStyle = item.bg === 'custom' && item.customBg ? item.customBg : '#ffffff';
      ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
      return;
    }

    if (!item.text) return;

    const fontSize = (item.fontSize || 20) * (canvasWidth / 500);
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

    const padX = (item.padding !== undefined ? item.padding : 14) * (canvasWidth / 500);
    const padY = (item.padding !== undefined ? Math.round(item.padding * 0.6) : 8) * (canvasWidth / 500);
    const autoW = maxW + padX * 2;
    const autoH = totalH + padY * 2;
    const boxW = item.widthPercent ? (item.widthPercent / 100) * canvasWidth : autoW;
    const boxH = item.heightPercent ? (item.heightPercent / 100) * canvasHeight : autoH;
    const bx = cx - boxW / 2;
    const by = cy - boxH / 2;

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
        ctx.fillText(l, bx + Math.min(padX, boxW * 0.15), ly);
      } else if (item.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(l, bx + boxW - Math.min(padX, boxW * 0.15), ly);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(l, cx, ly);
      }
    });
  });
}

async function openZoomModal(targetPage, displayIndex, customLabel = null) {
  if (!DOM.zoomPreviewModal) {
    DOM.zoomPreviewModal = document.getElementById('zoomPreviewModal');
  }
  if (!DOM.zoomPreviewModal) return;

  const theme = getFileTheme(targetPage.sourceFileId);

  if (DOM.zoomModalTitle) {
    if (customLabel) {
      DOM.zoomModalTitle.innerHTML = customLabel;
    } else {
      const badgeLabel = targetPage.isPastedImage ? '📸 캡처 이미지' : `파일 ${theme.fileNum}`;
      DOM.zoomModalTitle.innerHTML = `<span class="file-color-dot" style="background:${theme.dot}; width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:6px;"></span>[편집창 ${displayIndex}페이지] <strong style="color:#38bdf8">[${badgeLabel}]</strong> ${targetPage.sourceFileName} (700% 확대)`;
    }
  }

  // Default to 700% zoom as requested
  applyZoomModalScale(700, false);

  let previewImgUrl = targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl;
  try {
    if (targetPage.textItems && targetPage.textItems.length > 0) {
      previewImgUrl = getCompositePreviewUrl(targetPage);
    }
  } catch (err) {
    console.warn('Composite preview error:', err);
  }

  if (DOM.zoomModalImg) {
    DOM.zoomModalImg.src = previewImgUrl;
  }

  DOM.zoomPreviewModal.style.display = 'flex';
  if (DOM.zoomModalBody) {
    DOM.zoomModalBody.scrollTop = 0;
    DOM.zoomModalBody.scrollLeft = 0;
  }

  // Render ultra-sharp 700% high-res page asynchronously from PDF document if available
  try {
    const srcFile = state.sourceFiles.find(f => f.id === targetPage.sourceFileId);
    if (srcFile && srcFile.pdfDoc && !targetPage.isPastedImage) {
      const page = await srcFile.pdfDoc.getPage(targetPage.sourcePageNum);
      const viewport = page.getViewport({ scale: 2.8 });
      const hiCanvas = document.createElement('canvas');
      hiCanvas.width = viewport.width;
      hiCanvas.height = viewport.height;
      const hiCtx = hiCanvas.getContext('2d');
      await page.render({ canvasContext: hiCtx, viewport: viewport }).promise;
      if (targetPage.textItems && targetPage.textItems.length > 0) {
        drawTextItemsOnCanvas(hiCtx, hiCanvas.width, hiCanvas.height, targetPage.textItems);
      }
      if (DOM.zoomPreviewModal.style.display !== 'none' && DOM.zoomModalImg) {
        DOM.zoomModalImg.src = hiCanvas.toDataURL('image/jpeg', 0.94);
      }
    }
  } catch (hiErr) {
    console.warn('High-res 700% render fallback used:', hiErr);
  }
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
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId && !f.isHiddenCaptureStore);

  if (!activeFile) {
    DOM.sourceSubToolbar.style.display = 'none';
    if (DOM.sourceBottomMoveBar) DOM.sourceBottomMoveBar.style.display = 'none';
    DOM.sourceEmptyState.style.display = 'flex';
    updateSourceSelectionUI();
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
      <div class="source-card-footer">
        <span class="card-page-label" style="margin-top:0;">
          <span class="file-color-dot" style="background:${theme.dot}; width:6px; height:6px; border-radius:50%; display:inline-block; margin-right:3px;"></span>
          [파일 ${theme.fileNum}] ${pageItem.pageNum}p
        </span>
        <div class="source-card-actions">
          <button type="button" class="btn-source-zoom" title="크게 확대 보기">🔍</button>
          <button type="button" class="btn-source-card-move" title="이 페이지를 우측 편집창으로 바로 이동">이동 ▶</button>
        </div>
      </div>
    `;

    // Zoom button on source card (helpful on mobile & PC)
    const zoomBtn = card.querySelector('.btn-source-zoom');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideHoverPreview();
        openZoomModal(
          {
            sourceFileId: activeFile.id,
            sourceFileName: activeFile.name,
            sourcePageNum: pageItem.pageNum,
            thumbnailDataUrl: pageItem.thumbnailDataUrl,
            textItems: []
          },
          pageItem.pageNum,
          `<span class="file-color-dot" style="background:${theme.dot}; width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:6px;"></span>[선택창 미리보기] <strong style="color:#38bdf8">[파일 ${theme.fileNum}]</strong> ${activeFile.name} - ${pageItem.pageNum}p`
        );
      });
    }

    // 1-Click Direct Move button on source card
    const quickMoveBtn = card.querySelector('.btn-source-card-move');
    if (quickMoveBtn) {
      quickMoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideHoverPreview();
        if (state.selectedSourcePages.size > 0 && state.selectedSourcePages.has(pageItem.pageNum)) {
          moveSelectedSourcePagesToTarget();
        } else {
          insertSourcePagesAt(activeFile.id, [pageItem.pageNum], state.targetPages.length);
          showToast(`[파일 ${theme.fileNum}] ${pageItem.pageNum}페이지가 우측 편집창으로 이동되었습니다!`, '📤');
          scrollToNewlyAddedTargetPages();
        }
      });
    }

    // 400% Hover Zoom Preview Listeners (Left Source Panel - Desktop only)
    card.addEventListener('mouseenter', () => {
      if (!isTouchDevice()) {
        showHoverPreview(card, pageItem, `[파일 ${theme.fileNum}] ${activeFile.name} - ${pageItem.pageNum}페이지`, 400);
      }
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
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId && !f.isHiddenCaptureStore);
  const hasActiveFilePages = !!(activeFile && activeFile.pages && activeFile.pages.length > 0);

  if (DOM.sourceSelectionCount) DOM.sourceSelectionCount.textContent = `${count}개 선택됨`;
  if (DOM.addSelectedToTargetBtn) DOM.addSelectedToTargetBtn.disabled = count === 0;
  if (DOM.subtoolbarMoveBadge) DOM.subtoolbarMoveBadge.textContent = count;

  if (DOM.bottomSelectedCount) DOM.bottomSelectedCount.textContent = count;
  if (DOM.bottomMoveSelectedBtn) {
    DOM.bottomMoveSelectedBtn.disabled = count === 0;
    DOM.bottomMoveSelectedBtn.innerHTML = count > 0
      ? `<span>선택 페이지 편집창으로 이동 (${count}장) ▶</span>`
      : `<span>선택 페이지 편집창으로 이동 ▶</span>`;
  }
  if (DOM.bottomMoveAllBtn) DOM.bottomMoveAllBtn.disabled = !hasActiveFilePages;

  if (DOM.bridgeMoveSelectedBtn) {
    DOM.bridgeMoveSelectedBtn.disabled = count === 0;
    DOM.bridgeMoveSelectedBtn.classList.toggle('ready-pulse', count > 0);
  }
  if (DOM.bridgeSelectedCountBadge) {
    DOM.bridgeSelectedCountBadge.textContent = `${count}장`;
  }
  if (DOM.bridgeMoveAllBtn) {
    DOM.bridgeMoveAllBtn.disabled = !hasActiveFilePages;
  }

  if (DOM.mobileQuickMoveBtn) {
    DOM.mobileQuickMoveBtn.disabled = count === 0;
  }
  if (DOM.mobileSelectedBadge) {
    DOM.mobileSelectedBadge.textContent = count;
  }
}

function moveSelectedSourcePagesToTarget() {
  if (state.selectedSourcePages.size === 0 || !state.activeFileId) {
    showToast('먼저 왼쪽 선택창에서 이동할 페이지를 클릭하여 선택해 주세요.', '💡');
    return;
  }

  const count = state.selectedSourcePages.size;
  // Preserve selection order (or natural page order)
  const pagesArray = Array.from(state.selectedSourcePages);
  addPagesToTarget(state.activeFileId, pagesArray);

  state.selectedSourcePages.clear();
  state.lastSelectedSourcePage = null;
  updateSourceSelectionUI();
  updateSourcePageCardsDOM();

  showToast(`선택한 ${count}개 페이지가 우측 편집창으로 이동되었습니다!`, '📤');
  scrollToNewlyAddedTargetPages();
}

function moveAllSourcePagesToTarget() {
  const activeFile = state.sourceFiles.find(f => f.id === state.activeFileId && !f.isHiddenCaptureStore);
  if (!activeFile || !activeFile.pages || activeFile.pages.length === 0) return;

  const allPageNums = activeFile.pages.map(p => p.pageNum);
  addPagesToTarget(activeFile.id, allPageNums);

  state.selectedSourcePages.clear();
  state.lastSelectedSourcePage = null;
  updateSourceSelectionUI();
  updateSourcePageCardsDOM();

  showToast(`[${activeFile.name}] 전체 ${allPageNums.length}페이지가 우측 편집창으로 이동되었습니다!`, '⏩');
  scrollToNewlyAddedTargetPages();
}

function scrollToNewlyAddedTargetPages() {
  // On mobile single-view mode, switch to target editor view so user sees moved pages immediately
  if (window.innerWidth <= 1100 && state.mobileViewMode === 'source') {
    setMobileViewMode('target');
  }
  requestAnimationFrame(() => {
    const cards = DOM.targetPageGrid.querySelectorAll('.target-card.selected-card');
    if (cards.length > 0) {
      const lastAddedCard = cards[cards.length - 1];
      lastAddedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      cards.forEach(c => {
        c.classList.remove('highlight-flash');
        void c.offsetWidth;
        c.classList.add('highlight-flash');
      });
    }
  });
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

  const orderedNums = Array.from(pageNumbers);
  const newItems = [];
  orderedNums.forEach((pageNum) => {
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

/* ==========================================================================
   Clipboard Screenshot Paste (Ctrl+V) & Image-to-Page Support
   ========================================================================== */
function getOrCreateCaptureSourceStore() {
  let store = state.sourceFiles.find(f => f.id === 'source_captured_images');
  if (!store) {
    store = {
      id: 'source_captured_images',
      name: '캡처 화면 (Ctrl+V)',
      size: 0,
      isHiddenCaptureStore: true,
      pageCount: 0,
      pages: []
    };
    state.sourceFiles.push(store);
  }
  return store;
}

function loadImageElementFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function addCapturedImageBlobToTarget(blob, customName = null, insertPos = null) {
  try {
    const img = await loadImageElementFromBlob(blob);
    const natW = img.naturalWidth || img.width || 800;
    const natH = img.naturalHeight || img.height || 600;

    // Normalize image onto a high-res canvas (max 2200px) so PNG & JPEG data URLs are guaranteed valid
    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    const canvasW = Math.max(1, Math.round(natW * scale));
    const canvasH = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    // Fill white background behind transparent PNG captures
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    const highResPngDataUrl = canvas.toDataURL('image/png');
    const thumbJpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Proportional PDF page size matched to standard A4 width (595.28pt) or A4 landscape (841.89pt)
    const isLandscape = canvasW > canvasH * 1.15;
    const pdfWidth = isLandscape ? 841.89 : 595.28;
    const pdfHeight = Math.max(200, Math.round(pdfWidth * (canvasH / canvasW)));

    state.captureCount += 1;
    const captureNum = state.captureCount;
    const displayFileName = customName || `캡처화면_${captureNum}.png`;

    const store = getOrCreateCaptureSourceStore();
    store.pageCount += 1;
    store.pages.push({
      pageNum: captureNum,
      thumbnailDataUrl: thumbJpegDataUrl,
      pastedImageDataUrl: highResPngDataUrl,
      width: pdfWidth,
      height: pdfHeight
    });

    recordTargetHistory();

    const newTargetItem = {
      id: generateId(),
      sourceFileId: store.id,
      sourceFileName: displayFileName,
      sourcePageNum: captureNum,
      thumbnailDataUrl: thumbJpegDataUrl,
      pastedImageDataUrl: highResPngDataUrl,
      isPastedImage: true,
      width: pdfWidth,
      height: pdfHeight,
      textItems: []
    };

    const targetIdx = (insertPos !== null && insertPos !== undefined)
      ? Math.max(0, Math.min(insertPos, state.targetPages.length))
      : state.targetPages.length;

    state.targetPages.splice(targetIdx, 0, newTargetItem);

    state.selectedTargetPages.clear();
    state.selectedTargetPages.add(targetIdx);
    state.lastSelectedTargetIndex = targetIdx;

    renderTargetPages();
    scrollToNewlyAddedTargetPages();
    showToast(`캡처 화면(${displayFileName})이 우측 편집창에 추가되었습니다!`, '📋');
  } catch (err) {
    console.error('Failed to paste captured image:', err);
    alert('캡처 이미지를 붙여넣는 중 오류가 발생했습니다: ' + err.message);
  }
}

async function handleImageFilesToTarget(fileList, insertPos = null) {
  const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name));
  if (imageFiles.length === 0) return false;

  for (let i = 0; i < imageFiles.length; i++) {
    const pos = (insertPos !== null && insertPos !== undefined) ? insertPos + i : null;
    await addCapturedImageBlobToTarget(imageFiles[i], imageFiles[i].name, pos);
  }
  return true;
}

async function pasteFromClipboardButton() {
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const clipboardItems = await navigator.clipboard.read();
      let pastedCount = 0;
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          await addCapturedImageBlobToTarget(blob);
          pastedCount++;
        }
      }
      if (pastedCount > 0) return;
      showToast('클립보드에 복사된 캡처 이미지가 없습니다. 화면 캡처 후 다시 시도하거나 Ctrl+V를 눌러주세요.', '💡', 3500);
      return;
    } catch (err) {
      console.warn('Clipboard read API requires permission or fallback:', err);
    }
  }
  // Fallback for mobile or restricted clipboard API: prompt user or open image picker
  if (isTouchDevice() && DOM.pasteImageFileInput) {
    showToast('휴대폰에서 캡처한 이미지를 선택하여 바로 추가할 수 있습니다.', '📱', 3000);
    DOM.pasteImageFileInput.click();
  } else {
    showToast('키보드에서 [Ctrl + V]를 누르시면 캡처한 화면이 바로 붙여넣어집니다!', '📋', 3500);
    if (DOM.targetDropZone) DOM.targetDropZone.focus();
  }
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

// Update Target Selection Status & Print Button Labels in UI
function updateTargetSelectionUI() {
  const count = state.selectedTargetPages.size;
  const total = state.targetPages.length;

  if (DOM.selectAllTargetBtn) {
    DOM.selectAllTargetBtn.disabled = total === 0;
  }
  if (DOM.headerPrintBtn) {
    DOM.headerPrintBtn.disabled = total === 0;
  }
  if (DOM.printTargetBtn) {
    DOM.printTargetBtn.disabled = total === 0;
  }
  if (DOM.footerPrintBtn) {
    DOM.footerPrintBtn.disabled = total === 0;
  }

  if (count > 0) {
    DOM.targetSelectionCount.textContent = `${count}개 체크됨`;
    DOM.targetSelectionCount.style.display = 'inline-block';
    if (DOM.moveSelectedTargetBtn) DOM.moveSelectedTargetBtn.style.display = 'inline-block';
    DOM.deselectTargetBtn.style.display = 'inline-block';
    DOM.deleteSelectedTargetBtn.style.display = 'inline-block';

    if (DOM.printTargetBtnLabel) DOM.printTargetBtnLabel.textContent = `체크 출력 (${count}장)`;
    if (DOM.headerPrintBtnText) DOM.headerPrintBtnText.textContent = `체크 출력 (${count}장)`;
    if (DOM.footerPrintBtnText) DOM.footerPrintBtnText.textContent = `체크한 ${count}장 바로 출력`;
  } else {
    DOM.targetSelectionCount.style.display = 'none';
    if (DOM.moveSelectedTargetBtn) DOM.moveSelectedTargetBtn.style.display = 'none';
    DOM.deselectTargetBtn.style.display = 'none';
    DOM.deleteSelectedTargetBtn.style.display = 'none';

    if (DOM.printTargetBtnLabel) DOM.printTargetBtnLabel.textContent = total > 0 ? `전체 출력 (${total}장)` : '바로 출력';
    if (DOM.headerPrintBtnText) DOM.headerPrintBtnText.textContent = total > 0 ? `바로 출력 (${total}장)` : '바로 출력';
    if (DOM.footerPrintBtnText) DOM.footerPrintBtnText.textContent = total > 0 ? `편집창 전체(${total}장) 바로 출력` : '페이지 바로 출력';
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

// Open move page modal (supports single page or multi-selected pages)
function openMovePageModal(index, isMulti = false) {
  const total = state.targetPages.length;
  if (isMulti && state.selectedTargetPages.size > 0) {
    const sorted = Array.from(state.selectedTargetPages).sort((a, b) => a - b);
    state.movingMultipleIndexes = sorted;
    state.movingTargetIndex = sorted[0];
    DOM.moveModalSubtitle.textContent = `선택된 ${sorted.length}개 페이지 (${sorted.map(i => (i + 1) + 'p').join(', ')}) 위치를 일괄 변경합니다`;
    DOM.maxTargetPageNum.textContent = total;
    DOM.targetPosInput.max = total;
    DOM.targetPosInput.value = sorted[0] + 1;
    DOM.moveFirstBtn.disabled = false;
    DOM.movePrevBtn.disabled = sorted[0] === 0;
    DOM.moveNextBtn.disabled = sorted[sorted.length - 1] === total - 1;
    DOM.moveLastBtn.disabled = false;
  } else {
    state.movingMultipleIndexes = null;
    state.movingTargetIndex = index;
    const targetPage = state.targetPages[index];
    const theme = getFileTheme(targetPage.sourceFileId);
    const labelPrefix = targetPage.isPastedImage ? '📸 캡처' : `파일 ${theme.fileNum}`;

    DOM.moveModalSubtitle.textContent = `현재 ${index + 1}번째 페이지 (출처: [${labelPrefix}] ${targetPage.sourceFileName})`;
    DOM.maxTargetPageNum.textContent = total;
    DOM.targetPosInput.max = total;
    DOM.targetPosInput.value = index + 1;

    DOM.moveFirstBtn.disabled = index === 0;
    DOM.movePrevBtn.disabled = index === 0;
    DOM.moveNextBtn.disabled = index === total - 1;
    DOM.moveLastBtn.disabled = index === total - 1;
  }

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
      fileGroups.push({
        id: p.sourceFileId,
        name: p.isPastedImage ? '캡처 붙여넣기 (Ctrl+V)' : p.sourceFileName,
        isPastedImage: !!p.isPastedImage,
        count: 0
      });
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
    const tagTitle = grp.isPastedImage ? '📸 캡처' : `파일 ${theme.fileNum}`;
    chip.title = `클릭하면 [${tagTitle}]의 모든 페이지(${grp.count}장)를 일괄 선택합니다`;

    const shortName = grp.name.length > 16 ? grp.name.substring(0, 16) + '…' : grp.name;
    chip.innerHTML = `
      <span class="chip-dot" style="background:${theme.dot}; box-shadow:0 0 5px ${theme.border};"></span>
      <strong>${tagTitle}</strong>
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
  if (DOM.mobileTargetCount) DOM.mobileTargetCount.textContent = count;
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
    const isPasted = !!targetPage.isPastedImage;
    const sourceBadgeTitle = isPasted ? '📸 캡처' : `파일 ${theme.fileNum}`;
    const origPageText = isPasted ? `캡처 #${targetPage.sourcePageNum}` : `원래 ${targetPage.sourcePageNum}p`;

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
        <strong class="file-tag-num">${sourceBadgeTitle}</strong>
        <span class="file-tag-name" title="${targetPage.sourceFileName}">${targetPage.sourceFileName}</span>
        <span class="file-tag-orig-page">${origPageText}</span>
      </div>

      <div class="target-card-topbar">
        <span class="target-badge-index" title="클릭하여 원하는 페이지 번호로 순서 직접 변경">
          ${displayIndex}p ✎
        </span>
        <div class="target-shift-group">
          <button class="btn-shift btn-shift-zoom" title="700% 초대형 확대 보기">🔍</button>
          <button class="btn-shift btn-shift-prev" title="앞으로(좌측으로) 1칸 이동" ${index === 0 ? 'disabled' : ''}>◀</button>
          <button class="btn-shift btn-shift-next" title="뒤로(우측으로) 1칸 이동" ${index === count - 1 ? 'disabled' : ''}>▶</button>
        </div>
      </div>

      <div class="thumbnail-wrap">
        <img src="${targetPage.thumbnailDataUrl}" alt="Page ${displayIndex}" draggable="false" loading="lazy">
      </div>

      <div class="card-origin-info">
        <span class="card-origin-pill" style="background:${theme.badgeBg}; color:${theme.badgeText}; border:1px solid ${theme.border};" title="${targetPage.sourceFileName}">
          ${isPasted ? `📸 캡처 이미지 #${targetPage.sourcePageNum}` : `📁 [파일 ${theme.fileNum}] ${targetPage.sourcePageNum}p`}
        </span>
      </div>

      <div class="target-card-actions">
        <button class="btn btn-xs btn-card-zoom" title="이 페이지 700% 확대 보기">
          🔍 700%
        </button>
        <button class="btn btn-xs btn-edit-text" title="이 페이지에 제목이나 텍스트 작성">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          ${hasText ? '글 (' + targetPage.textItems.length + ')' : '글쓰기'}
        </button>
        <button class="btn btn-xs btn-card-print" title="이 페이지(또는 체크된 페이지들) 바로 출력">
          🖨️
        </button>
        <button class="btn btn-xs btn-card-del" title="이 페이지 제거">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Click-to-Zoom (Magnifier 700% Zoom on click)
    const handleZoomClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openZoomModal(targetPage, displayIndex);
    };

    const shiftZoomBtn = card.querySelector('.btn-shift-zoom');
    if (shiftZoomBtn) shiftZoomBtn.addEventListener('click', handleZoomClick);

    const cardZoomBtn = card.querySelector('.btn-card-zoom');
    if (cardZoomBtn) cardZoomBtn.addEventListener('click', handleZoomClick);

    // Direct Print Button on Card
    const cardPrintBtn = card.querySelector('.btn-card-print');
    if (cardPrintBtn) {
      cardPrintBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state.selectedTargetPages.size > 0 && state.selectedTargetPages.has(index)) {
          handlePrintTargetWorkspace();
        } else {
          printPagesDirect([targetPage], `편집창 ${displayIndex}페이지 출력`);
        }
      });
    }

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

  // 1b. Check if external files (images or PDFs) were dropped onto the right target panel
  if (!state.draggedTargetIndexes && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const droppedFiles = Array.from(e.dataTransfer.files);
    const imgFiles = droppedFiles.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name));
    if (imgFiles.length > 0) {
      handleImageFilesToTarget(imgFiles, targetPos);
      return;
    }
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
  recordTargetHistory();
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
  if (state.movingMultipleIndexes && state.movingMultipleIndexes.length > 0) {
    moveMultipleTargetPages(state.movingMultipleIndexes, 0);
    DOM.movePageModal.style.display = 'none';
  } else if (state.movingTargetIndex !== null) {
    moveTargetPageTo(state.movingTargetIndex, 0);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.movePrevBtn.addEventListener('click', () => {
  if (state.movingMultipleIndexes && state.movingMultipleIndexes.length > 0) {
    const firstIdx = Math.min(...state.movingMultipleIndexes);
    moveMultipleTargetPages(state.movingMultipleIndexes, Math.max(0, firstIdx - 1));
    DOM.movePageModal.style.display = 'none';
  } else if (state.movingTargetIndex !== null) {
    shiftTargetPage(state.movingTargetIndex, -1);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.moveNextBtn.addEventListener('click', () => {
  if (state.movingMultipleIndexes && state.movingMultipleIndexes.length > 0) {
    const lastIdx = Math.max(...state.movingMultipleIndexes);
    moveMultipleTargetPages(state.movingMultipleIndexes, Math.min(state.targetPages.length, lastIdx + 2));
    DOM.movePageModal.style.display = 'none';
  } else if (state.movingTargetIndex !== null) {
    shiftTargetPage(state.movingTargetIndex, 1);
    DOM.movePageModal.style.display = 'none';
  }
});
DOM.moveLastBtn.addEventListener('click', () => {
  if (state.movingMultipleIndexes && state.movingMultipleIndexes.length > 0) {
    moveMultipleTargetPages(state.movingMultipleIndexes, state.targetPages.length);
    DOM.movePageModal.style.display = 'none';
  } else if (state.movingTargetIndex !== null) {
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
  if (state.movingMultipleIndexes && state.movingMultipleIndexes.length > 0) {
    moveMultipleTargetPages(state.movingMultipleIndexes, targetIdx);
  } else {
    moveTargetPageTo(state.movingTargetIndex, targetIdx);
  }
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
  state.isAreaDragMode = false;
  state.detectedPdfTexts = [];

  DOM.modalPageDesc.textContent = `편집창 제 ${targetIndex + 1}페이지 (출처: ${targetPage.sourceFileName} - ${targetPage.sourcePageNum}p)`;
  DOM.textEditorModal.style.display = 'flex';

  toggleTextDetectionMode(false);
  toggleAreaDragMode(false);
  if (DOM.detectedTextSearchInput) DOM.detectedTextSearchInput.value = '';

  await renderModalPreviewPage(targetPage);
  refreshTextOverlays();
  refreshPageTextList();
  syncInspectorWithActiveItem();
}

async function renderModalPreviewPage(targetPage) {
  const canvas = DOM.editorPreviewCanvas;
  const ctx = canvas.getContext('2d');

  // If this target page is a pasted screenshot image
  if (targetPage.isPastedImage && (targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl)) {
    const imgUrl = targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl;
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const displayW = Math.round((targetPage.width || 595.28) * 1.15);
        const displayH = Math.round((targetPage.height || 841.89) * 1.15);
        canvas.width = displayW;
        canvas.height = displayH;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, displayW, displayH);
        ctx.drawImage(img, 0, 0, displayW, displayH);
        DOM.canvasWrapper.style.width = `${displayW}px`;
        DOM.canvasWrapper.style.height = 'auto';
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imgUrl;
    });
    state.detectedPdfTexts = [];
    if (DOM.detectedTextLayer) DOM.detectedTextLayer.innerHTML = '';
    if (DOM.detectBtnText) DOM.detectBtnText.textContent = '영역 드래그 수정';
    renderSmartDetectedList('');
    return;
  }

  const file = state.sourceFiles.find(f => f.id === targetPage.sourceFileId);
  if (!file || !file.pdfDoc) return;

  const page = await file.pdfDoc.getPage(targetPage.sourcePageNum);
  const viewport = page.getViewport({ scale: 1.25 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport: viewport }).promise;

  // Keep height: auto so canvasWrapper always matches scaled canvas 100% without bottom white gap
  DOM.canvasWrapper.style.width = `${viewport.width}px`;
  DOM.canvasWrapper.style.height = 'auto';

  // Scan and group detected existing texts on page into smart readable lines
  await scanPageDetectedTexts(page, viewport);
}

// Extract existing text items from PDF page and merge fragments on the same line into readable sentences
async function scanPageDetectedTexts(page, viewport) {
  state.detectedPdfTexts = [];
  if (!DOM.detectedTextLayer) return;
  DOM.detectedTextLayer.innerHTML = '';

  try {
    const textContent = await page.getTextContent();
    const items = textContent.items || [];
    const canvasWidth = viewport.width;
    const canvasHeight = viewport.height;

    // 1. Collect raw fragments in viewport coordinates
    const rawFragments = [];
    items.forEach((item) => {
      const rawStr = item.str || '';
      if (!rawStr.trim()) return;

      const pdfX = item.transform[4];
      const pdfY = item.transform[5];
      const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfY);

      const fontHeight = Math.max(10, Math.hypot(item.transform[0], item.transform[1]) * viewport.scale);
      const itemWidth = Math.max(item.width * viewport.scale, fontHeight * 0.6);
      const itemHeight = Math.max(fontHeight * 1.22, 14);

      const top = Math.max(0, vy - fontHeight * 0.92);
      const left = Math.max(0, vx);

      rawFragments.push({
        str: rawStr,
        left,
        top,
        right: left + itemWidth,
        bottom: top + itemHeight,
        width: itemWidth,
        height: itemHeight,
        fontHeight
      });
    });

    // 2. Sort top-to-bottom, then left-to-right
    rawFragments.sort((a, b) => {
      const yDiff = a.top - b.top;
      if (Math.abs(yDiff) > Math.min(a.fontHeight, b.fontHeight) * 0.55) {
        return yDiff;
      }
      return a.left - b.left;
    });

    // 3. Merge adjacent fragments on the same line into clean, meaningful phrases
    const mergedGroups = [];
    rawFragments.forEach((frag) => {
      const last = mergedGroups[mergedGroups.length - 1];
      if (last) {
        const sameLine = Math.abs(frag.top - last.top) <= Math.max(frag.fontHeight, last.fontHeight) * 0.6;
        const horizontalGap = frag.left - last.right;
        const maxMergeGap = Math.max(frag.fontHeight, last.fontHeight) * 2.2;
        if (sameLine && horizontalGap >= -frag.fontHeight * 0.5 && horizontalGap <= maxMergeGap) {
          const needsSpace = horizontalGap > Math.min(frag.fontHeight, last.fontHeight) * 0.28
            && !last.text.endsWith(' ')
            && !frag.str.startsWith(' ');
          last.text += (needsSpace ? ' ' : '') + frag.str;
          last.left = Math.min(last.left, frag.left);
          last.top = Math.min(last.top, frag.top);
          last.right = Math.max(last.right, frag.right);
          last.bottom = Math.max(last.bottom, frag.bottom);
          last.width = last.right - last.left;
          last.height = last.bottom - last.top;
          last.fontHeight = Math.max(last.fontHeight, frag.fontHeight);
          return;
        }
      }
      mergedGroups.push({
        text: frag.str.trim(),
        left: frag.left,
        top: frag.top,
        right: frag.right,
        bottom: frag.bottom,
        width: frag.width,
        height: frag.height,
        fontHeight: frag.fontHeight
      });
    });

    // 4. Build percentage-positioned smart overlay boxes & list items
    mergedGroups.forEach((grp, idx) => {
      const cleanText = grp.text.replace(/\s+/g, ' ').trim();
      if (!cleanText) return;

      const leftPct = Math.max(0, Math.min(98, (grp.left / canvasWidth) * 100));
      const topPct = Math.max(0, Math.min(98, (grp.top / canvasHeight) * 100));
      const widthPct = Math.max(2.5, Math.min(100 - leftPct, ((grp.width + 6) / canvasWidth) * 100));
      const heightPct = Math.max(1.8, Math.min(100 - topPct, ((grp.height + 4) / canvasHeight) * 100));

      const xPercent = Math.max(2, Math.min(98, leftPct + widthPct / 2));
      const yPercent = Math.max(2, Math.min(98, topPct + heightPct / 2));

      const detected = {
        id: `detect_${idx}`,
        index: idx + 1,
        text: cleanText,
        leftPct: Math.round(leftPct * 100) / 100,
        topPct: Math.round(topPct * 100) / 100,
        widthPct: Math.round(widthPct * 100) / 100,
        heightPct: Math.round(heightPct * 100) / 100,
        xPercent: Math.round(xPercent * 10) / 10,
        yPercent: Math.round(yPercent * 10) / 10,
        fontSize: Math.max(11, Math.min(44, Math.round(grp.fontHeight * 0.82)))
      };

      state.detectedPdfTexts.push(detected);

      // Create transparent underline box on canvas so underlying text remains 100% readable
      const div = document.createElement('div');
      div.className = 'detected-text-item';
      div.dataset.detectId = detected.id;
      div.style.left = `${detected.leftPct}%`;
      div.style.top = `${detected.topPct}%`;
      div.style.width = `${detected.widthPct}%`;
      div.style.height = `${detected.heightPct}%`;

      const safeSnippet = detected.text.length > 28 ? detected.text.substring(0, 28) + '…' : detected.text;
      div.innerHTML = `<span class="detected-text-badge">✏️ 클릭해 수정: "${safeSnippet.replace(/"/g, '&quot;')}"</span>`;

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        applyDetectedTextCorrection(detected);
      });

      DOM.detectedTextLayer.appendChild(div);
    });

    if (DOM.detectBtnText) {
      DOM.detectBtnText.textContent = `스마트 글자 감지 (${state.detectedPdfTexts.length}문장)`;
    }
    renderSmartDetectedList('');
  } catch (err) {
    console.warn('PDF text extraction error:', err);
  }
}

// Render the searchable & clickable list of detected text lines in the right panel
function renderSmartDetectedList(filterQuery = '') {
  if (!DOM.detectedTextQuickList) return;
  DOM.detectedTextQuickList.innerHTML = '';

  const q = (filterQuery || '').trim().toLowerCase();
  const list = state.detectedPdfTexts.filter(d => !q || d.text.toLowerCase().includes(q));

  if (DOM.detectedListCount) {
    DOM.detectedListCount.textContent = list.length;
  }

  if (list.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'padding: 10px; font-size: 0.76rem; color: #64748b; text-align: center;';
    emptyMsg.innerHTML = state.detectedPdfTexts.length === 0
      ? '이 페이지는 이미지/캡처 페이지입니다.<br>위의 <strong>[📐 화면에서 마우스 드래그로 영역 지정해 수정]</strong> 버튼을 눌러 원하는 글자 위를 드래그해 수정하세요!'
      : '검색어와 일치하는 문장이 없습니다.';
    DOM.detectedTextQuickList.appendChild(emptyMsg);
    return;
  }

  list.forEach((detected) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'smart-detected-row';
    row.innerHTML = `
      <span class="smart-detected-row-text" title="${detected.text.replace(/"/g, '&quot;')}">${detected.index}. ${detected.text}</span>
      <span class="smart-detected-row-action">선택 수정 ✎</span>
    `;

    // Two-way highlight with the left canvas preview
    row.addEventListener('mouseenter', () => {
      if (!DOM.detectedTextLayer) return;
      const targetBox = DOM.detectedTextLayer.querySelector(`[data-detect-id="${detected.id}"]`);
      if (targetBox) {
        targetBox.classList.add('highlight-focus');
      }
    });

    row.addEventListener('mouseleave', () => {
      if (!DOM.detectedTextLayer) return;
      const targetBox = DOM.detectedTextLayer.querySelector(`[data-detect-id="${detected.id}"]`);
      if (targetBox) {
        targetBox.classList.remove('highlight-focus');
      }
    });

    row.addEventListener('click', () => {
      applyDetectedTextCorrection(detected);
    });

    DOM.detectedTextQuickList.appendChild(row);
  });
}

// Toggle smart detection overlay & searchable list panel
function toggleTextDetectionMode(forceState = null) {
  state.isTextDetectMode = (forceState !== null) ? forceState : !state.isTextDetectMode;
  if (state.isTextDetectMode) {
    toggleAreaDragMode(false);
  }

  if (DOM.detectedTextLayer) {
    DOM.detectedTextLayer.style.display = state.isTextDetectMode ? 'block' : 'none';
  }

  if (DOM.smartDetectedListPanel) {
    DOM.smartDetectedListPanel.style.display = state.isTextDetectMode ? 'block' : 'none';
  }

  if (DOM.toggleTextDetectOverlayBtn) {
    DOM.toggleTextDetectOverlayBtn.style.background = state.isTextDetectMode ? 'rgba(56, 189, 248, 0.3)' : 'none';
  }

  if (DOM.detectExistingTextBtn) {
    DOM.detectExistingTextBtn.textContent = state.isTextDetectMode
      ? '✕ 스마트 감지 닫기 (화면 클릭 또는 아래 목록에서 선택)'
      : '🔍 스마트 글자 감지 & 목록에서 선택 수정';
  }
}

// Toggle direct area drag-to-replace mode on the canvas
function toggleAreaDragMode(forceState = null) {
  state.isAreaDragMode = (forceState !== null) ? forceState : !state.isAreaDragMode;
  if (state.isAreaDragMode) {
    toggleTextDetectionMode(false);
  }

  if (DOM.areaDragSelectionLayer) {
    DOM.areaDragSelectionLayer.style.display = state.isAreaDragMode ? 'block' : 'none';
  }
  if (DOM.areaDragRect) {
    DOM.areaDragRect.style.display = 'none';
  }
  if (DOM.dragAreaReplaceBtn) {
    if (state.isAreaDragMode) {
      DOM.dragAreaReplaceBtn.style.background = '#0284c7';
      DOM.dragAreaReplaceBtn.style.color = '#ffffff';
      DOM.dragAreaReplaceBtn.textContent = '✕ 영역 드래그 모드 취소 (왼쪽 화면에서 수정할 영역을 드래그하세요)';
    } else {
      DOM.dragAreaReplaceBtn.style.background = '#e0f2fe';
      DOM.dragAreaReplaceBtn.style.color = '#0369a1';
      DOM.dragAreaReplaceBtn.textContent = '📐 화면에서 마우스 드래그로 영역 지정해 수정';
    }
  }
}

// 1-Click Replace Detected Text: Masks original phrase with exact-sized whiteout box & pre-fills text
function applyDetectedTextCorrection(detected) {
  const newItem = {
    id: generateId(),
    text: detected.text,
    xPercent: detected.xPercent,
    yPercent: detected.yPercent,
    widthPercent: Math.max(6, Math.round((detected.widthPct + 1.2) * 10) / 10),
    heightPercent: Math.max(2.6, Math.round((detected.heightPct + 0.8) * 10) / 10),
    fontSize: detected.fontSize || 18,
    color: '#0f172a',
    fontWeight: 'bold',
    align: 'left',
    bg: 'white',
    padding: 8,
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
  }, 80);
}

// Initialize Canvas Area Drag-to-Select for covering & editing any rectangular region
(function initCanvasAreaDragSelection() {
  const layer = document.getElementById('areaDragSelectionLayer');
  const rectEl = document.getElementById('areaDragRect');
  if (!layer || !rectEl) return;

  function beginDrag(startClientX, startClientY, isTouch) {
    const wrapperRect = DOM.canvasWrapper.getBoundingClientRect();
    if (!wrapperRect.width || !wrapperRect.height) return;

    const startX = Math.max(0, Math.min(wrapperRect.width, startClientX - wrapperRect.left));
    const startY = Math.max(0, Math.min(wrapperRect.height, startClientY - wrapperRect.top));

    rectEl.style.display = 'flex';
    rectEl.style.left = `${startX}px`;
    rectEl.style.top = `${startY}px`;
    rectEl.style.width = '0px';
    rectEl.style.height = '0px';
    rectEl.textContent = '';

    let curLeft = startX;
    let curTop = startY;
    let curW = 0;
    let curH = 0;

    function onMove(clientX, clientY) {
      const curX = Math.max(0, Math.min(wrapperRect.width, clientX - wrapperRect.left));
      const curY = Math.max(0, Math.min(wrapperRect.height, clientY - wrapperRect.top));
      curLeft = Math.min(startX, curX);
      curTop = Math.min(startY, curY);
      curW = Math.abs(curX - startX);
      curH = Math.abs(curY - startY);

      rectEl.style.left = `${curLeft}px`;
      rectEl.style.top = `${curTop}px`;
      rectEl.style.width = `${curW}px`;
      rectEl.style.height = `${curH}px`;
      rectEl.textContent = curW > 50 && curH > 18 ? '여기에 덮어쓰기' : '';
    }

    function onEnd() {
      rectEl.style.display = 'none';
      if (curW < 12 || curH < 10) return;

      const leftPct = (curLeft / wrapperRect.width) * 100;
      const topPct = (curTop / wrapperRect.height) * 100;
      const widthPct = Math.max(4, Math.round((curW / wrapperRect.width) * 1000) / 10);
      const heightPct = Math.max(2.5, Math.round((curH / wrapperRect.height) * 1000) / 10);
      const xPercent = Math.round((leftPct + widthPct / 2) * 10) / 10;
      const yPercent = Math.round((topPct + heightPct / 2) * 10) / 10;

      // Check if any detected PDF text falls inside this dragged rectangle
      const matchedTexts = state.detectedPdfTexts.filter(d => {
        const cx = d.xPercent;
        const cy = d.yPercent;
        return cx >= leftPct - 2 && cx <= leftPct + widthPct + 2 && cy >= topPct - 2 && cy <= topPct + heightPct + 2;
      });

      const initialText = matchedTexts.length > 0
        ? matchedTexts.map(m => m.text).join(' ')
        : '수정할 글씨 입력';

      const estFontSize = Math.max(12, Math.min(36, Math.round(curH * 0.55)));

      const newItem = {
        id: generateId(),
        text: initialText,
        xPercent,
        yPercent,
        widthPercent: widthPct,
        heightPercent: heightPct,
        fontSize: estFontSize,
        color: '#0f172a',
        fontWeight: 'bold',
        align: 'center',
        bg: 'white',
        padding: 8,
        isEraserOnly: false
      };

      state.activePageDraftTexts.push(newItem);
      selectTextItem(newItem.id);
      refreshPageTextList();
      refreshTextOverlays();
      toggleAreaDragMode(false);

      setTimeout(() => {
        if (DOM.textInputContent) {
          DOM.textInputContent.focus();
          DOM.textInputContent.select();
        }
      }, 80);
    }

    if (isTouch) {
      function handleTouchMove(ev) {
        if (ev.touches && ev.touches.length > 0) {
          ev.preventDefault();
          onMove(ev.touches[0].clientX, ev.touches[0].clientY);
        }
      }
      function handleTouchEnd() {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        onEnd();
      }
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      function handleMouseMove(ev) {
        onMove(ev.clientX, ev.clientY);
      }
      function handleMouseUp() {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        onEnd();
      }
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  }

  layer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    beginDrag(e.clientX, e.clientY, false);
  });

  layer.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  }, { passive: false });
})();

function refreshTextOverlays() {
  DOM.textOverlaysContainer.innerHTML = '';

  state.activePageDraftTexts.forEach((item) => {
    const el = document.createElement('div');
    const isSelected = item.id === state.activeTextItemId;
    el.className = `text-overlay-item ${isSelected ? 'active' : ''} ${item.isEraserOnly ? 'eraser-item' : ''} ${item.bg === 'white' ? 'bg-whiteout' : ''}`;
    el.dataset.id = item.id;

    const textSpan = document.createElement('div');
    textSpan.className = 'overlay-text-content';

    if (item.isEraserOnly) {
      textSpan.textContent = '🧼 [ 가림 영역 ]';
      if (item.widthPercent) {
        el.style.width = `${item.widthPercent}%`;
      } else {
        el.style.minWidth = `${item.boxWidth || 120}px`;
      }
      if (item.heightPercent) {
        el.style.height = `${item.heightPercent}%`;
      } else {
        el.style.minHeight = `${item.boxHeight || 34}px`;
      }
      el.style.background = item.bg === 'custom' && item.customBg ? item.customBg : '#ffffff';
      el.style.padding = `${item.padding || 8}px`;
    } else {
      textSpan.textContent = item.text || '(내용 없음)';
      el.style.fontSize = `${item.fontSize}px`;
      el.style.color = item.color;
      el.style.fontWeight = item.fontWeight === 'bold' ? '700' : '400';
      el.style.textAlign = item.align || 'center';
      textSpan.style.textAlign = item.align || 'center';

      const pad = item.padding !== undefined ? item.padding : (item.bg === 'white' ? 12 : 8);
      el.style.padding = `${Math.round(pad * 0.55)}px ${pad}px`;

      // Apply custom stretched/shrunk width & height if set via dashed line handles
      if (item.widthPercent) {
        el.style.width = `${item.widthPercent}%`;
      }
      if (item.heightPercent) {
        el.style.height = `${item.heightPercent}%`;
      }

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

    el.appendChild(textSpan);

    // If this text/whiteout box is active, render 8 resize handles on the dashed line + floating triangle toolbar
    if (isSelected) {
      // Floating quick triangle font-size bar above the active box
      if (!item.isEraserOnly) {
        const floatBar = document.createElement('div');
        floatBar.className = 'overlay-floating-toolbar';
        floatBar.innerHTML = `
          <button type="button" class="float-tri-down" title="글자 크기 작게 (▼)">▼ 작게</button>
          <span style="padding: 0 3px; color: #e2e8f0;">${item.fontSize}px</span>
          <button type="button" class="float-tri-up" title="글자 크기 크게 (▲)">▲ 크게</button>
        `;
        floatBar.addEventListener('mousedown', (ev) => ev.stopPropagation());
        floatBar.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: false });

        floatBar.querySelector('.float-tri-down').addEventListener('click', (ev) => {
          ev.stopPropagation();
          adjustActiveTextFontSize(-2);
        });
        floatBar.querySelector('.float-tri-up').addEventListener('click', (ev) => {
          ev.stopPropagation();
          adjustActiveTextFontSize(2);
        });
        el.appendChild(floatBar);
      }

      // 8-direction resize handles right on the dashed line (nw, n, ne, e, se, s, sw, w)
      const handleDirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      handleDirs.forEach((dir) => {
        const handle = document.createElement('div');
        handle.className = `box-resize-handle handle-${dir}`;
        handle.title = '드래그하여 점선 박스 크기를 자유롭게 늘리거나 줄입니다';

        handle.addEventListener('mousedown', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          startResizingTextItem(ev, item.id, dir, false);
        });

        handle.addEventListener('touchstart', (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          startResizingTextItem(ev, item.id, dir, true);
        }, { passive: false });

        el.appendChild(handle);
      });
    }

    el.style.left = `${item.xPercent}%`;
    el.style.top = `${item.yPercent}%`;

    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('box-resize-handle') || e.target.closest('.overlay-floating-toolbar')) return;
      e.stopPropagation();
      selectTextItem(item.id);
      startDraggingTextItem(e, item.id, false);
    });

    el.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('box-resize-handle') || e.target.closest('.overlay-floating-toolbar')) return;
      e.stopPropagation();
      selectTextItem(item.id);
      startDraggingTextItem(e, item.id, true);
    }, { passive: false });

    DOM.textOverlaysContainer.appendChild(el);
  });
}

// Freely stretch or shrink the dashed box using any of the 8 handles on the dashed line
function startResizingTextItem(e, itemId, dir, isTouch = false) {
  const containerRect = DOM.canvasWrapper.getBoundingClientRect();
  const item = state.activePageDraftTexts.find(t => t.id === itemId);
  const domEl = DOM.textOverlaysContainer.querySelector(`[data-id="${itemId}"]`);
  if (!item || !domEl || !containerRect.width || !containerRect.height) return;

  const startClientX = isTouch && e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
  const startClientY = isTouch && e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;

  const boxRect = domEl.getBoundingClientRect();
  const startW = boxRect.width;
  const startH = boxRect.height;
  const startCenterX = (item.xPercent / 100) * containerRect.width;
  const startCenterY = (item.yPercent / 100) * containerRect.height;

  function updateBoxSize(clientX, clientY) {
    const dx = clientX - startClientX;
    const dy = clientY - startClientY;

    let newW = startW;
    let newH = startH;
    let newCenterX = startCenterX;
    let newCenterY = startCenterY;

    if (dir.includes('e')) {
      newW = Math.max(28, startW + dx);
      newCenterX = startCenterX + (newW - startW) / 2;
    }
    if (dir.includes('w')) {
      newW = Math.max(28, startW - dx);
      newCenterX = startCenterX - (newW - startW) / 2;
    }
    if (dir.includes('s')) {
      newH = Math.max(18, startH + dy);
      newCenterY = startCenterY + (newH - startH) / 2;
    }
    if (dir.includes('n')) {
      newH = Math.max(18, startH - dy);
      newCenterY = startCenterY - (newH - startH) / 2;
    }

    item.widthPercent = Math.max(2, Math.min(98, Math.round((newW / containerRect.width) * 1000) / 10));
    item.heightPercent = Math.max(1.5, Math.min(98, Math.round((newH / containerRect.height) * 1000) / 10));
    item.xPercent = Math.max(2, Math.min(98, Math.round((newCenterX / containerRect.width) * 1000) / 10));
    item.yPercent = Math.max(2, Math.min(98, Math.round((newCenterY / containerRect.height) * 1000) / 10));

    // Also update legacy pixel fallback fields for erasers
    item.boxWidth = Math.round(newW);
    item.boxHeight = Math.round(newH);

    domEl.style.width = `${item.widthPercent}%`;
    domEl.style.height = `${item.heightPercent}%`;
    domEl.style.left = `${item.xPercent}%`;
    domEl.style.top = `${item.yPercent}%`;

    if (DOM.boxSizeStatusText) {
      DOM.boxSizeStatusText.innerHTML = `점선 박스 크기: <strong>가로 ${Math.round(item.widthPercent)}% × 세로 ${Math.round(item.heightPercent)}%</strong> (자유 조절됨)`;
    }
  }

  if (isTouch) {
    function onTouchMove(moveEvent) {
      if (moveEvent.touches && moveEvent.touches.length > 0) {
        moveEvent.preventDefault();
        updateBoxSize(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    }
    function onTouchEnd() {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      syncInspectorWithActiveItem();
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  } else {
    function onMouseMove(moveEvent) {
      updateBoxSize(moveEvent.clientX, moveEvent.clientY);
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      syncInspectorWithActiveItem();
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}

function startDraggingTextItem(e, itemId, isTouch = false) {
  const containerRect = DOM.canvasWrapper.getBoundingClientRect();
  const item = state.activePageDraftTexts.find(t => t.id === itemId);
  if (!item || !containerRect.width || !containerRect.height) return;

  const startClientX = isTouch && e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
  const startClientY = isTouch && e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
  const startXPct = item.xPercent;
  const startYPct = item.yPercent;

  function updateItemPosition(clientX, clientY) {
    const dxPct = ((clientX - startClientX) / containerRect.width) * 100;
    const dyPct = ((clientY - startClientY) / containerRect.height) * 100;

    const xPct = Math.max(2, Math.min(98, startXPct + dxPct));
    const yPct = Math.max(2, Math.min(98, startYPct + dyPct));

    item.xPercent = Math.round(xPct * 10) / 10;
    item.yPercent = Math.round(yPct * 10) / 10;

    const domEl = DOM.textOverlaysContainer.querySelector(`[data-id="${itemId}"]`);
    if (domEl) {
      domEl.style.left = `${item.xPercent}%`;
      domEl.style.top = `${item.yPercent}%`;
    }
  }

  if (isTouch) {
    function onTouchMove(moveEvent) {
      if (moveEvent.touches && moveEvent.touches.length > 0) {
        moveEvent.preventDefault();
        updateItemPosition(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    }
    function onTouchEnd() {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  } else {
    function onMouseMove(moveEvent) {
      updateItemPosition(moveEvent.clientX, moveEvent.clientY);
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
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

  if (DOM.boxSizeStatusText) {
    if (item.widthPercent || item.heightPercent) {
      DOM.boxSizeStatusText.innerHTML = `점선 박스 크기: <strong>가로 ${Math.round(item.widthPercent || 20)}% × 세로 ${Math.round(item.heightPercent || 6)}%</strong> (핸들로 조절됨)`;
    } else {
      DOM.boxSizeStatusText.innerHTML = `점선 테두리의 <strong>파란 핸들(8방향)</strong>을 끌어 박스를 자유롭게 늘리고 줄이세요`;
    }
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
    const labelText = item.isEraserOnly
      ? '[영역 지우개 / 화이트아웃]'
      : (item.text ? item.text.replace(/\n/g, ' ') : '(내용 없음)');
    li.innerHTML = `
      <span class="text-item-snippet">${idx + 1}. ${labelText}</span>
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
    text: preset.text !== undefined ? preset.text : '제목을 입력하세요',
    xPercent: preset.xPercent !== undefined ? preset.xPercent : 50,
    yPercent: preset.yPercent !== undefined ? preset.yPercent : 15,
    widthPercent: preset.widthPercent || null,
    heightPercent: preset.heightPercent || null,
    fontSize: preset.fontSize || 26,
    color: preset.color || '#1e293b',
    fontWeight: preset.fontWeight || 'bold',
    align: preset.align || 'center',
    bg: preset.bg || 'white',
    padding: preset.padding !== undefined ? preset.padding : 12,
    isEraserOnly: !!preset.isEraserOnly,
    boxWidth: preset.boxWidth || null,
    boxHeight: preset.boxHeight || null
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

// Adjust font size via Triangle Buttons (▲ / ▼)
function adjustActiveTextFontSize(delta) {
  const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
  if (!item) return;
  const nextSize = Math.max(8, Math.min(72, (item.fontSize || 20) + delta));
  item.fontSize = nextSize;
  if (DOM.textFontSizeRange) DOM.textFontSizeRange.value = nextSize;
  if (DOM.textFontSizeVal) DOM.textFontSizeVal.textContent = `${nextSize}px`;
  refreshTextOverlays();
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

// Triangle Button Listeners for Font Size Adjustment
if (DOM.fontSizeDownBtn) {
  DOM.fontSizeDownBtn.addEventListener('click', () => adjustActiveTextFontSize(-2));
}
if (DOM.fontSizeUpBtn) {
  DOM.fontSizeUpBtn.addEventListener('click', () => adjustActiveTextFontSize(2));
}
if (DOM.fontSizeStepUpBtn) {
  DOM.fontSizeStepUpBtn.addEventListener('click', () => adjustActiveTextFontSize(1));
}
if (DOM.fontSizeStepDownBtn) {
  DOM.fontSizeStepDownBtn.addEventListener('click', () => adjustActiveTextFontSize(-1));
}

// Reset custom stretched/shrunk box size to auto-fit text
if (DOM.resetBoxSizeBtn) {
  DOM.resetBoxSizeBtn.addEventListener('click', () => {
    const item = state.activePageDraftTexts.find(t => t.id === state.activeTextItemId);
    if (item) {
      item.widthPercent = null;
      item.heightPercent = null;
      refreshTextOverlays();
      syncInspectorWithActiveItem();
    }
  });
}

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

if (DOM.dragAreaReplaceBtn) {
  DOM.dragAreaReplaceBtn.addEventListener('click', () => {
    toggleAreaDragMode();
  });
}

if (DOM.detectedTextSearchInput) {
  DOM.detectedTextSearchInput.addEventListener('input', (e) => {
    renderSmartDetectedList(e.target.value);
  });
}

if (DOM.addReplacePatchBtn) {
  DOM.addReplacePatchBtn.addEventListener('click', () => {
    addNewTextItem({
      text: '수정할 글씨 입력',
      xPercent: 50,
      yPercent: 45,
      widthPercent: 28,
      heightPercent: 7,
      fontSize: 22,
      color: '#0f172a',
      fontWeight: 'bold',
      align: 'center',
      bg: 'white',
      padding: 12,
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
      widthPercent: 24,
      heightPercent: 6,
      fontSize: 16,
      color: '#64748b',
      fontWeight: 'normal',
      align: 'center',
      bg: 'white',
      padding: 12,
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
        const boxWidth = item.widthPercent
          ? (item.widthPercent / 100) * canvas.width
          : ((item.boxWidth || 120) * scale + padX * 2);
        const boxHeight = item.heightPercent
          ? (item.heightPercent / 100) * canvas.height
          : ((item.boxHeight || 36) * scale + padY * 2);
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
      const autoBoxW = maxLineWidth + padX * 2;
      const autoBoxH = totalBlockHeight + padY * 2;

      const boxWidth = item.widthPercent ? (item.widthPercent / 100) * canvas.width : autoBoxW;
      const boxHeight = item.heightPercent ? (item.heightPercent / 100) * canvas.height : autoBoxH;
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
      const innerPadX = Math.min(padX, boxWidth * 0.15);
      lines.forEach((line, lIdx) => {
        const lineY = startY + lIdx * lineHeight;
        if (item.align === 'left') {
          ctx.textAlign = 'left';
          ctx.fillText(line, boxX + innerPadX, lineY);
        } else if (item.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(line, boxX + boxWidth - innerPadX, lineY);
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
        isPastedImage: !!tp.isPastedImage,
        pastedImageDataUrl: tp.pastedImageDataUrl || null,
        width: tp.width || 595.28,
        height: tp.height || 841.89,
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
      let addedPage = null;

      if (targetPage.isPastedImage && (targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl)) {
        const pageW = targetPage.width || 595.28;
        const pageH = targetPage.height || 841.89;
        addedPage = mergedDoc.addPage([pageW, pageH]);
        const imgDataUrl = targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl;
        const embeddedImg = imgDataUrl.startsWith('data:image/png')
          ? await mergedDoc.embedPng(imgDataUrl)
          : await mergedDoc.embedJpg(imgDataUrl);
        addedPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH
        });
      } else {
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
        addedPage = mergedDoc.addPage(copiedPage);
      }

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

/* ==========================================================================
   Direct High-Resolution Page Printing (체크한 페이지 / 편집 중 페이지 바로 출력)
   ========================================================================== */

// Render a single targetPage (including its text/whiteout edits) to a crisp high-res Data URL for printing
async function renderHighResPageForPrint(targetPage) {
  try {
    // 1. Pasted screenshot / image page
    if (targetPage.isPastedImage && (targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl)) {
      const imgUrl = targetPage.pastedImageDataUrl || targetPage.thumbnailDataUrl;
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 2.0;
          canvas.width = Math.round((targetPage.width || 595.28) * scale);
          canvas.height = Math.round((targetPage.height || 841.89) * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (targetPage.textItems && targetPage.textItems.length > 0) {
            drawTextItemsOnCanvas(ctx, canvas.width, canvas.height, targetPage.textItems);
          }
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imgUrl);
        img.src = imgUrl;
      });
    }

    // 2. Standard PDF source page rendered at high resolution (scale 2.2)
    const srcFile = state.sourceFiles.find(f => f.id === targetPage.sourceFileId);
    if (srcFile && srcFile.pdfDoc) {
      const page = await srcFile.pdfDoc.getPage(targetPage.sourcePageNum);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (targetPage.textItems && targetPage.textItems.length > 0) {
        drawTextItemsOnCanvas(ctx, canvas.width, canvas.height, targetPage.textItems);
      }
      return canvas.toDataURL('image/png');
    }
  } catch (err) {
    console.warn('High-res print render fallback used:', err);
  }

  // Fallback to composite preview
  return getCompositePreviewUrl(targetPage);
}

// Print an array of targetPages directly via a dedicated print iframe
async function printPagesDirect(pagesToPrint, jobLabel = 'PDF 인쇄') {
  if (!pagesToPrint || pagesToPrint.length === 0) {
    alert('출력할 페이지가 없습니다. 먼저 편집창에 페이지를 추가하거나 체크해 주세요.');
    return;
  }

  const total = pagesToPrint.length;
  showLoading('프린터 출력 준비 중...', `총 ${total}페이지의 고화질 인쇄 데이터를 생성하고 있습니다...`, 15);

  try {
    const pageImgUrls = [];
    for (let i = 0; i < total; i++) {
      const progress = Math.round(15 + ((i + 1) / total) * 75);
      updateLoadingProgress(progress, `${i + 1} / ${total} 페이지 고화질 렌더링 중...`);
      const dataUrl = await renderHighResPageForPrint(pagesToPrint[i]);
      pageImgUrls.push({
        url: dataUrl,
        isLandscape: (pagesToPrint[i].width || 595) > (pagesToPrint[i].height || 842)
      });
    }

    updateLoadingProgress(95, '프린터 인쇄 창을 여는 중...');

    // Create or reuse hidden print iframe
    let printIframe = document.getElementById('directPrintIframe');
    if (printIframe) {
      printIframe.remove();
    }
    printIframe = document.createElement('iframe');
    printIframe.id = 'directPrintIframe';
    printIframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
    document.body.appendChild(printIframe);

    const pagesHtml = pageImgUrls.map((item, idx) => `
      <div class="print-sheet ${idx < pageImgUrls.length - 1 ? 'page-break' : ''}">
        <img src="${item.url}" alt="Page ${idx + 1}">
      </div>
    `).join('');

    const iframeDoc = printIframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${jobLabel}</title>
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-sheet {
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #ffffff;
    }
    .print-sheet.page-break {
      page-break-after: always;
      break-after: page;
    }
    .print-sheet img {
      max-width: 100%;
      max-height: 100vh;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`);
    iframeDoc.close();

    // Wait for all images inside the print iframe to finish loading before calling print()
    const imgs = Array.from(iframeDoc.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }));

    hideLoading();
    showToast(`🖨️ 총 ${total}페이지 인쇄 창을 실행합니다.`, '🖨️');

    setTimeout(() => {
      printIframe.contentWindow.focus();
      printIframe.contentWindow.print();
    }, 150);
  } catch (err) {
    hideLoading();
    console.error('Print error:', err);
    alert('페이지 출력 준비 중 오류가 발생했습니다: ' + err.message);
  }
}

// Print checked target pages (if any checked) or all target pages in the editor workspace
async function handlePrintTargetWorkspace() {
  if (state.targetPages.length === 0) {
    alert('편집창에 출력할 페이지가 없습니다. 먼저 페이지를 편집창으로 이동하거나 추가해 주세요.');
    return;
  }

  // If user checked specific pages in the editor panel, print all checked pages in order
  if (state.selectedTargetPages.size > 0) {
    const sortedIdxs = Array.from(state.selectedTargetPages).sort((a, b) => a - b);
    const checkedPages = sortedIdxs.map(idx => state.targetPages[idx]).filter(Boolean);
    await printPagesDirect(checkedPages, `체크된_${checkedPages.length}페이지_인쇄`);
  } else {
    // Otherwise print all pages in the editor panel
    await printPagesDirect(state.targetPages, `편집창_전체_${state.targetPages.length}페이지_인쇄`);
  }
}

// Print the page currently being edited inside the Text Editor Modal (including live draft edits)
async function handlePrintCurrentModalPage() {
  if (state.editingTargetPageIndex === null) return;
  const targetPage = state.targetPages[state.editingTargetPageIndex];
  if (!targetPage) return;

  // Apply current draft text edits to a temporary clone (and also sync to targetPage so edits aren't lost)
  targetPage.textItems = JSON.parse(JSON.stringify(state.activePageDraftTexts));
  renderTargetPages();

  // If multiple pages are checked and include or accompany this editing page, check if user wants checked pages or just this page
  await printPagesDirect([targetPage], `편집중_${state.editingTargetPageIndex + 1}페이지_인쇄`);
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

// All Move Buttons (Top Subtoolbar, Bottom Sticky Bar, Center Bridge, Mobile Quick Move)
if (DOM.addSelectedToTargetBtn) {
  DOM.addSelectedToTargetBtn.addEventListener('click', moveSelectedSourcePagesToTarget);
}
if (DOM.bottomMoveSelectedBtn) {
  DOM.bottomMoveSelectedBtn.addEventListener('click', moveSelectedSourcePagesToTarget);
}
if (DOM.bridgeMoveSelectedBtn) {
  DOM.bridgeMoveSelectedBtn.addEventListener('click', moveSelectedSourcePagesToTarget);
}
if (DOM.mobileQuickMoveBtn) {
  DOM.mobileQuickMoveBtn.addEventListener('click', moveSelectedSourcePagesToTarget);
}
if (DOM.bottomMoveAllBtn) {
  DOM.bottomMoveAllBtn.addEventListener('click', moveAllSourcePagesToTarget);
}
if (DOM.bridgeMoveAllBtn) {
  DOM.bridgeMoveAllBtn.addEventListener('click', moveAllSourcePagesToTarget);
}

// Mobile Panel Navigation Tabs
if (DOM.mobileTabBoth) {
  DOM.mobileTabBoth.addEventListener('click', () => setMobileViewMode('both'));
}
if (DOM.mobileTabSource) {
  DOM.mobileTabSource.addEventListener('click', () => setMobileViewMode('source'));
}
if (DOM.mobileTabTarget) {
  DOM.mobileTabTarget.addEventListener('click', () => setMobileViewMode('target'));
}

// Clipboard Paste (Ctrl+V) Global Listener & Buttons
window.addEventListener('paste', async (e) => {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const imageBlobs = [];
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) imageBlobs.push(blob);
      }
    }
  }
  if (imageBlobs.length === 0 && clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file.type && file.type.startsWith('image/')) {
        imageBlobs.push(file);
      }
    }
  }

  if (imageBlobs.length > 0) {
    e.preventDefault();
    for (const blob of imageBlobs) {
      await addCapturedImageBlobToTarget(blob);
    }
  }
});

if (DOM.pasteClipboardBtn) {
  DOM.pasteClipboardBtn.addEventListener('click', pasteFromClipboardButton);
}
if (DOM.emptyStatePasteBtn) {
  DOM.emptyStatePasteBtn.addEventListener('click', pasteFromClipboardButton);
}
if (DOM.uploadImageToTargetBtn && DOM.pasteImageFileInput) {
  DOM.uploadImageToTargetBtn.addEventListener('click', () => DOM.pasteImageFileInput.click());
}
if (DOM.emptyStateImageUploadBtn && DOM.pasteImageFileInput) {
  DOM.emptyStateImageUploadBtn.addEventListener('click', () => DOM.pasteImageFileInput.click());
}
if (DOM.pasteImageFileInput) {
  DOM.pasteImageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageFilesToTarget(e.target.files);
      e.target.value = '';
    }
  });
}

if (DOM.moveSelectedTargetBtn) {
  DOM.moveSelectedTargetBtn.addEventListener('click', () => {
    if (state.selectedTargetPages.size > 0) {
      const firstSelected = Math.min(...Array.from(state.selectedTargetPages));
      openMovePageModal(firstSelected, true);
    }
  });
}

if (DOM.selectAllTargetBtn) {
  DOM.selectAllTargetBtn.addEventListener('click', () => {
    state.selectedTargetPages.clear();
    state.targetPages.forEach((_, idx) => state.selectedTargetPages.add(idx));
    state.lastSelectedTargetIndex = state.targetPages.length > 0 ? state.targetPages.length - 1 : null;
    updateTargetSelectionUI();
    updateTargetPageCardsDOM();
  });
}

if (DOM.headerPrintBtn) {
  DOM.headerPrintBtn.addEventListener('click', handlePrintTargetWorkspace);
}
if (DOM.printTargetBtn) {
  DOM.printTargetBtn.addEventListener('click', handlePrintTargetWorkspace);
}
if (DOM.footerPrintBtn) {
  DOM.footerPrintBtn.addEventListener('click', handlePrintTargetWorkspace);
}
if (DOM.printModalPageBtn) {
  DOM.printModalPageBtn.addEventListener('click', handlePrintCurrentModalPage);
}

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
    recordTargetHistory();
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

// Global Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Ctrl+P (Direct Print), ESC (Close Modals)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeZoomModal();
    DOM.guideModal.style.display = 'none';
    DOM.movePageModal.style.display = 'none';
    DOM.downloadReadyModal.style.display = 'none';
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
    if (DOM.textEditorModal && DOM.textEditorModal.style.display !== 'none') {
      e.preventDefault();
      handlePrintCurrentModalPage();
      return;
    }
    if (state.targetPages.length > 0) {
      e.preventDefault();
      handlePrintTargetWorkspace();
      return;
    }
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

// 700% Zoom Preview Modal Listeners & Scale Controls
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
if (DOM.zoomInBtn) {
  DOM.zoomInBtn.addEventListener('click', () => {
    const nextScale = Math.min(1000, (state.isZoomFitMode ? 400 : state.currentZoomPercent) + 100);
    applyZoomModalScale(nextScale, false);
  });
}
if (DOM.zoomOutBtn) {
  DOM.zoomOutBtn.addEventListener('click', () => {
    const nextScale = Math.max(100, (state.isZoomFitMode ? 400 : state.currentZoomPercent) - 100);
    applyZoomModalScale(nextScale, false);
  });
}
if (DOM.zoomReset700Btn) {
  DOM.zoomReset700Btn.addEventListener('click', () => {
    applyZoomModalScale(700, false);
  });
}
if (DOM.zoomFitBtn) {
  DOM.zoomFitBtn.addEventListener('click', () => {
    applyZoomModalScale(700, true);
  });
}

// Enable click-and-drag panning inside 700% zoom modal body
if (DOM.zoomModalBody) {
  let isPanningZoom = false;
  let panStartX = 0;
  let panStartY = 0;
  let panScrollLeft = 0;
  let panScrollTop = 0;

  DOM.zoomModalBody.addEventListener('mousedown', (e) => {
    isPanningZoom = true;
    panStartX = e.pageX - DOM.zoomModalBody.offsetLeft;
    panStartY = e.pageY - DOM.zoomModalBody.offsetTop;
    panScrollLeft = DOM.zoomModalBody.scrollLeft;
    panScrollTop = DOM.zoomModalBody.scrollTop;
  });

  window.addEventListener('mouseup', () => {
    isPanningZoom = false;
  });

  DOM.zoomModalBody.addEventListener('mousemove', (e) => {
    if (!isPanningZoom) return;
    e.preventDefault();
    const x = e.pageX - DOM.zoomModalBody.offsetLeft;
    const y = e.pageY - DOM.zoomModalBody.offsetTop;
    DOM.zoomModalBody.scrollLeft = panScrollLeft - (x - panStartX);
    DOM.zoomModalBody.scrollTop = panScrollTop - (y - panStartY);
  });
}

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
window.addEventListener('scroll', hideHoverPreview, true);

