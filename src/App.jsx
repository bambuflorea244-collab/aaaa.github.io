import React, { useEffect, useState } from "react";

const API = (path, opts = {}) =>
  fetch(path, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": (opts.body && !(opts.body instanceof FormData)) ? "application/json" : undefined,
      ...(opts.headers || {}),
    },
  });

const authed = (token, path, opts = {}) =>
  fetch(path, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": (opts.body && !(opts.body instanceof FormData)) ? "application/json" : undefined,
      ...(opts.headers || {}),
    },
  });

export default function App() {
  const [token, setToken] = useState("");
  const [lockPassword, setLockPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [chats, setChats] = useState([]);
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const [newChatModal, setNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatFolder, setNewChatFolder] = useState("");

  const [chatSettingsModal, setChatSettingsModal] = useState(false);
  const [chatSettings, setChatSettings] = useState(null);

  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const [settingsModal, setSettingsModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [pythonKey, setPythonKey] = useState("");
  const [settingsStatus, setSettingsStatus] = useState({});

  const loadChats = async () => {
    if (!token) return;
    const r = await authed(token, "/api/chats");
    if (r.ok) setChats(await r.json());
  };

  const loadFolders = async () => {
    if (!token) return;
    const r = await authed(token, "/api/folders");
    if (r.ok) {
      const data = await r.json();
      setFolders(data);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        data.forEach((f) => {
          if (next[f.id] === undefined) next[f.id] = true;
        });
        return next;
      });
    }
  };

  const loadMessages = async (chatId) => {
    if (!token) return;
    const r = await authed(token, `/api/chats/${chatId}/messages`);
    if (r.ok) setMessages(await r.json());
  };

  const loadSettingsStatus = async () => {
    if (!token) return;
    const r = await authed(token, "/api/settings");
    if (r.ok) setSettingsStatus(await r.json());
  };

  const tryLogin = async () => {
    setLoginError("");
    const r = await API("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: lockPassword }),
    });
    if (!r.ok) {
      try {
        const x = await r.json();
        setLoginError(x.error || "Incorrect password.");
      } catch {
        setLoginError("Incorrect password.");
      }
      return;
    }
    const data = await r.json();
    setToken(data.token);
    localStorage.setItem("session_token", data.token);
  };

  useEffect(() => {
    const saved = localStorage.getItem("session_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) {
      loadFolders();
      loadChats();
      loadSettingsStatus();
    }
  }, [token]);

  const sendMessage = async () => {
    if (!composerText.trim() || sending || !activeChat) return;
    setSending(true);

    const message = composerText.trim();
    setComposerText("");

    for (const file of attachments) {
      const fd = new FormData();
      fd.append("file", file);
      await authed(token, `/api/chats/${activeChat}/attachments`, {
        method: "POST",
        body: fd,
      });
    }
    setAttachments([]);

    const r = await authed(token, `/api/chats/${activeChat}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    if (r.ok) await loadMessages(activeChat);

    setSending(false);
  };

  const deleteChat = async (id) => {
    if (!confirm("Delete this chat and its files?")) return;
    await authed(token, `/api/chats/${id}/delete`, { method: "POST" });
    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
    }
    await loadChats();
  };

  const createChat = async () => {
    const r = await authed(token, "/api/chats", {
      method: "POST",
      body: JSON.stringify({
        title: newChatName || "New Chat",
        folderId: newChatFolder || null,
      }),
    });
    if (r.ok) {
      const data = await r.json();
      await loadChats();
      setActiveChat(data.id);
      setNewChatModal(false);
      loadMessages(data.id);
      setNewChatName("");
      setNewChatFolder("");
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const deleteFolder = async (id) => {
    if (!confirm("Delete folder? Chats inside will be moved to root.")) return;
    await authed(token, `/api/folders/${id}`, { method: "DELETE" });
    await loadFolders();
    await loadChats();
  };

  const openChatSettings = async () => {
    if (!activeChat) return;
    const r = await authed(token, `/api/chats/${activeChat}/settings`);
    if (r.ok) {
      setChatSettings(await r.json());
      setChatSettingsModal(true);
    }
  };

  const saveChatSettings = async () => {
    if (!chatSettings) return;
    const r = await authed(token, `/api/chats/${chatSettings.id}/settings`, {
      method: "POST",
      body: JSON.stringify(chatSettings),
    });
    if (r.ok) {
      setChatSettingsModal(false);
      await loadChats();
    }
  };

  const regenerateChatApiKey = async () => {
    const r = await authed(token, `/api/chats/${chatSettings.id}/settings`, {
      method: "POST",
      body: JSON.stringify({ regenerateApiKey: true }),
    });
    if (r.ok) setChatSettings(await r.json());
  };

  const saveSettings = async () => {
    await authed(token, "/api/settings", {
      method: "POST",
      body: JSON.stringify({
        geminiApiKey: geminiKey,
        pythonAnywhereKey: pythonKey,
      }),
    });
    await loadSettingsStatus();
    setSettingsModal(false);
    setGeminiKey("");
    setPythonKey("");
  };

  if (!token) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <h2>Enter Password</h2>
          {loginError && <div className="error-banner">{loginError}</div>}
          <input
            type="password"
            placeholder="Password"
            value={lockPassword}
            onChange={(e) => setLockPassword(e.target.value)}
          />
          <button className="btn btn-primary" onClick={tryLogin}>
            Unlock
          </button>
        </div>
      </div>
    );
  }

  const rootChats = chats.filter((c) => !c.folder_id);
  const chatsByFolder = {};
  chats.forEach((chat) => {
    if (chat.folder_id) {
      if (!chatsByFolder[chat.folder_id]) chatsByFolder[chat.folder_id] = [];
      chatsByFolder[chat.folder_id].push(chat);
    }
  });

  const folderMap = {};
  folders.forEach((f) => (folderMap[f.id] = { ...f, children: [] }));
  folders.forEach((f) => {
    if (f.parent_id && folderMap[f.parent_id]) {
      folderMap[f.parent_id].children.push(folderMap[f.id]);
    }
  });
  const rootFolders = Object.values(folderMap).filter((f) => !f.parent_id);

  const renderFolder = (folder, level = 0) => {
    const isOpen = expandedFolders[folder.id];
    const childChats = chatsByFolder[folder.id] || [];
    return (
      <div key={folder.id} style={{ marginLeft: level * 14 }}>
        <div className="folder-row">
          <button className="folder-toggle" onClick={() => toggleFolder(folder.id)}>
            <span className="folder-caret">{isOpen ? "▼" : "▶"}</span>
            <span className="folder-icon">📁</span>
            <span className="folder-name">{folder.name}</span>
          </button>
          <button className="delete-folder-btn" onClick={() => deleteFolder(folder.id)}>🗑</button>
        </div>
        {isOpen && (
          <div>
            {childChats.map((chat) => (
              <div className="chat-row" key={chat.id}>
                <button
                  className={"chat-item " + (chat.id === activeChat ? "active" : "")}
                  onClick={() => { setActiveChat(chat.id); loadMessages(chat.id); }}
                >
                  <span className="icon">💬</span>
                  <span className="chat-title">{chat.title}</span>
                </button>
                <button className="delete-chat-btn" onClick={() => deleteChat(chat.id)}>❌</button>
              </div>
            ))}
            {folder.children.map((child) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-title">Private Assistant</div>
            <div className="brand-subtitle">Full Local Control</div>
          </div>
          <div className="chip">PRO</div>
        </div>

        <button className="btn btn-primary" onClick={() => setNewChatModal(true)}>
          ➕ New Chat
        </button>

        <button className="btn" onClick={() => setSettingsModal(true)}>
          ⚙️ Settings
        </button>

        <div className="chat-list">
          {rootChats.map((chat) => (
            <div className="chat-row" key={chat.id}>
              <button
                className={"chat-item " + (chat.id === activeChat ? "active" : "")}
                onClick={() => { setActiveChat(chat.id); loadMessages(chat.id); }}
              >
                <span className="icon">💬</span>
                <span className="chat-title">{chat.title}</span>
              </button>
              <button className="delete-chat-btn" onClick={() => deleteChat(chat.id)}>❌</button>
            </div>
          ))}

          {rootFolders.map((f) => renderFolder(f))}
        </div>
      </div>

      <div className="main">
        <div className="main-header">
          <div className="main-header-titles">
            <div className="main-title">
              {activeChat ? chats.find((x) => x.id === activeChat)?.title : "Welcome"}
            </div>
            <div className="main-subtitle">
              {activeChat ? "Your private AI conversation" : "Start a chat or open one"}
            </div>
          </div>

          {activeChat && (
            <div className="main-header-meta">
              <button className="btn btn-sm" onClick={openChatSettings}>
                ⚙️ Chat Settings
              </button>
            </div>
          )}
        </div>

        <div className="messages">
          {!activeChat ? (
            <div className="empty-state">Select a chat or create a new one.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-model"}`}>
                {m.content}
                <div className="bubble-meta">
                  {new Date(m.created_at * 1000).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {activeChat && (
          <div className="composer">
            <div className="composer-inner">
              <div className="attachments-row">
                {attachments.map((file, i) => (
                  <div key={i} className="attachment-pill">
                    {file.name}
                    <button
                      className="remove-attachment"
                      onClick={() => setAttachments((a) => a.filter((_, x) => x !== i))}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>

              <div className="composer-row">
                <textarea
                  placeholder="Type your message..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => setAttachments([...attachments, ...Array.from(e.target.files)])}
                />
                <button className="btn btn-primary" onClick={sendMessage}>
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {newChatModal && (
        <div className="modal-backdrop" onClick={() => setNewChatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">New Chat</h2>
            <div className="modal-field">
              <label>Chat name</label>
              <input
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Chat title"
              />
            </div>
            <div className="modal-field">
              <label>Folder</label>
              <select
                value={newChatFolder}
                onChange={(e) => setNewChatFolder(e.target.value)}
              >
                <option value="">(No folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setNewChatModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createChat}>Create</button>
            </div>
          </div>
        </div>
      )}

      {settingsModal && (
        <div className="modal-backdrop" onClick={() => setSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Settings</h2>
            <div className="modal-field">
              <label>Gemini API Key</label>
              <input
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={settingsStatus.geminiApiKeySet ? "Already set" : "Enter your Gemini API key"}
              />
            </div>
            <div className="modal-field">
              <label>PythonAnywhere API Key</label>
              <input
                value={pythonKey}
                onChange={(e) => setPythonKey(e.target.value)}
                placeholder={settingsStatus.pythonAnywhereKeySet ? "Already set" : "Enter your PythonAnywhere API key"}
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSettingsModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSettings}>Save</button>
            </div>
          </div>
        </div>
      )}

      {chatSettingsModal && chatSettings && (
        <div className="modal-backdrop" onClick={() => setChatSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Chat Settings</h2>
            <div className="modal-field">
              <label>Name</label>
              <input
                value={chatSettings.title || ""}
                onChange={(e) => setChatSettings({ ...chatSettings, title: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>Folder</label>
              <select
                value={chatSettings.folder_id || ""}
                onChange={(e) => setChatSettings({ ...chatSettings, folder_id: e.target.value || null })}
              >
                <option value="">(No folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>System prompt</label>
              <textarea
                value={chatSettings.system_prompt || ""}
                onChange={(e) => setChatSettings({ ...chatSettings, system_prompt: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label>External API Key (per chat)</label>
              <input value={chatSettings.api_key} readOnly />
              <button className="btn btn-sm" onClick={regenerateChatApiKey}>🔄 Regenerate key</button>
            </div>
            <p style={{ fontSize: "12px", opacity: 0.8, marginTop: "10px" }}>
              PythonAnywhere example:<br />
              <code>
                {`import requests\n\nCHAT_ID="${chatSettings.id}"\nAPI_KEY="${chatSettings.api_key}"\nURL="https://YOUR_DOMAIN/api/chats/" + CHAT_ID + "/external"\n\npayload={\n  "message": "Hello!",\n  "attachments": []\n}\n\nresp=requests.post(URL, headers={\n  "X-CHAT-API-KEY": API_KEY,\n  "Content-Type": "application/json"\n}, json=payload)\nprint(resp.json()["reply"])`}
              </code>
            </p>
            <div className="modal-footer">
              <button className="btn" onClick={() => setChatSettingsModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveChatSettings}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
