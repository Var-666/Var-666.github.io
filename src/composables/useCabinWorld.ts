import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { useCabinStore, type DrawerType } from './useCabinStore'
import {
  createWoodFloorTexture,
  createTapestryTexture,
  createScreenWallpaperTexture,
  createBulletinBoardTexture,
  createAdventureMapTexture,
  createGreenRugTexture,
  createBurgundyRugTexture,
  createRetainingWallTexture,
  createSignpostTexture,
} from './cabinTextures'
import { createCabinCharacter, type CabinCharacterController } from './cabinCharacter'

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

// 预分配全局静态向量（零 GC 内存垃圾）
const _tempMoveDir = new THREE.Vector3()
const _tempCamTarget = new THREE.Vector3()
const _tempOffset = new THREE.Vector3()
const _upVec = new THREE.Vector3(0, 1, 0)
const _projectedVec = new THREE.Vector3()

export function useCabinWorld(containerRef: Ref<HTMLElement | null>) {
  const store = useCabinStore()

  // 反应式状态暴露给 UI 模板
  const interactiveItems = ref<InteractiveItem[]>([])
  const nearbyItem = ref<InteractiveItem | null>(null)
  const isLoaded = ref(false)

  // 触摸与移动端虚拟摇杆输入向量
  const joystickVector = { x: 0, y: 0 }
  function setJoystickMove(x: number, y: number) {
    joystickVector.x = Math.max(-1, Math.min(1, x))
    joystickVector.y = Math.max(-1, Math.min(1, y))
  }

  // Three.js 核心对象
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null

  // 角色控制器（1:1 还原红帽探险家）
  let characterCtrl: CabinCharacterController | null = null
  const playerPos = new THREE.Vector3(-1.0, 0.45, 1.8)
  const playerVelocity = new THREE.Vector3(0, 0, 0)
  let playerRotation = Math.PI // 初始朝向面向镜头
  let isMoving = false

  // 动态生动元素句柄
  let sleepingCatMesh: THREE.Mesh | null = null
  const flickeringLights: THREE.PointLight[] = []
  let dustParticles: THREE.Points | null = null

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

  // 互动目标实体定义（1:1 对应设计图）
  const interactablesData = [
    {
      id: 'pc',
      drawerType: 'projects' as DrawerType,
      label: 'Projects',
      subLabel: '项目归档',
      icon: '💻',
      pos: new THREE.Vector3(-2.8, 1.2, -3.2),
      promptPos: new THREE.Vector3(-2.8, 2.35, -3.2),
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

    // 3. 渲染器配置（移动端降低 DPR 与阴影采样，防过热与掉电）
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

    // 4. 灯光系统（1:1 营造设计图中的暖黄灯火与室外冷月光对比）
    setupLights(isMobile)

    // 5. 建造 1:1 木屋微缩场景
    buildCabinDiorama()

    // 6. 创建 1:1 红帽探险主角
    buildPlayer()

    // 7. 初始化交互状态
    updateInteractiveItemsState(true)

    // 8. 事件监听（包含鼠标、键盘与触控）
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

    // 9. 按需启动可见性监听与帧循环
    setupVisibilityListeners()
  }

  // 灯光系统配置
  function setupLights(isMobile = false) {
    if (!scene) return

    flickeringLights.length = 0

    // 1. 整体暖色环境漫射光
    const ambientLight = new THREE.AmbientLight(0xffedd8, 0.6)
    scene.add(ambientLight)

    // 2. 模拟室外透过树丛透射进来的清冷月光 / 晨光 (冷蓝调)
    const dirLight = new THREE.DirectionalLight(0xdcecf8, 0.8)
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
    const windowLight = new THREE.DirectionalLight(0x89c4f4, 0.5)
    windowLight.position.set(-8, 6, -1.8)
    windowLight.target.position.set(-2, 1, -1.8)
    scene.add(windowLight)
    scene.add(windowLight.target)

    // 4. 点光源 1：工作电脑桌暖光台灯
    const deskLamp = new THREE.PointLight(0xffa834, 2.2, 6)
    deskLamp.position.set(-2.6, 1.8, -3.1)
    deskLamp.castShadow = true
    scene.add(deskLamp)
    flickeringLights.push(deskLamp)

    // 5. 点光源 2：电脑屏幕微光
    const screenGlow = new THREE.PointLight(0x54a0ff, 1.0, 3)
    screenGlow.position.set(-2.8, 1.3, -2.8)
    scene.add(screenGlow)

    // 6. 点光源 3：床头煤油提灯
    const bedLantern = new THREE.PointLight(0xff9f43, 1.8, 5)
    bedLantern.position.set(-4.1, 1.1, 0.3)
    scene.add(bedLantern)
    flickeringLights.push(bedLantern)

    // 7. 点光源 4：中央大地图桌吊灯/煤油灯
    const tableLantern = new THREE.PointLight(0xffb84d, 2.8, 8)
    tableLantern.position.set(0.1, 2.4, 0.2)
    tableLantern.castShadow = true
    scene.add(tableLantern)
    flickeringLights.push(tableLantern)

    // 8. 点光源 5：告示板射灯
    const boardLight = new THREE.PointLight(0xffaa44, 1.8, 6)
    boardLight.position.set(2.6, 2.5, -3.2)
    scene.add(boardLight)

    // 9. 点光源 6：陈列展柜内部暖光射灯
    const cabinetLight = new THREE.PointLight(0x7bed9f, 1.5, 4)
    cabinetLight.position.set(3.9, 1.8, -2.4)
    scene.add(cabinetLight)

    // 10. 点光源 7：露台木阶煤油地灯
    const porchLantern = new THREE.PointLight(0xffa834, 2.2, 6)
    porchLantern.position.set(-3.6, 0.7, 3.4)
    scene.add(porchLantern)
    flickeringLights.push(porchLantern)
  }

  // 建造 1:1 贴合设计图的微缩木屋场景
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
      color: 0x4a3221, // 深色实木横梁立柱
      roughness: 0.75,
    })

    const woodOakMat = new THREE.MeshStandardMaterial({
      color: 0x6e4729, // 暖胡桃实木家具
      roughness: 0.7,
    })

    const wallCreamMat = new THREE.MeshStandardMaterial({
      color: 0xede5d8, // 温馨米白抹灰墙
      roughness: 0.9,
    })

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x385536, // 浓郁森林草地
      roughness: 0.85,
    })

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x828889, // 室外石阶踏脚石
      roughness: 0.75,
    })

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xdff9fb,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
    })

    const metalBrassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // 黄铜金属质感
      roughness: 0.35,
      metalness: 0.8,
    })

    // ── 1. 室外草地地形 ──
    const groundGeo = new THREE.BoxGeometry(24, 0.4, 24)
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

    // 实木角柱与顶部主横梁
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

    // ── 4. 左侧大窗户与挂毯 ──
    // 6格实木窗框
    const windowGroup = new THREE.Group()
    windowGroup.position.set(-roomWidth / 2 + 0.05, 2.3, -1.8)
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 2.2), woodDarkMat)
    const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 2.0), glassMat)
    windowGroup.add(windowFrame, windowGlass)
    scene.add(windowGroup)

    // 挂毯："Good Ideas Live Here 🌲" (1:1 贴图挂在左侧白墙)
    const tapestryTex = createTapestryTexture()
    const tapestryMat = new THREE.MeshStandardMaterial({
      map: tapestryTex,
      roughness: 0.9,
    })
    const tapestryMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), tapestryMat)
    tapestryMesh.rotation.y = Math.PI / 2
    tapestryMesh.position.set(-roomWidth / 2 + 0.15, 2.4, -3.2)
    scene.add(tapestryMesh)

    // 挂毯木挂杆与绳索
    const tapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 12), woodDarkMat)
    tapPole.rotation.x = Math.PI / 2
    tapPole.position.set(-roomWidth / 2 + 0.17, 3.32, -3.2)
    scene.add(tapPole)

    // ── 5. 前方矮围栏与题字刻板 ──
    // "🌲 Curiosity leads to cool places." 矮栅栏
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
    // 三层木质踏阶
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

    // ── 7. 卧室区（床铺、熟睡橙猫、古典波斯地毯） ──
    // 波斯地毯
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

    // 实木床榻主体
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.2), woodOakMat)
    bedFrame.position.set(-3.3, 0.52, -0.6)
    bedFrame.castShadow = true
    scene.add(bedFrame)

    // 床头板
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.15), woodDarkMat)
    headboard.position.set(-3.3, 0.95, -1.65)
    scene.add(headboard)

    // 森林绿被褥（深橄榄绿折叠被子）
    const greenQuiltMat = new THREE.MeshStandardMaterial({ color: 0x335238, roughness: 0.85 })
    const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 1.6), greenQuiltMat)
    quilt.position.set(-3.3, 0.8, -0.35)
    quilt.castShadow = true
    scene.add(quilt)

    // 翻折露出的柔软白色被边与枕头
    const whiteLinenMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.9 })
    const sheetTurn = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 0.3), whiteLinenMat)
    sheetTurn.position.set(-3.3, 0.84, -1.2)
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.45), whiteLinenMat)
    pillow.position.set(-3.3, 0.86, -1.45)
    scene.add(sheetTurn, pillow)

    // 床头小柜与煤油灯
    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), woodOakMat)
    nightstand.position.set(-4.1, 0.62, 0.3)
    scene.add(nightstand)
    createKeroseneLantern(-4.1, 0.96, 0.3, 0.85)

    // 熟睡的小橙猫（卷缩在绿被褥上，带呼吸起伏）
    buildSleepingCat(-3.15, 0.92, -0.5)

    // ── 8. 工作台区（Projects 电脑桌、山峰壁纸、办公椅、热咖啡） ──
    const deskGroup = new THREE.Group()
    deskGroup.position.set(-2.8, 0.3, -3.2)

    // 宽大实木工作桌
    const deskTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), woodOakMat)
    deskTable.position.y = 0.4
    deskTable.castShadow = true
    deskGroup.add(deskTable)

    // 显示器底座与支架
    const monitorStandMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.3, metalness: 0.5 })
    const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), monitorStandMat)
    mBase.position.set(0, 0.82, -0.15)
    const mArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), monitorStandMat)
    mArm.position.set(0, 1.0, -0.15)
    deskGroup.add(mBase, mArm)

    // 宽屏显示器黑框
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.72, 0.04), monitorStandMat)
    screenFrame.position.set(0, 1.3, -0.14)
    deskGroup.add(screenFrame)

    // 1:1 还原设计图的电脑屏幕雪山风景壁纸
    const wallpaperTex = createScreenWallpaperTexture()
    const screenMat = new THREE.MeshBasicMaterial({ map: wallpaperTex })
    const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.66), screenMat)
    screenFace.position.set(0, 1.3, -0.118)
    deskGroup.add(screenFace)

    // 键盘与鼠标
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }))
    kb.position.set(0, 0.82, 0.2)
    deskGroup.add(kb)

    // 红色陶瓷马克杯
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xc0392b }))
    mug.position.set(0.65, 0.88, 0.15)
    deskGroup.add(mug)

    // 桌面暖光台灯
    createDeskLamp(deskGroup, -0.9, 0.8, -0.2)

    // 桌面小多肉盆栽
    createTerracottaPlant(deskGroup, 0.9, 0.8, -0.2, 0.18)

    scene.add(deskGroup)

    // 电脑桌前深蓝青色滚轮转椅 (Office Chair)
    buildSwivelChair(-2.8, 0.3, -2.2)

    // ── 9. 大型藏书架区（Articles / Notes，多层图书、黄铜地球仪、垂挂绿植藤蔓） ──
    const bookcaseGroup = new THREE.Group()
    bookcaseGroup.position.set(0.5, 0.3, -3.7)

    // 书柜外框与层板
    const shelfWidth = 2.4
    const shelfHeight = 3.0
    const shelfDepth = 0.55
    const bookcaseBody = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, shelfHeight, shelfDepth), woodDarkMat)
    bookcaseBody.position.y = shelfHeight / 2
    bookcaseBody.castShadow = true
    bookcaseGroup.add(bookcaseBody)

    // 填充书架内 3 层图书
    buildBooksInShelf(bookcaseGroup)

    // 上层右侧：黄铜底座地球仪 🌍
    buildGlobe(bookcaseGroup, 0.75, 2.2, 0.05)

    // 顶层左侧：垂挂藤蔓绿植 (Trailing Ivy / Pothos)
    buildHangingIvy(bookcaseGroup, -0.9, 3.05, 0.1)

    scene.add(bookcaseGroup)

    // 书架旁的小木箱与煤油地灯
    const floorCrate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), woodOakMat)
    floorCrate.position.set(1.9, 0.5, -3.6)
    scene.add(floorCrate)
    createKeroseneLantern(1.9, 0.72, -3.6, 0.8)

    // ── 10. 告示板区（Latest Updates，软木大图版、Small Steps 标语、拍立得相片） ──
    const bulletinTex = createBulletinBoardTexture()
    const bulletinMat = new THREE.MeshStandardMaterial({
      map: bulletinTex,
      roughness: 0.85,
    })
    const bulletinBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), bulletinMat)
    bulletinBoard.position.set(2.6, 2.3, -3.85)
    scene.add(bulletinBoard)

    // 告示板下方的木质储物收纳长椅
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.65), woodOakMat)
    bench.position.set(2.6, 0.52, -3.5)
    bench.castShadow = true
    scene.add(bench)

    // ── 11. 探索陈列展柜（Discovered Content，透明玻璃展柜、发光水晶群、可爱小机器人） ──
    const cabinetGroup = new THREE.Group()
    cabinetGroup.position.set(3.9, 0.3, -2.4)
    cabinetGroup.rotation.y = -Math.PI / 2

    // 展柜木质基座与顶盖
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

    // 展柜内 2 层玻璃隔板
    const glassShelf1 = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.03, 0.6), glassMat)
    glassShelf1.position.y = 1.15
    const glassShelf2 = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.03, 0.6), glassMat)
    glassShelf2.position.y = 1.8
    cabinetGroup.add(glassShelf1, glassShelf2)

    // 展柜藏品 A：悬浮发光天蓝色多面体水晶群
    const cyanCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x00d2d3,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    })
    const crystalMesh1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), cyanCrystalMat)
    crystalMesh1.position.set(-0.35, 1.42, 0)
    crystalMesh1.name = 'cabinetCrystal'
    cabinetGroup.add(crystalMesh1)

    // 展柜藏品 B：1:1 还原设计图展柜顶层的萌系方形小机器人 🤖
    buildMiniRobot(cabinetGroup, 0.35, 1.35, 0)

    // 展柜藏品 C：琥珀金黄色数字宝藏
    const amberCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xffa502,
      emissive: 0xffa502,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    })
    const crystalMesh2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), amberCrystalMat)
    crystalMesh2.position.set(0, 2.05, 0)
    cabinetGroup.add(crystalMesh2)

    scene.add(cabinetGroup)

    // 展柜旁的落地大型虎尾兰盆栽
    createTallHousePlant(4.2, 0.3, -1.0)

    // ── 12. 中央大地图桌（Explore，展开的羊皮纸大地图、3D 微缩立体山脉、周边木凳） ──
    // 大桌下方铺垫的大型森林绿几何毛毯
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

    // 实木大工作长桌
    const mainTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.4), woodOakMat)
    mainTable.position.set(0.1, 0.68, 0.2)
    mainTable.castShadow = true
    scene.add(mainTable)

    // 桌下收纳书箱
    const underCrate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.32, 0.5), woodDarkMat)
    underCrate.position.set(0.1, 0.46, 0.2)
    scene.add(underCrate)

    // 四周 4 把质朴实木方凳
    const stoolPositions = [
      [-0.7, 0.95],
      [0.9, 0.95],
      [-0.7, -0.55],
      [0.9, -0.55],
    ]
    for (const [stX, stZ] of stoolPositions) {
      const stool = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), woodOakMat)
      stool.position.set(0.1 + stX, 0.51, 0.2 + stZ)
      stool.castShadow = true
      scene.add(stool)
    }

    // 桌面上展开的羊皮纸大地图
    const mapTex = createAdventureMapTexture()
    const mapMat = new THREE.MeshStandardMaterial({
      map: mapTex,
      roughness: 0.8,
    })
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), mapMat)
    mapMesh.rotation.x = -Math.PI / 2
    mapMesh.position.set(0.1, 1.07, 0.2)
    scene.add(mapMesh)

    // 1:1 还原设计图：从地图纸面上直接立体隆起的 3D 微缩山峰群！
    const miniMountainGroup = new THREE.Group()
    miniMountainGroup.position.set(0.35, 1.07, 0.15)

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.85 })
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })

    // 主峰
    const peak1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 5), mountainMat)
    peak1.position.set(0, 0.16, 0)
    const snow1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 5), snowCapMat)
    snow1.position.set(0, 0.26, 0)
    miniMountainGroup.add(peak1, snow1)

    // 副峰 2
    const peak2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 5), mountainMat)
    peak2.position.set(-0.16, 0.12, 0.08)
    const snow2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 5), snowCapMat)
    snow2.position.set(-0.16, 0.2, 0.08)
    miniMountainGroup.add(peak2, snow2)

    // 副峰 3
    const peak3 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 5), mountainMat)
    peak3.position.set(0.18, 0.1, -0.06)
    miniMountainGroup.add(peak3)

    scene.add(miniMountainGroup)

    // 桌上的小多肉盆与马克杯
    createTerracottaPlant(scene, -0.5, 1.07, 0.35, 0.14)
    const tableMug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xf5f6fa }))
    tableMug.position.set(-0.4, 1.14, -0.1)
    scene.add(tableMug)

    // ── 13. 室外林地、石阶小径、野花与发光遗物 ──
    // 低模圆锥松树群（层叠深翠绿）
    createPineTree(-6.8, 0, -2.8, 1.4)
    createPineTree(-6.4, 0, 1.2, 1.1)
    createPineTree(-5.8, 0, 5.8, 1.5)
    createPineTree(5.6, 0, 4.6, 1.3)
    createPineTree(7.0, 0, 1.6, 1.6)

    // 蜿蜒室外石阶（灰色自然踏脚石）
    const stonePositions = [
      [-2.8, 4.6],
      [-2.5, 5.4],
      [-2.0, 6.2],
      [-1.4, 7.0],
    ]
    for (const [sx, sz] of stonePositions) {
      const stoneGeo = new THREE.CylinderGeometry(0.38 + Math.random() * 0.1, 0.42, 0.08, 7)
      const stone = new THREE.Mesh(stoneGeo, stoneMat)
      stone.position.set(sx, 0.04, sz)
      stone.rotation.y = Math.random() * Math.PI
      stone.receiveShadow = true
      scene.add(stone)
    }

    // 草地上盛开的可爱小白雏菊群 🌼
    buildDaisyField()

    // 悬浮旋转的神秘数据水晶遗物
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

    // 悬浮空气光尘微粒
    buildAmbientDust()
  }

  // 辅助：生成 1:1 熟睡的橙白色折叠小猫 🐱
  function buildSleepingCat(x: number, y: number, z: number) {
    if (!scene) return
    const catGroup = new THREE.Group()
    catGroup.position.set(x, y, z)

    const catOrangeMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.85 })
    const catWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })

    // 卷成一团的椭圆身躯
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), catOrangeMat)
    bodyMesh.scale.set(1.4, 0.8, 1.0)
    catGroup.add(bodyMesh)
    sleepingCatMesh = bodyMesh

    // 肚皮白色斑块
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), catWhiteMat)
    belly.scale.set(1.1, 0.6, 0.9)
    belly.position.set(0, -0.04, 0.05)
    catGroup.add(belly)

    // 埋着的圆圆小猫头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), catOrangeMat)
    head.position.set(0.18, 0.02, 0.08)
    catGroup.add(head)

    // 小巧耳朵
    const earGeo = new THREE.ConeGeometry(0.04, 0.07, 4)
    const leftEar = new THREE.Mesh(earGeo, catOrangeMat)
    leftEar.position.set(0.16, 0.12, 0.12)
    leftEar.rotation.z = -0.3
    const rightEar = new THREE.Mesh(earGeo, catOrangeMat)
    rightEar.position.set(0.24, 0.11, 0.04)
    rightEar.rotation.z = -0.4
    catGroup.add(leftEar, rightEar)

    // 卷曲贴着身子的猫尾巴
    const tailGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI)
    const tail = new THREE.Mesh(tailGeo, catOrangeMat)
    tail.rotation.x = Math.PI / 2
    tail.position.set(-0.16, -0.06, 0.04)
    catGroup.add(tail)

    scene.add(catGroup)
  }

  // 辅助：生成 1:1 黄铜煤油玻璃提灯
  function createKeroseneLantern(x: number, y: number, z: number, scale = 1) {
    if (!scene) return
    const lanternGroup = new THREE.Group()
    lanternGroup.position.set(x, y, z)
    lanternGroup.scale.set(scale, scale, scale)

    const darkBrassMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, metalness: 0.8, roughness: 0.3 })
    const glowGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffecc4,
      emissive: 0xffaa33,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85,
    })

    // 底座与顶罩
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 12), darkBrassMat)
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 12), darkBrassMat)
    top.position.y = 0.28
    lanternGroup.add(base, top)

    // 提手金属圆环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 8, 16), darkBrassMat)
    ring.position.y = 0.38
    lanternGroup.add(ring)

    // 玻璃发光灯芯筒
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 12), glowGlassMat)
    glass.position.y = 0.13
    lanternGroup.add(glass)

    scene.add(lanternGroup)
  }

  // 辅助：书架填充书籍
  function buildBooksInShelf(group: THREE.Group) {
    const bookColors = [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60, 0x8e44ad, 0xd35400]
    const shelfHeights = [0.8, 1.5, 2.2]

    for (const shY of shelfHeights) {
      let curX = -0.9
      while (curX < 0.85) {
        const bWidth = 0.05 + Math.random() * 0.04
        const bHeight = 0.38 + Math.random() * 0.16
        const bDepth = 0.35
        const color = bookColors[Math.floor(Math.random() * bookColors.length)]
        const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
        const book = new THREE.Mesh(new THREE.BoxGeometry(bWidth, bHeight, bDepth), bMat)
        book.position.set(curX, shY + bHeight / 2, 0.05)
        // 偶尔有一本书斜靠着
        if (Math.random() > 0.85) {
          book.rotation.z = (Math.random() - 0.5) * 0.25
        }
        group.add(book)
        curX += bWidth + 0.015
      }
    }
  }

  // 辅助：书架上的黄铜地球仪 🌍
  function buildGlobe(group: THREE.Group, x: number, y: number, z: number) {
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 16), brassMat)
    base.position.set(x, y + 0.02, z)

    const armGeo = new THREE.TorusGeometry(0.2, 0.02, 8, 16, Math.PI)
    const arm = new THREE.Mesh(armGeo, brassMat)
    arm.position.set(x, y + 0.22, z)
    arm.rotation.z = Math.PI / 4

    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.6 })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), sphereMat)
    sphere.position.set(x, y + 0.22, z)

    group.add(base, arm, sphere)
  }

  // 辅助：垂挂绿植藤蔓 (Pothos)
  function buildHangingIvy(group: THREE.Group, x: number, y: number, z: number) {
    // 顶部花盆
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xd35400 })
    )
    pot.position.set(x, y + 0.09, z)
    group.add(pot)

    // 垂下的几簇叶片藤蔓
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 })
    for (let i = 0; i < 6; i++) {
      const vineLength = 0.5 + Math.random() * 0.7
      const leafGeo = new THREE.BoxGeometry(0.08, vineLength, 0.02)
      const vine = new THREE.Mesh(leafGeo, leafMat)
      vine.position.set(x - 0.12 + Math.random() * 0.1, y - vineLength / 2, z + 0.15)
      vine.rotation.z = (Math.random() - 0.5) * 0.2
      group.add(vine)
    }
  }

  // 辅助：展柜中的萌系方块小机器人 🤖
  function buildMiniRobot(group: THREE.Group, x: number, y: number, z: number) {
    const robotMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.4, roughness: 0.5 })
    const blueEyeMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 })

    // 机器人方头
    const rHead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), robotMat)
    rHead.position.set(x, y + 0.2, z)
    // 双眼
    const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), blueEyeMat)
    eyeL.position.set(x - 0.035, y + 0.2, z + 0.072)
    const eyeR = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), blueEyeMat)
    eyeR.position.set(x + 0.035, y + 0.2, z + 0.072)

    // 头顶天线
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), robotMat)
    antenna.position.set(x, y + 0.3, z)

    // 方形身体与短腿
    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), robotMat)
    rBody.position.set(x, y + 0.08, z)

    group.add(rHead, eyeL, eyeR, antenna, rBody)
  }

  // 辅助：电脑桌办公椅
  function buildSwivelChair(x: number, y: number, z: number) {
    if (!scene) return
    const chairGroup = new THREE.Group()
    chairGroup.position.set(x, y, z)

    const darkPlasticMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.5 })
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x2b5366, roughness: 0.8 }) // 深蓝青色座垫

    // 五星脚架与气压杆
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), darkPlasticMat)
    stem.position.y = 0.2
    chairGroup.add(stem)

    // 软包座垫
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.48), cushionMat)
    seat.position.y = 0.42
    chairGroup.add(seat)

    // 舒适靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.08), cushionMat)
    back.position.set(0, 0.72, 0.2)
    chairGroup.add(back)

    scene.add(chairGroup)
  }

  // 辅助：陶土盆多肉植物
  function createTerracottaPlant(parent: THREE.Object3D, x: number, y: number, z: number, scale = 0.2) {
    const potMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.9 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.6 })

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(scale * 0.7, scale * 0.5, scale * 0.8, 10), potMat)
    pot.position.set(x, y + scale * 0.4, z)

    const plant = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.6, 8, 8), leafMat)
    plant.position.set(x, y + scale * 0.9, z)

    parent.add(pot, plant)
  }

  // 辅助：大型室内落地虎尾兰
  function createTallHousePlant(x: number, y: number, z: number) {
    if (!scene) return
    const plantGroup = new THREE.Group()
    plantGroup.position.set(x, y, z)

    const potMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.85 })
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.5, 12), potMat)
    pot.position.y = 0.25
    plantGroup.add(pot)

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 })
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      const leafGeo = new THREE.BoxGeometry(0.1, 0.9 + Math.random() * 0.3, 0.02)
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.set(Math.cos(angle) * 0.12, 0.7, Math.sin(angle) * 0.12)
      leaf.rotation.y = angle
      leaf.rotation.z = 0.15
      plantGroup.add(leaf)
    }

    scene.add(plantGroup)
  }

  // 辅助：桌面复古台灯
  function createDeskLamp(group: THREE.Group, x: number, y: number, z: number) {
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, metalness: 0.8 })
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.9 })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 12), brassMat)
    base.position.set(x, y + 0.015, z)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), brassMat)
    arm.position.set(x, y + 0.2, z)
    arm.rotation.z = 0.2
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 12), glowMat)
    shade.position.set(x + 0.08, y + 0.38, z)
    shade.rotation.z = -0.5

    group.add(base, arm, shade)
  }

  // 辅助：生成低模松树
  function createPineTree(x: number, y: number, z: number, scale = 1) {
    if (!scene) return
    const treeGroup = new THREE.Group()
    treeGroup.position.set(x, y, z)
    treeGroup.scale.set(scale, scale, scale)

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), trunkMat)
    trunk.position.y = 0.6
    trunk.castShadow = true
    treeGroup.add(trunk)

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

  // 辅助：草地上点缀的小白雏菊群 🌼
  function buildDaisyField() {
    if (!scene) return
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.5 })

    const flowerCoords = [
      [-2.1, 4.3],
      [-2.3, 4.8],
      [-3.4, 4.9],
      [-1.8, 5.8],
      [-2.8, 6.3],
      [-1.1, 6.6],
      [-3.5, 6.0],
      [1.8, 4.5],
      [2.3, 5.2],
    ]

    for (const [fx, fz] of flowerCoords) {
      const petal = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 6), flowerMat)
      petal.position.set(fx, 0.05, fz)
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), centerMat)
      center.position.set(fx, 0.06, fz)
      scene.add(petal, center)
    }
  }

  // 辅助：环境微光悬浮尘埃粒子
  function buildAmbientDust() {
    if (!scene) return
    const count = 70
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10
      pos[i * 3 + 1] = 0.5 + Math.random() * 3.5
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pMat = new THREE.PointsMaterial({
      color: 0xffeaa7,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    })
    dustParticles = new THREE.Points(geo, pMat)
    scene.add(dustParticles)
  }

  // 构建 1:1 红帽探险小人主角
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

    // 叠加移动端虚拟摇杆输入 (Isometric 斜等轴测投影映射)
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

    // 步进角色的奔跑/呼吸双动作系统
    characterCtrl.update(delta, isMoving)

    // 碰撞检测与位置更新
    const nextX = playerPos.x + playerVelocity.x * delta
    const nextZ = playerPos.z + playerVelocity.z * delta

    if (!checkCollision(nextX, playerPos.z)) {
      playerPos.x = nextX
    }
    if (!checkCollision(playerPos.x, nextZ)) {
      playerPos.z = nextZ
    }

    // 室内与露台台阶自然高度自适应
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

  // 节流与复用更新交互物品状态（避免 60fps 频繁触发 Vue 响应式穿透）
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

  // 触屏滑动旋转视角支持
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

  // 渲染主循环控制与可见性管理
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
      sleepingCatMesh.scale.y = 0.8 + Math.sin(now * 0.003) * 0.03
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

    // 6. 相机平滑阻尼跟随主角（零 Vector3 内存分配）
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

    // 尊重减弱动效偏好：若开启则渲染一帧后休眠
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
