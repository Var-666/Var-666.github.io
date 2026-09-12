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
 * 纯正高精度低多边形艺术风格、治愈色盘、多层切面冷杉林与沉浸式暖光微缩移轴
 */
export function useCabinWorld(containerRef: Ref<HTMLElement | null>) {
  const store = useCabinStore()

  // 状态与对外接口
  const isLoaded = ref(false)
  const interactiveItems = ref<InteractiveItem[]>([])
  const nearbyItem = ref<InteractiveItem | null>(null)

  // 虚拟摇杆移动向量
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
  const playerPos = new THREE.Vector3(0, 0.45, 1.6)
  const playerVelocity = new THREE.Vector3()
  let playerRotation = 0
  let isMoving = false
  const keys = { w: false, a: false, s: false, d: false }

  // 摄像机长焦等轴测长焦角 (45° 斜等轴测)
  const cameraOffset = new THREE.Vector3(14, 15, 14)
  const cameraTarget = new THREE.Vector3(0, 1.2, 0)
  let cameraExtraAngleX = 0
  let cameraExtraAngleY = 0
  let isDragging = false
  let previousMousePosition = { x: 0, y: 0 }

  // 动画与微动引用
  let sleepingCatGroup: THREE.Group | null = null
  let dustParticles: THREE.Points | null = null
  const flickeringLights: THREE.PointLight[] = []

  // 空间临时矢量（GC 零开销）
  const _tempMoveDir = new THREE.Vector3()
  const _tempCamTarget = new THREE.Vector3()
  const _tempOffset = new THREE.Vector3()
  const _upVec = new THREE.Vector3(0, 1, 0)
  const _projectedVec = new THREE.Vector3()

  // 场景可交互点位定义
  const interactablesData = [
    {
      id: 'computer',
      drawerType: 'projects' as DrawerType,
      label: 'Projects',
      subLabel: '精选个人开发项目',
      icon: '💻',
      pos: new THREE.Vector3(-2.8, 1.1, -3.2),
      promptPos: new THREE.Vector3(-2.8, 2.35, -3.2),
    },
    {
      id: 'bookshelf',
      drawerType: 'articles' as DrawerType,
      label: 'Articles / Notes',
      subLabel: '技术随笔与思考',
      icon: '📖',
      pos: new THREE.Vector3(0.5, 1.4, -3.5),
      promptPos: new THREE.Vector3(0.5, 2.9, -3.5),
    },
    {
      id: 'bulletin',
      drawerType: 'updates' as DrawerType,
      label: 'Latest Updates',
      subLabel: '近期动态与便利贴',
      icon: '📋',
      pos: new THREE.Vector3(2.6, 1.4, -3.5),
      promptPos: new THREE.Vector3(2.6, 2.7, -3.5),
    },
    {
      id: 'cabinet',
      drawerType: 'cabinet' as DrawerType,
      label: 'Discovered Content',
      subLabel: '探索收集陈列柜',
      icon: '💎',
      pos: new THREE.Vector3(4.0, 1.2, -2.4),
      promptPos: new THREE.Vector3(4.0, 2.65, -2.4),
    },
    {
      id: 'map',
      drawerType: 'map' as DrawerType,
      label: 'Explore',
      subLabel: '全站大地图与导览',
      icon: '🗺️',
      pos: new THREE.Vector3(0.1, 0.85, 0.2),
      promptPos: new THREE.Vector3(0.1, 1.95, 0.2),
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
    { minX: -4.4, minZ: -4.2, maxX: -1.2, maxZ: -2.0 }, // 电脑桌
    { minX: -0.6, minZ: -4.2, maxX: 1.6, maxZ: -2.8 },  // 书架
    { minX: 1.8, minZ: -4.2, maxX: 3.3, maxZ: -3.0 },   // 告示板与长椅
    { minX: 3.4, minZ: -4.2, maxX: 4.8, maxZ: -1.6 },   // 玻璃展柜
    { minX: -1.4, minZ: -0.8, maxX: 1.4, maxZ: 1.2 },   // 中央沙盘长桌
    { minX: -4.6, minZ: -1.8, maxX: -2.0, maxZ: 0.8 },  // 左侧床铺
    { minX: 4.5, minZ: -4.5, maxX: 6.0, maxZ: 4.5 },    // 房间右侧外墙
    { minX: -4.8, minZ: -4.8, maxX: 4.8, maxZ: -3.8 },  // 房间后侧外墙
    { minX: -1.8, minZ: 2.5, maxX: 4.5, maxZ: 2.9 },    // 室内围栏
    { minX: -4.8, minZ: 2.5, maxX: -4.0, maxZ: 2.9 },
  ]

  // 初始化场景
  function init() {
    if (!containerRef.value) return

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    // 1. 场景与森林晨雾
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a261e) // 浓郁森林绿调微夜色底
    scene.fog = new THREE.FogExp2(0x1a261e, 0.018)

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
    renderer.toneMappingExposure = 1.26
    containerRef.value.appendChild(renderer.domElement)

    // 4. 灯光系统（温暖 2400K 煤油火光与窗外晨光对比）
    setupLights(isMobile)

    // 5. 建造 1:1 像素级复刻的小木屋微缩世界
    buildCabinDiorama()

    // 6. 创建 1:1 红便帽探险主角
    buildPlayer()

    // 7. 初始化交互状态
    updateInteractiveItemsState(true)

    // 8. 事件监听
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
    setupVisibilityListeners()
  }

  // 灯光系统配置
  function setupLights(isMobile = false) {
    if (!scene) return

    flickeringLights.length = 0

    // 1. 温暖舒适的环境漫射天光
    const ambientLight = new THREE.AmbientLight(0xffecd2, 0.7)
    scene.add(ambientLight)

    // 2. 透过左侧窗户倾泻而入的明亮晨光（太阳主光）
    const sunLight = new THREE.DirectionalLight(0xfffae8, 1.1)
    sunLight.position.set(-10, 14, -2.5)
    sunLight.target.position.set(0, 1, 0)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = isMobile ? 512 : 1024
    sunLight.shadow.mapSize.height = isMobile ? 512 : 1024
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 35
    const d = 8
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0012
    scene.add(sunLight)
    scene.add(sunLight.target)

    // 3. 室外冷调森林环境天光
    const skyLight = new THREE.DirectionalLight(0x74b9ff, 0.45)
    skyLight.position.set(8, 12, 10)
    scene.add(skyLight)

    // 4. 点光源：电脑工作台暖光鹅颈壁灯
    const deskLamp = new THREE.PointLight(0xffa834, 2.5, 6.5)
    deskLamp.position.set(-2.6, 1.9, -3.1)
    deskLamp.castShadow = true
    scene.add(deskLamp)
    flickeringLights.push(deskLamp)

    // 5. 点光源：电脑显示器湖山壁纸冷蓝微光
    const screenGlow = new THREE.PointLight(0x54a0ff, 1.2, 3.5)
    screenGlow.position.set(-2.8, 1.35, -2.7)
    scene.add(screenGlow)

    // 6. 点光源：床头柜复古煤油提灯
    const bedLantern = new THREE.PointLight(0xff9f43, 2.0, 5.5)
    bedLantern.position.set(-4.1, 1.15, 0.3)
    scene.add(bedLantern)
    flickeringLights.push(bedLantern)

    // 7. 点光源：中央大地图桌暖金吊灯
    const tableLantern = new THREE.PointLight(0xffb84d, 3.0, 8.5)
    tableLantern.position.set(0.1, 2.5, 0.2)
    tableLantern.castShadow = true
    scene.add(tableLantern)
    flickeringLights.push(tableLantern)

    // 8. 点光源：告示板阅读射灯
    const boardLight = new THREE.PointLight(0xffaa44, 1.8, 6)
    boardLight.position.set(2.6, 2.5, -3.2)
    scene.add(boardLight)

    // 9. 点光源：玻璃展柜内部青蓝水晶自发光
    const cabinetLight = new THREE.PointLight(0x00d2d3, 2.2, 4.5)
    cabinetLight.position.set(3.9, 1.8, -2.4)
    scene.add(cabinetLight)

    // 10. 点光源：室外石阶地灯
    const stairLantern = new THREE.PointLight(0xffa502, 2.2, 5.5)
    stairLantern.position.set(-3.6, 0.6, 3.6)
    scene.add(stairLantern)
    flickeringLights.push(stairLantern)
  }

  // 建造 1:1 像素级复刻的小木屋场景
  function buildCabinDiorama() {
    if (!scene) return

    // ── 材质库 ──
    const woodFloorTex = createWoodFloorTexture()
    const woodFloorMat = new THREE.MeshStandardMaterial({
      map: woodFloorTex,
      roughness: 0.65,
      metalness: 0.05,
    })

    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2717, // 深色实木横梁立柱
      roughness: 0.75,
    })

    const woodOakMat = new THREE.MeshStandardMaterial({
      color: 0x694326, // 暖胡桃实木家具
      roughness: 0.7,
    })

    const wallCreamMat = new THREE.MeshStandardMaterial({
      color: 0xede5d8, // 温馨米白抹灰墙
      roughness: 0.9,
    })

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x274326, // 浓郁森林深绿草坪
      roughness: 0.85,
    })

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8a9296, // 天然鹅卵石质感
      roughness: 0.75,
    })

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdff9fb,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
    })

    // ── 1. 室外草地地形 ──
    const groundGeo = new THREE.BoxGeometry(26, 0.4, 26)
    const ground = new THREE.Mesh(groundGeo, grassMat)
    ground.position.y = -0.2
    ground.receiveShadow = true
    scene.add(ground)

    // ── 2. 木屋实木基座与地板 ──
    const roomWidth = 9.2
    const roomDepth = 7.4
    const floorGeo = new THREE.BoxGeometry(roomWidth, 0.3, roomDepth)
    const floor = new THREE.Mesh(floorGeo, woodFloorMat)
    floor.position.set(0, 0.15, -0.6)
    floor.receiveShadow = true
    scene.add(floor)

    // ── 3. 墙体与立柱（开设有真窗洞，透出室外蓝天与松树） ──
    // 后实木大白墙 (Z: -4.3)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 3.6, 0.25), wallCreamMat)
    backWall.position.set(0, 1.8 + 0.3, -0.6 - roomDepth / 2)
    backWall.receiveShadow = true
    scene.add(backWall)

    // 左侧墙体：分割成窗洞前、中（上/下）、后三段，保证窗户是通透无阻碍的！
    // 窗户中心位于 Z: -1.8, Y: 2.3, 尺寸 2.2 x 1.8
    // 左墙后段 (Z: -4.3 ~ -2.9)
    const leftWallBack = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 1.5), wallCreamMat)
    leftWallBack.position.set(-roomWidth / 2, 2.1, -3.55)
    leftWallBack.receiveShadow = true
    // 左墙前段 (Z: -0.7 ~ 3.1)
    const leftWallFront = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 3.8), wallCreamMat)
    leftWallFront.position.set(-roomWidth / 2, 2.1, 1.2)
    leftWallFront.receiveShadow = true
    // 窗洞上方过梁与下方窗台
    const leftWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 2.2), wallCreamMat)
    leftWallTop.position.set(-roomWidth / 2, 3.45, -1.8)
    const leftWallBottom = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 2.2), wallCreamMat)
    leftWallBottom.position.set(-roomWidth / 2, 0.75, -1.8)
    scene.add(leftWallBack, leftWallFront, leftWallTop, leftWallBottom)

    // 实木顶部主横梁与角柱
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(roomWidth + 0.4, 0.35, 0.35), woodDarkMat)
    topBeam.position.set(0, 3.75, -0.6 - roomDepth / 2 + 0.1)
    const leftTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, roomDepth + 0.4), woodDarkMat)
    leftTopBeam.position.set(-roomWidth / 2 + 0.1, 3.75, -0.6)
    const cornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 0.4), woodDarkMat)
    cornerPost.position.set(-roomWidth / 2 + 0.15, 2.1, -0.6 - roomDepth / 2 + 0.15)
    scene.add(topBeam, leftTopBeam, cornerPost)

    // ── 4. 左侧透亮大木窗（White Panes，透出窗外阳光、翠绿松枝与蓝天） ──
    buildWindowWithOutdoorView(-roomWidth / 2, 2.3, -1.8)

    // 挂毯："Good Ideas Live Here 🌲"
    const tapestryTex = createTapestryTexture()
    const tapestryMat = new THREE.MeshStandardMaterial({
      map: tapestryTex,
      roughness: 0.9,
    })
    const tapestryMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), tapestryMat)
    tapestryMesh.rotation.y = Math.PI / 2
    tapestryMesh.position.set(-roomWidth / 2 + 0.15, 2.4, -3.2)
    const tapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 12), woodDarkMat)
    tapPole.rotation.x = Math.PI / 2
    tapPole.position.set(-roomWidth / 2 + 0.17, 3.32, -3.2)
    scene.add(tapestryMesh, tapPole)

    // ── 5. 前方矮围栏与刻板题字 ──
    const retainingWallTex = createRetainingWallTexture()
    const retainingMat = new THREE.MeshStandardMaterial({
      map: retainingWallTex,
      roughness: 0.8,
    })
    const frontFence = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.4, 0.25), retainingMat)
    frontFence.position.set(1.2, 1.0, 3.0)
    frontFence.castShadow = true
    scene.add(frontFence)

    // ── 6. 左下角出门木台阶与探险路标 ──
    for (let stepIdx = 0; stepIdx < 3; stepIdx++) {
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.65), woodOakMat)
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

    createKeroseneLantern(-3.6, 0.42, 3.6, 0.9)

    // ── 7. 卧室区（原木床榻、绿色折叠被褥、熟睡橘白猫咪、古典红地毯） ──
    buildBedAndSleepingCatArea()

    // ── 8. 电脑工作台区（超宽曲面屏显示器、青绿转椅、写字台、壁灯） ──
    buildWorkstationArea()

    // ── 9. 大型藏书架区（满载数百本各色书籍、黄铜地球仪、绿植） ──
    buildGrandBookcaseArea()

    // ── 10. 告示板区（Latest Updates，软木大板、Small Steps 标语、拍立得相片） ──
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

    // ── 11. 探索陈列展柜（Discovered Content，透明玻璃展柜、发光水晶群、小机器人） ──
    buildCurioShowcaseCabinet()

    // ── 12. 中央大地图桌（Explore，展开的大地图、3D 微缩立体山脉与河流、木凳、绿毯） ──
    buildCentralMapTableArea()

    // ── 13. 室外多层立体切面冷杉林与鹅卵石野花小径 ──
    buildOutdoorForestAndGarden(stoneMat)

    // ── 14. 悬浮空气暖金光尘微粒 ──
    buildAmbientDust()
  }

  // 1:1 构建左侧通透窗户与窗外阳光绿林景深
  function buildWindowWithOutdoorView(x: number, y: number, z: number) {
    if (!scene) return
    const winGroup = new THREE.Group()
    winGroup.position.set(x, y, z)

    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2717, roughness: 0.8 })
    const whiteWood = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.6 })
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.35, roughness: 0.05 })

    // 外窗框 (深木)
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.84, 2.24), darkWood)
    winGroup.add(outerFrame)

    // 6 格白木内窗格 (2 行 x 3 列)
    const innerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.76, 2.16), glassMat)
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 2.16), whiteWood)
    const vBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.76, 0.06), whiteWood)
    vBar1.position.z = -0.68
    const vBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.76, 0.06), whiteWood)
    vBar2.position.z = 0.68
    winGroup.add(innerGlass, hBar, vBar1, vBar2)

    // 窗台延伸搁板（摆放一盆迎光小多肉）
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 2.3), darkWood)
    sill.position.set(0.08, -0.92, 0)
    winGroup.add(sill)

    scene.add(winGroup)
  }

  // 1:1 构建卧室区（精致原木床架、深绿被褥、两只白枕头、卷缩大睡的橘白小猫）
  function buildBedAndSleepingCatArea() {
    if (!scene) return
    const bedGroup = new THREE.Group()
    bedGroup.position.set(-3.3, 0.3, -0.6)

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e331e, roughness: 0.7 })
    const woodBed = new THREE.MeshStandardMaterial({ color: 0x6e4729, roughness: 0.7 })
    const whiteLinen = new THREE.MeshStandardMaterial({ color: 0xfbfbfd, roughness: 0.85 })
    const greenQuilt = new THREE.MeshStandardMaterial({ color: 0x2e4f35, roughness: 0.8 }) // 饱满治愈的深森林绿被子

    // 古典波斯红毯 (地面铺垫)
    const burgundyRugTex = createBurgundyRugTexture()
    const bedRug = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshStandardMaterial({ map: burgundyRugTex, roughness: 0.9 }))
    bedRug.rotation.x = -Math.PI / 2
    bedRug.position.set(0, 0.01, 0)
    bedRug.receiveShadow = true
    bedGroup.add(bedRug)

    // 实木床架与 4 根圆润立柱
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 2.2), woodBed)
    bedFrame.position.set(0, 0.2, 0)
    bedFrame.castShadow = true
    bedGroup.add(bedFrame)

    for (const [px, pz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 12), woodDark)
      post.position.set(px, 0.38, pz)
      post.castShadow = true
      bedGroup.add(post)
    }

    // 床头高背板
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.65, 0.1), woodDark)
    headboard.position.set(0, 0.62, -1.06)
    headboard.castShadow = true
    bedGroup.add(headboard)

    // 白色床垫
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 2.05), whiteLinen)
    mattress.position.set(0, 0.44, 0)
    bedGroup.add(mattress)

    // 深森林绿厚被子（铺盖后半截）
    const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.18, 1.45), greenQuilt)
    quilt.position.set(0, 0.52, 0.3)
    quilt.castShadow = true
    bedGroup.add(quilt)

    // 折叠露出的白被单边缘
    const sheetTurn = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.08, 0.25), whiteLinen)
    sheetTurn.position.set(0, 0.55, -0.45)
    bedGroup.add(sheetTurn)

    // 两只蓬松白枕头
    const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.4), whiteLinen)
    pillow1.position.set(-0.38, 0.56, -0.8)
    const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.4), whiteLinen)
    pillow2.position.set(0.38, 0.56, -0.8)
    bedGroup.add(pillow1, pillow2)

    // 🐱 1:1 精确复刻设计图：在被窝中央甜美熟睡的橘白花斑小猫（带起伏呼吸）
    const catGroup = createSleepingGingerCat()
    catGroup.position.set(0.12, 0.62, 0.25)
    catGroup.rotation.y = -0.4
    bedGroup.add(catGroup)
    sleepingCatGroup = catGroup

    scene.add(bedGroup)

    // 床头小木柜、书籍与煤油灯
    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), woodBed)
    nightstand.position.set(-4.1, 0.62, 0.3)
    scene.add(nightstand)

    // 床头叠放的 3 本彩色精装书
    buildBookStack(scene, -4.1, 0.95, 0.45, 3)
    createKeroseneLantern(-4.1, 0.96, 0.2, 0.85)
  }

  // 纯手工高精度打造 1:1 卷缩熟睡的橘白猫咪（带白肚皮、白爪爪、耳朵与卷曲长尾）
  function createSleepingGingerCat(): THREE.Group {
    const cat = new THREE.Group()

    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xe67e22, // 温暖的鲜明橘猫底色
      roughness: 0.65,
    })
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // 纯白胸脯与四爪
      roughness: 0.65,
    })
    const earInnerMat = new THREE.MeshStandardMaterial({
      color: 0xffb8b8, // 粉嫩耳廓
      roughness: 0.7,
    })
    const closedEyeMat = new THREE.MeshBasicMaterial({ color: 0x4a2e12 })

    // 身体：优美蜷曲的圆形肉球（Torus 弧段）
    const bodyGeo = new THREE.TorusGeometry(0.16, 0.11, 16, 32, Math.PI * 1.35)
    const body = new THREE.Mesh(bodyGeo, orangeMat)
    body.rotation.x = Math.PI / 2
    body.castShadow = true
    cat.add(body)

    // 白色肚皮内衬
    const bellyGeo = new THREE.SphereGeometry(0.11, 14, 14)
    const belly = new THREE.Mesh(bellyGeo, whiteMat)
    belly.scale.set(1.0, 0.65, 1.2)
    belly.position.set(0.04, -0.02, 0.05)
    cat.add(belly)

    // 圆乎乎的猫猫头（埋在身体一端）
    const headGeo = new THREE.SphereGeometry(0.115, 18, 18)
    const head = new THREE.Mesh(headGeo, orangeMat)
    head.position.set(0.14, 0.06, 0.12)
    head.castShadow = true
    cat.add(head)

    // 白色面颊与下巴
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), whiteMat)
    muzzle.scale.set(1.2, 0.8, 1.0)
    muzzle.position.set(0.19, 0.03, 0.14)
    cat.add(muzzle)

    // 闭着的萌萌睡眼 ⌒ ⌒
    const leftEyeCurve = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 4, 12, Math.PI), closedEyeMat)
    leftEyeCurve.position.set(0.23, 0.06, 0.16)
    leftEyeCurve.rotation.y = Math.PI / 3
    const rightEyeCurve = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 4, 12, Math.PI), closedEyeMat)
    rightEyeCurve.position.set(0.17, 0.06, 0.22)
    rightEyeCurve.rotation.y = Math.PI / 6
    cat.add(leftEyeCurve, rightEyeCurve)

    // 扁平趴下的三角形小耳朵
    const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), orangeMat)
    leftEar.position.set(0.16, 0.15, 0.06)
    leftEar.rotation.set(-0.3, 0, 0.5)
    const rightEar = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), orangeMat)
    rightEar.position.set(0.08, 0.15, 0.14)
    rightEar.rotation.set(0.5, 0, -0.3)
    cat.add(leftEar, rightEar)

    // 抱头的前白爪
    const paw1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), whiteMat)
    paw1.position.set(0.21, 0.0, 0.08)
    const paw2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), whiteMat)
    paw2.position.set(0.12, 0.0, 0.22)
    cat.add(paw1, paw2)

    // 蜷绕在屁股后方的长尾巴（带白尾尖）
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 10, 24, Math.PI * 1.1), orangeMat)
    tail.rotation.x = Math.PI / 2
    tail.position.set(-0.04, 0, -0.06)
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), whiteMat)
    tailTip.position.set(-0.19, 0, 0.04)
    cat.add(tail, tailTip)

    return cat
  }

  // 1:1 构建电脑工作台区
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

    // 抽屉把手金属点缀
    for (const dy of [0.25, 0.55]) {
      const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }))
      h1.rotation.z = Math.PI / 2
      h1.position.set(-0.8, dy, 0.61)
      const h2 = h1.clone()
      h2.position.x = 0.8
      deskGroup.add(h1, h2)
    }

    // 显示器金属底座与液压臂
    const monitorStandMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.3, metalness: 0.7 })
    const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), monitorStandMat)
    mBase.position.set(0, 0.82, -0.15)
    const mArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), monitorStandMat)
    mArm.position.set(0, 1.02, -0.15)
    deskGroup.add(mBase, mArm)

    // 超宽曲面显示器黑框
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.74, 0.04), monitorStandMat)
    screenFrame.position.set(0, 1.34, -0.14)
    deskGroup.add(screenFrame)

    // 极简雪山湖泊壁纸微光
    const wallpaperTex = createScreenWallpaperTexture()
    const screenMat = new THREE.MeshBasicMaterial({ map: wallpaperTex })
    const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.68), screenMat)
    screenFace.position.set(0, 1.34, -0.118)
    deskGroup.add(screenFace)

    // 机械键盘、鼠标垫、鼠标
    const mousepad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.005, 0.35), new THREE.MeshStandardMaterial({ color: 0x222f3e, roughness: 0.9 }))
    mousepad.position.set(0.05, 0.805, 0.22)
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.5 }))
    kb.position.set(-0.02, 0.82, 0.22)
    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.11), new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.4 }))
    mouse.position.set(0.26, 0.82, 0.22)
    deskGroup.add(mousepad, kb, mouse)

    // 陶瓷热咖啡马克杯
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 14), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3 }))
    mug.position.set(0.68, 0.88, 0.15)
    deskGroup.add(mug)

    // 桌面左侧小台灯
    createDeskLamp(deskGroup, -0.9, 0.8, -0.2)

    // 桌面小多肉盆栽
    createTerracottaPlant(deskGroup, 0.9, 0.8, -0.2, 0.18)

    scene.add(deskGroup)

    // 墙上小挂画
    const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.04), woodOakMat)
    artFrame.position.set(-2.8, 2.5, -4.26)
    scene.add(artFrame)

    // 电脑桌前人体工学青绿转椅
    buildSwivelChair(-2.8, 0.3, -2.2)
  }

  // 1:1 构建宏大藏书大书架（数百本错落图书、复古地球仪、盆栽）
  function buildGrandBookcaseArea() {
    if (!scene) return
    const shelfGroup = new THREE.Group()
    shelfGroup.position.set(0.5, 0.3, -3.8)

    const oak = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.75 })

    // 书柜外框（高 3.2m，宽 2.5m，深 0.55m）
    const bW = 2.5
    const bH = 3.2
    const bD = 0.55

    // 左右主立板
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, bH, bD), oak)
    leftSide.position.set(-bW / 2 + 0.04, bH / 2, 0)
    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, bH, bD), oak)
    rightSide.position.set(bW / 2 - 0.04, bH / 2, 0)
    // 中间隔板
    const midDivider = new THREE.Mesh(new THREE.BoxGeometry(0.06, bH, bD), oak)
    midDivider.position.set(0, bH / 2, 0)
    // 顶底横板
    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.08, bD), oak)
    topBoard.position.set(0, bH - 0.04, 0)
    const bottomBoard = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.1, bD), oak)
    bottomBoard.position.set(0, 0.05, 0)
    // 背板
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, 0.04), oak)
    backPanel.position.set(0, bH / 2, -bD / 2 + 0.02)
    shelfGroup.add(leftSide, rightSide, midDivider, topBoard, bottomBoard, backPanel)

    // 3 层内部实木隔板 (Y: 0.85, 1.65, 2.45)
    for (const sy of [0.85, 1.65, 2.45]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(bW - 0.16, 0.05, bD - 0.04), oak)
      shelf.position.set(0, sy, 0.01)
      shelfGroup.add(shelf)
    }

    // 丰富的各色精装藏书（红、蓝、绿、黄、棕、橙错落排布）
    const bookColors = [0x8b1515, 0x1b3a57, 0x274e30, 0xc98a2c, 0x5c3a21, 0xb84d18, 0x234e52, 0x502c1e]
    // 第 1 层图书 (下层)
    for (let c = 0; c < 2; c++) {
      const startX = c === 0 ? -1.1 : 0.1
      for (let i = 0; i < 11; i++) {
        const h = 0.35 + Math.random() * 0.15
        const w = 0.06 + Math.random() * 0.03
        const col = bookColors[(i + c * 3) % bookColors.length]
        const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.32), new THREE.MeshStandardMaterial({ color: col, roughness: 0.65 }))
        book.position.set(startX + i * 0.09, 0.88 + h / 2, 0.04)
        shelfGroup.add(book)
      }
    }
    // 第 2 层图书 (中层左侧满书，右侧陈列地球仪)
    for (let i = 0; i < 10; i++) {
      const h = 0.38 + Math.random() * 0.12
      const w = 0.07 + Math.random() * 0.02
      const col = bookColors[(i * 2) % bookColors.length]
      const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.34), new THREE.MeshStandardMaterial({ color: col, roughness: 0.65 }))
      book.position.set(-1.1 + i * 0.095, 1.68 + h / 2, 0.04)
      shelfGroup.add(book)
    }

    // 中层右侧：黄铜旋转地球仪 🌍
    buildGlobe(shelfGroup, 0.65, 1.7, 0.06)

    // 第 3 层图书 (上层倾斜书本与横堆书籍)
    for (let i = 0; i < 7; i++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length] }))
      book.position.set(-1.1 + i * 0.09, 2.48 + 0.21, 0.04)
      shelfGroup.add(book)
    }
    // 倾斜依靠的书籍
    const leaningBook = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.34), new THREE.MeshStandardMaterial({ color: 0x8b1515 }))
    leaningBook.position.set(-0.42, 2.48 + 0.2, 0.04)
    leaningBook.rotation.z = -0.32
    shelfGroup.add(leaningBook)

    // 顶层垂悬常春藤绿植
    buildHangingIvy(shelfGroup, -0.85, 3.25, 0.15)

    scene.add(shelfGroup)

    // 书架旁的落地虎尾兰大盆栽
    createTallHousePlant(1.9, 0.3, -3.6)
  }

  // 1:1 构建中央大长桌与 3D 微缩山川探险沙盘
  function buildCentralMapTableArea() {
    if (!scene) return

    const woodDark = new THREE.MeshStandardMaterial({ color: 0x462d1a, roughness: 0.75 })
    const woodOak = new THREE.MeshStandardMaterial({ color: 0x6e4729, roughness: 0.7 })

    // 大桌下方铺垫的大型森林绿几何毛毯
    const greenRugTex = createGreenRugTexture()
    const tableRug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.8), new THREE.MeshStandardMaterial({ map: greenRugTex, roughness: 0.9 }))
    tableRug.rotation.x = -Math.PI / 2
    tableRug.position.set(0.1, 0.31, 0.2)
    tableRug.receiveShadow = true
    scene.add(tableRug)

    // 厚重实木大工作长桌（宽 2.5m，高 0.75m，深 1.5m）
    const mainTable = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.78, 1.5), woodOak)
    mainTable.position.set(0.1, 0.69, 0.2)
    mainTable.castShadow = true
    scene.add(mainTable)

    // 桌底横撑梁与书籍木箱
    const underCrate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.55), woodDark)
    underCrate.position.set(0.1, 0.48, 0.2)
    scene.add(underCrate)

    // 四周围绕的 4 张质朴实木方凳
    for (const [stX, stZ] of [[-0.75, 1.05], [0.95, 1.05], [-0.75, -0.65], [0.95, -0.65]]) {
      const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.42), woodOak)
      stool.position.set(0.1 + stX, 0.52, 0.2 + stZ)
      stool.castShadow = true
      scene.add(stool)
    }

    // 桌面上展开的羊皮纸大地图
    const mapTex = createAdventureMapTexture()
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.8 }))
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.position.set(0.1, 1.085, 0.2)
    scene.add(mapMesh)

    // 🏔️ 1:1 复刻设计图灵魂：从羊皮纸地图直接立体突起的 3D 低多边形雪山群峰与蓝色河流！
    const miniMountainGroup = new THREE.Group()
    miniMountainGroup.position.set(0.4, 1.085, 0.16)

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x57606f, roughness: 0.85, flatShading: true })
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, flatShading: true })
    const riverMat = new THREE.MeshStandardMaterial({ color: 0x3867d6, roughness: 0.3 })

    // 主峰（带积雪白顶）
    const peak1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 6), mountainMat)
    peak1.position.set(0, 0.19, 0)
    const snow1 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 6), snowCapMat)
    snow1.position.set(0, 0.31, 0)
    miniMountainGroup.add(peak1, snow1)

    // 副峰 2
    const peak2 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 6), mountainMat)
    peak2.position.set(-0.19, 0.14, 0.09)
    const snow2 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.11, 6), snowCapMat)
    snow2.position.set(-0.19, 0.225, 0.09)
    miniMountainGroup.add(peak2, snow2)

    // 副峰 3
    const peak3 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 5), mountainMat)
    peak3.position.set(0.22, 0.12, -0.08)
    miniMountainGroup.add(peak3)

    // 蜿蜒河流带
    const river = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.12), riverMat)
    river.rotation.x = -Math.PI / 2
    river.position.set(-0.1, 0.005, -0.15)
    miniMountainGroup.add(river)

    scene.add(miniMountainGroup)

    // 桌面小多肉盆与陶瓷咖啡马克杯
    createTerracottaPlant(scene, -0.52, 1.085, 0.35, 0.15)
    const tableMug = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 }))
    tableMug.position.set(-0.42, 1.155, -0.1)
    scene.add(tableMug)
  }

  // 1:1 构建发光玻璃陈列展柜
  function buildCurioShowcaseCabinet() {
    if (!scene) return
    const cabinetGroup = new THREE.Group()
    cabinetGroup.position.set(3.9, 0.3, -2.4)
    cabinetGroup.rotation.y = -Math.PI / 2

    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x3d2717, roughness: 0.75 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdff9fb,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0.1,
    })

    // 底座与顶盖
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

    // 透明玻璃面板
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
      emissiveIntensity: 1.1,
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
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
    const crystalMesh2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), amberCrystalMat)
    crystalMesh2.position.set(0, 2.08, 0)
    cabinetGroup.add(crystalMesh2)

    scene.add(cabinetGroup)
  }

  // 1:1 构建室外多层立体切面冷杉林与鹅卵石野花小径
  function buildOutdoorForestAndGarden(stoneMat: THREE.Material) {
    if (!scene) return

    // 🌲 浓密立体多层冷杉松林群落（纯正深森林绿，高低错落环绕木屋四周，0 穿模且不阻挡室内视野）
    const pineForestConfigs: [number, number, number, number][] = [
      // 1. 北侧后森林 (木屋后墙 Z: -4.3 之外，挺拔高耸形成森林背景深远景深)
      [-2.5, 0, -7.6, 2.4],
      [0.8, 0, -7.8, 2.6],
      [3.8, 0, -7.6, 2.3],
      [-5.5, 0, -7.2, 2.1],
      [6.8, 0, -7.5, 2.2],

      // 2. 西侧外森林 (左侧窗外与原木墙外 X: -4.6 之外，松针紧贴窗外玻璃透光但不穿模)
      [-6.8, 0, -1.8, 1.6], // 窗户正对外松树
      [-7.8, 0, -4.0, 2.2],
      [-7.5, 0, 0.6, 2.0],
      [-7.2, 0, 2.8, 1.9],

      // 3. 东侧外森林 (右侧后方，展柜外侧 X: 4.6 之外，完全避开相机视线)
      [8.0, 0, -3.5, 2.2],
      [8.2, 0, -0.5, 1.8],

      // 4. 西南入户花园与石径边缘 (鹅卵石步道左侧，自然点缀不挡路不入室)
      [-5.8, 0, 5.2, 1.5],
      [-4.5, 0, 6.6, 1.6],
      [-3.2, 0, 9.2, 1.5],

      // 5. 东南极远角小树 (仅在画面右下角视野边缘，绝不遮挡室内与抽屉面板)
      [6.5, 0, 8.5, 0.9],
    ]

    for (const [px, py, pz, scale] of pineForestConfigs) {
      createLushPineTree(px, py, pz, scale)
    }

    // 蜿蜒自然鹅卵石步道石（带不同角度微旋转）
    const stoneCoords: [number, number, number][] = [
      [-2.8, 4.3, 0.45],
      [-2.5, 5.1, 0.42],
      [-2.1, 5.9, 0.46],
      [-1.5, 6.7, 0.43],
      [-0.9, 7.4, 0.45],
    ]
    for (const [sx, sz, r] of stoneCoords) {
      const stoneGeo = new THREE.CylinderGeometry(r, r * 1.1, 0.08, 8)
      const stone = new THREE.Mesh(stoneGeo, stoneMat)
      stone.position.set(sx, 0.04, sz)
      stone.rotation.y = Math.random() * Math.PI
      stone.receiveShadow = true
      scene.add(stone)
    }

    // 盛开的白色雏菊野花与灌木丛 🌼
    buildDaisyField()

    // 悬浮旋转的神秘数据水晶遗物
    const crystalGeo = new THREE.OctahedronGeometry(0.25, 0)
    const outdoorCrystal = new THREE.Mesh(
      crystalGeo,
      new THREE.MeshStandardMaterial({
        color: 0x54a0ff,
        emissive: 0x2e86de,
        emissiveIntensity: 0.95,
        roughness: 0.1,
      })
    )
    outdoorCrystal.name = 'floatingCrystal'
    outdoorCrystal.position.set(-3.2, 0.4, 4.5)
    scene.add(outdoorCrystal)
  }

  // 多层立体切面冷杉松树（5 层渐进收拢，深邃饱满的森林翠绿）
  function createLushPineTree(x: number, y: number, z: number, scale = 1.0) {
    if (!scene) return
    const tree = new THREE.Group()
    tree.position.set(x, y, z)
    tree.scale.setScalar(scale)

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2716, roughness: 0.85 })
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0x244a29, // 纯正深邃森林冷杉绿
      roughness: 0.7,
      flatShading: true, // 开启切面光照，彰显高贵低模立体感
    })

    // 粗壮实木树干
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.8, 8), trunkMat)
    trunk.position.y = 0.9
    trunk.castShadow = true
    tree.add(trunk)

    // 5 层多面体切面松针冠层
    const tiers = [
      { r: 1.25, h: 1.1, y: 1.35 },
      { r: 1.05, h: 1.0, y: 1.95 },
      { r: 0.85, h: 0.9, y: 2.55 },
      { r: 0.65, h: 0.8, y: 3.1 },
      { r: 0.42, h: 0.7, y: 3.6 },
    ]

    tiers.forEach((t, idx) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), needleMat)
      cone.position.y = t.y
      cone.rotation.y = idx * 0.45 // 层间微旋，避免单一
      cone.castShadow = true
      tree.add(cone)
    })

    scene.add(tree)
  }

  // 经典复古玻璃煤油提灯组件
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

  // 黄铜复古旋转地球仪 🌍
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

  // 落地高大室内绿植盆栽
  function createTallHousePlant(x: number, y: number, z: number) {
    if (!scene) return
    const plantGroup = new THREE.Group()
    plantGroup.position.set(x, y, z)

    const potMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.5 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x218c74, roughness: 0.65 })

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.65, 16), potMat)
    pot.position.y = 0.32
    pot.castShadow = true
    plantGroup.add(pot)

    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.CylinderGeometry(0.08, 0.02, 0.9, 5)
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.set((Math.random() - 0.5) * 0.15, 0.75, (Math.random() - 0.5) * 0.15)
      leaf.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4)
      leaf.castShadow = true
      plantGroup.add(leaf)
    }

    scene.add(plantGroup)
  }

  // 堆叠书籍辅助
  function buildBookStack(parent: THREE.Object3D, x: number, y: number, z: number, count = 3) {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    const cols = [0x8b1515, 0x1b3a57, 0x274e30, 0xc98a2c]
    for (let i = 0; i < count; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: cols[i % cols.length] }))
      b.position.y = 0.025 + i * 0.052
      b.rotation.y = (Math.random() - 0.5) * 0.2
      group.add(b)
    }
    parent.add(group)
  }

  // 桌面复古小台灯
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

  // 办公工学青绿转椅
  function buildSwivelChair(x: number, y: number, z: number) {
    if (!scene) return
    const chairGroup = new THREE.Group()
    chairGroup.position.set(x, y, z)
    chairGroup.rotation.y = Math.PI * 0.75

    const plasticMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4, metalness: 0.5 })
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x16a085, roughness: 0.8 })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 5), plasticMat)
    base.position.y = 0.05
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 12), plasticMat)
    stem.position.y = 0.22

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.65), fabricMat)
    seat.position.y = 0.42

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.75, 0.1), fabricMat)
    backrest.position.set(0, 0.85, 0.3)
    backrest.rotation.x = -0.1

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), plasticMat)
    leftArm.position.set(-0.35, 0.62, 0.05)
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.42), plasticMat)
    rightArm.position.set(0.35, 0.62, 0.05)

    chairGroup.add(base, stem, seat, backrest, leftArm, rightArm)
    scene.add(chairGroup)
  }

  // 草地上盛开的小白雏菊群 🌼
  function buildDaisyField() {
    if (!scene) return
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffb142, roughness: 0.5 })

    const coords: [number, number][] = [
      [-3.8, 3.8],
      [-3.4, 4.4],
      [-2.2, 3.8],
      [-1.8, 4.8],
      [-2.6, 6.2],
      [-1.2, 5.8],
      [-3.6, 5.4],
      [-0.8, 6.8],
    ]

    for (const [dx, dz] of coords) {
      const daisy = new THREE.Group()
      daisy.position.set(dx, 0.02, dz)
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), coreMat)
      daisy.add(core)
      for (let p = 0; p < 6; p++) {
        const petal = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.08), petalMat)
        petal.position.set(Math.sin((p / 6) * Math.PI * 2) * 0.06, 0, Math.cos((p / 6) * Math.PI * 2) * 0.06)
        petal.rotation.y = (p / 6) * Math.PI * 2
        daisy.add(petal)
      }
      scene.add(daisy)
    }
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

    // 2. 🐱 熟睡橘猫温柔起伏的呼吸动效
    if (sleepingCatGroup) {
      const breathe = Math.sin(now * 0.0024)
      sleepingCatGroup.scale.y = 1.0 + breathe * 0.05
      sleepingCatGroup.scale.x = 1.0 + breathe * 0.02
    }

    // 3. 煤油灯光火晕自然微颤 (Flicker)
    for (let i = 0; i < flickeringLights.length; i++) {
      const light = flickeringLights[i]
      light.intensity = 2.2 + Math.sin(now * 0.012 + i * 2.1) * 0.25
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
