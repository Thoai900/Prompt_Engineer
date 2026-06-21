import { useState } from 'react';

export const useCanvasInteraction = (initialOffset = { x: 50, y: 50 }, initialZoom = 1) => {
  const [canvasOffset, setCanvasOffset] = useState(initialOffset);
  const [zoom, setZoom] = useState(initialZoom);

  const startPanning = (e: React.MouseEvent) => {
    // Canvas-bg panning only
    if (
      e.target !== e.currentTarget &&
      !(e.target as HTMLElement).classList.contains('canvas-bg')
    ) {
      return;
    }
    e.preventDefault();
    const startX = e.clientX - canvasOffset.x;
    const startY = e.clientY - canvasOffset.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setCanvasOffset({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const newZoom = e.deltaY < 0 ? zoom + zoomFactor : zoom - zoomFactor;
    setZoom(Math.max(0.5, Math.min(1.5, newZoom)));
  };

  const resetCanvasView = () => {
    setCanvasOffset({ x: 50, y: 50 });
    setZoom(1);
  };

  return {
    canvasOffset,
    setCanvasOffset,
    zoom,
    setZoom,
    startPanning,
    handleWheel,
    resetCanvasView,
  };
};
