// ★ Vite entry point cho index.html
// Thay thế toàn bộ babel-loader.js + loadModule chain
// Giữ nguyên thứ tự load y chang cũ

import * as Tone from 'tone'
window.Tone = Tone

// ★ PixiJS — cần cho learnsy-sparkle-settings.jsx (hiệu ứng hạt Plavsky)
// Phải đứng TRƯỚC import sparkle-settings bên dưới — _hasPixi chỉ tính 1 lần lúc file đó load
import * as PIXI from 'pixi.js'
window.PIXI = PIXI

import React from 'react'
import ReactDOM from 'react-dom/client'

// Expose as globals cho các component dùng window.React / ReactDOM trực tiếp
window.React = React
window.ReactDOM = ReactDOM

import './components/globals.jsx'
import './toast.jsx'
import './components/save-result.jsx'
import './components/quiz-player.jsx'
import './components/pw-gate.jsx'
import './components/student-login.jsx'
import './components/home-screen.jsx'
import './components/hist-detail.jsx'
import './components/avatar.jsx'
import './components/files-tab.jsx'
import './components/dashboard.jsx'
import './export-builder.jsx'
import './components/background-settings.jsx'
import './components/learnsy-sparkle-settings.jsx'
import './components/learnsy-dev-icon.jsx'
import './components/learnsy-dev-island.jsx'
import './components/listening-practice.jsx'
import './components/vocab-practice.jsx'
import './app.jsx'
import './ripple-haptic.jsx'
import './components/score-client.jsx'

