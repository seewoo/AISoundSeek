/**
 * Token 消耗估算工具
 * 基于音频时长计算，暂定每秒 5 tokens
 */

export const TOKEN_PER_SECOND = 5

/**
 * 根据音频总时长估算 token 消耗
 */
export function estimateTokenConsumption(totalDurationSeconds: number): number {
  return Math.ceil(totalDurationSeconds * TOKEN_PER_SECOND)
}