import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

export default function ScreenshotSlider({ beforeUrl, afterUrl }) {
  const container = useRef(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const move = (event) => {
    if (!dragging || !container.current) return;
    const bounds = container.current.getBoundingClientRect();
    setPosition(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)));
  };

  return (
    <div
      ref={container}
      className="relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-[28px] bg-[var(--canvas-deep)] shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)]"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        const bounds = event.currentTarget.getBoundingClientRect();
        setPosition(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)));
      }}
      onPointerMove={move}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <img src={beforeUrl} alt="Before change" draggable="false" className="absolute inset-0 h-full w-full object-contain" />
      <img
        src={afterUrl}
        alt="After change"
        draggable="false"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      />
      <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-white backdrop-blur">Before</span>
      <span className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-white backdrop-blur">After</span>
      <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white" style={{ left: `${position}%` }}>
        <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--ink)] shadow-lg">
          <GripVertical size={16} strokeWidth={1.5} />
        </span>
      </div>
    </div>
  );
}
