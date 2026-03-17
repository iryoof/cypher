import { useState } from 'react'

interface TextInputProps {
  onSubmit: (text: string) => void
  maxLines?: number
  placeholder?: string
  isDisabled?: boolean
}

export default function TextInput({ onSubmit, maxLines = 2, placeholder = 'Schreibe deine Zeilen...', isDisabled = false }: TextInputProps) {
  const [text, setText] = useState('')
  const lineCount = text.split('\n').length

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text)
      setText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit()
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={maxLines + 1}
          maxLength={500}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none text-white placeholder-gray-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {text.length}/500
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          Zeilen: {lineCount}/{maxLines}
        </div>
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !text.trim() || lineCount > maxLines}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105"
        >
          ✓ Senden
        </button>
      </div>
    </div>
  )
}
