import { useState } from 'react'

interface TwoLineInputProps {
  onSubmit: (text: string) => void
  isDisabled?: boolean
  placeholder1?: string
  placeholder2?: string
}

export default function TwoLineInput({
  onSubmit,
  isDisabled = false,
  placeholder1 = 'Zeile 1...',
  placeholder2 = 'Zeile 2...'
}: TwoLineInputProps) {
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')

  const canSubmit = line1.trim() && line2.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(`${line1}\n${line2}`)
    setLine1('')
    setLine2('')
  }

  return (
    <div className="w-full space-y-3">
      <div className="space-y-2">
        <input
          value={line1}
          onChange={(e) => setLine1(e.target.value.slice(0, 250))}
          placeholder={placeholder1}
          disabled={isDisabled}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <input
          value={line2}
          onChange={(e) => setLine2(e.target.value.slice(0, 250))}
          placeholder={placeholder2}
          disabled={isDisabled}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">Zeilen: 2/2</div>
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !canSubmit}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105"
        >
          ✓ Senden
        </button>
      </div>
    </div>
  )
}
