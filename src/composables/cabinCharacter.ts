import * as THREE from 'three'
import { createBackpackPatchTexture } from './cabinTextures'

export interface CabinCharacterController {
  group: THREE.Group
  update: (delta: number, isMoving: boolean) => void
}

/**
 * 1:1 纯手工高精度打造设计图中的红便帽探险少年
 * （标志性折边红便帽、蓬松栗色卷发、白衬衫领、灰蓝工装夹克、松树刺绣双肩包、工装长裤与登山靴）
 */
export function createCabinCharacter(): CabinCharacterController {
  const group = new THREE.Group()

  // ── 材质库 ──
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffd8be,
    roughness: 0.55,
    metalness: 0.0,
  })

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x362217, // 深栗巧克力色自然发色
    roughness: 0.75,
    metalness: 0.05,
  })

  const redBeanieMat = new THREE.MeshStandardMaterial({
    color: 0xb52424, // 温暖醇厚的红毛线便帽
    roughness: 0.7,
    metalness: 0.05,
  })

  const beanieCuffMat = new THREE.MeshStandardMaterial({
    color: 0x931b1b, // 折边卷边更具织物凹凸立体感
    roughness: 0.8,
  })

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x416982, // 经典水洗工装蓝夹克
    roughness: 0.65,
  })

  const jacketLapelMat = new THREE.MeshStandardMaterial({
    color: 0x33556b, // 夹克翻领与袖口压边
    roughness: 0.7,
  })

  const whiteShirtMat = new THREE.MeshStandardMaterial({
    color: 0xfbfbfd,
    roughness: 0.6,
  })

  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x243242, // 深深藏青工装长裤
    roughness: 0.75,
  })

  const bootsMat = new THREE.MeshStandardMaterial({
    color: 0x583a24, // 暖棕皮质工装靴
    roughness: 0.45,
    metalness: 0.1,
  })

  const bootsSoleMat = new THREE.MeshStandardMaterial({
    color: 0x1b1511, // 黑色深齿橡胶防滑厚底
    roughness: 0.9,
  })

  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0x885834, // 帆布双肩探险包
    roughness: 0.7,
  })

  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x53331b,
    roughness: 0.6,
  })

  const brassBuckleMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.35,
    metalness: 0.8,
  })

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x161c22 })
  const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff6b81,
    transparent: true,
    opacity: 0.5,
  })

  // 身体层级根节点（用于动画上下起伏与颠簸）
  const bodyRoot = new THREE.Group()
  bodyRoot.position.y = 0.5
  group.add(bodyRoot)

  // ── 1. 躯干与灰蓝工装夹克 ──
  const torso = new THREE.Group()
  bodyRoot.add(torso)

  // 蓝色夹克主体（圆润工装上身）
  const jacketGeo = new THREE.CylinderGeometry(0.23, 0.25, 0.46, 18)
  const jacketMesh = new THREE.Mesh(jacketGeo, jacketMat)
  jacketMesh.castShadow = true
  jacketMesh.position.y = 0.23
  torso.add(jacketMesh)

  // 夹克底部下摆收边
  const hemGeo = new THREE.TorusGeometry(0.245, 0.025, 10, 24)
  const hemMesh = new THREE.Mesh(hemGeo, jacketLapelMat)
  hemMesh.rotation.x = Math.PI / 2
  hemMesh.position.y = 0.02
  torso.add(hemMesh)

  // 领口露出的白色衬衫立领
  const innerCollarGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.09, 16)
  const innerCollar = new THREE.Mesh(innerCollarGeo, whiteShirtMat)
  innerCollar.position.y = 0.44
  torso.add(innerCollar)

  // 夹克门襟立领与胸前纽扣
  const flapGeo = new THREE.BoxGeometry(0.06, 0.38, 0.03)
  const flapMesh = new THREE.Mesh(flapGeo, jacketLapelMat)
  flapMesh.position.set(0, 0.23, 0.24)
  torso.add(flapMesh)

  // 黄铜胸前纽扣
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8), brassBuckleMat)
    btn.rotation.x = Math.PI / 2
    btn.position.set(0, 0.14 + i * 0.1, 0.255)
    torso.add(btn)
  }

  // 夹克双肩背包带
  const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.035), strapMat)
  leftStrap.position.set(-0.13, 0.24, 0.13)
  const rightStrap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.035), strapMat)
  rightStrap.position.set(0.13, 0.24, 0.13)
  torso.add(leftStrap, rightStrap)

  // ── 2. 背后的双肩帆布探险背包（带圆形松树徽标 🌲） ──
  const backpackGroup = new THREE.Group()
  backpackGroup.position.set(0, 0.25, -0.22)
  torso.add(backpackGroup)

  // 主包身
  const packMainGeo = new THREE.BoxGeometry(0.3, 0.35, 0.19)
  const packMain = new THREE.Mesh(packMainGeo, backpackMat)
  packMain.castShadow = true
  backpackGroup.add(packMain)

  // 顶部包盖
  const packFlapGeo = new THREE.BoxGeometry(0.32, 0.11, 0.21)
  const packFlap = new THREE.Mesh(packFlapGeo, strapMat)
  packFlap.position.set(0, 0.17, 0)
  backpackGroup.add(packFlap)

  // 背包侧袋（插着卷起的小探险地图）
  const sidePouch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12), whiteShirtMat)
  sidePouch.position.set(0.17, -0.04, 0)
  sidePouch.rotation.z = 0.15
  backpackGroup.add(sidePouch)

  // 背包正后方标志性圆形松树刺绣布章 🌲
  const patchTex = createBackpackPatchTexture()
  const patchMat = new THREE.MeshStandardMaterial({
    map: patchTex,
    roughness: 0.8,
  })
  const patchMesh = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), patchMat)
  patchMesh.rotation.y = Math.PI // 准确面向正背后
  patchMesh.position.set(0, 0.0, -0.098)
  backpackGroup.add(patchMesh)

  // ── 3. 头部、蓬松发型与标志性红便帽 ──
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 0.49, 0)
  torso.add(headGroup)

  // 头部肉乎乎的小圆脸
  const headGeo = new THREE.SphereGeometry(0.245, 24, 24)
  const headMesh = new THREE.Mesh(headGeo, skinMat)
  headMesh.castShadow = true
  headGroup.add(headMesh)

  // 萌系高光大眼睛（灵动活泼）
  const leftEyeGroup = new THREE.Group()
  leftEyeGroup.position.set(-0.085, 0.02, 0.225)
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), eyeMat)
  const leftSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeHighlightMat)
  leftSparkle.position.set(0.012, 0.012, 0.025)
  leftEyeGroup.add(leftPupil, leftSparkle)

  const rightEyeGroup = new THREE.Group()
  rightEyeGroup.position.set(0.085, 0.02, 0.225)
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), eyeMat)
  const rightSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeHighlightMat)
  rightSparkle.position.set(0.012, 0.012, 0.025)
  rightEyeGroup.add(rightPupil, rightSparkle)
  headGroup.add(leftEyeGroup, rightEyeGroup)

  // 俏皮腮红
  const leftBlush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), blushMat)
  leftBlush.position.set(-0.135, -0.045, 0.215)
  const rightBlush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), blushMat)
  rightBlush.position.set(0.135, -0.045, 0.215)
  headGroup.add(leftBlush, rightBlush)

  // 蓬松有型的栗色卷刘海与两鬓（多缕几何发块交错）
  const hairGroup = new THREE.Group()
  headGroup.add(hairGroup)

  // 前额主刘海
  const bangMain = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.12), hairMat)
  bangMain.position.set(0, 0.14, 0.18)
  bangMain.rotation.x = -0.25
  hairGroup.add(bangMain)

  // 额前微翘小碎发
  const curl1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), hairMat)
  curl1.position.set(-0.08, 0.13, 0.21)
  const curl2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), hairMat)
  curl2.position.set(0.07, 0.14, 0.2)
  hairGroup.add(curl1, curl2)

  // 两侧耳畔自然鬓发
  const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.2), hairMat)
  leftSide.position.set(-0.215, -0.01, 0.05)
  leftSide.rotation.z = 0.1
  const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.2), hairMat)
  rightSide.position.set(0.215, -0.01, 0.05)
  rightSide.rotation.z = -0.1
  hairGroup.add(leftSide, rightSide)

  // 脑后蓬松发尾
  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.12), hairMat)
  backHair.position.set(0, -0.05, -0.19)
  hairGroup.add(backHair)

  // 标志性红色针织便帽（Red Beanie）
  const beanieGroup = new THREE.Group()
  beanieGroup.position.set(0, 0.09, -0.03)
  beanieGroup.rotation.x = -0.18 // 向后微仰，露出萌系刘海与眼神
  headGroup.add(beanieGroup)

  // 便帽厚厚的卷边环（Torus）
  const beanieCuffGeo = new THREE.TorusGeometry(0.24, 0.055, 14, 28)
  const beanieCuff = new THREE.Mesh(beanieCuffGeo, beanieCuffMat)
  beanieCuff.rotation.x = Math.PI / 2
  beanieGroup.add(beanieCuff)

  // 便帽圆润饱满的帽冠
  const beanieDomeGeo = new THREE.SphereGeometry(0.255, 24, 20)
  const beanieDome = new THREE.Mesh(beanieDomeGeo, redBeanieMat)
  beanieDome.scale.set(1.0, 0.92, 1.06)
  beanieDome.position.set(0, 0.09, -0.02)
  beanieDome.castShadow = true
  beanieGroup.add(beanieDome)

  // 便帽顶端微翘褶皱收口
  const beanieTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), redBeanieMat)
  beanieTip.position.set(0, 0.32, -0.04)
  beanieGroup.add(beanieTip)

  // ── 4. 手臂与手部（带袖口卷边） ──
  const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.34, 14)
  const handGeo = new THREE.SphereGeometry(0.065, 12, 12)
  const cuffGeo = new THREE.TorusGeometry(0.07, 0.02, 8, 16)

  // 左臂
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.28, 0.37, 0)
  const leftArmMesh = new THREE.Mesh(armGeo, jacketMat)
  leftArmMesh.position.y = -0.17
  leftArmMesh.castShadow = true

  const leftCuff = new THREE.Mesh(cuffGeo, jacketLapelMat)
  leftCuff.rotation.x = Math.PI / 2
  leftCuff.position.y = -0.31

  const leftHand = new THREE.Mesh(handGeo, skinMat)
  leftHand.position.y = -0.37
  leftArmPivot.add(leftArmMesh, leftCuff, leftHand)
  torso.add(leftArmPivot)

  // 右臂
  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.28, 0.37, 0)
  const rightArmMesh = new THREE.Mesh(armGeo, jacketMat)
  rightArmMesh.position.y = -0.17
  rightArmMesh.castShadow = true

  const rightCuff = new THREE.Mesh(cuffGeo, jacketLapelMat)
  rightCuff.rotation.x = Math.PI / 2
  rightCuff.position.y = -0.31

  const rightHand = new THREE.Mesh(handGeo, skinMat)
  rightHand.position.y = -0.37
  rightArmPivot.add(rightArmMesh, rightCuff, rightHand)
  torso.add(rightArmPivot)

  // ── 5. 腿部与厚底真皮登山靴 ──
  const legGeo = new THREE.CylinderGeometry(0.085, 0.08, 0.35, 14)
  const bootUpperGeo = new THREE.BoxGeometry(0.14, 0.14, 0.22)
  const bootToeGeo = new THREE.SphereGeometry(0.07, 10, 10)
  const soleGeo = new THREE.BoxGeometry(0.155, 0.045, 0.25)

  // 左腿
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.12, 0.0, 0)
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat)
  leftLegMesh.position.y = -0.17
  leftLegMesh.castShadow = true

  const leftBootUpper = new THREE.Mesh(bootUpperGeo, bootsMat)
  leftBootUpper.position.set(0, -0.33, 0.02)
  leftBootUpper.castShadow = true

  const leftBootToe = new THREE.Mesh(bootToeGeo, bootsMat)
  leftBootToe.scale.set(1.0, 0.8, 1.2)
  leftBootToe.position.set(0, -0.35, 0.1)

  const leftSole = new THREE.Mesh(soleGeo, bootsSoleMat)
  leftSole.position.set(0, -0.405, 0.03)
  leftLegPivot.add(leftLegMesh, leftBootUpper, leftBootToe, leftSole)
  bodyRoot.add(leftLegPivot)

  // 右腿
  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.12, 0.0, 0)
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat)
  rightLegMesh.position.y = -0.17
  rightLegMesh.castShadow = true

  const rightBootUpper = new THREE.Mesh(bootUpperGeo, bootsMat)
  rightBootUpper.position.set(0, -0.33, 0.02)
  rightBootUpper.castShadow = true

  const rightBootToe = new THREE.Mesh(bootToeGeo, bootsMat)
  rightBootToe.scale.set(1.0, 0.8, 1.2)
  rightBootToe.position.set(0, -0.35, 0.1)

  const rightSole = new THREE.Mesh(soleGeo, bootsSoleMat)
  rightSole.position.set(0, -0.405, 0.03)
  rightLegPivot.add(rightLegMesh, rightBootUpper, rightBootToe, rightSole)
  bodyRoot.add(rightLegPivot)

  // ── 6. 角色脚底柔和贴地环境光阴影 ──
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x120c08,
    transparent: true,
    opacity: 0.35,
  })
  const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), shadowMat)
  shadowMesh.rotation.x = -Math.PI / 2
  shadowMesh.position.y = 0.02
  group.add(shadowMesh)

  // 动画步态状态
  let animTime = 0

  function update(delta: number, isMoving: boolean) {
    animTime += delta

    if (isMoving) {
      // 移动状态：自然流畅的徒步步态动画 (6.5Hz 步频)
      const walkSpeed = 11.5
      const stepAngle = Math.sin(animTime * walkSpeed) * 0.75

      // 腿部前后交替大幅度摆动迈步
      leftLegPivot.rotation.x = stepAngle
      rightLegPivot.rotation.x = -stepAngle

      // 双臂反向协调摆动
      leftArmPivot.rotation.x = -stepAngle * 0.8
      rightArmPivot.rotation.x = stepAngle * 0.8

      // 躯干与头部随着脚步轻快跳跃颠簸
      bodyRoot.position.y = 0.5 + Math.abs(Math.sin(animTime * walkSpeed)) * 0.065
      torso.rotation.z = Math.sin(animTime * walkSpeed * 0.5) * 0.05
      headGroup.rotation.y = Math.sin(animTime * walkSpeed * 0.5) * 0.06

      // 背包因运动产生微弱的惯性颠簸
      backpackGroup.rotation.x = Math.abs(Math.sin(animTime * walkSpeed)) * 0.05
    } else {
      // 待机呼吸状态：平缓温馨的微动 (2.2Hz)
      const breathe = Math.sin(animTime * 2.2)

      // 腿部复位站立
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.15)
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.15)

      // 双臂微微张开自然放松
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, 0.06 + breathe * 0.03, 0.1)
      rightArmPivot.rotation.x = THREE.MathUtils.lerp(rightArmPivot.rotation.x, 0.06 + breathe * 0.03, 0.1)
      leftArmPivot.rotation.z = THREE.MathUtils.lerp(leftArmPivot.rotation.z, 0.1, 0.1)
      rightArmPivot.rotation.z = THREE.MathUtils.lerp(rightArmPivot.rotation.z, -0.1, 0.1)

      // 呼吸起伏
      bodyRoot.position.y = 0.5 + breathe * 0.015
      torso.rotation.z = 0
      headGroup.rotation.y = Math.sin(animTime * 0.8) * 0.04
      backpackGroup.rotation.x = 0
    }
  }

  return {
    group,
    update,
  }
}
