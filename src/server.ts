import express from 'express';
import { generateCommand } from './commands/generate.js';
import {
  listArchive,
  archiveAllJobs,
  archiveJob,
  restoreJob,
  getArchiveJobDetail,
} from './services/archive.js';
import { getSubmissionStats } from './services/submission-ledger.js';
import { OpenAIService } from './services/openai.js';
import {
  createApplicationPackModule,
  JobEditBlockedError,
  JobNotFoundError,
} from './application-pack/index.js';
import { PACK_GENERATION_STEPS } from './application-pack/batch-progress.js';
import { UI_STRINGS, type Locale } from './i18n.js';
import { getDailyThemeName, renderDailyThemeCss } from './ui/daily-theme.js';
import {
  TRACK_IDS,
  type TrackId,
} from './services/track.js';

const pack = createApplicationPackModule();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传支持（multer 的简单替代）
app.use(express.raw({ type: 'text/plain', limit: '10mb' }));

function buildHtml(lang: Locale): string {
  const s = UI_STRINGS[lang];
  const langAttr = lang === 'zh' ? 'zh-CN' : 'en';
  const dailyThemeCss = renderDailyThemeCss(new Date());
  const dailyThemeName = getDailyThemeName(lang, new Date());
  const html = `
<!DOCTYPE html>
<html lang="${langAttr}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{pageTitle}}</title>
    <style>
        ${dailyThemeCss}
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--theme-page-bg);
            background-image: linear-gradient(
                165deg,
                var(--theme-page-bg) 0%,
                var(--theme-page-bg-end) 52%,
                var(--theme-page-bg-accent) 100%
            );
            background-attachment: fixed;
            min-height: 100vh;
            padding: 20px;
            transition: background-color 0.4s ease, background-image 0.4s ease;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: var(--theme-surface);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: var(--theme-text-primary);
            margin-bottom: 10px;
        }
        .section {
            background: var(--theme-surface);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .section h2 {
            color: var(--theme-text-primary);
            margin-bottom: 20px;
            font-size: 20px;
        }
        .daily-theme-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            color: var(--theme-text-muted);
            background: var(--theme-surface-subtle);
            border: 1px solid var(--theme-border);
        }
        .daily-theme-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--theme-primary);
            box-shadow: 0 0 0 2px var(--theme-primary-light);
            flex-shrink: 0;
        }
        .quick-start {
            margin-bottom: 20px;
            padding: 14px 16px;
            border: 1px solid var(--theme-panel-border);
            border-radius: 8px;
            background: var(--theme-panel-bg);
        }
        .quick-start h3 {
            color: var(--theme-panel-title);
            font-size: 15px;
            margin-bottom: 8px;
        }
        .quick-start ol {
            margin-left: 20px;
            color: var(--theme-text-secondary);
            line-height: 1.6;
            font-size: 14px;
        }
        .sequence {
            margin: 0 0 20px;
            padding: 16px;
            border: 1px solid var(--theme-border);
            border-radius: 10px;
            background: var(--theme-surface);
        }
        .sequence h3 {
            margin-bottom: 14px;
            color: var(--theme-text-heading);
            font-size: 16px;
        }
        .sequence-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .sequence-item {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            padding: 12px;
            border-radius: 8px;
            background: var(--theme-surface-subtle);
            border: 1px solid var(--theme-border);
        }
        .sequence-index {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: var(--theme-primary);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .sequence-item h4 {
            font-size: 14px;
            margin-bottom: 4px;
            color: var(--theme-text-heading);
        }
        .sequence-item p {
            font-size: 13px;
            color: var(--theme-text-subtle);
            line-height: 1.5;
        }
        .motivation-card {
            margin-bottom: 20px;
            padding: 16px;
            border-radius: 10px;
            border: 1px solid var(--theme-warm-border);
            background: linear-gradient(135deg, var(--theme-warm-bg-from) 0%, var(--theme-warm-bg-to) 100%);
        }
        .apply-counter {
            margin-bottom: 20px;
            padding: 14px 16px;
            border-radius: 10px;
            border: 1px solid var(--theme-stats-border);
            background: linear-gradient(135deg, var(--theme-stats-bg-from) 0%, var(--theme-stats-bg-to) 100%);
        }
        .apply-counter-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--theme-stats-title);
            margin-bottom: 4px;
        }
        .apply-counter-desc {
            font-size: 13px;
            color: var(--theme-stats-text);
            margin-bottom: 8px;
        }
        .apply-counter-value {
            font-size: 30px;
            font-weight: 800;
            color: var(--theme-stats-value);
            line-height: 1.1;
        }
        .apply-counter-value span {
            font-size: 14px;
            font-weight: 600;
            margin-left: 6px;
            color: var(--theme-stats-accent);
        }
        .apply-streak {
            margin-top: 8px;
            font-size: 14px;
            font-weight: 600;
            color: var(--theme-stats-text);
        }
        .submission-heatmap {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid var(--theme-stats-border);
            position: relative;
        }
        .heatmap-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--theme-stats-title);
            margin-bottom: 10px;
        }
        .heatmap-scroll {
            overflow-x: auto;
            padding-bottom: 4px;
        }
        .heatmap-chart {
            display: inline-block;
            min-width: 100%;
        }
        .heatmap-months {
            position: relative;
            height: 16px;
            margin-left: 28px;
            margin-bottom: 4px;
            font-size: 11px;
            color: var(--theme-text-muted);
            white-space: nowrap;
        }
        .heatmap-month {
            position: absolute;
            top: 0;
            transform: translateX(0);
            line-height: 16px;
        }
        .heatmap-body {
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }
        .heatmap-weekdays {
            display: grid;
            grid-template-rows: repeat(7, 11px);
            gap: 3px;
            font-size: 10px;
            color: var(--theme-text-muted);
            line-height: 11px;
            text-align: right;
            width: 22px;
            flex-shrink: 0;
        }
        .heatmap-weekdays span {
            height: 11px;
        }
        .heatmap-grid {
            display: grid;
            grid-auto-flow: column;
            grid-template-rows: repeat(7, 11px);
            grid-auto-columns: 11px;
            gap: 3px;
            width: max-content;
        }
        .heatmap-cell {
            width: 11px;
            height: 11px;
            border-radius: 2px;
            background: var(--theme-heatmap-empty);
            cursor: pointer;
        }
        .heatmap-cell.level-1 { background: var(--theme-heatmap-1); }
        .heatmap-cell.level-2 { background: var(--theme-heatmap-2); }
        .heatmap-cell.level-3 { background: var(--theme-heatmap-3); }
        .heatmap-cell.level-4 { background: var(--theme-heatmap-4); }
        .heatmap-cell.level-5 { background: var(--theme-heatmap-5); }
        .heatmap-cell.level-6 { background: var(--theme-heatmap-6); }
        .heatmap-cell.level-7 { background: var(--theme-heatmap-7); }
        .heatmap-tooltip {
            position: fixed;
            z-index: 1000;
            pointer-events: none;
            background: var(--theme-tooltip-bg);
            color: #fff;
            font-size: 12px;
            line-height: 1.35;
            padding: 6px 8px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
            white-space: nowrap;
            transform: translate(-50%, calc(-100% - 8px));
        }
        .heatmap-tooltip[hidden] {
            display: none !important;
        }
        .heatmap-legend {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 8px;
            font-size: 11px;
            color: var(--theme-text-muted);
        }
        .heatmap-legend .heatmap-cell {
            width: 10px;
            height: 10px;
            cursor: default;
        }
        .star-buddy {
            margin-bottom: 20px;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid var(--theme-star-border);
            background: linear-gradient(145deg, var(--theme-star-bg-1) 0%, var(--theme-star-bg-2) 45%, var(--theme-star-bg-3) 100%);
            position: relative;
            overflow: hidden;
        }
        .star-buddy:before,
        .star-buddy:after {
            content: '✦';
            position: absolute;
            color: rgba(255, 255, 255, 0.88);
            animation: twinkleFloat 2.8s ease-in-out infinite;
            pointer-events: none;
        }
        .star-buddy:before {
            top: 10px;
            right: 18px;
            font-size: 16px;
        }
        .star-buddy:after {
            bottom: 12px;
            left: 16px;
            font-size: 12px;
            animation-delay: 0.9s;
        }
        .star-buddy-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--theme-star-title);
            margin-bottom: 4px;
        }
        .star-buddy-subtitle {
            font-size: 13px;
            color: var(--theme-star-subtitle);
            margin-bottom: 10px;
        }
        .star-buddy-main {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .star-avatar {
            width: 62px;
            height: 62px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            background: rgba(255,255,255,0.65);
            box-shadow: 0 6px 14px rgba(236, 72, 153, 0.18);
            animation: starPulse 2.2s ease-in-out infinite;
            flex-shrink: 0;
        }
        .star-detail {
            color: var(--theme-star-detail);
            font-size: 14px;
            line-height: 1.55;
            font-weight: 600;
        }
        .motivation-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--theme-warm-title);
            margin-bottom: 6px;
        }
        .motivation-subtitle {
            font-size: 13px;
            color: var(--theme-warm-subtitle);
            margin-bottom: 10px;
        }
        .motivation-quote {
            font-size: 14px;
            color: var(--theme-warm-quote);
            margin-bottom: 12px;
            line-height: 1.6;
            font-weight: 500;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .field-help-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 6px;
            gap: 8px;
            font-size: 12px;
            color: var(--theme-text-muted);
        }
        .char-counter {
            color: var(--theme-text-subtle);
            white-space: nowrap;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--theme-text-label);
        }
        input[type="text"],
        input[type="url"],
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--theme-border-light);
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        }
        textarea {
            min-height: 200px;
            resize: vertical;
        }
        .track-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .track-btn {
            background: var(--theme-surface-subtle);
            color: var(--theme-text-secondary);
            border: 2px solid var(--theme-border);
            border-radius: 10px;
            padding: 18px 16px;
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            text-align: center;
            transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
        }
        .track-btn:hover {
            background: var(--theme-surface-muted);
            border-color: var(--theme-border-muted);
            color: var(--theme-text-heading);
        }
        .track-btn.selected {
            background: var(--theme-primary-light);
            border-color: var(--theme-primary);
            color: var(--theme-primary-dark);
            box-shadow: 0 0 0 3px var(--theme-primary-ring);
        }
        .track-btn .track-btn-sub {
            display: block;
            margin-top: 6px;
            font-size: 12px;
            font-weight: 400;
            color: var(--theme-text-muted);
        }
        .track-btn.selected .track-btn-sub {
            color: var(--theme-primary-muted);
        }
        button {
            background-color: var(--theme-primary);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
            transition: background-color 0.15s ease;
        }
        button:hover {
            background-color: var(--theme-primary-hover);
        }
        button.danger {
            background-color: #dc3545;
        }
        button.danger:hover {
            background-color: #c82333;
        }
        button.success {
            background-color: #28a745;
        }
        button.success:hover {
            background-color: #218838;
        }
        button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        button.secondary {
            background: var(--theme-btn-secondary-bg);
            color: var(--theme-text-secondary);
        }
        button.secondary:hover {
            background: var(--theme-btn-secondary-hover);
        }
        .message {
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
        }
        .info {
            background-color: var(--theme-info-bg);
            color: var(--theme-info-text);
        }
        .jd-list {
            display: grid;
            gap: 15px;
        }
        .empty-state {
            border: 1px dashed var(--theme-border-muted);
            border-radius: 8px;
            background: var(--theme-surface-subtle);
            padding: 24px;
            text-align: center;
            color: var(--theme-text-subtle);
        }
        .empty-state h3 {
            color: var(--theme-text-heading);
            margin-bottom: 8px;
            font-size: 18px;
        }
        .jd-item {
            border: 1px solid var(--theme-border-light);
            border-radius: 4px;
            padding: 15px;
            background: var(--theme-surface-subtle);
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .jd-item.has-company-profile {
            border-left: 4px solid #28a745;
            background: var(--theme-surface-muted);
        }
        .jd-item.jd-only {
            border-left: 4px solid #6c757d;
            background: var(--theme-surface-subtle);
        }
        .jd-mode-badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 3px;
            margin-left: 8px;
        }
        .jd-mode-badge.has-company {
            background: #28a745;
            color: #fff;
        }
        .jd-mode-badge.jd-only {
            background: #6c757d;
            color: #fff;
        }
        .results-mode-banner {
            padding: 10px 14px;
            border-radius: 4px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .results-mode-banner.has-company {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .results-mode-banner.jd-only {
            background: #e2e3e5;
            border: 1px solid #d6d8db;
            color: #383d41;
        }
        .results-mode-banner.truncation-warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
        }
        .jd-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .jd-item-title {
            font-weight: 600;
            color: var(--theme-text-primary);
        }
        .jd-item-id {
            font-size: 12px;
            color: var(--theme-text-muted-alt);
            font-family: monospace;
        }
        .jd-item-actions {
            display: flex;
            gap: 10px;
        }
        .jd-item-content {
            margin-top: 10px;
            padding: 10px;
            background: var(--theme-surface);
            border: 1px solid var(--theme-border-light);
            border-radius: 4px;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
            display: none;
        }
        .jd-item-content.expanded {
            display: block;
        }
        .regenerate-progress {
            margin-top: 8px;
            padding: 6px 0;
        }
        .regenerate-progress .regenerate-label {
            font-size: 12px;
            color: var(--theme-text-muted-alt);
            margin-bottom: 4px;
        }
        .regenerate-progress .regenerate-bar {
            height: 6px;
            background: var(--theme-border);
            border-radius: 3px;
            overflow: hidden;
        }
        .regenerate-progress .regenerate-bar-fill {
            height: 100%;
            background: var(--theme-primary);
            border-radius: 3px;
            transition: width 0.2s ease;
        }
        .regenerate-progress-wrap:empty {
            display: none;
        }
        .jd-item-actions button {
            padding: 6px 12px;
            font-size: 14px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 10px;
            transition: background-color 0.25s ease, color 0.25s ease;
        }
        .status-pending {
            background-color: #ffc107;
            color: #856404;
        }
        .status-in-progress {
            background-color: var(--theme-status-progress);
            color: #fff;
        }
        .status-completed {
            background-color: #28a745;
            color: #fff;
        }
        .status-finished {
            background-color: var(--theme-status-finished-bg);
            color: var(--theme-status-finished-text);
        }
        .status-failed {
            background-color: #dc3545;
            color: #fff;
        }
        .results-panel {
            display: none;
            margin-top: 15px;
            padding: 15px;
            background: var(--theme-surface);
            border-radius: 4px;
            border: 1px solid var(--theme-border-light);
        }
        .results-panel.active {
            display: block;
        }
        .result-section {
            margin-bottom: 20px;
        }
        .result-section h4 {
            color: var(--theme-text-primary);
            margin-bottom: 10px;
            font-size: 16px;
        }
        .result-section.result-subsection { margin-left: 8px; }
        .result-section.result-subsection h4 { font-size: 14px; }
        .result-content-wrap {
            position: relative;
            background: var(--theme-surface-subtle);
            border-radius: 4px;
            padding: 15px;
        }
        .result-content-wrap .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid var(--theme-border-light);
            background: var(--theme-surface);
            border-radius: 4px;
            cursor: pointer;
            opacity: 0.85;
            box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .result-content-wrap .copy-btn:hover {
            opacity: 1;
            background: var(--theme-surface-muted);
        }
        .result-content {
            background: var(--theme-surface-subtle);
            padding: 15px;
            border-radius: 4px;
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.6;
        }
        .result-content-wrap .result-content {
            background: transparent;
            padding: 0;
            padding-right: 60px;
        }
        .result-content ul {
            margin-left: 20px;
        }
        .result-content li {
            margin-bottom: 8px;
        }
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-overlay .modal {
            background: var(--theme-surface);
            border-radius: 8px;
            max-width: 640px;
            width: 90%;
            max-height: 90vh;
            overflow: auto;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .modal-overlay .modal h3 { margin-bottom: 16px; }
        .modal-overlay .modal textarea {
            width: 100%;
            min-height: 120px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        .regenerate-feedback-md {
            white-space: normal;
            line-height: 1.6;
            margin-top: 16px;
        }
        .regenerate-feedback-md h1,.regenerate-feedback-md h2,.regenerate-feedback-md h3 { margin-top: 1em; margin-bottom: 0.5em; }
        .regenerate-feedback-md ul { margin-left: 1.5em; }
        .regenerate-feedback-md p { margin-bottom: 0.8em; }
        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--theme-border);
            border-top: 2px solid var(--theme-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 10px;
            vertical-align: middle;
        }
        .loading.loading-inline {
            width: 14px;
            height: 14px;
            margin-left: 6px;
            border-width: 2px;
        }
        .batch-status {
            display: none;
            margin-top: 12px;
            padding: 14px 16px;
            border: 1px solid var(--theme-panel-border);
            border-radius: 8px;
            background: var(--theme-panel-bg);
        }
        .batch-status.visible {
            display: block;
        }
        .batch-status-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
        }
        .batch-status-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--theme-batch-title);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .batch-status-clear {
            border: none;
            background: transparent;
            color: var(--theme-text-muted);
            cursor: pointer;
            font-size: 13px;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .batch-status-clear:hover {
            background: var(--theme-border);
            color: var(--theme-text-secondary);
        }
        .batch-status-clear:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .batch-status-primary {
            font-size: 13px;
            color: var(--theme-text-secondary);
            margin-bottom: 6px;
        }
        .batch-status-secondary {
            font-size: 12px;
            color: var(--theme-text-muted);
            margin-top: 6px;
        }
        .batch-progress-bar {
            height: 8px;
            background: var(--theme-border);
            border-radius: 999px;
            overflow: hidden;
        }
        .batch-progress-bar-fill {
            height: 100%;
            width: 0%;
            background: var(--theme-primary-muted);
            border-radius: 999px;
            transition: width 0.35s ease;
        }
        .batch-status.done .batch-progress-bar-fill {
            background: #22c55e;
        }
        .batch-status.has-failures.done .batch-progress-bar-fill {
            background: #f59e0b;
        }
        .pack-step-progress {
            margin: 8px 0 4px;
        }
        .pack-step-progress .regenerate-label {
            font-size: 12px;
            color: var(--theme-text-muted);
            margin-bottom: 4px;
        }
        .jd-item.is-generating {
            border-color: var(--theme-generating-border);
            box-shadow: 0 0 0 1px var(--theme-generating-shadow);
        }
        .jd-item.is-failed {
            border-color: #fca5a5;
        }
        @media (prefers-reduced-motion: reduce) {
            .loading,
            .batch-progress-bar-fill,
            .status-badge,
            .jd-item,
            .regenerate-progress .regenerate-bar-fill {
                animation: none !important;
                transition: none !important;
            }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes twinkleFloat {
            0%, 100% { opacity: 0.3; transform: translateY(0) scale(0.9); }
            50% { opacity: 1; transform: translateY(-4px) scale(1.1); }
        }
        @keyframes starPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0)); }
            50% { transform: scale(1.08); filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.35)); }
        }
        @keyframes starBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-5px) scale(1.08); }
        }
        @keyframes starSpin {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.08); }
            100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes starShoot {
            0%, 100% { transform: translateX(0) translateY(0) scale(1); opacity: 0.9; }
            50% { transform: translateX(4px) translateY(-4px) scale(1.1); opacity: 1; }
        }
        @keyframes starWink {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            45% { transform: scaleY(0.7) scaleX(1.04); filter: brightness(1.15); }
            55% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes confettiFall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(520deg); opacity: 0; }
        }
        .batch-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .top-nav {
            display: flex;
            gap: 0;
            margin-bottom: 20px;
            border-bottom: 2px solid var(--theme-nav-border);
        }
        .top-nav a {
            padding: 12px 24px;
            text-decoration: none;
            color: var(--theme-nav-text);
            font-weight: 500;
        }
        .top-nav a:hover { color: var(--theme-primary); }
        .top-nav a.active {
            color: var(--theme-primary);
            border-bottom: 2px solid var(--theme-primary);
            margin-bottom: -2px;
        }
        .lang-switcher {
            padding: 12px 0;
            margin-left: auto;
            white-space: nowrap;
        }
        .view-panel { display: none; }
        .view-panel.active { display: block; }
        .confetti-layer {
            position: fixed;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
            z-index: 3000;
        }
        .confetti {
            position: absolute;
            width: 8px;
            height: 14px;
            border-radius: 2px;
            opacity: 0.95;
            animation: confettiFall 1100ms ease-out forwards;
        }
        .archive-toolbar {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 16px;
        }
        .archive-toolbar input[type="text"] {
            flex: 1;
            max-width: 320px;
            padding: 8px 12px;
        }
        .archive-group {
            margin-bottom: 24px;
        }
        .archive-group-date {
            font-size: 18px;
            font-weight: 600;
            color: var(--theme-text-primary);
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--theme-border-light);
        }
        .archive-job-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--theme-surface);
            border: 1px solid var(--theme-border-light);
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .archive-job-item:hover { background: var(--theme-surface-subtle); }
        .archive-job-expand {
            margin-top: 12px;
            padding: 12px;
            background: var(--theme-surface-subtle);
            border-radius: 4px;
            font-size: 13px;
        }
        .archive-job-expand h5 { margin: 12px 0 6px; color: var(--theme-text-label); }
        .text-muted { color: var(--theme-text-muted-alt); }
        .archive-job-expand pre { white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; font-size: 12px; }
        .archive-load-more { margin-top: 16px; }
    </style>
</head>
<body>
    <script>window.UI=${JSON.stringify(s).replace(/</g, '\\u003c')};window.LANG=${JSON.stringify(lang)};window.PACK_GENERATION_STEPS=${JSON.stringify(PACK_GENERATION_STEPS)};</script>
    <div class="container">
        <nav class="top-nav">
            <a href="#" class="active" id="navWorkspace" onclick="switchTab('workspace'); return false;">{{navWorkspace}}</a>
            <a href="#" id="navArchive" onclick="switchTab('archive'); return false;">{{navArchive}}</a>
            <span class="lang-switcher"><a href="?lang=en" class="{{langEnActive}}" style="text-decoration:none;color:inherit;">{{langSwitcherEn}}</a> | <a href="?lang=zh" class="{{langZhActive}}" style="text-decoration:none;color:inherit;">{{langSwitcherZh}}</a></span>
        </nav>

        <div id="workspaceView" class="view-panel active">
        <div class="header">
            <h1>📝 Resume Pack Generator</h1>
            <p>{{headerSubtitle}}</p>
            <div class="daily-theme-badge" title="{{dailyThemeHint}}">
                <span class="daily-theme-dot" aria-hidden="true"></span>
                <span>{{dailyThemeLabel}} · {{dailyThemeName}}</span>
            </div>
        </div>

        <div class="section">
            <h2>{{addJobTitle}}</h2>
            <div class="quick-start">
                <h3>💡 {{quickStartTitle}}</h3>
                <ol>
                    <li>{{quickStartStep1}}</li>
                    <li>{{quickStartStep2}}</li>
                    <li>{{quickStartStep3}}</li>
                </ol>
            </div>
            <div class="sequence">
                <h3>🧭 {{sequenceTitle}}</h3>
                <div class="sequence-grid">
                    <div class="sequence-item">
                        <span class="sequence-index">1</span>
                        <div>
                            <h4>📥 {{sequenceStep1Title}}</h4>
                            <p>{{sequenceStep1Desc}}</p>
                        </div>
                    </div>
                    <div class="sequence-item">
                        <span class="sequence-index">2</span>
                        <div>
                            <h4>⚙️ {{sequenceStep2Title}}</h4>
                            <p>{{sequenceStep2Desc}}</p>
                        </div>
                    </div>
                    <div class="sequence-item">
                        <span class="sequence-index">3</span>
                        <div>
                            <h4>🚀 {{sequenceStep3Title}}</h4>
                            <p>{{sequenceStep3Desc}}</p>
                        </div>
                    </div>
                </div>
            </div>
            <form id="jdForm">
                <div class="form-group">
                    <label for="jd">{{jdLabel}}</label>
                    <textarea id="jd" name="jd" required placeholder="{{jdPlaceholder}}"></textarea>
                    <div class="field-help-row">
                        <span id="jdHint">{{jdHelper}}</span>
                        <span class="char-counter" id="jdCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>{{trackLabel}}</label>
                    <input type="hidden" id="applicationTrack" name="applicationTrack" value="software-engineering">
                    <div class="track-buttons" role="radiogroup" aria-label="{{trackLabel}}" data-track-input="applicationTrack">
                        <button type="button" class="track-btn selected" data-track="software-engineering" aria-pressed="true">
                            {{trackSoftwareEngineering}}
                        </button>
                        <button type="button" class="track-btn" data-track="it-support" aria-pressed="false">
                            {{trackItSupport}}
                        </button>
                    </div>
                    <div class="field-help-row">
                        <span>{{trackSelectHint}}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="companyInfo">{{companyInfoLabel}}</label>
                    <textarea id="companyInfo" name="companyInfo" placeholder="{{companyInfoPlaceholder}}"></textarea>
                    <div class="field-help-row">
                        <span>{{companyHelper}}</span>
                        <span class="char-counter" id="companyCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <button type="submit" id="saveJdBtn" disabled>{{saveJdButton}}</button>
            </form>
            <div id="message"></div>
        </div>

        <div class="section">
            <h2>{{jdListTitle}}</h2>
            <div class="apply-counter">
                <div class="apply-counter-title">🎯 {{applyCounterTitle}}</div>
                <div class="apply-counter-desc">{{applyCounterDesc}}</div>
                <div id="applyCounterValue" class="apply-counter-value">0 <span>{{applyCounterUnit}}</span></div>
                <div id="applyStreakValue" class="apply-streak">🔥 {{streakLabel}}: 0 {{streakUnit}}</div>
                <div class="submission-heatmap">
                    <div class="heatmap-title">📊 {{heatmapTitle}}</div>
                    <div class="heatmap-scroll">
                        <div class="heatmap-chart">
                            <div id="heatmapMonths" class="heatmap-months"></div>
                            <div class="heatmap-body">
                                <div id="heatmapWeekdays" class="heatmap-weekdays"></div>
                                <div id="heatmapGrid" class="heatmap-grid"></div>
                            </div>
                        </div>
                    </div>
                    <div id="heatmapTooltip" class="heatmap-tooltip" hidden></div>
                    <div class="heatmap-legend">
                        <span>{{heatmapLegendLess}}</span>
                        <span class="heatmap-cell level-0"></span>
                        <span class="heatmap-cell level-1"></span>
                        <span class="heatmap-cell level-2"></span>
                        <span class="heatmap-cell level-3"></span>
                        <span class="heatmap-cell level-4"></span>
                        <span class="heatmap-cell level-5"></span>
                        <span class="heatmap-cell level-6"></span>
                        <span class="heatmap-cell level-7"></span>
                        <span>{{heatmapLegendMore}}</span>
                    </div>
                </div>
            </div>
            <div class="star-buddy">
                <div class="star-buddy-title">🌟 {{starBuddyTitle}}</div>
                <div class="star-buddy-subtitle">{{starBuddySubtitle}}</div>
                <div class="star-buddy-main">
                    <div id="starBuddyAvatar" class="star-avatar">⭐</div>
                    <div id="starBuddyDetail" class="star-detail"></div>
                </div>
            </div>
            <div class="motivation-card">
                <div class="motivation-title">✨ {{motivationTitle}}</div>
                <div class="motivation-subtitle">{{motivationSubtitle}}</div>
                <div id="motivationQuote" class="motivation-quote"></div>
                <button type="button" class="secondary" onclick="refreshMotivation()">💬 {{motivationBtn}}</button>
            </div>
            <div class="batch-actions">
                <button class="success" id="generateAllBtn" onclick="generateAll()">⚡ {{generateAllBtn}}</button>
                <button class="secondary" onclick="refreshList()">🔄 {{refreshList}}</button>
                <button type="button" class="success" onclick="archiveAll()">🗂️ {{archiveAll}}</button>
                <button class="danger" onclick="clearAll()">🧹 {{clearAll}}</button>
            </div>
            <div id="batchStatus" class="batch-status">
                <div class="batch-status-header">
                    <div class="batch-status-title">
                        <span id="batchStatusIcon" class="loading loading-inline" aria-hidden="true"></span>
                        <span id="batchStatusTitle">{{batchProgressRunning}}</span>
                    </div>
                    <button type="button" class="batch-status-clear" id="batchStatusClear" onclick="clearPackBatchStatus()" disabled>{{batchProgressClear}}</button>
                </div>
                <div class="batch-status-primary" id="batchStatusPrimary"></div>
                <div class="batch-progress-bar" aria-hidden="true">
                    <div class="batch-progress-bar-fill" id="batchStatusBarFill"></div>
                </div>
                <div class="batch-status-secondary" id="batchStatusSecondary"></div>
            </div>
            <div id="jdList" class="jd-list">
                <p>{{loading}}</p>
            </div>
        </div>
        </div>

        <div id="archiveView" class="view-panel">
            <div class="section">
                <h2>{{archiveTitle}}</h2>
                <p class="text-muted" style="margin-bottom:16px;">{{archiveDesc}}</p>
                <div class="archive-toolbar">
                    <input type="text" id="archiveSearch" placeholder="{{archiveSearchPlaceholder}}" onkeypress="if(event.key==='Enter')loadArchive(1)">
                    <button type="button" onclick="loadArchive(1)">{{archiveSearchBtn}}</button>
                </div>
                <div id="archiveList"></div>
                <div id="archiveLoadMoreWrap" class="archive-load-more" style="display:none;">
                    <button type="button" id="archiveLoadMoreBtn" onclick="loadArchiveNext()">{{loadMore}}</button>
                </div>
                <div id="archiveEmpty" class="text-muted" style="display:none;padding:20px;">{{archiveEmpty}}</div>
            </div>
        </div>
    </div>

    <div id="confettiLayer" class="confetti-layer"></div>
    <div id="regenerateModal" class="modal-overlay" style="display:none;">
        <div class="modal">
            <h3>{{regenerateModalTitle}}</h3>
            <p class="text-muted" style="font-size:14px;margin-bottom:12px;">{{regenerateModalDesc}}</p>
            <textarea id="regenerateFeedback" placeholder="{{regeneratePlaceholder}}"></textarea>
            <div id="regenerateActions">
                <button type="button" class="success" id="regenerateSubmitBtn" onclick="submitRegenerate()">{{regenerateSubmit}}</button>
                <button type="button" onclick="closeRegenerateModal()">{{cancel}}</button>
            </div>
            <div id="regenerateResult" style="display:none;margin-top:20px;">
                <h4>{{regenerateUpdated}}</h4>
                <p class="text-muted" style="margin-bottom:8px;">{{regenerateFeedbackLabel}}</p>
                <div id="regenerateFeedbackBody" class="regenerate-feedback-md result-content"></div>
                <button type="button" onclick="closeRegenerateModal()" style="margin-top:16px;">{{close}}</button>
            </div>
        </div>
    </div>

    <div id="editJobModal" class="modal-overlay" style="display:none;">
        <div class="modal">
            <h3>{{editModalTitle}}</h3>
            <form id="editJobForm">
                <div class="form-group">
                    <label for="editJd">{{jdLabel}}</label>
                    <textarea id="editJd" name="jd" placeholder="{{jdPlaceholder}}"></textarea>
                    <div class="field-help-row">
                        <span>{{jdHelper}}</span>
                        <span class="char-counter" id="editJdCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>{{trackLabel}}</label>
                    <input type="hidden" id="editApplicationTrack" name="applicationTrack" value="software-engineering">
                    <div class="track-buttons" role="radiogroup" aria-label="{{trackLabel}}" data-track-input="editApplicationTrack">
                        <button type="button" class="track-btn selected" data-track="software-engineering" aria-pressed="true">
                            {{trackSoftwareEngineering}}
                        </button>
                        <button type="button" class="track-btn" data-track="it-support" aria-pressed="false">
                            {{trackItSupport}}
                        </button>
                    </div>
                    <div class="field-help-row">
                        <span>{{trackSelectHint}}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="editCompanyInfo">{{companyInfoLabel}}</label>
                    <textarea id="editCompanyInfo" name="companyInfo" placeholder="{{companyInfoPlaceholder}}" style="min-height:100px;"></textarea>
                    <div class="field-help-row">
                        <span>{{companyHelper}}</span>
                        <span class="char-counter" id="editCompanyCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <button type="submit" class="success" id="editSaveBtn">{{editSaveButton}}</button>
                <button type="button" onclick="closeEditJobModal()">{{cancel}}</button>
            </form>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        const motivationLines = [
            UI.motivation1,
            UI.motivation2,
            UI.motivation3,
            UI.motivation4,
            UI.motivation5
        ].filter(Boolean);

        const starBuddies = [
            { avatar: '⭐', name: 'Sparkle', mood: 'wink' },
            { avatar: '🌟', name: 'Twinkly', mood: 'float' },
            { avatar: '✨', name: 'Glimmer', mood: 'bounce' },
            { avatar: '💫', name: 'Comety', mood: 'spin' },
            { avatar: '🌠', name: 'Wishy', mood: 'shoot' },
            { avatar: '☄️', name: 'Nova', mood: 'pulse' }
        ];

        function dailySeed() {
            const now = new Date();
            return Number(String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0'));
        }

        function applyStarBuddyMood(mood) {
            const avatar = document.getElementById('starBuddyAvatar');
            if (!avatar) return;
            avatar.style.animation = 'starPulse 2.2s ease-in-out infinite';
            if (mood === 'float') avatar.style.animation = 'twinkleFloat 2.6s ease-in-out infinite';
            if (mood === 'bounce') avatar.style.animation = 'starBounce 1.5s ease-in-out infinite';
            if (mood === 'spin') avatar.style.animation = 'starSpin 3.2s linear infinite';
            if (mood === 'shoot') avatar.style.animation = 'starShoot 2.4s ease-in-out infinite';
            if (mood === 'wink') avatar.style.animation = 'starWink 2s ease-in-out infinite';
        }

        function renderDailyStarBuddy() {
            const avatarEl = document.getElementById('starBuddyAvatar');
            const detailEl = document.getElementById('starBuddyDetail');
            if (!avatarEl || !detailEl || starBuddies.length === 0) return;
            const seed = dailySeed();
            const buddy = starBuddies[seed % starBuddies.length];
            avatarEl.textContent = buddy.avatar;
            applyStarBuddyMood(buddy.mood);
            const isZh = window.LANG === 'zh';
            if (isZh) {
                detailEl.textContent = UI.starBuddyDetailZh;
            } else {
                detailEl.textContent = UI.starBuddyDetailEn
                    .replace('{name}', buddy.name)
                    .replace('{mood}', buddy.mood);
            }
        }

        async function renderApplyCounter() {
            const el = document.getElementById('applyCounterValue');
            const streakEl = document.getElementById('applyStreakValue');
            const grid = document.getElementById('heatmapGrid');
            const monthsEl = document.getElementById('heatmapMonths');
            const weekdaysEl = document.getElementById('heatmapWeekdays');
            if (!el) return;
            try {
                const res = await fetch('/api/submissions/stats');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || UI.requestFailed);
                el.innerHTML = String(data.todayCount || 0) + ' <span>' + UI.applyCounterUnit + '</span>';
                if (streakEl) streakEl.textContent = '🔥 ' + UI.streakLabel + ': ' + (data.streak || 0) + ' ' + UI.streakUnit;
                if (grid && Array.isArray(data.heatmap)) {
                    renderSubmissionHeatmap(data.heatmap, grid, monthsEl, weekdaysEl);
                }
            } catch (e) {
                el.innerHTML = '0 <span>' + UI.applyCounterUnit + '</span>';
                if (streakEl) streakEl.textContent = '🔥 ' + UI.streakLabel + ': 0 ' + UI.streakUnit;
            }
        }

        function formatHeatmapMonth(dateKey) {
            const parts = dateKey.split('-').map(Number);
            const locale = window.LANG === 'zh' ? 'zh-CN' : 'en-US';
            return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
                .format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
        }

        function formatHeatmapDate(dateKey) {
            const parts = dateKey.split('-').map(Number);
            const locale = window.LANG === 'zh' ? 'zh-CN' : 'en-US';
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
            }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
        }

        function renderSubmissionHeatmap(days, grid, monthsEl, weekdaysEl) {
            const cellSize = 11;
            const gap = 3;
            const step = cellSize + gap;
            const weekdayLabels = window.LANG === 'zh'
                ? ['一', '', '三', '', '五', '', '']
                : ['Mon', '', 'Wed', '', 'Fri', '', ''];
            if (weekdaysEl) {
                weekdaysEl.innerHTML = weekdayLabels.map(function(label) {
                    return '<span>' + label + '</span>';
                }).join('');
            }
            if (monthsEl) {
                let monthsHtml = '';
                let lastMonth = '';
                let lastLeft = -999;
                for (let i = 0; i < days.length; i += 7) {
                    const weekStart = days[i];
                    if (!weekStart) continue;
                    const monthKey = weekStart.date.slice(0, 7);
                    if (monthKey === lastMonth) continue;
                    const left = (i / 7) * step;
                    if (left - lastLeft < 28) {
                        lastMonth = monthKey;
                        continue;
                    }
                    monthsHtml += '<span class="heatmap-month" style="left:' + left + 'px">' +
                        formatHeatmapMonth(weekStart.date) + '</span>';
                    lastMonth = monthKey;
                    lastLeft = left;
                }
                monthsEl.innerHTML = monthsHtml;
            }
            grid.innerHTML = days.map(function(day) {
                const level = day.level || 0;
                return '<span class="heatmap-cell level-' + level +
                    '" data-date="' + day.date +
                    '" data-count="' + day.count +
                    '" role="img" aria-label="' + day.date + ': ' + day.count + ' ' + UI.applyCounterUnit + '"></span>';
            }).join('');
            bindHeatmapTooltip(grid);
        }

        function bindHeatmapTooltip(grid) {
            const tip = document.getElementById('heatmapTooltip');
            if (!tip || grid.dataset.tooltipBound === '1') return;
            grid.dataset.tooltipBound = '1';

            function hideTip() {
                tip.hidden = true;
            }

            function showTip(cell, event) {
                const date = cell.getAttribute('data-date') || '';
                const count = cell.getAttribute('data-count') || '0';
                tip.textContent = formatHeatmapDate(date) + ' · ' + count + ' ' + UI.applyCounterUnit;
                tip.hidden = false;
                const x = event.clientX;
                const y = event.clientY;
                tip.style.left = x + 'px';
                tip.style.top = y + 'px';
            }

            grid.addEventListener('mouseover', function(event) {
                const cell = event.target.closest('.heatmap-cell');
                if (!cell || !grid.contains(cell)) return;
                showTip(cell, event);
            });
            grid.addEventListener('mousemove', function(event) {
                const cell = event.target.closest('.heatmap-cell');
                if (!cell || !grid.contains(cell)) return;
                tip.style.left = event.clientX + 'px';
                tip.style.top = event.clientY + 'px';
            });
            grid.addEventListener('mouseleave', hideTip);
        }

        function themeConfettiColors() {
            const root = getComputedStyle(document.documentElement);
            return [
                root.getPropertyValue('--theme-primary-muted').trim(),
                root.getPropertyValue('--theme-star-detail').trim(),
                root.getPropertyValue('--theme-stats-accent').trim(),
                root.getPropertyValue('--theme-warm-title').trim(),
                root.getPropertyValue('--theme-primary').trim(),
            ].filter(Boolean);
        }

        function celebrateConfetti() {
            const layer = document.getElementById('confettiLayer');
            if (!layer) return;
            const colors = themeConfettiColors();
            if (colors.length === 0) return;
            for (let i = 0; i < 42; i++) {
                const piece = document.createElement('span');
                piece.className = 'confetti';
                piece.style.left = Math.round(Math.random() * 100) + 'vw';
                piece.style.backgroundColor = colors[i % colors.length];
                piece.style.animationDelay = Math.round(Math.random() * 260) + 'ms';
                piece.style.animationDuration = (900 + Math.round(Math.random() * 600)) + 'ms';
                layer.appendChild(piece);
                setTimeout(() => piece.remove(), 1800);
            }
        }

        async function archiveOneJob(jobId) {
            if (!confirm(UI.archiveOneConfirm)) return;
            try {
                const res = await fetch('/api/archive/' + encodeURIComponent(jobId), { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || UI.requestFailed);
                celebrateConfetti();
                showMessage('🎉 ' + UI.applySuccess, 'success');
                await renderApplyCounter();
                refreshList();
            } catch (e) {
                showMessage(UI.msgLoadFailed + (e && e.message ? e.message : ''), 'error');
            }
        }

        function refreshMotivation() {
            const el = document.getElementById('motivationQuote');
            if (!el || motivationLines.length === 0) return;
            const idx = Math.floor(Math.random() * motivationLines.length);
            el.textContent = '“' + motivationLines[idx] + '”';
        }

        function updateInputUxState() {
            const jdEl = document.getElementById('jd');
            const companyEl = document.getElementById('companyInfo');
            const saveBtn = document.getElementById('saveJdBtn');
            const jdCount = document.getElementById('jdCount');
            const companyCount = document.getElementById('companyCount');
            const jdHint = document.getElementById('jdHint');
            const jdLen = jdEl ? jdEl.value.trim().length : 0;
            const companyLen = companyEl ? companyEl.value.trim().length : 0;
            if (jdCount) jdCount.textContent = UI.charCount + ': ' + jdLen;
            if (companyCount) companyCount.textContent = UI.charCount + ': ' + companyLen;
            if (saveBtn) saveBtn.disabled = jdLen === 0;
            if (jdHint) jdHint.textContent = jdLen === 0 ? UI.saveDisabledHint : UI.jdHelper;
        }

        window.addEventListener('DOMContentLoaded', () => {
            const jdEl = document.getElementById('jd');
            const companyEl = document.getElementById('companyInfo');
            if (jdEl) {
                jdEl.addEventListener('input', updateInputUxState);
                jdEl.addEventListener('keydown', function(e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('jdForm').requestSubmit();
                    }
                });
            }
            if (companyEl) companyEl.addEventListener('input', updateInputUxState);
            document.querySelectorAll('.track-buttons').forEach(bindTrackButtons);
            const editJd = document.getElementById('editJd');
            const editCompany = document.getElementById('editCompanyInfo');
            if (editJd) editJd.addEventListener('input', updateEditUxState);
            if (editCompany) editCompany.addEventListener('input', updateEditUxState);
            updateInputUxState();
            renderApplyCounter();
            renderDailyStarBuddy();
            refreshMotivation();
            refreshList();
        });

        function bindTrackButtons(group) {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.track-btn');
                if (!btn || !group.contains(btn)) return;
                const track = btn.getAttribute('data-track');
                if (!track) return;
                setTrackSelection(group.getAttribute('data-track-input'), track);
            });
        }

        function setTrackSelection(inputId, track) {
            const input = document.getElementById(inputId);
            if (input) input.value = track;
            document.querySelectorAll('.track-buttons[data-track-input="' + inputId + '"] .track-btn').forEach((btn) => {
                const selected = btn.getAttribute('data-track') === track;
                btn.classList.toggle('selected', selected);
                btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
        }

        function updateEditUxState() {
            const jdEl = document.getElementById('editJd');
            const companyEl = document.getElementById('editCompanyInfo');
            const jdCount = document.getElementById('editJdCount');
            const companyCount = document.getElementById('editCompanyCount');
            const jdLen = jdEl ? jdEl.value.trim().length : 0;
            const companyLen = companyEl ? companyEl.value.trim().length : 0;
            if (jdCount) jdCount.textContent = UI.charCount + ': ' + jdLen;
            if (companyCount) companyCount.textContent = UI.charCount + ': ' + companyLen;
        }

        // 表单提交
        document.getElementById('jdForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const jdText = document.getElementById('jd').value.trim();
            const companyText = (document.getElementById('companyInfo') && document.getElementById('companyInfo').value) ? document.getElementById('companyInfo').value.trim() : '';
            const applicationTrack = document.getElementById('applicationTrack')?.value || 'software-engineering';
            if (!jdText) {
                showMessage('✗ ' + UI.msgJdRequired, 'error');
                return;
            }
            try {
                const response = await fetch('/api/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jd: jdText, companyInfo: companyText || undefined, applicationTrack })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✓ ' + UI.msgSaveSuccess + result.jobId, 'success');
                    e.target.reset();
                    setTrackSelection('applicationTrack', 'software-engineering');
                    updateInputUxState();
                    refreshList();
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            }
        });

        document.getElementById('editJobForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitEditJob();
        });

        const PACK_BATCH_STORAGE_KEY = 'packBatchJobIds';
        let packBatchJobIds = null;
        let packBatchVisible = false;
        let packBatchRunning = false;
        let packBatchPollTimer = null;
        let packBatchConfirmPolls = 0;
        let regenerateRunning = false;

        function isGenerationLocked() {
            return packBatchRunning || regenerateRunning;
        }

        function packStepsOf(job) {
            return (job && job.status && job.status.steps) ? job.status.steps : {};
        }

        function isBatchJobDone(job) {
            const steps = packStepsOf(job);
            if (steps.review === 'completed') return true;
            return PACK_GENERATION_STEPS.some(function(step) { return steps[step] === 'failed'; });
        }

        function isBatchJobFailed(job) {
            const steps = packStepsOf(job);
            if (steps.review === 'completed') return false;
            return PACK_GENERATION_STEPS.some(function(step) { return steps[step] === 'failed'; });
        }

        function isPackGenerationInFlight(job) {
            if (job && job.progress) return false;
            const steps = packStepsOf(job);
            return PACK_GENERATION_STEPS.some(function(step) { return steps[step] === 'in_progress'; });
        }

        function finishedPackStepsForJob(job) {
            if (isBatchJobDone(job)) return PACK_GENERATION_STEPS.length;
            const steps = packStepsOf(job);
            return PACK_GENERATION_STEPS.filter(function(step) {
                return steps[step] === 'completed' || steps[step] === 'failed';
            }).length;
        }

        function summarizeBatchProgress(jobs) {
            const jobTotal = jobs.length;
            const stepTotal = jobTotal * PACK_GENERATION_STEPS.length;
            let stepFinished = 0;
            let jobFinished = 0;
            let jobFailed = 0;
            let inFlight = false;
            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];
                stepFinished += finishedPackStepsForJob(job);
                if (isBatchJobDone(job)) {
                    jobFinished += 1;
                    if (isBatchJobFailed(job)) jobFailed += 1;
                }
                if (isPackGenerationInFlight(job)) inFlight = true;
            }
            return {
                stepFinished: stepFinished,
                stepTotal: stepTotal,
                jobFinished: jobFinished,
                jobTotal: jobTotal,
                jobFailed: jobFailed,
                inFlight: inFlight,
                allDone: jobTotal > 0 && jobFinished === jobTotal
            };
        }

        function packStepProgressHtml(job) {
            if (!job || job.progress || job.packComplete || isBatchJobDone(job)) return '';
            const finished = finishedPackStepsForJob(job);
            if (finished === 0 && !isPackGenerationInFlight(job)) return '';
            const pct = Math.round((finished / PACK_GENERATION_STEPS.length) * 100);
            const label = UI.statusGenerating + ' (' + finished + '/' + PACK_GENERATION_STEPS.length + ')';
            return '<div class="pack-step-progress regenerate-progress"><div class="regenerate-label">' + label + '</div><div class="regenerate-bar"><div class="regenerate-bar-fill" style="width:' + pct + '%"></div></div></div>';
        }

        function setGenerateControlsDisabled(disabled) {
            const allBtn = document.getElementById('generateAllBtn');
            if (allBtn) {
                allBtn.disabled = disabled;
                if (disabled && packBatchRunning) {
                    allBtn.innerHTML = UI.statusGenerating + '... <span class="loading loading-inline"></span>';
                } else if (!disabled) {
                    allBtn.textContent = '⚡ ' + UI.generateAllBtn;
                }
            }
            document.querySelectorAll('[id^="generate-btn-"]').forEach(function(btn) {
                btn.disabled = disabled;
            });
            document.querySelectorAll('[id^="regen-btn-"]').forEach(function(btn) {
                if (btn.style.display !== 'none') btn.disabled = disabled;
            });
        }

        function syncGenerationLocks() {
            setGenerateControlsDisabled(isGenerationLocked());
            const clearBtn = document.getElementById('batchStatusClear');
            if (clearBtn) clearBtn.disabled = packBatchRunning || !packBatchVisible;
        }

        function persistPackBatchIds(ids) {
            try {
                if (ids && ids.length) sessionStorage.setItem(PACK_BATCH_STORAGE_KEY, JSON.stringify(ids));
                else sessionStorage.removeItem(PACK_BATCH_STORAGE_KEY);
            } catch (e) {}
        }

        function readPersistedPackBatchIds() {
            try {
                const raw = sessionStorage.getItem(PACK_BATCH_STORAGE_KEY);
                if (!raw) return null;
                const ids = JSON.parse(raw);
                return Array.isArray(ids) ? ids.filter(Boolean) : null;
            } catch (e) {
                return null;
            }
        }

        function renderPackBatchStatus(summary) {
            const panel = document.getElementById('batchStatus');
            if (!panel || !packBatchVisible || !summary) return;
            panel.classList.add('visible');
            panel.classList.toggle('done', !!summary.allDone);
            panel.classList.toggle('has-failures', summary.jobFailed > 0);
            const icon = document.getElementById('batchStatusIcon');
            const title = document.getElementById('batchStatusTitle');
            const primary = document.getElementById('batchStatusPrimary');
            const secondary = document.getElementById('batchStatusSecondary');
            const fill = document.getElementById('batchStatusBarFill');
            if (icon) icon.style.display = summary.allDone ? 'none' : 'inline-block';
            if (title) title.textContent = summary.allDone ? UI.batchProgressDone : UI.batchProgressRunning;
            const stepPct = summary.stepTotal ? Math.round((summary.stepFinished / summary.stepTotal) * 100) : 0;
            if (primary) {
                primary.textContent = UI.batchProgressSteps + ' ' + summary.stepFinished + '/' + summary.stepTotal + ' (' + stepPct + '%)';
            }
            if (fill) fill.style.width = stepPct + '%';
            if (secondary) {
                let jobLine = UI.batchProgressJobs + ' ' + summary.jobFinished + '/' + summary.jobTotal;
                if (summary.jobFailed > 0) jobLine += ' (' + summary.jobFailed + ' ' + UI.batchProgressFailed + ')';
                secondary.textContent = jobLine;
            }
            syncGenerationLocks();
        }

        function hidePackBatchStatus() {
            const panel = document.getElementById('batchStatus');
            if (panel) {
                panel.classList.remove('visible', 'done', 'has-failures');
            }
            packBatchVisible = false;
            packBatchJobIds = null;
            packBatchRunning = false;
            persistPackBatchIds(null);
            syncGenerationLocks();
        }

        function clearPackBatchStatus(force) {
            if (packBatchRunning && !force) return;
            stopPackBatchPolling();
            hidePackBatchStatus();
        }

        function stopPackBatchPolling() {
            if (packBatchPollTimer) {
                clearInterval(packBatchPollTimer);
                packBatchPollTimer = null;
            }
            packBatchConfirmPolls = 0;
        }

        function batchJobsFromList(allJobs, ids) {
            const idSet = {};
            (ids || []).forEach(function(id) { idSet[id] = true; });
            return (allJobs || []).filter(function(j) { return idSet[j.id]; });
        }

        async function pollPackBatchOnce() {
            try {
                const response = await fetch('/api/jobs');
                const jobs = await response.json();
                if (!Array.isArray(jobs)) return;
                await refreshListFromJobs(jobs);
                if (!packBatchJobIds || !packBatchJobIds.length) return;
                const batchJobs = batchJobsFromList(jobs, packBatchJobIds);
                const summary = summarizeBatchProgress(batchJobs);
                renderPackBatchStatus(summary);
                if (summary.allDone) {
                    packBatchRunning = false;
                    persistPackBatchIds(null);
                    packBatchConfirmPolls += 1;
                    if (packBatchConfirmPolls >= 2) stopPackBatchPolling();
                    syncGenerationLocks();
                } else {
                    packBatchRunning = true;
                    packBatchConfirmPolls = 0;
                    syncGenerationLocks();
                }
            } catch (e) {}
        }

        function startPackBatchPolling() {
            stopPackBatchPolling();
            pollPackBatchOnce();
            packBatchPollTimer = setInterval(pollPackBatchOnce, 2000);
        }

        function beginPackBatch(jobIds) {
            const ids = (jobIds || []).filter(Boolean);
            if (!ids.length) {
                showMessage('✗ ' + UI.noJobs, 'error');
                return false;
            }
            packBatchJobIds = ids;
            packBatchVisible = true;
            packBatchRunning = true;
            persistPackBatchIds(ids);
            renderPackBatchStatus({
                stepFinished: 0,
                stepTotal: ids.length * PACK_GENERATION_STEPS.length,
                jobFinished: 0,
                jobTotal: ids.length,
                jobFailed: 0,
                inFlight: true,
                allDone: false
            });
            syncGenerationLocks();
            startPackBatchPolling();
            return true;
        }

        function tryRestorePackBatch(jobs) {
            if (packBatchVisible || regenerateRunning) return;
            const persisted = readPersistedPackBatchIds();
            let ids = persisted;
            if (!ids || !ids.length) {
                const inflight = (jobs || []).filter(isPackGenerationInFlight).map(function(j) { return j.id; });
                if (!inflight.length) return;
                ids = inflight;
            }
            const batchJobs = batchJobsFromList(jobs, ids);
            if (!batchJobs.some(isPackGenerationInFlight)) {
                persistPackBatchIds(null);
                return;
            }
            packBatchJobIds = ids;
            packBatchVisible = true;
            packBatchRunning = true;
            persistPackBatchIds(ids);
            renderPackBatchStatus(summarizeBatchProgress(batchJobs));
            startPackBatchPolling();
        }

        // 刷新列表
        async function refreshList() {
            try {
                const response = await fetch('/api/jobs');
                const jobs = await response.json();
                await refreshListFromJobs(jobs);
                tryRestorePackBatch(jobs);
                if (packBatchVisible && packBatchJobIds) {
                    renderPackBatchStatus(summarizeBatchProgress(batchJobsFromList(jobs, packBatchJobIds)));
                }
            } catch (error) {
                document.getElementById('jdList').innerHTML = '<p class="error">' + UI.msgLoadFailed + error.message + '</p>';
            }
        }

        async function refreshListFromJobs(jobs) {
            const listDiv = document.getElementById('jdList');
            if (!jobs || jobs.length === 0) {
                listDiv.innerHTML = '<div class="empty-state"><h3>' + UI.noJobsTitle + '</h3><p>' + UI.noJobsHint + '</p></div>';
                return;
            }

            listDiv.innerHTML = jobs.map(job => {
                const status = job.status || {};
                const progress = job.progress;
                const statusText = progress ? (progress === 'review' ? UI.statusRegen2 : UI.statusRegen1) : getStatusText(status);
                const statusClass = progress ? 'status-in-progress' : getStatusClass(status);
                const title = job.title || UI.jobTitleDefault;
                const content = job.content || '';
                const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const progressPct = progress === 'review' ? 100 : (progress === 'regenerate' ? 50 : 0);
                const regenProgressBar = progress ? \`
                    <div class="regenerate-progress">
                        <div class="regenerate-label">\${progress === 'review' ? UI.statusRegenLabel2 : UI.statusRegenLabel1}</div>
                        <div class="regenerate-bar"><div class="regenerate-bar-fill" style="width:\${progressPct}%"></div></div>
                    </div>
                \` : '';
                const packProgressBar = progress ? '' : packStepProgressHtml(job);
                const progressBar = regenProgressBar || packProgressBar;
                const modeClass = job.hasCompanyInfo ? 'has-company-profile' : 'jd-only';
                const modeBadgeClass = job.hasCompanyInfo ? 'has-company' : 'jd-only';
                const modeText = job.hasCompanyInfo ? UI.modeHasCompany : UI.modeJdOnly;
                const trackLabel = job.applicationTrack === 'it-support'
                    ? UI.trackItSupport
                    : UI.trackSoftwareEngineering;
                const inFlight = !!(progress || (status?.steps && Object.values(status.steps).some(s => s === 'in_progress')));
                const generatingClass = isPackGenerationInFlight(job) || progress ? ' is-generating' : (isBatchJobFailed(job) ? ' is-failed' : '');
                const editBtn = inFlight
                    ? ''
                    : \`<button type="button" onclick="openEditJobModal('\${job.id}')">✏️ \${UI.btnEdit}</button>\`;
                const genDisabled = isGenerationLocked() ? ' disabled' : '';
                return \`
                    <div class="jd-item \${modeClass}\${generatingClass}" data-job-id="\${job.id}">
                        <div class="jd-item-header">
                            <div>
                                <div class="jd-item-title">\${title} <span class="jd-mode-badge \${modeBadgeClass}">\${modeText}</span> <span class="jd-mode-badge">\${trackLabel}</span></div>
                                <div class="jd-item-id">ID: \${job.id}</div>
                            </div>
                            <div class="jd-item-actions">
                                <span class="status-badge \${statusClass}" id="status-badge-\${job.id}">\${statusText}</span>
                                <button onclick="generateJob('\${job.id}')" class="success" id="generate-btn-\${job.id}"\${genDisabled}>⚡ \${UI.btnGenerate}</button>
                                \${editBtn}
                                <button onclick="toggleJdContent('\${job.id}')">📄 \${UI.btnViewJd}</button>
                                <button onclick="viewResults('\${job.id}')">📊 \${UI.btnViewResults}</button>
                                <button type="button" onclick="openRegenerateModal('\${job.id}')" class="success" id="regen-btn-\${job.id}" style="display:\${status?.steps?.review === 'completed' && !progress ? 'inline-block' : 'none'}"\${genDisabled}>♻️ \${UI.btnRegenerate}</button>
                                <button type="button" class="success" onclick="archiveOneJob('\${job.id}')">🗂️ \${UI.btnArchiveJob}</button>
                                <button onclick="deleteJob('\${job.id}')" class="danger">🗑️ \${UI.btnDelete}</button>
                            </div>
                        </div>
                        <div id="regenerate-progress-wrap-\${job.id}" class="regenerate-progress-wrap">\${progressBar}</div>
                        <div id="jd-content-\${job.id}" class="jd-item-content">\${escapedContent}</div>
                        <div id="results-\${job.id}" class="results-panel"></div>
                    </div>
                \`;
            }).join('');
            syncGenerationLocks();
        }

        function getStatusText(status) {
            if (!status.steps) return UI.statusNotStarted;
            const steps = status.steps;
            if (steps.review === 'completed') return UI.statusFinished;
            if (steps.coverLetter === 'completed') return UI.statusGenerating + ' (6/7)';
            if (steps.summary === 'completed') return UI.statusGenerating + ' (5/7)';
            if (steps.experienceBullets === 'completed') return UI.statusGenerating + ' (4/7)';
            if (steps.mapping === 'completed') return UI.statusGenerating + ' (3/7)';
            if (steps.painPoints === 'completed') return UI.statusGenerating + ' (2/7)';
            if (steps.companyResearch === 'completed') return UI.statusGenerating + ' (1/7)';
            return UI.statusNotStarted;
        }

        // 获取状态样式类
        function getStatusClass(status) {
            if (!status.steps) return 'status-pending';
            const steps = status.steps;
            // 如果所有主要步骤都完成了，使用已结束样式（浅蓝色）
            if (steps.review === 'completed' || steps.coverLetter === 'completed') return 'status-finished';
            if (steps.render === 'completed') return 'status-completed';
            if (Object.values(steps).some(s => s === 'in_progress')) return 'status-in-progress';
            if (Object.values(steps).some(s => s === 'failed')) return 'status-failed';
            return 'status-pending';
        }

        function copyResultSection(btn) {
            var wrap = btn.closest('.result-content-wrap');
            var content = wrap ? wrap.querySelector('.result-content') : null;
            if (content && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(content.innerText || content.textContent).then(function() {
                    showMessage(UI.msgCopied, 'success');
                }).catch(function() { showMessage(UI.copyFailed, 'error'); });
            } else {
                showMessage(UI.copyFailed, 'error');
            }
        }

        // 仅更新单个职位卡片的进度/状态（不整表刷新）
        function updateJobCard(jobId, job) {
            const card = document.querySelector('.jd-item[data-job-id="' + jobId + '"]');
            if (!card) return;
            const status = job.status || {};
            const progress = job.progress;
            const statusText = progress ? (progress === 'review' ? UI.statusRegen2 : UI.statusRegen1) : getStatusText(status);
            const statusClass = progress ? 'status-in-progress' : getStatusClass(status);
            const progressPct = progress === 'review' ? 100 : (progress === 'regenerate' ? 50 : 0);
            const regenProgressBar = progress ? '<div class="regenerate-progress"><div class="regenerate-label">' + (progress === 'review' ? UI.statusRegenLabel2 : UI.statusRegenLabel1) + '</div><div class="regenerate-bar"><div class="regenerate-bar-fill" style="width:' + progressPct + '%"></div></div></div>' : '';
            const progressBarHtml = regenProgressBar || packStepProgressHtml(job);
            const badge = card.querySelector('#status-badge-' + jobId);
            if (badge) { badge.textContent = statusText; badge.className = 'status-badge ' + statusClass; }
            const progressWrap = card.querySelector('#regenerate-progress-wrap-' + jobId);
            if (progressWrap) {
                progressWrap.innerHTML = progressBarHtml;
                progressWrap.style.display = progressBarHtml ? 'block' : 'none';
            }
            const regenBtn = card.querySelector('#regen-btn-' + jobId);
            if (regenBtn) regenBtn.style.display = (status && status.steps && status.steps.review === 'completed' && !progress) ? 'inline-block' : 'none';
            card.classList.toggle('is-generating', !!(isPackGenerationInFlight(job) || progress));
            card.classList.toggle('is-failed', !progress && isBatchJobFailed(job));
        }

        // 查看结果
        async function viewResults(jobId) {
            const panel = document.getElementById('results-' + jobId);
            
            if (panel.classList.contains('active')) {
                panel.classList.remove('active');
                return;
            }

            panel.classList.add('active');
            panel.innerHTML = '<p>' + UI.loading + '</p>';

            try {
                const response = await fetch(\`/api/results/\${jobId}\`);
                const results = await response.json();

                if (!results.exists) {
                    panel.innerHTML = '<p>' + UI.msgNoResults + '</p>';
                    return;
                }

                // HTML 转义函数
                function escapeHtml(text) {
                    if (!text) return '';
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                let html = '';
                if (results.hasCompanyInfo) {
                    html += '<div class="results-mode-banner has-company">' + UI.resultsBannerCompany + '</div>';
                } else {
                    html += '<div class="results-mode-banner jd-only">' + UI.resultsBannerJdOnly + '</div>';
                }
                if (results.truncated && (results.truncated.companyResearch || results.truncated.painPoints || results.truncated.mapping)) {
                    const parts = [];
                    if (results.truncated.companyResearch) parts.push(UI.truncationCompany);
                    if (results.truncated.painPoints) parts.push(UI.truncationPainPoints);
                    if (results.truncated.mapping) parts.push(UI.truncationMapping);
                    html += '<div class="results-mode-banner truncation-warning">⚠️ ' + UI.resultsTruncation + parts.join(UI.truncationSep) + UI.resultsTruncationSuffix + '</div>';
                }

                if (results.companyProfile) {
                    html += \`
                        <div class="result-section">
                            <h4>🏢 \${UI.resultCompanyProfile}</h4>
                            <div class="result-content">\${escapeHtml(results.companyProfile)}</div>
                        </div>
                    \`;
                }

                if (results.summary) {
                    const whitespaceRegex = /[\\s\\n\\r\\t]+/g;
                    const cleanedSummary = results.summary.replace(whitespaceRegex, ' ').trim();
                    const summaryEscaped = escapeHtml(cleanedSummary);
                    html += \`
                        <div class="result-section">
                            <h4>📄 \${UI.resultSummary}</h4>
                            <div class="result-content-wrap">
                                <button type="button" class="copy-btn" onclick="copyResultSection(this)" title="\${UI.copyBtn}">\${UI.copyBtn}</button>
                                <div class="result-content">\${summaryEscaped}</div>
                            </div>
                        </div>
                    \`;
                }

                if (results.experienceBullets) {
                    var expText = results.experienceBullets.trim();
                    var expBlocks = expText.split(/(?:\\r?\\n)+(?=[^\\n]+\\s+-\\s+[^\\n]+(?=\\r?\\n|$))/).filter(Boolean);
                    if (expBlocks.length === 0) expBlocks = [expText];
                    html += '<div class="result-section"><h4>📝 ' + UI.resultExperience + '</h4></div>';
                    for (var i = 0; i < expBlocks.length; i++) {
                        var block = expBlocks[i];
                        var nl = block.indexOf('\\n');
                        var blockTitle = nl >= 0 ? block.slice(0, nl).trim() : block.trim();
                        var blockBody = nl >= 0 ? block.slice(nl + 1).trim() : '';
                        html += \`
                            <div class="result-section result-subsection">
                                <h4>\${escapeHtml(blockTitle)}</h4>
                                <div class="result-content-wrap">
                                    <button type="button" class="copy-btn" onclick="copyResultSection(this)" title="\${UI.copyBtn}">\${UI.copyBtn}</button>
                                    <div class="result-content">\${escapeHtml(blockBody)}</div>
                                </div>
                            </div>
                        \`;
                    }
                }

                if (results.coverLetter) {
                    html += \`
                        <div class="result-section">
                            <h4>✉️ \${UI.resultCoverLetter}</h4>
                            <div class="result-content-wrap">
                                <button type="button" class="copy-btn" onclick="copyResultSection(this)" title="\${UI.copyBtn}">\${UI.copyBtn}</button>
                                <div class="result-content">\${escapeHtml(results.coverLetter)}</div>
                            </div>
                        </div>
                    \`;
                }

                if (results.mapping) {
                    html += \`
                        <div class="result-section">
                            <h4>🗺️ \${UI.resultMapping}</h4>
                            <div class="result-content">\${escapeHtml(results.mapping)}</div>
                        </div>
                    \`;
                }

                if (results.review) {
                    html += \`
                        <div class="result-section">
                            <h4>🔎 \${UI.resultReview}</h4>
                            <div class="result-content">\${escapeHtml(results.review)}</div>
                        </div>
                    \`;
                }
                if (results.regenerateFeedback) {
                    html += \`
                        <div class="result-section">
                            <h4>📋 \${UI.resultRegenFeedback}</h4>
                            <div class="regen-fb-content result-content regenerate-feedback-md">\${escapeHtml(results.regenerateFeedback)}</div>
                        </div>
                    \`;
                }

                panel.innerHTML = html || ('<p>' + UI.msgNoResults + '</p>');
                const fbDiv = panel.querySelector('.regen-fb-content');
                if (fbDiv && results.regenerateFeedback && typeof marked !== 'undefined') {
                    fbDiv.innerHTML = marked.parse(results.regenerateFeedback);
                }
            } catch (error) {
                panel.innerHTML = '<p class="error">' + UI.msgLoadFailed + error.message + '</p>';
            }
        }

        async function deleteJob(jobId) {
            if (!confirm(UI.msgDeleteConfirm)) return;

            try {
                const response = await fetch(\`/api/jobs/\${jobId}\`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showMessage('✓ ' + UI.msgDeleted, 'success');
                    refreshList();
                } else {
                    const result = await response.json();
                    showMessage('✗ ' + UI.msgDeleteFailed + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            }
        }

        let editJobId = null;
        let editOriginal = null;
        let editHasOutputs = false;

        async function openEditJobModal(jobId) {
            try {
                const response = await fetch('/api/jobs/' + encodeURIComponent(jobId));
                const data = await response.json();
                if (!response.ok) {
                    showMessage('✗ ' + UI.msgError + (data.error || UI.requestFailed), 'error');
                    return;
                }
                if (data.inFlight) {
                    showMessage('✗ ' + UI.msgEditInFlight, 'error');
                    return;
                }
                editJobId = jobId;
                editOriginal = {
                    jd: data.jd || '',
                    companyInfo: data.companyInfo || '',
                    applicationTrack: data.applicationTrack || 'software-engineering'
                };
                editHasOutputs = !!data.hasGenerationOutputs;
                document.getElementById('editJd').value = editOriginal.jd;
                document.getElementById('editCompanyInfo').value = editOriginal.companyInfo;
                setTrackSelection('editApplicationTrack', editOriginal.applicationTrack);
                updateEditUxState();
                document.getElementById('editJobModal').style.display = 'flex';
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            }
        }

        function closeEditJobModal() {
            editJobId = null;
            editOriginal = null;
            editHasOutputs = false;
            document.getElementById('editJobModal').style.display = 'none';
        }

        async function submitEditJob() {
            if (!editJobId || !editOriginal) return;
            const jdText = document.getElementById('editJd').value.trim();
            const companyText = document.getElementById('editCompanyInfo').value.trim();
            const applicationTrack = document.getElementById('editApplicationTrack').value || 'software-engineering';

            if (!jdText) {
                if (!confirm(UI.msgEditEmptyJdDeleteConfirm)) return;
            } else {
                const dirty =
                    jdText !== editOriginal.jd.trim() ||
                    companyText !== (editOriginal.companyInfo || '').trim() ||
                    applicationTrack !== editOriginal.applicationTrack;
                if (dirty && editHasOutputs) {
                    if (!confirm(UI.msgEditClearedPackConfirm)) return;
                }
            }

            const btn = document.getElementById('editSaveBtn');
            if (btn) btn.disabled = true;
            try {
                const response = await fetch('/api/jobs/' + encodeURIComponent(editJobId), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jd: jdText,
                        companyInfo: companyText,
                        applicationTrack
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    showMessage('✗ ' + UI.msgError + (result.error || UI.msgEditBlocked), 'error');
                    return;
                }
                if (result.kind === 'deleted') {
                    showMessage('✓ ' + UI.msgEditDeleted, 'success');
                } else if (result.kind === 'unchanged') {
                    showMessage('✓ ' + UI.msgEditUnchanged, 'info');
                } else {
                    showMessage('✓ ' + UI.msgEditSuccess, 'success');
                }
                closeEditJobModal();
                refreshList();
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        let regenModalJobId = null;
        async function openRegenerateModal(jobId) {
            if (isGenerationLocked()) {
                showMessage(packBatchRunning ? UI.batchBusyHint : UI.regenBusyHint, 'info');
                return;
            }
            regenModalJobId = jobId;
            document.getElementById('regenerateResult').style.display = 'none';
            document.getElementById('regenerateActions').style.display = 'block';
            document.getElementById('regenerateFeedback').value = '';
            document.getElementById('regenerateModal').style.display = 'flex';
            try {
                const res = await fetch('/api/results/' + jobId);
                const data = await res.json();
                if (data.review) document.getElementById('regenerateFeedback').value = data.review;
            } catch (e) {
                document.getElementById('regenerateFeedback').placeholder = UI.regenLoadFeedbackFailed;
            }
        }
        function closeRegenerateModal() {
            document.getElementById('regenerateModal').style.display = 'none';
            regenModalJobId = null;
        }
        async function submitRegenerate() {
            if (!regenModalJobId) return;
            if (isGenerationLocked()) {
                showMessage(packBatchRunning ? UI.batchBusyHint : UI.regenBusyHint, 'info');
                return;
            }
            const jobIdToPoll = regenModalJobId;
            const feedback = document.getElementById('regenerateFeedback').value.trim();
            const btn = document.getElementById('regenerateSubmitBtn');
            btn.disabled = true;
            btn.textContent = UI.regenSubmitInProgress;
            try {
                const res = await fetch('/api/regenerate/' + jobIdToPoll, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedback: feedback || UI.regenSubmitDefault })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || UI.requestFailed);
                closeRegenerateModal();
                showMessage(UI.regenStarted, 'info');
                regenerateRunning = true;
                syncGenerationLocks();
                if (window.regeneratePollingTimer) clearInterval(window.regeneratePollingTimer);
                var doPoll = async function() {
                    try {
                        const r = await fetch('/api/jobs');
                        const jobs = await r.json();
                        var job = jobs.find(function(j) { return j.id === jobIdToPoll; });
                        if (job) updateJobCard(jobIdToPoll, job);
                        if (!job || !job.progress) {
                            if (window.regeneratePollingTimer) { clearInterval(window.regeneratePollingTimer); window.regeneratePollingTimer = null; }
                            regenerateRunning = false;
                            syncGenerationLocks();
                            var panel = document.getElementById('results-' + jobIdToPoll);
                            if (panel && panel.classList.contains('active')) viewResults(jobIdToPoll);
                            refreshList();
                        }
                    } catch (e) {}
                };
                doPoll();
                window.regeneratePollingTimer = setInterval(doPoll, 2500);
                setTimeout(function() {
                    if (window.regeneratePollingTimer) { clearInterval(window.regeneratePollingTimer); window.regeneratePollingTimer = null; }
                    regenerateRunning = false;
                    syncGenerationLocks();
                }, 60000);
            } catch (e) {
                showMessage(UI.msgError + e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = UI.regenerateSubmit;
            }
        }

        // 生成单个职位的申请材料
        async function generateJob(jobId) {
            if (isGenerationLocked()) {
                showMessage(packBatchRunning ? UI.batchBusyHint : UI.regenBusyHint, 'info');
                return;
            }
            const btn = document.getElementById('generate-btn-' + jobId);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = UI.statusGenerating + '... <span class="loading loading-inline"></span>';
            }

            try {
                if (!beginPackBatch([jobId])) return;
                const response = await fetch(\`/api/generate/\${jobId}\`, {
                    method: 'POST'
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('✓ ' + UI.msgGenerateStarted, 'info');
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                    clearPackBatchStatus(true);
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
                clearPackBatchStatus(true);
            }
        }

        async function generateAll() {
            if (isGenerationLocked()) {
                showMessage(packBatchRunning ? UI.batchBusyHint : UI.regenBusyHint, 'info');
                return;
            }
            const btn = document.getElementById('generateAllBtn');

            try {
                const listRes = await fetch('/api/jobs');
                const jobs = await listRes.json();
                const incomplete = (jobs || []).filter(function(j) { return !j.packComplete; }).map(function(j) { return j.id; });
                if (!incomplete.length) {
                    showMessage('✓ ' + UI.statusFinished, 'info');
                    return;
                }
                if (!beginPackBatch(incomplete)) return;
                if (btn) btn.innerHTML = UI.statusGenerating + '... <span class="loading loading-inline"></span>';

                const response = await fetch('/api/generate-all', {
                    method: 'POST'
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('✓ ' + UI.msgGenerateStarted, 'info');
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                    clearPackBatchStatus(true);
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
                clearPackBatchStatus(true);
            }
        }

        // 切换JD内容显示
        function toggleJdContent(jobId) {
            const contentDiv = document.getElementById('jd-content-' + jobId);
            if (contentDiv) {
                contentDiv.classList.toggle('expanded');
            }
        }

        async function clearAll() {
            if (!confirm(UI.msgClearConfirm)) {
                return;
            }

            try {
                const response = await fetch('/api/clear-all', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✓ ' + UI.msgCleared, 'success');
                    clearPackBatchStatus(true);
                    setTimeout(refreshList, 1000);
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            }
        }

        // 显示消息
        function showMessage(text, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.className = 'message ' + type;
            messageDiv.textContent = text;
            setTimeout(() => {
                messageDiv.className = '';
                messageDiv.textContent = '';
            }, 5000);
        }

        // ========== 工作区 | 存档区 导航 ==========
        function switchTab(tab) {
            document.getElementById('navWorkspace').classList.toggle('active', tab === 'workspace');
            document.getElementById('navArchive').classList.toggle('active', tab === 'archive');
            document.getElementById('workspaceView').classList.toggle('active', tab === 'workspace');
            document.getElementById('archiveView').classList.toggle('active', tab === 'archive');
            if (tab === 'archive') loadArchive(1);
        }

        let archivePage = 1;
        let archiveKeyword = '';
        let archiveHasMore = false;
        let archiveLoading = false;

        async function loadArchive(page) {
            if (archiveLoading) return;
            archiveLoading = true;
            if (page === 1) {
                document.getElementById('archiveList').innerHTML = '<p>' + UI.loading + '</p>';
                document.getElementById('archiveLoadMoreWrap').style.display = 'none';
                document.getElementById('archiveEmpty').style.display = 'none';
            }
            const keyword = document.getElementById('archiveSearch').value.trim();
            if (page === 1) archiveKeyword = keyword;
            try {
                const url = \`/api/archive?page=\${page}&limit=100\${keyword ? '&keyword=' + encodeURIComponent(keyword) : ''}\`;
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || UI.requestFailed);
                if (page === 1) {
                    archivePage = 1;
                    renderArchiveGroups(data.groups, true);
                } else {
                    appendArchiveGroups(data.groups);
                }
                archivePage = page;
                archiveHasMore = data.hasMore;
                document.getElementById('archiveLoadMoreWrap').style.display = data.hasMore ? 'block' : 'none';
                if (page === 1 && (!data.groups || data.groups.length === 0)) {
                    document.getElementById('archiveEmpty').style.display = 'block';
                }
            } catch (e) {
                document.getElementById('archiveList').innerHTML = '<p class="error">' + UI.msgLoadFailed + e.message + '</p>';
            } finally {
                archiveLoading = false;
            }
        }

        function renderArchiveGroups(groups, replace) {
            const wrap = document.getElementById('archiveList');
            if (replace) wrap.innerHTML = '';
            if (!groups || groups.length === 0) return;
            groups.forEach(g => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'archive-group';
                groupDiv.innerHTML = '<div class="archive-group-date">' + g.date + '</div>';
                const ul = document.createElement('div');
                g.jobs.forEach(job => {
                    ul.appendChild(renderArchiveJobItem(job));
                });
                groupDiv.appendChild(ul);
                wrap.appendChild(groupDiv);
            });
        }

        function appendArchiveGroups(groups) {
            if (!groups || groups.length === 0) return;
            const wrap = document.getElementById('archiveList');
            groups.forEach(g => {
                const existing = Array.from(wrap.querySelectorAll('.archive-group')).find(el => el.querySelector('.archive-group-date').textContent === g.date);
                const container = existing ? (existing.children[1] || existing) : null;
                if (container) {
                    g.jobs.forEach(job => { container.appendChild(renderArchiveJobItem(job)); });
                } else {
                    const div = document.createElement('div');
                    div.className = 'archive-group';
                    div.innerHTML = '<div class="archive-group-date">' + g.date + '</div>';
                    g.jobs.forEach(job => { div.appendChild(renderArchiveJobItem(job)); });
                    wrap.appendChild(div);
                }
            });
        }

        function renderArchiveJobItem(job) {
            const div = document.createElement('div');
            div.className = 'archive-job-item';
            div.dataset.jobId = job.jobId;
            const title = (job.title || 'Untitled').replace(/</g, '&lt;');
            div.innerHTML = \`
                <div>
                    <strong>\${title}</strong>
                    <span style="color:#999;font-size:12px;margin-left:8px;">ID: \${job.jobId}\${job.hasCompany ? ' · ' + UI.hasCompanyBadge : ''}</span>
                </div>
                <div>
                    <button type="button" onclick="toggleArchiveExpand('\${job.jobId}')">\${UI.expand}</button>
                    <button type="button" class="success" onclick="restoreJob('\${job.jobId}')">\${UI.restoreToWorkspace}</button>
                </div>
            \`;
            const expandWrap = document.createElement('div');
            expandWrap.id = 'archive-expand-' + job.jobId;
            expandWrap.className = 'archive-job-expand';
            expandWrap.style.display = 'none';
            div.appendChild(expandWrap);
            return div;
        }

        async function toggleArchiveExpand(jobId) {
            const wrap = document.getElementById('archive-expand-' + jobId);
            if (!wrap) return;
            if (wrap.style.display === 'block') {
                wrap.style.display = 'none';
                return;
            }
            wrap.innerHTML = UI.loading;
            wrap.style.display = 'block';
            try {
                const res = await fetch('/api/archive/' + jobId);
                const files = await res.json();
                if (!res.ok) throw new Error(files.error || '');
                let html = '';
                const order = ['jd.md','company.txt','company-profile.raw.txt','company-profile.truncated','company-research.prompt.txt','pain-points.raw.txt','pain-points.truncated','pain-points.prompt.txt','mapping.raw.txt','mapping.truncated','mapping.prompt.txt','experience-bullets.raw.txt','experience-bullets.prompt.txt','summary.raw.txt','summary.prompt.txt','cover-letter.raw.txt','cover-letter.prompt.txt','review.raw.txt','review.prompt.txt','status.json'];
                const rest = Object.keys(files).filter(k => !order.includes(k)).sort();
                for (const name of [...order, ...rest]) {
                    if (!files[name]) continue;
                    const isPrompt = name.includes('.prompt.');
                    const label = isPrompt ? '📤 ' + name : '📄 ' + name;
                    const text = (files[name] || '').slice(0, 8000);
                    html += '<h5>' + label + '</h5><pre>' + (text.replace(/</g, '&lt;')) + (files[name].length > 8000 ? '\\n...[truncated]' : '') + '</pre>';
                }
                wrap.innerHTML = html || ('<p>' + UI.noFiles + '</p>');
            } catch (e) {
                wrap.innerHTML = '<p class="error">' + UI.loadFailed + e.message + '</p>';
            }
        }

        function loadArchiveNext() {
            loadArchive(archivePage + 1);
        }

        const archiveScrollCheck = () => {
            const panel = document.getElementById('archiveView');
            if (!panel || !panel.classList.contains('active') || !archiveHasMore || archiveLoading) return;
            const list = document.getElementById('archiveList');
            if (!list) return;
            const rect = list.getBoundingClientRect();
            if (rect.bottom < window.innerHeight + 400) loadArchiveNext();
        };
        window.addEventListener('scroll', archiveScrollCheck, { passive: true });

        async function archiveAll() {
            if (!confirm(UI.archiveConfirm)) return;
            try {
                const res = await fetch('/api/archive', { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '');
                showMessage('✓ ' + UI.archiveSuccess + (data.archived || 0) + UI.archiveSuccessSuffix, 'success');
                celebrateConfetti();
                await renderApplyCounter();
                refreshList();
            } catch (e) {
                showMessage('✗ ' + e.message, 'error');
            }
        }

        async function restoreJob(jobId) {
            try {
                const res = await fetch('/api/archive/' + jobId + '/restore', { method: 'POST' });
                if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || '');
                }
                const item = document.querySelector('.archive-job-item[data-job-id="' + jobId + '"]');
                if (item) item.remove();
                showMessage('✓ ' + UI.restoreSuccess, 'success');
            } catch (e) {
                showMessage('✗ ' + e.message, 'error');
            }
        }
    </script>
</body>
</html>
`;
  let out = html
    .replace(/\{\{langEnActive\}\}/g, lang === 'en' ? 'active' : '')
    .replace(/\{\{langZhActive\}\}/g, lang === 'zh' ? 'active' : '');
  const templateVars = { ...s, dailyThemeName };
  return out.replace(/\{\{(\w+)\}\}/g, (_, k) => (templateVars as Record<string, string>)[k] ?? k);
}

// API: 获取所有 JD 列表
app.get('/api/jobs', (req, res) => {
  try {
    res.json(pack.listJobs());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const inputs = pack.loadJobInputs(jobId);
    const view = pack.listJobs().find((j) => j.id === jobId);
    const inFlight = !!(
      view?.progress ||
      (view?.status?.steps &&
        Object.values(view.status.steps).some((s) => s === 'in_progress'))
    );
    res.json({
      jobId,
      jd: inputs.jd,
      companyInfo: inputs.companyInfo,
      applicationTrack: inputs.applicationTrack,
      hasGenerationOutputs: view?.hasGenerationOutputs ?? false,
      inFlight,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (/not found|missing/i.test(message)) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

app.put('/api/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const { jd, companyInfo, applicationTrack } = req.body ?? {};
    if (
      applicationTrack != null &&
      applicationTrack !== '' &&
      !(TRACK_IDS as readonly string[]).includes(applicationTrack)
    ) {
      return res.status(400).json({
        error: `applicationTrack must be one of: ${TRACK_IDS.join(', ')}`,
      });
    }
    const result = pack.editJob(jobId, {
      jd: typeof jd === 'string' ? jd : '',
      companyInfo: typeof companyInfo === 'string' ? companyInfo : '',
      applicationTrack: (applicationTrack as TrackId) || 'software-engineering',
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof JobNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof JobEditBlockedError) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 添加 job（公司信息 + JD 两个独立输入）
app.post('/api/ingest', (req, res) => {
  try {
    const { jd, companyInfo, applicationTrack } = req.body;

    if (!jd || !jd.trim()) {
      return res.status(400).json({ error: 'Job description (jd) is required' });
    }

    if (
      !applicationTrack ||
      !(TRACK_IDS as readonly string[]).includes(applicationTrack)
    ) {
      return res.status(400).json({
        error: `applicationTrack must be one of: ${TRACK_IDS.join(', ')}`,
      });
    }
    const trackId = applicationTrack as TrackId;

    const jdText = jd.trim();
    const companyText =
      companyInfo && typeof companyInfo === 'string' ? companyInfo.trim() : '';
    const timestamp = Date.now();
    const jobId = `${timestamp}`;

    pack.saveJobInputs(jobId, {
      jd: jdText,
      companyInfo: companyText,
      applicationTrack: trackId,
    });

    res.json({
      success: true,
      jobId,
      applicationTrack: trackId,
      message: `Job saved (JD + ${companyText ? 'company info' : 'no company info'})`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 删除 job
app.delete('/api/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    pack.deleteJob(jobId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 获取生成结果（返回原始 GPT 响应）
app.get('/api/results/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const results = pack.readPack(jobId);
    res.json({
      exists: results.exists,
      hasCompanyInfo: results.hasCompanyInfo,
      companyProfile: results.companyProfile,
      painPoints: results.painPoints,
      mapping: results.mapping,
      experienceBullets: results.experienceBullets,
      summary: results.summary,
      coverLetter: results.coverLetter,
      review: results.review,
      regenerateFeedback: results.regenerateFeedback,
      truncated: results.truncation,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 重新生成 Summary / 经历要点 / 求职信（后台执行，完成后自动再跑审查）
app.post('/api/regenerate/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback : '';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
    }
    res.json({
      success: true,
      message: 'Regenerate started in background; review will run after completion.',
    });

    setImmediate(async () => {
      try {
        const model = process.env.OPENAI_MODEL || 'gpt-5.2';
        const responsesModel = process.env.OPENAI_RESPONSES_MODEL || 'gpt-4o';
        const openai = new OpenAIService({ apiKey, model, responsesModel });
        console.log(`[Regenerate] Job ${jobId}: updating pack + review...`);
        await pack.regeneratePack(jobId, feedback, { model: openai });
        console.log(`[Regenerate] Job ${jobId}: 完成`);
      } catch (err) {
        console.error('Regenerate/review error:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 清理所有数据
app.post('/api/clear-all', (req, res) => {
  try {
    pack.clearAllJobsAndOutputs();
    res.json({
      success: true,
      message: 'All data cleared successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API: 生成单个 JD（后台运行）
app.post('/api/generate/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // 立即返回响应，后台运行
    res.json({ success: true, message: 'Generation started in background' });

    // 后台运行生成
    setImmediate(async () => {
      try {
        await generateCommand({ job: jobId, concurrency: 1 });
      } catch (error) {
        console.error('Background generation error:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// API: 一键生成所有 JD（后台运行）
app.post('/api/generate-all', async (req, res) => {
  try {
    // 立即返回响应，后台运行
    res.json({ success: true, message: 'Generation started in background' });

    // 后台运行生成
    setImmediate(async () => {
      try {
        await generateCommand({ concurrency: 1 });
      } catch (error) {
        console.error('Background generation error:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 存档列表（分页 + 按日分组 + 关键词搜索）
app.get('/api/archive', (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 100));
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
    const result = listArchive({ page, limit, keyword });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 单个存档详情（展开时用）
app.get('/api/archive/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const detail = getArchiveJobDetail(jobId);
    if (!detail) {
      return res.status(404).json({ error: 'Archived job not found' });
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 全部存档（当前工作区所有 job）
app.post('/api/archive', (req, res) => {
  try {
    const jobIds = archiveAllJobs();
    res.json({ success: true, archived: jobIds.length, jobIds });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 单个 job 归档（计一次 Application Submission）
app.post('/api/archive/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || jobId === 'restore') {
      return res.status(400).json({ error: 'Invalid jobId' });
    }
    archiveJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 返回工作区（从存档恢复一个 job）
app.post('/api/archive/:jobId/restore', (req, res) => {
  try {
    const { jobId } = req.params;
    restoreJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// 投递进度：今日数 / 连续天数 / 热度图（Submission Ledger 投影）
app.get('/api/submissions/stats', (req, res) => {
  try {
    res.json(getSubmissionStats(process.cwd()));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Home: serve UI with locale from query (default en)
app.get('/', (req, res) => {
  const lang = (req.query.lang === 'zh' ? 'zh' : 'en') as Locale;
  res.send(buildHtml(lang));
});

export function startServer(port: number = 3000) {
  app.listen(port, () => {
    console.log(`🚀 Resume Pack Generator UI running at http://localhost:${port}`);
    console.log(`📝 Open your browser and navigate to the URL above.`);
  });
}
