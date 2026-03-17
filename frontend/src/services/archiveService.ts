import { GameArchive } from '../../../shared/types'

const ARCHIVES_KEY = 'cypher-archives'

export function saveArchive(archive: GameArchive): void {
  try {
    const archives = getArchives()
    archives.push(archive)
    localStorage.setItem(ARCHIVES_KEY, JSON.stringify(archives))
    console.log('📁 Archive saved:', archive.id)
  } catch (error) {
    console.error('Error saving archive:', error)
  }
}

export function getArchives(): GameArchive[] {
  try {
    const data = localStorage.getItem(ARCHIVES_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error loading archives:', error)
    return []
  }
}

export function getArchive(id: string): GameArchive | null {
  try {
    const archives = getArchives()
    return archives.find(a => a.id === id) || null
  } catch (error) {
    console.error('Error getting archive:', error)
    return null
  }
}

export function deleteArchive(id: string): boolean {
  try {
    const archives = getArchives()
    const filtered = archives.filter(a => a.id !== id)
    localStorage.setItem(ARCHIVES_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Error deleting archive:', error)
    return false
  }
}

export function clearAllArchives(): void {
  try {
    localStorage.removeItem(ARCHIVES_KEY)
    console.log('🗑️ All archives cleared')
  } catch (error) {
    console.error('Error clearing archives:', error)
  }
}
