// ★ Vite entry point cho admin.html
// Thay thế toàn bộ babel-loader.js + loadModule chain
// Giữ nguyên thứ tự load y chang cũ

// 1. Colors & parsers (phải có trước)
import './learnsy-colors.jsx'
import './learnsy-parsers.jsx'

// 2. UI utilities
import './banh-beo-ui.jsx'
import './confirm-dialog.jsx'
import './themes.jsx'
import './ux-nung.jsx'
import './sounds.jsx'

// 3. Auth & components
import './login.jsx'
import './question-editor.jsx'
import './pw-gate.jsx'
import './merge-questions.jsx'

// 4. Admin modules
import './components/chat-mini.jsx'
import './components/preview-panel.jsx'
import './components/listening-panel.jsx'
import './student-manager.jsx'
import './components/dashboard.jsx'

// 5. App chính (cuối cùng)
import './app.jsx'
// 6. question-editor
import '. question-editor.jsx'

console.log('[admin] v3 ✅ loaded!')

// ── CustomEvent Bridge ───────────────────────────────────────────
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

window.setLessonsFromBridge = function(lessons) {
  window.dispatchEvent(new CustomEvent('learnsy:set-lessons', { detail: { lessons } }))
}