import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useCallback } from 'react'
import { FiSend } from 'react-icons/fi'
import { getFaqCategories } from '../lib/categories'

import {
  sendMessage,
  onReceiveMessage,
  onChatHistory,
  removeSocketListeners
} from "../services/chatSocket"
import { socket } from '../lib/socket'

export const Route = createFileRoute('/chat')({
  component: App,
})

const ULTRON_CONIC = 'conic-gradient(from 0deg, #1a1a1a 10%, #4a4a4a, #ff0000, #b0b0b0, #1a1a1a 90%)'

function splitIntoBubbles(text: string): string[] {
  const byParagraph = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  if (byParagraph.length > 1) return byParagraph
  const bySingle = text.split(/\n/).map(s => s.trim()).filter(Boolean)
  if (bySingle.length > 1) return bySingle
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (sentences && sentences.length > 1) {
    const bubbles: string[] = []
    let current = ''
    for (const s of sentences) {
      if ((current + s).length > 130 && current.trim()) {
        bubbles.push(current.trim())
        current = s
      } else {
        current += s
      }
    }
    if (current.trim()) bubbles.push(current.trim())
    if (bubbles.length > 1) return bubbles
  }
  return [text]
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  bubbles: string[]
}

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [allSuggestions, setAllSuggestions] = useState<string[]>([])
  const [seenCount, setSeenCount] = useState(0)
  const [currentPair, setCurrentPair] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  const [viewportH, setViewportH] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const isDown = useRef(false)
  const startX = useRef(0)
  const scrollLeftRef = useRef(0)
  const dragged = useRef(false)
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([])
  const [, setCategoriesLoading] = useState(true)

  function formatCategoryLabel(id: string): string {
    return id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const CATEGORY_LABEL_MAP: Record<string, string> = {
    get_started: 'Get Started',
    about_me: 'About Me',
    about_my_creator: 'About My Creator',
  }

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await getFaqCategories()
        const formatted = res.data.map((id: string) => ({
          id,
          label: CATEGORY_LABEL_MAP[id] ?? formatCategoryLabel(id),
        }))
        setCategories(formatted)
      } catch (error) {
        console.error("Failed to fetch categories:", error)
        setCategories([
          { id: 'get_started', label: 'Get Started' },
          { id: 'about_me', label: 'About Me' },
          { id: 'about_my_creator', label: 'About My Creator' },
        ])
      } finally {
        setCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    const update = () => {
      const availableH = window.visualViewport?.height ?? window.innerHeight
      setViewportH(availableH)
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })

  useEffect(() => {
    const t = setTimeout(() => scrollToBottom(), 60)
    return () => clearTimeout(t)
  }, [messages, isTyping])

  useEffect(() => {
    socket.on('connect', () => console.log('✅ Socket connected:', socket.id))
    socket.on('disconnect', () => console.log('❌ Socket disconnected'))
  }, [])

  const advancePair = useCallback((pool: string[], fromIdx: number) => {
    const next = pool.slice(fromIdx, fromIdx + 2)
    if (next.length === 0) {
      setExhausted(true); setCurrentPair([])
    } else {
      setCurrentPair(next); setSeenCount(fromIdx + next.length)
    }
  }, [])

  useEffect(() => {
    onReceiveMessage((data: any) => {
      setTimeout(() => {
        setIsTyping(false)
        if (data.chatId) setCurrentChatId(data.chatId)
        if (data.answer) {
          setMessages(prev => [
            ...prev,
            { id: Date.now(), role: 'assistant', bubbles: splitIntoBubbles(data.answer) }
          ])
        }
      }, 800)
    })

    onChatHistory((data: { chatId: string; messages: any[] }) => {
      setIsLoadingHistory(true)
      const formatted: Message[] = data.messages.flatMap((m, i) => [
        { id: i * 2, role: 'user', bubbles: [m.question] },
        { id: i * 2 + 1, role: 'assistant', bubbles: splitIntoBubbles(m.answer) },
      ])
      setTimeout(() => {
        setCurrentChatId(data.chatId)
        setMessages(formatted)
        setIsLoadingHistory(false)
        setTimeout(() => scrollToBottom(false), 50)
      }, 700)
    })

    socket.off('suggestions')
    socket.on('suggestions', (data: { questions: string[] }) => {
      const pool = data.questions ?? []
      setAllSuggestions(pool)
      setSeenCount(0)
      setExhausted(false)
      setFeedbackDone(false)
      const first = pool.slice(0, 2)
      setCurrentPair(first)
      setSeenCount(first.length)
      setLoadingSuggestions(false)
    })

    socket.off('error_message')
    socket.on('error_message', () => {
      setIsTyping(false)
    })

    const handleNewChat = () => {
      setIsLoadingHistory(true)
      setTimeout(() => {
        setCurrentChatId(null); setMessages([])
        setIsLoadingHistory(false); resetSuggestions()
      }, 400)
    }

    window.addEventListener('start-new-chat', handleNewChat)
    return () => {
      removeSocketListeners()
      socket.off('error_message')
      window.removeEventListener('start-new-chat', handleNewChat)
    }
  }, [])

  const exhaustedRef = useRef(false)
  useEffect(() => { exhaustedRef.current = exhausted }, [exhausted])

  useEffect(() => {
    const onFocus = () => scrollToBottom(false)
    const dismissFeedback = () => {
      if (exhaustedRef.current) { setExhausted(false); setFeedbackDone(false) }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') dismissFeedback()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', dismissFeedback)
    window.addEventListener('pagehide', dismissFeedback)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', dismissFeedback)
      window.removeEventListener('pagehide', dismissFeedback)
    }
  }, [])

  const resetSuggestions = () => {
    setSelectedCategory(null); setAllSuggestions([]); setCurrentPair([])
    setSeenCount(0); setExhausted(false); setFeedbackDone(false)
  }

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId); setLoadingSuggestions(true)
    setCurrentPair([]); setAllSuggestions([]); setSeenCount(0)
    setExhausted(false); setFeedbackDone(false)
    socket.emit('get_suggestions', { category: categoryId })
  }

  const handleSuggestionClick = (question: string) => {
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', bubbles: [question] }])
    setIsTyping(true)
    sendMessage(question, currentChatId)
    setInput('')
    advancePair(allSuggestions, seenCount)
  }

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', bubbles: [input] }])
    setIsTyping(true)
    sendMessage(input, currentChatId)
    if (selectedCategory && !exhausted) advancePair(allSuggestions, seenCount)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  const handleFeedback = (helpful: boolean) => {
    setFeedbackDone(true)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'assistant',
        bubbles: [helpful
          ? "Thanks for your feedback! 🙏 Really glad I could help."
          : "Thanks for letting me know! 🙏 I'll work on doing better."]
      }])
      resetSuggestions()
    }, 400)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return
    isDown.current = true; dragged.current = false
    carouselRef.current.style.cursor = 'grabbing'
    startX.current = e.pageX - carouselRef.current.offsetLeft
    scrollLeftRef.current = carouselRef.current.scrollLeft
    e.preventDefault()
  }
  const handleMouseUp = () => {
    if (!carouselRef.current) return
    isDown.current = false
    carouselRef.current.style.cursor = 'grab'
    setTimeout(() => { dragged.current = false }, 50)
  }
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDown.current || !carouselRef.current) return
    const x = e.pageX - carouselRef.current.offsetLeft
    const walk = x - startX.current
    if (Math.abs(walk) > 4) dragged.current = true
    carouselRef.current.scrollLeft = scrollLeftRef.current - walk
  }

  const typingDots = [
    { color: '#4a4a4a', delay: 0 },
    { color: '#ff0000', delay: 0.15 },
    { color: '#b0b0b0', delay: 0.3 },
  ]

  const renderSuggestionStrip = () => {
    const btnBase = "transition-all duration-200 active:scale-95 cursor-pointer border";
    const btnTheme = "border-white/10 bg-white/5 hover:bg-white/10 shadow-none text-slate-300";

    if (!selectedCategory) {
      return (
        <motion.div
          key="cats" ref={carouselRef}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none"
          style={{ cursor: 'grab' }}
          onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp} onMouseMove={handleMouseMove}
        >
          {categories.map((cat, i) => (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => !dragged.current && handleCategorySelect(cat.id)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs whitespace-nowrap ${btnBase} ${btnTheme}`}
            >
              {cat.label}
            </motion.button>
          ))}
        </motion.div>
      )
    }

    if (loadingSuggestions) {
      return (
        <motion.div key="loading" className="flex items-center gap-2 py-1">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="h-5 w-5 rounded-full shrink-0"
            style={{
              background: ULTRON_CONIC,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black 100%)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black 100%)',
            }}
          />
          <span className="text-xs font-medium text-slate-400">Loading…</span>
        </motion.div>
      )
    }

    if (exhausted && !feedbackDone) {
      return (
        <motion.div key="feedback"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 flex-wrap"
        >
          <span className="text-xs font-medium text-slate-400">Was this helpful?</span>
          {[{ label: '👍 Yes', val: true }, { label: '👎 No', val: false }].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => handleFeedback(val)}
              className={`px-3.5 py-2 rounded-full text-xs ${btnBase} ${btnTheme}`}
            >
              {label}
            </button>
          ))}
        </motion.div>
      )
    }

    if (currentPair.length > 0) {
      return (
        <motion.div key={`pair-${seenCount}`}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="flex gap-2 flex-wrap"
        >
          {currentPair.map((q, i) => (
            <motion.button key={`${seenCount}-${i}`}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => handleSuggestionClick(q)}
              className={`flex-1 min-w-35 text-left px-3.5 py-2.5 rounded-xl text-xs leading-snug ${btnBase} ${btnTheme}`}
            >
              {q.length > 60 ? q.slice(0, 57) + '…' : q}
            </motion.button>
          ))}
        </motion.div>
      )
    }
    return null
  }

  const rootStyle: React.CSSProperties = viewportH
    ? { height: `${viewportH}px` }
    : { height: '100dvh' }

  return (
    <div
      className="flex flex-col w-full bg-black text-slate-200 overflow-hidden"
      style={rootStyle}
    >
      {/* ── Scrollable messages ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <div className="mx-auto w-full max-w-3xl px-4">
          <AnimatePresence mode="wait">

            {isLoadingHistory ? (
              <motion.div key="loading-state"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center"
                style={{ minHeight: `${viewportH ? viewportH - 120 : 0}px` }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  className="h-16 w-16 rounded-full"
                  style={{
                    background: ULTRON_CONIC,
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black 100%)',
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black 100%)',
                  }}
                />
              </motion.div>

            ) : messages.length === 0 ? (
              <motion.div key="welcome-screen"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center text-center"
                style={{ minHeight: `${viewportH ? viewportH - 120 : 0}px` }}
              >
                <motion.video
                  src="/upscaled-video.mp4"
                  width={150}
                  className="mb-6 rounded-full"
                  autoPlay
                  loop
                  muted
                  playsInline
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 100 }}
                />
                <motion.h1
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-3xl sm:text-4xl font-bold px-4 gemini-text-flow"
                >
                  How can I help you?
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="mt-3 text-xs text-slate-500"
                >
                  Pick a topic below or just type ↓
                </motion.p>
              </motion.div>

            ) : (
              <motion.div key="chat-messages"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-4 py-6"
              >
                {messages.map((msg) => (
                  <div key={msg.id}
                    className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 ml-1 mb-0.5">
                        <img src="/Ultron.png" alt="Ultron" className="h-6 w-6 block" />
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">
                          Ultron
                        </span>
                      </div>
                    )}

                    {msg.bubbles.map((bubble, bi) => (
                      <motion.div
                        key={bi}
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: bi * 0.13, duration: 0.25 }}
                        className={`
                          max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
                          ${msg.role === 'user'
                            ? "ml-auto bg-black/10 border border-white/10"
                            : "mr-auto bg-white/5 border border-white/10"
                          }
                        `}
                      >
                        <span className={msg.role === 'user' ? "font-bold gemini-text-flow" : "text-gray-200"}>
                          {bubble}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex flex-col items-start gap-1.5">
                    <div className="flex items-center gap-2 ml-1 mb-0.5">
                      <img src="/Ultron.png" alt="Ultron" className="h-6 w-6 " />
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">
                        Ultron
                      </span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 shadow-sm">
                      <div className="flex gap-1.5 items-center">
                        {typingDots.map((dot, i) => (
                          <motion.div key={i}
                            animate={{ y: [0, -6, 0] }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut', delay: dot.delay }}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: dot.color, boxShadow: `0 0 8px ${dot.color}88` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0 w-full bg-black border-t border-white/5">
        <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-3 space-y-2">
          <AnimatePresence mode="wait">
            <div className="min-h-9 flex items-center">
              {renderSuggestionStrip()}
            </div>
          </AnimatePresence>

          <form onSubmit={handleSend}>
            <div className="relative group">
              <div className="absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 gemini-bg-animate" />
              <div className="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f0f0f] px-2 py-1.5 shadow-sm">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Ultron..."
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none min-w-0"
                />
                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!input.trim()}
                  className="flex cursor-pointer h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-black/10 shadow-sm transition-all disabled:opacity-30 active:scale-95 hover:bg-red-50"
                >
                  <FiSend size={16} style={{ color: '#ff0000' }} />
                </button>
              </div>
            </div>
          </form>

          <p className="text-[9px] text-center uppercase tracking-wider font-light text-gray-400 ">
            Ultron can make mistakes
          </p>
        </div>
      </div>
    </div>
  )
}

export { socket }
