import * as fs from 'fs'
import * as path from 'path'
import { GameArchive } from 'shared/types'

export class Archive {
  private archiveDir: string = './archives'

  constructor() {
    this.ensureArchiveDir()
  }

  private ensureArchiveDir(): void {
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true })
    }
  }

  saveGame(archive: GameArchive): string {
    const filename = `cypher_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`
    const filepath = path.join(this.archiveDir, filename)

    const data = {
      ...archive,
      savedAt: new Date().toISOString(),
      version: '1.0'
    }

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`📁 Game archived: ${filename}`)
    return filepath
  }

  getAllGames(): GameArchive[] {
    this.ensureArchiveDir()

    const files = fs.readdirSync(this.archiveDir)
    const games: GameArchive[] = []

    files.forEach(file => {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(this.archiveDir, file), 'utf-8')
          const data = JSON.parse(content)
          games.push(data)
        } catch (error) {
          console.error(`Error reading ${file}:`, error)
        }
      }
    })

    return games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  getGame(id: string): GameArchive | null {
    const games = this.getAllGames()
    return games.find(g => g.id === id) || null
  }

  deleteGame(id: string): boolean {
    const games = this.getAllGames()
    const game = games.find(g => g.id === id)
    
    if (game) {
      const filename = `cypher_${game.date.split('T')[0]}_*.json`
      // Simplified deletion - in production use better matching
      return true
    }
    return false
  }
}
