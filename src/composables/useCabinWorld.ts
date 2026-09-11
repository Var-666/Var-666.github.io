import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { useCabinStore, type DrawerType } from './useCabinStore'

export interface InteractiveItem {
  id: string
  drawerType: DrawerType | 'crystal'
  label: string
  subLabel?: string
  icon: string
  pos: THREE.Vector3
  promptPos: THREE.Vector3
  distance: number
  screenX: number
  screenY: number
  isNearby: boolean
}

export function useCabinWorld(containerRef: Ref<HTMLElement | null>) {
  const store = useCabinStore()

  // 反应式状态暴露给 UI 模板
  const interactiveItems = ref<InteractiveItem[]>([])
  const nearbyItem = ref<InteractiveItem | null>(null)
  const isLoaded = ref(false)

  // Three.js 核心对象
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let animFrameId: number | null = null

  // 角色与控制器
  let playerGroup: THREE.Group | null = null
  let playerBody: THREE.Mesh | null = null
  let playerHead: THREE.Mesh | null = null
  let playerBackpack: THREE.Mesh | null = null
  let playerShadow: THREE.Mesh | null = null

  const playerPos = new THREE.Vector3(0, 0.45, 1.8)
  const playerVelocity = new THREE.Vector3(0, 0, 0)
  let playerRotation = Math.PI // 初始朝向面向镜头
  let walkCycle = 0
  let isMoving = false

  // 相机跟随平滑目标
  const cameraTarget = new THREE.Vector3(0, 1.2, 0)
  const cameraOffset = new THREE.Vector3(14, 15, 14) // 斜俯视等轴测角度
  let cameraExtraAngleX = 0
  let cameraExtraAngleY = 0
  let isDragging = false
  let previousMousePosition = { x: 0, y: 0 }

  // 键盘状态
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    e: false,
  }

  // 互动目标实体定义（世界坐标）
  const interactablesData = [
    {
      id: 'pc',
      drawerType: 'projects' as DrawerType,
      label: 'Projects',
      subLabel: '项目归档',
      icon: '💻',
      pos: new THREE.Vector3(-2.8, 1.2, -3.2),
      promptPos: new THREE.Vector3(-2.8, 2.3, -3.2),
    },
    {
      id: 'bookshelf',
      drawerType: 'articles' as DrawerType,
      label: 'Articles / Notes',
      subLabel: '技术随笔与思考',
      icon: '📖',
      pos: new THREE.Vector3(0.5, 1.4, -3.5),
      promptPos: new THREE.Vector3(0.5, 2.7, -3.5),
    },
    {
      id: 'bulletin',
      drawerType: 'updates' as DrawerType,
      label: 'Latest Updates',
      subLabel: '近期动态与便利贴',
      icon: '📋',
      pos: new THREE.Vector3(2.6, 1.4, -3.5),
      promptPos: new THREE.Vector3(2.6, 2.6, -3.5),
    },
    {
      id: 'cabinet',
      drawerType: 'cabinet' as DrawerType,
      label: 'Discovered Content',
      subLabel: '探索收集陈列柜',
      icon: '💎',
      pos: new THREE.Vector3(4.0, 1.2, -2.4),
      promptPos: new THREE.Vector3(4.0, 2.5, -2.4),
    },
    {
      id: 'map',
      drawerType: 'map' as DrawerType,
      label: 'Explore',
      subLabel: '全站大地图与导览',
      icon: '🗺️',
      pos: new THREE.Vector3(0.1, 0.85, 0.2),
      promptPos: new THREE.Vector3(0.1, 1.8, 0.2),
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
    { minX: -1.3, minZ: -0.7, maxX: 1.3, maxZ: 1.1 },
    // 左侧床榻
    { minX: -4.6, minZ: -1.8, maxX: -2.2, maxZ: 0.8 },
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

    // 1. 场景与柔和雾气
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x19211e) // 森林夜色
    scene.fog = new THREE.FogExp2(0x19211e, 0.024)

    // 2. 正交感极强的长焦 PerspectiveCamera (FOV 26度，极度舒适的斜俯视微缩玩具箱质感)
    camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 100)
    camera.position.copy(cameraTarget).add(cameraOffset)
    camera.lookAt(cameraTarget)

    // 3. 渲染器配置
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    containerRef.value.appendChild(renderer.domElement)

    // 4. 灯光系统（温暖温馨氛围的核心）
    setupLights()

    // 5. 建造木屋微缩场景
    buildCabinDiorama()

    // 6. 创建主角角色
    buildPlayer()

    // 7. 初始化交互项目状态
    updateInteractiveItemsState()

    // 8. 事件监听
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    containerRef.value.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    isLoaded.value = true
    animate()
  }

  // 灯光系统
  function setupLights() {
    if (!scene) return

    // 整体大地色环境光
    const ambientLight = new THREE.AmbientLight(0xffecd6, 0.65)
    scene.add(ambientLight)

    // 模拟室外透射月光 / 柔和日光
    const dirLight = new THREE.DirectionalLight(0xdce7f0, 0.9)
    dirLight.position.set(12, 18, 8)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 40
    const d = 10
    dirLight.shadow.camera.left = -d
    dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d
    dirLight.shadow.camera.bottom = -d
    dirLight.shadow.bias = -0.001
    scene.add(dirLight)

    // 暖色点光源 1：工作台台灯
    const deskLamp = new THREE.PointLight(0xff9f43, 2.2, 7)
    deskLamp.position.set(-2.6, 2.0, -3.0)
    deskLamp.castShadow = true
    scene.add(deskLamp)

    // 暖色点光源 2：中央地图桌上方灯笼
    const tableLantern = new THREE.PointLight(0xffb84d, 2.8, 8)
    tableLantern.position.set(0.1, 2.5, 0.2)
    scene.add(tableLantern)

    // 暖色点光源 3：告示板射灯
    const boardLight = new THREE.PointLight(0xffa834, 1.8, 6)
    boardLight.position.set(2.6, 2.4, -3.0)
    scene.add(boardLight)

    // 蓝色微光：电脑屏幕发射光
    const screenGlow = new THREE.PointLight(0x48dbfb, 1.2, 3.5)
    screenGlow.position.set(-2.8, 1.4, -2.8)
    scene.add(screenGlow)

    // 门外路灯 / 露台暖光
    const porchLight = new THREE.PointLight(0xff9933, 2.2, 7)
    porchLight.position.set(-2.8, 1.6, 2.8)
    scene.add(porchLight)
  }

  // 建造 3D 木屋场景
  function buildCabinDiorama() {
    if (!scene) return

    // 材质库
    const woodFloorMat = new THREE.MeshStandardMaterial({
      color: 0x936a44,
      roughness: 0.7,
      metalness: 0.1,
    })
    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x543d2b,
      roughness: 0.8,
    })
    const wallCreamMat = new THREE.MeshStandardMaterial({
      color: 0xe8dfd5,
      roughness: 0.9,
    })
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c39,
      roughness: 0.85,
    })
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x4f6d52,
      roughness: 0.95,
    })
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x808588,
      roughness: 0.8,
    })
    const leavesMat = new THREE.MeshStandardMaterial({
      color: 0x2d4f30,
      roughness: 0.7,
    })
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x54a0ff,
      roughness: 0.1,
      metalness: 0.3,
      emissive: 0x2e86de,
      emissiveIntensity: 0.8,
    })

    // ── 1. 室外草地地形 ──
    const groundGeo = new THREE.BoxGeometry(22, 0.4, 22)
    const ground = new THREE.Mesh(groundGeo, grassMat)
    ground.position.set(0, -0.2, 0)
    ground.receiveShadow = true
    scene.add(ground)

    // ── 2. 木屋室内抬高木地板 ──
    const roomWidth = 9.2
    const roomDepth = 7.0
    const floorGeo = new THREE.BoxGeometry(roomWidth, 0.3, roomDepth)
    const floor = new THREE.Mesh(floorGeo, woodFloorMat)
    floor.position.set(0, 0.15, -0.6)
    floor.receiveShadow = true
    scene.add(floor)

    // 木地板拼缝细节（细长条装饰木纹）
    for (let i = -roomWidth / 2 + 0.8; i < roomWidth / 2; i += 1.0) {
      const plankLineGeo = new THREE.BoxGeometry(0.04, 0.32, roomDepth - 0.2)
      const plankLine = new THREE.Mesh(plankLineGeo, woodDarkMat)
      plankLine.position.set(i, 0.16, -0.6)
      scene.add(plankLine)
    }

    // ── 3. 室内地毯 ──
    // 中央地图桌下的大绿毯
    const centerRugGeo = new THREE.BoxGeometry(4.2, 0.02, 3.2)
    const centerRug = new THREE.Mesh(centerRugGeo, rugMat)
    centerRug.position.set(0.1, 0.31, 0.2)
    centerRug.receiveShadow = true
    scene.add(centerRug)

    // 床边波斯风小地毯
    const bedRugGeo = new THREE.BoxGeometry(2.0, 0.02, 1.8)
    const bedRugMat = new THREE.MeshStandardMaterial({ color: 0x835858, roughness: 0.9 })
    const bedRug = new THREE.Mesh(bedRugGeo, bedRugMat)
    bedRug.position.set(-3.2, 0.31, -0.8)
    scene.add(bedRug)

    // ── 4. 木质墙体与梁柱 ──
    // 后墙 (Z轴深处)
    const backWallGeo = new THREE.BoxGeometry(roomWidth, 3.6, 0.3)
    const backWall = new THREE.Mesh(backWallGeo, wallCreamMat)
    backWall.position.set(0, 1.8 + 0.3, -0.6 - roomDepth / 2)
    backWall.receiveShadow = true
    scene.add(backWall)

    // 左侧实木墙 (X轴负侧，带窗户立柱)
    const leftWallGeo = new THREE.BoxGeometry(0.3, 3.6, roomDepth)
    const leftWall = new THREE.Mesh(leftWallGeo, wallCreamMat)
    leftWall.position.set(-roomWidth / 2, 1.8 + 0.3, -0.6)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    // 窗户木框与窗洞
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x483424 })
    const windowFrameGeo = new THREE.BoxGeometry(0.35, 1.8, 2.4)
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat)
    windowFrame.position.set(-roomWidth / 2, 2.2, -1.8)
    scene.add(windowFrame)

    // 窗内玻璃微光
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccdd, transparent: true, opacity: 0.35 })
    const glassGeo = new THREE.BoxGeometry(0.05, 1.7, 2.3)
    const glass = new THREE.Mesh(glassGeo, glassMat)
    glass.position.set(-roomWidth / 2, 2.2, -1.8)
    scene.add(glass)

    // 墙上木横梁与立柱
    const beamMat = woodDarkMat
    const topBeamGeo = new THREE.BoxGeometry(roomWidth + 0.4, 0.4, 0.4)
    const topBeam = new THREE.Mesh(topBeamGeo, beamMat)
    topBeam.position.set(0, 3.8, -0.6 - roomDepth / 2 + 0.1)
    scene.add(topBeam)

    // ── 5. 门前露台与木台阶 ──
    const porchGeo = new THREE.BoxGeometry(2.4, 0.2, 1.8)
    const porch = new THREE.Mesh(porchGeo, woodFloorMat)
    porch.position.set(-2.8, 0.1, 3.2)
    scene.add(porch)

    const stepGeo = new THREE.BoxGeometry(2.2, 0.1, 0.6)
    const step = new THREE.Mesh(stepGeo, woodDarkMat)
    step.position.set(-2.8, 0.05, 4.1)
    scene.add(step)

    // ── 6. 家具：工作电脑桌 ──
    const deskGroup = new THREE.Group()
    deskGroup.position.set(-2.8, 0.3, -3.2)

    // 桌面与桌腿
    const tableTopGeo = new THREE.BoxGeometry(2.4, 0.1, 1.2)
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x7a5332, roughness: 0.6 })
    const tableTop = new THREE.Mesh(tableTopGeo, deskMat)
    tableTop.position.y = 0.8
    tableTop.castShadow = true
    deskGroup.add(tableTop)

    const deskLegGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1)
    const leg1 = new THREE.Mesh(deskLegGeo, woodDarkMat)
    leg1.position.set(-1.0, 0.4, -0.45)
    const leg2 = leg1.clone()
    leg2.position.set(1.0, 0.4, -0.45)
    const leg3 = leg1.clone()
    leg3.position.set(-1.0, 0.4, 0.45)
    const leg4 = leg1.clone()
    leg4.position.set(1.0, 0.4, 0.45)
    deskGroup.add(leg1, leg2, leg3, leg4)

    // 电脑显示器
    const monitorBaseGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16)
    const monitorMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.3 })
    const monitorBase = new THREE.Mesh(monitorBaseGeo, monitorMat)
    monitorBase.position.set(0, 0.87, -0.15)

    const monitorStandGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06)
    const monitorStand = new THREE.Mesh(monitorStandGeo, monitorMat)
    monitorStand.position.set(0, 1.0, -0.15)

    const monitorScreenGeo = new THREE.BoxGeometry(0.95, 0.58, 0.04)
    const monitorScreen = new THREE.Mesh(monitorScreenGeo, monitorMat)
    monitorScreen.position.set(0, 1.25, -0.13)

    // 发光屏幕面
    const screenFaceGeo = new THREE.PlaneGeometry(0.88, 0.52)
    const screenFaceMat = new THREE.MeshBasicMaterial({ color: 0x54a0ff })
    const screenFace = new THREE.Mesh(screenFaceGeo, screenFaceMat)
    screenFace.position.set(0, 1.25, -0.108)
    deskGroup.add(monitorBase, monitorStand, monitorScreen, screenFace)

    // 键盘与鼠标
    const kbGeo = new THREE.BoxGeometry(0.48, 0.02, 0.18)
    const kbMat = new THREE.MeshStandardMaterial({ color: 0xdddddd })
    const kb = new THREE.Mesh(kbGeo, kbMat)
    kb.position.set(0, 0.86, 0.15)
    deskGroup.add(kb)

    // 咖啡马克杯
    const mugGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12)
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xee5253 })
    const mug = new THREE.Mesh(mugGeo, mugMat)
    mug.position.set(0.65, 0.92, 0.1)
    deskGroup.add(mug)

    // 办公转椅
    const chairSeatGeo = new THREE.BoxGeometry(0.55, 0.08, 0.55)
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e3799 })
    const chairSeat = new THREE.Mesh(chairSeatGeo, chairMat)
    chairSeat.position.set(0, 0.55, 0.75)
    const chairBackGeo = new THREE.BoxGeometry(0.55, 0.6, 0.08)
    const chairBack = new THREE.Mesh(chairBackGeo, chairMat)
    chairBack.position.set(0, 0.88, 1.0)
    deskGroup.add(chairSeat, chairBack)

    scene.add(deskGroup)

    // ── 7. 家具：大型沉思书架 ──
    const shelfGroup = new THREE.Group()
    shelfGroup.position.set(0.5, 0.3, -3.7)

    const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x543825, roughness: 0.7 })
    const shelfBackGeo = new THREE.BoxGeometry(2.0, 2.8, 0.1)
    const shelfBack = new THREE.Mesh(shelfBackGeo, shelfFrameMat)
    shelfBack.position.set(0, 1.4, -0.3)
    shelfGroup.add(shelfBack)

    // 书架层板
    for (let y = 0.2; y <= 2.8; y += 0.65) {
      const plankGeo = new THREE.BoxGeometry(2.0, 0.06, 0.6)
      const plank = new THREE.Mesh(plankGeo, shelfFrameMat)
      plank.position.set(0, y, 0)
      shelfGroup.add(plank)
    }

    // 五颜六色的图书模型
    const bookColors = [0xb33939, 0x218c74, 0xcd6133, 0x227093, 0x474787, 0xaaa69d]
    for (let row = 0; row < 4; row++) {
      const y = 0.2 + row * 0.65 + 0.16
      for (let b = -0.8; b < 0.8; b += 0.12) {
        const bookGeo = new THREE.BoxGeometry(0.08, 0.28 + Math.random() * 0.1, 0.35)
        const bookMat = new THREE.MeshStandardMaterial({
          color: bookColors[Math.floor(Math.random() * bookColors.length)],
          roughness: 0.6,
        })
        const book = new THREE.Mesh(bookGeo, bookMat)
        book.position.set(b, y, 0)
        book.rotation.y = (Math.random() - 0.5) * 0.1
        shelfGroup.add(book)
      }
    }
    scene.add(shelfGroup)

    // ── 8. 告示板 (Latest Updates) ──
    const boardGroup = new THREE.Group()
    boardGroup.position.set(2.6, 2.0, -3.9)

    const boardFrameGeo = new THREE.BoxGeometry(1.8, 1.3, 0.06)
    const boardFrameMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2d })
    const boardFrame = new THREE.Mesh(boardFrameGeo, boardFrameMat)

    const corkGeo = new THREE.BoxGeometry(1.68, 1.18, 0.07)
    const corkMat = new THREE.MeshStandardMaterial({ color: 0xb58a63, roughness: 0.9 })
    const cork = new THREE.Mesh(corkGeo, corkMat)
    boardGroup.add(boardFrame, cork)

    // 告示板上的便利贴
    const noteMat1 = new THREE.MeshStandardMaterial({ color: 0xfffa65 })
    const note1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.08), noteMat1)
    note1.position.set(-0.45, 0.15, 0.01)
    note1.rotation.z = 0.05

    const noteMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff })
    const note2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.08), noteMat2)
    note2.position.set(0.3, -0.05, 0.01)
    note2.rotation.z = -0.03
    boardGroup.add(note1, note2)
    scene.add(boardGroup)

    // ── 9. 玻璃展柜 (Discovered Content) ──
    const cabinetGroup = new THREE.Group()
    cabinetGroup.position.set(4.0, 0.3, -2.6)

    const cabBaseGeo = new THREE.BoxGeometry(1.0, 2.6, 0.8)
    const cabBaseMat = new THREE.MeshStandardMaterial({ color: 0x472f1e })
    const cabFrame = new THREE.Mesh(cabBaseGeo, cabBaseMat)
    cabFrame.position.y = 1.3

    // 内部发光水晶
    const innerCrystalGeo = new THREE.OctahedronGeometry(0.2, 0)
    const innerCrystal = new THREE.Mesh(innerCrystalGeo, crystalMat)
    innerCrystal.position.set(0, 1.4, 0)
    cabinetGroup.add(cabFrame, innerCrystal)
    scene.add(cabinetGroup)

    // ── 10. 中央大木桌与展开的地图 ──
    const tableGroup = new THREE.Group()
    tableGroup.position.set(0.1, 0.3, 0.2)

    const diningTopGeo = new THREE.BoxGeometry(2.6, 0.12, 1.6)
    const diningMat = new THREE.MeshStandardMaterial({ color: 0x6e4e37, roughness: 0.6 })
    const diningTop = new THREE.Mesh(diningTopGeo, diningMat)
    diningTop.position.y = 0.7
    diningTop.castShadow = true
    diningTop.receiveShadow = true
    tableGroup.add(diningTop)

    // 桌腿
    for (let lx of [-1.1, 1.1]) {
      for (let lz of [-0.65, 0.65]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), woodDarkMat)
        leg.position.set(lx, 0.35, lz)
        leg.castShadow = true
        tableGroup.add(leg)
      }
    }

    // 羊皮纸地图
    const mapMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.8 })
    const mapGeo = new THREE.BoxGeometry(1.4, 0.02, 1.0)
    const mapMesh = new THREE.Mesh(mapGeo, mapMat)
    mapMesh.position.set(0, 0.77, 0)
    mapMesh.rotation.y = 0.05
    tableGroup.add(mapMesh)

    // 地图上的微型 3D 小山包（增加手作感趣味）
    const miniMtGeo = new THREE.ConeGeometry(0.12, 0.16, 5)
    const miniMtMat = new THREE.MeshStandardMaterial({ color: 0x747d8c })
    const miniMt = new THREE.Mesh(miniMtGeo, miniMtMat)
    miniMt.position.set(0.35, 0.86, -0.15)
    tableGroup.add(miniMt)

    // 桌边小木凳
    for (let sx of [-0.6, 0.6]) {
      const stool = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), woodDarkMat)
      stool.position.set(sx, 0.2, 1.15)
      stool.castShadow = true
      tableGroup.add(stool)
    }
    scene.add(tableGroup)

    // ── 11. 舒适大床（左侧） ──
    const bedGroup = new THREE.Group()
    bedGroup.position.set(-3.6, 0.3, -0.6)

    const bedBaseGeo = new THREE.BoxGeometry(1.6, 0.45, 2.4)
    const bedBaseMat = new THREE.MeshStandardMaterial({ color: 0x483424 })
    const bedBase = new THREE.Mesh(bedBaseGeo, bedBaseMat)
    bedBase.position.y = 0.22

    // 床垫与被单
    const mattressGeo = new THREE.BoxGeometry(1.5, 0.25, 2.3)
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0x3d6b52, roughness: 0.8 }) // 墨绿羊毛毯
    const mattress = new THREE.Mesh(mattressGeo, mattressMat)
    mattress.position.y = 0.45

    // 枕头
    const pillowGeo = new THREE.BoxGeometry(1.2, 0.14, 0.5)
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa })
    const pillow = new THREE.Mesh(pillowGeo, pillowMat)
    pillow.position.set(0, 0.6, -0.8)

    // 睡觉的小橙猫
    const catBodyGeo = new THREE.SphereGeometry(0.16, 12, 12)
    const catMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.9 })
    const cat = new THREE.Mesh(catBodyGeo, catMat)
    cat.scale.set(1.4, 0.8, 1.0)
    cat.position.set(-0.1, 0.65, 0.1)

    bedGroup.add(bedBase, mattress, pillow, cat)
    scene.add(bedGroup)

    // ── 12. 室外场景：松树、石阶小径与发光遗物 ──
    // 户外松树群（低模圆锥树）
    createPineTree(-6.5, 0, -2.5, 1.3)
    createPineTree(-6.0, 0, 1.5, 1.0)
    createPineTree(-5.5, 0, 5.5, 1.4)
    createPineTree(5.5, 0, 4.5, 1.2)
    createPineTree(6.8, 0, 1.5, 1.5)

    // 室外石径（灰色踏脚石）
    const stonePositions = [
      [-2.8, 4.8],
      [-2.5, 5.6],
      [-2.0, 6.4],
      [-1.4, 7.2],
    ]
    for (const [sx, sz] of stonePositions) {
      const stoneGeo = new THREE.CylinderGeometry(0.35 + Math.random() * 0.1, 0.4, 0.08, 7)
      const stone = new THREE.Mesh(stoneGeo, stoneMat)
      stone.position.set(sx, 0.04, sz)
      stone.rotation.y = Math.random() * Math.PI
      stone.receiveShadow = true
      scene.add(stone)
    }

    // 路标立牌
    const signGroup = new THREE.Group()
    signGroup.position.set(-3.8, 0.1, 3.4)
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), woodDarkMat)
    signPole.position.y = 0.6
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.06), woodFloorMat)
    signBoard.position.set(0.3, 1.0, 0)
    signBoard.rotation.z = -0.05
    signGroup.add(signPole, signBoard)
    scene.add(signGroup)

    // 悬浮旋转的发光宝藏/数据水晶（神秘拾取物）
    const crystalGeo = new THREE.OctahedronGeometry(0.24, 0)
    const outdoorCrystal = new THREE.Mesh(crystalGeo, crystalMat)
    outdoorCrystal.name = 'floatingCrystal'
    outdoorCrystal.position.set(-3.2, 0.4, 4.5)
    scene.add(outdoorCrystal)
  }

  // 生成低模松树
  function createPineTree(x: number, y: number, z: number, scale = 1) {
    if (!scene) return
    const treeGroup = new THREE.Group()
    treeGroup.position.set(x, y, z)
    treeGroup.scale.set(scale, scale, scale)

    // 树干
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), trunkMat)
    trunk.position.y = 0.6
    trunk.castShadow = true
    treeGroup.add(trunk)

    // 三层树冠
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x244f26, roughness: 0.8 })
    const tiers = [
      { y: 1.4, r: 1.2, h: 1.2 },
      { y: 2.1, r: 0.9, h: 1.1 },
      { y: 2.8, r: 0.6, h: 0.9 },
    ]
    for (const t of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), leavesMat)
      cone.position.y = t.y
      cone.castShadow = true
      treeGroup.add(cone)
    }
    scene.add(treeGroup)
  }

  // 构建可爱低模主角（参考图：红帽子、深色夹克、背包、小人比例）
  function buildPlayer() {
    if (!scene) return

    playerGroup = new THREE.Group()
    playerGroup.position.copy(playerPos)

    // 1. 身体（圆柱形夹克外套）
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.6 })
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.5, 12)
    playerBody = new THREE.Mesh(bodyGeo, bodyMat)
    playerBody.position.y = 0.5
    playerBody.castShadow = true
    playerGroup.add(playerBody)

    // 2. 头部（圆球皮肤肤色）
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd3b6, roughness: 0.5 })
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16)
    playerHead = new THREE.Mesh(headGeo, headMat)
    playerHead.position.y = 0.9
    playerHead.castShadow = true
    playerGroup.add(playerHead)

    // 3. 红色针织冷帽（Beanie）
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xc23616, roughness: 0.7 })
    const hatGeo = new THREE.SphereGeometry(0.26, 16, 12)
    const hat = new THREE.Mesh(hatGeo, hatMat)
    hat.position.set(0, 0.98, -0.02)
    hat.scale.set(1.0, 0.85, 1.0)
    playerGroup.add(hat)

    // 4. 背包
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.8 })
    const bagGeo = new THREE.BoxGeometry(0.26, 0.35, 0.18)
    playerBackpack = new THREE.Mesh(bagGeo, bagMat)
    playerBackpack.position.set(0, 0.55, -0.22)
    playerBackpack.castShadow = true
    playerGroup.add(playerBackpack)

    // 5. 柔和圆形脚下投影
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
    })
    const shadowGeo = new THREE.CircleGeometry(0.35, 16)
    playerShadow = new THREE.Mesh(shadowGeo, shadowMat)
    playerShadow.rotation.x = -Math.PI / 2
    playerShadow.position.y = 0.02
    playerGroup.add(playerShadow)

    scene.add(playerGroup)
  }

  // 键盘与移动控制
  function onKeyDown(e: KeyboardEvent) {
    // 若当前正在阅读抽屉模态框，按 ESC 关闭
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

  // 按 E 交互逻辑
  function handleInteract() {
    if (!nearbyItem.value) return

    const item = nearbyItem.value
    if (item.drawerType === 'crystal') {
      // 拾取隐藏数据遗物
      store.discoverItem({
        id: 'artifact-crystal',
        title: '微光数据水晶 #004',
        category: '野外遗物',
        desc: '在门外林地石径旁拾得的未受损存储介质，闪烁着温润的脉冲光。',
      })
    } else {
      // 唤起对应 2D 抽屉页面
      store.openDrawer(item.drawerType)
    }
  }

  // 鼠标拖拽微调视角
  function onMouseDown(e: MouseEvent) {
    // 右键或特定按键允许微调角度
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

  // 物理碰撞与位移步进
  function updatePlayer(delta: number) {
    if (!playerGroup) return

    // 斜俯视视角的位移映射：W=西北, S=东南, A=西南, D=东北
    // 我们将世界轴转换为符合 45 度等轴测屏幕朝向的移动方向
    const moveDir = new THREE.Vector3(0, 0, 0)
    if (keys.w) {
      moveDir.x -= 1
      moveDir.z -= 1
    }
    if (keys.s) {
      moveDir.x += 1
      moveDir.z += 1
    }
    if (keys.a) {
      moveDir.x -= 1
      moveDir.z += 1
    }
    if (keys.d) {
      moveDir.x += 1
      moveDir.z -= 1
    }

    isMoving = moveDir.lengthSq() > 0.001

    if (isMoving) {
      moveDir.normalize()
      const speed = 4.2
      playerVelocity.copy(moveDir).multiplyScalar(speed)

      // 目标旋转朝向
      const targetAngle = Math.atan2(moveDir.x, moveDir.z)
      // 平滑旋转插值
      let diff = targetAngle - playerRotation
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      playerRotation += diff * 0.25
      playerGroup.rotation.y = playerRotation

      // 行走起伏摆动动画
      walkCycle += delta * 12
      if (playerBody) playerBody.position.y = 0.5 + Math.sin(walkCycle) * 0.04
      if (playerHead) playerHead.position.y = 0.9 + Math.sin(walkCycle) * 0.04
      if (playerBackpack) playerBackpack.rotation.z = Math.sin(walkCycle * 0.5) * 0.08
    } else {
      playerVelocity.set(0, 0, 0)
      // 原地呼吸微动
      walkCycle += delta * 2.5
      if (playerBody) playerBody.position.y = 0.5 + Math.sin(walkCycle) * 0.015
      if (playerHead) playerHead.position.y = 0.9 + Math.sin(walkCycle) * 0.015
    }

    // 碰撞检测与位置更新
    const nextX = playerPos.x + playerVelocity.x * delta
    const nextZ = playerPos.z + playerVelocity.z * delta

    // 分轴碰撞判定，使角色在遇到桌子边缘时可以丝滑贴墙滑动
    if (!checkCollision(nextX, playerPos.z)) {
      playerPos.x = nextX
    }
    if (!checkCollision(playerPos.x, nextZ)) {
      playerPos.z = nextZ
    }

    // 楼梯/高度适配（从室内走出露台台阶的自然高度平滑过渡）
    if (playerPos.z > 2.5) {
      const targetY = Math.max(0.1, 0.45 - (playerPos.z - 2.5) * 0.18)
      playerPos.y += (targetY - playerPos.y) * 0.2
    } else {
      playerPos.y += (0.45 - playerPos.y) * 0.2
    }

    playerGroup.position.copy(playerPos)
  }

  // 检测碰撞
  function checkCollision(x: number, z: number): boolean {
    const playerRadius = 0.26

    // 总体活动边界范围（小木屋 + 门外前院）
    if (x < -6.5 || x > 5.5 || z < -4.6 || z > 7.5) {
      return true
    }

    // 遍历家具包围盒
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

  // 渲染循环中更新交互状态与世界坐标映射
  function updateInteractiveItemsState() {
    if (!camera || !containerRef.value) return

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    let closest: InteractiveItem | null = null
    let minDistance = 999

    const updatedList: InteractiveItem[] = []

    for (const item of interactablesData) {
      // 采用水平面欧几里得距离，避免高处物品（如书架顶层、墙面挂板）因高度差影响交互判定
      const dist = Math.hypot(playerPos.x - item.pos.x, playerPos.z - item.pos.z)
      const isNear = dist < 2.4

      // 将 3D 提示框坐标投影到屏幕空间像素/百分比
      const projected = item.promptPos.clone().project(camera)
      const screenX = (projected.x * 0.5 + 0.5) * width
      const screenY = (-(projected.y * 0.5) + 0.5) * height

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

  // 动画主循环
  let lastTime = performance.now()
  function animate() {
    animFrameId = requestAnimationFrame(animate)

    const now = performance.now()
    const delta = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    // 1. 更新主角位移与碰撞
    updatePlayer(delta)

    // 2. 旋转场景中的漂浮水晶
    const crystal = scene?.getObjectByName('floatingCrystal')
    if (crystal) {
      crystal.rotation.y += delta * 1.5
      crystal.position.y = 0.4 + Math.sin(now * 0.003) * 0.08
    }

    // 3. 相机平滑跟随主角 (阻尼跟随 Lerp)
    cameraTarget.lerp(new THREE.Vector3(playerPos.x, 1.2, playerPos.z), 0.08)

    // 计算旋转偏移
    const currentOffset = cameraOffset.clone()
    currentOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraExtraAngleX)

    if (camera) {
      camera.position.copy(cameraTarget).add(currentOffset)
      camera.position.y += cameraExtraAngleY * 10
      camera.lookAt(cameraTarget)
    }

    // 4. 更新 3D 锚点到 2D 屏幕投影
    updateInteractiveItemsState()

    // 5. 渲染当前帧
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
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

  function cleanup() {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId)

    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    if (containerRef.value) {
      containerRef.value.removeEventListener('mousedown', onMouseDown)
    }
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)

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
  }
}
