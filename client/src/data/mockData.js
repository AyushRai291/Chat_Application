export const currentUser = {
  id: 'u0',
  name: 'Arjun Mehta',
  username: 'arjun.mehta',
  avatar: null,
  status: 'online',
};

export const conversations = [
  {
    id: 'c1',
    type: 'direct',
    name: 'Priya Sharma',
    avatar: null,
    lastMessage: 'Haan bhai, kal tak push kar deta hun.',
    lastTime: '11:42 AM',
    unread: 3,
    online: true,
    pinned: true,
  },
  {
    id: 'c2',
    type: 'group',
    name: 'Aurora Dev Team',
    avatar: null,
    lastMessage: 'Rahul: socket events done ✅',
    lastTime: '10:15 AM',
    unread: 12,
    online: false,
    pinned: true,
  },
  {
    id: 'c3',
    type: 'direct',
    name: 'Kavya Reddy',
    avatar: null,
    lastMessage: 'Design tokens finalize ho gaye?',
    lastTime: 'Yesterday',
    unread: 0,
    online: true,
    pinned: false,
  },
  {
    id: 'c4',
    type: 'direct',
    name: 'Rohit Verma',
    avatar: null,
    lastMessage: 'Rate limiting done. Redis baad mein.',
    lastTime: 'Yesterday',
    unread: 0,
    online: false,
    pinned: false,
  },
  {
    id: 'c5',
    type: 'group',
    name: 'Backend Hardening',
    avatar: null,
    lastMessage: 'Block/report feature shipped 🚀',
    lastTime: 'Mon',
    unread: 0,
    online: false,
    pinned: false,
  },
  {
    id: 'c6',
    type: 'direct',
    name: 'Sneha Iyer',
    avatar: null,
    lastMessage: 'Shared media panel kaisa lage?',
    lastTime: 'Sun',
    unread: 1,
    online: false,
    pinned: false,
  },
];

export const messages = [
  {
    id: 'm1',
    senderId: 'u2',
    senderName: 'Priya Sharma',
    text: 'Bhai upload validation ka PR push kiya.',
    time: '11:30 AM',
    type: 'text',
    reactions: [],
    status: 'read',
  },
  {
    id: 'm2',
    senderId: 'u0',
    senderName: 'Arjun Mehta',
    text: 'Dekha, nice work. Attachment metadata bhi check ho raha hai ab?',
    time: '11:34 AM',
    type: 'text',
    reactions: [{ emoji: '👍', count: 1 }],
    status: 'read',
  },
  {
    id: 'm3',
    senderId: 'u2',
    senderName: 'Priya Sharma',
    text: 'Haan! safeHtml bhi lagaya hai text storage mein.',
    time: '11:36 AM',
    type: 'text',
    reactions: [],
    status: 'read',
  },
  {
    id: 'm4',
    senderId: 'u0',
    senderName: 'Arjun Mehta',
    text: 'Perfect. Frontend shell aaj raat tak ready kar deta hun.',
    time: '11:40 AM',
    type: 'text',
    reactions: [{ emoji: '🔥', count: 2 }],
    status: 'read',
  },
  {
    id: 'm5',
    senderId: 'u2',
    senderName: 'Priya Sharma',
    text: 'Haan bhai, kal tak push kar deta hun.',
    time: '11:42 AM',
    type: 'text',
    reactions: [],
    status: 'delivered',
  },
];

export const activeConversation = {
  id: 'c1',
  type: 'direct',
  name: 'Priya Sharma',
  avatar: null,
  online: true,
  membersCount: 2,
  members: [
    { id: 'u2', name: 'Priya Sharma', avatar: null, status: 'online', role: 'member' },
    { id: 'u0', name: 'Arjun Mehta', avatar: null, status: 'online', role: 'member' },
  ],
  sharedMedia: [
    { id: 'sm1', type: 'image', name: 'screenshot.png', size: '128 KB' },
    { id: 'sm2', type: 'file', name: 'backend-notes.pdf', size: '340 KB' },
    { id: 'sm3', type: 'file', name: 'endpoint-map.md', size: '12 KB' },
  ],
};

export const messagesByConversationId = {
  c1: messages,
  c2: [
    {
      id: 'm-c2-1',
      senderId: 'u3',
      senderName: 'Rahul Singh',
      text: 'Socket events ke liye backend ready hai. Frontend static shell pe focus rakho.',
      time: '10:05 AM',
      type: 'text',
      reactions: [],
      status: 'read',
    },
    {
      id: 'm-c2-2',
      senderId: 'u0',
      senderName: 'Arjun Mehta',
      text: 'Done. API wiring baad mein karenge.',
      time: '10:12 AM',
      type: 'text',
      reactions: [],
      status: 'delivered',
    },
  ],
};

export function getConversationById(id) {
  const base = conversations.find((conversation) => conversation.id === id);

  if (!base) {
    return activeConversation;
  }

  if (base.id === activeConversation.id) {
    return activeConversation;
  }

  return {
    ...base,
    membersCount: base.type === 'group' ? 5 : 2,
    members: [
      { id: 'u0', name: currentUser.name, avatar: null, status: currentUser.status, role: 'member' },
      { id: `${base.id}-member`, name: base.name, avatar: null, status: base.online ? 'online' : 'offline', role: 'member' },
    ],
    sharedMedia: [],
  };
}

export function getMessagesByConversationId(id) {
  return messagesByConversationId[id] || [];
}
