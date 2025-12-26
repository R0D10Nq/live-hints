/**
 * UI Elements - кэширование DOM элементов
 */

export function cacheElements() {
  return {
    // Header controls
    btnToggle: document.getElementById('btn-toggle'),
    btnMinimize: document.getElementById('btn-minimize'),
    btnClose: document.getElementById('btn-close'),
    btnAsk: document.getElementById('btn-ask'),
    btnScreenshot: document.getElementById('btn-screenshot'),
    btnSettings: document.getElementById('btn-settings'),
    btnHistory: document.getElementById('btn-history'),
    btnHelp: document.getElementById('btn-help'),
    statusIndicator: document.getElementById('status-indicator'),

    // Transcript sidebar
    transcriptSidebar: document.getElementById('transcript-sidebar'),
    transcriptFeed: document.getElementById('transcript-feed'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    btnExpandSidebar: document.getElementById('btn-expand-sidebar'),
    btnClearTranscript: document.getElementById('btn-clear-transcript'),

    // Hints area
    hintsFeed: document.getElementById('hints-feed'),
    hintsCounter: document.getElementById('hints-counter'),
    btnPrevHint: document.getElementById('btn-prev-hint'),
    btnNextHint: document.getElementById('btn-next-hint'),
    btnCopyHint: document.getElementById('btn-copy-hint'),
    btnClearHints: document.getElementById('btn-clear-hints'),
    streamingHint: document.getElementById('streaming-hint'),
    streamingText: document.getElementById('streaming-text'),

    // Settings panel
    settingsPanel: document.getElementById('settings-panel'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnBasicMode: document.getElementById('btn-basic-mode'),
    btnAdvancedMode: document.getElementById('btn-advanced-mode'),
    basicSettings: document.getElementById('basic-settings'),
    advancedSettings: document.getElementById('advanced-settings'),
    llmProvider: document.getElementById('llm-provider'),
    aiProfile: document.getElementById('ai-profile'),

    // History modal
    historyModal: document.getElementById('history-modal'),
    sessionsList: document.getElementById('sessions-list'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    sessionViewModal: document.getElementById('session-view-modal'),
    sessionViewTitle: document.getElementById('session-view-title'),
    sessionTranscript: document.getElementById('session-transcript'),
    sessionHints: document.getElementById('session-hints'),
    btnCloseSessionView: document.getElementById('btn-close-session-view'),

    // Help modal
    helpModal: document.getElementById('help-modal'),
    btnCloseHelp: document.getElementById('btn-close-help'),

    // Vision modal
    visionModal: document.getElementById('vision-modal'),
    btnCloseVision: document.getElementById('btn-close-vision'),
    visionOptions: document.getElementById('vision-options'),
    visionPreview: document.getElementById('vision-preview'),
    visionResult: document.getElementById('vision-result'),

    // Toast
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
    btnDismissError: document.getElementById('btn-dismiss-error'),
    successToast: document.getElementById('success-toast'),
    successMessage: document.getElementById('success-message'),

    // Debug
    debugPanel: document.getElementById('debug-panel'),
    metricsSttLatency: document.getElementById('metrics-stt-latency'),
    metricsLlmLatency: document.getElementById('metrics-llm-latency'),

    // Legacy compatibility
    btnGetHint: document.getElementById('btn-ask'),
    btnPause: document.getElementById('btn-pause'),
    metricsPanel: document.getElementById('debug-panel'),
  };
}
