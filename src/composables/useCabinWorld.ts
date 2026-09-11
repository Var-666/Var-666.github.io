import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { useCabinStore, type DrawerType } from './useCabinStore'
import {
  createScreenWallpaperTexture,
  createAdventureMapTexture,
  createBurgundyRugTexture,
  createGreenRugTexture,
  createBulletinBoardTexture,
  createTapestryTexture,
  createSignpostTexture,
  createRetainingWallTexture,
  createWoodFloorTexture,
} from './cabinTextures'
import { createCabinCharacter, type CabinCharacterController } from './cabinCharacter'
import { createModelInstance, preloadCoreCabinAssets } from './cabinAssetLoader'

export interface InteractiveItem {
  id: string
  drawerType: DrawerType | 'crystal'
  label: string
  subLabel: string
  icon: string
  pos: THREE.Vector3
  promptPos: THREE.Vector3
  distance: number
  screenX: number
  screenY: number
  isNearby: boolean
}

/**
 * 1:1 像素级复刻设计图《My Little Web》的小木屋三维微缩交互世界
 * 结合真实 GLTF/GLB 模型资产与纯正低多边形治愈质感
 */
export function useCabinWorld(containerRef: Ref<HTMLElement | null>) {
  const store = useCabinStore()

  // 状态与对外接口
  const isLoaded = ref(false)
  const interactiveItems = ref<InteractiveItem[]>([])
  const nearbyItem = ref<InteractiveItem | null>(null)

  // 虚拟摇杆移动向量（由 HUD 触控摇杆调用更新）
  let joystickVector = { x: 0, y: 0 }
  function setJoystickMove(x: number, y: number) {
    joystickVector = { x, y }
  }

  // 核心三维场景引用
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let characterCtrl: CabinCharacterController | null = null

  // 角色位置与移动状态
  const playerPos = new THREE.Vector3(0, 0.45, 1.6) // 初始站在中央大地图桌旁
  const playerVelocity = new THREE.Vector3()
  let playerRotation = 0
  let isMoving = false
  const keys = { w: false, a: false, s: false, d: false }

  // 摄像机镜头控制与平滑阻尼跟踪
  const cameraOffset = new THREE.Vector3(14, 15, 14) // 经典 45° 俯仰等轴测长焦角
  const cameraTarget = new THREE.Vector3(0, 1.2, 0)
  let cameraExtraAngleX = 0
  let cameraExtraAngleY = 0
  let isDragging = false
  let previousMousePosition = { x: 0, y: 0 }

  // 动画与微动引用
  let sleepingCatMesh: THREE.Object3D | null = null
  let sleepingCatBaseScaleY = 0.026
  let dustParticles: THREE.Points | null = null
  const flickeringLights: THREE.PointLight[] = []

  // 空间临时矢量（GC 零开销）
  const _tempMoveDir = new THREE.Vector3()
  const _tempCamTarget = new THREE.Vector3()
  const _tempOffset = new THREE.Vector3()
  const _upVec = new THREE.Vector3(0, 1, 0)
  const _projectedVec = new THREE.Vector3()

  // 场景可交互点位定义（完全对应设计图上的各个 UI 浮标）
  const interactablesData = [
    {
      id: 'computer',
      drawerType: 'projects' as DrawerType,
      label: 'Projects',
      subLabel: '精选个人开发项目',
      icon: '💻',
      pos: new THREE.Vector3(-2.8, 1.1, -3.2),
      promptPos: new THREE.Vector3(-2.8, 2.3, -3.2),
    },
    {
      id: 'bookshelf',
      drawerType: 'articles' as DrawerType,
      label: 'Articles / Notes',
      subLabel: '技术随笔与思考',
      icon: '📖',
      pos: new THREE.Vector3(0.5, 1.4, -3.5),
      promptPos: new THREE.Vector3(0.5, 2.85, -3.5),
    },
    {
      id: 'bulletin',
      drawerType: 'updates' as DrawerType,
      label: 'Latest Updates',
      subLabel: '近期动态与便利贴',
      icon: '📋',
      pos: new THREE.Vector3(2.6, 1.4, -3.5),
      promptPos: new THREE.Vector3(2.6, 2.65, -3.5),
    },
    {
      id: 'cabinet',
      drawerType: 'cabinet' as DrawerType,
      label: 'Discovered Content',
      subLabel: '探索收集陈列柜',
      icon: '💎',
      pos: new THREE.Vector3(4.0, 1.2, -2.4),
      promptPos: new THREE.Vector3(4.0, 2.6, -2.4),
    },
    {
      id: 'map',
      drawerType: 'map' as DrawerType,
      label: 'Explore',
      subLabel: '全站大地图与导览',
      icon: '🗺️',
      pos: new THREE.Vector3(0.1, 0.85, 0.2),
      promptPos: new THREE.Vector3(0.1, 1.9, 0.2),
    },
    {
      id: 'crystal',
      drawerType: 'crystal' as const,
      label: 'Hidden Cache',
      subLabel: '神秘数字遗物 #004',
      icon: '✨',
      pos: new THREE.Vector3(-3.2, 0.3, 4.5),
      promptPos: new THREE.Vector3(-3.2, 1.2, 4.5),
    },
  ]

  // 家具 AABB 碰撞盒列表 [minX, minZ, maxX, maxZ]
  const obstacles = [
    // 电脑桌区域
    { minX: -4.4, minZ: -4.2, maxX: -1.2, maxZ: -2.0 },
    // 书架区域
    { minX: -0.6, minZ: -4.2, maxX: 1.6, maxZ: -2.8 },
    // 告示板与长椅
    { minX: 1.8, minZ: -4.2, maxX: 3.3, maxZ: -3.0 },
    // 玻璃展柜
    { minX: 3.4, minZ: -4.2, maxX: 4.8, maxZ: -1.6 },
    // 中央地图大木桌与凳子
    { minX: -1.4, minZ: -0.8, maxX: 1.4, maxZ: 1.2 },
    // 左侧床榻
    { minX: -4.6, minZ: -1.8, maxX: -2.0, maxZ: 0.8 },
    // 房间右侧与后侧外墙边界
    { minX: 4.5, minZ: -4.5, maxX: 6.0, maxZ: 4.5 },
    { minX: -4.8, minZ: -4.8, maxX: 4.8, maxZ: -3.8 },
    // 室内围栏阻挡（门洞除外：门洞在 X: -3.8 ~ -2.0）
    { minX: -1.8, minZ: 2.5, maxX: 4.5, maxZ: 2.9 },
    { minX: -4.8, minZ: 2.5, maxX: -4.0, maxZ: 2.9 },
  ]

  // 初始化场景
  function init() {
    if (!containerRef.value) return

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    // 1. 场景与森林晨雾
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x19211e) // 浓郁森林夜色底
    scene.fog = new THREE.FogExp2(0x19211e, 0.02)

    // 2. 长焦斜俯视相机（正交等轴测质感）
    camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 100)
    camera.position.copy(cameraTarget).add(cameraOffset)
    camera.lookAt(cameraTarget)

    // 3. 渲染器配置
    const isMobile = typeof window !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768)
    const maxDpr = isMobile ? 1.25 : 1.75

    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    containerRef.value.appendChild(renderer.domElement)

    // 4. 灯光系统（1:1 营造设计图中的暖黄煤油灯火与室外冷月光对比）
    setupLights(isMobile)

    // 5. 建造木屋基础架构
    buildCabinDiorama()

    // 6. 异步载入高质量 3D 资产库（松树、石径、实木家具、睡猫等）
    loadCabinAssets()

    // 7. 创建 1:1 红便帽探险主角
    buildPlayer()

    // 8. 初始化交互状态
    updateInteractiveItemsState(true)

    // 9. 事件监听
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    containerRef.value.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    containerRef.value.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    isLoaded.value = true

    // 10. 预热核心资源与启动帧循环
    preloadCoreCabinAssets()
    setupVisibilityListeners()
  }

  // 灯光系统配置
  function setupLights(isMobile = false) {
    if (!scene) return

    flickeringLights.length = 0

    // 1. 整体暖色环境漫射光
    const ambientLight = new THREE.AmbientLight(0xffedd8, 0.62)
    scene.add(ambientLight)

    // 2. 模拟室外透过树丛透射进来的清冷天光 (冷蓝调)
    const dirLight = new THREE.DirectionalLight(0xdcecf8, 0.85)
    dirLight.position.set(12, 18, 8)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = isMobile ? 512 : 1024
    dirLight.shadow.mapSize.height = isMobile ? 512 : 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 40
    const d = 10
    dirLight.shadow.camera.left = -d
    dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d
    dirLight.shadow.camera.bottom = -d
    dirLight.shadow.bias = -0.001
    scene.add(dirLight)

    // 3. 窗边透射光（从左侧窗户透入室内的冷调天光）
    const windowLight = new THREE.DirectionalLight(0x89c4f4, 0.55)
    windowLight.position.set(-8, 6, -1.8)
    windowLight.target.position.set(-2, 1, -1.8)
    scene.add(windowLight)
    scene.add(windowLight.target)

    // 4. 点光源 1：工作电脑桌暖光壁灯
    const deskLamp = new THREE.PointLight(0xffaa38, 2.4, 6)
    deskLamp.position.set(-2.6, 1.85, -3.1)
    deskLamp.castShadow = true
    scene.add(deskLamp)
    flickeringLights.push(deskLamp)

    // 5. 点光源 2：电脑屏幕柔和蓝白色冷微光
    const screenGlow = new THREE.PointLight(0x70a1ff, 1.1, 3.2)
    screenGlow.position.set(-2.8, 1.35, -2.7)
    scene.add(screenGlow)

    // 6. 点光源 3：床头小柜煤油提灯
    const bedLantern = new THREE.PointLight(0xff9f43, 1.9, 5.5)
    bedLantern.position.set(-4.1, 1.15, 0.3)
    scene.add(bedLantern)
    flickeringLights.push(bedLantern)

    // 7. 点光源 4：中央大地图桌吊灯/煤油灯（2400K 暖金光晕）
    const tableLantern = new THREE.PointLight(0xffb84d, 2.9, 8.5)
    tableLantern.position.set(0.1, 2.45, 0.2)
    tableLantern.castShadow = true
    scene.add(tableLantern)
    flickeringLights.push(tableLantern)

    // 8. 点光源 5：告示板射灯
    const boardLight = new THREE.PointLight(0xffaa44, 1.8, 6)
    boardLight.position.set(2.6, 2.5, -3.2)
    scene.add(boardLight)

    // 9. 点光源 6：陈列展柜内部高亮青蓝水晶射灯
    const cabinetLight = new THREE.PointLight(0x00d2d3, 1.8, 4.5)
    cabinetLight.position.set(3.9, 1.8, -2.4)
    scene.add(cabinetLight)

    // 10. 点光源 7：室外石阶旁探险地灯
    const stairLantern = new THREE.PointLight(0xffa502, 2.2, 5)
    stairLantern.position.set(-3.6, 0.6, 3.6)
    scene.add(stairLantern)
    flickeringLights.push(stairLantern)
  }

  // 建造 1:1 木屋主框架与建筑结构
  function buildCabinDiorama() {
    if (!scene) return

    // 材质库
    const woodFloorTex = createWoodFloorTexture()
    const woodFloorMat = new THREE.MeshStandardMaterial({
      map: woodFloorTex,
      roughness: 0.65,
      metalness: 0.05,
    })

    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x422c1d, // 深色实木横梁立柱
      roughness: 0.75,
    })

    const woodOakMat = new THREE.MeshStandardMaterial({
      color: 0x6e4729, // 暖胡桃实木
      roughness: 0.7,
    })

    const wallCreamMat = new THREE.MeshStandardMaterial({
      color: 0xede5d8, // 温馨米白抹灰墙
      roughness: 0.9,
    })

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2e492c, // 浓郁森林深绿草坪
      roughness: 0.85,
    })

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdff9fb,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.1,
    })

    // ── 1. 室外草地地形 ──
    const groundGeo = new THREE.BoxGeometry(26, 0.4, 26)
    const ground = new THREE.Mesh(groundGeo, grassMat)
    ground.position.y = -0.2
    ground.receiveShadow = true
    scene.add(ground)

    // ── 2. 木屋实木基底与地板 ──
    const roomWidth = 9.2
    const roomDepth = 7.4
    const floorGeo = new THREE.BoxGeometry(roomWidth, 0.3, roomDepth)
    const floor = new THREE.Mesh(floorGeo, woodFloorMat)
    floor.position.set(0, 0.15, -0.6)
    floor.receiveShadow = true
    scene.add(floor)

    // ── 3. 墙体与立柱结构 ──
    // 后墙 (Z深处)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 3.6, 0.25), wallCreamMat)
    backWall.position.set(0, 1.8 + 0.3, -0.6 - roomDepth / 2)
    backWall.receiveShadow = true
    scene.add(backWall)

    // 左实木外墙 (X负侧)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, roomDepth), wallCreamMat)
    leftWall.position.set(-roomWidth / 2, 1.8 + 0.3, -0.6)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    // 实木顶部主横梁
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(roomWidth + 0.4, 0.35, 0.35), woodDarkMat)
    topBeam.position.set(0, 3.75, -0.6 - roomDepth / 2 + 0.1)
    scene.add(topBeam)

    const leftTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, roomDepth + 0.4), woodDarkMat)
    leftTopBeam.position.set(-roomWidth / 2 + 0.1, 3.75, -0.6)
    scene.add(leftTopBeam)

    // 墙角粗壮实木立柱
    const cornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 0.4), woodDarkMat)
    cornerPost.position.set(-roomWidth / 2 + 0.15, 1.8 + 0.3, -0.6 - roomDepth / 2 + 0.15)
    scene.add(cornerPost)

    // ── 4. 左侧实木大窗户与挂毯 ──
    const windowGroup = new THREE.Group()
    windowGroup.position.set(-roomWidth / 2 + 0.05, 2.3, -1.8)
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 2.2), woodDarkMat)
    const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 2.0), glassMat)
    windowGroup.add(windowFrame, windowGlass)
    scene.add(windowGroup)

    // 挂毯："Good Ideas Live Here 🌲"
    const tapestryTex = createTapestryTexture()
    const tapestryMat = new THREE.MeshStandardMaterial({
      map: tapestryTex,
      roughness: 0.9,
    })
    const tapestryMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), tapestryMat)
    tapestryMesh.rotation.y = Math.PI / 2
    tapestryMesh.position.set(-roomWidth / 2 + 0.15, 2.4, -3.2)
    scene.add(tapestryMesh)

    const tapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 12), woodDarkMat)
    tapPole.rotation.x = Math.PI / 2
    tapPole.position.set(-roomWidth / 2 + 0.17, 3.32, -3.2)
    scene.add(tapPole)

    // ── 5. 前方矮围栏与题字刻板 ──
    const retainingWallTex = createRetainingWallTexture()
    const retainingMat = new THREE.MeshStandardMaterial({
      map: retainingWallTex,
      roughness: 0.8,
    })
    const frontFence = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.4, 0.25), retainingMat)
    frontFence.position.set(1.2, 0.7 + 0.3, 3.0)
    frontFence.castShadow = true
    scene.add(frontFence)

    // ── 6. 左下角出门木台阶与探险路标 ──
    for (let stepIdx = 0; stepIdx < 3; stepIdx++) {
      const sWidth = 2.4
      const sDepth = 0.65
      const sHeight = 0.12
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(sWidth, sHeight, sDepth), woodOakMat)
      stepMesh.position.set(-2.8, 0.3 - stepIdx * 0.09, 3.2 + stepIdx * 0.5)
      stepMesh.receiveShadow = true
      scene.add(stepMesh)
    }

    // 踏阶旁立牌："To New Adventures ➔"
    const signpostTex = createSignpostTexture()
    const signpostMat = new THREE.MeshStandardMaterial({
      map: signpostTex,
      roughness: 0.8,
    })
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.06), signpostMat)
    signBoard.position.set(-3.8, 1.05, 3.4)
    signBoard.rotation.y = 0.2
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), woodDarkMat)
    signPole.position.set(-3.8, 0.6, 3.4)
    scene.add(signBoard, signPole)

    // 台阶上的煤油灯
    createKeroseneLantern(-3.6, 0.42, 3.6, 0.9)

    // ── 7. 地毯铺设 ──
    // 卧室古典波斯红毯
    const burgundyRugTex = createBurgundyRugTexture()
    const burgundyMat = new THREE.MeshStandardMaterial({
      map: burgundyRugTex,
      roughness: 0.9,
    })
    const bedRug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), burgundyMat)
    bedRug.rotation.x = -Math.PI / 2
    bedRug.position.set(-3.3, 0.31, -0.6)
    bedRug.receiveShadow = true
    scene.add(bedRug)

    // 中央大桌墨绿几何毛毯
    const greenRugTex = createGreenRugTexture()
    const greenRugMat = new THREE.MeshStandardMaterial({
      map: greenRugTex,
      roughness: 0.9,
    })
    const tableRug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.8), greenRugMat)
    tableRug.rotation.x = -Math.PI / 2
    tableRug.position.set(0.1, 0.31, 0.2)
    tableRug.receiveShadow = true
    scene.add(tableRug)

    // ── 8. 工作台区（Projects 电脑桌、曲面屏、办公椅、热咖啡） ──
    buildWorkstationArea()

    // ── 9. 告示板区（Latest Updates，软木大板、Small Steps 标语、拍立得） ──
    const bulletinTex = createBulletinBoardTexture()
    const bulletinMat = new THREE.MeshStandardMaterial({
      map: bulletinTex,
      roughness: 0.85,
    })
    const bulletinBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), bulletinMat)
    bulletinBoard.position.set(2.6, 2.3, -3.85)
    scene.add(bulletinBoard)

    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.65), woodOakMat)
    bench.position.set(2.6, 0.52, -3.5)
    bench.castShadow = true
    scene.add(bench)

    // ── 10. 探索陈列展柜（Discovered Content，透明玻璃展柜、发光水晶群、小机器人） ──
    buildGlassCurioCabinet()

    // ── 11. 悬浮空气金光微尘 ──
    buildAmbientDust()
  }

  // 异步加载与注入真实高精度 3D 资产库
  async function loadCabinAssets() {
    if (!scene) return

    // ── A. 室外松树家族（全面替换简易方块圆锥） ──
    const treeConfigs = [
      { path: 'models/nature/tree_pineTallA.glb', pos: [-6.8, 0, -2.8], scale: 2.7 },
      { path: 'models/nature/tree_pineTallB.glb', pos: [-7.6, 0, 0.6], scale: 2.5 },
      { path: 'models/nature/tree_pineRoundA.glb', pos: [-6.0, 0, 3.2], scale: 2.2 },
      { path: 'models/nature/tree_pineTallA.glb', pos: [-5.4, 0, 6.2], scale: 2.9 },
      { path: 'models/nature/tree_pineTallB.glb', pos: [5.8, 0, 5.2], scale: 2.6 },
      { path: 'models/nature/tree_pineRoundB.glb', pos: [6.8, 0, 2.4], scale: 2.4 },
      { path: 'models/nature/tree_cone.glb', pos: [7.2, 0, -1.6], scale: 2.5 },
      { path: 'models/nature/tree_pineTallA.glb', pos: [6.2, 0, -4.5], scale: 3.1 },
      { path: 'models/nature/tree_pineTallB.glb', pos: [-2.5, 0, -6.6], scale: 3.2 },
      { path: 'models/nature/tree_pineRoundA.glb', pos: [2.2, 0, -6.5], scale: 2.8 },
    ]

    for (const cfg of treeConfigs) {
      const tree = await createModelInstance(cfg.path, {
        position: cfg.pos as [number, number, number],
        scale: cfg.scale,
        rotation: [0, Math.random() * Math.PI * 2, 0],
      })
      if (tree && scene) scene.add(tree)
    }

    // ── B. 室外石阶碎石小径与自然岩石 ──
    const stoneConfigs = [
      { pos: [-2.8, 0.05, 4.3], scale: 1.5, rot: 0.4 },
      { pos: [-2.5, 0.05, 5.1], scale: 1.4, rot: 1.2 },
      { pos: [-2.1, 0.05, 5.9], scale: 1.6, rot: 2.1 },
      { pos: [-1.5, 0.05, 6.7], scale: 1.4, rot: 0.8 },
      { pos: [-0.9, 0.05, 7.4], scale: 1.5, rot: 1.6 },
    ]
    for (const sc of stoneConfigs) {
      const stone = await createModelInstance('models/nature/stone_smallA.glb', {
        position: sc.pos as [number, number, number],
        scale: sc.scale,
        rotation: [0, sc.rot, 0],
      })
      if (stone && scene) scene.add(stone)
    }

    // 庭院自然巨石与矮石堆
    const rock1 = await createModelInstance('models/nature/rock_largeA.glb', {
      position: [-4.6, 0, 4.0],
      scale: 1.8,
      rotation: [0, 0.6, 0],
    })
    if (rock1 && scene) scene.add(rock1)

    const rock2 = await createModelInstance('models/nature/rock_smallA.glb', {
      position: [-3.6, 0, 5.8],
      scale: 1.5,
      rotation: [0, 1.8, 0],
    })
    if (rock2 && scene) scene.add(rock2)

    const rock3 = await createModelInstance('models/nature/rock_smallB.glb', {
      position: [3.4, 0, 4.6],
      scale: 1.6,
      rotation: [0, 2.4, 0],
    })
    if (rock3 && scene) scene.add(rock3)

    // ── C. 野花群落与灌木丛 🌼 ──
    const flowerPositions: [string, [number, number, number], number][] = [
      ['models/nature/flower_yellowA.glb', [-3.2, 0, 3.8], 1.4],
      ['models/nature/flower_yellowA.glb', [-2.1, 0, 4.8], 1.3],
      ['models/nature/flower_purpleA.glb', [-3.4, 0, 4.8], 1.5],
      ['models/nature/flower_redA.glb', [-1.8, 0, 6.4], 1.4],
      ['models/nature/flower_yellowA.glb', [-0.5, 0, 7.0], 1.3],
      ['models/nature/plant_bush.glb', [-4.2, 0, 2.4], 1.6],
      ['models/nature/plant_bushLarge.glb', [4.2, 0, 3.6], 1.5],
      ['models/nature/fence_simple.glb', [-5.2, 0, 3.6], 1.2],
      ['models/nature/log_stack.glb', [-4.8, 0, 2.2], 1.3],
      ['models/nature/stump_round.glb', [-4.2, 0, 4.6], 1.4],
    ]
    for (const [fPath, fPos, fScale] of flowerPositions) {
      const item = await createModelInstance(fPath, {
        position: fPos,
        scale: fScale,
        rotation: [0, Math.random() * Math.PI, 0],
      })
      if (item && scene) scene.add(item)
    }

    // ── D. 卧室实木床榻与熟睡橘白小猫 🐱 ──
    const bed = await createModelInstance('models/furniture/bed_single_B.gltf', {
      position: [-3.3, 0.3, -0.6],
      scale: [1.0, 0.95, 0.82],
      rotation: [0, Math.PI, 0],
    })
    if (bed && scene) scene.add(bed)

    // 熟睡小猫（卷缩在被窝上，赋予呼吸动效）
    const cat = await createModelInstance('models/cat.glb', {
      position: [-3.2, 0.92, -0.55],
      scale: 0.026,
      rotation: [0, -Math.PI / 4, 0],
      tintColor: 0xe67e22, // 温暖橘白相间
    })
    if (cat && scene) {
      sleepingCatMesh = cat
      sleepingCatBaseScaleY = 0.026
      scene.add(cat)
    }

    // 床头小柜与书籍
    const nightstand = await createModelInstance('models/furniture/table_small.gltf', {
      position: [-4.1, 0.3, 0.3],
      scale: 0.75,
    })
    if (nightstand && scene) scene.add(nightstand)
    createKeroseneLantern(-4.1, 0.95, 0.3, 0.85)

    // ── E. 大型实木大书架（Articles / Notes） ──
    const bookcase = await createModelInstance('models/furniture/shelf_B_large_decorated.gltf', {
      position: [0.5, 0.3, -3.8],
      scale: 1.15,
    })
    if (bookcase && scene) scene.add(bookcase)

    // 黄铜旋转地球仪 🌍 与顶部垂悬藤蔓
    buildGlobe(scene, 1.25, 2.45, -3.7)
    buildHangingIvy(scene, -0.4, 3.25, -3.7)

    // ── F. 中央探险沙盘大长桌（Explore） ──
    const mainTable = await createModelInstance('models/furniture/table_medium_long.gltf', {
      position: [0.1, 0.3, 0.2],
      scale: [0.82, 0.75, 0.72],
    })
    if (mainTable && scene) scene.add(mainTable)

    // 四周实木方凳
    const stoolCoords = [
      [-0.7, 0.95],
      [0.9, 0.95],
      [-0.7, -0.55],
      [0.9, -0.55],
    ]
    for (const [stX, stZ] of stoolCoords) {
      const stool = await createModelInstance('models/furniture/chair_stool_wood.gltf', {
        position: [0.1 + stX, 0.3, 0.2 + stZ],
        scale: 0.85,
      })
      if (stool && scene) scene.add(stool)
    }

    // 大桌上的探险沙盘地图与立体浮凸 3D 低模山峦群！
    build3DTopologicalMap()

    // ── G. 悬浮旋转的神秘数据水晶遗物 ──
    const crystalGeo = new THREE.OctahedronGeometry(0.25, 0)
    const outdoorCrystal = new THREE.Mesh(
      crystalGeo,
      new THREE.MeshStandardMaterial({
        color: 0x54a0ff,
        emissive: 0x2e86de,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      })
    )
    outdoorCrystal.name = 'floatingCrystal'
    outdoorCrystal.position.set(-3.2, 0.4, 4.5)
    scene.add(outdoorCrystal)
  }

  // 构建电脑工作台区（超宽屏、办公转椅、写字台）
  function buildWorkstationArea() {
    if (!scene) return
    const deskGroup = new THREE.Group()
    deskGroup.position.set(-2.8, 0.3, -3.2)

    const woodOakMat = new THREE.MeshStandardMaterial({ color: 0x6e4729, roughness: 0.7 })

    // 实木工作桌
    const deskTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), woodOakMat)
    deskTable.position.y = 0.4
    deskTable.castShadow = true
    deskGroup.add(deskTable)

    // 显示器金属底座与液压臂支架
    const monitorStandMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.3, metalness: 0.7 })
    const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), monitorStandMat)
    mBase.position.set(0, 0.82, -0.15)
    const mArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), monitorStandMat)
    mArm.position.set(0, 1.02, -0.15)
    deskGroup.add(mBase, mArm)

    // 超宽窄边框曲面屏黑框
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.72, 0.04), monitorStandMat)
    screenFrame.position.set(0, 1.32, -0.14)
    deskGroup.add(screenFrame)

    // 屏幕雪山极简壁纸并微弱泛光
    const wallpaperTex = createScreenWallpaperTexture()
    const screenMat = new THREE.MeshBasicMaterial({ map: wallpaperTex })
    const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.66), screenMat)
    screenFace.position.set(0, 1.32, -0.118)
    deskGroup.add(screenFace)

    // 极简机械键盘与鼠标垫
    const mousepad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.005, 0.35), new THREE.MeshStandardMaterial({ color: 0x222f3e, roughness: 0.9 }))
    mousepad.position.set(0.05, 0.805, 0.22)
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.5 }))
    kb.position.set(-0.02, 0.82, 0.22)
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.11), new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.4 }))
    mouse.position.set(0.26, 0.82, 0.22)
    deskGroup.add(mousepad, kb, mouse)

    // 红色陶瓷热咖啡马克杯
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 14), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3 }))
    mug.position.set(0.68, 0.88, 0.15)
    deskGroup.add(mug)

    // 桌面暖光小台灯
    createDeskLamp(deskGroup, -0.9, 0.8, -0.2)

    // 桌面小多肉盆栽
    createTerracottaPlant(deskGroup, 0.9, 0.8, -0.2, 0.18)

    scene.add(deskGroup)

    // 电脑桌前深蓝青色滚轮转椅 (Office Swivel Chair)
    buildSwivelChair(-2.8, 0.3, -2.2)
  }

  // 构建大桌上的 3D 立体沙盘探险地图
  function build3DTopologicalMap() {
    if (!scene) return

    // 桌面上展开的羊皮纸大地图
    const mapTex = createAdventureMapTexture()
    const mapMat = new THREE.MeshStandardMaterial({
      map: mapTex,
      roughness: 0.8,
    })
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.15), mapMat)
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.position.set(0.1, 1.06, 0.2)
    scene.add(mapMesh)

    // 1:1 像素级复刻设计图：从纸面凸起的 3D 微缩山峰与河流！
    const miniMountainGroup = new THREE.Group()
    miniMountainGroup.position.set(0.38, 1.06, 0.16)

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x576574, roughness: 0.85 })
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })

    // 主峰（带皑皑积雪雪顶）
    const peak1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 6), mountainMat)
    peak1.position.set(0, 0.18, 0)
    const snow1 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.13, 6), snowCapMat)
    snow1.position.set(0, 0.29, 0)
    miniMountainGroup.add(peak1, snow1)

    // 副峰 2
    const peak2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.26, 6), mountainMat)
    peak2.position.set(-0.18, 0.13, 0.09)
    const snow2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 6), snowCapMat)
    snow2.position.set(-0.18, 0.21, 0.09)
    miniMountainGroup.add(peak2, snow2)

    // 副峰 3
    const peak3 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 5), mountainMat)
    peak3.position.set(0.2, 0.11, -0.07)
    miniMountainGroup.add(peak3)

    scene.add(miniMountainGroup)

    // 桌上的小多肉盆与热咖啡
    createTerracottaPlant(scene, -0.52, 1.06, 0.35, 0.15)
    const tableMug = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 }))
    tableMug.position.set(-0.42, 1.13, -0.1)
    scene.add(tableMug)
  }

  // 构建透明玻璃发光陈列柜
  function buildGlassCurioCabinet() {
    if (!scene) return
    const cabinetGroup = new THREE.Group()
    cabinetGroup.position.set(3.9, 0.3, -2.4)
    cabinetGroup.rotation.y = -Math.PI / 2

    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x422c1d, roughness: 0.75 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdff9fb,
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.1,
    })

    // 顶底木架
    const cabBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.75), woodDarkMat)
    cabBase.position.y = 0.25
    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.75), woodDarkMat)
    cabTop.position.y = 2.45
    cabinetGroup.add(cabBase, cabTop)

    // 4 根边角木立柱
    for (const [px, pz] of [[-0.85, -0.32], [0.85, -0.32], [-0.85, 0.32], [0.85, 0.32]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), woodDarkMat)
      post.position.set(px, 1.45, pz)
      cabinetGroup.add(post)
    }

    // 透明外罩玻璃面板
    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.9, 0.65), glassMat)
    glassPane.position.y = 1.45
    cabinetGroup.add(glassPane)

    // 2 层透明玻璃隔板
    const glassShelf1 = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.03, 0.6), glassMat)
    glassShelf1.position.y = 1.15
    const glassShelf2 = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.03, 0.6), glassMat)
    glassShelf2.position.y = 1.8
    cabinetGroup.add(glassShelf1, glassShelf2)

    // 展柜藏品 A：悬浮发光天蓝色多面体水晶簇 💎
    const cyanCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x00d2d3,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.95,
      roughness: 0.1,
    })
    const crystalMesh1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), cyanCrystalMat)
    crystalMesh1.position.set(-0.35, 1.44, 0)
    crystalMesh1.name = 'cabinetCrystal'
    cabinetGroup.add(crystalMesh1)

    // 展柜藏品 B：萌系方形小机器人 🤖
    buildMiniRobot(cabinetGroup, 0.35, 1.35, 0)

    // 展柜藏品 C：上层琥珀金黄色水晶原石
    const amberCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xffa502,
      emissive: 0xffa502,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    })
    const crystalMesh2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), amberCrystalMat)
    crystalMesh2.position.set(0, 2.08, 0)
    cabinetGroup.add(crystalMesh2)

    scene.add(cabinetGroup)
  }

  // 经典复古煤油提灯组件
  function createKeroseneLantern(x: number, y: number, z: number, scale = 1) {
    if (!scene) return
    const lanternGroup = new THREE.Group()
    lanternGroup.position.set(x, y, z)
    lanternGroup.scale.setScalar(scale)

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.4, metalness: 0.8 })
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffeaa7, transparent: true, opacity: 0.5, roughness: 0.1 })
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9f43 })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 14), metalMat)
    base.position.y = 0.04

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 14), glassMat)
    chimney.position.y = 0.19

    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), flameMat)
    flame.position.y = 0.18

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.09, 14), metalMat)
    top.position.y = 0.34

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI), metalMat)
    handle.position.y = 0.41

    lanternGroup.add(base, chimney, flame, top, handle)
    scene.add(lanternGroup)
  }

  // 黄铜复古地球仪 🌍
  function buildGlobe(parent: THREE.Object3D, x: number, y: number, z: number) {
    const globeGroup = new THREE.Group()
    globeGroup.position.set(x, y, z)

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 16), brassMat)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 24, Math.PI * 1.3), brassMat)
    ring.rotation.z = Math.PI / 6
    ring.position.y = 0.26

    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x48dbfb, roughness: 0.6 })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), sphereMat)
    sphere.position.y = 0.26

    globeGroup.add(base, ring, sphere)
    parent.add(globeGroup)
  }

  // 垂挂藤蔓植物
  function buildHangingIvy(parent: THREE.Object3D, x: number, y: number, z: number) {
    const ivyGroup = new THREE.Group()
    ivyGroup.position.set(x, y, z)

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ed573, roughness: 0.7 })
    const potMat = new THREE.MeshStandardMaterial({ color: 0xee5253, roughness: 0.8 })

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.16, 12), potMat)
    pot.position.y = 0.08
    ivyGroup.add(pot)

    for (let i = 0; i < 7; i++) {
      const vineLen = 0.25 + Math.random() * 0.4
      const vine = new THREE.Mesh(new THREE.BoxGeometry(0.04, vineLen, 0.04), leafMat)
      vine.position.set((Math.random() - 0.5) * 0.2, -vineLen / 2 + 0.08, 0.12 + Math.random() * 0.06)
      vine.rotation.z = (Math.random() - 0.5) * 0.3
      ivyGroup.add(vine)
    }

    parent.add(ivyGroup)
  }

  // 萌系小方块机器人 🤖
  function buildMiniRobot(parent: THREE.Object3D, x: number, y: number, z: number) {
    const robotGroup = new THREE.Group()
    robotGroup.position.set(x, y, z)

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, roughness: 0.4 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.3 })
    const glowEyeMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 })

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), bodyMat)
    head.position.y = 0.26
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), darkMat)
    visor.position.set(0, 0.26, 0.091)
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), glowEyeMat)
    eye1.position.set(-0.045, 0.26, 0.102)
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), glowEyeMat)
    eye2.position.set(0.045, 0.26, 0.102)

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.15), bodyMat)
    torso.position.y = 0.1
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), darkMat)
    ant.position.set(0, 0.39, 0)
    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), glowEyeMat)
    antBall.position.set(0, 0.44, 0)

    robotGroup.add(head, visor, eye1, eye2, torso, ant, antBall)
    parent.add(robotGroup)
  }

  // 桌面盆栽小多肉
  function createTerracottaPlant(parent: THREE.Object3D, x: number, y: number, z: number, scale = 0.2) {
    const plantGroup = new THREE.Group()
    plantGroup.position.set(x, y, z)
    plantGroup.scale.setScalar(scale)

    const potMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.85 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 })

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.5, 12), potMat)
    pot.position.y = 0.25
    const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), leafMat)
    plant.position.y = 0.55

    plantGroup.add(pot, plant)
    parent.add(plantGroup)
  }

  // 桌面壁挂式鹅颈暖光台灯
  function createDeskLamp(group: THREE.Group, x: number, y: number, z: number) {
    const lampGroup = new THREE.Group()
    lampGroup.position.set(x, y, z)

    const brassMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.4, metalness: 0.8 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 14), brassMat)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), brassMat)
    pole.position.set(0, 0.24, 0)
    pole.rotation.z = -0.35

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 12), brassMat)
    head.position.set(0.16, 0.42, 0)
    head.rotation.z = Math.PI * 0.75

    lampGroup.add(base, pole, head)
    group.add(lampGroup)
  }

  // 办公工学转椅 (Office Chair)
  function buildSwivelChair(x: number, y: number, z: number) {
    if (!scene) return
    const chairGroup = new THREE.Group()
    chairGroup.position.set(x, y, z)
    chairGroup.rotation.y = Math.PI * 0.75 // 惬意微转朝向室内

    const plasticMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4, metalness: 0.5 })
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x16a085, roughness: 0.8 }) // 沉静高级青绿色坐垫

    // 五爪星型底座与滚轮
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 5), plasticMat)
    base.position.y = 0.05
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 12), plasticMat)
    stem.position.y = 0.22

    // 软包坐垫
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.65), fabricMat)
    seat.position.y = 0.42

    // 人体工学靠背
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.75, 0.1), fabricMat)
    backrest.position.set(0, 0.85, 0.3)
    backrest.rotation.x = -0.1

    // 左右扶手
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), plasticMat)
    leftArm.position.set(-0.35, 0.62, 0.05)
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), plasticMat)
    rightArm.position.set(0.35, 0.62, 0.05)

    chairGroup.add(base, stem, seat, backrest, leftArm, rightArm)
    scene.add(chairGroup)
  }

  // 空气悬浮暖金光尘粒子
  function buildAmbientDust() {
    if (!scene) return
    const count = 120
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8
      pos[i * 3 + 1] = 0.6 + Math.random() * 3.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 0.5
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const pMat = new THREE.PointsMaterial({
      color: 0xffeaa7,
      size: 0.05,
      transparent: true,
      opacity: 0.55,
    })
    dustParticles = new THREE.Points(geo, pMat)
    scene.add(dustParticles)
  }

  // 构建 1:1 红帽探险主角
  function buildPlayer() {
    if (!scene) return
    characterCtrl = createCabinCharacter()
    characterCtrl.group.position.copy(playerPos)
    characterCtrl.group.rotation.y = playerRotation
    scene.add(characterCtrl.group)
  }

  // 键盘与移动控制
  function onKeyDown(e: KeyboardEvent) {
    if (store.activeDrawer.value) {
      if (e.key === 'Escape') store.closeDrawer()
      return
    }

    const k = e.key.toLowerCase()
    if (k === 'w' || e.key === 'ArrowUp') {
      keys.w = true
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    if (k === 'a' || e.key === 'ArrowLeft') {
      keys.a = true
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    if (k === 's' || e.key === 'ArrowDown') {
      keys.s = true
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    if (k === 'd' || e.key === 'ArrowRight') {
      keys.d = true
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }

    if (k === 'e' || e.key === 'Enter') {
      e.preventDefault()
      handleInteract()
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    if (k === 'w' || e.key === 'ArrowUp') keys.w = false
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = false
    if (k === 's' || e.key === 'ArrowDown') keys.s = false
    if (k === 'd' || e.key === 'ArrowRight') keys.d = false
  }

  function handleInteract() {
    if (!nearbyItem.value) return

    const item = nearbyItem.value
    if (item.drawerType === 'crystal') {
      store.discoverItem({
        id: 'artifact-crystal',
        title: '微光数据水晶 #004',
        category: '野外遗物',
        desc: '在门外林地石径旁拾得的未受损存储介质，闪烁着温润的脉冲光。',
      })
    } else {
      store.openDrawer(item.drawerType)
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 0 || e.button === 2) {
      isDragging = true
      previousMousePosition = { x: e.clientX, y: e.clientY }
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return
    const deltaX = e.clientX - previousMousePosition.x
    const deltaY = e.clientY - previousMousePosition.y
    previousMousePosition = { x: e.clientX, y: e.clientY }

    cameraExtraAngleX += deltaX * 0.003
    cameraExtraAngleY = Math.max(-0.2, Math.min(0.2, cameraExtraAngleY + deltaY * 0.003))
  }

  function onMouseUp() {
    isDragging = false
  }

  // 角色移动与物理碰撞
  function updatePlayer(delta: number) {
    if (!characterCtrl) return

    _tempMoveDir.set(0, 0, 0)
    if (keys.w) {
      _tempMoveDir.x -= 1
      _tempMoveDir.z -= 1
    }
    if (keys.s) {
      _tempMoveDir.x += 1
      _tempMoveDir.z += 1
    }
    if (keys.a) {
      _tempMoveDir.x -= 1
      _tempMoveDir.z += 1
    }
    if (keys.d) {
      _tempMoveDir.x += 1
      _tempMoveDir.z -= 1
    }

    if (Math.abs(joystickVector.x) > 0.05 || Math.abs(joystickVector.y) > 0.05) {
      _tempMoveDir.x += (joystickVector.x - joystickVector.y)
      _tempMoveDir.z += (-joystickVector.x - joystickVector.y)
    }

    isMoving = _tempMoveDir.lengthSq() > 0.01

    const speed = 4.2
    if (isMoving) {
      _tempMoveDir.normalize()
      playerVelocity.copy(_tempMoveDir).multiplyScalar(speed)

      const targetRotation = Math.atan2(_tempMoveDir.x, _tempMoveDir.z)
      let diff = targetRotation - playerRotation
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      playerRotation += diff * 0.25
      characterCtrl.group.rotation.y = playerRotation
    } else {
      playerVelocity.set(0, 0, 0)
    }

    characterCtrl.update(delta, isMoving)

    const nextX = playerPos.x + playerVelocity.x * delta
    const nextZ = playerPos.z + playerVelocity.z * delta

    if (!checkCollision(nextX, playerPos.z)) {
      playerPos.x = nextX
    }
    if (!checkCollision(playerPos.x, nextZ)) {
      playerPos.z = nextZ
    }

    if (playerPos.z > 2.5) {
      const targetY = Math.max(0.1, 0.45 - (playerPos.z - 2.5) * 0.18)
      playerPos.y += (targetY - playerPos.y) * 0.2
    } else {
      playerPos.y += (0.45 - playerPos.y) * 0.2
    }

    characterCtrl.group.position.copy(playerPos)
  }

  function checkCollision(x: number, z: number): boolean {
    const playerRadius = 0.26

    if (x < -6.5 || x > 5.5 || z < -4.6 || z > 7.5) {
      return true
    }

    for (const obs of obstacles) {
      if (
        x + playerRadius > obs.minX &&
        x - playerRadius < obs.maxX &&
        z + playerRadius > obs.minZ &&
        z - playerRadius < obs.maxZ
      ) {
        return true
      }
    }
    return false
  }

  // 交互状态更新
  let lastUiUpdateTime = 0
  const UI_UPDATE_INTERVAL = 80
  let lastPlayerX = -999
  let lastPlayerZ = -999

  function updateInteractiveItemsState(force = false) {
    if (!camera || !containerRef.value) return

    const now = performance.now()
    const moved = Math.abs(playerPos.x - lastPlayerX) > 0.015 || Math.abs(playerPos.z - lastPlayerZ) > 0.015
    if (!force && !moved && now - lastUiUpdateTime < UI_UPDATE_INTERVAL) {
      return
    }
    lastUiUpdateTime = now
    lastPlayerX = playerPos.x
    lastPlayerZ = playerPos.z

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    let closest: InteractiveItem | null = null
    let minDistance = 999

    const updatedList: InteractiveItem[] = []

    for (let i = 0; i < interactablesData.length; i++) {
      const item = interactablesData[i]
      const dist = Math.hypot(playerPos.x - item.pos.x, playerPos.z - item.pos.z)
      const isNear = dist < 2.4

      _projectedVec.copy(item.promptPos).project(camera)
      const screenX = (_projectedVec.x * 0.5 + 0.5) * width
      const screenY = (-(_projectedVec.y * 0.5) + 0.5) * height

      const itemState: InteractiveItem = {
        ...item,
        distance: dist,
        screenX,
        screenY,
        isNearby: isNear,
      }
      updatedList.push(itemState)

      if (isNear && dist < minDistance) {
        minDistance = dist
        closest = itemState
      }
    }

    interactiveItems.value = updatedList
    nearbyItem.value = closest
  }

  // 触屏滑动旋转视角
  let isTouchDragging = false
  let previousTouchPos = { x: 0, y: 0 }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const isBottomLeft = touch.clientX < 150 && touch.clientY > window.innerHeight - 200
      const isBottomRight = touch.clientX > window.innerWidth - 120 && touch.clientY > window.innerHeight - 200
      if (isBottomLeft || isBottomRight) return

      isTouchDragging = true
      previousTouchPos = { x: touch.clientX, y: touch.clientY }
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isTouchDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - previousTouchPos.x
    const deltaY = touch.clientY - previousTouchPos.y
    previousTouchPos = { x: touch.clientX, y: touch.clientY }

    cameraExtraAngleX += deltaX * 0.003
    cameraExtraAngleY = Math.max(-0.2, Math.min(0.2, cameraExtraAngleY + deltaY * 0.003))
  }

  function onTouchEnd() {
    isTouchDragging = false
  }

  // 渲染主循环
  let animFrameId: number | null = null
  let isRendering = false
  let isIntersecting = false
  let isPageVisible = !document.hidden
  let isReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

  function startAnimation() {
    if (isRendering || !isIntersecting || !isPageVisible || isReducedMotion) {
      if (isReducedMotion && isIntersecting && isPageVisible && renderer && scene && camera) {
        renderer.render(scene, camera)
      }
      return
    }
    isRendering = true
    lastTime = performance.now()
    animFrameId = requestAnimationFrame(animate)
  }

  function stopAnimation() {
    isRendering = false
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  let lastTime = performance.now()
  function animate() {
    if (!isRendering) return
    animFrameId = requestAnimationFrame(animate)

    const now = performance.now()
    const delta = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    // 1. 更新主角小人与动作
    updatePlayer(delta)

    // 2. 呼吸起伏的小猫 🐱
    if (sleepingCatMesh) {
      sleepingCatMesh.scale.y = sleepingCatBaseScaleY * (1 + Math.sin(now * 0.003) * 0.04)
    }

    // 3. 煤油灯光微妙颤动 (Flicker)
    for (let i = 0; i < flickeringLights.length; i++) {
      const light = flickeringLights[i]
      light.intensity = 2.0 + Math.sin(now * 0.012 + i * 2.1) * 0.2
    }

    // 4. 旋转场景中的漂浮水晶
    const crystal = scene?.getObjectByName('floatingCrystal')
    if (crystal) {
      crystal.rotation.y += delta * 1.5
      crystal.position.y = 0.4 + Math.sin(now * 0.003) * 0.08
    }

    const cabCrystal = scene?.getObjectByName('cabinetCrystal')
    if (cabCrystal) {
      cabCrystal.rotation.y += delta * 1.2
    }

    // 5. 空气微光尘埃缓缓升降
    if (dustParticles) {
      dustParticles.rotation.y += delta * 0.02
    }

    // 6. 相机平滑阻尼跟随主角
    _tempCamTarget.set(playerPos.x, 1.2, playerPos.z)
    cameraTarget.lerp(_tempCamTarget, 0.08)

    _tempOffset.copy(cameraOffset)
    _tempOffset.applyAxisAngle(_upVec, cameraExtraAngleX)

    if (camera) {
      camera.position.copy(cameraTarget).add(_tempOffset)
      camera.position.y += cameraExtraAngleY * 10
      camera.lookAt(cameraTarget)
    }

    // 7. 更新 3D 浮标在屏幕空间的映射
    updateInteractiveItemsState()

    // 8. 渲染
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }

    if (isReducedMotion) {
      stopAnimation()
    }
  }

  function onResize() {
    if (!containerRef.value || !renderer || !camera) return
    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  let intersectionObserver: IntersectionObserver | null = null
  let handleVisibilityChange: (() => void) | null = null
  let handleMotionChange: ((e: MediaQueryListEvent) => void) | null = null

  function setupVisibilityListeners() {
    if (containerRef.value) {
      intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0]
        isIntersecting = entry ? entry.isIntersecting : false
        if (isIntersecting) {
          startAnimation()
        } else {
          stopAnimation()
        }
      }, {
        rootMargin: '150px 0px',
        threshold: 0.02,
      })
      intersectionObserver.observe(containerRef.value)
    }

    handleVisibilityChange = () => {
      isPageVisible = !document.hidden
      if (isPageVisible && isIntersecting) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    handleMotionChange = (e: MediaQueryListEvent) => {
      isReducedMotion = e.matches
      if (isReducedMotion) {
        stopAnimation()
        if (renderer && scene && camera) renderer.render(scene, camera)
      } else {
        startAnimation()
      }
    }
    motionQuery.addEventListener('change', handleMotionChange)
  }

  function cleanup() {
    stopAnimation()

    intersectionObserver?.disconnect()
    intersectionObserver = null

    if (handleVisibilityChange) {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    if (handleMotionChange) {
      window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', handleMotionChange)
    }

    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    if (containerRef.value) {
      containerRef.value.removeEventListener('mousedown', onMouseDown)
      containerRef.value.removeEventListener('touchstart', onTouchStart)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)

    renderer?.dispose()
    if (renderer?.domElement && containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    interactiveItems,
    nearbyItem,
    isLoaded,
    handleInteract,
    setJoystickMove,
  }
}
