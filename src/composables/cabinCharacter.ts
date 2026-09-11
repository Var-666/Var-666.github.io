import * as THREE from 'three'
import { createBackpackPatchTexture } from './cabinTextures'

export interface CabinCharacterController {
  group: THREE.Group
  update: (delta: number, isMoving: boolean) => void
}

/**
 * 1:1 还原设计图的红帽探险小人（红便帽、深色卷发、蓝衬衫外套、工装长裤、登山靴与松树刺绣背包）
 */
export function createCabinCharacter(): CabinCharacterController {
  const group = new THREE.Group()

  // 材质定义
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffd3b6,
    roughness: 0.6,
  })
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x3d271d, // 深栗色头发
    roughness: 0.8,
  })
  const redBeanieMat = new THREE.MeshStandardMaterial({
    color: 0xbd2a2a, // 饱满深红便帽
    roughness: 0.7,
  })
  const beanieCuffMat = new THREE.MeshStandardMaterial({
    color: 0x9e2020, // 便帽卷边
    roughness: 0.8,
  })
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x4a738c, // 牛仔浅灰蓝工装夹克
    roughness: 0.65,
  })
  const whiteShirtMat = new THREE.MeshStandardMaterial({
    color: 0xf5f6fa,
    roughness: 0.7,
  })
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x273849, // 深蓝藏青工装裤
    roughness: 0.7,
  })
  const bootsMat = new THREE.MeshStandardMaterial({
    color: 0x543825, // 深棕皮质登山靴
    roughness: 0.5,
  })
  const bootsSoleMat = new THREE.MeshStandardMaterial({
    color: 0x221811, // 黑色橡胶厚鞋底
    roughness: 0.9,
  })
  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0x825433, // 棕褐色户外帆布包
    roughness: 0.7,
  })
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x5a3821,
    roughness: 0.6,
  })
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e272e })
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff7979,
    transparent: true,
    opacity: 0.45,
  })

  // 身体层级根节点（用于动画上下起伏）
  const bodyRoot = new THREE.Group()
  bodyRoot.position.y = 0.5
  group.add(bodyRoot)

  // ── 1. 躯干与蓝色夹克 ──
  const torso = new THREE.Group()
  bodyRoot.add(torso)

  // 蓝色夹克主体
  const jacketGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.44, 16)
  const jacketMesh = new THREE.Mesh(jacketGeo, jacketMat)
  jacketMesh.castShadow = true
  jacketMesh.position.y = 0.22
  torso.add(jacketMesh)

  // 领口露出的白色内衬领
  const innerCollarGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.08, 12)
  const innerCollar = new THREE.Mesh(innerCollarGeo, whiteShirtMat)
  innerCollar.position.y = 0.43
  torso.add(innerCollar)

  // 夹克正面两条棕色背带（双肩背包带）
  const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), strapMat)
  leftStrap.position.set(-0.13, 0.22, 0.13)
  const rightStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), strapMat)
  rightStrap.position.set(0.13, 0.22, 0.13)
  torso.add(leftStrap, rightStrap)

  // ── 2. 背后的棕色帆布背包（带 🌲 松树徽标） ──
  const backpackGroup = new THREE.Group()
  backpackGroup.position.set(0, 0.24, -0.22)
  torso.add(backpackGroup)

  // 背包主仓
  const packMainGeo = new THREE.BoxGeometry(0.3, 0.34, 0.18)
  const packMain = new THREE.Mesh(packMainGeo, backpackMat)
  packMain.castShadow = true
  backpackGroup.add(packMain)

  // 顶部包盖
  const packFlapGeo = new THREE.BoxGeometry(0.32, 0.1, 0.2)
  const packFlap = new THREE.Mesh(packFlapGeo, strapMat)
  packFlap.position.set(0, 0.16, 0)
  backpackGroup.add(packFlap)

  // 背包后方的圆形松树刺绣布章 🌲
  const patchTex = createBackpackPatchTexture()
  const patchMat = new THREE.MeshStandardMaterial({
    map: patchTex,
    roughness: 0.8,
  })
  const patchMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), patchMat)
  patchMesh.rotation.y = Math.PI // 面向背后
  patchMesh.position.set(0, 0.0, -0.092)
  backpackGroup.add(patchMesh)

  // ── 3. 头部、发型与标志性红便帽 ──
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 0.48, 0)
  torso.add(headGroup)

  // 脸部
  const headGeo = new THREE.SphereGeometry(0.24, 20, 20)
  const headMesh = new THREE.Mesh(headGeo, skinMat)
  headMesh.castShadow = true
  headGroup.add(headMesh)

  // 萌系大眼睛（黑溜溜）
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat)
  leftEye.position.set(-0.08, 0.02, 0.22)
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat)
  rightEye.position.set(0.08, 0.02, 0.22)
  headGroup.add(leftEye, rightEye)

  // 脸颊红晕
  const leftBlush = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), blushMat)
  leftBlush.position.set(-0.13, -0.04, 0.21)
  const rightBlush = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), blushMat)
  rightBlush.position.set(0.13, -0.04, 0.21)
  headGroup.add(leftBlush, rightBlush)

  // 深栗色刘海与鬓发
  const hairBangs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.12), hairMat)
  hairBangs.position.set(0, 0.12, 0.18)
  hairBangs.rotation.x = -0.2
  const leftSideHair = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.2), hairMat)
  leftSideHair.position.set(-0.21, 0.0, 0.04)
  const rightSideHair = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.2), hairMat)
  rightSideHair.position.set(0.21, 0.0, 0.04)
  headGroup.add(hairBangs, leftSideHair, rightSideHair)

  // 标志性红色毛线帽 / 便帽（Red Beanie）
  const beanieGroup = new THREE.Group()
  beanieGroup.position.set(0, 0.08, -0.03)
  beanieGroup.rotation.x = -0.15 // 往后脑勺微仰，露出萌系刘海
  headGroup.add(beanieGroup)

  // 便帽卷边厚圈
  const beanieCuffGeo = new THREE.TorusGeometry(0.23, 0.05, 12, 24)
  const beanieCuff = new THREE.Mesh(beanieCuffGeo, beanieCuffMat)
  beanieCuff.rotation.x = Math.PI / 2
  beanieGroup.add(beanieCuff)

  // 便帽饱满圆顶
  const beanieDomeGeo = new THREE.SphereGeometry(0.25, 20, 16)
  const beanieDome = new THREE.Mesh(beanieDomeGeo, redBeanieMat)
  beanieDome.scale.set(1.0, 0.88, 1.05)
  beanieDome.position.set(0, 0.08, -0.02)
  beanieDome.castShadow = true
  beanieGroup.add(beanieDome)

  // ── 4. 手臂（左右各一个，挂在肩部便于旋转摆动） ──
  const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.32, 12)
  const handGeo = new THREE.SphereGeometry(0.065, 10, 10)

  // 左臂
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.28, 0.36, 0)
  const leftArmMesh = new THREE.Mesh(armGeo, jacketMat)
  leftArmMesh.position.y = -0.16
  leftArmMesh.castShadow = true
  const leftHand = new THREE.Mesh(handGeo, skinMat)
  leftHand.position.y = -0.34
  leftArmPivot.add(leftArmMesh, leftHand)
  torso.add(leftArmPivot)

  // 右臂
  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.28, 0.36, 0)
  const rightArmMesh = new THREE.Mesh(armGeo, jacketMat)
  rightArmMesh.position.y = -0.16
  rightArmMesh.castShadow = true
  const rightHand = new THREE.Mesh(handGeo, skinMat)
  rightHand.position.y = -0.34
  rightArmPivot.add(rightArmMesh, rightHand)
  torso.add(rightArmPivot)

  // ── 5. 腿部与登山靴（挂在臀部便于交替迈步） ──
  const legGeo = new THREE.CylinderGeometry(0.085, 0.08, 0.34, 12)
  const bootGeo = new THREE.BoxGeometry(0.14, 0.13, 0.22)
  const soleGeo = new THREE.BoxGeometry(0.15, 0.04, 0.24)

  // 左腿
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.12, 0.0, 0)
  const leftLegMesh = new THREE.Mesh(legGeo, pantsMat)
  leftLegMesh.position.y = -0.16
  leftLegMesh.castShadow = true
  const leftBoot = new THREE.Mesh(bootGeo, bootsMat)
  leftBoot.position.set(0, -0.32, 0.03)
  leftBoot.castShadow = true
  const leftSole = new THREE.Mesh(soleGeo, bootsSoleMat)
  leftSole.position.set(0, -0.39, 0.03)
  leftLegPivot.add(leftLegMesh, leftBoot, leftSole)
  bodyRoot.add(leftLegPivot)

  // 右腿
  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.12, 0.0, 0)
  const rightLegMesh = new THREE.Mesh(legGeo, pantsMat)
  rightLegMesh.position.y = -0.16
  rightLegMesh.castShadow = true
  const rightBoot = new THREE.Mesh(bootGeo, bootsMat)
  rightBoot.position.set(0, -0.32, 0.03)
  rightBoot.castShadow = true
  const rightSole = new THREE.Mesh(soleGeo, bootsSoleMat)
  rightSole.position.set(0, -0.39, 0.03)
  rightLegPivot.add(rightLegMesh, rightBoot, rightSole)
  bodyRoot.add(rightLegPivot)

  // ── 6. 角色脚底柔和阴影贴图 ──
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x120c08,
    transparent: true,
    opacity: 0.35,
  })
  const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), shadowMat)
  shadowMesh.rotation.x = -Math.PI / 2
  shadowMesh.position.y = 0.02
  group.add(shadowMesh)

  // 动画状态
  let animTime = 0

  function update(delta: number, isMoving: boolean) {
    animTime += delta

    if (isMoving) {
      // 移动状态：欢快的跑步迈步动画 (6.5Hz 步频)
      const walkSpeed = 12
      const stepAngle = Math.sin(animTime * walkSpeed) * 0.75

      // 腿部前后交替大幅摆动
      leftLegPivot.rotation.x = stepAngle
      rightLegPivot.rotation.x = -stepAngle

      // 手臂反向大幅摆动协调平衡
      leftArmPivot.rotation.x = -stepAngle * 0.8
      rightArmPivot.rotation.x = stepAngle * 0.8

      // 躯干与头部随着步伐有节奏地上下起伏跳动
      bodyRoot.position.y = 0.5 + Math.abs(Math.sin(animTime * walkSpeed)) * 0.06
      torso.rotation.z = Math.sin(animTime * walkSpeed * 0.5) * 0.05
      headGroup.rotation.y = Math.sin(animTime * walkSpeed * 0.5) * 0.06
    } else {
      // 静止待机状态：温馨平缓的呼吸动作 (1.5Hz 呼吸律动)
      const breathe = Math.sin(animTime * 2.2)

      // 腿部复位站立
      leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, 0, 0.15)
      rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, 0, 0.15)

      // 手臂微微张开自然下垂
      leftArmPivot.rotation.x = THREE.MathUtils.lerp(leftArmPivot.rotation.x, 0.05 + breathe * 0.03, 0.1)
      rightArmPivot.rotation.x = THREE.MathUtils.lerp(rightArmPivot.rotation.x, 0.05 + breathe * 0.03, 0.1)
      leftArmPivot.rotation.z = THREE.MathUtils.lerp(leftArmPivot.rotation.z, 0.1, 0.1)
      rightArmPivot.rotation.z = THREE.MathUtils.lerp(rightArmPivot.rotation.z, -0.1, 0.1)

      // 躯干与头部随着呼吸缓缓升降
      bodyRoot.position.y = 0.5 + breathe * 0.015
      torso.rotation.z = 0
      headGroup.rotation.y = Math.sin(animTime * 0.8) * 0.04
    }
  }

  return {
    group,
    update,
  }
}
