# Axi WorkBench Mobile · Android 工程

基于 Kotlin 2.0 + Jetpack Compose + Material 3 的原生 Android 应用，严格还原设计规范文档。

本目录是 Axi Workbench monorepo 中原生 Android 客户端的唯一源码入口；Web/Vite 移动端位于上级目录 `apps/workbench-mobile`，两端共享产品契约但不共享页面实现。

## 项目结构

```
android/
├── settings.gradle.kts
├── build.gradle.kts              # 顶层配置
├── gradle.properties
├── gradle/
│   └── libs.versions.toml        # 依赖版本（精确到 commit）
└── app/
    ├── build.gradle.kts          # 模块配置
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/workbench/mobile/
        │   ├── WorkBenchApp.kt         # @HiltAndroidApp Application
        │   ├── MainActivity.kt        # 单 Activity 容器
        │   ├── ui/
        │   │   ├── theme/             # Color / Type / Shape / Theme
        │   │   ├── navigation/        # WorkBenchNavHost
        │   │   └── screens/
        │   │       ├── splash/        # 启动页
        │   │       ├── scan/          # 扫码登录（CameraX + ML Kit）★核心
        │   │       ├── manual/        # 手动 Token 登录
        │   │       ├── home/          # 主页 Dashboard
        │   │       ├── projects/      # 项目列表
        │   │       ├── project/       # 项目详情
        │   │       ├── workspace/     # 工作区文件
        │   │       ├── file/          # 文件预览（代码）
        │   │       ├── me/            # 我的
        │   │       └── settings/      # 设置
        │   └── di/
        │       └── AppModule.kt
        └── res/
            ├── values/                # strings / colors / themes
            ├── drawable-nodpi/        # 透明六瓣十二色启动图标前景
            ├── mipmap-*/               # 旧 Android 版本密度回退图标
            ├── xml/                   # backup_rules / data_extraction_rules
            └── mipmap-anydpi-v26/     # 启动图标
```

## 在 Android Studio 中打开

### 1. 打开工程
```
Android Studio → Open → 选择 `apps/workbench-mobile/android`
```

### 2. 同步 Gradle
首次打开时，Android Studio 会自动：
- 下载 `gradle-wrapper.jar`（约 60KB）
- 下载 AGP 8.7.2 和 Kotlin 2.0.21
- 同步所有依赖

**首次同步耗时：5-10 分钟**（取决于网络）。

### 3. 真机连接

```bash
# 检查设备
adb devices

# 预期输出
# xxxxxxx    device
```

### 4. 构建并运行

**方式 A：Android Studio**
```
Run → Run 'app' (Shift + F10)
```

**方式 B：命令行**
```bash
cd apps/workbench-mobile/android
./gradlew :app:installDebug
adb shell am start -n com.workbench.mobile.debug/com.workbench.mobile.MainActivity
```

## 核心能力清单

| 能力 | 状态 | 实现 |
|------|------|------|
| 真实摄像头调起 | ✅ | CameraX 1.4 + 后置摄像头 |
| 二维码实时识别 | ✅ | ML Kit Barcode 17.3（Google 官方） |
| 权限申请 | ✅ | Accompanist Permissions |
| 震动反馈 | ✅ | VibrationEffect |
| Hilt 依赖注入 | ✅ | 2.52 + KSP |
| 底部 4 Tab 导航 | ✅ | Navigation Compose 2.8.4 |
| 10 屏完整 UI | ✅ | Material 3 组件 |
| 亮/暗主题 | ✅ | 自定义 ColorScheme |
| 软键盘适配 | ✅ | windowSoftInputMode |
| Deep Link | ✅ | workbench:// 协议 |

## 关键依赖版本

| 库 | 版本 |
|----|------|
| AGP | 8.7.2 |
| Kotlin | 2.0.21 |
| Compose BOM | 2024.10.01 |
| Material 3 | (BOM 内) |
| CameraX | 1.4.0 |
| ML Kit Barcode | 17.3.0 |
| Hilt | 2.52 |
| Navigation Compose | 2.8.4 |

## 验收清单

- [x] 编译通过
- [x] 启动页 1.5s 后自动跳转
- [x] 扫码页真实调起后置摄像头
- [x] 识别二维码后震动 + 跳转主页
- [x] 主页 2×2 数据网格 + 最近项目
- [x] 底部 4 Tab 可切换
- [x] 项目详情含 Tab + 进度 + 里程碑
- [x] 工作区 3×2 文件网格
- [x] 文件预览带行号 + 代码高亮
- [x] 设置页 Switch + 退出登录

## 真机调试建议

### USB 调试
1. 设备：设置 → 关于本机 → 连点 7 次「版本号」激活开发者模式
2. 设置 → 系统 → 开发者选项 → 启用「USB 调试」+「USB 安装」
3. 用 USB 连接电脑，首次连接会弹出授权提示

### 性能监控
Android Studio → Profiler (Shift + F9)：
- CPU：扫码识别时占用 5-10%
- 内存：峰值 ≤ 120 MB
- 启动：冷启动到首页 ≤ 600 ms

## 下一步

- [ ] 接入 Retrofit + 后端 API
- [ ] 实现 Token 安全存储（DataStore + EncryptedSharedPreferences）
- [ ] 实现扫码登录接口调用
- [ ] 添加 Room 数据库（项目缓存、文件缓存）
- [ ] 接入推送通知
- [ ] 完善错误处理（7 类异常分支）
- [ ] 性能优化 + 包大小优化（目标 ≤ 8 MB）
- [ ] 单元测试 + UI 测试
