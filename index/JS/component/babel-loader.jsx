import React from 'react'; // Thêm cho đồng bộ, dù file này không dùng JSX

/* ══════════════════════════════════════════════════════════════════
   BABEL-LOADER.JS  ·  Learnsy · Runtime Module Loader & Cache
   Exports (window globals):
     window.loadModule(src) — Fetch, compile (Babel), cache & inject script
     window.clearCache()    — Xóa toàn bộ cache Babel trong sessionStorage

   Vai trò trong giai đoạn Migrate lên Vite:
     - Giúp các file legacy (.js) chưa kịp chuyển sang .jsx vẫn chạy được.
     - Các file đã chuyển sang .jsx sẽ do Vite xử lý trực tiếp (nhanh hơn).
══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try {
    /**
     * Hash ngắn (FNV-1a) để key cache theo NỘI DUNG file.
     * Nhờ vậy chỉ cần sửa code trong file là cache tự động invalidate, 
     * khỏi cần nhớ bump version thủ công (__VER__).
     */
    function _bblHash(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(36);
    }

    /**
     * loadModule(src)
     * Fetch file JS/JSX → Compile qua Babel → Cache vào sessionStorage → Inject vào DOM
     */
    window.loadModule = async function (src) {
      let js = null, key = null;
      try {
        // Fetch source code (kèm query param __VER__ để bypass cache HTTP của trình duyệt/CDN)
        const code = await fetch(src + '?v=' + (window.__VER__ || '1')).then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + src);
          return r.text();
        });

        // Tạo key cache dựa trên hash nội dung + đường dẫn file
        key = 'bbl_' + _bblHash(code) + '_' + src;

        // Kiểm tra cache trong sessionStorage
        try {
          js = sessionStorage.getItem(key);
        } catch (e) { /* ignore */ }

        if (!js) {
          // Chưa có cache → Compile bằng Babel
          if (typeof window.Babel === 'undefined') {
            throw new Error('Babel standalone chưa được load!');
          }
          js = window.Babel.transform(code, { presets: ['react'] }).code;
          
          // Lưu vào cache
          try {
            sessionStorage.setItem(key, js);
          } catch (e) { /* ignore (có thể do full quota) */ }
          
          console.log('[loader] compiled:', src);
        } else {
          console.log('[loader] cached:', src);
        }
      } catch (e) {
        console.error('[loader] FAILED:', src, e);
        
        // Hiển thị lỗi trực quan lên màn hình để dev dễ nhận biết
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:8px 14px;background:#EF4444;color:#fff;font-size:12px;z-index:99999;font-family:monospace;white-space:pre-wrap';
        el.textContent = '⚠️ Load lỗi: ' + src + '\n' + e.message;
        document.body.appendChild(el);
        return;
      }

      // Inject script đã compile vào DOM để thực thi
      const s = document.createElement('script');
      s.textContent = js;
      document.head.appendChild(s);
    };

    /**
     * clearCache()
     * Gõ hàm này trong Console để xóa sạch cache Babel, buộc compile lại toàn bộ.
     */
    window.clearCache = function () {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('bbl_'));
      keys.forEach(k => sessionStorage.removeItem(k));
      console.log('[cache] Đã xóa', keys.length, 'module. Reload trang để compile lại.');
    };

    console.log('[babel-loader] ✓ loaded | Gõ clearCache() để xóa cache');
  } catch (e) {
    console.error('[babel-loader] INIT ERROR:', e);
  }
})();