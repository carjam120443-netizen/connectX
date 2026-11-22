import { useEffect, useRef, useState } from "react";
import {
  Activity, Bell, ChevronDown, Compass, Hash, LogOut, MessageCircle,
  Plus, Search, Send, Settings, Shield, Users
} from "lucide-react";
import { api, getApiBase, connectSocket } from "./api.js";

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readGuestMessages(channelId) {
  try {
    return JSON.parse(localStorage.getItem(`connectx_guest_messages_${channelId}`) || "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("connectx_token") || "");
  const [guestMode, setGuestMode] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(() => getApiBase());
  const [authBusy, setAuthBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);
  const endRef = useRef(null);

  async function loadWorkspace(authToken) {
    const result = await api("/api/spaces", { token: authToken });
    setSpaces(result.spaces);
    const space = result.spaces[0] || null;
    setActiveSpace(space);
    setChannels(space?.channels || []);
    setActiveChannel(space?.channels?.[0] || null);
  }

  useEffect(() => {
    let alive = true;
    if (!token) {
      setBooting(false);
      return () => { alive = false; };
    }
    (async () => {
      try {
        const result = await api("/api/me", { token });
        if (!alive) return;
        setUser(result.user);
        await loadWorkspace(token);
      } catch (err) {
        localStorage.removeItem("connectx_token");
        if (alive) {
          setToken("");
          setUser(null);
          setError(err.message);
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (guestMode && activeChannel?.id) {
      setMessages(readGuestMessages(activeChannel.id));
      return;
    }
    if (!token || !activeChannel?.id) {
      setMessages([]);
      return;
    }
    let alive = true;
    const socket = connectSocket(token);
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("channel:join", activeChannel.id));
    socket.on("message:new", (incoming) => {
      if (alive) setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
    });
    api(`/api/channels/${activeChannel.id}/messages`, { token })
      .then((result) => { if (alive) setMessages(result.messages); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => {
      alive = false;
      socket.emit("channel:leave", activeChannel.id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, guestMode, activeChannel?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    let parsedServer;
    try {
      parsedServer = new URL(serverUrl.trim());
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsedServer.hostname);
      if (parsedServer.protocol !== "https:" && !(isLocal && parsedServer.protocol === "http:")) {
        throw new Error("Use HTTPS for a remote server. HTTP is only allowed for localhost.");
      }
      localStorage.setItem("connectx_api_url", parsedServer.origin);
    } catch (err) {
      setError(err.message || "Enter a valid server URL.");
      return;
    }
    setAuthBusy(true);
    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = authMode === "register" ? { username, email, password } : { email, password };
      const result = await api(path, { method: "POST", body: JSON.stringify(body) });
      localStorage.removeItem("connectx_guest");
      localStorage.setItem("connectx_token", result.token);
      setGuestMode(false);
      setUser(result.user);
      setToken(result.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function continueAsGuest() {
    const guestName = `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const guestUser = { id: `guest-${crypto.randomUUID()}`, username: guestName, email: "Offline guest session" };
    const demoSpace = {
      id: "guest-workshop",
      name: "The Workshop",
      description: "A local ConnectX guest preview.",
      channels: [
        { id: "guest-general", name: "general", topic: "A place to talk." },
        { id: "guest-tech-talk", name: "tech-talk", topic: "Talk about what you're building." },
        { id: "guest-showcase", name: "showcase", topic: "Show off your projects." }
      ]
    };
    localStorage.removeItem("connectx_token");
    localStorage.setItem("connectx_guest", JSON.stringify(guestUser));
    setToken("");
    setGuestMode(true);
    setUser(guestUser);
    setSpaces([demoSpace]);
    setActiveSpace(demoSpace);
    setChannels(demoSpace.channels);
    setActiveChannel(demoSpace.channels[0]);
    setMessages(readGuestMessages(demoSpace.channels[0].id));
    setError("");
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || !activeChannel || sending) return;
    setSending(true);
    setError("");
    if (guestMode) {
      const guestMessage = {
        id: `local-${crypto.randomUUID()}`,
        content,
        createdAt: new Date().toISOString(),
        author: { id: user.id, username: user.username }
      };
      const nextMessages = [...messages, guestMessage];
      localStorage.setItem(`connectx_guest_messages_${activeChannel.id}`, JSON.stringify(nextMessages));
      setMessages(nextMessages);
      setMessage("");
      setSending(false);
      return;
    }
    try {
      const result = await api(`/api/channels/${activeChannel.id}/messages`, {
        method: "POST", token, body: JSON.stringify({ content })
      });
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function signOut() {
    socketRef.current?.disconnect();
    localStorage.removeItem("connectx_token");
    localStorage.removeItem("connectx_guest");
    setToken("");
    setGuestMode(false);
    setUser(null);
    setSpaces([]);
    setChannels([]);
    setActiveSpace(null);
    setActiveChannel(null);
    setMessages([]);
    setPassword("");
    setError("");
  }

  if (booting) return <div className="loading-screen"><div className="brand-mark">c<span>.</span></div><p>Connecting to ConnectX…</p></div>;

  if ((!token && !guestMode) || !user) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><div className="brand-mark">c<span>.</span></div><span>connectX</span></div>
          <div className="auth-kicker">A SMALL PLACE TO CONNECT</div>
          <h1>{authMode === "register" ? "Create your space." : "Good to see you."}</h1>
          <p className="auth-subtitle">{authMode === "register" ? "Make an account and join the conversation." : "Sign in to pick up where the conversation left off."}</p>
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" && <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" required placeholder="your_username"/></label>}
            <label>Server address<input type="url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} required placeholder="https://chat.example.com"/></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "register" ? 10 : 1} maxLength={72} autoComplete={authMode === "register" ? "new-password" : "current-password"} required placeholder={authMode === "register" ? "At least 10 characters" : "Your password"}/></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}</button>
          </form>
          <button className="auth-switch" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setError(""); }}>
            {authMode === "register" ? "Already have an account? Sign in" : "New to ConnectX? Create an account"}
          </button>
          <div className="auth-separator"><span>OR</span></div>
          <button className="guest-submit" onClick={continueAsGuest}>Continue as Guest</button>
          <div className="guest-explainer">No account needed. Guest messages stay on this device and aren't shared with other people.</div>
          <div className="auth-server">Your server address is saved on this device. Remote servers must use HTTPS.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="brand-mark">c<span>.</span></div>
        <button className="rail-button selected" title="Messages"><MessageCircle size={19}/></button>
        <button className="rail-button" title="Discover"><Compass size={19}/></button>
        <button className="rail-button" title="Activity"><Activity size={19}/></button>
        <div className="rail-spacer"/>
        <button className="rail-button" title="Notifications"><Bell size={19}/></button>
        <button className="rail-button" title="Settings"><Settings size={19}/></button>
        <div className="avatar self-avatar">{user.username[0].toUpperCase()}</div>
      </aside>

      <aside className="space-sidebar">
        <div className="sidebar-top">
          <div><div className="eyebrow">YOUR SPACE</div><button className="space-picker">{activeSpace?.name || "No space"}<ChevronDown size={15}/></button></div>
          <button className="icon-button" title="Space options" disabled><Plus size={18}/></button>
        </div>
        <div className="sidebar-search"><Search size={15}/><span>Find a conversation</span><kbd>⌘ K</kbd></div>
        <div className="section-heading"><span>CHANNELS</span></div>
        {channels.map((channel) => (
          <button key={channel.id} onClick={() => { setError(""); setActiveChannel(channel); }} className={`channel-row ${activeChannel?.id === channel.id ? "active" : ""}`}>
            <Hash size={16}/><span>{channel.name}</span>
          </button>
        ))}
        <div className="empty-sidebar-note">{channels.length ? (guestMode ? "Guest preview · messages are stored locally." : "More ways to connect are on the way.") : "No channels are available in this space yet."}</div>
        <div className="section-heading people-heading"><span>DIRECT MESSAGES</span></div>
        <div className="empty-sidebar-note">Direct messages are coming in a future update.</div>
        <div className="sidebar-bottom"><div className="avatar self-avatar">{user.username[0].toUpperCase()}</div><div className="profile-copy"><strong>{user.username}</strong><span>{guestMode ? "Offline guest" : "Signed in"}</span></div><button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div>
      </aside>

      <section className="conversation">
        <header className="conversation-header">
          <div className="channel-title"><Hash size={19}/><strong>{activeChannel?.name || "no-channel"}</strong><span className="header-divider"/><span className="channel-description">{activeChannel?.topic || "A place to talk."}</span></div>
          <div className="header-actions"><button className="icon-button" title="Members" disabled><Users size={18}/></button><button className="icon-button" title="Search" disabled><Search size={18}/></button><button className="icon-button" title="Notifications" disabled><Bell size={18}/></button></div>
        </header>
        {guestMode && <div className="guest-banner">Guest preview — messages are saved only on this device, not sent to a server.</div>}
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        <div className="message-list">
          {activeChannel ? (
            <>
              <div className="welcome-block"><div className="welcome-icon"><Hash size={25}/></div><h1>Welcome to #{activeChannel.name}</h1><p>{guestMode ? "Try the local guest chat. Only you can see these messages." : "This is the beginning of the conversation."}</p></div>
              {messages.map((item) => (
                <article className="message" key={item.id}>
                  <div className={`avatar message-avatar ${item.author.id === user.id ? "self-avatar" : "avatar-purple"}`}>{item.author.username[0].toUpperCase()}</div>
                  <div className="message-content"><div className="message-meta"><strong>{item.author.username}</strong><time>{formatTime(item.createdAt)}</time></div><p>{item.content}</p></div>
                </article>
              ))}
              <div ref={endRef}/>
            </>
          ) : <div className="welcome-block"><h1>No space access yet</h1><p>Ask a space administrator to add your account.</p></div>}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <button type="button" className="composer-plus" title="Attachments are coming soon" disabled><Plus size={20}/></button>
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={activeChannel ? `Message #${activeChannel.name}` : "No channel selected"} aria-label="Message" disabled={!activeChannel || sending} maxLength={2000}/>
          <button className="send-button" type="submit" disabled={!message.trim() || !activeChannel || sending} title="Send message"><Send size={17}/></button>
        </form>
        <div className="prototype-note">{guestMode ? "ConnectX · Offline guest preview" : "ConnectX · Messages sync through your server"}</div>
      </section>

      <aside className="details-panel">
        <div className="details-heading">SPACE DETAILS</div>
        <div className="space-card"><div className="space-art"><span>cx</span></div><h2>{activeSpace?.name || "ConnectX"}</h2><p>{activeSpace?.description || "A small place to connect."}</p><div className="space-stats"><div><strong>{spaces.length}</strong><span>Spaces</span></div><div><strong>{channels.length}</strong><span>Channels</span></div></div></div>
        <div className="details-heading member-heading">YOUR ACCOUNT</div>
        <div className="member-row"><div className="avatar self-avatar">{user.username[0].toUpperCase()}</div><div><strong>{user.username}</strong><span>{guestMode ? "Local-only guest" : user.email}</span></div></div>
        <div className="details-heading about-heading">ABOUT CONNECTX</div>
        <div className="about-card"><Shield size={17}/><span>Built for smaller, friendlier communities.</span></div>
      </aside>
    </main>
  );
}
