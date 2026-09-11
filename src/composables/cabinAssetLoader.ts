import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// 缓存已加载的原始三维模型 Group
const modelCache = new Map<string, THREE.Group>()
const loadPromises = new Map<string, Promise<THREE.Group>>()

let gltfLoader: GLTFLoader | null = null

function getLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
  }
  return gltfLoader
}

/**
 * 获取基于当前部署路径的资源完整 URL
 */
export function getAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  const cleanRelative = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
  return `${cleanBase}${cleanRelative}`
}

/**
 * 深度克隆三维物体，确保材质与阴影设置完整独立
 */
export function cloneModel(source: THREE.Group): THREE.Group {
  const cloned = source.clone(true) as THREE.Group

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true

      // 如果材质存在且不是数组，克隆材质以防属性污染
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone())
        } else {
          mesh.material = mesh.material.clone()
        }
      }
    }
  })

  return cloned
}

/**
 * 异步加载指定路径的 GLTF/GLB 模型（自动去重与缓存）
 */
export async function loadModel(path: string): Promise<THREE.Group> {
  const fullUrl = getAssetUrl(path)

  if (modelCache.has(fullUrl)) {
    return cloneModel(modelCache.get(fullUrl)!)
  }

  if (loadPromises.has(fullUrl)) {
    const baseGroup = await loadPromises.get(fullUrl)!
    return cloneModel(baseGroup)
  }

  const promise = (async () => {
    const loader = getLoader()
    const gltf = await loader.loadAsync(fullUrl)
    const root = gltf.scene

    // 默认优化光照计算与阴影投射
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true

        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial
          if (mat.isMeshStandardMaterial) {
            mat.roughness = Math.max(mat.roughness, 0.4)
            mat.metalness = Math.min(mat.metalness, 0.2)
          }
        }
      }
    })

    modelCache.set(fullUrl, root)
    return root
  })()

  loadPromises.set(fullUrl, promise)

  try {
    const root = await promise
    return cloneModel(root)
  } finally {
    loadPromises.delete(fullUrl)
  }
}

export interface ModelInstanceOptions {
  scale?: number | [number, number, number]
  position?: [number, number, number]
  rotation?: [number, number, number]
  tintColor?: number | string
}

/**
 * 快捷创建模型实例并设置位置、旋转、缩放
 */
export async function createModelInstance(
  path: string,
  options: ModelInstanceOptions = {}
): Promise<THREE.Group | null> {
  try {
    const model = await loadModel(path)

    if (options.scale !== undefined) {
      if (typeof options.scale === 'number') {
        model.scale.setScalar(options.scale)
      } else {
        model.scale.set(options.scale[0], options.scale[1], options.scale[2])
      }
    }

    if (options.position) {
      model.position.set(options.position[0], options.position[1], options.position[2])
    }

    if (options.rotation) {
      model.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2])
    }

    if (options.tintColor !== undefined) {
      const tint = new THREE.Color(options.tintColor)
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((m) => {
              if ('color' in m) {
                ;(m as THREE.MeshStandardMaterial).color.multiply(tint)
              }
            })
          }
        }
      })
    }

    return model
  } catch (err) {
    console.warn(`[CabinAssetLoader] 模型加载跳过或降级: ${path}`, err)
    return null
  }
}

/**
 * 核心资产清单（预备全量秒开）
 */
export const CABIN_ASSET_MANIFEST = {
  nature: [
    'models/nature/tree_pineTallA.glb',
    'models/nature/tree_pineTallB.glb',
    'models/nature/tree_pineRoundA.glb',
    'models/nature/tree_pineRoundB.glb',
    'models/nature/tree_cone.glb',
    'models/nature/stone_smallA.glb',
    'models/nature/rock_smallA.glb',
    'models/nature/rock_smallB.glb',
    'models/nature/rock_largeA.glb',
    'models/nature/flower_yellowA.glb',
    'models/nature/flower_purpleA.glb',
    'models/nature/flower_redA.glb',
    'models/nature/plant_bush.glb',
    'models/nature/fence_simple.glb',
    'models/nature/log_stack.glb',
    'models/nature/stump_round.glb',
    'models/nature/sign.glb',
  ],
  furniture: [
    'models/furniture/bed_single_B.gltf',
    'models/furniture/shelf_B_large_decorated.gltf',
    'models/furniture/table_medium_long.gltf',
    'models/furniture/table_medium.gltf',
    'models/furniture/table_small.gltf',
    'models/furniture/chair_stool_wood.gltf',
    'models/furniture/cabinet_medium_decorated.gltf',
    'models/furniture/book_set.gltf',
  ],
  creature: [
    'models/cat.glb',
  ],
}

/**
 * 启动阶段静默预热常用资源
 */
export function preloadCoreCabinAssets(): void {
  const toPreload = [
    ...CABIN_ASSET_MANIFEST.nature.slice(0, 8),
    ...CABIN_ASSET_MANIFEST.furniture.slice(0, 4),
    ...CABIN_ASSET_MANIFEST.creature,
  ]

  toPreload.forEach((p) => {
    loadModel(p).catch(() => {
      // 容错忽略
    })
  })
}
