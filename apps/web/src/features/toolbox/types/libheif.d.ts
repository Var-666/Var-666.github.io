declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  type Frame = {
    get_width(): number
    get_height(): number
    is_primary(): boolean
    display(
      data: { data: Uint8ClampedArray; width: number; height: number },
      callback: (data: unknown) => void,
    ): void
    free(): void
  }
  export default function createModule(): {
    HeifDecoder: new () => { decode(data: Uint8Array): Frame[] }
  }
}
