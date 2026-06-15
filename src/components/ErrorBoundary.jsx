import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-red-50">
          <p className="text-5xl mb-4">😬</p>
          <h2 className="text-xl font-black text-red-700 mb-2">Iets het verkeerd gegaan</h2>
          <p className="text-sm text-red-500 font-mono bg-white border border-red-200 rounded-xl p-3 max-w-sm break-all">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 bg-red-500 text-white font-extrabold px-6 py-3 rounded-2xl"
          >
            🔄 Herlaai App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
