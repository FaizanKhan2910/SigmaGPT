import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import Message from './Message'
import VoiceAssistant from './VoiceAssistant'



const ChatBox = () => {
  const { selectedChat, theme, user, axios, token, setUser, messages, setMessages, syncMessages } = useAppContext()
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('text')
  const [isPublished, setIsPublished] = useState(true)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages)
    }
  }, [selectedChat])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!user) return toast('Login to send message')
    if (!selectedChat) return toast('Select a chat first')
    if (!prompt.trim() || loading) return

    const propmtCopy = prompt
    const chatId = selectedChat._id
    const userMsg = { role: 'user', content: prompt, timestamp: Date.now(), isImage: false }

    // Sync local message
    const updatedMessages = [...messages, userMsg]
    syncMessages(chatId, updatedMessages)

    try {
      setLoading(true)
      setPrompt('')

      const { data } = await axios.post(`/api/message/${mode}`, { chatId, prompt: propmtCopy, isPublished }, { headers: { Authorization: token } })

      if (data.success) {
        // Sync bot reply
        syncMessages(chatId, [...updatedMessages, data.reply])

        // Decrease credits locally
        if (mode === 'image' && isPublished) {
          setUser(prev => ({ ...prev, credits: prev.credits - 2 }))
        } else {
          setUser(prev => ({ ...prev, credits: prev.credits - 1 }))
        }
      } else {
        toast.error(data.message)
        setPrompt(propmtCopy)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const showLoader = messages.length > 0 && messages[messages.length - 1]?.role === 'user'
  return (
    <div className='flex flex-col flex-1 h-screen relative overlow-hidden'>
      {/* Chat Mesages */}
      <div ref={containerRef} className='flex-1 overflow-y-auto p-5 md:p-10 max-md:mt-14'>
        {messages.length === 0 ? (
          <div className='h-full flex items-center justify-center flex-col gap-6'>
            <div className='flex flex-col items-center gap-4'>
              <div className='w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#A456F7] to-[#3D81F6] flex items-center justify-center shadow-2xl mb-2'>
                <img src={assets.logo} alt="logo" className='w-12 invert' />
              </div>
              <h1 className='text-5xl sm:text-7xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent tracking-tight'>SigmaGPT</h1>
            </div>
            <p className='text-2xl sm:text-3xl font-medium text-center text-gray-500 dark:text-gray-400 px-4'>How can I help you today?</p>
          </div>
        ) : (
          <div className='max-w-4xl mx-auto w-full space-y-6 pb-32'>
            {messages.map((message, index) => (
              <Message key={index} message={message} />
            ))}
            {showLoader && (
              <div className='loader flex items-center gap-1.5 ml-2'>
                <div className='w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce'></div>
                <div className='w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce'></div>
                <div className='w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce'></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className='absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-[#000000] via-white/80 dark:via-[#000000]/80 to-transparent'>
        {mode === 'image' && (
          <label className='flex items-center justify-center gap-2 mb-4 text-xs mx-auto text-gray-500 dark:text-gray-400'>
            <p>Publish Generated Image to Community</p>
            <input type="checkbox" className='cursor-pointer rounded border-gray-300' checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)} />
          </label>
        )}

        {/* Input Box */}
        <form onSubmit={onSubmit} className='bg-white dark:bg-[#212121] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-3xl p-2 px-4 mx-auto flex gap-3 items-center shadow-xl backdrop-blur-md'>
          <select onChange={(e) => setMode(e.target.value)} value={mode} className='text-sm font-medium pl-2 pr-1 outline-none bg-transparent dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 rounded-md p-1 transition-colors'>
            <option className='dark:bg-[#1E1E1E]' value="text">Text</option>
            <option className='dark:bg-[#1E1E1E]' value="image">Image</option>
          </select>
          <input
            onChange={(e) => setPrompt(e.target.value)}
            value={prompt}
            type='text'
            placeholder='Type your Prompt here...'
            className='flex-1 w-full text-[15px] outline-none bg-transparent dark:text-white placeholder-gray-500 dark:placeholder-gray-400 py-2'
            required
          />
          <div className="flex items-center gap-1.5">
            <VoiceAssistant setParentPrompt={setPrompt} />
            <button
              disabled={loading}
              className={`p-2 rounded-xl transition-all duration-300 ${loading ? 'opacity-50' : 'hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
            >
              <img src={loading ? assets.stop_icon : assets.send_icon} className='w-6 sm:w-7 cursor-pointer' alt='' />
            </button>
          </div>
        </form>
        <p className='text-[10px] text-center text-gray-400 mt-2'>SigmaGPT can make mistakes. Check important info.</p>
      </div>
    </div>
  )

}

export default ChatBox
