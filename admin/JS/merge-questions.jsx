import React from 'react';

/* ══ merge-questions.jsx ════════════════════════════════════════════════
   Tính năng gộp câu hỏi từ các bài khác vào bài đang soạn.
   Phụ thuộc: React (import), C (color object từ learnsy-colors), showToast (toast.js)
   Export: window.MergeQuestionsModal
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { useState, useEffect, useMemo, useCallback } = React;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function getQPreview(q) {
    if (q.type === 'true_false')  return q.passage || '(Đúng/Sai)';
    if (q.type === 'multiple')    return q.question || '(Trắc nghiệm)';
    if (q.type === 'multi_select')return q.question || '(Chọn nhiều)';
    if (q.type === 'fill_blank')  return q.question || '(Điền chỗ trống)';
    return '(Câu hỏi)';
  }

  function typeLabel(t) {
    return { true_false: 'ĐS', multiple: 'TN', multi_select: 'CN', fill_blank: 'ĐT' }[t] || '?';
  }

  function typeBadgeClass(t) {
    return { true_false: 'mq-badge mq-badge-ds', multiple: 'mq-badge mq-badge-tn', multi_select: 'mq-badge mq-badge-tn', fill_blank: 'mq-badge mq-badge-dt' }[t] || 'mq-badge';
  }

  /* ── SVG icon components ─────────────────────────────────────────────── */
  const CheckIcon = () => (
    React.createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('polyline', { points: '20 6 9 17 4 12' })
    )
  );

  const ChevronIcon = ({ open }) => (
    React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 20 20', fill: 'currentColor',
      className: 'mq-chevron' + (open ? ' open' : '') },
      React.createElement('path', { d: 'M5 7l5 5 5-5H5z' })
    )
  );

  const MergeIcon = ({ size = 18, color = '#A855F7' }) => (
    React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('path', { d: 'M8 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4' }),
      React.createElement('path', { d: 'M16 7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4' }),
      React.createElement('path', { d: 'M8 12h8' }),
      React.createElement('path', { d: 'M12 7v10' }),
      React.createElement('circle', { cx: 8, cy: 12, r: 2, fill: color, stroke: 'none' }),
      React.createElement('circle', { cx: 16, cy: 12, r: 2, fill: color, stroke: 'none' })
    )
  );

  /* ── LessonRow ───────────────────────────────────────────────────────── */
  function LessonRow({ lesson, selected, onToggleQ, onSelectAll, expanded, onToggleExpand }) {
    const questions = lesson.questions || [];
    const selectedCount = questions.filter(q => selected.has(q.id)).length;
    const allSelected = questions.length > 0 && selectedCount === questions.length;

    const tfCount = questions.filter(q => q.type === 'true_false').length;
    const tnCount = questions.filter(q => q.type === 'multiple' || q.type === 'multi_select').length;
    const dtCount = questions.filter(q => q.type === 'fill_blank').length;

    return React.createElement('div', { className: 'mq-lesson-row' + (expanded ? ' expanded' : '') },

      /* ── header ── */
      React.createElement('div', { className: 'mq-lesson-header', onClick: onToggleExpand },
        React.createElement('div', { className: 'mq-lesson-icon' },
          React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: '#A855F7', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
            React.createElement('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
            React.createElement('line', { x1: 9, y1: 9, x2: 15, y2: 9 }),
            React.createElement('line', { x1: 9, y1: 13, x2: 13, y2: 13 })
          )
        ),

        React.createElement('div', { className: 'mq-lesson-info' },
          React.createElement('div', { className: 'mq-lesson-name' }, lesson.title || 'Chưa đặt tên'),
          React.createElement('div', { className: 'mq-lesson-meta' },
            React.createElement('span', null, lesson.subject || 'Tiếng Anh'),
            React.createElement('span', null, questions.length + ' câu'),
            tfCount > 0 && React.createElement('span', { className: 'mq-badge mq-badge-ds' }, tfCount + ' ĐS'),
            tnCount > 0 && React.createElement('span', { className: 'mq-badge mq-badge-tn' }, tnCount + ' TN'),
            dtCount > 0 && React.createElement('span', { className: 'mq-badge mq-badge-dt' }, dtCount + ' ĐT')
          )
        ),

        selectedCount > 0 && React.createElement('span', {
          style: { fontSize: 11, fontWeight: 900, color: '#fff', background: '#A855F7',
                   padding: '2px 9px', borderRadius: 999, flexShrink: 0 }
        }, '+' + selectedCount),

        React.createElement('button', {
          className: 'mq-select-all-btn' + (allSelected ? ' all-selected' : ''),
          onClick: (e) => { e.stopPropagation(); onSelectAll(lesson, !allSelected); }
        }, allSelected ? '✓ Bỏ tất' : 'Chọn tất'),

        React.createElement(ChevronIcon, { open: expanded })
      ),

      /* ── question list (expanded) ── */
      expanded && questions.length > 0 && React.createElement('div', { className: 'mq-q-list' },
        questions.map((q, qi) => {
          const isSel = selected.has(q.id);
          return React.createElement('div', {
            key: q.id || qi,
            className: 'mq-q-row' + (isSel ? ' selected' : ''),
            onClick: () => onToggleQ(q)
          },
            React.createElement('div', { className: 'mq-q-check' },
              isSel && React.createElement(CheckIcon)
            ),
            React.createElement('span', { className: typeBadgeClass(q.type) }, typeLabel(q.type)),
            React.createElement('span', { className: 'mq-q-text' }, getQPreview(q))
          );
        })
      ),

      expanded && questions.length === 0 && React.createElement('div', { className: 'mq-empty' },
        'Bộ này chưa có câu hỏi nào.'
      )
    );
  }

  /* ══ MergeQuestionsModal ══════════════════════════════════════════════ */
  function MergeQuestionsModal({ lessons, currentLessonId, onClose, onMerge, dark }) {
    const [search, setSearch]       = useState('');
    const [selected, setSelected]   = useState(new Set());     // Set<questionId>
    const [expanded, setExpanded]   = useState(new Set());     // Set<lessonId>
    const [qMap, setQMap]           = useState({});

    /* Build qMap once khi lessons thay đổi */
    useEffect(() => {
      const map = {};
      lessons.forEach(l => (l.questions || []).forEach(q => { map[q.id] = q; }));
      setQMap(map);
    }, [lessons]);

    /* Filter lessons: loại bài hiện tại, loại bài rỗng, áp dụng search */
    const filteredLessons = useMemo(() => {
      const q = search.trim().toLowerCase();
      return lessons.filter(l => {
        if (l.id === currentLessonId) return false;
        if (!l.questions || l.questions.length === 0) return false;
        if (!q) return true;
        return (l.title || '').toLowerCase().includes(q) ||
               (l.subject || '').toLowerCase().includes(q) ||
               (l.questions || []).some(qq => getQPreview(qq).toLowerCase().includes(q));
      });
    }, [lessons, currentLessonId, search]);

    const toggleQ = useCallback((q) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(q.id) ? next.delete(q.id) : next.add(q.id);
        return next;
      });
    }, []);

    const selectAll = useCallback((lesson, shouldSelect) => {
      setSelected(prev => {
        const next = new Set(prev);
        (lesson.questions || []).forEach(q => {
          shouldSelect ? next.add(q.id) : next.delete(q.id);
        });
        return next;
      });
    }, []);

    const toggleExpand = useCallback((lessonId) => {
      setExpanded(prev => {
        const next = new Set(prev);
        next.has(lessonId) ? next.delete(lessonId) : next.add(lessonId);
        return next;
      });
    }, []);

    const handleMerge = useCallback(() => {
      if (selected.size === 0) return;
      // Gom câu hỏi theo đúng thứ tự lessons → questions
      const toAdd = [];
      lessons.forEach(l => {
        (l.questions || []).forEach(q => {
          if (selected.has(q.id)) {
            // Clone với id mới để tránh trùng lặp
            toAdd.push({ ...q, id: 'mq' + Date.now() + Math.random() });
          }
        });
      });
      onMerge(toAdd);
      onClose();
    }, [selected, lessons, onMerge, onClose]);

    /* ── render ── */
    return React.createElement('div', {
      className: 'mq-overlay',
      onClick: onClose
    },
      React.createElement('div', {
        className: 'mq-sheet',
        onClick: (e) => e.stopPropagation()
      },

        /* header */
        React.createElement('div', { className: 'mq-header' },
          React.createElement('div', { className: 'mq-header-icon' },
            React.createElement(MergeIcon, { size: 20, color: '#A855F7' })
          ),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { className: 'mq-title', style: { color: dark ? '#F0DCE8' : '#3D1830' } },
              'Gộp câu hỏi từ bài khác'
            ),
            React.createElement('div', { style: { fontSize: 11, color: dark ? '#8A6080' : '#A07090', marginTop: 2, fontWeight: 600 } },
              'Chọn câu hỏi từ các bộ đề khác để thêm vào bài đang soạn'
            )
          ),
          React.createElement('button', {
            className: 'mq-close-btn',
            onClick: onClose,
            style: { color: dark ? '#8A6080' : '#A07090' },
            'aria-label': 'Đóng'
          },
            React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' },
              React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
              React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
            )
          )
        ),

        /* search */
        React.createElement('div', { className: 'mq-search-wrap' },
          React.createElement('div', { className: 'mq-search-inner' },
            React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: '#C8A0B8', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
              React.createElement('circle', { cx: 11, cy: 11, r: 8 }),
              React.createElement('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
            ),
            React.createElement('input', {
              className: 'mq-search-input',
              placeholder: 'Tìm bài hoặc câu hỏi...',
              value: search,
              onChange: (e) => setSearch(e.target.value),
              style: { color: dark ? '#F0DCE8' : '#3D1830' }
            }),
            search && React.createElement('button', {
              onClick: () => setSearch(''),
              style: { background: 'none', border: 'none', cursor: 'pointer', color: '#C8A0B8', padding: 0, display: 'flex', alignItems: 'center' },
              'aria-label': 'Xoá tìm kiếm'
            },
              React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' },
                React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
                React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
              )
            )
          )
        ),

        /* lesson list */
        React.createElement('div', { className: 'mq-lesson-list' },
          filteredLessons.length === 0
            ? React.createElement('div', { className: 'mq-empty', style: { color: dark ? '#503040' : '#C8A0B8' } },
                search ? 'Không tìm thấy bài nào phù hợp.' : 'Không có bài nào khác để gộp.'
              )
            : filteredLessons.map(l =>
                React.createElement(LessonRow, {
                  key: l.id,
                  lesson: l,
                  selected,
                  expanded: expanded.has(l.id),
                  onToggleExpand: () => toggleExpand(l.id),
                  onToggleQ: toggleQ,
                  onSelectAll: selectAll
                })
              ),
          React.createElement('div', { style: { height: 8, flexShrink: 0 } })
        ),

        /* footer */
        React.createElement('div', { className: 'mq-footer' },
          React.createElement('div', { className: 'mq-counter', style: { color: dark ? '#C898B8' : '#6B3050' } },
            selected.size === 0
              ? React.createElement('span', { style: { fontSize: 13, color: dark ? '#503040' : '#C8A0B8', fontWeight: 700 } }, 'Chưa chọn câu nào')
              : React.createElement('span', null,
                  React.createElement('span', null, selected.size),
                  ' câu được chọn'
                )
          ),
          React.createElement('button', { className: 'mq-cancel-btn', onClick: onClose,
            style: { color: dark ? '#C898B8' : '#6B3050', borderColor: dark ? '#421526' : '#F5D5E8' }
          }, 'Huỷ'),
          React.createElement('button', {
            className: 'mq-merge-btn',
            disabled: selected.size === 0,
            onClick: handleMerge
          },
            React.createElement(MergeIcon, { size: 14, color: '#fff' }),
            'Gộp ' + (selected.size > 0 ? selected.size + ' câu' : '')
          )
        )
      )
    );
  }

  /* ── export ── */
  window.MergeQuestionsModal = MergeQuestionsModal;

})();