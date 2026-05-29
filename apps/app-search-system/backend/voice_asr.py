#!/usr/bin/env python3
"""
实时语音识别 WebSocket 服务
使用 DashScope paraformer-realtime-v2 模型
"""
import asyncio
import json
import logging
import threading
import numpy as np
from typing import Optional, Callable, List, Tuple

# DashScope ASR
from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult

logger = logging.getLogger(__name__)

# 模型优先级（按质量排序，带回退）
ASR_MODELS = [
    'paraformer-realtime-v2',       # 最优实时模型
    'paraformer-realtime-8k-v2',    # 8kHz 版本
    'paraformer-realtime-v1',       # v1 版本
    'fun-asr-realtime-2025-09-15',  # 备用模型
]


class RealtimeASR:
    """实时语音识别（WebSocket 流式）"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.current_model_idx = 0
        self.recognition: Optional[Recognition] = None
        self.callback: Optional[RecognitionCallback] = None
        self.is_running = False
        self.audio_queue: asyncio.Queue = asyncio.Queue()
        self.result_callback: Optional[Callable] = None
        self._lock = threading.Lock()

    def _create_callback(self) -> RecognitionCallback:
        """创建回调处理器"""
        parent = self

        class ASRCallback(RecognitionCallback):
            def on_open(self):
                logger.info(f'[ASR] WebSocket 已连接 (model: {parent.recognition.model if parent.recognition else "N/A"})')

            def on_event(self, result: RecognitionResult):
                sentence = result.get_sentence()
                if sentence:
                    text = sentence.get('text', '')
                    is_end = result.is_sentence_end()
                    logger.debug(f'[ASR] 识别结果: {text} (end={is_end})')
                    if parent.result_callback:
                        parent.result_callback({
                            'text': text,
                            'is_final': is_end,
                            'status': 'partial' if not is_end else 'final'
                        })

            def on_error(self, result):
                error_msg = str(result)
                logger.error(f'[ASR] 错误: {error_msg}')
                if parent.result_callback:
                    parent.result_callback({
                        'text': '',
                        'status': 'error',
                        'error': error_msg
                    })

            def on_close(self):
                logger.info('[ASR] WebSocket 已关闭')
                parent.is_running = False

        return ASRCallback()

    def start(self, result_callback: Callable) -> bool:
        """启动语音识别"""
        with self._lock:
            if self.is_running:
                return True

            self.result_callback = result_callback
            self.callback = self._create_callback()

            # 尝试按优先级创建 Recognition
            for i, model in enumerate(ASR_MODELS):
                try:
                    self.recognition = Recognition(
                        model=model,
                        format='pcm',
                        sample_rate=16000,
                        callback=self.callback
                    )
                    self.recognition.start()
                    self.current_model_idx = i
                    self.is_running = True
                    logger.info(f'[ASR] 已启动模型: {model}')
                    return True
                except Exception as e:
                    logger.warning(f'[ASR] 模型 {model} 启动失败: {e}')
                    continue

            logger.error('[ASR] 所有模型均启动失败')
            return False

    def send_audio(self, audio_data: bytes) -> bool:
        """发送音频数据（PCM 16kHz 16bit mono）"""
        if not self.is_running or not self.recognition:
            return False

        try:
            self.recognition.send_audio_frame(audio_data)
            return True
        except Exception as e:
            logger.error(f'[ASR] 发送音频失败: {e}')
            return False

    def stop(self):
        """停止语音识别"""
        with self._lock:
            if not self.is_running:
                return

            self.is_running = False
            if self.recognition:
                try:
                    self.recognition.stop()
                except Exception as e:
                    logger.error(f'[ASR] 停止失败: {e}')
                self.recognition = None
            logger.info('[ASR] 已停止')


# ============== WebSocket 服务器 ==============
class ASRWebSocketServer:
    """WebSocket 服务器 - 接收浏览器音频流，返回识别文本"""

    def __init__(self, api_key: str, host: str = '0.0.0.0', port: int = 8766):
        self.api_key = api_key
        self.host = host
        self.port = port
        self.server = None
        self._running = False

        # 音频转换参数
        self.target_sample_rate = 16000
        self.target_channels = 1

    async def handle_client(self, websocket, path):
        """处理 WebSocket 客户端连接"""
        logger.info(f'[WS] 新客户端连接: {websocket.remote_address}')

        asr = RealtimeASR(self.api_key)
        loop = asyncio.get_event_loop()

        async def send_result(result):
            """在 asyncio 事件循环线程中安全地发送结果"""
            try:
                await websocket.send(json.dumps({
                    'type': 'result',
                    **result
                }))
            except Exception as e:
                logger.debug(f'[WS] 发送结果失败（连接可能已关闭）: {e}')

        def on_result(result):
            """ASR 结果回调（在 DashScope 线程中调用）。
            使用 run_coroutine_threadsafe 将发送操作调度到 asyncio 事件循环，
            立即发送识别结果，无需等待下一个音频帧到来。"""
            asyncio.run_coroutine_threadsafe(send_result(result), loop)

        # 启动 ASR
        if not asr.start(on_result):
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'ASR 服务启动失败'
            }))
            return

        try:
            await websocket.send(json.dumps({
                'type': 'ready',
                'message': 'ASR 服务就绪'
            }))

            # 接收音频流
            async for message in websocket:
                if isinstance(message, bytes):
                    # 二进制音频数据（PCM 16kHz 16bit mono）
                    asr.send_audio(message)

                elif isinstance(message, str):
                    # 文本控制消息
                    try:
                        data = json.loads(message)
                        if data.get('type') == 'stop':
                            break
                        elif data.get('type') == 'config':
                            logger.info(f'[WS] 配置: {data}')
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            logger.error(f'[WS] 客户端处理错误: {e}')

        finally:
            asr.stop()
            logger.info(f'[WS] 客户端断开: {websocket.remote_address}')

    async def start_server(self):
        """启动 WebSocket 服务器"""
        import websockets

        self._running = True
        async with websockets.serve(
            self.handle_client,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=60
        ):
            logger.info(f'[WS] WebSocket 服务器启动: ws://{self.host}:{self.port}')
            await asyncio.Future()  # 永远运行

    def run_in_thread(self):
        """在线程中运行 WebSocket 服务器"""
        def run():
            asyncio.run(self.start_server())

        thread = threading.Thread(target=run, daemon=True, name='ASR-WebSocket')
        thread.start()
        return thread


# ============== 音频转换工具 ==============
def resample_audio(audio_data: bytes, source_rate: int, target_rate: int = 16000) -> bytes:
    """
    重采样音频数据
    输入: PCM 16bit mono bytes
    输出: PCM 16kHz 16bit mono bytes
    """
    if source_rate == target_rate:
        return audio_data

    try:
        import scipy.signal as signal

        # 转换为 numpy array
        samples = np.frombuffer(audio_data, dtype=np.int16)

        # 计算重采样
        num_samples = int(len(samples) * target_rate / source_rate)
        resampled = signal.resample(samples, num_samples)

        # 转回 int16
        return resampled.astype(np.int16).tobytes()

    except ImportError:
        logger.warning('[Audio] scipy 未安装，跳过重采样')
        return audio_data


def convert_webm_to_pcm(webm_data: bytes, target_rate: int = 16000) -> Optional[bytes]:
    """
    将 WebM/Opus 音频转换为 PCM
    需要 ffmpeg 和 pydub
    """
    try:
        from pydub import AudioSegment
        import io

        # 从 WebM 数据创建 AudioSegment
        audio = AudioSegment.from_file(io.BytesIO(webm_data), format='webm')

        # 转换为 16kHz mono 16bit PCM
        audio = audio.set_frame_rate(target_rate)
        audio = audio.set_channels(1)
        audio = audio.set_sample_width(2)  # 16bit

        return audio.raw_data

    except ImportError:
        logger.error('[Audio] pydub 未安装，无法转换 WebM')
        return None
    except Exception as e:
        logger.error(f'[Audio] WebM 转换失败: {e}')
        return None


# ============== 全局实例 ==============
_asr_server: Optional[ASRWebSocketServer] = None


def start_asr_server(api_key: str, port: int = 8766) -> ASRWebSocketServer:
    """启动 ASR WebSocket 服务器"""
    global _asr_server

    if _asr_server is not None:
        return _asr_server

    _asr_server = ASRWebSocketServer(api_key, port=port)
    _asr_server.run_in_thread()

    return _asr_server