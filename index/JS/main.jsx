// ★ Vite entry point cho index.html
// Thay thế toàn bộ babel-loader.js + loadModule chain
// Giữ nguyên thứ tự load y chang cũ

import React from 'react'
import ReactDOM from 'react-dom/client'

// Expose as globals cho các component dùng window.React / ReactDOM trực tiếp
window.React = React
window.ReactDOM = ReactDOM

import './components/globals.jsx'
import './components/save-result.jsx'
import './components/quiz-player.jsx'
import './components/pw-gate.jsx'
import './components/student-login.jsx'
import './components/home-screen.jsx'
import './components/hist-detail.jsx'
import './components/avatar.jsx'
import './components/dashboard.jsx'
import './export-builder.jsx'
import './components/background-settings.jsx'
import './components/listening-practice.jsx'
import './app.jsx'
import './ripple-haptic.jsx'
import './swipe.jsx'
console.log('[index] v2 ✅ loaded!')
