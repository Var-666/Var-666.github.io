export function previewLayout(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
  zoom: number | null,
  pixelRatio: number,
) {
  if (
    ![width, height, availableWidth, availableHeight, pixelRatio].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    (zoom !== null && (!Number.isFinite(zoom) || zoom <= 0))
  )
    throw new Error('页面尺寸无效')
  const fit = Math.min(
    Math.max(1, availableWidth - 32) / width,
    Math.max(1, availableHeight - 32) / height,
    4,
  )
  const maxScale = Math.min(4, 16384 / width, 16384 / height)
  const scale = Math.min(zoom ?? fit, maxScale)
  const cssWidth = Math.max(1, Math.floor(width * scale))
  const cssHeight = Math.max(1, Math.floor(height * scale))
  const density = Math.min(
    pixelRatio,
    2,
    Math.sqrt(12_000_000 / (cssWidth * cssHeight)),
    8192 / cssWidth,
    8192 / cssHeight,
  )
  const rasterWidth = Math.max(1, Math.floor(cssWidth * density))
  const rasterHeight = Math.max(1, Math.floor(cssHeight * density))
  return {
    scale,
    maxScale,
    cssWidth,
    cssHeight,
    renderScale: Math.min(rasterWidth / width, rasterHeight / height),
    width: rasterWidth,
    height: rasterHeight,
  }
}
