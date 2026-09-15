package com.workbench.mobile.ui.screens.scan

import com.workbench.mobile.ui.theme.ScanOverlayBg
import com.workbench.mobile.ui.theme.ScanToolbarIcon

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.outlined.FlashOff
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.ui.res.painterResource
import com.workbench.mobile.R
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.workbench.mobile.ui.theme.Spacing
import kotlinx.coroutines.flow.collectLatest
import java.util.concurrent.Executors
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size

/**
 * 通用扫一扫屏幕
 *
 * 行为：
 * 1. 摄像头实时预览（CameraX + ML Kit 多格式二维码）
 * 2. 识别到 WorkBench 设备配对 QR → 登记本机并回到工作区等待 Web 确认
 * 3. 识别到电脑登录 QR → 用已配对设备密钥批准本电脑登录（弹 Toast）
 * 4. 识别到任何其他 QR → 跳转 ScanResultScreen 展示 + 操作
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanScreen(
    onBack: () -> Unit,
    onGeneralScanResult: (String) -> Unit,
    onDevicePairingScanned: () -> Unit = {},
    viewModel: ScanViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()

    // 权限申请
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            viewModel.onPermissionGranted()
        } else {
            viewModel.onPermissionDenied()
        }
    }

    LaunchedEffect(Unit) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            viewModel.onPermissionGranted()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // 监听扫描事件
    LaunchedEffect(Unit) {
        viewModel.events.collectLatest { event ->
            when (event) {
                is ScanEvent.GeneralScan -> {
                    vibrate(context)
                    onGeneralScanResult(event.rawValue)
                }
                ScanEvent.AuthorizeSuccess -> {
                    vibrate(context)
                    Toast.makeText(context, "已授权 Web 端登录", Toast.LENGTH_SHORT).show()
                }
                is ScanEvent.AuthorizeFailed -> {
                    vibrate(context)
                    Toast.makeText(context, event.message, Toast.LENGTH_LONG).show()
                }
                is ScanEvent.DevicePairingScanned -> {
                    vibrate(context)
                    Toast.makeText(context, "已扫描 ${event.deviceName}，请在网页确认配对", Toast.LENGTH_LONG).show()
                    onDevicePairingScanned()
                    onBack()
                }
            }
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("扫一扫", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s6)
        ) {
            // Hero 图标
            Box(
                modifier = Modifier
                    .size(Size.bar)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_scan),
                    contentDescription = null,
                    tint = ScanToolbarIcon,
                    modifier = Modifier.size(Spacing.s6)
                )
            }

            Text(
                text = "将二维码放入框内",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "可授权电脑登录、配对本机或识别普通二维码",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // 取景框
            Box(
                modifier = Modifier
                    .size(Size.scanFrame)
                    .clip(RoundedCornerShape(Radius.md))
                    .background(ScanOverlayBg)
            ) {
                // 错误态优先
                if (state.error != null) {
                    ErrorPanel(
                        title = state.error!!.title,
                        desc = state.error!!.desc,
                        onRetry = { viewModel.retry() }
                    )
                }
                // 摄像头预览（cameraReady 为 true 时填充整个 Box）
                if (state.cameraReady) {
                    CameraPreview(
                        onBarcodeDetected = { value ->
                            viewModel.onBarcodeDetected(value)
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                    ScannerOverlay()
                }
            }

            // 手电筒
            if (state.torchEnabled) {
                FilledTonalIconButton(
                    onClick = { viewModel.toggleTorch() },
                    modifier = Modifier.size(Size.row),
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = if (state.torchOn) Icons.Outlined.FlashOn else Icons.Outlined.FlashOff,
                        contentDescription = "手电筒",
                        tint = if (state.torchOn) MaterialTheme.colorScheme.primary
                               else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            // 状态提示
            StatusBar(state)
        }
    }
}

// ============== 摄像头预览 + 识别 ==============
@SuppressLint("UnsafeOptInUsageError")
@Composable
private fun CameraPreview(
    onBarcodeDetected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
    }

    // 支持多格式：QR + 条形码
    val barcodeScanner = remember {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                    Barcode.FORMAT_QR_CODE,
                    Barcode.FORMAT_AZTEC,
                    Barcode.FORMAT_CODE_128,
                    Barcode.FORMAT_CODE_39,
                    Barcode.FORMAT_CODE_93,
                    Barcode.FORMAT_EAN_13,
                    Barcode.FORMAT_EAN_8,
                    Barcode.FORMAT_PDF417,
                    Barcode.FORMAT_UPC_A,
                    Barcode.FORMAT_UPC_E,
                    Barcode.FORMAT_DATA_MATRIX,
                )
                .build()
        )
    }
    val executor = remember { Executors.newSingleThreadExecutor() }

    AndroidView(
        factory = { previewView },
        modifier = modifier
    )

    LaunchedEffect(previewView) {
        val cameraProvider = ProcessCameraProvider.getInstance(context).get()
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
        analysis.setAnalyzer(executor) { imageProxy ->
            processImage(imageProxy, barcodeScanner, onBarcodeDetected)
        }

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            executor.shutdown()
            barcodeScanner.close()
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
private fun processImage(
    imageProxy: ImageProxy,
    scanner: BarcodeScanner,
    onResult: (String) -> Unit
) {
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }
    val image = InputImage.fromMediaImage(
        mediaImage,
        imageProxy.imageInfo.rotationDegrees
    )
    scanner.process(image)
        .addOnSuccessListener { barcodes ->
            barcodes.firstOrNull()?.rawValue?.let(onResult)
        }
        .addOnCompleteListener { imageProxy.close() }
}

// ============== 装饰 ==============
@Composable
private fun ScannerOverlay() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(Size.scanFrameSm)
                .padding(Spacing.s5)
        ) {
            Corner(
                Alignment.TopStart,
                modifier = Modifier.align(Alignment.TopStart)
            )
            Corner(
                Alignment.TopEnd,
                modifier = Modifier.align(Alignment.TopEnd)
            )
            Corner(
                Alignment.BottomStart,
                modifier = Modifier.align(Alignment.BottomStart)
            )
            Corner(
                Alignment.BottomEnd,
                modifier = Modifier.align(Alignment.BottomEnd)
            )
        }
    }
}

@Composable
private fun BoxScope.Corner(
    alignment: Alignment,
    modifier: Modifier = Modifier
) {
    val horizontalAlign = when (alignment) {
        Alignment.TopStart, Alignment.TopEnd -> Alignment.TopCenter
        Alignment.BottomStart, Alignment.BottomEnd -> Alignment.BottomCenter
        else -> Alignment.TopCenter
    }
    val verticalAlign = when (alignment) {
        Alignment.TopStart, Alignment.BottomStart -> Alignment.CenterStart
        Alignment.TopEnd, Alignment.BottomEnd -> Alignment.CenterEnd
        else -> Alignment.CenterStart
    }

    Box(
        modifier = modifier.size(Spacing.s6)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(Spacing.s0_5)
                .align(horizontalAlign)
                .background(MaterialTheme.colorScheme.primary)
        )
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .width(Spacing.s0_5)
                .align(verticalAlign)
                .background(MaterialTheme.colorScheme.primary)
        )
    }
}

@Composable
private fun StatusBar(state: ScanState) {
    val (bg, fg, icon) = when (state.status) {
        ScanStatus.AUTHORIZED -> Triple(
            MaterialTheme.colorScheme.primary,
            MaterialTheme.colorScheme.onPrimary,
            "✓"
        )
        ScanStatus.ERROR -> Triple(
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.error,
            "!"
        )
        ScanStatus.AUTHORIZING -> Triple(
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer,
            "…"
        )
        else -> Triple(
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.onSurfaceVariant,
            "·"
        )
    }
    Surface(
        color = bg,
        shape = RoundedCornerShape(Radius.sm)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1_5),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(Spacing.s2)
                    .clip(CircleShape)
                    .background(fg)
            )
            Text(
                text = state.statusText,
                style = MaterialTheme.typography.bodySmall,
                color = fg,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun ErrorPanel(title: String, desc: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .padding(Spacing.s4),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(Spacing.s2))
        Text(
            text = desc,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(Spacing.s3))
        Button(onClick = onRetry) { Text("重新尝试") }
    }
}

// ============== 工具 ==============
private fun vibrate(context: Context) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        manager.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
    } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(50)
    }
}
