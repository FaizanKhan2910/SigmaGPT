import { useEffect, useState } from "react";
import { AppContext } from "./AppContext";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// In production, the backend is serving the frontend from the exact same URL, so we can use relative paths ('').
const backendUrl = import.meta.env.PROD ? "" : (import.meta.env.VITE_SERVER_URL || "http://localhost:3000");
axios.defaults.baseURL = backendUrl;
console.log("Backend URL:", backendUrl);
export const AppContextProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([])
    const [selectedChat, setSelectedChat] = useState(null)
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const [token, setToken] = useState(localStorage.getItem("token") || null);
    const [loadingUser, setLoadingUser] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("theme", theme)
    }, [theme])

    const fetchUser = async () => {
        try {
            const { data } = await axios.get('/api/user/data', { headers: { Authorization: token } })
            if (data.success) {
                setUser(data.user)
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                // Token is invalid or expired: log out cleanly
                localStorage.removeItem("token");
                setToken(null);
                setUser(null);
                navigate('/login');
            } else {
                toast.error(error.message);
            }
        } finally {
            setLoadingUser(false);
        }
    }
    const createNewChat = async () => {
        try {
            if (!user) return toast('Login to create a new chat')
            navigate('/')
            const { data } = await axios.get('/api/chat/create', { headers: { Authorization: token } })
            if (data.success) {
                // Instead of calling fetchUsersChats recursively, we update the state directly
                // or just call it once without it calling createNewChat again.
                const updatedChats = await axios.get('/api/chat/get', { headers: { Authorization: token } })
                if (updatedChats.data.success) {
                    setChats(updatedChats.data.chats)
                    setSelectedChat(updatedChats.data.chats[0]) // Select the newest chat
                }
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }
    const fetchUsersChats = async () => {
        try {
            const { data } = await axios.get('/api/chat/get', { headers: { Authorization: token } })
            if (data.success) {
                setChats(data.chats)
                if (data.chats.length > 0) {
                    setSelectedChat(prev => {
                        const current = data.chats.find(c => c._id === prev?._id)
                        return current ? current : data.chats[0]
                    })
                } else {
                    setSelectedChat(null)
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message)
        }
    }



    useEffect(() => {
        if (user?._id) {
            fetchUsersChats()
        }
        else if (!token) {
            setSelectedChat(null)
            setChats([])
        }
    }, [user?._id])

    useEffect(() => {
        if (token) {
            fetchUser()
        } else {
            setUser(null)
            setLoadingUser(false)
            navigate('/login')
        }
    }, [token])
    const syncMessages = (chatId, newMessages) => {
        // Update global messages state
        setMessages(newMessages)

        // Update the specific chat in the chats array
        setChats(prev => prev.map(chat => {
            if (chat._id === chatId) {
                return { ...chat, messages: newMessages }
            }
            return chat
        }))

        // Update selectedChat if it's the one we're currently viewing
        setSelectedChat(prev => {
            if (prev?._id === chatId) {
                return { ...prev, messages: newMessages }
            }
            return prev
        })
    }

    const value = {
        user,
        setUser,
        chats,
        setChats,
        selectedChat,
        setSelectedChat,
        messages,
        setMessages,
        syncMessages,
        theme,
        setTheme,
        token,
        setToken,
        loadingUser,
        axios,
        setLoadingUser,
        navigate,
        fetchUser,
        createNewChat,
        fetchUsersChats,
        toggleTheme: () => setTheme(prev => (prev === "dark" ? "light" : "dark")),
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
