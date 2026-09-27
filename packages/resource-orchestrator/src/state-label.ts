import { runStateSchema, type RunState } from "@axi/gateway-contracts";

/** Browser-safe labels for the trace presentation layer. */
export const stateLabel = (state: RunState) => ({
  idle: "待命",
  interpreting: "理解中",
  planning: "规划工具",
  executing: "查询资源",
  validating: "确定性验证",
  presenting: "结果就绪",
  clarifying: "需要澄清",
  failed: "执行失败",
  cancelled: "已取消",
  "image-searching": "本地图库搜索中",
  "image-empty-fallback-searching": "图库为空，正在全网搜索",
  "composing-prompt": "合成生成 prompt",
  "image-generating": "图片生成中",
}[runStateSchema.parse(state)]);
