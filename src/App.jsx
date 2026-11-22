import { useState } from "react";
import {
  Activity, AtSign, Bell, ChevronDown, Compass, Hash, Headphones,
  MessageCircle, Plus, Search, Send, Settings, Shield, Users
} from "lucide-react";

const initialMessages = [
  { id: 1, author: "mira", time: "10:42", text: "Welcome to the first ConnectX space. Glad you're here." },
  { id: 2, author: "pixelbyte", time: "10:44", text: "The interface is looking clean already." },
  { id: 3, author: "mira", time: "10:46", text: "Small communities, good conversations. That's the idea." }
];

export default function App() {
  const [activeSpace, setActiveSpace] = useState("The Workshop");
  const [activeChannel, setActiveChannel] = useState("general");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);

  function sendMessage(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, {
      id: Date.now(), author: "you", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), text
    }]);
    setMessage("");
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
        <div className="avatar self-avatar">C</div>
      </aside>

      <aside className="space-sidebar">
        <div className="sidebar-top">
          <div><div className="eyebrow">YOUR SPACE</div><button className="space-picker">{activeSpace}<ChevronDown size={15}/></button></div>
          <button className="icon-button" title="Space options"><Plus size={18}/></button>
        </div>
        <div className="sidebar-search"><Search size={15}/><span>Find a conversation</span><kbd>⌘ K</kbd></div>
        <div className="section-heading"><span>CHANNELS</span><button className="tiny-button" title="Add channel"><Plus size={15}/></button></div>
        {["general", "introductions", "tech-talk", "showcase"].map((channel) => (
          <button key={channel} onClick={() => setActiveChannel(channel)} className={`channel-row ${activeChannel === channel ? "active" : ""}`}>
            <Hash size={16}/><span>{channel}</span>{channel === "general" && <i className="unread-dot"/>}
          </button>
        ))}
        <div className="section-heading people-heading"><span>DIRECT MESSAGES</span><button className="tiny-button" title="New message"><Plus size={15}/></button></div>
        <button className="person-row"><div className="avatar avatar-purple">M</div><span>mira</span><i className="online-dot"/></button>
        <button className="person-row"><div className="avatar avatar-green">P</div><span>pixelbyte</span></button>
        <button className="person-row"><div className="avatar avatar-orange">N</div><span>nocturne</span></button>
        <div className="sidebar-bottom"><div className="avatar self-avatar">C</div><div className="profile-copy"><strong>carson</strong><span>Online</span></div><button className="icon-button"><Settings size={17}/></button></div>
      </aside>

      <section className="conversation">
        <header className="conversation-header">
          <div className="channel-title"><Hash size={19}/><strong>{activeChannel}</strong><span className="header-divider"/><span className="channel-description">A place to talk about anything.</span></div>
          <div className="header-actions"><button className="icon-button"><Users size={18}/></button><button className="icon-button"><Search size={18}/></button><button className="icon-button"><Bell size={18}/></button></div>
        </header>
        <div className="message-list">
          <div className="welcome-block"><div className="welcome-icon"><Hash size={25}/></div><h1>Welcome to #{activeChannel}</h1><p>This is the beginning of the conversation.</p></div>
          {messages.map((item) => (
            <article className="message" key={item.id}>
              <div className={`avatar message-avatar ${item.author === "you" ? "self-avatar" : item.author === "mira" ? "avatar-purple" : "avatar-green"}`}>{item.author[0].toUpperCase()}</div>
              <div className="message-content"><div className="message-meta"><strong>{item.author}</strong><time>{item.time}</time></div><p>{item.text}</p></div>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <button type="button" className="composer-plus" title="Add attachment"><Plus size={20}/></button>
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message #${activeChannel}`} aria-label="Message"/>
          <button className="send-button" type="submit" disabled={!message.trim()} title="Send message"><Send size={17}/></button>
        </form>
        <div className="prototype-note">ConnectX preview · Messages are currently local to this window</div>
      </section>

      <aside className="details-panel">
        <div className="details-heading">SPACE DETAILS</div>
        <div className="space-card"><div className="space-art"><span>cx</span></div><h2>The Workshop</h2><p>A small corner of the internet for curious people.</p><div className="space-stats"><div><strong>3</strong><span>Members</span></div><div><strong>4</strong><span>Channels</span></div></div></div>
        <div className="details-heading member-heading">ONLINE — 2</div>
        <div className="member-row"><div className="avatar avatar-purple">M</div><div><strong>mira</strong><span>Exploring ideas</span></div><i className="online-dot"/></div>
        <div className="member-row"><div className="avatar self-avatar">C</div><div><strong>carson</strong><span>Building ConnectX</span></div><i className="online-dot"/></div>
        <div className="details-heading about-heading">ABOUT CONNECTX</div>
        <div className="about-card"><Shield size={17}/><span>Built for smaller, friendlier communities.</span></div>
      </aside>
    </main>
  );
}