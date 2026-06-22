// ★ Vite entry point cho admin.html
// Thay thế toàn bộ babel-loader.js + loadModule chain
// Giữ nguyên thứ tự load y chang cũ

import './colors.js'
import './parsers.js'
import './components/ui-components.jsx'
import './login.jsx'
import './question-editor.jsx'
import './components/chat-mini.jsx'
import './components/preview-panel.jsx'
import './components/listening-panel.jsx'
import './student-manager.jsx'
import './components/dashboard.jsx'
import './app.jsx'

console.log('[admin] v3 ✅ loaded!')

// ── CustomEvent Bridge ───────────────────────────────────────────
// 1. Guard reentrancy: ngăn renderLessons gọi lại chính nó → stack overflow
let _renderingLessons = false
window.addEventListener('learnsy:render-lessons', () => {
  if (_renderingLessons || typeof window.renderLessons !== 'function') return
  _renderingLessons = true
  try {
    const r = window.renderLessons()
    if (r && typeof r.catch === 'function') {
      r.catch(e => console.error('[bridge] renderLessons async error:', e))
    }
  } catch(e) { console.error('[bridge] renderLessons error:', e) }
  finally { _renderingLessons = false }
})

// 2. Helper thay thế window._reactSetLessons
window.setLessonsFromBridge = function(lessons) {
  window.dispatchEvent(new CustomEvent('learnsy:set-lessons', { detail: { lessons } }))
}
