import { useState } from 'react'
import { evaluate } from '@graphcalc/math-engine'
import { Button } from '@graphcalc/ui'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8 text-blue-400">GraphCalc Web App</h1>
      
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-md text-center">
        <p className="text-xl mb-4">
          <span className="text-gray-400">Math Engine Evaluation: </span>
          <span className="font-mono text-green-400">2 + 2 = {evaluate('2+2')}</span>
        </p>
        
        <div className="mb-4">
          <Button />
        </div>
        
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          onClick={() => setCount((c) => c + 1)}
        >
          Count is {count}
        </button>
      </div>
    </div>
  )
}

export default App
