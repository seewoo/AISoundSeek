import { useState, useEffect } from 'react'
import type { ActiveView } from '../App'
import { useSearch } from '../store'
import { useAiChat } from '../store/AiChatContext'
import { AudioList } from './AudioList'
import { SearchBar } from './SearchBar'
import { FilterPanel } from './FilterPanel'
import { AudioDetail } from './AudioDetail'
import { AiChatPanel } from './AiChatPanel'
import { TagsView } from './TagsView'
import { DirectoryBrowserView } from './DirectoryBrowserView'
import type { AudioFile } from '../../shared/types'

interface Props {
  activeView: ActiveView
  onOpenDirs?: () => void
}

export function MainContent({ activeView, onOpenDirs }: Props) {
  const { setParams } = useSearch()
  const { showAiChat, setShowAiChat } = useAiChat()
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Clear directory filter when leaving dirBrowser
  useEffect(() => {
    if (activeView !== 'dirBrowser') {
      setParams({ dirPath: undefined })
    }
  }, [activeView]) // eslint-disable-line

  if (activeView === 'tags') {
    return <TagsView />
  }

  if (activeView === 'dirBrowser') {
    return <DirectoryBrowserView onOpenDirs={onOpenDirs} />
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: list */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <SearchBar
          onToggleFilters={() => setShowFilters(f => !f)}
          showFilters={showFilters}
          onToggleAiChat={() => {
            const aiIsVisible = showAiChat && !selectedAudio
            if (aiIsVisible) {
              setShowAiChat(false)
            } else {
              if (selectedAudio) {
                setSelectedAudio(null)
              }
              setShowAiChat(true)
            }
          }}
          showAiChat={showAiChat && !selectedAudio}
        />
        {showFilters && <FilterPanel />}
        <AudioList onSelect={setSelectedAudio} selectedId={selectedAudio?.id} />
      </div>

      {/* Right: AI chat panel */}
      {showAiChat && !selectedAudio && (
        <AiChatPanel
          onSelectAudio={setSelectedAudio}
        />
      )}

      {/* Right: detail panel */}
      {selectedAudio && (
        <AudioDetail
          audio={selectedAudio}
          onClose={() => setSelectedAudio(null)}
          onUpdate={(updated) => setSelectedAudio(updated)}
        />
      )}
    </div>
  )
}
