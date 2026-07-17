import express from 'express';
import { generateCommand } from './commands/generate.js';
import {
  listArchive,
  archiveAllJobs,
  restoreJob,
  getArchiveJobDetail,
} from './services/archive.js';
import { OpenAIService } from './services/openai.js';
import { createApplicationPackModule } from './application-pack/index.js';
import { UI_STRINGS, type Locale } from './i18n.js';

const pack = createApplicationPackModule();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传支持（multer 的简单替代）
app.use(express.raw({ type: 'text/plain', limit: '10mb' }));

function buildHtml(lang: Locale): string {
  const s = UI_STRINGS[lang];
  const langAttr = lang === 'zh' ? 'zh-CN' : 'en';
  const html = `
<!DOCTYPE html>
<html lang="${langAttr}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{pageTitle}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
        }
        .quick-start {
            margin-bottom: 20px;
            padding: 14px 16px;
            border: 1px solid #dbeafe;
            border-radius: 8px;
            background: #f8fbff;
        }
        .quick-start h3 {
            color: #1f4b99;
            font-size: 15px;
            margin-bottom: 8px;
        }
        .quick-start ol {
            margin-left: 20px;
            color: #334155;
            line-height: 1.6;
            font-size: 14px;
        }
        .sequence {
            margin: 0 0 20px;
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #ffffff;
        }
        .sequence h3 {
            margin-bottom: 14px;
            color: #1e293b;
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
            background: #f8fafc;
            border: 1px solid #e2e8f0;
        }
        .sequence-index {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: #2563eb;
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
            color: #1e293b;
        }
        .sequence-item p {
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
        }
        .motivation-card {
            margin-bottom: 20px;
            padding: 16px;
            border-radius: 10px;
            border: 1px solid #fde68a;
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        }
        .apply-counter {
            margin-bottom: 20px;
            padding: 14px 16px;
            border-radius: 10px;
            border: 1px solid #bae6fd;
            background: linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%);
        }
        .apply-counter-title {
            font-size: 15px;
            font-weight: 700;
            color: #0c4a6e;
            margin-bottom: 4px;
        }
        .apply-counter-desc {
            font-size: 13px;
            color: #0369a1;
            margin-bottom: 8px;
        }
        .apply-counter-value {
            font-size: 30px;
            font-weight: 800;
            color: #075985;
            line-height: 1.1;
        }
        .apply-counter-value span {
            font-size: 14px;
            font-weight: 600;
            margin-left: 6px;
            color: #0284c7;
        }
        .apply-streak {
            margin-top: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #0369a1;
        }
        .star-buddy {
            margin-bottom: 20px;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #fbcfe8;
            background: linear-gradient(145deg, #fff7ed 0%, #fdf2f8 45%, #eef2ff 100%);
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
            color: #7c2d12;
            margin-bottom: 4px;
        }
        .star-buddy-subtitle {
            font-size: 13px;
            color: #9a3412;
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
            color: #6b21a8;
            font-size: 14px;
            line-height: 1.55;
            font-weight: 600;
        }
        .motivation-title {
            font-size: 16px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 6px;
        }
        .motivation-subtitle {
            font-size: 13px;
            color: #a16207;
            margin-bottom: 10px;
        }
        .motivation-quote {
            font-size: 14px;
            color: #78350f;
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
            color: #64748b;
        }
        .char-counter {
            color: #475569;
            white-space: nowrap;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
        }
        input[type="text"],
        input[type="url"],
        textarea,
        input[type="file"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
        }
        textarea {
            min-height: 200px;
            resize: vertical;
        }
        button {
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover {
            background-color: #0056b3;
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
            background: #eef2f7;
            color: #334155;
        }
        button.secondary:hover {
            background: #dde5ef;
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
            background-color: #d1ecf1;
            color: #0c5460;
        }
        .jd-list {
            display: grid;
            gap: 15px;
        }
        .empty-state {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            background: #f8fafc;
            padding: 24px;
            text-align: center;
            color: #475569;
        }
        .empty-state h3 {
            color: #1e293b;
            margin-bottom: 8px;
            font-size: 18px;
        }
        .jd-item {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            background: #f9f9f9;
        }
        .jd-item.has-company-profile {
            border-left: 4px solid #28a745;
            background: #f0f9f4;
        }
        .jd-item.jd-only {
            border-left: 4px solid #6c757d;
            background: #f8f9fa;
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
            color: #333;
        }
        .jd-item-id {
            font-size: 12px;
            color: #666;
            font-family: monospace;
        }
        .jd-item-actions {
            display: flex;
            gap: 10px;
        }
        .jd-item-content {
            margin-top: 10px;
            padding: 10px;
            background: #fff;
            border: 1px solid #ddd;
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
            color: #666;
            margin-bottom: 4px;
        }
        .regenerate-progress .regenerate-bar {
            height: 6px;
            background: #e9ecef;
            border-radius: 3px;
            overflow: hidden;
        }
        .regenerate-progress .regenerate-bar-fill {
            height: 100%;
            background: #007bff;
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
        }
        .status-pending {
            background-color: #ffc107;
            color: #856404;
        }
        .status-in-progress {
            background-color: #17a2b8;
            color: #fff;
        }
        .status-completed {
            background-color: #28a745;
            color: #fff;
        }
        .status-finished {
            background-color: #b3d9ff;
            color: #004085;
        }
        .status-failed {
            background-color: #dc3545;
            color: #fff;
        }
        .results-panel {
            display: none;
            margin-top: 15px;
            padding: 15px;
            background: white;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .results-panel.active {
            display: block;
        }
        .result-section {
            margin-bottom: 20px;
        }
        .result-section h4 {
            color: #333;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .result-section.result-subsection { margin-left: 8px; }
        .result-section.result-subsection h4 { font-size: 14px; }
        .result-content-wrap {
            position: relative;
            background: #f9f9f9;
            border-radius: 4px;
            padding: 15px;
        }
        .result-content-wrap .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid #ddd;
            background: #fff;
            border-radius: 4px;
            cursor: pointer;
            opacity: 0.85;
            box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .result-content-wrap .copy-btn:hover {
            opacity: 1;
            background: #f0f0f0;
        }
        .result-content {
            background: #f9f9f9;
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
            background: #fff;
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
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 10px;
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
            border-bottom: 2px solid #dee2e6;
        }
        .top-nav a {
            padding: 12px 24px;
            text-decoration: none;
            color: #495057;
            font-weight: 500;
        }
        .top-nav a:hover { color: #007bff; }
        .top-nav a.active {
            color: #007bff;
            border-bottom: 2px solid #007bff;
            margin-bottom: -2px;
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
            color: #333;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #eee;
        }
        .archive-job-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .archive-job-item:hover { background: #f8f9fa; }
        .archive-job-expand {
            margin-top: 12px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 13px;
        }
        .archive-job-expand h5 { margin: 12px 0 6px; color: #555; }
        .archive-job-expand pre { white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; font-size: 12px; }
        .archive-load-more { margin-top: 16px; }
    </style>
</head>
<body>
    <script>window.UI=${JSON.stringify(s).replace(/</g, '\\u003c')};window.LANG=${JSON.stringify(lang)};</script>
    <div class="container">
        <nav class="top-nav">
            <a href="#" class="active" id="navWorkspace" onclick="switchTab('workspace'); return false;">{{navWorkspace}}</a>
            <a href="#" id="navArchive" onclick="switchTab('archive'); return false;">{{navArchive}}</a>
            <span style="margin-left:auto;padding:12px 0;"><a href="?lang=en" class="{{langEnActive}}" style="text-decoration:none;color:inherit;">{{langSwitcherEn}}</a> | <a href="?lang=zh" class="{{langZhActive}}" style="text-decoration:none;color:inherit;">{{langSwitcherZh}}</a></span>
        </nav>

        <div id="workspaceView" class="view-panel active">
        <div class="header">
            <h1>📝 Resume Pack Generator</h1>
            <p>{{headerSubtitle}}</p>
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
                    <label for="companyInfo">{{companyInfoLabel}}</label>
                    <textarea id="companyInfo" name="companyInfo" placeholder="{{companyInfoPlaceholder}}"></textarea>
                    <div class="field-help-row">
                        <span>{{companyHelper}}</span>
                        <span class="char-counter" id="companyCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="jd">{{jdLabel}}</label>
                    <textarea id="jd" name="jd" required placeholder="{{jdPlaceholder}}"></textarea>
                    <div class="field-help-row">
                        <span id="jdHint">{{jdHelper}}</span>
                        <span class="char-counter" id="jdCount">{{charCount}}: 0</span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="fileUpload">{{fileUploadLabel}}</label>
                    <input type="file" id="fileUpload" accept=".txt,.md">
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
            <div id="jdList" class="jd-list">
                <p>{{loading}}</p>
            </div>
        </div>
        </div>

        <div id="archiveView" class="view-panel">
            <div class="section">
                <h2>{{archiveTitle}}</h2>
                <p style="color:#666;margin-bottom:16px;">{{archiveDesc}}</p>
                <div class="archive-toolbar">
                    <input type="text" id="archiveSearch" placeholder="{{archiveSearchPlaceholder}}" onkeypress="if(event.key==='Enter')loadArchive(1)">
                    <button type="button" onclick="loadArchive(1)">{{archiveSearchBtn}}</button>
                </div>
                <div id="archiveList"></div>
                <div id="archiveLoadMoreWrap" class="archive-load-more" style="display:none;">
                    <button type="button" id="archiveLoadMoreBtn" onclick="loadArchiveNext()">{{loadMore}}</button>
                </div>
                <div id="archiveEmpty" style="display:none;color:#666;padding:20px;">{{archiveEmpty}}</div>
            </div>
        </div>
    </div>

    <div id="confettiLayer" class="confetti-layer"></div>
    <div id="regenerateModal" class="modal-overlay" style="display:none;">
        <div class="modal">
            <h3>{{regenerateModalTitle}}</h3>
            <p style="color:#666;font-size:14px;margin-bottom:12px;">{{regenerateModalDesc}}</p>
            <textarea id="regenerateFeedback" placeholder="{{regeneratePlaceholder}}"></textarea>
            <div id="regenerateActions">
                <button type="button" class="success" id="regenerateSubmitBtn" onclick="submitRegenerate()">{{regenerateSubmit}}</button>
                <button type="button" onclick="closeRegenerateModal()">{{cancel}}</button>
            </div>
            <div id="regenerateResult" style="display:none;margin-top:20px;">
                <h4>{{regenerateUpdated}}</h4>
                <p style="color:#666;margin-bottom:8px;">{{regenerateFeedbackLabel}}</p>
                <div id="regenerateFeedbackBody" class="regenerate-feedback-md result-content"></div>
                <button type="button" onclick="closeRegenerateModal()" style="margin-top:16px;">{{close}}</button>
            </div>
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
        const APPLY_STATE_KEY = 'daily_apply_counter_v1';

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

        function todayKey() {
            const now = new Date();
            return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
        }

        function readApplyState() {
            try {
                const raw = localStorage.getItem(APPLY_STATE_KEY);
                if (!raw) return { date: todayKey(), count: 0, jobs: [], activeDates: [] };
                const parsed = JSON.parse(raw);
                const date = parsed && parsed.date ? parsed.date : todayKey();
                const activeDates = Array.isArray(parsed.activeDates) ? parsed.activeDates : [];
                if (date !== todayKey()) return { date: todayKey(), count: 0, jobs: [], activeDates };
                return {
                    date,
                    count: Number(parsed.count || 0),
                    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
                    activeDates,
                };
            } catch (_) {
                return { date: todayKey(), count: 0, jobs: [], activeDates: [] };
            }
        }

        function writeApplyState(state) {
            try { localStorage.setItem(APPLY_STATE_KEY, JSON.stringify(state)); } catch (_) {}
        }

        function dateOffsetStr(baseDateStr, offsetDays) {
            const d = new Date(baseDateStr + 'T00:00:00');
            d.setDate(d.getDate() + offsetDays);
            return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
        }

        function calcStreak(activeDates) {
            const active = new Set(activeDates);
            let streak = 0;
            const today = todayKey();
            while (active.has(dateOffsetStr(today, -streak))) {
                streak += 1;
            }
            return streak;
        }

        function renderApplyCounter() {
            const el = document.getElementById('applyCounterValue');
            const streakEl = document.getElementById('applyStreakValue');
            if (!el) return;
            const state = readApplyState();
            el.innerHTML = String(state.count) + ' <span>' + UI.applyCounterUnit + '</span>';
            if (streakEl) streakEl.textContent = '🔥 ' + UI.streakLabel + ': ' + calcStreak(state.activeDates) + ' ' + UI.streakUnit;
        }

        function celebrateConfetti() {
            const layer = document.getElementById('confettiLayer');
            if (!layer) return;
            const colors = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa'];
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

        function markApplied(jobId) {
            const state = readApplyState();
            const today = todayKey();
            if (!state.jobs.includes(jobId)) {
                state.jobs.push(jobId);
                state.count += 1;
                if (!state.activeDates.includes(today)) state.activeDates.push(today);
            }
            writeApplyState(state);
            renderApplyCounter();
            celebrateConfetti();
            showMessage('🎉 ' + UI.applySuccess, 'success');
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
            updateInputUxState();
            renderApplyCounter();
            renderDailyStarBuddy();
            refreshMotivation();
            refreshList();
        });

        // 文件上传处理
        document.getElementById('fileUpload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                document.getElementById('jd').value = text;
                showMessage(UI.msgFileLoaded, 'success');
            } catch (error) {
                showMessage(UI.msgFileError + error.message, 'error');
            }
        });

        // 表单提交
        document.getElementById('jdForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const jdText = document.getElementById('jd').value.trim();
            const companyText = (document.getElementById('companyInfo') && document.getElementById('companyInfo').value) ? document.getElementById('companyInfo').value.trim() : '';
            if (!jdText) {
                showMessage('✗ ' + UI.msgJdRequired, 'error');
                return;
            }
            try {
                const response = await fetch('/api/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jd: jdText, companyInfo: companyText || undefined })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✓ ' + UI.msgSaveSuccess + result.jobId, 'success');
                    e.target.reset();
                    refreshList();
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            }
        });

        // 刷新列表
        async function refreshList() {
            try {
                const response = await fetch('/api/jobs');
                const jobs = await response.json();
                
                const listDiv = document.getElementById('jdList');
                if (jobs.length === 0) {
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
                    const progressBar = progress ? \`
                        <div class="regenerate-progress">
                            <div class="regenerate-label">\${progress === 'review' ? UI.statusRegenLabel2 : UI.statusRegenLabel1}</div>
                            <div class="regenerate-bar"><div class="regenerate-bar-fill" style="width:\${progressPct}%"></div></div>
                        </div>
                    \` : '';
                    const modeClass = job.hasCompanyProfile ? 'has-company-profile' : 'jd-only';
                    const modeBadgeClass = job.hasCompanyProfile ? 'has-company' : 'jd-only';
                    const modeText = job.hasCompanyProfile ? UI.modeHasCompany : UI.modeJdOnly;
                    return \`
                        <div class="jd-item \${modeClass}" data-job-id="\${job.id}">
                            <div class="jd-item-header">
                                <div>
                                    <div class="jd-item-title">\${title} <span class="jd-mode-badge \${modeBadgeClass}">\${modeText}</span></div>
                                    <div class="jd-item-id">ID: \${job.id}</div>
                                </div>
                                <div class="jd-item-actions">
                                    <span class="status-badge \${statusClass}" id="status-badge-\${job.id}">\${statusText}</span>
                                    <button onclick="generateJob('\${job.id}')" class="success" id="generate-btn-\${job.id}">⚡ \${UI.btnGenerate}</button>
                                    <button onclick="toggleJdContent('\${job.id}')">📄 \${UI.btnViewJd}</button>
                                    <button onclick="viewResults('\${job.id}')">📊 \${UI.btnViewResults}</button>
                                    <button type="button" onclick="openRegenerateModal('\${job.id}')" class="success" id="regen-btn-\${job.id}" style="display:\${status?.steps?.review === 'completed' && !progress ? 'inline-block' : 'none'}">♻️ \${UI.btnRegenerate}</button>
                                    <button type="button" onclick="markApplied('\${job.id}')">🎯 \${UI.btnMarkApplied}</button>
                                    <button onclick="deleteJob('\${job.id}')" class="danger">🗑️ \${UI.btnDelete}</button>
                                </div>
                            </div>
                            <div id="regenerate-progress-wrap-\${job.id}" class="regenerate-progress-wrap">\${progressBar}</div>
                            <div id="jd-content-\${job.id}" class="jd-item-content">\${escapedContent}</div>
                            <div id="results-\${job.id}" class="results-panel"></div>
                        </div>
                    \`;
                }).join('');
            } catch (error) {
                document.getElementById('jdList').innerHTML = '<p class="error">' + UI.msgLoadFailed + error.message + '</p>';
            }
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
            const progressBarHtml = progress ? '<div class="regenerate-progress"><div class="regenerate-label">' + (progress === 'review' ? UI.statusRegenLabel2 : UI.statusRegenLabel1) + '</div><div class="regenerate-bar"><div class="regenerate-bar-fill" style="width:' + progressPct + '%"></div></div></div>' : '';
            const badge = card.querySelector('#status-badge-' + jobId);
            if (badge) { badge.textContent = statusText; badge.className = 'status-badge ' + statusClass; }
            const progressWrap = card.querySelector('#regenerate-progress-wrap-' + jobId);
            if (progressWrap) { progressWrap.innerHTML = progressBarHtml; progressWrap.style.display = progress ? 'block' : 'none'; }
            const regenBtn = card.querySelector('#regen-btn-' + jobId);
            if (regenBtn) regenBtn.style.display = (status && status.steps && status.steps.review === 'completed' && !progress) ? 'inline-block' : 'none';
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
                if (results.hasCompanyProfile) {
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

        let regenModalJobId = null;
        async function openRegenerateModal(jobId) {
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
                if (window.regeneratePollingTimer) clearInterval(window.regeneratePollingTimer);
                var doPoll = async function() {
                    try {
                        const r = await fetch('/api/jobs');
                        const jobs = await r.json();
                        var job = jobs.find(function(j) { return j.id === jobIdToPoll; });
                        if (job) updateJobCard(jobIdToPoll, job);
                        if (!job || !job.progress) {
                            if (window.regeneratePollingTimer) { clearInterval(window.regeneratePollingTimer); window.regeneratePollingTimer = null; }
                            var panel = document.getElementById('results-' + jobIdToPoll);
                            if (panel && panel.classList.contains('active')) viewResults(jobIdToPoll);
                        }
                    } catch (e) {}
                };
                doPoll();
                window.regeneratePollingTimer = setInterval(doPoll, 2500);
                setTimeout(function() {
                    if (window.regeneratePollingTimer) { clearInterval(window.regeneratePollingTimer); window.regeneratePollingTimer = null; }
                }, 60000);
            } catch (e) {
                showMessage(UI.msgError + e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = UI.regenerateSubmit;
            }
        }

        // 生成单个职位
        async function generateJob(jobId) {
            const btn = document.getElementById('generate-btn-' + jobId);
            if (!btn) return;
            
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.innerHTML = UI.statusGenerating + '... <span class="loading"></span>';

            try {
                const response = await fetch(\`/api/generate/\${jobId}\`, {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✓ ' + UI.msgGenerateStarted, 'info');
                    setTimeout(refreshList, 2000);
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }

        async function generateAll() {
            const btn = document.getElementById('generateAllBtn');
            const originalText = btn.textContent;
            
            btn.disabled = true;
            btn.innerHTML = UI.statusGenerating + '... <span class="loading"></span>';

            try {
                const response = await fetch('/api/generate-all', {
                    method: 'POST'
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✓ ' + UI.msgGenerateStarted, 'info');
                    setTimeout(refreshList, 2000);
                } else {
                    showMessage('✗ ' + UI.msgError + result.error, 'error');
                }
            } catch (error) {
                showMessage('✗ ' + UI.msgError + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
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
  return out.replace(/\{\{(\w+)\}\}/g, (_, k) => (s as Record<string, string>)[k] ?? k);
}

// API: 获取所有 JD 列表
app.get('/api/jobs', (req, res) => {
  try {
    const jobIds = pack.listJobIds();
    const jobs = jobIds.map((jobId) => {
      const inputs = pack.loadJobInputs(jobId);
      let jdContent = inputs.jd;
      const lines = jdContent.split('\n');
      if (lines[0]?.startsWith('#')) {
        jdContent = lines.slice(1).join('\n');
      }
      if (jdContent.includes('URL:')) {
        jdContent = jdContent.replace(/URL:.*\n/, '');
      }
      jdContent = jdContent.replace(/##\s*Job\s*Description\s*\n?/i, '');
      const title = jdContent.trim().substring(0, 50).replace(/\n/g, ' ').trim();
      const finalTitle =
        title.length < jdContent.trim().length ? title + '...' : title;

      return {
        id: jobId,
        title: finalTitle,
        content: jdContent.trim(),
        status: pack.readStatus(jobId),
        hasCompanyProfile: pack.readPack(jobId).hasCompanyInfo,
        progress: pack.getProgress(jobId),
      };
    });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API: 添加 job（公司信息 + JD 两个独立输入）
app.post('/api/ingest', (req, res) => {
  try {
    const { jd, companyInfo } = req.body;

    if (!jd || !jd.trim()) {
      return res.status(400).json({ error: 'Job description (jd) is required' });
    }

    const jdText = jd.trim();
    const companyText =
      companyInfo && typeof companyInfo === 'string' ? companyInfo.trim() : '';
    const timestamp = Date.now();
    const jobId = `${timestamp}`;

    pack.saveJobInputs(jobId, {
      jd: jdText,
      companyInfo: companyText,
    });

    res.json({
      success: true,
      jobId,
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
      hasCompanyProfile: results.hasCompanyInfo,
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
        pack.setProgress(jobId, null);
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
