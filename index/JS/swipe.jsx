import React from 'react';

/* ══ SWIPE.JSX ══════════════════════════════════════════════════════════
   useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown })
   Trả về props cần spread vào element: {...swipe}
   ════════════════════════════════════════════════════════════════════ */

function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold=50 }={}) {
  const startRef = { x: 0, y: 0 };
  let tracking = false;

  return {
    onTouchStart: function(e) {
      if(e.target.closest('[data-dots]')) return;
      const t = e.touches[0];
      startRef.x = t.clientX;
      startRef.y = t.clientY;
      tracking = true;
    },
    onTouchEnd: function(e) {
      if(!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startRef.x;
      const dy = t.clientY - startRef.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if(adx < threshold && ady < threshold) return;
      if(adx > ady){
        if(dx < -threshold && onSwipeLeft)  onSwipeLeft();
        if(dx >  threshold && onSwipeRight) onSwipeRight();
      } else {
        if(dy < -threshold && onSwipeUp)   onSwipeUp();
        if(dy >  threshold && onSwipeDown) onSwipeDown();
      }
    },
    onTouchMove: function(e) {
      // allow natural scroll
    },
  };
}

window.useSwipe = useSwipe;
console.log('[swipe] ✓ loaded');