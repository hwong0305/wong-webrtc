const videoGrid = document.getElementById('video-grid')
const onlineBtn = document.getElementById('online')
const callBtn = document.getElementById('call')

const peers = {}
let otheruser
let localstream

async function online() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  })

  const video = document.createElement('video')
  video.width = 480
  video.height = 360
  video.srcObject = stream
  video.muted = true
  video.play()

  videoGrid.appendChild(video)
  localstream = stream
}

onlineBtn.addEventListener('click', online)

async function call() {
  const socket = io('/')

  socket.emit('join', ROOM_ID)

  socket.on('other users', users => {
    users.forEach(user => {
      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'stun:stun.stunprotocol.org',
          },
        ],
      })
      localstream.getTracks().forEach(track => {
        peer.addTrack(track, localstream)
      })

      peer.onicecandidate = e => handleICECandidateEvent(e, user)
      peer.ontrack = handleTrack
      peer.onnegotiationneeded = () => handleNegotiationNeeded(user)
      peers[user] = peer
    })
  })

  socket.on('offer', async payload => {
    console.log('Socket on Offer')
    const { target, offer } = payload
    if (!peers[target]) {
      peers[target] = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'stun:stun.stunprotocol.org',
          },
        ],
      })

      localstream.getTracks().forEach(track => {
        peers[target].addTrack(track, localstream)
      })
    }

    await peers[target].setRemoteDescription(offer)

    const answer = await peers[target].createAnswer()
    const outgoingPayload = {
      target,
      answer,
    }

    socket.emit('answer', outgoingPayload)
  })

  socket.on('answer', async payload => {
    console.log('Socket on Answer')
    const { target, answer } = payload

    await peers[target].setRemoteDescription(answer)
  })

  socket.on('icecandidate', async payload => {
    console.log('socket on ice candidate')
    const { candidate, target } = payload

    await peers[target].addIceCandidate(candidate)
  })

  function callUser(userID) {
    peers[userID] = createPeer(userID)
  }

  function handleICECandidateEvent(e, userID) {
    if (e.candidate) {
      console.log('ice candidate event')
      const payload = {
        candidate: e.candidate,
        target: userID,
      }
      socket.emit('icecandidate', payload)
    }
  }

  async function handleNegotiationNeeded(userID) {
    console.log('Handle Negotiation Needed')
    const offer = await peers[userID].createOffer()
    await peers[userID].setLocalDescription(offer)

    const payload = {
      target: userID,
      offer: offer,
    }

    socket.emit('offer', payload)
  }

  function handleTrack(e) {
    console.log('handle track event')
    const video = document.createElement('video')

    video.width = 480
    video.height = 360
    video.srcObject = e.streams[0]

    video.play()

    videoGrid.appendChild(video)
  }
}

callBtn.addEventListener('click', call)
