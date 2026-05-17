import { useContext } from 'react'
import { AiConfigContext } from '../store/AiConfigContext'

export function useAiConfig() {
  return useContext(AiConfigContext)
}
