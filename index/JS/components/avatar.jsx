import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   AVATAR.JSX  ·  Learnsy · Avatar System
   Exports (window globals):
     window.useAvatar       — React hook: load/upload/remove avatar
     window.LetterAvatar    — Component: avatar circle (ảnh hoặc chữ cái)
     window.AvatarUploader  — Component: UI upload trong Settings tab

   Phụ thuộc (phải load trước):
     - React (window.React)
     - window.supa           (Supabase client)
     - window.upstashCmd     (proxy /api/cache)
     - CSS animations bb-spin, bb-heartbeat, bb-pop từ dashboard.js
══════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';
  try {
    const { useState, useEffect, useCallback, useRef } = React;

    /* ══ COLOR PALETTES (mirror dashboard) ══ */
    const CL = { card: 'rgba(255,255,255,0.82)' };
    const CD = { card: 'rgba(255,255,255,0.07)' };

    /* ── Bucket config ── */
    const AVATAR_BUCKET = 'avatars'; // Tạo bucket này trong Supabase Storage (public)
    
    /* ══════════════════════════════════════════════════════════════════
       useAvatar(userId)
       Returns: { avatarUrl, loading, uploadAvatar, removeAvatar }
    ══════════════════════════════════════════════════════════════════ */
    function useAvatar(userId) {
      const [avatarUrl, setAvatarUrl] = useState(null);
      const [loading, setLoading] = useState(false);

      // Load on mount
      useEffect(() => {
        if (!userId) return;
        const cached = localStorage.getItem('ls_avatar_' + userId);
        if (cached) { setAvatarUrl(cached); return; }
        (async () => {
          try {
            const url = await window.upstashCmd('GET', 'avatar:user:' + userId);
            if (url) { setAvatarUrl(url); localStorage.setItem('ls_avatar_' + userId, url); }
          } catch (e) { }
        })();
      }, [userId]);

      // Upload: resize → Supabase Storage → Upstash → localStorage
      const uploadAvatar = useCallback(async (file) => {        if (!userId || !file) return { ok: false, msg: 'Thieu thong tin' };
        setLoading(true);
        try {
          // 1. Resize to max 256×256 JPEG via canvas
          const resized = await new Promise((res, rej) => {
            const img = new Image();
            const objUrl = URL.createObjectURL(file);
            img.onload = () => {
              URL.revokeObjectURL(objUrl);
              const MAX = 256;
              let w = img.width, h = img.height;
              if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
              const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
              cv.getContext('2d').drawImage(img, 0, 0, w, h);
              cv.toBlob(b => b ? res(b) : rej(new Error('canvas')), 'image/jpeg', 0.85);
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); rej(new Error('load')); };
            img.src = objUrl;
          });

          // 2. Upload to Supabase Storage
          const path = 'avatars/' + userId + '.jpg';
          const { error: upErr } = await window.supa.storage
            .from(AVATAR_BUCKET)
            .upload(path, resized, { contentType: 'image/jpeg', upsert: true });
          if (upErr) throw upErr;

          // 3. Get public URL
          const { data: urlData } = window.supa.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(path);
          const publicUrl = urlData.publicUrl + '?t=' + Date.now();

          // 4. Cache in Upstash (30 days TTL)
          await window.upstashCmd('SET', 'avatar:user:' + userId, publicUrl, 'EX', 2592000);

          // 5. Cache in localStorage
          localStorage.setItem('ls_avatar_' + userId, publicUrl);
          setAvatarUrl(publicUrl);
          setLoading(false);
          return { ok: true };
        } catch (e) {
          setLoading(false);
          const msg = e.message || '';
          const friendly = msg.includes('Bucket') || msg.includes('bucket')
            ? 'Loi storage: tao bucket "avatars" trong Supabase nhe!'
            : msg || 'Upload that bai, thu lai nhe!';
          return { ok: false, msg: friendly };
        }
      }, [userId]);
      // Remove: clear Upstash + localStorage
      const removeAvatar = useCallback(async () => {
        if (!userId) return;
        try { await window.upstashCmd('DEL', 'avatar:user:' + userId); } catch (e) { }
        localStorage.removeItem('ls_avatar_' + userId);
        setAvatarUrl(null);
      }, [userId]);

      return { avatarUrl, loading, uploadAvatar, removeAvatar };
    }

    /* ══════════════════════════════════════════════════════════════════
       LetterAvatar
       Props: name, size=64, dark, animate=false, avatarUrl=null
    ══════════════════════════════════════════════════════════════════ */
    function LetterAvatar({ name = '?', size = 64, dark, animate = false, avatarUrl = null }) {
      const [imgOk, setImgOk] = useState(!!avatarUrl);
      useEffect(() => { setImgOk(!!avatarUrl); }, [avatarUrl]);

      const initials = (name || '?').trim().split(' ').filter(Boolean)
        .slice(0, 2).map(w => w[0].toUpperCase()).join('');
      const hue = ((name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
      const bg = 'hsl(' + hue + ',55%,' + (dark ? '38%' : '68%') + ')';

      const base = {
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        boxShadow: '0 4px 20px hsl(' + hue + ',55%,50%,0.45),inset 0 -3px 0 rgba(0,0,0,0.12)',
        animation: animate ? 'bb-heartbeat 2.5s ease-in-out infinite' : 'none',
        overflow: 'hidden', userSelect: 'none',
      };

      if (avatarUrl && imgOk) {
        return (
          <div style={{ ...base, background: bg }}>
            <img src={avatarUrl} alt={name}
              onError={() => setImgOk(false)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        );
      }
      return (
        <div style={{
          ...base, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 900, color: '#fff', letterSpacing: '-1px',
          fontFamily: "'Baloo 2',cursive",
        }}>{initials}</div>
      );
    }
    /* ══════════════════════════════════════════════════════════════════
       AvatarUploader
       Props: student, dark, avatarUrl, loading, onUpload, onRemove
    ══════════════════════════════════════════════════════════════════ */
    function AvatarUploader({ student, dark, avatarUrl, loading, onUpload, onRemove }) {
      const C = dark ? CD : CL;
      const fileRef = useRef();
      const [msg, setMsg] = useState(null);
      const [preview, setPreview] = useState(null);

      // Inject hover CSS một lần
      useEffect(() => {
        if (document.getElementById('ls-av-style')) return;
        const s = document.createElement('style');
        s.id = 'ls-av-style';
        s.textContent = '.ls-av-overlay:hover{opacity:1!important}';
        document.head.appendChild(s);
      }, []);

      const handleFile = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (!f.type.startsWith('image/')) {
          setMsg({ ok: false, text: 'Chi chap nhan file anh!' });
          return;
        }
        if (f.size > 5 * 1024 * 1024) {
          setMsg({ ok: false, text: 'Anh toi da 5MB' });
          return;
        }
        const prev = URL.createObjectURL(f);
        setPreview(prev);
        setMsg(null);
        const result = await onUpload(f);
        URL.revokeObjectURL(prev);
        setPreview(null);
        setMsg(result.ok
          ? { ok: true, text: 'Cap nhat thanh cong!' }
          : { ok: false, text: result.msg || 'That bai, thu lai nhe!' });
        setTimeout(() => setMsg(null), 3000);
        e.target.value = '';
      };

      const displayUrl = preview || avatarUrl;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>

          {/* ── Avatar circle (tap to change) ── */}          <div style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => !loading && fileRef.current && fileRef.current.click()}>

            <LetterAvatar
              name={student?.display_name || student?.username}
              size={84} dark={dark} animate
              avatarUrl={displayUrl}
            />

            {/* Dark overlay — visible on hover or while loading */}
            <div className="ls-av-overlay" style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.38)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: loading ? 1 : 0,
              transition: 'opacity .2s',
            }}>
              {loading
                ? <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff"
                  strokeWidth="2" strokeLinecap="round"
                  style={{ animation: 'bb-spin 1s linear infinite' }}>
                  <path d="M12 2a10 10 0 1 0 10 10" />
                </svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              }
            </div>

            {/* Camera badge */}
            {!loading && (
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(244,114,182,0.5)',
                border: '2px solid ' + C.card,
              }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleFile} />

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="bb-btn-tap" disabled={loading}
              onClick={() => fileRef.current && fileRef.current.click()}
              style={{
                padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#f472b6,#a855f7)',
                color: '#fff', fontWeight: 800, fontSize: 12,
                boxShadow: '0 3px 12px rgba(244,114,182,0.4)',
                fontFamily: 'Nunito,sans-serif', opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              {loading ? 'Dang tai...' : 'Doi anh'}
            </button>

            {avatarUrl && !loading && (
              <button className="bb-btn-tap" onClick={onRemove}
                style={{
                  padding: '7px 14px', borderRadius: 99,
                  border: '1.5px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'Nunito,sans-serif',
                }}>
                Xoa
              </button>
            )}
          </div>

          {/* Feedback message */}
          {msg && (
            <div style={{
              fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 99,
              background: msg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: msg.ok ? '#10b981' : '#ef4444',
              border: '1px solid ' + (msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'),
              animation: 'bb-pop .2s ease both',
            }}>{msg.text}</div>
          )}
        </div>
      );    }

    /* ══ Export globals ══ */
    window.useAvatar = useAvatar;
    window.LetterAvatar = LetterAvatar;
    window.AvatarUploader = AvatarUploader;

    console.log('[avatar] v1 loaded');
  } catch (e) {
    console.error('[avatar] INIT ERROR:', e);
  }
})();