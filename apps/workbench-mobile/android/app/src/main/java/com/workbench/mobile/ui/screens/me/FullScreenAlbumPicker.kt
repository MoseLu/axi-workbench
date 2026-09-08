package com.workbench.mobile.ui.screens.me

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.WeChatCardBg
import com.workbench.mobile.ui.theme.WeChatChromeBg
import com.workbench.mobile.ui.theme.WeChatDivider
import com.workbench.mobile.ui.theme.WeChatGreen
import com.workbench.mobile.ui.theme.WeChatInk
import com.workbench.mobile.ui.theme.WeChatInkMuted
import com.workbench.mobile.ui.theme.WeChatLink
import com.workbench.mobile.ui.theme.WeChatPageBg

/** 微信式全屏相册：灰顶栏 + 4 列缩略图，点选即返回 URI。 */
@Composable
fun FullScreenAlbumPicker(
    onPicked: (Uri) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var permissionGranted by remember {
        mutableStateOf(hasImageReadPermission(context))
    }
    var loading by remember { mutableStateOf(true) }
    var images by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        permissionGranted = granted
        if (!granted) {
            error = "需要相册权限才能选择头像"
            loading = false
        }
    }

    LaunchedEffect(permissionGranted) {
        if (!permissionGranted) {
            loading = false
            permissionLauncher.launch(imageReadPermission())
            return@LaunchedEffect
        }
        loading = true
        error = null
        images = withContext(Dispatchers.IO) { loadDeviceImages(context) }
        loading = false
        if (images.isEmpty()) {
            error = "相册里还没有图片"
        }
    }

    BackHandler(onBack = onDismiss)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(WeChatPageBg)
                .statusBarsPadding()
                .navigationBarsPadding()
        ) {
            // 顶栏：取消 | 相册
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Size.bar)
                    .background(WeChatPageBg)
            ) {
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.CenterStart)
                ) {
                    Text("取消", color = WeChatInk, fontSize = FontSize.lg)
                }
                Text(
                    text = "相册",
                    modifier = Modifier.align(Alignment.Center),
                    color = WeChatInk,
                    fontSize = FontSize.xl,
                    fontWeight = FontWeight.SemiBold
                )
            }
            HorizontalDivider(thickness = Spacing.hairline, color = WeChatDivider)

            when {
                loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(WeChatCardBg),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = WeChatGreen)
                    }
                }
                error != null && images.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(WeChatCardBg)
                            .padding(Spacing.s6),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(error ?: "", color = WeChatInkMuted, fontSize = FontSize.base)
                        Spacer(Modifier.height(Spacing.s4))
                        if (!permissionGranted) {
                            TextButton(
                                onClick = {
                                    permissionLauncher.launch(imageReadPermission())
                                }
                            ) {
                                Text("授予权限", color = WeChatLink)
                            }
                        }
                    }
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(4),
                        modifier = Modifier
                            .fillMaxSize()
                            .background(WeChatCardBg),
                        contentPadding = PaddingValues(Spacing.px),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.px),
                        verticalArrangement = Arrangement.spacedBy(Spacing.px)
                    ) {
                        items(images, key = { it.toString() }) { uri ->
                            AsyncImage(
                                model = ImageRequest.Builder(context)
                                    .data(uri)
                                    .crossfade(false)
                                    .size(300)
                                    .build(),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .aspectRatio(1f)
                                    .clickable {
                                        scope.launch {
                                            onPicked(uri)
                                        }
                                    }
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun imageReadPermission(): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Manifest.permission.READ_MEDIA_IMAGES
    } else {
        Manifest.permission.READ_EXTERNAL_STORAGE
    }

private fun hasImageReadPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, imageReadPermission()) ==
        PackageManager.PERMISSION_GRANTED

private fun loadDeviceImages(context: Context): List<Uri> {
    val result = ArrayList<Uri>(256)
    val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
    } else {
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    }
    val projection = arrayOf(MediaStore.Images.Media._ID)
    val sort = "${MediaStore.Images.Media.DATE_ADDED} DESC"
    context.contentResolver.query(
        collection,
        projection,
        null,
        null,
        sort
    )?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
        while (cursor.moveToNext()) {
            val id = cursor.getLong(idCol)
            result.add(ContentUris.withAppendedId(collection, id))
            if (result.size >= 500) break
        }
    }
    return result
}
