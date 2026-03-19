export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input
    .substring(0, maxLength)
    .trim()
    .replace(/[<>]/g, '')
}

export function validateNickname(nickname: string): boolean {
  return nickname.length >= 1 && nickname.length <= 20
}

export function validateGameSettings(playerCount: number, timerSeconds: number): boolean {
  return (
    playerCount >= 3 &&
    timerSeconds >= 60 &&
    timerSeconds <= 300
  )
}
