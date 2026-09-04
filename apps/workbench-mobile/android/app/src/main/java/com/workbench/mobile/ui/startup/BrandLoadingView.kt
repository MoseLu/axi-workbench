package com.workbench.mobile.ui.startup

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator
import com.workbench.mobile.BuildConfig
import com.workbench.mobile.R
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.sin

/**
 * 首帧原生品牌 Loading。
 *
 * 这个 View 刻意不依赖 Compose、Hilt 或网络初始化，保证 Android 系统 Splash
 * 一结束就能看到完整的 Logo、提示文案和动态点，而不是再次等待渲染框架启动。
 */
class BrandLoadingView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val density = resources.displayMetrics.density
    private val scaledDensity = resources.displayMetrics.scaledDensity
    private val logo: Bitmap = BitmapFactory.decodeResource(
        resources,
        R.drawable.ic_launcher_foreground
    )
    private val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val titlePaint = textPaint(
        color = context.getColor(R.color.wechat_ink),
        textSizeSp = 22f,
        typeface = Typeface.DEFAULT_BOLD
    )
    private val messagePaint = textPaint(
        color = context.getColor(R.color.wechat_ink),
        textSizeSp = 14f,
        typeface = Typeface.DEFAULT
    ).apply { alpha = 170 }
    private val versionPaint = textPaint(
        color = context.getColor(R.color.wechat_ink),
        textSizeSp = 12f,
        typeface = Typeface.DEFAULT
    ).apply { alpha = 140 }
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = context.getColor(R.color.brand_primary)
    }
    private val logoRect = RectF()
    private var animationPhase = 0f
    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 900L
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener {
            animationPhase = it.animatedValue as Float
            invalidate()
        }
    }

    init {
        setBackgroundColor(context.getColor(R.color.wechat_chrome_bg))
        contentDescription = "Axi Workbench，正在准备工作区"
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val centerX = width / 2f
        val centerY = height / 2f
        val logoSize = dp(96f)
        logoRect.set(
            centerX - logoSize / 2f,
            centerY - logoSize / 2f,
            centerX + logoSize / 2f,
            centerY + logoSize / 2f
        )
        canvas.drawBitmap(logo, null, logoRect, imagePaint)

        val titleBaseline = centerY + dp(98f)
        canvas.drawText("Axi Workbench", centerX, titleBaseline, titlePaint)
        canvas.drawText("正在准备工作区…", centerX, titleBaseline + dp(35f), messagePaint)

        val dotsY = titleBaseline + dp(68f)
        for (index in 0..2) {
            val delayedPhase = (animationPhase + index * 0.2f) % 1f
            val pulse = max(0f, sin(delayedPhase * 2f * PI).toFloat())
            dotPaint.alpha = (64 + pulse * 191).toInt()
            canvas.drawCircle(centerX + (index - 1) * dp(16f), dotsY, dp(4f), dotPaint)
        }

        canvas.drawText(
            "v${BuildConfig.VERSION_NAME}",
            centerX,
            titleBaseline + dp(122f),
            versionPaint
        )
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        animator.start()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    private fun textPaint(color: Int, textSizeSp: Float, typeface: Typeface): Paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = textSizeSp * scaledDensity
            textAlign = Paint.Align.CENTER
            this.typeface = typeface
        }

    private fun dp(value: Float): Float = value * density
}
